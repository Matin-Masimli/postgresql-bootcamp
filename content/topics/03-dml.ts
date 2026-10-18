import type { Topic } from '../types.ts';

const topic: Topic = {
  id: 3,
  status: 'draft',
  explanation: `*The full explanation for this topic arrives in a later phase. For now this page holds a sample question.*`,
  sources: [],
  questions: [
    {
      id: 't03-q01',
      topic: 3,
      relatedTopics: [1],
      difficulty: 'medium',
      type: 'write-query',
      title: 'Cancel stale pending orders',
      prompt: `Customer support is closing out abandoned checkouts.

Write **one \`UPDATE\` statement** that sets \`status\` to \`'cancelled'\` for every order that:

- still has \`status = 'pending'\`, **and**
- was placed **before 1 June 2025**, i.e. \`ordered_at < '2025-06-01'\` (timestamps are UTC).

All other orders, including pending orders placed on or after 1 June 2025, must stay unchanged.

*The checker runs your statement, then inspects the \`orders\` table. Every run is rolled back afterwards, so you can try as often as you like.*`,
      hints: [
        'The statement has the shape `UPDATE orders SET … WHERE …`.',
        'The WHERE clause needs two conditions joined with AND: one on `status` and one on `ordered_at`.',
        'Run `SELECT order_id, status, ordered_at FROM orders WHERE status = \'pending\'` first to see which rows you are about to change.',
      ],
      referenceSolution: `UPDATE orders
SET status = 'cancelled'
WHERE status = 'pending'
  AND ordered_at < '2025-06-01';`,
      alternativeSolutions: [
        `UPDATE orders SET status = 'cancelled' WHERE ordered_at < TIMESTAMPTZ '2025-06-01 00:00:00+00' AND status = 'pending';`,
        `UPDATE orders AS o SET status = 'cancelled' WHERE o.status IN ('pending') AND o.ordered_at < DATE '2025-06-01';`,
      ],
      wrongAnswers: [
        // Also cancels the recent pending orders.
        `UPDATE orders SET status = 'cancelled' WHERE status = 'pending';`,
        // Cancels every old order, delivered ones included.
        `UPDATE orders SET status = 'cancelled' WHERE ordered_at < '2025-06-01';`,
        // US spelling violates the CHECK constraint on status.
        `UPDATE orders SET status = 'canceled' WHERE status = 'pending' AND ordered_at < '2025-06-01';`,
      ],
      verificationQuery: `SELECT order_id, status FROM orders WHERE status IN ('pending', 'cancelled')`,
      explanation: `1. **Pick the table and the new value:** \`UPDATE orders SET status = 'cancelled'\`.
2. **Restrict the rows:** without a WHERE clause, UPDATE changes *every* row in the table. Here a row must satisfy both conditions, so combine them with AND.
3. **Compare timestamps carefully:** \`ordered_at\` is a \`timestamptz\`. The literal \`'2025-06-01'\` is read as midnight at the start of 1 June in the session time zone (UTC here), so \`<\` keeps exactly the orders placed before that day.
4. **Check the effect:** PostgreSQL reports \`UPDATE n\`, the number of rows changed. A quick \`SELECT status, count(*) FROM orders GROUP BY status\` before and after (in the same run) confirms it.`,
      commonMistakes: [
        'Forgetting the date condition, which also cancels pending orders that are only a few days old.',
        'Forgetting the status condition, which cancels delivered orders too. Always check how many rows an UPDATE affects.',
        "Misspelling the value (`'canceled'`). The CHECK constraint on `orders.status` rejects it with an error.",
      ],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
