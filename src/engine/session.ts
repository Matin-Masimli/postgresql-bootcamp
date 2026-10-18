// A practice database: one PGlite instance plus the rules for running submissions safely.
// Used by the browser worker and by the Node quality gate.
import type { PGliteInterface } from '@electric-sql/pglite';
import { findSandboxProblems, isCursorable, splitStatements, type Statement } from './sqlScan.ts';
import type { ResultSet, RunOutput, SqlError, StatementResult } from './types.ts';

export interface SequenceBaseline { sequence: string; lastValue: number }
export interface RunOptions {
  /** Max rows kept per result for display (the full result is always kept for the last statement when keepFull). */
  displayRows?: number;
  /** Keep the complete last result set (needed for grading). */
  keepFull?: boolean;
  /** Abort if a result exceeds this many rows (protects memory while grading). */
  maxRows?: number;
}

export const DISPLAY_ROWS = 500;
export const MAX_GRADED_ROWS = 50_000;

export class PracticeSession {
  private textParsers: Record<number, (v: string) => string> = {};
  private resetSequencesSql = '';

  private constructor(readonly pg: PGliteInterface) {}

  static async open(pg: PGliteInterface, sequences: SequenceBaseline[]): Promise<PracticeSession> {
    const s = new PracticeSession(pg);
    await s.refreshParsers();
    s.resetSequencesSql = sequences.length
      ? `SELECT ${sequences.map((q) => `setval('${q.sequence}', ${q.lastValue}, true)`).join(', ')}`
      : '';
    return s;
  }

  /** Identity parsers for every type oid, so results come back as canonical PostgreSQL text. */
  async refreshParsers() {
    const oids = await this.pg.query<{ oid: number }>('SELECT oid::int AS oid FROM pg_type');
    this.textParsers = Object.fromEntries(oids.rows.map((r) => [r.oid, (v: string) => v]));
  }

  /**
   * Runs a submission inside BEGIN … ROLLBACK, statement by statement, and stops at the first error.
   * `after` (e.g. a verification query) runs in the same transaction before the rollback.
   */
  async runSandboxed(sql: string, opts: RunOptions = {}, after?: string): Promise<{ output: RunOutput; afterResult?: ResultSet; afterError?: SqlError }> {
    const t0 = performance.now();
    const statements = splitStatements(sql);
    const problems = findSandboxProblems(statements);
    if (problems.length) {
      const p = problems[0];
      return { output: { statements: [], totalMs: 0, error: { message: p.message, offset: statements[p.statementIndex].start, statementIndex: p.statementIndex } } };
    }
    if (statements.length === 0) {
      return { output: { statements: [], totalMs: 0, error: { message: 'Nothing to run: the editor contains no SQL statement.' } } };
    }
    await this.pg.query('BEGIN');
    try {
      if (this.resetSequencesSql) await this.pg.query(this.resetSequencesSql);
      const output = await this.execStatements(statements, opts, true);
      output.totalMs = performance.now() - t0;
      if (output.error || !after) return { output };
      try {
        const r = await this.read(after, MAX_GRADED_ROWS, true);
        return { output, afterResult: r.result };
      } catch (e) {
        return { output, afterError: toSqlError(e) };
      }
    } finally {
      await this.pg.query('ROLLBACK').catch(() => undefined);
    }
  }

  /** Runs statements with no wrapping transaction (Playground: changes persist until reset). */
  async runPersistent(sql: string, opts: RunOptions = {}): Promise<RunOutput> {
    const t0 = performance.now();
    const statements = splitStatements(sql);
    if (statements.length === 0) return { statements: [], totalMs: 0, error: { message: 'Nothing to run: the editor contains no SQL statement.' } };
    const out = await this.execStatements(statements, opts, false);
    out.totalMs = performance.now() - t0;
    if (/^(CREATE|DROP|ALTER) (TYPE|DOMAIN|EXTENSION)\b/m.test(statements.map((s) => s.head).join('\n'))) await this.refreshParsers();
    return out;
  }

