// Grading: run the reference and the submission against the same fresh state, compare,
// then repeat on the hidden dataset. Pass only if both match.
import type { CheckConfig } from '../../content/types.ts';
import { compareResults } from './compare.ts';
import { MAX_GRADED_ROWS, type PracticeSession } from './session.ts';
import type { Dataset, Feedback, ResultSet, RunOutput, SqlError } from './types.ts';

export interface Gradable {
  id: string;
  referenceSolution: string;
  verificationQuery?: string;
  checkConfig: Pick<CheckConfig, 'orderMatters' | 'columnNamesMatter' | 'duplicatesMatter' | 'numericTolerance'>;
}

export interface Submission { output: RunOutput; result?: ResultSet; error?: SqlError; noResult?: boolean }

/** What a submission produces for grading: the last statement's result, or the verification query's. */
export async function evaluate(s: PracticeSession, sql: string, q: Pick<Gradable, 'verificationQuery'>): Promise<Submission> {
  const { output, afterResult, afterError } = await s.runSandboxed(sql, { keepFull: true, maxRows: MAX_GRADED_ROWS }, q.verificationQuery);
  if (output.error) return { output, error: output.error };
  if (q.verificationQuery) {
    if (afterError) return { output, error: { ...afterError, message: `After your statements ran, the verification query failed: ${afterError.message}` } };
    return { output, result: afterResult };
  }
  const last = output.statements[output.statements.length - 1];
  if (!last?.result) return { output, noResult: true };
  return { output, result: last.result };
}

export class ExpectedCache {
  private map = new Map<string, ResultSet>();
  async get(s: PracticeSession, dataset: Dataset, q: Gradable): Promise<ResultSet> {
    const key = `${dataset}\u0000${q.id}\u0000${q.referenceSolution}\u0000${q.verificationQuery ?? ''}`;
    const hit = this.map.get(key);
    if (hit) return hit;
    const sub = await evaluate(s, q.referenceSolution, q);
    if (!sub.result) {
      throw new Error(`Reference solution for ${q.id} failed on ${dataset}: ${sub.error?.message ?? 'it returned no result set'}`);
    }
    this.map.set(key, sub.result);
    return sub.result;
  }
}

export async function gradeOn(s: PracticeSession, dataset: Dataset, q: Gradable, sql: string, cache: ExpectedCache): Promise<{ feedback: Feedback; output: RunOutput }> {
  const expected = await cache.get(s, dataset, q);
  const sub = await evaluate(s, sql, q);
  if (sub.error) {
    const tooMany = sub.error.code === 'TOO_MANY_ROWS';
    return { output: sub.output, feedback: { pass: false, dataset, kind: tooMany ? 'too-many-rows' : 'error', summary: tooMany ? sub.error.message : 'PostgreSQL reported an error.', msg: tooMany ? sub.error.msg : { key: 'fb.pgError' }, error: sub.error } };
  }
  if (sub.noResult) {
    return { output: sub.output, feedback: { pass: false, dataset, kind: 'no-result', summary: 'Your last statement did not return any rows to compare. The answer must end with a query that returns the requested result.', msg: { key: 'fb.noResult' } } };
  }
  return { output: sub.output, feedback: { ...compareResults(expected, sub.result!, q.checkConfig), dataset } };
}

/** Full check: main first (detailed diff), then hidden (no hidden data revealed). */
export async function grade(sessions: Record<Dataset, PracticeSession>, q: Gradable, sql: string, cache: ExpectedCache): Promise<{ feedback: Feedback; output: RunOutput }> {
  const main = await gradeOn(sessions.main, 'main', q, sql, cache);
  if (!main.feedback.pass) return main;
  const hidden = await gradeOn(sessions.hidden, 'hidden', q, sql, cache);
  if (hidden.feedback.pass) {
    return { output: main.output, feedback: { ...main.feedback, summary: 'Correct! Your answer matches on the practice data and on the hidden check data.', msg: { key: 'fb.correctBoth' } } };
  }
  const h = hidden.feedback;
  const counts = h.expectedRowCount !== undefined && h.actualRowCount !== undefined && h.expectedRowCount !== h.actualRowCount
    ? ` There it should return ${h.expectedRowCount} row${h.expectedRowCount === 1 ? '' : 's'}, but yours returned ${h.actualRowCount}.` : '';
  return {
    output: main.output,
    feedback: {
      pass: false, dataset: 'hidden', kind: 'hidden', error: h.error,
      msg: h.error
        ? { key: 'fb.hiddenError', params: { message: h.error.message } }
        : h.kind === 'order'
          ? { key: 'fb.hiddenOrder' }
          : counts
            ? { key: 'fb.hiddenRowsCount', params: { expected: h.expectedRowCount!, actual: h.actualRowCount! } }
            : { key: 'fb.hiddenRows' },
      summary: h.error
        ? `Your answer works on the practice data but fails on the hidden check data with an error: ${h.error.message}`
        : h.kind === 'order'
          ? 'Your answer matches the practice data, but on the hidden check data the rows come out in a different order. Your ORDER BY probably needs a tie-breaker, or the query relies on the order rows happen to be stored in.'
          : `Your answer matches the practice data but not the hidden check data (same tables, different rows).${counts} Either it relies on specific values, ids or dates that only happen to work here, or it misses a condition that happens not to matter in the practice data. Re-read the requirements.`,
    },
  };
}
