import type { Topic } from '../types.ts';

const topic: Topic = {
  id: 12,
  status: 'draft',
  explanation: `*The full explanation for this topic arrives in a later phase. For now this page holds a sample question.*`,
  sources: [],
  questions: [
    {
      id: 't12-q01',
      topic: 12,
      relatedTopics: [1, 8],
      difficulty: 'easy',
      type: 'predict-output',
      title: 'Four ways to meet NULL',
      prompt: `Without running it, predict the single row this query returns.`,
      referenceSolution: `SELECT NULL = NULL        AS a,
       NULL IS NULL      AS b,
       COALESCE(NULL, 0) + 1 AS c,
       NULLIF(5, 5)      AS d;`,
      options: [
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['true', 'true', '1', null]] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [[null, 'true', '1', null]] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['false', 'true', null, '5']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [[null, 'true', null, '0']] } },
      ],
      correctOption: 1,
      hints: [
        'Comparing anything with NULL using `=` gives "unknown", which is NULL, not TRUE or FALSE.',
        '`COALESCE` returns its first non-NULL argument. `NULLIF(x, y)` returns NULL when x = y, otherwise x.',
      ],
      explanation: `- **a = NULL:** \`NULL = NULL\` asks "is an unknown value equal to another unknown value?". The answer is unknown, so the result is NULL, not TRUE. That's why you need \`IS NULL\`.
- **b = true:** \`IS NULL\` is the dedicated test, and it always returns TRUE or FALSE.
- **c = 1:** \`COALESCE(NULL, 0)\` skips the NULL and returns 0, and 0 + 1 = 1. (Without COALESCE, \`NULL + 1\` would be NULL.)
- **d = NULL:** \`NULLIF(5, 5)\` returns NULL because both arguments are equal. It is often used to turn a value into NULL, e.g. \`x / NULLIF(y, 0)\` to avoid division by zero.`,
      commonMistakes: [
        'Expecting `NULL = NULL` to be TRUE. Equality with NULL is always NULL ("unknown").',
        'Thinking COALESCE returns NULL when its first argument is NULL. It moves on to the next argument.',
        'Mixing up NULLIF and COALESCE. NULLIF creates NULLs, COALESCE replaces them.',
      ],
      checkConfig: { orderMatters: false },
    },
  ],
};

export default topic;
