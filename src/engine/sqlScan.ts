// Splits a submission into statements (respecting quotes, dollar quotes and nested comments)
// and rejects statements that would break the sandbox transaction.
import type { Msg } from './types.ts';

type SegmentKind = 'code' | 'comment' | 'string' | 'separator';

/** Lexes SQL into code / comment / quoted-string segments and statement separators. */
function* segments(sql: string): Generator<{ kind: SegmentKind; from: number; to: number }> {
  const n = sql.length;
  let i = 0;
  let codeStart = 0;
  const flush = function* (to: number) {
    if (to > codeStart) yield { kind: 'code' as const, from: codeStart, to };
  };
  while (i < n) {
    const c = sql[i];
    const next = sql[i + 1];
    let end = -1;
    let kind: SegmentKind = 'comment';
    if (c === '-' && next === '-') {
      end = sql.indexOf('\n', i);
      end = end < 0 ? n : end;
    } else if (c === '/' && next === '*') {
      let depth = 1;
      end = i + 2;
      while (end < n && depth > 0) {
        if (sql[end] === '/' && sql[end + 1] === '*') { depth++; end += 2; }
        else if (sql[end] === '*' && sql[end + 1] === '/') { depth--; end += 2; }
        else end++;
      }
    } else if (c === ';') {
      kind = 'separator';
      end = i + 1;
    } else if (c === "'" || c === '"') {
      kind = 'string';
      const escapes = c === "'" && i > 0 && /[eE]/.test(sql[i - 1]) && (i < 2 || !/\w/.test(sql[i - 2]));
      end = i + 1;
      while (end < n) {
        if (escapes && sql[end] === '\\') { end += 2; continue; }
        if (sql[end] === c) {
          if (sql[end + 1] === c) { end += 2; continue; }
          break;
        }
        end++;
      }
      end = Math.min(n, end + 1);
    } else if (c === '$' && (i === 0 || !/[\w$]/.test(sql[i - 1]))) {
      const m = /^\$([A-Za-z_][A-Za-z_0-9]*)?\$/.exec(sql.slice(i, i + 64));
      if (m) {
        kind = 'string';
        const close = sql.indexOf(m[0], i + m[0].length);
        end = close < 0 ? n : close + m[0].length;
      }
    }
    if (end < 0) {
      i++;
      continue;
    }
    yield* flush(i);
    yield { kind, from: i, to: end };
    i = end;
    codeStart = end;
  }
  yield* flush(n);
}

/** SQL with comments removed and quoted contents blanked ('' / ""), for keyword checks. */
export function codeOnly(sql: string): string {
  let out = '';
  for (const s of segments(sql)) {
    if (s.kind === 'code' || s.kind === 'separator') out += sql.slice(s.from, s.to);
    else if (s.kind === 'string') out += sql[s.from] === '"' ? ' "" ' : " '' ";
    else out += ' ';
  }
  return out;
}

export interface Statement {
  /** Exact source slice sent to PostgreSQL (so error positions map back by adding `start`). */
  text: string;
  start: number;
  /** Leading keywords, upper-cased, comments stripped (e.g. "CREATE INDEX CONCURRENTLY"). */
  head: string;
  /** The statement with comments and string contents removed (upper-cased). */
  code: string;
}

export function splitStatements(sql: string): Statement[] {
  const out: Statement[] = [];
  let start = 0;
  let hasCode = false;
  const push = (end: number) => {
    if (hasCode) {
      const text = sql.slice(start, end);
      const code = codeOnly(text).toUpperCase();
      // Leading parentheses belong to a parenthesised query, e.g. "(SELECT …) UNION ALL (SELECT …)".
      const head = code.trim().replace(/^[(\s]+/, '').split(/\s+/).slice(0, 4).join(' ').replace(/[(;'"].*$/, '').trim();
      out.push({ text, start, head, code });
    }
    hasCode = false;
  };
  for (const s of segments(sql)) {
    if (s.kind === 'separator') {
      push(s.from);
      start = s.to;
    } else if (s.kind === 'string' || (s.kind === 'code' && sql.slice(s.from, s.to).trim())) {
      hasCode = true;
    }
  }
  push(sql.length);
  return out;
}

/** Row-returning statements we can read through a cursor (bounded fetch, exact semantics). */
export function isCursorable(s: Statement): boolean {
  const first = s.head.split(' ')[0];
  if (first === 'SELECT' || first === 'VALUES' || first === 'TABLE') return !/\bINTO\b/.test(s.code);
  if (first === 'WITH') return !/\b(INSERT|UPDATE|DELETE|MERGE)\b/.test(s.code) && !/\bINTO\b/.test(s.code);
  return false;
}

export interface ScanProblem { statementIndex: number; message: string; msg: Msg }

const TX_CONTROL = /^(BEGIN|START TRANSACTION|COMMIT|END|ABORT|ROLLBACK(?! TO)|PREPARE TRANSACTION|COMMIT PREPARED|ROLLBACK PREPARED)\b/;
const NOT_IN_TX = [
  [/^VACUUM\b/, 'VACUUM'],
  [/^(CREATE|DROP) DATABASE\b/, 'CREATE/DROP DATABASE'],
  [/^(CREATE|DROP) TABLESPACE\b/, 'CREATE/DROP TABLESPACE'],
  [/^(CREATE|DROP)( UNIQUE)? INDEX CONCURRENTLY\b/, 'INDEX … CONCURRENTLY'],
  [/^REINDEX\b.*\bCONCURRENTLY\b/, 'REINDEX CONCURRENTLY'],
  [/^ALTER SYSTEM\b/, 'ALTER SYSTEM'],
  [/^DISCARD\b/, 'DISCARD'],
  [/^COPY\b/, 'COPY'],
  [/^CHECKPOINT\b/, 'CHECKPOINT'],
] as const;

/**
 * Sandbox rules: every Run/Check executes inside BEGIN … ROLLBACK, so the submission may not
 * end or start transactions itself, nor use statements PostgreSQL forbids inside a transaction.
 */
export function findSandboxProblems(statements: Statement[]): ScanProblem[] {
  const problems: ScanProblem[] = [];
  statements.forEach((s, statementIndex) => {
    if (TX_CONTROL.test(s.head)) {
      problems.push({
        statementIndex,
        message: `"${s.head.split(' ')[0]}" isn't needed here: every run is automatically wrapped in a transaction that is rolled back afterwards, so the database always starts fresh. Remove the transaction-control statements (you can practise them in the Playground).`,
        msg: { key: 'err.txControl', params: { cmd: s.head.split(' ')[0] } },
      });
      return;
    }
    for (const [re, label] of NOT_IN_TX) {
      if (re.test(s.head)) {
        problems.push({ statementIndex, message: `${label} can't run inside the sandbox transaction. Try it in the Playground instead.`, msg: { key: 'err.notInTx', params: { label } } });
        return;
      }
    }
  });
  return problems;
}
