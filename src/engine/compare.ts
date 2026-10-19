// Result-set comparison: decides pass/fail and builds the diff shown to the learner.
import type { CheckConfig } from '../../content/types.ts';
import type { Feedback, Msg, ResultSet } from './types.ts';

type Row = (string | null)[];

/** PostgreSQL type oids compared numerically. */
const NUMERIC_TYPES = new Set([20, 21, 23, 26, 700, 701, 1700, 790]);
const BOOL = 16;
const TYPE_NAMES: Record<number, string> = {
  16: 'boolean', 20: 'bigint', 21: 'smallint', 23: 'integer', 25: 'text', 700: 'real', 701: 'double precision',
  1042: 'char', 1043: 'varchar', 1082: 'date', 1083: 'time', 1114: 'timestamp', 1184: 'timestamptz',
  1186: 'interval', 1700: 'numeric', 869: 'inet', 3802: 'jsonb', 114: 'json', 1009: 'text[]', 1007: 'integer[]',
};
export const typeName = (oid: number) => TYPE_NAMES[oid] ?? `type ${oid}`;

const MAX_LISTED = 5;
const DEFAULT_REL_TOL = 1e-9;

function isNumber(v: string): boolean {
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v.trim());
}

/** Canonical form of a cell for exact matching. */
function canon(v: string | null, numeric: boolean, bool: boolean): string {
  if (v === null) return '\u0000NULL';
  if (numeric && isNumber(v)) {
    const n = Number(v);
    return Object.is(n, -0) ? '0' : String(n);
  }
  if (bool) {
    const l = v.toLowerCase();
    if (l === 't' || l === 'true') return 't';
    if (l === 'f' || l === 'false') return 'f';
  }
  return v;
}

function cellsEqual(a: string | null, b: string | null, numeric: boolean, bool: boolean, tol?: number): boolean {
  if (a === null || b === null) return a === b;
  if (numeric && isNumber(a) && isNumber(b)) {
    const x = Number(a);
    const y = Number(b);
    if (x === y) return true;
    const limit = tol ?? DEFAULT_REL_TOL * Math.max(1, Math.abs(x), Math.abs(y));
    return Math.abs(x - y) <= limit + 1e-12;
  }
  return canon(a, numeric, bool) === canon(b, numeric, bool);
}

interface ColInfo { numeric: boolean; bool: boolean }

function columnInfo(expected: ResultSet, actual: ResultSet): ColInfo[] {
  return expected.columns.map((c, i) => {
    const a = actual.columns[i];
    return {
      numeric: NUMERIC_TYPES.has(c.dataTypeID) || (a !== undefined && NUMERIC_TYPES.has(a.dataTypeID)),
      bool: c.dataTypeID === BOOL || a?.dataTypeID === BOOL,
    };
  });
}

function rowsEqual(a: Row, b: Row, info: ColInfo[], tol?: number): boolean {
  return a.every((v, i) => cellsEqual(v, b[i], info[i].numeric, info[i].bool, tol));
}

const rowKey = (r: Row, info: ColInfo[]) => JSON.stringify(r.map((v, i) => canon(v, info[i].numeric, info[i].bool)));

