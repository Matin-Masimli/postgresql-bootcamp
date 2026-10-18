// Build step: generate main + hidden data, load into PGlite (Node), verify, and dump compressed
// data-dir snapshots to public/db/ together with manifest.json (schema metadata for the UI).
//   npm run build:db

import { PGlite } from '@electric-sql/pglite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLE_ORDER } from './generate.ts';
import { DATASETS, buildDataset, type DatasetName } from './datasets.ts';
import { ASSERTIONS } from './edge-cases.ts';
import { REFERENCE_DATE, DATA_START, LOGIN_TRACKING_START } from './lookups.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(root, 'public', 'db');
const schemaSql = readFileSync(join(here, 'schema.sql'), 'utf8');
const indexesSql = readFileSync(join(here, 'indexes.sql'), 'utf8');
const pgliteVersion = JSON.parse(readFileSync(join(root, 'node_modules', '@electric-sql', 'pglite', 'package.json'), 'utf8')).version;

interface ColumnMeta { name: string; type: string; nullable: boolean; default: string | null; identity: boolean; comment: string | null }
interface ConstraintMeta { name: string; type: 'p' | 'f' | 'u' | 'c'; definition: string; columns: string[]; refTable: string | null; refColumns: string[] | null }
interface TableMeta { name: string; comment: string | null; columns: ColumnMeta[]; constraints: ConstraintMeta[]; indexes: { name: string; definition: string }[]; rowCount: Record<string, number> }

const ms = (t0: number) => Math.round(performance.now() - t0);

async function buildOne(name: DatasetName) {
  const t0 = performance.now();
  const { data, csv, contentHash } = buildDataset(name);
  const genMs = ms(t0);

  const t1 = performance.now();
  const db = await PGlite.create({ postgresqlconf: ['wal_recycle = off', "timezone = 'UTC'", "datestyle = 'ISO, YMD'"] });
  // Shrink the data dir: the template databases are never used (CREATE DATABASE is not allowed in the app).
  await db.exec(`UPDATE pg_database SET datistemplate = false WHERE datname IN ('template0', 'template1')`);
  await db.exec('DROP DATABASE template0');
  await db.exec('DROP DATABASE template1');
  await db.exec(`ALTER DATABASE postgres SET timezone = 'UTC'`);
  await db.exec(`ALTER DATABASE postgres SET datestyle = 'ISO, YMD'`);
  await db.exec(`ALTER DATABASE postgres SET intervalstyle = 'postgres'`);
  await db.exec(`ALTER DATABASE postgres SET extra_float_digits = 1`);
  await db.exec(schemaSql);

  const spec = DATASETS.find((d) => d.name === name)!;
  for (const t of TABLE_ORDER) {
    const cols = data[t].columns.join(', ');
    await db.query(`COPY ${t} (${cols}) FROM '/dev/blob' WITH (FORMAT csv)`, [], { blob: new Blob([csv[t]]) });
  }
  // Identity sequences continue after the loaded ids.
  const identities = (await db.query<{ tbl: string; col: string }>(
    `SELECT c.relname AS tbl, a.attname AS col FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND a.attidentity <> '' ORDER BY 1`)).rows;
  const sequences: { table: string; column: string; sequence: string; lastValue: number }[] = [];
  for (const { tbl, col } of identities) {
    const r = await db.query<{ seq: string; v: number }>(
      `SELECT pg_get_serial_sequence($1, $2) AS seq, setval(pg_get_serial_sequence($1, $2), (SELECT max(${col}) FROM ${tbl}), true)::int AS v`,
      [tbl, col]);
    sequences.push({ table: tbl, column: col, sequence: r.rows[0].seq, lastValue: r.rows[0].v });
  }
  await db.exec(indexesSql);
  await db.exec('VACUUM (FREEZE, ANALYZE)');
  const loadMs = ms(t1);

  // Verify deliberate edge cases and internal consistency.
  const failures: string[] = [];
  for (const a of ASSERTIONS) {
    try {
      const r = await db.query<{ ok: boolean }>(`SELECT (${a.sql}) AS ok`);
      if (r.rows[0].ok !== true) failures.push(a.name);
    } catch (e) {
      failures.push(`${a.name} (error: ${(e as Error).message})`);
    }
  }

  // Row counts and schema metadata.
  const rowCount: Record<string, number> = {};
  for (const t of TABLE_ORDER) rowCount[t] = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
  const tables = await readSchema(db);
  const pgVersion = (await db.query<{ v: string }>(`SELECT current_setting('server_version') AS v`)).rows[0].v;

  // Make the dump small: flush everything, then start a fresh (zero-filled) WAL segment.
  await db.exec('CHECKPOINT');
  for (let i = 0; i < 2; i++) {
    await db.query('SELECT pg_switch_wal()');
    await db.exec('CHECKPOINT');
  }
  const t2 = performance.now();
  const dump = await db.dumpDataDir('gzip');
  const bytes = Buffer.from(await dump.arrayBuffer());
  writeFileSync(join(outDir, `${name}.tar.gz`), bytes);
  await db.close();

  return { name, seed: spec.seed, scale: spec.scale, contentHash, rowCount, tables, sequences, failures, pgVersion, bytes: bytes.length, timings: { genMs, loadMs, dumpMs: ms(t2) } };
}

