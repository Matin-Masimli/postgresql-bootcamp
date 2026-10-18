// Quality gate: every question must be valid, deterministic, and correctly graded on both datasets.
// Runs in CI and blocks deployment.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TOPIC_CONTENT } from '../content/index.ts';
import { TOPICS } from '../content/topicList.ts';
import { isQueryQuestion, Topic, type Question } from '../content/types.ts';
import { compareResults, tableMatches } from '../src/engine/compare.ts';
import { ExpectedCache, grade, gradeOn } from '../src/engine/grade.ts';
import type { PracticeSession } from '../src/engine/session.ts';
import { codeOnly, isCursorable, splitStatements } from '../src/engine/sqlScan.ts';
import type { Dataset } from '../src/engine/types.ts';
import { openBoth } from './helpers/db.ts';

const NONDETERMINISTIC = /\b(now|current_date|current_time|current_timestamp|localtime|localtimestamp|clock_timestamp|statement_timestamp|transaction_timestamp|timeofday|random|setseed|gen_random_uuid)\b/i;

let sessions: Record<Dataset, PracticeSession>;
const cache = new ExpectedCache();

beforeAll(async () => {
  sessions = await openBoth();
});
afterAll(async () => {
  await Promise.all([sessions.main.pg.close(), sessions.hidden.pg.close()]);
});

describe('content structure', () => {
  it('every topic file matches the schema', () => {
    for (const t of TOPIC_CONTENT) {
      const r = Topic.safeParse(t);
      expect(r.success, `topic ${t.id}: ${r.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`).toBe(true);
    }
  });

  it('question ids are unique and match their topic', () => {
    const seen = new Set<string>();
    for (const t of TOPIC_CONTENT) {
      for (const q of t.questions) {
        expect(seen.has(q.id), `duplicate id ${q.id}`).toBe(false);
        seen.add(q.id);
        expect(q.topic, q.id).toBe(t.id);
        expect(q.id.startsWith(`t${String(t.id).padStart(2, '0')}-`), `${q.id} should start with t${String(t.id).padStart(2, '0')}-`).toBe(true);
      }
    }
  });

  it('related topics are earlier topics', () => {
    for (const q of TOPIC_CONTENT.flatMap((t) => t.questions)) {
      expect(new Set(q.relatedTopics).size, `${q.id}: duplicate related topics`).toBe(q.relatedTopics.length);
      for (const r of q.relatedTopics) expect(r < q.topic, `${q.id}: related topic ${r} is not earlier than ${q.topic}`).toBe(true);
      for (const r of q.previewTopics ?? []) expect(r > q.topic, `${q.id}: preview topic ${r} should be a later topic (use relatedTopics for earlier ones)`).toBe(true);
    }
  });

  it('complete topics meet the topic requirements', () => {
    for (const t of TOPIC_CONTENT.filter((x) => x.status === 'complete')) {
      expect(t.questions.length, `topic ${t.id} question count`).toBeGreaterThanOrEqual(15);
      expect(t.questions.length, `topic ${t.id} question count`).toBeLessThanOrEqual(20);
      expect(t.sources.length, `topic ${t.id} sources`).toBeGreaterThanOrEqual(3);
      expect(t.sources.length, `topic ${t.id} sources`).toBeLessThanOrEqual(6);
      expect(t.explanation.length, `topic ${t.id} explanation`).toBeGreaterThan(500);
      const types = new Set(t.questions.map((q) => q.type));
      expect(types.has('write-query'), `topic ${t.id} needs write-query questions`).toBe(true);
    }
  });

  it('runnable examples in explanations work (blocks starting with "-- ERROR" must fail)', async () => {
    for (const t of TOPIC_CONTENT) {
      for (const m of t.explanation.matchAll(/```sql\n([\s\S]*?)```/g)) {
        const sql = m[1];
        const expectError = /^\s*-- ERROR/.test(sql);
        const { output } = await sessions.main.runSandboxed(sql);
        if (expectError) expect(output.error, `topic ${t.id}: example marked -- ERROR ran fine:\n${sql}`).toBeTruthy();
        else expect(output.error?.message, `topic ${t.id}: example failed:\n${sql}`).toBeUndefined();
      }
    }
  });

  it('reports the difficulty mix per topic', () => {
    const lines = TOPIC_CONTENT.map((t) => {
      const c = (d: string) => t.questions.filter((q) => q.difficulty === d).length;
      const title = TOPICS.find((x) => x.id === t.id)?.title ?? `Topic ${t.id}`;
      return `  ${String(t.id).padStart(2)} ${title.padEnd(32)} ${t.status.padEnd(8)} n=${String(t.questions.length).padStart(2)}  easy ${c('easy')}  medium ${c('medium')}  hard ${c('hard')}  interview ${c('interview')}`;
    });
    console.log(`\nDifficulty mix:\n${lines.join('\n')}`);
    expect(lines.length).toBe(TOPIC_CONTENT.length);
  });
});

