/// <reference lib="webworker" />
// PGlite runs here, off the main thread. The main thread can terminate() this worker at any time
// (PGlite ignores statement_timeout, see docs/engine-notes.md), so all state is rebuildable from snapshots.
import { PGlite } from '@electric-sql/pglite';
import type { DbName, Envelope, Reply, Request, ResponseBody } from './protocol.ts';

const dbs = new Map<DbName, PGlite>();
/** Identity parsers for every type oid: results come back as PostgreSQL's canonical text output. */
const textParsers = new Map<DbName, Record<number, (v: string) => string>>();

async function load(db: DbName, url: string): Promise<ResponseBody> {
  const t0 = performance.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${url}: HTTP ${res.status}`);
  const blob = await res.blob();
  const t1 = performance.now();
  await dbs.get(db)?.close();
  const pg = await PGlite.create({ loadDataDir: blob });
  const t2 = performance.now();
  const oids = await pg.query<{ oid: number }>('SELECT oid::int AS oid FROM pg_type');
  textParsers.set(db, Object.fromEntries(oids.rows.map((r) => [r.oid, (v: string) => v])));
  const v = await pg.query<{ v: string }>(`SELECT current_setting('server_version') AS v`);
  const t3 = performance.now();
  dbs.set(db, pg);
  return {
    type: 'load',
    serverVersion: v.rows[0].v,
    timings: { fetchMs: t1 - t0, bootMs: t2 - t1, firstQueryMs: t3 - t2, bytes: blob.size },
  };
}

async function query(db: DbName, sql: string): Promise<ResponseBody> {
  const pg = dbs.get(db);
  if (!pg) throw new Error(`Database "${db}" is not loaded`);
  const r = await pg.query<(string | null)[]>(sql, [], { rowMode: 'array', parsers: textParsers.get(db) });
  return { type: 'query', columns: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })), rows: r.rows };
}

self.onmessage = async (e: MessageEvent<Envelope<Request>>) => {
  const { id, ...req } = e.data;
  let reply: Reply;
  try {
    const body = req.type === 'load' ? await load(req.db, req.url) : await query(req.db, req.sql);
    reply = { id, ok: true, body };
  } catch (err) {
    const x = err as { message?: string; code?: string; position?: string };
    reply = { id, ok: false, error: { message: x.message ?? String(err), code: x.code, position: x.position ? Number(x.position) : undefined } };
  }
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(reply);
};
