// Query visualizer model: turns EXPLAIN (FORMAT JSON) output into an annotated plan tree, and maps the
// statement's top-level clauses onto SQL's logical evaluation order with row counts taken from the plan.
import { isCursorable, splitStatements, type Statement } from './sqlScan.ts';
import type { Msg } from './types.ts';

// ───────────────────────── plan tree ─────────────────────────

export type NodeKind = 'scan' | 'join' | 'aggregate' | 'sort' | 'modify' | 'other';

/** `label` is a message key (plan.detail.*); `value` is PostgreSQL's own text (SQL), never translated. */
export interface PlanDetail { label: string; value: string }

export interface PlanNode {
  type: string;
  kind: NodeKind;
  /** e.g. "orders o", "index orders_pkey", "CTE monthly". */
  target?: string;
  /** What this step does, as a translatable message. */
  description: Msg;
  /** How the node relates to its parent when it isn't an ordinary input (InitPlan, SubPlan…). */
  role?: string;
  /** Rows produced in total (actual rows × loops when analyzed, else the estimate). */
  rows: number;
  estimatedRows: number;
  loops: number;
  /** Time spent in this node itself, excluding its children (ms, analyzed plans only). */
  selfMs?: number;
  /** Time including children (ms, analyzed plans only). */
  totalMs?: number;
  /** Rows a filter or join filter threw away (× loops). */
  rowsRemoved?: number;
  details: PlanDetail[];
  children: PlanNode[];
}

export interface ExplainResult {
  root: PlanNode;
  analyzed: boolean;
  planningMs?: number;
  executionMs?: number;
}

type RawNode = Record<string, unknown> & { Plans?: RawNode[] };

const SCANS = /Scan$/;
const JOINS = /^(Hash Join|Merge Join|Nested Loop|Hash)$/;
const AGGREGATES = /^(Aggregate|WindowAgg|Group|Unique|SetOp|HashSetOp|Recursive Union|Append|Merge Append)$/;
const SORTS = /^(Sort|Incremental Sort|Limit)$/;

function kindOf(type: string): NodeKind {
  if (type === 'ModifyTable') return 'modify';
  if (SCANS.test(type)) return 'scan';
  if (JOINS.test(type)) return 'join';
  if (AGGREGATES.test(type)) return 'aggregate';
  if (SORTS.test(type)) return 'sort';
  return 'other';
}

