// Question and topic format. Every topic file in content/topics/ exports a `Topic`.
// The zod schemas are the source of truth; the quality gate validates every question against them.
import { z } from 'zod';

export const Difficulty = z.enum(['easy', 'medium', 'hard', 'interview']);
export type Difficulty = z.infer<typeof Difficulty>;

export const CheckConfig = z.object({
  /** Compare rows in order. Only true when the prompt requires a specific ORDER BY. */
  orderMatters: z.boolean(),
  /** Absolute tolerance for numeric columns (e.g. 0.01). Default: exact numeric equality (12.5 = 12.50). */
  numericTolerance: z.number().positive().optional(),
  /** Column names must match the reference's (case-insensitive). */
  columnNamesMatter: z.boolean(),
  /** Duplicate rows count (multiset). false = compare as sets. */
  duplicatesMatter: z.boolean(),
  /** Quality gate: the expected result may legitimately be empty. */
  allowEmptyResult: z.boolean().optional(),
  /** Quality gate: main and hidden data may legitimately give the same result. */
  allowSameOnHidden: z.boolean().optional(),
});
export type CheckConfig = z.infer<typeof CheckConfig>;

const Sql = z.string().trim().min(1);

const Base = z.object({
  /** Stable id: t<topic 2 digits>-q<2 digits>, e.g. t17-q05. Progress is keyed on it. */
  id: z.string().regex(/^t\d{2}-q\d{2}$/),
  topic: z.number().int().min(1).max(21),
  /** Earlier topics this question also relies on. */
  relatedTopics: z.array(z.number().int().min(1).max(21)),
  /**
   * Later topics whose basic pattern the question needs (e.g. wrapping a window query in a
   * subquery/CTE to filter on its result). The topic explanation must teach that pattern.
   */
  previewTopics: z.array(z.number().int().min(1).max(21)).optional(),
  difficulty: Difficulty,
  title: z.string().min(3),
  /** Markdown. Must state exact columns, column order, sorting, rounding and tie-breaking. */
  prompt: z.string().min(10),
  /** 1–3 progressive hints. */
  hints: z.array(z.string().min(3)).min(1).max(3),
  /** Step-by-step explanation (markdown). */
  explanation: z.string().min(10),
  commonMistakes: z.array(z.string().min(3)).min(1),
});

export const QueryQuestion = Base.extend({
  type: z.enum(['write-query', 'fix-query']),
  /** fix-query: the broken query placed in the editor. The gate checks that it is rejected. */
  starterSql: Sql.optional(),
  referenceSolution: Sql,
  alternativeSolutions: z.array(Sql),
  /** 1–2 plausible wrong answers the checker must reject. */
  wrongAnswers: z.array(Sql).min(1).max(3),
  checkConfig: CheckConfig,
  /** DDL/DML: run after the submitted statements (same transaction); its result is what gets compared. */
  verificationQuery: Sql.optional(),
});

const ResultTable = z.object({
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string().nullable())),
});
export type ResultTable = z.infer<typeof ResultTable>;

export const PredictQuestion = Base.extend({
  type: z.literal('predict-output'),
  /** The query whose output the learner predicts. The gate runs it to verify the marked option. */
  referenceSolution: Sql,
  options: z.array(z.object({ table: ResultTable })).min(2).max(5),
  correctOption: z.number().int().min(0),
  checkConfig: CheckConfig.pick({ orderMatters: true }),
});

export const ConceptQuestion = Base.extend({
  type: z.literal('concept-mc'),
  options: z.array(z.object({ text: z.string().min(1) })).min(2).max(5),
  correctOption: z.number().int().min(0),
});

export const Question = z.discriminatedUnion('type', [QueryQuestion, PredictQuestion, ConceptQuestion]);
export type Question = z.infer<typeof Question>;
export type QueryQuestion = z.infer<typeof QueryQuestion>;
export type PredictQuestion = z.infer<typeof PredictQuestion>;
export type ConceptQuestion = z.infer<typeof ConceptQuestion>;
export const isQueryQuestion = (q: Question): q is QueryQuestion => q.type === 'write-query' || q.type === 'fix-query';

export const Topic = z.object({
  id: z.number().int().min(1).max(21),
  /** draft = work in progress (only per-question checks); complete = full topic requirements enforced. */
  status: z.enum(['draft', 'complete']),
  /** Markdown explanation. ```sql fenced blocks get a Run button. */
  explanation: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })),
  questions: z.array(Question),
});
export type Topic = z.infer<typeof Topic>;
