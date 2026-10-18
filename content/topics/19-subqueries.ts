import type { Topic } from '../types.ts';

const explanation = `A **subquery** is a SELECT inside another statement, in parentheses. It lets one query use the answer of another: "orders above the *average* fee", "customers who *exist* in the 2025 orders".

## Where subqueries go

| kind | returns | used as |
|---|---|---|
| **scalar** | one row, one column | a value: \`WHERE price > (SELECT avg(price) FROM products)\` |
| **row** | one row, several columns | \`WHERE (a, b) = (SELECT x, y …)\` |
| **table / derived table** | any rows | \`FROM (SELECT …) AS t\` (an alias is required), \`IN (SELECT …)\` |
| **EXISTS** | true/false | \`WHERE EXISTS (SELECT 1 FROM … WHERE …)\` |

A scalar subquery that returns **no rows** yields NULL. One that returns **more than one row** is an error (*more than one row returned by a subquery used as an expression*).

\`\`\`sql
SELECT product_id, name, price
FROM products
WHERE price > (SELECT avg(price) FROM products)
ORDER BY price DESC
LIMIT 5;
\`\`\`

## Correlated subqueries

A subquery can refer to the **outer row**. It's then evaluated (logically) once per outer row:

\`\`\`sql
-- Products priced above the average of their own category
SELECT p.product_id, p.category_id, p.price
FROM products p
WHERE p.price > (SELECT avg(p2.price)
                 FROM products p2
                 WHERE p2.category_id = p.category_id)
ORDER BY p.category_id, p.product_id
LIMIT 8;
\`\`\`

The planner often rewrites them into joins, but think of them as "for each row, ask this question".

## IN, EXISTS and the NOT IN trap

- \`x IN (SELECT …)\`: true if x equals any returned value.
- \`EXISTS (SELECT …)\`: true if the subquery returns at least one row. The select list doesn't matter (\`SELECT 1\` is customary).
- \`NOT IN\` with a NULL in the list is **never true**: \`3 NOT IN (1, NULL)\` means \`3 <> 1 AND 3 <> NULL\`, which is unknown. So a single NULL makes NOT IN return no rows at all. \`NOT EXISTS\` doesn't have this problem, so prefer it.

\`\`\`sql
SELECT 3 NOT IN (1, 2)    AS without_null,
       3 NOT IN (1, NULL) AS with_null;
\`\`\`

## ANY / SOME and ALL

\`x > ANY (subquery)\`: greater than at least one value. \`x > ALL (subquery)\`: greater than every value. \`= ANY\` is the same as IN, \`<> ALL\` the same as NOT IN (including the NULL trap). Over an **empty** subquery, ALL is true and ANY is false.

## Subqueries versus joins and windows

- A **join** is right when you need columns from the other table. When you only need to *test* existence, a join can multiply rows (one per match), and EXISTS/IN don't.
- Per-group comparisons ("above my category's average") can be written as correlated subqueries, as a join to a grouped derived table, or with a window function (Topic 15). The derived-table and window forms are usually faster on large data.
- To filter on a **window function or an aggregate of an aggregate**, wrap the query in a derived table and filter outside, which you've done since Topic 15.`;

