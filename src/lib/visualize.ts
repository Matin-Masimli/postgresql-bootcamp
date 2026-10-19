// Runs a script's last statement under EXPLAIN and turns the result into the visualizer model.
import { engine, runError } from '../db/client.ts';
import { buildExplain, logicalSteps, parseExplain, type ExplainResult, type LogicalStep } from '../engine/plan.ts';
import type { SqlError } from '../engine/types.ts';

export interface Visualization {
  plan?: ExplainResult;
  steps?: LogicalStep[];
  /** The statement that was explained (shown above the plan). */
  statement?: string;
  error?: SqlError;
}

/**
 * main: a sandbox that is rolled back, so set-up statements run first and the query is executed (ANALYZE).
 * playground: changes persist there, so only the last statement is explained, and only read-only
 * statements are executed.
 */
export async function visualize(script: string, instance: 'main' | 'playground'): Promise<Visualization> {
  const req = buildExplain(script, instance === 'main' ? { keepEarlier: true, analyze: true } : { keepEarlier: false, analyze: 'readOnly' });
  if ('error' in req) return { error: { message: req.error, msg: req.msg, code: 'VISUALIZE' } };
  try {
    const output = await engine.run(req.sql, instance);
    if (output.error) {
      // Positions refer to the rewritten SQL; drop them rather than point at the wrong place.
      return { error: { ...output.error, offset: undefined }, statement: req.last.text.trim() };
    }
    const json = output.statements.at(-1)?.result?.rows[0]?.[0];
    if (!json) return { error: { message: 'EXPLAIN returned no plan.' } };
    const plan = parseExplain(json);
    return { plan, steps: logicalSteps(req.last.code, plan), statement: req.last.text.trim() };
  } catch (e) {
    return { error: runError(e) };
  }
}
