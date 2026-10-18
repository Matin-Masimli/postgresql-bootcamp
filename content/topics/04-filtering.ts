import type { Topic } from '../types.ts';

const explanation = `\`WHERE\` keeps only the rows for which a condition is **true**. It's evaluated after \`FROM\` and before \`SELECT\`, so it works on the table's columns. Output aliases don't exist yet at that point.

\`\`\`sql
SELECT order_id, status, channel, ordered_at
FROM orders
WHERE channel = 'phone'
  AND status <> 'cancelled'
ORDER BY order_id
LIMIT 10;
\`\`\`

## Comparison operators

\`=\`, \`<>\` (or \`!=\`), \`<\`, \`<=\`, \`>\`, \`>=\` work on numbers, text, dates and timestamps. Text comparison is **case-sensitive**: \`'Berlin' = 'berlin'\` is false.

- \`x BETWEEN a AND b\` means \`x >= a AND x <= b\`. **Both ends are included.**
- \`x IN (a, b, c)\` is shorthand for \`x = a OR x = b OR x = c\`.

## AND, OR, NOT and parentheses

\`NOT\` binds tightest, then \`AND\`, then \`OR\`. So \`a AND b OR c\` means \`(a AND b) OR c\`. When you mix AND and OR, **always add parentheses**:

\`\`\`sql
-- Phone orders that are shipped or delivered
SELECT order_id, channel, status
FROM orders
WHERE channel = 'phone'
  AND (status = 'shipped' OR status = 'delivered')
ORDER BY order_id
LIMIT 10;
\`\`\`

## NULL and three-valued logic

A comparison with NULL is neither true nor false. It's **unknown** (NULL), and WHERE drops rows whose condition is unknown.

| a | b | a AND b | a OR b |
|---|---|---|---|
| true | NULL | NULL | true |
| false | NULL | false | NULL |
| NULL | NULL | NULL | NULL |

\`NOT NULL\` is NULL. Consequences:

- \`WHERE email = NULL\` matches **nothing**. Write \`WHERE email IS NULL\` / \`IS NOT NULL\`.
- \`WHERE status <> 'pending'\` silently drops rows where status is NULL.
- **The NOT IN trap:** \`x NOT IN (1, 2)\` is NULL when x is NULL, so those rows disappear. If the *list* contains a NULL, \`NOT IN\` matches nothing at all.
- \`a IS DISTINCT FROM b\` is a NULL-safe "not equal": NULL vs 5 is true, NULL vs NULL is false. \`IS NOT DISTINCT FROM\` is the NULL-safe "equal".

\`\`\`sql
SELECT count(*) FILTER (WHERE country_id NOT IN (1, 2, 7))                       AS not_in_only,
       count(*) FILTER (WHERE country_id NOT IN (1, 2, 7) OR country_id IS NULL) AS with_unknown
FROM customers;
\`\`\`

## Pattern matching: LIKE and ILIKE

- \`%\` matches any sequence of characters (including none), and \`_\` matches exactly one character.
- \`LIKE\` is case-sensitive. PostgreSQL's \`ILIKE\` ignores case.
- To match a literal \`%\` or \`_\`, escape it: \`LIKE '%\\_%'\` (backslash is the default escape character), or choose your own: \`LIKE '%!_%' ESCAPE '!'\`.

\`\`\`sql
SELECT product_id, name
FROM products
WHERE name ILIKE '%keyboard%'
ORDER BY product_id;
\`\`\`

## Filtering dates and timestamps

\`orders.ordered_at\` is a \`timestamptz\` (date **and** time). Use **half-open ranges** for whole days or months:

\`\`\`sql
-- Every order in February 2024 (a leap year!)
SELECT count(*)
FROM orders
WHERE ordered_at >= '2024-02-01'
  AND ordered_at <  '2024-03-01';
\`\`\`

\`BETWEEN '2024-02-01' AND '2024-02-29'\` looks right but stops at **2024-02-29 00:00:00**, so it misses almost all of the last day.

A timestamp literal without a zone uses the session time zone (UTC here). Add a zone name to mean local time elsewhere: \`TIMESTAMPTZ '2024-03-31 00:00 Europe/Berlin'\`.

## Gotchas

- Single quotes for values, double quotes for identifiers: \`WHERE status = "pending"\` looks for a *column* called pending.
- WHERE can't use output aliases or aggregates. Aggregates go in HAVING (Topic 14).
- \`<> ''\` doesn't exclude NULLs. Test for both if you need to.`;

