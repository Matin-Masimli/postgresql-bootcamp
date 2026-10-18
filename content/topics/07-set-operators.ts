import type { Topic } from '../types.ts';

const explanation = `Joins put tables **side by side**: more columns. Set operators stack query results **on top of each other** or compare them: more or fewer rows.

| operator | result |
|---|---|
| \`A UNION B\` | rows in A or B, duplicates removed |
| \`A UNION ALL B\` | all rows of A followed by all rows of B, duplicates kept |
| \`A INTERSECT B\` | rows in both A and B |
| \`A EXCEPT B\` | rows in A that are not in B |

\`INTERSECT ALL\` and \`EXCEPT ALL\` keep duplicates by counting them: if a row appears 3 times in A and once in B, \`A EXCEPT ALL B\` returns it twice.

\`\`\`sql
-- Countries where we have customers or suppliers (or both)
SELECT country_id FROM customers WHERE country_id IS NOT NULL
UNION
SELECT country_id FROM suppliers
ORDER BY country_id;
\`\`\`

## The rules

1. Each query must return the **same number of columns**, and the column types must be compatible, matched **by position**, not by name.
2. The output column **names come from the first query**.
3. Rows are compared as a whole, and here **NULLs count as equal** (unlike in \`=\`): two rows \`(1, NULL)\` are duplicates.
4. \`ORDER BY\` and \`LIMIT\` at the end apply to the **whole** result. To sort or limit one branch, wrap it in parentheses.
5. \`INTERSECT\` binds tighter than \`UNION\` and \`EXCEPT\`: \`A UNION B INTERSECT C\` means \`A UNION (B INTERSECT C)\`. Use parentheses.

\`\`\`sql
-- The 2 most and the 2 least expensive products, in one list
(SELECT 'most expensive' AS segment, product_id, price FROM products ORDER BY price DESC, product_id LIMIT 2)
UNION ALL
(SELECT 'cheapest', product_id, price FROM products ORDER BY price, product_id LIMIT 2)
ORDER BY segment, price;
\`\`\`

## UNION or UNION ALL?

\`UNION\` has to sort or hash all rows to remove duplicates. If the branches can't overlap (e.g. each carries a different label), or duplicates are meaningful, **use UNION ALL**. It's faster and doesn't hide rows.

\`\`\`sql
-- One activity feed from three tables: a typical UNION ALL
SELECT ordered_at AS happened_at, 'order' AS kind, order_id AS id FROM orders WHERE customer_id = 7
UNION ALL
SELECT created_at, 'review', review_id FROM reviews WHERE customer_id = 7
UNION ALL
SELECT logged_in_at, 'login', login_id FROM user_logins WHERE customer_id = 7
ORDER BY happened_at
LIMIT 10;
\`\`\`

## EXCEPT and INTERSECT as comparison tools

They compare whole rows, which makes them great for reconciliation: "which (order_id, amount) pairs from system A are missing in system B?", or "which customers ordered in 2023 but not in 2024?".

\`EXCEPT\` is another way to write an anti-join, and \`INTERSECT\` a semi-join. Unlike \`NOT IN\`, they handle NULLs as equal values, but they can only return the compared columns.

## Gotchas

- \`SELECT a, b … UNION SELECT b, a …\`: columns match by **position**. Swapped columns are silently combined if their types fit.
- Mixing types needs a cast: \`SELECT id::text … UNION SELECT code …\` (Topic 8).
- \`EXCEPT\` removes duplicates from the result. \`A EXCEPT B\` lists each surviving row once, even if it appears many times in A.`;

const nonCancelled = (year: number) => `SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '${year}-01-01' AND ordered_at < '${year + 1}-01-01'`;

