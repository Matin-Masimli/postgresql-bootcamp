// Measures how long it takes to boot PGlite from the prebuilt snapshots (Node).
//   npm run bench:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNS = 5;
const dir = join(import.meta.dirname, '..', '..', 'public', 'db');
const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

for (const name of ['main', 'hidden']) {
  const bytes = readFileSync(join(dir, `${name}.tar.gz`));
  const boot: number[] = [];
  const firstQuery: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const db = await PGlite.create({ loadDataDir: new Blob([bytes]) });
    const t1 = performance.now();
    await db.query(`SELECT count(*) FROM order_items oi JOIN orders o USING (order_id) WHERE o.status = 'delivered'`);
    const t2 = performance.now();
    boot.push(t1 - t0);
    firstQuery.push(t2 - t1);
    await db.close();
  }
  console.log(`${name.padEnd(7)} ${(bytes.length / 1024 / 1024).toFixed(2)} MB gz | boot median ${median(boot).toFixed(0)} ms (min ${Math.min(...boot).toFixed(0)}, max ${Math.max(...boot).toFixed(0)}) | first join query ${median(firstQuery).toFixed(0)} ms`);
}