export function compareResults(expected: ResultSet, actual: ResultSet, cfg: Pick<CheckConfig, 'orderMatters' | 'columnNamesMatter' | 'duplicatesMatter' | 'numericTolerance'>): Feedback {
  const expectedColumns = expected.columns.map((c) => c.name);
  const actualColumns = actual.columns.map((c) => c.name);
  const base = { expectedColumns, actualColumns, expectedRowCount: expected.rows.length, actualRowCount: actual.rows.length };

  // 1. Shape.
  if (expected.columns.length !== actual.columns.length) {
    return {
      ...base, pass: false, kind: 'columns',
      summary: `Expected ${expected.columns.length} column${expected.columns.length === 1 ? '' : 's'} (${expectedColumns.join(', ')}), but your query returned ${actual.columns.length} (${actualColumns.join(', ')}).`,
      msg: { key: 'fb.columnCount', params: { expected: expected.columns.length, expectedList: expectedColumns.join(', '), actual: actual.columns.length, actualList: actualColumns.join(', ') } },
    };
  }
  if (cfg.columnNamesMatter) {
    const wrong = expectedColumns.map((n, i) => [n, actualColumns[i]] as const).filter(([e, a]) => e.toLowerCase() !== a.toLowerCase());
    if (wrong.length) {
      return {
        ...base, pass: false, kind: 'columns',
        summary: `Column names don't match: ${wrong.map(([e, a]) => `expected "${e}" but got "${a}"`).join('; ')}. Use AS to name the columns.`,
        msg: { key: 'fb.columnNames', params: { pairs: wrong.map(([e, a]) => `"${a}" → "${e}"`).join(', ') } },
      };
    }
  }

  const info = columnInfo(expected, actual);
  const notes: string[] = [];
  const noteMsgs: Msg[] = [];
  // Hint at type differences that usually explain value mismatches (e.g. date vs timestamptz).
  const typeGroup = (oid: number) => (NUMERIC_TYPES.has(oid) ? 'number' : [19, 25, 1042, 1043].includes(oid) ? 'text' : String(oid));
  expected.columns.forEach((c, i) => {
    const a = actual.columns[i];
    if (typeGroup(c.dataTypeID) !== typeGroup(a.dataTypeID)) {
      notes.push(`Column ${i + 1} ("${expectedColumns[i]}") is ${typeName(c.dataTypeID)} in the reference but ${typeName(a.dataTypeID)} in yours.`);
      noteMsgs.push({ key: 'fb.typeNote', params: { n: i + 1, name: expectedColumns[i], expected: typeName(c.dataTypeID), actual: typeName(a.dataTypeID) } });
    }
  });

  // 2. Ordered comparison.
  if (cfg.orderMatters) {
    const n = Math.max(expected.rows.length, actual.rows.length);
    for (let i = 0; i < n; i++) {
      const e = expected.rows[i] ?? null;
      const a = actual.rows[i] ?? null;
      if (e && a && rowsEqual(e, a, info, cfg.numericTolerance)) continue;
      // Same multiset in a different order?
      const unordered = compareUnordered(expected.rows, actual.rows, info, cfg);
      if (unordered.missing.length === 0 && unordered.extra.length === 0) {
        return { ...base, pass: false, kind: 'order', notes, noteMsgs, summary: `All the right rows, but in the wrong order (first difference at row ${i + 1}). Check your ORDER BY, including tie-breakers.`, msg: { key: 'fb.order', params: { row: i + 1 } }, firstMismatch: mismatch(i, e, a, info, cfg.numericTolerance) };
      }
      return {
        ...base, pass: false, kind: expected.rows.length !== actual.rows.length ? 'rows' : 'values', notes, noteMsgs,
        summary: rowSummary(expected.rows.length, actual.rows.length, `Row ${i + 1} differs.`),
        msg: expected.rows.length !== actual.rows.length
          ? { key: 'fb.rowsCountRow', params: { expected: expected.rows.length, actual: actual.rows.length, row: i + 1 } }
          : { key: 'fb.rowsValuesRow', params: { expected: expected.rows.length, row: i + 1 } },
        firstMismatch: mismatch(i, e, a, info, cfg.numericTolerance),
        missing: unordered.missing.slice(0, MAX_LISTED), extra: unordered.extra.slice(0, MAX_LISTED),
      };
    }
    return { ...base, pass: true, summary: 'Correct!', msg: { key: 'fb.correct' } };
  }

  // 3. Unordered comparison.
  const { missing, extra, expectedN, actualN } = compareUnordered(expected.rows, actual.rows, info, cfg);
  if (missing.length === 0 && extra.length === 0) return { ...base, pass: true, summary: 'Correct!', msg: { key: 'fb.correct' }, expectedRowCount: expectedN, actualRowCount: actualN };
  return {
    ...base, pass: false, kind: expectedN !== actualN ? 'rows' : 'values', notes, noteMsgs,
    expectedRowCount: expectedN, actualRowCount: actualN,
    msg: expectedN !== actualN
      ? { key: 'fb.rowsCountSet', params: { expected: expectedN, actual: actualN, missing: missing.length, extra: extra.length } }
      : { key: 'fb.rowsValuesSet', params: { expected: expectedN, missing: missing.length, extra: extra.length } },
    summary: rowSummary(expectedN, actualN, `${missing.length} expected row${missing.length === 1 ? ' is' : 's are'} missing and ${extra.length} row${extra.length === 1 ? ' is' : 's are'} unexpected.`),
    missing: missing.slice(0, MAX_LISTED), extra: extra.slice(0, MAX_LISTED),
  };
}

function rowSummary(expectedN: number, actualN: number, detail: string): string {
  if (expectedN !== actualN) return `Expected ${expectedN} row${expectedN === 1 ? '' : 's'}, got ${actualN}. ${detail}`;
  return `Right number of rows (${expectedN}), but some values differ. ${detail}`;
}

function mismatch(index: number, e: Row | null, a: Row | null, info: ColInfo[], tol?: number) {
  const cells = e && a ? e.map((v, i) => (cellsEqual(v, a[i], info[i].numeric, info[i].bool, tol) ? -1 : i)).filter((i) => i >= 0) : [];
  return { index, expected: e, actual: a, cells };
}

/** Multiset (or set) difference with exact canonical matching first, then tolerant matching of leftovers. */
function compareUnordered(expectedRows: Row[], actualRows: Row[], info: ColInfo[], cfg: Pick<CheckConfig, 'duplicatesMatter' | 'numericTolerance'>) {
  const dedupe = (rows: Row[]) => {
    if (cfg.duplicatesMatter) return rows;
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = rowKey(r, info);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const exp = dedupe(expectedRows);
  const act = dedupe(actualRows);
  const pool = new Map<string, Row[]>();
  for (const r of act) {
    const k = rowKey(r, info);
    const list = pool.get(k);
    if (list) list.push(r);
    else pool.set(k, [r]);
  }
  let missing: Row[] = [];
  for (const r of exp) {
    const list = pool.get(rowKey(r, info));
    if (list && list.length) list.pop();
    else missing.push(r);
  }
  let extra = [...pool.values()].flat();
  // Tolerant pass over the (usually few) leftovers.
  if (missing.length && extra.length && missing.length * extra.length <= 4_000_000) {
    const stillMissing: Row[] = [];
    const used = new Set<number>();
    for (const m of missing) {
      const j = extra.findIndex((x, idx) => !used.has(idx) && rowsEqual(m, x, info, cfg.numericTolerance));
      if (j >= 0) used.add(j);
      else stillMissing.push(m);
    }
    missing = stillMissing;
    extra = extra.filter((_, idx) => !used.has(idx));
  }
  return { missing, extra, expectedN: exp.length, actualN: act.length };
}

/** Compare a literal table (predict-output options) with a real result. */
export function tableMatches(result: ResultSet, table: { columns: string[]; rows: (string | null)[][] }, orderMatters: boolean): boolean {
  const asResult: ResultSet = { columns: table.columns.map((name, i) => ({ name, dataTypeID: result.columns[i]?.dataTypeID ?? 25 })), rows: table.rows };
  return compareResults(result, asResult, { orderMatters, columnNamesMatter: true, duplicatesMatter: true }).pass;
}