function checkSqlHygiene(q: Question & { referenceSolution: string }) {
  const sqls = [q.referenceSolution, ...('alternativeSolutions' in q ? q.alternativeSolutions : []), ...('verificationQuery' in q && q.verificationQuery ? [q.verificationQuery] : [])];
  for (const sql of sqls) {
    const m = NONDETERMINISTIC.exec(codeOnly(sql));
    expect(m, `${q.id}: non-deterministic function "${m?.[0]}" in a reference/alternative solution; use DATE '2025-06-30' instead`).toBeNull();
  }
}

for (const topic of TOPIC_CONTENT) {
  describe(`topic ${topic.id}`, () => {
    for (const q of topic.questions) {
      if (isQueryQuestion(q)) {
        it(`${q.id} ${q.title}`, async () => {
          checkSqlHygiene(q);
          const statements = splitStatements(q.referenceSolution);
          const modifies = statements.some((s) => !isCursorable(s));
          if (modifies) expect(q.verificationQuery, `${q.id}: DDL/DML reference needs a verificationQuery`).toBeTruthy();
          if (q.type === 'fix-query') expect(q.starterSql, `${q.id}: fix-query needs starterSql`).toBeTruthy();
          if (q.checkConfig.orderMatters) {
            const ordered = q.verificationQuery ?? q.referenceSolution;
            expect(/\bORDER\s+BY\b/.test(codeOnly(ordered).toUpperCase()), `${q.id}: orderMatters but no ORDER BY in the ${q.verificationQuery ? 'verification query' : 'reference'}`).toBe(true);
          }

          // Reference runs on both datasets, is non-empty, and differs between them.
          const expected = {
            main: await cache.get(sessions.main, 'main', q),
            hidden: await cache.get(sessions.hidden, 'hidden', q),
          };
          if (!q.checkConfig.allowEmptyResult) {
            expect(expected.main.rows.length, `${q.id}: expected result is empty on main`).toBeGreaterThan(0);
            expect(expected.hidden.rows.length, `${q.id}: expected result is empty on hidden`).toBeGreaterThan(0);
          }
          if (!q.checkConfig.allowSameOnHidden) {
            const same = compareResults(expected.main, expected.hidden, q.checkConfig).pass;
            expect(same, `${q.id}: main and hidden give identical results, so the hidden check adds nothing (set allowSameOnHidden if intended)`).toBe(false);
          }

          // The checker accepts the reference and every alternative...
          for (const [i, sql] of [q.referenceSolution, ...q.alternativeSolutions].entries()) {
            const { feedback } = await grade(sessions, q, sql, cache);
            expect(feedback.pass, `${q.id}: ${i === 0 ? 'reference' : `alternative #${i}`} rejected: ${feedback.summary} ${feedback.error?.message ?? ''}`).toBe(true);
          }
          // ...and rejects every plausible wrong answer (and the broken starter query) already on the
          // main data, so the learner gets a visible diff rather than only the hidden-data verdict.
          const wrongs = [...q.wrongAnswers, ...(q.type === 'fix-query' && q.starterSql ? [q.starterSql] : [])];
          for (const [i, sql] of wrongs.entries()) {
            const { feedback } = await gradeOn(sessions.main, 'main', q, sql, cache);
            expect(feedback.pass, `${q.id}: wrong answer #${i + 1} is ACCEPTED on the main data (the data can't tell it apart):\n${sql}`).toBe(false);
          }
        });
      } else if (q.type === 'predict-output') {
        it(`${q.id} ${q.title}`, async () => {
          checkSqlHygiene(q);
          expect(q.correctOption, `${q.id}: correctOption out of range`).toBeLessThan(q.options.length);
          for (const ds of ['main', 'hidden'] as const) {
            // Predict queries may have several statements (e.g. CREATE, INSERT, SELECT): use the last result.
            const { output } = await sessions[ds].runSandboxed(q.referenceSolution, { keepFull: true });
            expect(output.error, `${q.id}: ${output.error?.message}`).toBeUndefined();
            const r = { result: output.statements.at(-1)?.result };
            expect(r.result, `${q.id}: query returned no result set`).toBeTruthy();
            const matches = q.options.map((o) => tableMatches(r.result!, o.table, q.checkConfig.orderMatters));
            expect(matches.filter(Boolean).length, `${q.id} (${ds}): exactly one option must match; matches: ${JSON.stringify(matches)}; actual: ${JSON.stringify(r.result!.rows)}`).toBe(1);
            expect(matches[q.correctOption], `${q.id} (${ds}): option ${q.correctOption} is marked correct but option ${matches.indexOf(true)} matches`).toBe(true);
          }
        });
      } else {
        it(`${q.id} ${q.title}`, () => {
          expect(q.correctOption).toBeLessThan(q.options.length);
          expect(new Set(q.options.map((o) => o.text)).size, `${q.id}: duplicate options`).toBe(q.options.length);
        });
      }
    }
  });
}