  private async execStatements(statements: Statement[], opts: RunOptions, inTransaction: boolean): Promise<RunOutput> {
    const results: StatementResult[] = [];
    const display = opts.displayRows ?? DISPLAY_ROWS;
    for (let i = 0; i < statements.length; i++) {
      const s = statements[i];
      const isLast = i === statements.length - 1;
      const t = performance.now();
      try {
        // Row-returning statements go through a cursor, so a runaway result can't exhaust memory.
        const r = isCursorable(s)
          ? await this.queryCursor(s.text, opts.maxRows ?? MAX_GRADED_ROWS, opts.maxRows !== undefined, inTransaction)
          : await this.query(s.text, opts.maxRows);
        const command = s.head.split(' ')[0] || 'SQL';
        const keepAll = isLast && opts.keepFull;
        const rows = r.result && !keepAll && r.result.rows.length > display ? r.result.rows.slice(0, display) : r.result?.rows;
        results.push({
          command,
          rowCount: r.result ? r.result.rows.length : r.affected,
          rowCountCapped: r.capped,
          result: r.result ? { columns: r.result.columns, rows: rows! } : undefined,
          truncated: !!r.result && rows!.length < r.result.rows.length,
          elapsedMs: performance.now() - t,
        });
      } catch (e) {
        const err = toSqlError(e);
        err.statementIndex = i;
        if (err.offset !== undefined) err.offset += s.start;
        return { statements: results, error: err, totalMs: 0 };
      }
    }
    return { statements: results, totalMs: 0 };
  }

  /** One trusted statement (reference/verification query), bounded like a submission. Call inside a transaction. */
  async read(sql: string, maxRows: number, inTransaction: boolean) {
    const [stmt] = splitStatements(sql);
    if (!stmt) throw new Error('empty query');
    return isCursorable(stmt) ? this.queryCursor(stmt.text, maxRows, true, inTransaction) : this.query(stmt.text, maxRows);
  }

  /**
   * Reads a row-returning statement through a NO SCROLL cursor, fetching at most maxRows + 1 rows.
   * Over the cap: throws TOO_MANY_ROWS when `strict` (grading), otherwise returns the first maxRows.
   */
  private async queryCursor(sql: string, maxRows: number, strict: boolean, inTransaction: boolean): Promise<{ result?: ResultSet; affected: number; capped?: boolean }> {
    const prefix = 'DECLARE pgb_cursor NO SCROLL CURSOR FOR ';
    const declare = async () => {
      try {
        await this.pg.query(prefix + sql);
      } catch (e) {
        const x = e as { position?: string };
        if (x.position) x.position = String(Math.max(1, Number(x.position) - prefix.length));
        throw e;
      }
    };
    let ownTx = false;
    if (inTransaction) {
      await declare();
    } else {
      // Playground (autocommit): cursors need a transaction block, unless the user already opened one.
      try {
        await declare();
      } catch (e) {
        if ((e as { code?: string }).code !== '25P01') throw e;
        await this.pg.query('BEGIN');
        ownTx = true;
        try {
          await declare();
        } catch (e2) {
          await this.pg.query('ROLLBACK').catch(() => undefined);
          throw e2;
        }
      }
    }
    try {
      const r = await this.pg.query<(string | null)[]>(`FETCH FORWARD ${maxRows + 1} FROM pgb_cursor`, [], { rowMode: 'array', parsers: this.textParsers });
      await this.pg.query('CLOSE pgb_cursor');
      if (ownTx) await this.pg.query('COMMIT');
      const capped = r.rows.length > maxRows;
      if (capped && strict) throw Object.assign(new Error(tooManyRows(maxRows)), { code: 'TOO_MANY_ROWS' });
      return {
        result: { columns: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })), rows: capped ? r.rows.slice(0, maxRows) : r.rows },
        affected: 0,
        capped,
      };
    } catch (e) {
      if (ownTx) await this.pg.query('ROLLBACK').catch(() => undefined);
      else if (!inTransaction) await this.pg.query('CLOSE pgb_cursor').catch(() => undefined);
      throw e;
    }
  }

  /** Single statement → text result set. Throws PostgreSQL errors (offset relative to the statement). */
  async query(sql: string, maxRows?: number): Promise<{ result?: ResultSet; affected: number; capped?: boolean }> {
    const r = await this.pg.query<(string | null)[]>(sql, [], { rowMode: 'array', parsers: this.textParsers });
    if (maxRows !== undefined && r.rows.length > maxRows) {
      throw Object.assign(new Error(tooManyRows(maxRows)), { code: 'TOO_MANY_ROWS' });
    }
    const hasResult = r.fields.length > 0;
    return {
      result: hasResult ? { columns: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })), rows: r.rows } : undefined,
      affected: r.affectedRows ?? 0,
    };
  }
}

const tooManyRows = (max: number) =>
  `The result has more than ${max.toLocaleString('en-US')} rows, which is more than the checker accepts. Check your joins (a missing join condition multiplies rows) and filters.`;

export function toSqlError(e: unknown): SqlError {
  const x = e as { message?: string; code?: string; detail?: string; hint?: string; position?: string | number };
  const pos = x.position !== undefined && x.position !== '' ? Number(x.position) : undefined;
  return {
    message: x.message ?? String(e),
    code: x.code,
    detail: x.detail || undefined,
    hint: x.hint || undefined,
    offset: pos !== undefined && !Number.isNaN(pos) ? pos - 1 : undefined,
  };
}
