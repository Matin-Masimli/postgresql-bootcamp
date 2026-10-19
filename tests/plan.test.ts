// The query visualizer's model: clause detection, EXPLAIN parsing and the logical-order mapping,
// checked against real plans from the main snapshot.
import { beforeAll, describe, expect, it } from 'vitest';
import { buildExplain, detectClauses, logicalSteps, parseExplain, walk, type ExplainResult } from '../src/engine/plan.ts';
import { splitStatements } from '../src/engine/sqlScan.ts';
import type { PracticeSession } from '../src/engine/session.ts';
import { openSession } from './helpers/db.ts';

let s: PracticeSession;
beforeAll(async () => {
  s = await openSession('main');
});

async function explain(script: string): Promise<{ plan: ExplainResult; code: string }> {
  const req = buildExplain(script, { keepEarlier: true, analyze: true });
  if ('error' in req) throw new Error(req.error);
  const { output } = await s.runSandboxed(req.sql);
  if (output.error) throw new Error(output.error.message);
  const json = output.statements.at(-1)!.result!.rows[0][0]!;
  return { plan: parseExplain(json), code: req.last.code };
}

const stepRows = (steps: ReturnType<typeof logicalSteps>) => Object.fromEntries(steps.filter((x) => x.present).map((x) => [x.id, x.rows]));

describe('detectClauses', () => {
  it('only looks at the top level', () => {
    const [st] = splitStatements(`WITH t AS (SELECT a FROM x WHERE b GROUP BY a) SELECT DISTINCT a, sum(a) OVER () FROM t ORDER BY a LIMIT 3`);
    expect([...detectClauses(st.code)].sort()).toEqual(['DISTINCT', 'FROM', 'LIMIT', 'ORDER BY', 'SELECT', 'WINDOW', 'WITH']);
  });
  it('ignores keywords inside strings and comments', () => {
    const [st] = splitStatements(`SELECT 'GROUP BY' AS s -- ORDER BY x\nFROM t`);
    expect([...detectClauses(st.code)].sort()).toEqual(['FROM', 'SELECT']);
  });
});

describe('buildExplain', () => {
  it('wraps only the last statement and keeps set-up statements', () => {
    const r = buildExplain('CREATE TABLE t (x int);\nSELECT * FROM t', { keepEarlier: true, analyze: true });
    expect('error' in r).toBe(false);
    if (!('error' in r)) expect(r.sql).toBe('CREATE TABLE t (x int);EXPLAIN (ANALYZE, BUFFERS OFF, FORMAT JSON) \nSELECT * FROM t');
  });
  it('does not execute data changes in read-only mode', () => {
    const r = buildExplain('DELETE FROM orders', { keepEarlier: false, analyze: 'readOnly' });
    if ('error' in r) throw new Error(r.error);
    expect(r.analyze).toBe(false);
    expect(r.sql).toBe('EXPLAIN (FORMAT JSON) DELETE FROM orders');
  });
  it('refuses statements EXPLAIN cannot handle', () => {
    expect(buildExplain('CREATE VIEW v AS SELECT 1', { keepEarlier: true, analyze: true })).toHaveProperty('error');
    expect(buildExplain('  -- nothing\n', { keepEarlier: true, analyze: true })).toHaveProperty('error');
  });
});

describe('plans from the practice database', () => {
  it('maps a grouped, filtered, sorted, limited query onto the logical order', async () => {
    const { plan, code } = await explain(`SELECT customer_id, count(*) AS n
FROM orders
WHERE status <> 'cancelled'
GROUP BY customer_id
HAVING count(*) >= 5
ORDER BY n DESC, customer_id
LIMIT 3`);
    expect(plan.analyzed).toBe(true);
    expect(plan.executionMs).toBeGreaterThan(0);
    const rows = stepRows(logicalSteps(code, plan));
    const nonCancelled = Number((await s.query(`SELECT count(*) FROM orders WHERE status <> 'cancelled'`)).result!.rows[0][0]);
    const groups = Number((await s.query(`SELECT count(DISTINCT customer_id) FROM orders WHERE status <> 'cancelled'`)).result!.rows[0][0]);
    const kept = Number((await s.query(`SELECT count(*) FROM (SELECT 1 FROM orders WHERE status <> 'cancelled' GROUP BY customer_id HAVING count(*) >= 5) t`)).result!.rows[0][0]);
    expect(rows.WHERE).toBe(nonCancelled);
    expect(rows['GROUP BY']).toBe(groups);
    expect(rows.HAVING).toBe(kept);
    expect(rows['ORDER BY']).toBe(kept);
    expect(rows.LIMIT).toBe(3);
    expect(rows.SELECT).toBe(kept);
  });

  it('describes joins, scans and their conditions', async () => {
    const { plan } = await explain(`SELECT c.name, count(*) FROM orders o JOIN customers cu ON cu.customer_id = o.customer_id JOIN countries c ON c.country_id = cu.country_id GROUP BY c.name`);
    const nodes = walk(plan.root);
    expect(nodes.some((n) => n.kind === 'join')).toBe(true);
    const scans = nodes.filter((n) => n.kind === 'scan').map((n) => n.target);
    expect(scans).toEqual(expect.arrayContaining(['orders o', 'customers cu', 'countries c']));
    expect(nodes.flatMap((n) => n.details.map((d) => d.label))).toContain('joinOn');
    for (const n of nodes) {
      expect(n.description.key).toMatch(/^plan\.[a-zA-Z]+$/);
      expect(n.selfMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles window functions, CTEs and set-up statements', async () => {
    const { plan, code } = await explain(`CREATE TABLE t (x int);
INSERT INTO t SELECT generate_series(1, 10);
WITH c AS (SELECT x FROM t WHERE x > 2)
SELECT x, sum(x) OVER (ORDER BY x) FROM c`);
    const steps = logicalSteps(code, plan);
    expect(steps.find((x) => x.id === 'WINDOW')).toMatchObject({ present: true, rows: 8 });
    expect(steps.find((x) => x.id === 'WITH')?.present).toBe(true);
  });

  it('explains data changes without keeping them', async () => {
    const { plan } = await explain(`UPDATE products SET price = price * 1.1 WHERE category_id = 3`);
    expect(plan.root.kind).toBe('modify');
    const after = await s.query(`SELECT count(*) FROM products WHERE category_id = 3 AND price <> round(price, 2)`);
    expect(after.result!.rows[0][0]).toBe('0');
  });
});
