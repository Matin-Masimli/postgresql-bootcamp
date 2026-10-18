// Content-authoring helper: run SQL on the main and hidden datasets through the real engine.
//   npm run sql -- "SELECT ..."            (both datasets)
//   npm run sql -- --main "SELECT ..."     (main only)
//   npm run sql -- --file path/to/query.sql
import { readFileSync } from 'node:fs';
import { openSession } from '../tests/helpers/db.ts';
import type { Dataset } from '../src/engine/types.ts';

const args = process.argv.slice(2);
const only = args.includes('--main') ? ['main'] : args.includes('--hidden') ? ['hidden'] : ['main', 'hidden'];
const fileIdx = args.indexOf('--file');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 40;
const sql = fileIdx >= 0
  ? readFileSync(args[fileIdx + 1], 'utf8')
  : args.filter((a, i) => !a.startsWith('--') && (limitIdx < 0 || i !== limitIdx + 1)).join(' ');

for (const ds of only as Dataset[]) {
  const s = await openSession(ds);
  const { output } = await s.runSandboxed(sql, { keepFull: true });
  console.log(`\n=== ${ds} ===`);
  for (const st of output.statements) {
    if (!st.result) {
      console.log(`${st.command} ${st.rowCount}`);
      continue;
    }
    const { columns, rows } = st.result;
    const shown = rows.slice(0, limit).map((r) => r.map((v) => (v === null ? 'NULL' : v)));
    const widths = columns.map((c, i) => Math.min(40, Math.max(c.name.length, ...shown.map((r) => r[i].length))));
    const line = (cells: string[]) => cells.map((c, i) => c.slice(0, 40).padEnd(widths[i])).join(' | ');
    console.log(line(columns.map((c) => c.name)));
    console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
    for (const r of shown) console.log(line(r));
    console.log(`(${rows.length} row${rows.length === 1 ? '' : 's'}${rows.length > limit ? `, first ${limit} shown` : ''})`);
  }
  if (output.error) console.log(`ERROR: ${output.error.message}${output.error.hint ? `\nHINT: ${output.error.hint}` : ''}`);
  await s.pg.close();
}
