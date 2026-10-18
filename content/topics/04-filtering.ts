import type { Topic } from '../types.ts';

const topic: Topic = {
  id: 4,
  status: 'draft',
  explanation: `*The full explanation for this topic arrives in a later phase. For now this page holds a sample question.*`,
  sources: [],
  questions: [
    {
      id: 't04-q01',
      topic: 4,
      relatedTopics: [1],
      difficulty: 'easy',
      type: 'write-query',
      title: 'Premium products still on sale',
      prompt: `The merchandising team wants a list of **premium products that are still on sale**.

Return every product that has **not** been discontinued (\`discontinued_at\` is NULL) and whose \`price\` is **at least 1000**.

- **Columns, in this order:** \`product_id\`, \`name\`, \`price\`
- **Sort:** by \`price\`, highest first. When prices are equal, by \`product_id\` ascending.`,
      hints: [
        'Both conditions must hold, so combine them with AND in the WHERE clause.',
        'A missing value is not equal to anything, not even NULL. Test for it with `IS NULL`.',
        'Sort by two keys: `ORDER BY price DESC, product_id`.',
      ],
      referenceSolution: `SELECT product_id, name, price
FROM products
WHERE discontinued_at IS NULL
  AND price >= 1000
ORDER BY price DESC, product_id;`,
      alternativeSolutions: [
        `SELECT product_id, name, price FROM products WHERE price >= 1000.00 AND NOT discontinued_at IS NOT NULL ORDER BY 3 DESC, 1 ASC;`,
        `SELECT p.product_id, p.name, p.price FROM products AS p WHERE p.price BETWEEN 1000 AND 1000000 AND p.discontinued_at IS NULL ORDER BY p.price DESC, p.product_id;`,
      ],
      wrongAnswers: [
        // Forgets the "still on sale" condition.
        `SELECT product_id, name, price FROM products WHERE price >= 1000 ORDER BY price DESC, product_id;`,
        // = NULL is never true, so this returns nothing.
        `SELECT product_id, name, price FROM products WHERE discontinued_at = NULL AND price >= 1000 ORDER BY price DESC, product_id;`,
        // Sorts the wrong way.
        `SELECT product_id, name, price FROM products WHERE discontinued_at IS NULL AND price >= 1000 ORDER BY price, product_id;`,
      ],
      explanation: `1. **Start from the table:** \`FROM products\`.
2. **Keep products still on sale:** a product is on sale when \`discontinued_at\` has no value. A missing value is NULL, and NULL can only be tested with \`IS NULL\`. Writing \`= NULL\` gives NULL ("unknown"), and WHERE drops every row that isn't TRUE.
3. **Keep premium products:** "at least 1000" includes 1000 itself, so use \`>=\`.
4. **Combine the conditions with AND:** both must be true for a row to stay.
5. **Sort:** \`ORDER BY price DESC\` puts the most expensive first. Some products share a price (two laptops tie at the top), so add \`product_id\` as a tie-breaker to make the order fully determined.`,
      commonMistakes: [
        'Writing `discontinued_at = NULL`. It is never true, so the query returns no rows.',
        'Leaving out the discontinued filter and listing products that can no longer be bought.',
        'Sorting only by price. Rows with equal prices then come back in an arbitrary order.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