const str = (v: unknown) => (v === undefined || v === null ? undefined : Array.isArray(v) ? v.join(', ') : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
/** Strips the outer parentheses PostgreSQL puts around conditions: "((a = b))" → "a = b". */
const cond = (v: unknown) => {
  let s = str(v);
  if (!s) return s;
  while (s.startsWith('(') && s.endsWith(')') && balanced(s.slice(1, -1))) s = s.slice(1, -1);
  return s;
};
function balanced(s: string) {
  let d = 0;
  for (const ch of s) {
    if (ch === '(') d++;
    else if (ch === ')' && --d < 0) return false;
  }
  return d === 0;
}

function describe(n: RawNode): { description: Msg; target?: string } {
  const type = String(n['Node Type']);
  const rel = str(n['Relation Name']) ?? '';
  const alias = str(n['Alias']);
  const table = rel ? (alias && alias !== rel ? `${rel} ${alias}` : rel) : undefined;
  const index = str(n['Index Name']) ?? '';
  const cte = str(n['CTE Name']) ?? '';
  const fn = str(n['Function Name']) ?? '';
  const join = str(n['Join Type']) ?? 'Inner';
  const m = (key: string, params?: Msg['params']): Msg => ({ key: `plan.${key}`, params });
  switch (type) {
    case 'Seq Scan': return { target: table, description: m('seqScan', { rel }) };
    case 'Index Scan': return { target: table, description: m('indexScan', { rel, index }) };
    case 'Index Only Scan': return { target: table, description: m('indexOnlyScan', { index }) };
    case 'Bitmap Index Scan': return { target: index, description: m('bitmapIndexScan', { index }) };
    case 'Bitmap Heap Scan': return { target: table, description: m('bitmapHeapScan', { rel }) };
    case 'CTE Scan': return { target: `CTE ${cte}`, description: m('cteScan', { cte }) };
    case 'WorkTable Scan': return { target: cte, description: m('workTableScan') };
    case 'Subquery Scan': return { target: alias, description: m('subqueryScan') };
    case 'Function Scan': return { target: fn, description: m('functionScan', { fn }) };
    case 'Values Scan': return { description: m('valuesScan') };
    case 'Hash Join': return { description: m('hashJoin', { join }) };
    case 'Merge Join': return { description: m('mergeJoin', { join }) };
    case 'Nested Loop': return { description: m('nestedLoop', { join }) };
    case 'Hash': return { description: m('hash') };
    case 'Aggregate': {
      const st = str(n['Strategy']);
      return { description: m(st === 'Plain' ? 'aggPlain' : st === 'Hashed' ? 'aggHashed' : st === 'Sorted' ? 'aggSorted' : 'aggMixed') };
    }
    case 'WindowAgg': return { description: m('windowAgg') };
    case 'Group': return { description: m('group') };
    case 'Unique': return { description: m('unique') };
    case 'Sort': return { description: m('sort', { key: str(n['Sort Key']) ?? '' }) };
    case 'Incremental Sort': return { description: m('incrementalSort', { key: str(n['Sort Key']) ?? '' }) };
    case 'Limit': return { description: m('limit') };
    case 'Append': return { description: m('append') };
    case 'Merge Append': return { description: m('mergeAppend') };
    case 'SetOp': case 'HashSetOp': return { description: m('setOp', { op: str(n['Command'])?.toUpperCase() ?? 'SET OPERATION' }) };
    case 'Recursive Union': return { description: m('recursiveUnion') };
    case 'Result': return { description: m('result') };
    case 'ProjectSet': return { description: m('projectSet') };
    case 'Materialize': return { description: m('materialize') };
    case 'Memoize': return { description: m('memoize') };
    case 'ModifyTable': return { target: table, description: m('modifyTable', { op: str(n['Operation']) ?? 'Write', rel }) };
    case 'LockRows': return { description: m('lockRows') };
    default: return { target: table, description: m('other', { type }) };
  }
}

const DETAIL_KEYS: [key: string, label: string, fmt?: (v: unknown) => string | undefined][] = [
  ['Hash Cond', 'joinOn', cond],
  ['Merge Cond', 'joinOn', cond],
  ['Join Filter', 'joinFilter', cond],
  ['Index Cond', 'indexCond', cond],
  ['Recheck Cond', 'recheck', cond],
  ['Filter', 'filter', cond],
  ['Group Key', 'groupBy', str],
  ['Sort Key', 'sortBy', str],
  ['Presorted Key', 'presorted', str],
  ['Sort Method', 'sortMethod', str],
];

function convert(n: RawNode, analyzed: boolean): PlanNode {
  const type = String(n['Node Type']);
  const loops = num(n['Actual Loops']) ?? 1;
  const actual = num(n['Actual Rows']);
  const estimated = num(n['Plan Rows']) ?? 0;
  const rows = analyzed && actual !== undefined ? Math.round(actual * loops) : estimated;
  const removed = (num(n['Rows Removed by Filter']) ?? 0) + (num(n['Rows Removed by Join Filter']) ?? 0);
  const children = (n.Plans ?? []).map((c) => convert(c, analyzed));
  const totalMs = analyzed ? (num(n['Actual Total Time']) ?? 0) * loops : undefined;
  const childMs = children.reduce((s, c) => s + (c.role === 'InitPlan' ? 0 : c.totalMs ?? 0), 0);
  const details: PlanDetail[] = [];
  for (const [key, label, fmt] of DETAIL_KEYS) {
    const v = fmt ? fmt(n[key]) : str(n[key]);
    if (v) details.push({ label, value: v });
  }
  if (type === 'Sort' && n['Sort Space Used'] !== undefined) {
    details.push({ label: 'memory', value: `${n['Sort Space Used']} kB (${str(n['Sort Space Type'])?.toLowerCase()})` });
  }
  const rel = str(n['Parent Relationship']);
  const sub = str(n['Subplan Name']);
  const { description, target } = describe(n);
  return {
    type,
    kind: kindOf(type),
    target,
    description,
    role: sub ?? (rel === 'InitPlan' || rel === 'SubPlan' ? rel : undefined),
    rows,
    estimatedRows: Math.round(estimated * (analyzed ? loops : 1)),
    loops,
    totalMs,
    selfMs: totalMs !== undefined ? Math.max(0, totalMs - childMs) : undefined,
    rowsRemoved: removed ? Math.round(removed * loops) : undefined,
    details,
    children,
  };
}

/** Parses the single text value returned by EXPLAIN (FORMAT JSON). */
export function parseExplain(json: string): ExplainResult {
  const parsed = JSON.parse(json) as { Plan: RawNode; 'Planning Time'?: number; 'Execution Time'?: number }[];
  const top = parsed[0];
  const analyzed = top.Plan['Actual Loops'] !== undefined;
  return {
    root: convert(top.Plan, analyzed),
    analyzed,
    planningMs: top['Planning Time'],
    executionMs: top['Execution Time'],
  };
}

/** Every node of the tree, depth-first. */
export function walk(n: PlanNode): PlanNode[] {
  return [n, ...n.children.flatMap(walk)];
}

// ───────────────────────── logical order ─────────────────────────

export type ClauseId = 'WITH' | 'FROM' | 'WHERE' | 'GROUP BY' | 'HAVING' | 'WINDOW' | 'SELECT' | 'DISTINCT' | 'SET OP' | 'ORDER BY' | 'LIMIT';

export interface LogicalStep {
  id: ClauseId;
  /** SQL keywords, shown as-is in every language. */
  label: string;
  present: boolean;
  /** Rows coming out of this step, when the plan tells us. */
  rows?: number;
  /** Extra fact, e.g. "filters removed 1 204 rows". */
  note?: Msg;
}

const STEPS: { id: ClauseId; label: string }[] = [
  { id: 'WITH', label: 'WITH' },
  { id: 'FROM', label: 'FROM / JOIN' },
  { id: 'WHERE', label: 'WHERE' },
  { id: 'GROUP BY', label: 'GROUP BY' },
  { id: 'HAVING', label: 'HAVING' },
  { id: 'WINDOW', label: 'OVER (…)' },
  { id: 'SELECT', label: 'SELECT' },
  { id: 'DISTINCT', label: 'DISTINCT' },
  { id: 'SET OP', label: 'UNION / INTERSECT / EXCEPT' },
  { id: 'ORDER BY', label: 'ORDER BY' },
  { id: 'LIMIT', label: 'LIMIT / OFFSET' },
];

/** The words that appear outside any parentheses in an (upper-cased, comment- and string-free) statement. */
function topLevelWords(code: string): string[] {
  let depth = 0;
  let flat = '';
  for (const ch of code) {
    if (ch === '(') {
      depth++;
      flat += ' ';
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
      flat += ' ';
    } else flat += depth === 0 ? ch : ' ';
  }
  return flat.split(/[^A-Z0-9_]+/).filter(Boolean);
}

/** Which clauses the statement uses at its top level (subqueries and CTE bodies are not inspected). */
export function detectClauses(code: string): Set<ClauseId> {
  const w = topLevelWords(code);
  const has = (a: string, b?: string) => w.some((x, i) => x === a && (b === undefined || w[i + 1] === b));
  const found = new Set<ClauseId>();
  if (w[0] === 'WITH') found.add('WITH');
  if (has('FROM')) found.add('FROM');
  if (has('WHERE')) found.add('WHERE');
  if (has('GROUP', 'BY')) found.add('GROUP BY');
  if (has('HAVING')) found.add('HAVING');
  if (has('OVER') || has('WINDOW')) found.add('WINDOW');
  if (has('SELECT')) found.add('SELECT');
  if (has('DISTINCT')) found.add('DISTINCT');
  if (has('UNION') || has('INTERSECT') || has('EXCEPT')) found.add('SET OP');
  if (has('ORDER', 'BY')) found.add('ORDER BY');
  if (has('LIMIT') || has('OFFSET') || has('FETCH')) found.add('LIMIT');
  return found;
}

const SPINE = new Set(['Limit', 'Sort', 'Incremental Sort', 'Unique', 'Aggregate', 'Group', 'WindowAgg', 'Result', 'ProjectSet', 'LockRows']);

/** Lays the statement's clauses on SQL's logical order and attaches row counts read off the plan's top spine. */
export function logicalSteps(code: string, plan?: ExplainResult): LogicalStep[] {
  const clauses = detectClauses(code);
  const steps: LogicalStep[] = STEPS.map((s) => ({ ...s, present: clauses.has(s.id) }));
  const step = (id: ClauseId) => steps.find((s) => s.id === id)!;
  if (!plan || clauses.has('SET OP')) return steps;

  // Walk down the single-input nodes at the top of the plan; the first other node produces the FROM/WHERE rows.
  let node: PlanNode | undefined = plan.root;
  let seenGrouping = false;
  while (node) {
    const inputs: PlanNode[] = node.children.filter((c) => c.role === undefined);
    if (node.type === 'Limit' && clauses.has('LIMIT')) step('LIMIT').rows ??= node.rows;
    else if ((node.type === 'Sort' || node.type === 'Incremental Sort') && !seenGrouping && clauses.has('ORDER BY')) {
      // Under a LIMIT a top-N sort only emits the rows asked for, so report how many rows it sorted.
      step('ORDER BY').rows ??= inputs[0]?.rows ?? node.rows;
    }
    else if (node.type === 'WindowAgg') {
      step('WINDOW').rows ??= node.rows;
      seenGrouping = true;
    } else if (node.type === 'Unique' || ((node.type === 'Aggregate' || node.type === 'Group') && !clauses.has('GROUP BY') && clauses.has('DISTINCT'))) {
      step('DISTINCT').rows ??= node.rows;
      seenGrouping = true;
    } else if (node.type === 'Aggregate' || node.type === 'Group') {
      seenGrouping = true;
      const g = step('GROUP BY');
      if (clauses.has('HAVING')) {
        step('HAVING').rows ??= node.rows;
        if (node.rowsRemoved) step('HAVING').note = { key: 'plan.note.groupsRemoved', params: { n: node.rowsRemoved } };
        g.rows ??= node.rows + (node.rowsRemoved ?? 0);
      } else {
        g.rows ??= node.rows;
      }
      if (!clauses.has('GROUP BY')) g.note = { key: 'plan.note.oneGroup' };
    }
    if (!SPINE.has(node.type) || inputs.length !== 1) break;
    node = inputs[0];
  }
  if (node && !SPINE.has(node.type)) {
    const target = clauses.has('WHERE') ? step('WHERE') : step('FROM');
    target.rows = node.rows;
    if (clauses.has('WHERE')) {
      const removed = walk(node).reduce((s, n) => s + (n.rowsRemoved ?? 0), 0);
      if (removed) target.note = { key: 'plan.note.rowsRemoved', params: { n: removed } };
      if (clauses.has('FROM')) step('FROM').note = { key: 'plan.note.countedAfterWhere' };
    }
  }
  const out = steps.find((s) => s.id === 'SELECT')!;
  out.rows = [step('WINDOW'), step('HAVING'), step('GROUP BY'), step('WHERE'), step('FROM')].find((s) => s.present && s.rows !== undefined)?.rows;
  return steps;
}

// ───────────────────────── building the EXPLAIN statement ─────────────────────────

const EXPLAINABLE = new Set(['SELECT', 'WITH', 'VALUES', 'TABLE', 'INSERT', 'UPDATE', 'DELETE', 'MERGE']);

export interface ExplainRequest {
  /** SQL to send: earlier statements unchanged, the last one wrapped in EXPLAIN. */
  sql: string;
  last: Statement;
  analyze: boolean;
}

/**
 * Wraps the last statement of a script in EXPLAIN. With `keepEarlier` the statements before it are kept,
 * so set-up statements (CREATE TABLE, INSERT…) run first in the same sandbox. `analyze: 'readOnly'` only
 * executes the statement when it can't change data (used where changes would persist, like the Playground).
 */
export function buildExplain(script: string, opts: { keepEarlier: boolean; analyze: true | 'readOnly' }): ExplainRequest | { error: string; msg: Msg } {
  const statements = splitStatements(script);
  const last = statements.at(-1);
  if (!last) return { error: 'There is no SQL to visualize yet.', msg: { key: 'viz.empty' } };
  const first = last.head.split(' ')[0];
  if (!EXPLAINABLE.has(first)) {
    const stmt = last.head.split(' ').slice(0, 2).join(' ');
    return { error: `The visualizer explains queries (SELECT, WITH, INSERT, UPDATE, DELETE). The last statement here is ${stmt || 'not a query'}.`, msg: { key: 'viz.notQuery', params: { stmt: stmt || '?' } } };
  }
  const analyze = opts.analyze === true || isCursorable(last);
  const explain = `EXPLAIN (${analyze ? 'ANALYZE, BUFFERS OFF, ' : ''}FORMAT JSON) `;
  const sql = opts.keepEarlier ? script.slice(0, last.start) + explain + script.slice(last.start) : explain + last.text;
  return { sql, last, analyze };
}