const topic: Topic = {
  id: 7,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Combining Queries, UNION / INTERSECT / EXCEPT (7.4)', url: 'https://www.postgresql.org/docs/18/queries-union.html' },
    { title: 'PostgreSQL 18: UNION, CASE and related constructs, type resolution (10.5)', url: 'https://www.postgresql.org/docs/18/typeconv-union-case.html' },
    { title: 'Neon PostgreSQL Tutorial: UNION', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-union' },
    { title: 'Neon PostgreSQL Tutorial: EXCEPT', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-except' },
  ],
  questions: [
    {
      id: 't07-q01', topic: 7, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'One list of e-mail addresses',
      prompt: `Build a single list of **all e-mail addresses** we know, from customers (\`email\`) and suppliers (\`contact_email\`). Leave out NULLs, and list each address **once** (exact spelling, no normalisation).

- **Columns:** \`email\`
- **Sort:** by \`email\`.`,
      hints: ['Two SELECTs combined with UNION, which removes duplicates.', 'The output column name comes from the first SELECT.'],
      referenceSolution: `SELECT email FROM customers WHERE email IS NOT NULL
UNION
SELECT contact_email FROM suppliers WHERE contact_email IS NOT NULL
ORDER BY email;`,
      alternativeSolutions: [`SELECT DISTINCT email FROM (SELECT email FROM customers UNION ALL SELECT contact_email FROM suppliers) AS t WHERE email IS NOT NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT email FROM customers WHERE email IS NOT NULL UNION ALL SELECT contact_email FROM suppliers WHERE contact_email IS NOT NULL ORDER BY email;`,
        `SELECT email FROM customers UNION SELECT contact_email FROM suppliers ORDER BY email;`,
      ],
      explanation: `\`UNION\` stacks the two lists and removes duplicates. Some customers share an exact address, so UNION ALL would list those twice.

The NULL filter must be in **both** branches, because each WHERE applies only to its own SELECT. Without it, a single NULL row survives (UNION treats NULLs as duplicates of each other, so only one remains).`,
      commonMistakes: ['UNION ALL keeps duplicates.', 'Filtering NULLs in only one branch, or not at all.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q02', topic: 7, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'UNION or UNION ALL?',
      prompt: `You combine this month's orders from two **separate shop databases** into one report. An order can never be in both, and every row must be shown. Which operator should you use, and why?`,
      options: [
        { text: '`UNION`, because it is the safer default.' },
        { text: '`UNION ALL`: no duplicates are possible, so the extra de-duplication work of UNION is wasted (and it could hide legitimately identical rows).' },
        { text: '`INTERSECT`, because it keeps rows from both.' },
        { text: '`EXCEPT`, because the sets don\'t overlap.' },
      ],
      correctOption: 1,
      hints: ['What extra work does UNION do compared to UNION ALL?'],
      explanation: `UNION removes duplicate rows, which needs a sort or hash over the whole result. When duplicates can't occur, or *are* meaningful (two identical lines), UNION ALL is both faster and more correct. INTERSECT keeps only rows present in **both** inputs.`,
      commonMistakes: ['Using UNION by default and silently losing identical rows.'],
    },
    {
      id: 't07-q03', topic: 7, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Countries with customers or suppliers',
      prompt: `List the ids of all countries that have **at least one customer or at least one supplier**.

- **Columns:** \`country_id\`
- **Sort:** by \`country_id\`.`,
      hints: ['Customers can have a NULL country. Exclude it.'],
      referenceSolution: `SELECT country_id FROM customers WHERE country_id IS NOT NULL
UNION
SELECT country_id FROM suppliers WHERE country_id IS NOT NULL
ORDER BY country_id;`,
      alternativeSolutions: [`SELECT c.country_id FROM countries c WHERE EXISTS (SELECT 1 FROM customers cu WHERE cu.country_id = c.country_id) OR EXISTS (SELECT 1 FROM suppliers s WHERE s.country_id = c.country_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT country_id FROM customers WHERE country_id IS NOT NULL INTERSECT SELECT country_id FROM suppliers ORDER BY country_id;`,
        `SELECT DISTINCT country_id FROM customers WHERE country_id IS NOT NULL ORDER BY country_id;`,
      ],
      explanation: `"Or" between two sets is UNION. Luxembourg has a supplier but no customers, so it only shows up through the second branch.

UNION also de-duplicates *within* each branch, so you don't need DISTINCT.`,
      commonMistakes: ['INTERSECT, which means "and".', 'Forgetting the suppliers.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't07-q04', topic: 7, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'UNION with duplicates and NULLs',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x FROM (VALUES (1), (1), (NULL)) AS a(x)
UNION
SELECT x FROM (VALUES (1), (NULL), (2)) AS b(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x'], rows: [['1'], ['2'], [null]] } },
        { table: { columns: ['x'], rows: [['1'], ['1'], ['1'], ['2'], [null], [null]] } },
        { table: { columns: ['x'], rows: [['1'], ['2']] } },
        { table: { columns: ['x'], rows: [['1'], ['2'], [null], [null]] } },
      ],
      correctOption: 0,
      hints: ['UNION removes duplicates, including duplicates *within* one branch. For set operators, are two NULLs duplicates?'],
      explanation: `UNION removes every duplicate row, within and across branches. For set operators (as for DISTINCT), NULLs **are** considered equal, so only one NULL survives. With ascending ORDER BY, NULL comes last: 1, 2, NULL.`,
      commonMistakes: ['Thinking UNION only removes rows duplicated *across* the two branches.', 'Keeping two NULLs.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't07-q05', topic: 7, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Countries with customers and suppliers',
      prompt: `List the ids of countries that have **both** customers **and** suppliers.

- **Columns:** \`country_id\`
- **Sort:** by \`country_id\`.`,
      hints: ['"Both" between two sets is INTERSECT.'],
      referenceSolution: `SELECT country_id FROM customers
INTERSECT
SELECT country_id FROM suppliers
ORDER BY country_id;`,
      alternativeSolutions: [`SELECT DISTINCT s.country_id FROM suppliers s WHERE EXISTS (SELECT 1 FROM customers c WHERE c.country_id = s.country_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT country_id FROM customers UNION SELECT country_id FROM suppliers ORDER BY country_id;`,
        `SELECT country_id FROM suppliers EXCEPT SELECT country_id FROM customers ORDER BY country_id;`,
      ],
      explanation: `\`INTERSECT\` keeps the rows that occur in both results, once each.

NULL countries need no special handling here: suppliers always have a country, so a customer's NULL has nothing to intersect with. (If both sides had a NULL, INTERSECT *would* return a NULL row, because set operators treat NULLs as equal.)`,
      commonMistakes: ['UNION (either) instead of INTERSECT (both).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q06', topic: 7, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Reviewed but never sold',
      prompt: `Which products have **at least one review** but **never appear on any order line**?

- **Columns:** \`product_id\`
- **Sort:** by \`product_id\`.`,
      hints: ['Products with reviews, EXCEPT products on order lines.'],
      referenceSolution: `SELECT product_id FROM reviews
EXCEPT
SELECT product_id FROM order_items
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT DISTINCT r.product_id FROM reviews r WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = r.product_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id FROM order_items EXCEPT SELECT product_id FROM reviews ORDER BY product_id;`,
        `SELECT product_id FROM reviews INTERSECT SELECT product_id FROM order_items ORDER BY product_id;`,
      ],
      explanation: `\`A EXCEPT B\` keeps rows of A that don't occur in B, and order matters: \`order_items EXCEPT reviews\` answers the opposite question ("sold but never reviewed").

EXCEPT also removes duplicates, so a product with many reviews appears once. The practice data deliberately contains a never-sold product with a review.`,
      commonMistakes: ['Swapping the two sides of EXCEPT.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q07', topic: 7, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Leap-day activity feed',
      prompt: `Build an activity feed of everything that happened on **29 February 2024** (UTC): orders placed (\`ordered_at\`), reviews written (\`created_at\`) and returns requested (\`requested_at\`).

- **Columns:** \`happened_at\`, \`kind\` (\`'order'\`, \`'review'\` or \`'return'\`), \`id\` (the row's primary key)
- **Sort:** by \`happened_at\`, then \`kind\`, then \`id\`.`,
      hints: ['One SELECT per table, each producing the same three columns, combined with UNION ALL.', 'Filter each branch to the day with a half-open range.'],
      referenceSolution: `SELECT ordered_at AS happened_at, 'order' AS kind, order_id AS id
FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01'
UNION ALL
SELECT created_at, 'review', review_id
FROM reviews WHERE created_at >= '2024-02-29' AND created_at < '2024-03-01'
UNION ALL
SELECT requested_at, 'return', return_id
FROM returns WHERE requested_at >= '2024-02-29' AND requested_at < '2024-03-01'
ORDER BY happened_at, kind, id;`,
      alternativeSolutions: [
        `SELECT * FROM (
  SELECT ordered_at AS happened_at, 'order' AS kind, order_id AS id FROM orders
  UNION ALL SELECT created_at, 'review', review_id FROM reviews
  UNION ALL SELECT requested_at, 'return', return_id FROM returns
) AS feed
WHERE happened_at >= '2024-02-29' AND happened_at < '2024-03-01'
ORDER BY 1, 2, 3;`,
      ],
      wrongAnswers: [
        `SELECT ordered_at AS happened_at, 'order' AS kind, order_id AS id FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01'
UNION ALL SELECT created_at, 'review', review_id FROM reviews WHERE created_at >= '2024-02-29' AND created_at < '2024-03-01'
ORDER BY happened_at, kind, id;`,
        `SELECT ordered_at AS happened_at, 'order' AS kind, order_id AS id FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01'
UNION ALL SELECT created_at, 'review', review_id FROM reviews
UNION ALL SELECT requested_at, 'return', return_id FROM returns
ORDER BY happened_at, kind, id;`,
      ],
      explanation: `Different tables, one shape: each branch returns \`(timestamp, text, integer)\`. The constant \`'order'\` / \`'review'\` / \`'return'\` column tells the rows apart. With such a label, rows can't collide, so UNION ALL is the right choice.

Each branch needs its own WHERE, because a WHERE belongs to one SELECT. Alternatively, union everything inside a subquery and filter once outside. The final ORDER BY sorts the combined feed.`,
      commonMistakes: ['Leaving a branch out.', 'Filtering only the first branch.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q08', topic: 7, relatedTopics: [1], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: a contacts directory',
      prompt: `This query should list every **customer and supplier** as \`(id, name)\`, with customers named as \`first_name || ' ' || last_name\` and suppliers by \`name\`. It fails. Fix it.

- **Columns:** \`id\`, \`name\`
- **Sort:** by \`name\`, then \`id\`. Keep duplicates (use UNION ALL).`,
      starterSql: `SELECT customer_id AS id, first_name || ' ' || last_name AS name FROM customers
UNION ALL
SELECT supplier_id FROM suppliers
ORDER BY name, id;`,
      hints: ['Read the error: how many columns does each branch return?'],
      referenceSolution: `SELECT customer_id AS id, first_name || ' ' || last_name AS name FROM customers
UNION ALL
SELECT supplier_id, name FROM suppliers
ORDER BY name, id;`,
      alternativeSolutions: [`SELECT customer_id AS id, concat(first_name, ' ', last_name) AS name FROM customers UNION ALL SELECT supplier_id AS id, name FROM suppliers ORDER BY 2, 1;`],
      wrongAnswers: [`SELECT customer_id AS id, first_name || ' ' || last_name AS name FROM customers UNION ALL SELECT supplier_id, contact_email FROM suppliers ORDER BY name, id;`],
      explanation: `Error: *each UNION query must have the same number of columns*. The supplier branch returned only the id. Add the name.

Column names come from the first branch (\`id\`, \`name\`), so the supplier branch doesn't need aliases.`,
      commonMistakes: ['Matching the column count with the wrong column.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q09', topic: 7, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Customers who stopped buying',
      prompt: `Find customers who placed at least one **non-cancelled** order in **2023** but **none** in **2024** (UTC years).

- **Columns:** \`customer_id\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Customers active in 2023, EXCEPT customers active in 2024.', 'Both sets must exclude cancelled orders.'],
      referenceSolution: `${nonCancelled(2023)}
EXCEPT
${nonCancelled(2024)}
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT DISTINCT o.customer_id FROM orders o WHERE o.status <> 'cancelled' AND o.ordered_at >= '2023-01-01' AND o.ordered_at < '2024-01-01'
AND NOT EXISTS (SELECT 1 FROM orders o2 WHERE o2.customer_id = o.customer_id AND o2.status <> 'cancelled' AND o2.ordered_at >= '2024-01-01' AND o2.ordered_at < '2025-01-01') ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT customer_id FROM orders WHERE ordered_at >= '2023-01-01' AND ordered_at < '2024-01-01' EXCEPT SELECT customer_id FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01' ORDER BY customer_id;`,
        `${nonCancelled(2024)} EXCEPT ${nonCancelled(2023)} ORDER BY customer_id;`,
      ],
      explanation: `EXCEPT expresses "in this set but not in that one" directly, and it de-duplicates (customers with many 2023 orders appear once).

The cancelled filter changes the meaning on both sides. A customer whose only 2024 order was cancelled *did* stop buying, but without the filter they'd be treated as active.`,
      commonMistakes: ['Ignoring cancelled orders.', 'Reversing the sides (that finds new customers).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q10', topic: 7, relatedTopics: [1], difficulty: 'medium', type: 'predict-output',
      title: 'Which operator goes first?',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT 1 AS x
UNION
SELECT 2
INTERSECT
SELECT 3
ORDER BY x;`,
      options: [
        { table: { columns: ['x'], rows: [] } },
        { table: { columns: ['x'], rows: [['1']] } },
        { table: { columns: ['x'], rows: [['1'], ['2']] } },
        { table: { columns: ['x'], rows: [['1'], ['2'], ['3']] } },
      ],
      correctOption: 1,
      hints: ['INTERSECT binds tighter than UNION, like multiplication before addition.'],
      explanation: `INTERSECT is evaluated first: \`SELECT 2 INTERSECT SELECT 3\` is empty. Then \`SELECT 1 UNION (empty)\` = {1}.

Reading it strictly left to right, \`(1 UNION 2) INTERSECT 3\`, would give an empty result. When mixing operators, add parentheses so nobody has to remember the precedence.`,
      commonMistakes: ['Evaluating set operators strictly left to right.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't07-q11', topic: 7, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Cheapest three and priciest three',
      prompt: `Show the **3 cheapest** and the **3 most expensive** products **still on sale** (\`discontinued_at IS NULL\`) in one list. Ties in price are broken by \`product_id\` (lower first).

- **Columns:** \`segment\` (\`'cheapest'\` or \`'priciest'\`), \`product_id\`, \`price\`
- **Sort:** by \`segment\`, then \`price\`, then \`product_id\`. 6 rows.`,
      hints: ['Each branch needs its own ORDER BY … LIMIT 3. Wrap each branch in parentheses.', 'The final ORDER BY sorts the combined result.'],
      referenceSolution: `(SELECT 'cheapest' AS segment, product_id, price
 FROM products WHERE discontinued_at IS NULL
 ORDER BY price, product_id LIMIT 3)
UNION ALL
(SELECT 'priciest', product_id, price
 FROM products WHERE discontinued_at IS NULL
 ORDER BY price DESC, product_id LIMIT 3)
ORDER BY segment, price, product_id;`,
      alternativeSolutions: [
        `SELECT * FROM (SELECT 'cheapest' AS segment, product_id, price FROM products WHERE discontinued_at IS NULL ORDER BY price, product_id LIMIT 3) a
UNION ALL
SELECT * FROM (SELECT 'priciest', product_id, price FROM products WHERE discontinued_at IS NULL ORDER BY price DESC, product_id LIMIT 3) b
ORDER BY 1, 3, 2;`,
      ],
      wrongAnswers: [
        `SELECT 'cheapest' AS segment, product_id, price FROM products WHERE discontinued_at IS NULL UNION ALL SELECT 'priciest', product_id, price FROM products WHERE discontinued_at IS NULL ORDER BY segment, price, product_id LIMIT 6;`,
        `(SELECT 'cheapest' AS segment, product_id, price FROM products ORDER BY price, product_id LIMIT 3) UNION ALL (SELECT 'priciest', product_id, price FROM products ORDER BY price DESC, product_id LIMIT 3) ORDER BY segment, price, product_id;`,
      ],
      explanation: `A trailing ORDER BY / LIMIT belongs to the **whole** set operation. To limit each branch separately, put the branch in parentheses with its own ORDER BY and LIMIT (or use subqueries in FROM).

The first wrong answer limits the combined list, so it returns the 6 cheapest "cheapest" rows, and no priciest ones at all.`,
      commonMistakes: ['A single LIMIT on the combined result.', 'Forgetting the on-sale filter.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q12', topic: 7, relatedTopics: [1, 4], previewTopics: [9], difficulty: 'hard', type: 'write-query',
      title: 'E-mails only on one side',
      prompt: `Compare the e-mail addresses in \`staging_customer_import\` with those in \`customers\`, after normalising both with \`lower(trim(email))\` and ignoring NULLs and addresses without an \`@\`.

Return the addresses that exist on **only one side**, labelled with where they were found.

- **Columns:** \`found_in\` (\`'staging only'\` or \`'customers only'\`), \`email\` (normalised)
- **Sort:** by \`found_in\`, then \`email\`.`,
      hints: ['Two EXCEPTs: staging minus customers, and customers minus staging.', 'Add the label *after* the EXCEPT (wrap each EXCEPT in a subquery), or the label would be compared too.'],
      referenceSolution: `SELECT 'staging only' AS found_in, email FROM (
  SELECT lower(trim(email)) AS email FROM staging_customer_import WHERE email LIKE '%@%'
  EXCEPT
  SELECT lower(trim(email)) FROM customers WHERE email LIKE '%@%'
) AS s
UNION ALL
SELECT 'customers only', email FROM (
  SELECT lower(trim(email)) AS email FROM customers WHERE email LIKE '%@%'
  EXCEPT
  SELECT lower(trim(email)) FROM staging_customer_import WHERE email LIKE '%@%'
) AS c
ORDER BY found_in, email;`,
      alternativeSolutions: [
        `WITH s AS (SELECT DISTINCT lower(trim(email)) AS email FROM staging_customer_import WHERE email LIKE '%@%'),
c AS (SELECT DISTINCT lower(trim(email)) AS email FROM customers WHERE email LIKE '%@%')
SELECT CASE WHEN c.email IS NULL THEN 'staging only' ELSE 'customers only' END AS found_in, coalesce(s.email, c.email) AS email
FROM s FULL JOIN c ON c.email = s.email
WHERE s.email IS NULL OR c.email IS NULL
ORDER BY 1, 2;`,
      ],
      wrongAnswers: [
        `SELECT 'staging only' AS found_in, email FROM (SELECT email FROM staging_customer_import WHERE email LIKE '%@%' EXCEPT SELECT email FROM customers WHERE email LIKE '%@%') AS s
UNION ALL SELECT 'customers only', email FROM (SELECT email FROM customers WHERE email LIKE '%@%' EXCEPT SELECT email FROM staging_customer_import WHERE email LIKE '%@%') AS c ORDER BY found_in, email;`,
        `SELECT 'staging only' AS found_in, email FROM (SELECT lower(trim(email)) AS email FROM staging_customer_import WHERE email LIKE '%@%' EXCEPT SELECT lower(trim(email)) FROM customers WHERE email LIKE '%@%') AS s ORDER BY found_in, email;`,
      ],
      explanation: `The **symmetric difference** of two sets is (A − B) ∪ (B − A). Two details matter:

1. **Normalise first.** Comparing raw strings treats 'Anna@X.com' and 'anna@x.com' as different addresses.
2. **Label after comparing.** If the label were part of each EXCEPT branch, the rows would never match (the labels differ). So each EXCEPT goes in a subquery, and the label is added outside.

The FULL JOIN alternative is the join-based way to compare two lists.`,
      commonMistakes: ['Comparing un-normalised e-mails.', 'Returning only one direction.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q13', topic: 7, relatedTopics: [1, 4], previewTopics: [9], difficulty: 'hard', type: 'write-query',
      title: 'Surplus copies in the import',
      prompt: `In \`staging_customer_import\`, consider the normalised addresses \`lower(trim(email))\` of rows whose email contains an \`@\`. An address that occurs *n* times has *n − 1* **surplus copies**.

Return each address **once per surplus copy** (an address occurring 3 times appears twice; one occurring once doesn't appear).

- **Columns:** \`email\`
- **Sort:** by \`email\`.`,
      hints: ['`EXCEPT ALL` subtracts occurrences: n copies minus 1 copy leaves n − 1.', 'Subtract the *distinct* list of addresses from the full list.'],
      referenceSolution: `SELECT lower(trim(email)) AS email FROM staging_customer_import WHERE email LIKE '%@%'
EXCEPT ALL
SELECT DISTINCT lower(trim(email)) FROM staging_customer_import WHERE email LIKE '%@%'
ORDER BY email;`,
      alternativeSolutions: [
        `SELECT email FROM (SELECT lower(trim(email)) AS email, ROW_NUMBER() OVER (PARTITION BY lower(trim(email))) AS n FROM staging_customer_import WHERE email LIKE '%@%') t WHERE n > 1 ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT lower(trim(email)) AS email FROM staging_customer_import WHERE email LIKE '%@%' EXCEPT SELECT DISTINCT lower(trim(email)) FROM staging_customer_import WHERE email LIKE '%@%' ORDER BY email;`,
        `SELECT DISTINCT lower(trim(email)) AS email FROM staging_customer_import WHERE email LIKE '%@%' ORDER BY email;`,
      ],
      explanation: `With \`ALL\`, set operators count occurrences: \`A EXCEPT ALL B\` removes one occurrence from A for every occurrence in B. Subtracting the distinct list (one of each) leaves exactly the surplus copies.

Plain \`EXCEPT\` works on *distinct* rows. Every address of A is also in B, so it returns nothing.`,
      commonMistakes: ['EXCEPT without ALL, which returns nothing.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q14', topic: 7, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Managers earning 85k or less',
      prompt: `List the ids of employees who **manage at least one other employee** but whose own **salary is 85 000 or less**.

- **Columns:** \`employee_id\`
- **Sort:** by \`employee_id\`.`,
      hints: ['"Is a manager" = appears in `manager_id`. Note that `manager_id` contains a NULL (the CEO\'s).', 'Managers EXCEPT employees earning more than 85 000.'],
      referenceSolution: `SELECT manager_id AS employee_id FROM employees WHERE manager_id IS NOT NULL
EXCEPT
SELECT employee_id FROM employees WHERE salary > 85000
ORDER BY employee_id;`,
      alternativeSolutions: [`SELECT m.employee_id FROM employees m WHERE m.salary <= 85000 AND EXISTS (SELECT 1 FROM employees e WHERE e.manager_id = m.employee_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT manager_id AS employee_id FROM employees EXCEPT SELECT employee_id FROM employees WHERE salary > 85000 ORDER BY employee_id;`,
        `SELECT employee_id FROM employees WHERE salary <= 85000 ORDER BY employee_id;`,
      ],
      explanation: `The set of managers is the distinct non-NULL \`manager_id\` values. EXCEPT then removes those earning more than 85 000. "85 000 or less" stays in, so the subtracted set is \`> 85000\`. Forgetting the manager part returns every low earner, most of whom manage nobody.

The CEO's NULL \`manager_id\` would otherwise survive EXCEPT as a NULL row: nothing on the right side equals it.`,
      commonMistakes: ['Leaving the NULL in, which adds a NULL row.', 'Forgetting the "manages someone" condition, which returns every low earner.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q15', topic: 7, relatedTopics: [1, 4, 5], previewTopics: [14], difficulty: 'interview', type: 'write-query',
      title: 'Reconcile orders against payments',
      prompt: `For **delivered** orders, compare two independent numbers:

- the **order value**: \`ROUND(SUM(quantity * unit_price * (1 - discount)) + shipping_fee, 2)\`;
- the **captured amount**: the sum of the order's payments with \`status = 'captured'\`.

Using **EXCEPT**, list the \`(order_id, order_value)\` pairs that have **no identical \`(order_id, amount)\` pair** on the payment side.

- **Columns:** \`order_id\`, \`order_value\`
- **Sort:** by \`order_id\`.`,
      hints: ['Build both sides as grouped queries that return two columns each.', 'EXCEPT compares whole rows: (order_id, value) vs (order_id, captured).'],
      referenceSolution: `SELECT o.order_id, ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) + o.shipping_fee, 2) AS order_value
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status = 'delivered'
GROUP BY o.order_id, o.shipping_fee
EXCEPT
SELECT order_id, SUM(amount)
FROM payments
WHERE status = 'captured'
GROUP BY order_id
ORDER BY order_id;`,
      alternativeSolutions: [
        `WITH v AS (SELECT o.order_id, round(sum(oi.quantity * oi.unit_price * (1 - oi.discount)) + o.shipping_fee, 2) AS order_value FROM orders o JOIN order_items oi USING (order_id) WHERE o.status = 'delivered' GROUP BY 1, o.shipping_fee),
p AS (SELECT order_id, sum(amount) AS paid FROM payments WHERE status = 'captured' GROUP BY 1)
SELECT v.order_id, v.order_value FROM v LEFT JOIN p USING (order_id) WHERE p.paid IS DISTINCT FROM v.order_value ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT o.order_id, ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS order_value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' GROUP BY o.order_id
EXCEPT SELECT order_id, SUM(amount) FROM payments WHERE status = 'captured' GROUP BY order_id ORDER BY order_id;`,
        `SELECT o.order_id, ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) + o.shipping_fee, 2) AS order_value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' GROUP BY o.order_id, o.shipping_fee
EXCEPT SELECT order_id, SUM(amount) FROM payments GROUP BY order_id ORDER BY order_id;`,
      ],
      explanation: `EXCEPT is a compact reconciliation tool: whole-row comparison means "same order, same amount" in one step, and orders that are missing from the payment side entirely come out too.

Getting each side right is the real work:

- the shipping fee is added **once** per order (group by it, don't sum it per line);
- only **captured** payments count. Failed attempts and refunds would distort the sum.

The result is the deliberately underpaid orders in the practice data. The LEFT JOIN + \`IS DISTINCT FROM\` alternative does the same comparison with a join.`,
      commonMistakes: ['Forgetting the shipping fee.', 'Summing all payments instead of captured ones.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't07-q16', topic: 7, relatedTopics: [1, 4], difficulty: 'interview', type: 'write-query',
      title: 'Active in every quarter of 2024',
      prompt: `Find the customers who placed at least one **non-cancelled** order in **each of the four quarters of 2024** (Q1 = Jan–Mar, …, UTC).

- **Columns:** \`customer_id\`
- **Sort:** by \`customer_id\`.`,
      hints: ['One set per quarter, combined with INTERSECT.', 'Quarter boundaries as half-open ranges: Q1 is `>= \'2024-01-01\' AND < \'2024-04-01\'`.'],
      referenceSolution: `SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-01-01' AND ordered_at < '2024-04-01'
INTERSECT
SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-04-01' AND ordered_at < '2024-07-01'
INTERSECT
SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-07-01' AND ordered_at < '2024-10-01'
INTERSECT
SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-10-01' AND ordered_at < '2025-01-01'
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01'
GROUP BY customer_id HAVING count(DISTINCT extract(quarter FROM ordered_at)) = 4 ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-01-01' AND ordered_at < '2024-04-01'
UNION SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-04-01' AND ordered_at < '2024-07-01'
UNION SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-07-01' AND ordered_at < '2024-10-01'
UNION SELECT customer_id FROM orders WHERE status <> 'cancelled' AND ordered_at >= '2024-10-01' AND ordered_at < '2025-01-01' ORDER BY customer_id;`,
        `SELECT customer_id FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2024-04-01'
INTERSECT SELECT customer_id FROM orders WHERE ordered_at >= '2024-04-01' AND ordered_at < '2024-07-01'
INTERSECT SELECT customer_id FROM orders WHERE ordered_at >= '2024-07-01' AND ordered_at < '2024-10-01'
INTERSECT SELECT customer_id FROM orders WHERE ordered_at >= '2024-10-01' AND ordered_at < '2025-01-01' ORDER BY customer_id;`,
      ],
      explanation: `"In every quarter" means the customer is a member of all four quarter sets, which is their intersection. Each branch applies the cancelled filter and its own half-open date range.

The GROUP BY alternative (Topic 14) counts distinct quarters per customer and keeps those with 4. It scales better to "every month" (12 branches would be tedious).`,
      commonMistakes: ['UNION (any quarter) instead of INTERSECT (every quarter).', 'Counting cancelled orders.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