async function readSchema(db: PGlite): Promise<TableMeta[]> {
  const cols = (await db.query<ColumnMeta & { table: string }>(`
    SELECT c.relname AS table, a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
           NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS default,
           a.attidentity <> '' AS identity, col_description(c.oid, a.attnum) AS comment
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE c.relkind = 'r' ORDER BY c.relname, a.attnum`)).rows;
  const cons = (await db.query<ConstraintMeta & { table: string }>(`
    SELECT conrelid::regclass::text AS table, conname AS name, contype AS type, pg_get_constraintdef(oid) AS definition,
           ARRAY(SELECT attname FROM unnest(conkey) WITH ORDINALITY k(n, i) JOIN pg_attribute ON attrelid = conrelid AND attnum = k.n ORDER BY k.i) AS columns,
           CASE WHEN contype = 'f' THEN confrelid::regclass::text END AS "refTable",
           CASE WHEN contype = 'f' THEN ARRAY(SELECT attname FROM unnest(confkey) WITH ORDINALITY k(n, i) JOIN pg_attribute ON attrelid = confrelid AND attnum = k.n ORDER BY k.i) END AS "refColumns"
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype IN ('p','f','u','c')
    ORDER BY conrelid::regclass::text, contype, conname`)).rows;
  const idx = (await db.query<{ table: string; name: string; definition: string }>(`
    SELECT tablename AS table, indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2`)).rows;
  const comments = (await db.query<{ table: string; comment: string | null }>(`
    SELECT c.relname AS table, obj_description(c.oid, 'pg_class') AS comment FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`)).rows;
  return TABLE_ORDER.map((t) => ({
    name: t,
    comment: comments.find((c) => c.table === t)?.comment ?? null,
    columns: cols.filter((c) => c.table === t).map(({ table: _t, ...c }) => c),
    constraints: cons.filter((c) => c.table === t).map(({ table: _t, ...c }) => c),
    indexes: idx.filter((i) => i.table === t).map(({ table: _t, ...i }) => i),
    rowCount: {},
  }));
}

mkdirSync(outDir, { recursive: true });
const results: Awaited<ReturnType<typeof buildOne>>[] = [];
for (const d of DATASETS) {
  process.stdout.write(`Building ${d.name} … `);
  const r = await buildOne(d.name);
  results.push(r);
  const total = Object.values(r.rowCount).reduce((a, b) => a + b, 0);
  console.log(`${total} rows, ${(r.bytes / 1024 / 1024).toFixed(2)} MB gz, gen ${r.timings.genMs} ms, load ${r.timings.loadMs} ms, dump ${r.timings.dumpMs} ms`);
}

const failed = results.filter((r) => r.failures.length);
for (const r of failed) console.error(`\n✗ ${r.name}: ${r.failures.length} assertion(s) failed:\n  - ${r.failures.join('\n  - ')}`);

const [main] = results;
const manifest = {
  pgliteVersion,
  postgresVersion: main.pgVersion,
  referenceDate: REFERENCE_DATE,
  dataStart: DATA_START,
  loginTrackingStart: LOGIN_TRACKING_START,
  datasets: Object.fromEntries(results.map((r) => [r.name, {
    file: `${r.name}.tar.gz`, seed: r.seed, scale: r.scale, contentHash: r.contentHash, bytes: r.bytes,
    rowCount: r.rowCount, sequences: r.sequences,
  }])),
  tables: main.tables.map((t) => ({ ...t, rowCount: Object.fromEntries(results.map((r) => [r.name, r.rowCount[t.name]])) })),
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('\nRow counts (main / hidden):');
for (const t of TABLE_ORDER) console.log(`  ${t.padEnd(26)} ${String(results[0].rowCount[t]).padStart(6)} / ${String(results[1].rowCount[t]).padStart(6)}`);
console.log(`  ${'TOTAL'.padEnd(26)} ${String(Object.values(results[0].rowCount).reduce((a, b) => a + b)).padStart(6)} / ${String(Object.values(results[1].rowCount).reduce((a, b) => a + b)).padStart(6)}`);
console.log(`\n${ASSERTIONS.length} assertions × ${results.length} datasets: ${failed.length ? 'FAILED' : 'all passed'}`);
if (failed.length) process.exit(1);