const topic: Topic = {
  id: 19,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Subquery Expressions (9.24)', url: 'https://www.postgresql.org/docs/18/functions-subquery.html' },
    { title: 'PostgreSQL 18: Scalar Subqueries (4.2.11)', url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SQL-SYNTAX-SCALAR-SUBQUERIES' },
    { title: 'PostgreSQL 18: Subqueries in FROM (7.2.1.3)', url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-SUBQUERIES' },
    { title: 'PostgreSQL 18: Row and Array Comparisons (9.25)', url: 'https://www.postgresql.org/docs/18/functions-comparisons.html' },
    { title: 'Neon PostgreSQL Tutorial: Subquery', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-subquery' },
  ],
  questions: [
    {
      id: 't19-q01', topic: 19, relatedTopics: [1, 4, 14], difficulty: 'easy', type: 'write-query',
      title: 'Above-average shipping fee',
      prompt: `List the orders placed in **June 2025** whose shipping fee is **higher than the average shipping fee of all orders** (all time).

- **Columns:** \`order_id\`, \`shipping_fee\`
- **Sort:** by \`order_id\`.`,
      hints: ['A scalar subquery: `(SELECT avg(shipping_fee) FROM orders)`.'],
      referenceSolution: `SELECT order_id, shipping_fee
FROM orders
WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01'
  AND shipping_fee > (SELECT avg(shipping_fee) FROM orders)
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT o.order_id, o.shipping_fee FROM orders o CROSS JOIN (SELECT avg(shipping_fee) AS a FROM orders) s WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' AND o.shipping_fee > s.a ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, shipping_fee FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' AND shipping_fee > (SELECT avg(shipping_fee) FROM orders WHERE shipping_fee > 0) ORDER BY order_id;`,
      ],
      explanation: `You can't write \`WHERE shipping_fee > avg(shipping_fee)\`, because aggregates aren't allowed in WHERE. A scalar subquery computes the average first and the outer query compares each row with it.

The subquery has its own FROM and WHERE: it averages **all** orders here, independently of the outer June filter. Averaging only the orders with a non-zero fee raises the bar and answers a different question.`,
      commonMistakes: ['Adding filters to the subquery that the task doesn\'t ask for.', 'Trying to use avg() directly in WHERE.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q02', topic: 19, relatedTopics: [1, 4], difficulty: 'easy', type: 'concept-mc',
      title: 'A scalar subquery with many rows',
      prompt: `What happens when you run this?

\`\`\`sql
SELECT name, (SELECT price FROM products p WHERE p.category_id = c.category_id) AS price
FROM categories c;
\`\`\``,
      options: [
        { text: 'It returns one row per product' },
        { text: 'It returns the first product\'s price for each category' },
        { text: 'It fails as soon as a category has more than one product: a scalar subquery may return at most one row' },
        { text: 'It returns NULL for categories with several products' },
      ],
      correctOption: 2,
      hints: ['A subquery used as a value must produce a single value.'],
      explanation: `A subquery in the SELECT list is a **scalar** subquery: at most one row, one column. Zero rows give NULL, but two or more raise *more than one row returned by a subquery used as an expression*. Aggregate inside it (\`SELECT max(price) …\`) or use a join if you really want one row per product.`,
      commonMistakes: ['Expecting PostgreSQL to pick a row silently.'],
    },
    {
      id: 't19-q03', topic: 19, relatedTopics: [1, 4, 5], difficulty: 'easy', type: 'write-query',
      title: 'Customers who bought a laptop',
      prompt: `List the customers who have **ever ordered a product from the \`laptops\` category** (category slug \`'laptops'\`, any order status). Each customer once.

- **Columns:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`WHERE customer_id IN (SELECT o.customer_id FROM orders o JOIN order_items … JOIN products … JOIN categories … WHERE slug = \'laptops\')`'],
      referenceSolution: `SELECT customer_id, first_name, last_name
FROM customers
WHERE customer_id IN (
  SELECT o.customer_id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  JOIN products p     ON p.product_id = oi.product_id
  JOIN categories c   ON c.category_id = p.category_id
  WHERE c.slug = 'laptops'
)
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT cu.customer_id, cu.first_name, cu.last_name FROM customers cu WHERE EXISTS (SELECT 1 FROM orders o JOIN order_items oi USING (order_id) JOIN products p USING (product_id) WHERE o.customer_id = cu.customer_id AND p.category_id = (SELECT category_id FROM categories WHERE slug = 'laptops')) ORDER BY 1;`,
        `SELECT DISTINCT cu.customer_id, cu.first_name, cu.last_name FROM customers cu JOIN orders o USING (customer_id) JOIN order_items oi USING (order_id) JOIN products p USING (product_id) JOIN categories c USING (category_id) WHERE c.slug = 'laptops' ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT cu.customer_id, cu.first_name, cu.last_name FROM customers cu JOIN orders o ON o.customer_id = cu.customer_id JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id JOIN categories c ON c.category_id = p.category_id WHERE c.slug = 'laptops' ORDER BY cu.customer_id;`,
      ],
      explanation: `\`IN (subquery)\` only **tests membership**: a customer appears once no matter how many laptops they bought. The plain join returns one row per matching order line, so repeat buyers show up several times. \`DISTINCT\` fixes that, but IN/EXISTS say what you mean.`,
      commonMistakes: ['A join without DISTINCT, which duplicates repeat buyers.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q04', topic: 19, relatedTopics: [1, 12], difficulty: 'easy', type: 'predict-output',
      title: 'A correlated lookup with no match',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT t.x,
       (SELECT v.label FROM (VALUES (1, 'one'), (2, 'two')) AS v(k, label) WHERE v.k = t.x) AS label
FROM (VALUES (1), (3)) AS t(x)
ORDER BY t.x;`,
      options: [
        { table: { columns: ['x', 'label'], rows: [['1', 'one'], ['3', null]] } },
        { table: { columns: ['x', 'label'], rows: [['1', 'one']] } },
        { table: { columns: ['x', 'label'], rows: [['1', 'one'], ['3', 'two']] } },
        { table: { columns: ['x', 'label'], rows: [['1', 'one'], ['3', '']] } },
      ],
      correctOption: 0,
      hints: ['What is the value of a scalar subquery that returns no rows?'],
      explanation: `The subquery is correlated (\`v.k = t.x\`), so it runs once per outer row. For x = 3 it finds no row, and a scalar subquery with no rows is **NULL**. The outer row is not removed: that's the difference from an inner join.`,
      commonMistakes: ['Expecting the outer row to disappear, as with an inner join.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't19-q05', topic: 19, relatedTopics: [1, 4, 14, 15], difficulty: 'medium', type: 'write-query',
      title: 'Above their category average',
      prompt: `List the **on-sale** products whose price is **higher than the average price of the on-sale products in their category**.

- **Columns:** \`product_id\`, \`category_id\`, \`price\`
- **Sort:** by \`category_id\`, then \`price\` (highest first), then \`product_id\`.`,
      hints: ['A correlated subquery: `price > (SELECT avg(p2.price) FROM products p2 WHERE p2.category_id = p.category_id AND …)`.', 'Both the outer query and the subquery need the on-sale filter.'],
      referenceSolution: `SELECT p.product_id, p.category_id, p.price
FROM products p
WHERE p.discontinued_at IS NULL
  AND p.price > (SELECT avg(p2.price)
                 FROM products p2
                 WHERE p2.category_id = p.category_id
                   AND p2.discontinued_at IS NULL)
ORDER BY p.category_id, p.price DESC, p.product_id;`,
      alternativeSolutions: [
        `SELECT p.product_id, p.category_id, p.price FROM products p JOIN (SELECT category_id, avg(price) AS a FROM products WHERE discontinued_at IS NULL GROUP BY 1) c USING (category_id) WHERE p.discontinued_at IS NULL AND p.price > c.a ORDER BY 2, 3 DESC, 1;`,
        `SELECT product_id, category_id, price FROM (SELECT product_id, category_id, price, avg(price) OVER (PARTITION BY category_id) AS a FROM products WHERE discontinued_at IS NULL) t WHERE price > a ORDER BY 2, 3 DESC, 1;`,
      ],
      wrongAnswers: [
        `SELECT p.product_id, p.category_id, p.price FROM products p WHERE p.discontinued_at IS NULL AND p.price > (SELECT avg(p2.price) FROM products p2 WHERE p2.discontinued_at IS NULL) ORDER BY p.category_id, p.price DESC, p.product_id;`,
        `SELECT p.product_id, p.category_id, p.price FROM products p WHERE p.discontinued_at IS NULL AND p.price > (SELECT avg(p2.price) FROM products p2 WHERE p2.category_id = p.category_id) ORDER BY p.category_id, p.price DESC, p.product_id;`,
      ],
      explanation: `\`p2.category_id = p.category_id\` ties the subquery to the outer row: "the average of **this product's** category". Without it you compare with the overall average.

The subquery is a separate query, so the outer \`discontinued_at IS NULL\` doesn't apply inside it. Leave it out of the subquery and discontinued products distort each category's average. The join and window alternatives compute every category average once instead of per row.`,
      commonMistakes: ['An uncorrelated subquery (overall average).', 'Forgetting the on-sale filter inside the subquery.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q06', topic: 19, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Ordered in 2024 and in 2025',
      prompt: `Which customers from **Chile** (\`country_id = 6\`) placed at least one order (any status) in **2024 and** at least one in **2025**?

- **Columns:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Two EXISTS conditions combined with AND, one per year.'],
      referenceSolution: `SELECT c.customer_id, c.first_name, c.last_name
FROM customers c
WHERE c.country_id = 6
  AND EXISTS (SELECT 1 FROM orders o
              WHERE o.customer_id = c.customer_id
                AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01')
  AND EXISTS (SELECT 1 FROM orders o
              WHERE o.customer_id = c.customer_id
                AND o.ordered_at >= '2025-01-01' AND o.ordered_at < '2026-01-01')
ORDER BY c.customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id, first_name, last_name FROM customers WHERE country_id = 6 AND customer_id IN (SELECT customer_id FROM orders WHERE extract(year FROM ordered_at) = 2024 INTERSECT SELECT customer_id FROM orders WHERE extract(year FROM ordered_at) = 2025) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT c.customer_id, c.first_name, c.last_name FROM customers c WHERE c.country_id = 6 AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2026-01-01') ORDER BY c.customer_id;`,
        `SELECT c.customer_id, c.first_name, c.last_name FROM customers c WHERE c.country_id = 6 AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' AND o.ordered_at >= '2025-01-01') ORDER BY c.customer_id;`,
      ],
      explanation: `"An order in 2024 **and** an order in 2025" is about two *different* orders, so it needs two independent tests. A single EXISTS with both date conditions asks for one order that is in both years (impossible, so no rows), and a single EXISTS over 2024–2025 accepts either year.

INTERSECT of the two years' customer lists (Topic 7) expresses the same idea.`,
      commonMistakes: ['Both conditions on the same order row.', 'One range covering both years (OR semantics).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q07', topic: 19, relatedTopics: [1, 4, 12], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: NOT IN returns nothing',
      prompt: `This query should list the customers from **Chile** (\`country_id = 6\`) who **have not referred anybody** (no customer has them as \`referred_by\`). It returns no rows at all. Fix it.

- **Columns:** \`customer_id\`
- **Sort:** by \`customer_id\`.`,
      starterSql: `SELECT customer_id
FROM customers
WHERE country_id = 6
  AND customer_id NOT IN (SELECT referred_by FROM customers)
ORDER BY customer_id;`,
      hints: ['Most customers weren\'t referred: `referred_by` is NULL for them.', 'What is `5 NOT IN (1, 2, NULL)`?'],
      referenceSolution: `SELECT c.customer_id
FROM customers c
WHERE c.country_id = 6
  AND NOT EXISTS (SELECT 1 FROM customers r WHERE r.referred_by = c.customer_id)
ORDER BY c.customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id FROM customers WHERE country_id = 6 AND customer_id NOT IN (SELECT referred_by FROM customers WHERE referred_by IS NOT NULL) ORDER BY 1;`,
        `SELECT c.customer_id FROM customers c LEFT JOIN customers r ON r.referred_by = c.customer_id WHERE c.country_id = 6 AND r.customer_id IS NULL ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT customer_id FROM customers WHERE country_id = 6 AND customer_id NOT IN (SELECT referred_by FROM customers) ORDER BY customer_id;`,
        `SELECT c.customer_id FROM customers c WHERE c.country_id = 6 AND NOT EXISTS (SELECT 1 FROM customers r WHERE r.customer_id = c.referred_by) ORDER BY c.customer_id;`,
      ],
      explanation: `\`x NOT IN (list)\` means x is different from **every** element. If the list contains a NULL, "x <> NULL" is unknown, so the whole condition can never be true and every row is filtered out.

- \`NOT EXISTS\` only asks whether a matching row exists, so NULLs don't matter. This is the robust choice.
- Removing NULLs from the subquery (\`WHERE referred_by IS NOT NULL\`) also fixes NOT IN.

Watch the direction of the correlation: \`r.customer_id = c.referred_by\` asks "was *c* referred by someone?", not "did *c* refer someone?".`,
      commonMistakes: ['NOT IN over a column that contains NULLs.', 'Reversing the correlation.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q08', topic: 19, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Pricier than every tablet',
      prompt: `List the **on-sale** products that are more expensive than **every product** (on sale or not) in the \`tablets\` category (slug \`'tablets'\`).

- **Columns:** \`product_id\`, \`name\`, \`price\`
- **Sort:** by \`price\` (highest first), then \`product_id\`.`,
      hints: ['`price > ALL (SELECT price FROM products WHERE category_id = (SELECT category_id FROM categories WHERE slug = \'tablets\'))`'],
      referenceSolution: `SELECT product_id, name, price
FROM products
WHERE discontinued_at IS NULL
  AND price > ALL (SELECT p.price
                   FROM products p
                   JOIN categories c ON c.category_id = p.category_id
                   WHERE c.slug = 'tablets')
ORDER BY price DESC, product_id;`,
      alternativeSolutions: [`SELECT product_id, name, price FROM products WHERE discontinued_at IS NULL AND price > (SELECT max(price) FROM products WHERE category_id = (SELECT category_id FROM categories WHERE slug = 'tablets')) ORDER BY 3 DESC, 1;`],
      wrongAnswers: [
        `SELECT product_id, name, price FROM products WHERE discontinued_at IS NULL AND price > ANY (SELECT p.price FROM products p JOIN categories c ON c.category_id = p.category_id WHERE c.slug = 'tablets') ORDER BY price DESC, product_id;`,
      ],
      explanation: `\`> ALL (…)\` must beat every value, which is equivalent to beating the maximum. \`> ANY (…)\` only has to beat one of them (i.e. the minimum).

The subquery returns all tablets, discontinued ones included, as the task says. With ALL, keep in mind: a NULL in the list makes the comparison unknown, and an empty list makes it true for everyone.`,
      commonMistakes: ['ANY instead of ALL.', 'Forgetting that a NULL in the list makes > ALL unknown.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q09', topic: 19, relatedTopics: [1, 4, 5, 10, 14], difficulty: 'medium', type: 'write-query',
      title: 'Department figures with scalar subqueries',
      prompt: `For **every** department, show its number of **active** employees and their average salary (2 decimals). Departments without active employees show 0 and NULL.

- **Columns:** \`department_id\`, \`name\`, \`active_staff\`, \`avg_salary\`
- **Sort:** by \`department_id\`.`,
      hints: ['Two correlated scalar subqueries in the SELECT list, each filtered by `e.department_id = d.department_id`.', 'Or a LEFT JOIN with GROUP BY, being careful where the active filter goes.'],
      referenceSolution: `SELECT d.department_id, d.name,
       (SELECT count(*) FROM employees e
        WHERE e.department_id = d.department_id AND e.termination_date IS NULL) AS active_staff,
       (SELECT round(avg(e.salary), 2) FROM employees e
        WHERE e.department_id = d.department_id AND e.termination_date IS NULL) AS avg_salary
FROM departments d
ORDER BY d.department_id;`,
      alternativeSolutions: [`SELECT d.department_id, d.name, count(e.employee_id) AS active_staff, round(avg(e.salary), 2) AS avg_salary FROM departments d LEFT JOIN employees e ON e.department_id = d.department_id AND e.termination_date IS NULL GROUP BY d.department_id ORDER BY 1;`],
      wrongAnswers: [
        `SELECT d.department_id, d.name, count(*) AS active_staff, round(avg(e.salary), 2) AS avg_salary FROM departments d JOIN employees e ON e.department_id = d.department_id WHERE e.termination_date IS NULL GROUP BY d.department_id ORDER BY d.department_id;`,
        `SELECT d.department_id, d.name, count(*) AS active_staff, round(avg(e.salary), 2) AS avg_salary FROM departments d LEFT JOIN employees e ON e.department_id = d.department_id AND e.termination_date IS NULL GROUP BY d.department_id ORDER BY d.department_id;`,
      ],
      explanation: `Scalar subqueries in the SELECT list keep **every** outer row: \`count(*)\` over no rows is 0 and \`avg\` over no rows is NULL. That gives the empty department its 0 for free.

The join version needs a LEFT JOIN with the active filter in the ON clause (in WHERE it would remove the empty department again) and \`count(e.employee_id)\` rather than \`count(*)\`, which would count the NULL-extended row as 1.`,
      commonMistakes: ['An inner join that drops the empty department.', 'count(*) after a LEFT JOIN, which gives 1 instead of 0.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't19-q10', topic: 19, relatedTopics: [1, 4, 12], difficulty: 'medium', type: 'predict-output',
      title: 'IN and NOT IN with a NULL',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT t.x,
       t.x IN     (SELECT y FROM (VALUES (1), (NULL)) AS s(y)) AS in_list,
       t.x NOT IN (SELECT y FROM (VALUES (1), (NULL)) AS s(y)) AS not_in_list
FROM (VALUES (1), (2)) AS t(x)
ORDER BY t.x;`,
      options: [
        { table: { columns: ['x', 'in_list', 'not_in_list'], rows: [['1', 'true', 'false'], ['2', null, null]] } },
        { table: { columns: ['x', 'in_list', 'not_in_list'], rows: [['1', 'true', 'false'], ['2', 'false', 'true']] } },
        { table: { columns: ['x', 'in_list', 'not_in_list'], rows: [['1', null, null], ['2', null, null]] } },
        { table: { columns: ['x', 'in_list', 'not_in_list'], rows: [['1', 'true', 'false'], ['2', 'false', null]] } },
      ],
      correctOption: 0,
      hints: ['`2 IN (1, NULL)` = `2 = 1 OR 2 = NULL`.'],
      explanation: `For x = 1 a match is found, so IN is true and NOT IN is false, whatever else is in the list. For x = 2: \`2 = 1 OR 2 = NULL\` is \`false OR unknown\` = **unknown** (NULL), and NOT IN is the negation of unknown, still NULL. In a WHERE clause, NULL counts as "not true", so \`NOT IN\` would keep neither row.`,
      commonMistakes: ['Expecting NOT IN to be true for 2.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't19-q11', topic: 19, relatedTopics: [1, 4, 5, 11, 14], difficulty: 'hard', type: 'write-query',
      title: 'Spending more than last year',
      prompt: `Find customers whose spend (non-cancelled orders, line values, no shipping) in the **first half of 2025** was higher than in the **first half of 2024**. Customers with no H1 2024 spend are **not** included.

- **Columns:** \`customer_id\`, \`h1_2024\`, \`h1_2025\` (2 decimals)
- **Sort:** by \`customer_id\`.`,
      hints: ['A derived table with one row per customer and two conditional sums (`sum(…) FILTER (WHERE …)`).', 'A sum over no rows is NULL, and `x > NULL` is unknown, which excludes those customers automatically.'],
      referenceSolution: `SELECT customer_id, round(h1_2024, 2) AS h1_2024, round(h1_2025, 2) AS h1_2025
FROM (
  SELECT o.customer_id,
         sum(oi.quantity * oi.unit_price * (1 - oi.discount))
           FILTER (WHERE o.ordered_at >= '2024-01-01' AND o.ordered_at < '2024-07-01') AS h1_2024,
         sum(oi.quantity * oi.unit_price * (1 - oi.discount))
           FILTER (WHERE o.ordered_at >= '2025-01-01' AND o.ordered_at < '2025-07-01') AS h1_2025
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.customer_id
) AS s
WHERE h1_2025 > h1_2024
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id, round(a, 2) AS h1_2024, round(b, 2) AS h1_2025 FROM (SELECT c.customer_id, (SELECT sum(oi.quantity * oi.unit_price * (1 - oi.discount)) FROM orders o JOIN order_items oi USING (order_id) WHERE o.customer_id = c.customer_id AND o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2024-07-01') AS a, (SELECT sum(oi.quantity * oi.unit_price * (1 - oi.discount)) FROM orders o JOIN order_items oi USING (order_id) WHERE o.customer_id = c.customer_id AND o.status <> 'cancelled' AND o.ordered_at >= '2025-01-01' AND o.ordered_at < '2025-07-01') AS b FROM customers c) t WHERE b > a ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT customer_id, round(h1_2024, 2) AS h1_2024, round(h1_2025, 2) AS h1_2025 FROM (SELECT o.customer_id, coalesce(sum(oi.quantity * oi.unit_price * (1 - oi.discount)) FILTER (WHERE o.ordered_at >= '2024-01-01' AND o.ordered_at < '2024-07-01'), 0) AS h1_2024, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) FILTER (WHERE o.ordered_at >= '2025-01-01' AND o.ordered_at < '2025-07-01') AS h1_2025 FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id) AS s WHERE h1_2025 > h1_2024 ORDER BY customer_id;`,
        `SELECT customer_id, round(h1_2024, 2) AS h1_2024, round(h1_2025, 2) AS h1_2025 FROM (SELECT o.customer_id, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) FILTER (WHERE o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01') AS h1_2024, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) FILTER (WHERE o.ordered_at >= '2025-01-01' AND o.ordered_at < '2025-07-01') AS h1_2025 FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id) AS s WHERE h1_2025 > h1_2024 ORDER BY customer_id;`,
      ],
      explanation: `Aggregates can't be compared in WHERE, and you can't compare two of them with HAVING here without repeating them. A **derived table** computes both figures per customer, and the outer WHERE compares them.

NULL does real work here: a customer with no H1 2024 orders has \`h1_2024\` NULL, the comparison is unknown, and the row is excluded, as the task says. Coalescing to 0 would add every new customer. The correlated-subquery alternative gives the same result, but runs two subqueries per customer.`,
      commonMistakes: ['coalesce(…, 0), which counts new customers as growth.', 'Comparing H1 2025 with the whole of 2024.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q12', topic: 19, relatedTopics: [1, 4, 14], difficulty: 'hard', type: 'write-query',
      title: 'Top earners with a row subquery',
      prompt: `List the **active** employees who earn the **highest active salary in their own department** (all of them, if tied). Use a row comparison: \`(department_id, salary) IN (SELECT …)\`.

- **Columns:** \`department_id\`, \`employee_id\`, \`salary\`
- **Sort:** by \`department_id\`, then \`employee_id\`.`,
      hints: ['The subquery returns one row per department: `SELECT department_id, max(salary) … GROUP BY department_id`.'],
      referenceSolution: `SELECT department_id, employee_id, salary
FROM employees
WHERE termination_date IS NULL
  AND (department_id, salary) IN (SELECT department_id, max(salary)
                                  FROM employees
                                  WHERE termination_date IS NULL
                                  GROUP BY department_id)
ORDER BY department_id, employee_id;`,
      alternativeSolutions: [
        `SELECT e.department_id, e.employee_id, e.salary FROM employees e WHERE e.termination_date IS NULL AND e.salary = (SELECT max(m.salary) FROM employees m WHERE m.department_id = e.department_id AND m.termination_date IS NULL) ORDER BY 1, 2;`,
      ],
      wrongAnswers: [
        `SELECT department_id, employee_id, salary FROM employees WHERE termination_date IS NULL AND salary = (SELECT max(salary) FROM employees WHERE termination_date IS NULL) ORDER BY department_id, employee_id;`,
        `SELECT department_id, employee_id, salary FROM employees WHERE termination_date IS NULL AND salary IN (SELECT max(salary) FROM employees WHERE termination_date IS NULL GROUP BY department_id) ORDER BY department_id, employee_id;`,
      ],
      explanation: `\`(department_id, salary) IN (…)\` compares **pairs**: the employee must match the maximum **of their own department**. Comparing the salary alone accepts anyone who happens to earn some other department's maximum, and comparing with the single company-wide maximum finds only one department's top earner.

The subquery needs its own active filter. If a former employee held the department's record salary, no active employee would match.

Note that employees without a department are never returned: \`(NULL, salary) IN (…)\` is unknown.`,
      commonMistakes: ['Comparing salary only.', 'The company-wide maximum instead of each department\'s.', 'Forgetting the active filter inside the subquery.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q13', topic: 19, relatedTopics: [1, 4, 12], difficulty: 'hard', type: 'predict-output',
      title: 'ALL and ANY over nothing',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT 5 > ALL (SELECT 1 WHERE false)         AS all_empty,
       5 > ANY (SELECT 1 WHERE false)         AS any_empty,
       5 > ALL (SELECT y FROM (VALUES (1), (NULL)) AS s(y)) AS all_with_null,
       5 > ANY (SELECT y FROM (VALUES (1), (NULL)) AS s(y)) AS any_with_null;`,
      options: [
        { table: { columns: ['all_empty', 'any_empty', 'all_with_null', 'any_with_null'], rows: [['true', 'false', null, 'true']] } },
        { table: { columns: ['all_empty', 'any_empty', 'all_with_null', 'any_with_null'], rows: [[null, null, null, null]] } },
        { table: { columns: ['all_empty', 'any_empty', 'all_with_null', 'any_with_null'], rows: [['false', 'false', 'true', 'true']] } },
        { table: { columns: ['all_empty', 'any_empty', 'all_with_null', 'any_with_null'], rows: [['true', 'false', 'false', null]] } },
      ],
      correctOption: 0,
      hints: ['ALL is a chain of ANDs and ANY a chain of ORs. What are an empty AND and an empty OR?'],
      explanation: `\`ALL\` = "no value violates it". With no values, nothing violates it, so the result is **true** (an empty AND). \`ANY\` = "some value satisfies it", and with no values it's **false** (an empty OR).

With a NULL in the list: \`5 > 1 AND 5 > NULL\` = \`true AND unknown\` = unknown (NULL), while \`5 > 1 OR 5 > NULL\` = \`true OR unknown\` = true.`,
      commonMistakes: ['Expecting NULL for an empty subquery.', 'Thinking a NULL always makes the result NULL.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't19-q14', topic: 19, relatedTopics: [1, 4, 6], difficulty: 'hard', type: 'write-query',
      title: 'Everything delivered',
      prompt: `Which customers from **Chile** (\`country_id = 6\`) have **at least one order**, and **every one** of their orders has status \`'delivered'\`?

- **Columns:** \`customer_id\`
- **Sort:** by \`customer_id\`.`,
      hints: ['"Every order is delivered" = "no order is not delivered": `NOT EXISTS (… status <> \'delivered\')`.', 'That alone is also true for customers without orders. Add an EXISTS.'],
      referenceSolution: `SELECT c.customer_id
FROM customers c
WHERE c.country_id = 6
  AND EXISTS     (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.status <> 'delivered')
ORDER BY c.customer_id;`,
      alternativeSolutions: [
        `SELECT o.customer_id FROM orders o JOIN customers c USING (customer_id) WHERE c.country_id = 6 GROUP BY 1 HAVING bool_and(o.status = 'delivered') ORDER BY 1;`,
        `SELECT c.customer_id FROM customers c WHERE c.country_id = 6 AND 'delivered' = ALL (SELECT status FROM orders o WHERE o.customer_id = c.customer_id) AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT c.customer_id FROM customers c WHERE c.country_id = 6 AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.status <> 'delivered') ORDER BY c.customer_id;`,
        `SELECT DISTINCT c.customer_id FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE c.country_id = 6 AND o.status = 'delivered' ORDER BY c.customer_id;`,
      ],
      explanation: `"For all" questions are written as "there is no counter-example": NOT EXISTS an order that isn't delivered. But a customer with **no orders** has no counter-example either. That's *vacuous truth*, the same reason \`= ALL\` over an empty set is true. The extra EXISTS requires at least one order.

Filtering to delivered orders and taking DISTINCT customers answers "has *some* delivered order", a much weaker condition.`,
      commonMistakes: ['Forgetting customers without orders (vacuous truth).', '"Some" instead of "all".'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q15', topic: 19, relatedTopics: [1, 4, 14], difficulty: 'interview', type: 'write-query',
      title: 'Third-highest salary per department',
      prompt: `Without window functions: for each department, return the **third-highest distinct salary** among its **active** employees. If several people earn the same, that salary counts once. Departments with fewer than three distinct active salaries are left out.

- **Columns:** \`department_id\`, \`third_salary\`
- **Sort:** by \`department_id\`.`,
      hints: ['A salary is the 3rd-highest distinct one when exactly **2 distinct** salaries in the same department are higher.', '`(SELECT count(DISTINCT m.salary) FROM employees m WHERE m.department_id = e.department_id AND … AND m.salary > e.salary) = 2`'],
      referenceSolution: `SELECT DISTINCT e.department_id, e.salary AS third_salary
FROM employees e
WHERE e.termination_date IS NULL
  AND e.department_id IS NOT NULL
  AND (SELECT count(DISTINCT m.salary)
       FROM employees m
       WHERE m.department_id = e.department_id
         AND m.termination_date IS NULL
         AND m.salary > e.salary) = 2
ORDER BY e.department_id;`,
      alternativeSolutions: [
        `SELECT d.department_id, s.salary AS third_salary FROM departments d CROSS JOIN LATERAL (SELECT DISTINCT salary FROM employees e WHERE e.department_id = d.department_id AND e.termination_date IS NULL ORDER BY salary DESC OFFSET 2 LIMIT 1) s ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT d.department_id, s.salary AS third_salary FROM departments d CROSS JOIN LATERAL (SELECT salary FROM employees e WHERE e.department_id = d.department_id AND e.termination_date IS NULL ORDER BY salary DESC OFFSET 2 LIMIT 1) s ORDER BY d.department_id;`,
        `SELECT DISTINCT e.department_id, e.salary AS third_salary FROM employees e WHERE e.termination_date IS NULL AND e.department_id IS NOT NULL AND (SELECT count(*) FROM employees m WHERE m.department_id = e.department_id AND m.termination_date IS NULL AND m.salary > e.salary) = 2 ORDER BY e.department_id;`,
      ],
      explanation: `The classic "N-th highest salary" interview question. A correlated count says it directly: a salary is the N-th highest distinct one when exactly N − 1 **distinct** salaries are above it. DISTINCT in the outer query collapses colleagues who share that salary.

Ties are the trap. Sales has two people on the same salary right below the top:

- \`ORDER BY salary DESC OFFSET 2\` without DISTINCT returns the third **row**, which is the tied salary again.
- \`count(*)\` instead of \`count(DISTINCT …)\` counts both tied people, so no salary has exactly 2 above it and the department disappears.`,
      commonMistakes: ['OFFSET without DISTINCT (ties).', 'count(*) instead of count(DISTINCT salary).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't19-q16', topic: 19, relatedTopics: [1, 4, 6, 14], difficulty: 'interview', type: 'write-query',
      title: 'Customers who used every channel',
      prompt: `Find the customers who have placed orders through **every channel that appears in the \`orders\` table**. Don't hard-code the number or the names of the channels.

- **Columns:** \`customer_id\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Relational division: "there is no channel that this customer has not used".', '`NOT EXISTS (SELECT … channels … WHERE NOT EXISTS (SELECT … this customer\'s orders on that channel))`'],
      referenceSolution: `SELECT c.customer_id
FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM (SELECT DISTINCT channel FROM orders) AS ch
    WHERE NOT EXISTS (SELECT 1 FROM orders o
                      WHERE o.customer_id = c.customer_id
                        AND o.channel = ch.channel)
  )
ORDER BY c.customer_id;`,
      alternativeSolutions: [
        `SELECT o.customer_id FROM orders o GROUP BY 1 HAVING count(DISTINCT o.channel) = (SELECT count(DISTINCT channel) FROM orders) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT o.customer_id FROM orders o GROUP BY o.customer_id HAVING count(*) >= (SELECT count(DISTINCT channel) FROM orders) ORDER BY o.customer_id;`,
        `SELECT c.customer_id FROM customers c WHERE EXISTS (SELECT 1 FROM (SELECT DISTINCT channel FROM orders) AS ch WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.channel = ch.channel)) ORDER BY c.customer_id;`,
      ],
      explanation: `"X for every Y" is **relational division**. With double NOT EXISTS it reads: there is no channel for which this customer has no order. The counting alternative compares the customer's number of *distinct* channels with the total number of channels. Counting orders instead of distinct channels lets a customer with four web orders qualify.

Swapping both NOT EXISTS for EXISTS turns "every channel" into "some channel".`,
      commonMistakes: ['Counting orders instead of distinct channels.', 'EXISTS (some) instead of NOT EXISTS … NOT EXISTS (all).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
