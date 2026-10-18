import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareResults, tableMatches } from '../src/engine/compare.ts';
import { ExpectedCache, grade } from '../src/engine/grade.ts';
import type { PracticeSession } from '../src/engine/session.ts';
import { findSandboxProblems, splitStatements } from '../src/engine/sqlScan.ts';
import type { ResultSet } from '../src/engine/types.ts';
import { openBoth } from './helpers/db.ts';

const INT = 23, NUM = 1700, TEXT = 25, BOOL = 16, DATE = 1082, TSTZ = 1184;
const rs = (cols: [string, number][], rows: (string | null)[][]): ResultSet => ({ columns: cols.map(([name, dataTypeID]) => ({ name, dataTypeID })), rows });
const loose = { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true };
const strict = { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true };

describe('splitStatements', () => {
  it('splits on semicolons outside quotes, comments and dollar quotes', () => {
    const sql = `SELECT ';' AS a; -- comment; still comment
      SELECT "we;ird" FROM t; /* block; /* nested; */ */ SELECT $$x;y$$, $tag$ a;b $tag$;
      SELECT E'it\\'s;';`;
    const s = splitStatements(sql);
    expect(s.map((x) => x.head.split(' ')[0])).toEqual(['SELECT', 'SELECT', 'SELECT', 'SELECT']);
    expect(s[0].text).toContain("';'");
    expect(s[2].text).toContain('$tag$ a;b $tag$');
    expect(s[3].text).toContain("E'it\\'s;'");
  });
  it('ignores empty and comment-only statements', () => {
    expect(splitStatements(' ; -- nothing\n ; /* x */ ')).toHaveLength(0);
    expect(splitStatements('SELECT 1;;')).toHaveLength(1);
  });
  it('keeps exact offsets so error positions map back', () => {
    const sql = 'SELECT 1;\n  SELECT nope';
    const s = splitStatements(sql);
    expect(sql.slice(s[1].start)).toBe('\n  SELECT nope');
  });
});

describe('findSandboxProblems', () => {
  const problems = (sql: string) => findSandboxProblems(splitStatements(sql)).map((p) => p.statementIndex);
  it('rejects transaction control and non-transactional statements', () => {
    expect(problems('BEGIN; UPDATE t SET x = 1; COMMIT;')).toEqual([0, 2]);
    expect(problems('start transaction; rollback')).toEqual([0, 1]);
    expect(problems('VACUUM orders')).toEqual([0]);
    expect(problems('CREATE INDEX CONCURRENTLY i ON t (x)')).toEqual([0]);
  });
  it('allows savepoints, DO blocks and normal statements', () => {
    expect(problems('SAVEPOINT a; UPDATE t SET x = 1; ROLLBACK TO SAVEPOINT a; RELEASE a')).toEqual([]);
    expect(problems('DO $$ BEGIN PERFORM 1; END $$')).toEqual([]);
    expect(problems('/* begin */ SELECT 1 -- commit')).toEqual([]);
  });
});

describe('compareResults', () => {
  const exp = rs([['id', INT], ['total', NUM]], [['1', '10.50'], ['2', '7.00'], ['3', null]]);

  it('passes identical results and treats 10.5 = 10.50', () => {
    const act = rs([['id', INT], ['total', NUM]], [['1', '10.5'], ['2', '7'], ['3', null]]);
    expect(compareResults(exp, act, strict).pass).toBe(true);
  });
  it('detects a wrong column count', () => {
    const f = compareResults(exp, rs([['id', INT]], [['1'], ['2'], ['3']]), loose);
    expect(f.pass).toBe(false);
    expect(f.kind).toBe('columns');
  });
  it('checks column names only when configured', () => {
    const act = rs([['id', INT], ['sum', NUM]], exp.rows);
    expect(compareResults(exp, act, loose).pass).toBe(true);
    const f = compareResults(exp, act, strict);
    expect(f.pass).toBe(false);
    expect(f.summary).toContain('"total"');
  });
  it('reports wrong order separately from wrong rows', () => {
    const act = rs(exp.columns.map((c) => [c.name, c.dataTypeID]), [exp.rows[1], exp.rows[0], exp.rows[2]]);
    expect(compareResults(exp, act, loose).pass).toBe(true);
    const f = compareResults(exp, act, strict);
    expect(f.kind).toBe('order');
    expect(f.firstMismatch?.index).toBe(0);
  });
  it('lists missing and extra rows', () => {
    const act = rs(exp.columns.map((c) => [c.name, c.dataTypeID]), [['1', '10.50'], ['2', '7.00'], ['4', '1.00']]);
    const f = compareResults(exp, act, loose);
    expect(f.pass).toBe(false);
    expect(f.missing).toEqual([['3', null]]);
    expect(f.extra).toEqual([['4', '1.00']]);
  });
  it('distinguishes NULL from empty string and from the text "NULL"', () => {
    const a = rs([['x', TEXT]], [[null]]);
    expect(compareResults(a, rs([['x', TEXT]], [['']]), loose).pass).toBe(false);
    expect(compareResults(a, rs([['x', TEXT]], [['NULL']]), loose).pass).toBe(false);
  });
  it('respects duplicatesMatter', () => {
    const e = rs([['x', INT]], [['1'], ['1'], ['2']]);
    const a = rs([['x', INT]], [['1'], ['2']]);
    expect(compareResults(e, a, loose).pass).toBe(false);
    expect(compareResults(e, a, { ...loose, duplicatesMatter: false }).pass).toBe(true);
  });
  it('applies numeric tolerance only when configured', () => {
    const e = rs([['avg', NUM]], [['3.3333']]);
    const a = rs([['avg', NUM]], [['3.33']]);
    expect(compareResults(e, a, loose).pass).toBe(false);
    expect(compareResults(e, a, { ...loose, numericTolerance: 0.01 }).pass).toBe(true);
  });
  it('compares numbers numerically across integer/numeric types, not text', () => {
    expect(compareResults(rs([['n', INT]], [['5']]), rs([['n', NUM]], [['5.00']]), loose).pass).toBe(true);
    expect(compareResults(rs([['n', TEXT]], [['5']]), rs([['n', TEXT]], [['5.00']]), loose).pass).toBe(false);
  });
  it('explains type mismatches such as date vs timestamptz', () => {
    const f = compareResults(rs([['d', DATE]], [['2024-02-29']]), rs([['d', TSTZ]], [['2024-02-29 00:00:00+00']]), loose);
    expect(f.pass).toBe(false);
    expect(f.notes?.[0]).toMatch(/date.*timestamptz/);
  });
  it('matches literal option tables for predict-output (true/false vs t/f)', () => {
    const r = rs([['a', BOOL], ['b', INT]], [['t', null]]);
    expect(tableMatches(r, { columns: ['a', 'b'], rows: [['true', null]] }, true)).toBe(true);
    expect(tableMatches(r, { columns: ['a', 'b'], rows: [['false', null]] }, true)).toBe(false);
    expect(tableMatches(r, { columns: ['a', 'b'], rows: [['true', '0']] }, true)).toBe(false);
  });
});