const topic: Topic = {
  id: 4,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: The WHERE Clause (7.2.2)', url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-WHERE' },
    { title: 'PostgreSQL 18: Comparison Functions and Operators (9.2)', url: 'https://www.postgresql.org/docs/18/functions-comparison.html' },
    { title: 'PostgreSQL 18: Logical Operators (9.1)', url: 'https://www.postgresql.org/docs/18/functions-logical.html' },
    { title: 'PostgreSQL 18: Pattern Matching, LIKE (9.7.1)', url: 'https://www.postgresql.org/docs/18/functions-matching.html' },
    { title: 'Neon PostgreSQL Tutorial: WHERE', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-where' },
    { title: 'PGExercises: Basic queries with WHERE', url: 'https://pgexercises.com/questions/basic/where.html' },
  ],
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
        `SELECT product_id, name, price FROM products WHERE price >= 1000 ORDER BY price DESC, product_id;`,
        `SELECT product_id, name, price FROM products WHERE discontinued_at = NULL AND price >= 1000 ORDER BY price DESC, product_id;`,
        `SELECT product_id, name, price FROM products WHERE discontinued_at IS NULL AND price >= 1000 ORDER BY price, product_id;`,
      ],
      explanation: `1. **Start from the table:** \`FROM products\`.
2. **Keep products still on sale:** a product is on sale when \`discontinued_at\` has no value. A missing value is NULL, and NULL can only be tested with \`IS NULL\`. Writing \`= NULL\` gives NULL ("unknown"), and WHERE drops every row that isn't TRUE.
3. **Keep premium products:** "at least 1000" includes 1000 itself, so use \`>=\`.
4. **Combine the conditions with AND:** both must be true for a row to stay.
5. **Sort:** \`ORDER BY price DESC\` puts the most expensive first. Some products share a price, so add \`product_id\` as a tie-breaker to make the order fully determined.`,
      commonMistakes: [
        'Writing `discontinued_at = NULL`. It is never true, so the query returns no rows.',
        'Leaving out the discontinued filter and listing products that can no longer be bought.',
        'Sorting only by price. Rows with equal prices then come back in an arbitrary order.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q02', topic: 4, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'German customers who opted in',
      prompt: `Marketing wants to e-mail customers **living in Germany** (\`country_id = 9\`) who **agreed to marketing** (\`marketing_opt_in\` is true).

- **Columns:** \`customer_id\`, \`first_name\`, \`last_name\`, \`email\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Two conditions, both required: AND.', 'A boolean column can be used directly as a condition: `WHERE marketing_opt_in`.'],
      referenceSolution: `SELECT customer_id, first_name, last_name, email
FROM customers
WHERE country_id = 9
  AND marketing_opt_in
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, first_name, last_name, email FROM customers WHERE marketing_opt_in = true AND country_id IN (9) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, first_name, last_name, email FROM customers WHERE country_id = 9 OR marketing_opt_in ORDER BY customer_id;`,
        `SELECT customer_id, first_name, last_name, email FROM customers WHERE country_id = 9 ORDER BY customer_id;`,
      ],
      explanation: `\`marketing_opt_in\` is a boolean, so it can be the condition itself: \`WHERE marketing_opt_in\` is the same as \`WHERE marketing_opt_in = true\`. Combined with \`country_id = 9\` using AND, a customer must satisfy both.`,
      commonMistakes: ['Using OR, which returns everyone in Germany plus everyone who opted in anywhere.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q03', topic: 4, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'Is BETWEEN inclusive?',
      prompt: `Which prices does \`WHERE price BETWEEN 10 AND 20\` match?`,
      options: [{ text: '10 < price < 20' }, { text: '10 <= price < 20' }, { text: '10 <= price <= 20' }, { text: '10 < price <= 20' }],
      correctOption: 2,
      hints: ['BETWEEN is shorthand for two comparisons joined with AND.'],
      explanation: `\`x BETWEEN a AND b\` means \`x >= a AND x <= b\`: **both** ends are included. Prices 10.00 and 20.00 match.

Beware with timestamps: \`BETWEEN '2024-02-01' AND '2024-02-29'\` ends at 2024-02-29 **00:00**, so most of the 29th is excluded. Use \`>= start AND < next_day\` instead.`,
      commonMistakes: ['Assuming the upper bound is excluded.'],
    },
    {
      id: 't04-q04', topic: 4, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Not equal to 1',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x
FROM (VALUES (1), (NULL), (3)) AS t(x)
WHERE x <> 1
ORDER BY x;`,
      options: [
        { table: { columns: ['x'], rows: [['3']] } },
        { table: { columns: ['x'], rows: [['3'], [null]] } },
        { table: { columns: ['x'], rows: [[null], ['3']] } },
        { table: { columns: ['x'], rows: [['1'], ['3']] } },
      ],
      correctOption: 0,
      hints: ['What is `NULL <> 1`: true, false or unknown?'],
      explanation: `For the NULL row, \`NULL <> 1\` is **unknown** (NULL), and WHERE only keeps rows where the condition is **true**. So only 3 remains.

To keep NULLs as well, write \`WHERE x <> 1 OR x IS NULL\`, or the NULL-safe \`WHERE x IS DISTINCT FROM 1\`.`,
      commonMistakes: ['Thinking NULL is "not equal" to 1. It\'s unknown.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't04-q05', topic: 4, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Phone orders that went out',
      prompt: `List all orders placed by **phone** (\`channel = 'phone'\`) whose status is **'shipped' or 'delivered'**.

- **Columns:** \`order_id\`, \`channel\`, \`status\`
- **Sort:** by \`order_id\`.`,
      hints: ['AND binds tighter than OR. Group the two statuses with parentheses, or use IN.'],
      referenceSolution: `SELECT order_id, channel, status
FROM orders
WHERE channel = 'phone'
  AND status IN ('shipped', 'delivered')
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, channel, status FROM orders WHERE channel = 'phone' AND (status = 'shipped' OR status = 'delivered') ORDER BY order_id;`],
      wrongAnswers: [
        `SELECT order_id, channel, status FROM orders WHERE channel = 'phone' AND status = 'shipped' OR status = 'delivered' ORDER BY order_id;`,
        `SELECT order_id, channel, status FROM orders WHERE channel = 'phone' AND status = 'delivered' ORDER BY order_id;`,
      ],
      explanation: `\`channel = 'phone' AND status = 'shipped' OR status = 'delivered'\` is read as \`(phone AND shipped) OR delivered\`. That returns every delivered order from every channel!

Either put the OR in parentheses, or use \`status IN ('shipped', 'delivered')\`, which is shorter and can't be mis-grouped.`,
      commonMistakes: ['Mixing AND and OR without parentheses.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q06', topic: 4, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Products mentioning “pro”',
      prompt: `Find all products whose **name contains the letters "pro"** anywhere, in **any capitalisation** ("Pro", "PRO", "pro", …).

- **Columns:** \`product_id\`, \`name\`
- **Sort:** by \`product_id\`.`,
      hints: ['`%` matches any run of characters.', 'LIKE is case-sensitive. PostgreSQL has a case-insensitive variant.'],
      referenceSolution: `SELECT product_id, name
FROM products
WHERE name ILIKE '%pro%'
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT product_id, name FROM products WHERE lower(name) LIKE '%pro%' ORDER BY product_id;`, `SELECT product_id, name FROM products WHERE name ~* 'pro' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id, name FROM products WHERE name LIKE '%pro%' ORDER BY product_id;`,
        `SELECT product_id, name FROM products WHERE name ILIKE 'pro%' ORDER BY product_id;`,
      ],
      explanation: `\`ILIKE\` is PostgreSQL's case-insensitive LIKE. \`'%pro%'\` means "anything, then pro, then anything", so the text can appear anywhere: "Smartphone **Pro**", "Screen **Pro**tector", "**Pro**gramming" titles…

\`lower(name) LIKE '%pro%'\` is the portable equivalent. \`~*\` is a case-insensitive regular expression (Topic 9).`,
      commonMistakes: ['Using LIKE, which is case-sensitive.', 'Forgetting the leading %, which only matches names that *start* with "pro".'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q07', topic: 4, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Orders in February 2024',
      prompt: `List **every order placed in February 2024** (UTC). 2024 is a leap year.

- **Columns:** \`order_id\`, \`ordered_at\`
- **Sort:** by \`order_id\`.`,
      hints: ['`ordered_at` includes a time of day. Which end of a date range is the dangerous one?', 'Use a half-open range: from the first day of February up to, but excluding, 1 March.'],
      referenceSolution: `SELECT order_id, ordered_at
FROM orders
WHERE ordered_at >= '2024-02-01'
  AND ordered_at <  '2024-03-01'
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, ordered_at FROM orders WHERE ordered_at >= TIMESTAMPTZ '2024-02-01 00:00+00' AND ordered_at < TIMESTAMPTZ '2024-03-01 00:00+00' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, ordered_at FROM orders WHERE ordered_at BETWEEN '2024-02-01' AND '2024-02-29' ORDER BY order_id;`,
        `SELECT order_id, ordered_at FROM orders WHERE ordered_at >= '2024-02-01' AND ordered_at < '2024-02-29' ORDER BY order_id;`,
      ],
      explanation: `\`'2024-02-29'\` compared with a timestamp means **2024-02-29 00:00:00**. BETWEEN … AND '2024-02-29' therefore excludes everything on the leap day after midnight, and the practice data has several orders on that day.

The half-open range \`>= '2024-02-01' AND < '2024-03-01'\` covers every instant of February, however many days it has, and it's correct at any time precision.`,
      commonMistakes: ['BETWEEN with the last day of the month on a timestamp.', 'Forgetting that February 2024 has 29 days.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q08', topic: 4, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Customers outside the big three markets',
      prompt: `List customers who do **not** live in the United States (1), Canada (2) or the United Kingdom (7). Customers whose country is **unknown** (NULL) must be **included** too.

- **Columns:** \`customer_id\`, \`country_id\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`country_id NOT IN (1, 2, 7)` is NULL, not true, when country_id is NULL.', 'Add those rows explicitly with `OR country_id IS NULL`.'],
      referenceSolution: `SELECT customer_id, country_id
FROM customers
WHERE country_id NOT IN (1, 2, 7)
   OR country_id IS NULL
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, country_id FROM customers WHERE NOT (country_id IS NOT NULL AND country_id IN (1, 2, 7)) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, country_id FROM customers WHERE country_id NOT IN (1, 2, 7) ORDER BY customer_id;`,
        `SELECT customer_id, country_id FROM customers WHERE country_id <> 1 OR country_id <> 2 OR country_id <> 7 ORDER BY customer_id;`,
      ],
      explanation: `For a customer with \`country_id\` NULL, \`NULL NOT IN (1, 2, 7)\` is unknown, so a plain NOT IN silently drops them. \`OR country_id IS NULL\` brings them back.

The second wrong answer is a classic logic slip: every value differs from at least one of 1, 2 and 7, so \`<> 1 OR <> 2 OR <> 7\` is true for all non-NULL countries. "Not any of these" needs AND: \`<> 1 AND <> 2 AND <> 7\`.`,
      commonMistakes: ['Forgetting that NOT IN drops NULLs.', 'Writing `<> a OR <> b`, which is always true.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q09', topic: 4, relatedTopics: [1], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: customers without an e-mail',
      prompt: `This query should list the customers who have **no e-mail address** (NULL), but it returns no rows. Fix it.

- **Columns:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sort:** by \`customer_id\`.`,
      starterSql: `SELECT customer_id, first_name, last_name
FROM customers
WHERE email = NULL
ORDER BY customer_id;`,
      hints: ['What does `email = NULL` evaluate to, for every row?'],
      referenceSolution: `SELECT customer_id, first_name, last_name
FROM customers
WHERE email IS NULL
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, first_name, last_name FROM customers WHERE NOT (email IS NOT NULL) ORDER BY 1;`],
      wrongAnswers: [`SELECT customer_id, first_name, last_name FROM customers WHERE email = '' ORDER BY customer_id;`],
      explanation: `\`email = NULL\` compares with an unknown value, so the result is unknown for **every** row, including rows where email is NULL. WHERE keeps nothing.

\`IS NULL\` is the dedicated test. An empty string \`''\` is a real value, not NULL.`,
      commonMistakes: ['Testing for an empty string instead of NULL.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q10', topic: 4, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'E-mails with an underscore',
      prompt: `List customers whose e-mail address contains an **underscore character** (\`_\`).

- **Columns:** \`customer_id\`, \`email\`
- **Sort:** by \`customer_id\`.`,
      hints: ['In LIKE patterns, `_` is a wildcard that matches any single character.', 'Escape it to match a literal underscore: `\'%\\_%\'`.'],
      referenceSolution: `SELECT customer_id, email
FROM customers
WHERE email LIKE '%\\_%'
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id, email FROM customers WHERE email LIKE '%!_%' ESCAPE '!' ORDER BY customer_id;`,
        `SELECT customer_id, email FROM customers WHERE position('_' IN email) > 0 ORDER BY customer_id;`,
      ],
      wrongAnswers: [
        `SELECT customer_id, email FROM customers WHERE email LIKE '%_%' ORDER BY customer_id;`,
        `SELECT customer_id, email FROM customers WHERE email = '_' ORDER BY customer_id;`,
      ],
      explanation: `\`LIKE '%_%'\` means "at least one character": it matches every non-empty e-mail. To look for a literal underscore, escape it. \`\\\` is LIKE's default escape character, so \`'%\\_%'\` works, or declare your own with \`ESCAPE '!'\`.

\`position('_' IN email) > 0\` sidesteps pattern syntax entirely (string functions, Topic 9).`,
      commonMistakes: ['Forgetting that _ is a wildcard in LIKE.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q11', topic: 4, relatedTopics: [1], previewTopics: [5], difficulty: 'hard', type: 'write-query',
      title: 'Orders shipped somewhere unexpected',
      prompt: `Find orders whose **shipping country differs from the customer's home country**, where "differs" also covers one side being NULL and the other not. If **both** are NULL, the order does *not* count as different.

- **Columns:** \`order_id\`, \`customer_country_id\` (the customer's \`country_id\`), \`ship_country_id\`
- **Sort:** by \`order_id\`.`,
      hints: ['Join each order to its customer: `FROM orders o JOIN customers c ON c.customer_id = o.customer_id`.', '`<>` yields NULL if either side is NULL. You need a NULL-safe comparison.', '`a IS DISTINCT FROM b`'],
      referenceSolution: `SELECT o.order_id,
       c.country_id AS customer_country_id,
       o.ship_country_id
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.ship_country_id IS DISTINCT FROM c.country_id
ORDER BY o.order_id;`,
      alternativeSolutions: [
        `SELECT o.order_id, c.country_id AS customer_country_id, o.ship_country_id FROM orders o JOIN customers c USING (customer_id)
WHERE o.ship_country_id <> c.country_id OR (o.ship_country_id IS NULL) <> (c.country_id IS NULL) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT o.order_id, c.country_id AS customer_country_id, o.ship_country_id FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.ship_country_id <> c.country_id ORDER BY o.order_id;`,
        `SELECT o.order_id, c.country_id AS customer_country_id, o.ship_country_id FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.ship_country_id <> c.country_id OR o.ship_country_id IS NULL ORDER BY o.order_id;`,
      ],
      explanation: `\`IS DISTINCT FROM\` treats NULL as an ordinary value:

| ship | customer | \`<>\` | \`IS DISTINCT FROM\` |
|---|---|---|---|
| 9 | 7 | true | true |
| NULL | 7 | NULL → dropped | **true** |
| 7 | NULL | NULL → dropped | **true** |
| NULL | NULL | NULL | **false** |

Plain \`<>\` misses the half-NULL cases. Patching it with \`OR ship_country_id IS NULL\` covers only one side, and adding both IS NULL tests wrongly includes NULL/NULL pairs. IS DISTINCT FROM gets all four cases right.`,
      commonMistakes: ['Using <>, which loses rows where one side is NULL.', 'Handling only one side being NULL.', 'Treating NULL/NULL as different.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q12', topic: 4, relatedTopics: [1], previewTopics: [11], difficulty: 'hard', type: 'write-query',
      title: 'Orders on a Berlin calendar day',
      prompt: `The Berlin team wants every order placed on **31 March 2024 in Berlin local time** (time zone \`'Europe/Berlin'\`). That night the clocks jumped forward, so this local day was only 23 hours long.

- **Columns:** \`order_id\`, \`ordered_at\` (as stored, UTC)
- **Sort:** by \`order_id\`.`,
      hints: ['A literal with a zone name means local time there: `TIMESTAMPTZ \'2024-03-31 00:00 Europe/Berlin\'`.', 'Use a half-open range from local midnight to the next local midnight.'],
      referenceSolution: `SELECT order_id, ordered_at
FROM orders
WHERE ordered_at >= TIMESTAMPTZ '2024-03-31 00:00 Europe/Berlin'
  AND ordered_at <  TIMESTAMPTZ '2024-04-01 00:00 Europe/Berlin'
ORDER BY order_id;`,
      alternativeSolutions: [
        `SELECT order_id, ordered_at FROM orders WHERE (ordered_at AT TIME ZONE 'Europe/Berlin')::date = DATE '2024-03-31' ORDER BY order_id;`,
        `SELECT order_id, ordered_at FROM orders WHERE ordered_at >= '2024-03-30 23:00+00' AND ordered_at < '2024-03-31 22:00+00' ORDER BY order_id;`,
      ],
      wrongAnswers: [
        `SELECT order_id, ordered_at FROM orders WHERE ordered_at >= '2024-03-31' AND ordered_at < '2024-04-01' ORDER BY order_id;`,
        `SELECT order_id, ordered_at FROM orders WHERE ordered_at >= '2024-03-31 00:00+01' AND ordered_at < '2024-04-01 00:00+01' ORDER BY order_id;`,
      ],
      explanation: `Timestamps are stored as moments in UTC. "31 March in Berlin" is a different window of UTC time:

- local midnight on 31 March is **23:00 UTC on 30 March** (Berlin is UTC+1 in winter),
- local midnight on 1 April is **22:00 UTC on 31 March** (UTC+2 after the clocks change at 02:00 local).

Writing the boundaries as \`TIMESTAMPTZ '… Europe/Berlin'\` lets PostgreSQL apply the correct offset for each one, DST change included. A fixed \`+01\` offset gets the end of the day wrong, and plain UTC dates describe a different day altogether.`,
      commonMistakes: ['Filtering on the UTC calendar day.', 'Using a fixed offset (+01) that ignores the daylight-saving change.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q13', topic: 4, relatedTopics: [1], previewTopics: [9], difficulty: 'hard', type: 'write-query',
      title: 'Customers in New York, however it was typed',
      prompt: `Find the customers who live in **New York**. The \`city\` column was typed by humans, so it might be 'New York', 'new york' or 'New York ' (with a trailing space). Match all of them.

- **Columns:** \`customer_id\`, \`city\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`trim(city)` removes leading and trailing spaces.', 'Compare case-insensitively: `ILIKE`, or `lower(…) = \'new york\'`.'],
      referenceSolution: `SELECT customer_id, city
FROM customers
WHERE lower(trim(city)) = 'new york'
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, city FROM customers WHERE trim(city) ILIKE 'new york' ORDER BY customer_id;`],
      wrongAnswers: [
        `SELECT customer_id, city FROM customers WHERE city = 'New York' ORDER BY customer_id;`,
        `SELECT customer_id, city FROM customers WHERE city ILIKE 'new york' ORDER BY customer_id;`,
      ],
      explanation: `Normalise before comparing: \`trim()\` removes surrounding spaces, and \`lower()\` (or ILIKE) removes case differences. The comparison then matches all three spellings.

Filtering on a function of a column can't use a plain index on that column. If this query were frequent, you'd create an expression index on \`lower(trim(city))\` (Topic 2), or clean the data once.`,
      commonMistakes: ['Exact comparison, which misses the variants.', 'ILIKE without trim, which still misses the trailing-space rows.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q14', topic: 4, relatedTopics: [], difficulty: 'hard', type: 'predict-output',
      title: 'Logic with NULL',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT (NULL AND false)     AS a,
       (NULL OR true)      AS b,
       (NOT NULL::boolean) AS c;`,
      options: [
        { table: { columns: ['a', 'b', 'c'], rows: [[null, null, null]] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['false', 'true', null]] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['false', 'true', 'true']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [[null, 'true', 'false']] } },
      ],
      correctOption: 1,
      hints: ['If one side of AND is false, does it matter what the other side is?'],
      explanation: `Three-valued logic only returns NULL when the unknown value could change the outcome:

- \`NULL AND false\`: AND needs both sides true. One is false, so it's **false**, whatever NULL is.
- \`NULL OR true\`: one side is true, so it's **true**.
- \`NOT NULL\`: the opposite of unknown is still **unknown**.`,
      commonMistakes: ['Assuming any expression with NULL yields NULL.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't04-q15', topic: 4, relatedTopics: [1], difficulty: 'interview', type: 'write-query',
      title: 'Orders that need attention',
      prompt: `Operations wants a list of orders that need attention. An order needs attention if

- it is still **'pending' or 'processing'** and was placed **before 2025-06-20**, **or**
- it is **'shipped'** and left the warehouse (\`shipped_at\`) **before 2025-06-01** (it may be lost in transit),

**and in either case** it was **not** placed through the \`'marketplace'\` channel (marketplace orders are handled by the partner).

- **Columns:** \`order_id\`, \`status\`, \`channel\`, \`ordered_at\`, \`shipped_at\`
- **Sort:** by \`order_id\`.`,
      hints: ['Write each "needs attention" case in its own parentheses, combine them with OR, and wrap the whole OR in parentheses before adding the channel rule with AND.'],
      referenceSolution: `SELECT order_id, status, channel, ordered_at, shipped_at
FROM orders
WHERE (
        (status IN ('pending', 'processing') AND ordered_at < '2025-06-20')
     OR (status = 'shipped' AND shipped_at < '2025-06-01')
      )
  AND channel <> 'marketplace'
ORDER BY order_id;`,
      alternativeSolutions: [
        `SELECT order_id, status, channel, ordered_at, shipped_at FROM orders
WHERE NOT channel = 'marketplace' AND ((status = 'pending' OR status = 'processing') AND ordered_at < DATE '2025-06-20' OR status = 'shipped' AND shipped_at < DATE '2025-06-01')
ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT order_id, status, channel, ordered_at, shipped_at FROM orders
WHERE status IN ('pending', 'processing') AND ordered_at < '2025-06-20' OR status = 'shipped' AND shipped_at < '2025-06-01' AND channel <> 'marketplace' ORDER BY order_id;`,
        `SELECT order_id, status, channel, ordered_at, shipped_at FROM orders
WHERE ((status IN ('pending', 'processing') AND ordered_at < '2025-06-20') OR (status = 'shipped' AND shipped_at < '2025-06-01')) ORDER BY order_id;`,
      ],
      explanation: `Translate the business rule structure directly into parentheses:

\`(caseA OR caseB) AND not-marketplace\`

Without the outer parentheses, AND binds tighter than OR, and the channel rule only applies to the shipped case. Pending marketplace orders then sneak in.

Note that \`shipped_at < '2025-06-01'\` is NULL for orders that were never shipped. That's fine here, because the condition only matters together with \`status = 'shipped'\`.`,
      commonMistakes: ['Leaving out the outer parentheses.', 'Forgetting the marketplace exclusion.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't04-q16', topic: 4, relatedTopics: [1], difficulty: 'interview', type: 'write-query',
      title: 'Phone numbers without an international prefix',
      prompt: `For an SMS campaign, find customers whose **phone number is present** but **not in international format**, i.e. it starts with neither \`+\` nor \`00\`.

- **Columns:** \`customer_id\`, \`phone\`
- **Sort:** by \`customer_id\`.`,
      hints: ['"Starts with" is `LIKE \'+%\'`.', 'Neither A nor B = NOT A AND NOT B (De Morgan).'],
      referenceSolution: `SELECT customer_id, phone
FROM customers
WHERE phone NOT LIKE '+%'
  AND phone NOT LIKE '00%'
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id, phone FROM customers WHERE phone IS NOT NULL AND NOT (phone LIKE '+%' OR phone LIKE '00%') ORDER BY customer_id;`,
        `SELECT customer_id, phone FROM customers WHERE phone !~ '^(\\+|00)' ORDER BY customer_id;`,
      ],
      wrongAnswers: [
        `SELECT customer_id, phone FROM customers WHERE phone NOT LIKE '+%' OR phone NOT LIKE '00%' ORDER BY customer_id;`,
        `SELECT customer_id, phone FROM customers WHERE phone NOT LIKE '+%' ORDER BY customer_id;`,
      ],
      explanation: `"Neither + nor 00" means *not +* **and** *not 00*. With OR, every number passes, because no number starts with both.

NULL phones need no special handling: \`NULL NOT LIKE '+%'\` is unknown, so those rows are dropped automatically. That's exactly what "phone is present" asks for.`,
      commonMistakes: ['Using OR between two negated conditions.', 'Forgetting the 00 prefix.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