describe('PracticeSession + grade (real snapshots)', () => {
  let s: Record<'main' | 'hidden', PracticeSession>;
  beforeAll(async () => {
    s = await openBoth();
  });
  afterAll(async () => {
    await Promise.all([s.main.pg.close(), s.hidden.pg.close()]);
  });

  it('rolls back every sandboxed run', async () => {
    const before = (await s.main.query('SELECT count(*) FROM orders')).result!.rows[0][0];
    const r = await s.main.runSandboxed(`DELETE FROM payments; DELETE FROM shipments; UPDATE orders SET status = 'cancelled'; SELECT count(*) FROM orders WHERE status = 'cancelled'`);
    expect(r.output.error).toBeUndefined();
    expect(r.output.statements[3].result!.rows[0][0]).toBe(before);
    expect((await s.main.query(`SELECT count(*) FROM payments`)).result!.rows[0][0]).not.toBe('0');
  });

  it('resets identity sequences so inserts get the same id every run', async () => {
    const sql = `INSERT INTO departments VALUES (99, 'Test', NULL, NULL); INSERT INTO customers (first_name, last_name, signup_at) VALUES ('A', 'B', '2025-06-30') RETURNING customer_id`;
    const a = await s.main.runSandboxed(sql);
    const b = await s.main.runSandboxed(sql);
    expect(a.output.statements[1].result!.rows[0][0]).toBe('2001');
    expect(b.output.statements[1].result!.rows[0][0]).toBe('2001');
  });

  it('maps error positions to the whole submission and stops at the first error', async () => {
    const sql = 'SELECT 1;\nSELECT nope FROM orders;\nSELECT 2';
    const r = await s.main.runSandboxed(sql);
    expect(r.output.statements).toHaveLength(1);
    expect(r.output.error?.statementIndex).toBe(1);
    expect(sql.slice(r.output.error!.offset!).startsWith('nope')).toBe(true);
    expect(r.output.error?.code).toBe('42703');
  });

  it('rejects transaction control before touching the database', async () => {
    const r = await s.main.runSandboxed('BEGIN; DELETE FROM orders; COMMIT;');
    expect(r.output.error?.message).toMatch(/automatically wrapped in a transaction/);
    expect((await s.main.query('SELECT count(*) > 0 FROM orders')).result!.rows[0][0]).toBe('t');
  });

  it('returns canonical text values', async () => {
    const r = await s.main.query(`SELECT 1.50::numeric(4,2), true, DATE '2024-02-29', TIMESTAMPTZ '2024-02-29 23:30:00+00', NULL::text, ARRAY[1,2]`);
    expect(r.result!.rows[0]).toEqual(['1.50', 't', '2024-02-29', '2024-02-29 23:30:00+00', null, '{1,2}']);
  });

  it('grades on main and hidden, hiding hidden rows', async () => {
    const q = { id: 'test', referenceSolution: 'SELECT customer_id FROM customers WHERE customer_id <= 3', checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true } };
    const cache = new ExpectedCache();
    expect((await grade(s, q, 'SELECT customer_id FROM customers WHERE customer_id < 4', cache)).feedback.pass).toBe(true);
    const wrong = await grade(s, q, 'SELECT customer_id FROM customers WHERE customer_id <= 2', cache);
    expect(wrong.feedback.pass).toBe(false);
    expect(wrong.feedback.dataset).toBe('main');
    expect(wrong.feedback.missing).toEqual([['3']]);
  });

  it('fails answers that only work on the visible data', async () => {
    // Hard-coding the main answer: the max order id on main is not the max on hidden.
    const maxMain = (await s.main.query('SELECT max(order_id) FROM orders')).result!.rows[0][0];
    const q = { id: 'test-max', referenceSolution: 'SELECT max(order_id) AS m FROM orders', checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true } };
    const f = (await grade(s, q, `SELECT ${maxMain} AS m`, new ExpectedCache())).feedback;
    expect(f.pass).toBe(false);
    expect(f.kind).toBe('hidden');
    expect(JSON.stringify(f)).not.toContain('missing');
  });

  it('caps huge results instead of comparing them', async () => {
    const q = { id: 'test-big', referenceSolution: 'SELECT 1', checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true } };
    const f = (await grade(s, q, 'SELECT * FROM order_items a CROSS JOIN countries b CROSS JOIN departments c', new ExpectedCache())).feedback;
    expect(f.kind).toBe('too-many-rows');
  });
});
