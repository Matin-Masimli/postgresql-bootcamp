import type { Topic } from '../types.ts';

const explanation = `Topic 5 joined tables along foreign keys. This topic covers the join *patterns* that come up in real work and interviews.

## Self-joins

A table can be joined to **itself** under two aliases. That's how you walk the \`employees.manager_id\` hierarchy, or compare rows of the same table:

\`\`\`sql
SELECT e.employee_id,
       e.first_name || ' ' || e.last_name AS employee,
       m.first_name || ' ' || m.last_name AS manager
FROM employees e
LEFT JOIN employees m ON m.employee_id = e.manager_id
ORDER BY e.employee_id
LIMIT 8;
\`\`\`

The CEO has no manager, which is why this needs a LEFT join. For pairs within one table, use \`a.id < b.id\` so each pair appears once and nobody is paired with themselves.

## Semi-joins: "has at least one…"

\`customers JOIN orders\` repeats each customer once per order. If you only want the customers *that have* orders, use a **semi-join**:

\`\`\`sql
SELECT c.customer_id, c.first_name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
ORDER BY c.customer_id
LIMIT 5;
\`\`\`

\`EXISTS\` stops at the first match and never duplicates. \`IN (SELECT …)\` behaves the same way. (Subqueries get their own topic, 19. Here they're used as join patterns.)

## Anti-joins: "has no…", and the NOT IN trap

There are three ways to write "suppliers without products":

\`\`\`sql
-- 1. NOT EXISTS: the clearest, and NULL-safe
SELECT s.supplier_id, s.name FROM suppliers s
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.supplier_id = s.supplier_id);
\`\`\`

\`\`\`sql
-- 2. LEFT JOIN … IS NULL
SELECT s.supplier_id, s.name FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.supplier_id
WHERE p.product_id IS NULL;
\`\`\`

\`\`\`sql
-- 3. NOT IN: returns NOTHING here, because products.supplier_id contains NULLs!
SELECT s.supplier_id, s.name FROM suppliers s
WHERE s.supplier_id NOT IN (SELECT supplier_id FROM products);
\`\`\`

\`x NOT IN (1, 2, NULL)\` means \`x <> 1 AND x <> 2 AND x <> NULL\`, and the last part is never true. **Prefer NOT EXISTS.**

## CROSS JOIN

\`A CROSS JOIN B\` pairs every row of A with every row of B (|A| × |B| rows). It's useful for building grids (every department × every quarter) or calendars, combined with \`generate_series\`. It's dangerous when it happens by accident through a missing join condition.

\`\`\`sql
SELECT d.name AS department, q.quarter
FROM departments d
CROSS JOIN (VALUES ('Q1'), ('Q2'), ('Q3'), ('Q4')) AS q(quarter)
ORDER BY 1, 2
LIMIT 8;
\`\`\`

## Non-equi joins

Join conditions don't have to be equalities. Matching a date to a validity period is common:

\`\`\`sql
SELECT e.employee_id, h.salary AS salary_on_2023_01_01
FROM employees e
JOIN salary_history h
  ON h.employee_id = e.employee_id
 AND h.effective_from <= DATE '2023-01-01'
 AND (h.effective_to IS NULL OR h.effective_to >= DATE '2023-01-01')
ORDER BY e.employee_id
LIMIT 5;
\`\`\`

## LATERAL: a subquery per row

A subquery in FROM normally can't see the other tables of the same FROM. With \`LATERAL\` it can, so it runs once per outer row. That makes "top N per row" easy:

\`\`\`sql
-- The 2 most recent orders of each customer in Chile
SELECT c.customer_id, last2.order_id, last2.ordered_at
FROM customers c
CROSS JOIN LATERAL (
  SELECT o.order_id, o.ordered_at
  FROM orders o
  WHERE o.customer_id = c.customer_id
  ORDER BY o.ordered_at DESC
  LIMIT 2
) AS last2
WHERE c.country_id = 6
ORDER BY c.customer_id, last2.ordered_at DESC;
\`\`\`

\`CROSS JOIN LATERAL\` drops outer rows for which the subquery returns nothing. \`LEFT JOIN LATERAL (…) ON true\` keeps them, with NULLs.

## Gotchas

- Self-join pairs: \`a.id <> b.id\` lists every pair twice (A–B and B–A). Use \`<\`.
- A calendar built with \`generate_series\` + LEFT JOIN is the standard way to show days with **zero** activity.
- Several "many" tables joined to the same parent multiply each other. Join one at a time, or aggregate first.`;

const topic: Topic = {
  id: 6,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Joined Tables, incl. LATERAL (7.2.1)', url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html' },
    { title: 'PostgreSQL 18: Subquery Expressions, EXISTS / IN / NOT IN (9.24)', url: 'https://www.postgresql.org/docs/18/functions-subquery.html' },
    { title: 'Neon PostgreSQL Tutorial: Self-Join', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-self-join' },
    { title: 'Neon PostgreSQL Tutorial: CROSS JOIN', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-cross-join' },
    { title: 'PGExercises: Joins (self-joins and more)', url: 'https://pgexercises.com/questions/joins/' },
  ],
  questions: [
    {
      id: 't06-q01', topic: 6, relatedTopics: [1, 5], difficulty: 'easy', type: 'write-query',
      title: 'Employees and their managers',
      prompt: `List every employee with their manager's name. The CEO has no manager and must still appear (manager NULL).

- **Columns:** \`employee_id\`, \`employee\` (first name, space, last name), \`manager\` (same format)
- **Sort:** by \`employee_id\`.`,
      hints: ['Join `employees` to itself: `employees e LEFT JOIN employees m ON m.employee_id = e.manager_id`.'],
      referenceSolution: `SELECT e.employee_id,
       e.first_name || ' ' || e.last_name AS employee,
       m.first_name || ' ' || m.last_name AS manager
FROM employees e
LEFT JOIN employees m ON m.employee_id = e.manager_id
ORDER BY e.employee_id;`,
      alternativeSolutions: [`SELECT e.employee_id, concat_ws(' ', e.first_name, e.last_name) AS employee, m.first_name || ' ' || m.last_name AS manager FROM employees m RIGHT JOIN employees e ON e.manager_id = m.employee_id ORDER BY 1;`],
      wrongAnswers: [
        `SELECT e.employee_id, e.first_name || ' ' || e.last_name AS employee, m.first_name || ' ' || m.last_name AS manager FROM employees e JOIN employees m ON m.employee_id = e.manager_id ORDER BY e.employee_id;`,
        `SELECT e.employee_id, e.first_name || ' ' || e.last_name AS employee, m.first_name || ' ' || m.last_name AS manager FROM employees e LEFT JOIN employees m ON m.manager_id = e.employee_id ORDER BY e.employee_id;`,
      ],
      explanation: `Two aliases of the same table play different roles: \`e\` is the employee, and \`m\` is the row whose id equals the employee's \`manager_id\`.

LEFT JOIN keeps the CEO. Reversing the condition (\`m.manager_id = e.employee_id\`) finds each employee's *reports* instead, repeating managers once per report.`,
      commonMistakes: ['Inner join, which loses the CEO.', 'Reversing the join condition.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q02', topic: 6, relatedTopics: [5], difficulty: 'easy', type: 'concept-mc',
      title: 'Customers that have orders, once each',
      prompt: `You want each customer who has placed **at least one order**, listed **once**, with only customer columns. Which query is the most direct correct choice?`,
      options: [
        { text: '`SELECT c.* FROM customers c JOIN orders o ON o.customer_id = c.customer_id;`' },
        { text: '`SELECT c.* FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);`' },
        { text: '`SELECT c.* FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id;`' },
        { text: '`SELECT c.* FROM customers c CROSS JOIN orders o;`' },
      ],
      correctOption: 1,
      hints: ['Which form can never repeat a customer?'],
      explanation: `EXISTS is a **semi-join**: it asks "is there at least one matching order?" and returns each customer at most once. The plain JOIN repeats a customer once per order (you'd need DISTINCT). The LEFT JOIN also keeps customers *without* orders. CROSS JOIN pairs every customer with every order.`,
      commonMistakes: ['Using JOIN for an existence test, then fighting duplicates.'],
    },
    {
      id: 't06-q03', topic: 6, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'A budget planning grid',
      prompt: `Finance needs a planning grid: **one row for every department and every quarter** \`'Q1'\`, \`'Q2'\`, \`'Q3'\`, \`'Q4'\`.

- **Columns:** \`department\` (name), \`quarter\`
- **Sort:** by \`department\`, then \`quarter\`.`,
      hints: ['The quarters can come from an inline table: `(VALUES (\'Q1\'), (\'Q2\'), (\'Q3\'), (\'Q4\')) AS q(quarter)`.', 'Every department with every quarter: CROSS JOIN.'],
      referenceSolution: `SELECT d.name AS department, q.quarter
FROM departments d
CROSS JOIN (VALUES ('Q1'), ('Q2'), ('Q3'), ('Q4')) AS q(quarter)
ORDER BY department, q.quarter;`,
      alternativeSolutions: [`SELECT d.name AS department, 'Q' || g AS quarter FROM departments d, generate_series(1, 4) AS g ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT d.name AS department, q.quarter FROM departments d CROSS JOIN (VALUES ('Q1'), ('Q2'), ('Q3')) AS q(quarter) ORDER BY department, q.quarter;`,
        `SELECT d.name AS department, 'Q1' AS quarter FROM departments d ORDER BY department;`,
      ],
      explanation: `CROSS JOIN pairs every department (10) with every quarter (4), giving 40 rows. A comma between tables in FROM (\`FROM departments d, generate_series(1, 4) g\`) is the old spelling of the same thing.`,
      commonMistakes: ['Forgetting a quarter.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't06-q04', topic: 6, relatedTopics: [1, 5], difficulty: 'easy', type: 'predict-output',
      title: 'Pairs from a self-join',
      prompt: `What does this self-join return?`,
      referenceSolution: `SELECT a.x AS first, b.x AS second
FROM (VALUES (1), (2), (3)) AS a(x)
JOIN (VALUES (1), (2), (3)) AS b(x) ON a.x < b.x
ORDER BY 1, 2;`,
      options: [
        { table: { columns: ['first', 'second'], rows: [['1', '2'], ['1', '3'], ['2', '3']] } },
        { table: { columns: ['first', 'second'], rows: [['1', '2'], ['2', '1'], ['1', '3'], ['3', '1'], ['2', '3'], ['3', '2']] } },
        { table: { columns: ['first', 'second'], rows: [['1', '1'], ['1', '2'], ['1', '3'], ['2', '2'], ['2', '3'], ['3', '3']] } },
        { table: { columns: ['first', 'second'], rows: [['1', '2'], ['2', '3']] } },
      ],
      correctOption: 0,
      hints: ['`a.x < b.x` excludes equal values and fixes the order inside each pair.'],
      explanation: `With \`<\`, each unordered pair appears exactly once (smaller value first), and no value is paired with itself. That's 3 pairs. \`<>\` would give all 6 ordered pairs, and \`<=\` would add the self-pairs.`,
      commonMistakes: ['Expecting both orders of each pair.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't06-q05', topic: 6, relatedTopics: [1, 4, 5], previewTopics: [19], difficulty: 'medium', type: 'write-query',
      title: 'Customers who wrote a review',
      prompt: `List the customers who have written **at least one review**, each once.

- **Columns:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sort:** by \`customer_id\`.`,
      hints: ['"At least one" → semi-join with EXISTS.'],
      referenceSolution: `SELECT c.customer_id, c.first_name, c.last_name
FROM customers c
WHERE EXISTS (SELECT 1 FROM reviews r WHERE r.customer_id = c.customer_id)
ORDER BY c.customer_id;`,
      alternativeSolutions: [
        `SELECT DISTINCT c.customer_id, c.first_name, c.last_name FROM customers c JOIN reviews r ON r.customer_id = c.customer_id ORDER BY 1;`,
        `SELECT customer_id, first_name, last_name FROM customers WHERE customer_id IN (SELECT customer_id FROM reviews) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT c.customer_id, c.first_name, c.last_name FROM customers c JOIN reviews r ON r.customer_id = c.customer_id ORDER BY c.customer_id;`,
        `SELECT c.customer_id, c.first_name, c.last_name FROM customers c LEFT JOIN reviews r ON r.customer_id = c.customer_id ORDER BY c.customer_id;`,
      ],
      explanation: `\`EXISTS\` returns each customer once, however many reviews they wrote. A plain JOIN repeats customers with several reviews (you'd need DISTINCT), and a LEFT JOIN also includes customers with no review.

\`IN (SELECT customer_id FROM reviews)\` is fine here even though some reviews have a NULL customer_id. The NULL trap only affects **NOT** IN.`,
      commonMistakes: ['JOIN without DISTINCT, which duplicates customers.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q06', topic: 6, relatedTopics: [1, 4, 5], previewTopics: [19], difficulty: 'medium', type: 'write-query',
      title: 'Suppliers with nothing in the catalogue',
      prompt: `Find the suppliers who **supply no product at all**.

- **Columns:** \`supplier_id\`, \`name\`
- **Sort:** by \`supplier_id\`.

*Watch out: some products have no supplier (NULL \`supplier_id\`).*`,
      hints: ['Anti-join: NOT EXISTS, or LEFT JOIN … IS NULL.', 'Why would `supplier_id NOT IN (SELECT supplier_id FROM products)` return nothing?'],
      referenceSolution: `SELECT s.supplier_id, s.name
FROM suppliers s
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.supplier_id = s.supplier_id)
ORDER BY s.supplier_id;`,
      alternativeSolutions: [
        `SELECT s.supplier_id, s.name FROM suppliers s LEFT JOIN products p ON p.supplier_id = s.supplier_id WHERE p.product_id IS NULL ORDER BY 1;`,
        `SELECT supplier_id, name FROM suppliers WHERE supplier_id NOT IN (SELECT supplier_id FROM products WHERE supplier_id IS NOT NULL) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT supplier_id, name FROM suppliers WHERE supplier_id NOT IN (SELECT supplier_id FROM products) ORDER BY supplier_id;`,
        `SELECT s.supplier_id, s.name FROM suppliers s JOIN products p ON p.supplier_id = s.supplier_id WHERE p.product_id IS NULL ORDER BY s.supplier_id;`,
      ],
      explanation: `Because the subquery contains a NULL, \`NOT IN\` is unknown for every supplier and returns **nothing**. That's the classic anti-join trap. NOT EXISTS and LEFT JOIN … IS NULL are NULL-safe. NOT IN only works if you filter the NULLs out of the subquery.`,
      commonMistakes: ['NOT IN against a column that contains NULLs.', 'An inner join can\'t produce "no match" rows.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q07', topic: 6, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Salaries on New Year’s Day 2023',
      prompt: `Using \`salary_history\`, find what each employee earned on **1 January 2023**. A period applies if \`effective_from <= '2023-01-01'\` and \`effective_to\` is NULL or on/after that date. Employees not yet hired by then don't appear.

- **Columns:** \`employee_id\`, \`salary\`
- **Sort:** by \`employee_id\`.`,
      hints: ['A join condition can use `<=` and `>=`, not just `=`.', 'Remember that `effective_to` is NULL for the current period.'],
      referenceSolution: `SELECT h.employee_id, h.salary
FROM salary_history h
WHERE h.effective_from <= DATE '2023-01-01'
  AND (h.effective_to IS NULL OR h.effective_to >= DATE '2023-01-01')
ORDER BY h.employee_id;`,
      alternativeSolutions: [
        `SELECT e.employee_id, h.salary FROM employees e JOIN salary_history h ON h.employee_id = e.employee_id AND DATE '2023-01-01' BETWEEN h.effective_from AND coalesce(h.effective_to, DATE '9999-12-31') ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT h.employee_id, h.salary FROM salary_history h WHERE h.effective_from <= DATE '2023-01-01' AND h.effective_to >= DATE '2023-01-01' ORDER BY h.employee_id;`,
        `SELECT h.employee_id, h.salary FROM salary_history h WHERE h.effective_from <= DATE '2023-01-01' ORDER BY h.employee_id;`,
      ],
      explanation: `A "range join" matches a point in time to the period that contains it. Two parts:

- the period started on or before the date;
- it ends on or after the date, **or** it hasn't ended (NULL).

Forgetting the NULL case loses everyone whose salary hasn't changed since. Forgetting the end condition returns *every* earlier period, several rows per employee. \`coalesce(effective_to, far-future date)\` (Topic 12) is a common shortcut.`,
      commonMistakes: ['Ignoring open-ended periods (NULL effective_to).', 'Only checking the start date.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q08', topic: 6, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Colleagues with identical salaries',
      prompt: `Find **pairs of active employees** (\`termination_date IS NULL\`) who work in the **same department** and earn **exactly the same salary**. List each pair once, with the lower employee id first.

- **Columns:** \`department_id\`, \`employee_a\`, \`employee_b\`, \`salary\`
- **Sort:** by \`department_id\`, \`employee_a\`, \`employee_b\`.`,
      hints: ['Self-join on department and salary.', 'Use `a.employee_id < b.employee_id` to get each pair once.', 'Both employees must be active.'],
      referenceSolution: `SELECT a.department_id, a.employee_id AS employee_a, b.employee_id AS employee_b, a.salary
FROM employees a
JOIN employees b
  ON b.department_id = a.department_id
 AND b.salary = a.salary
 AND a.employee_id < b.employee_id
WHERE a.termination_date IS NULL
  AND b.termination_date IS NULL
ORDER BY a.department_id, employee_a, employee_b;`,
      alternativeSolutions: [`SELECT a.department_id, a.employee_id AS employee_a, b.employee_id AS employee_b, b.salary FROM employees a, employees b WHERE a.department_id = b.department_id AND a.salary = b.salary AND a.employee_id < b.employee_id AND a.termination_date IS NULL AND b.termination_date IS NULL ORDER BY 1, 2, 3;`],
      wrongAnswers: [
        `SELECT a.department_id, a.employee_id AS employee_a, b.employee_id AS employee_b, a.salary FROM employees a JOIN employees b ON b.department_id = a.department_id AND b.salary = a.salary AND a.employee_id <> b.employee_id WHERE a.termination_date IS NULL AND b.termination_date IS NULL ORDER BY a.department_id, employee_a, employee_b;`,
        `SELECT a.department_id, a.employee_id AS employee_a, b.employee_id AS employee_b, a.salary FROM employees a JOIN employees b ON b.department_id = a.department_id AND b.salary = a.salary AND a.employee_id < b.employee_id ORDER BY a.department_id, employee_a, employee_b;`,
      ],
      explanation: `The self-join matches every employee with every colleague who has the same department and salary. \`a.employee_id < b.employee_id\` removes self-matches *and* the mirrored duplicate (B, A). Both sides need the "active" filter.

Employees without a department never pair up, because \`NULL = NULL\` isn't true in a join condition.`,
      commonMistakes: ['Using <>, which lists each pair twice.', 'Filtering only one side for active employees.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q09', topic: 6, relatedTopics: [1, 4], previewTopics: [19], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: customers who never referred anyone',
      prompt: `This query should list the customers who **never referred another customer** (nobody has them as \`referred_by\`). It returns no rows at all. Fix it.

- **Columns:** \`customer_id\`
- **Sort:** by \`customer_id\`.`,
      starterSql: `SELECT customer_id
FROM customers
WHERE customer_id NOT IN (SELECT referred_by FROM customers)
ORDER BY customer_id;`,
      hints: ['What does the subquery return for the many customers who weren\'t referred by anyone?'],
      referenceSolution: `SELECT c.customer_id
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM customers r WHERE r.referred_by = c.customer_id)
ORDER BY c.customer_id;`,
      alternativeSolutions: [`SELECT customer_id FROM customers WHERE customer_id NOT IN (SELECT referred_by FROM customers WHERE referred_by IS NOT NULL) ORDER BY 1;`],
      wrongAnswers: [`SELECT customer_id FROM customers WHERE referred_by IS NULL ORDER BY customer_id;`],
      explanation: `Most customers weren't referred, so \`SELECT referred_by FROM customers\` contains NULLs. \`x NOT IN (…, NULL)\` can never be true, so every row is filtered out.

Use NOT EXISTS, or exclude NULLs inside the subquery. The wrong answer answers a different question: "who was *not referred*" rather than "who *referred nobody*".`,
      commonMistakes: ['Mixing up "was referred" and "referred someone".'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q10', topic: 6, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Two latest orders per New Zealand customer',
      prompt: `For every customer living in **New Zealand** (\`country_id = 31\`), show their **two most recent orders** (fewer if they have fewer; customers without orders don't appear).

- **Columns:** \`customer_id\`, \`order_id\`, \`ordered_at\`
- **Sort:** by \`customer_id\`, then \`ordered_at\` descending.`,
      hints: ['A subquery that can see the current customer: `CROSS JOIN LATERAL (SELECT … WHERE o.customer_id = c.customer_id ORDER BY … LIMIT 2)`.'],
      referenceSolution: `SELECT c.customer_id, recent.order_id, recent.ordered_at
FROM customers c
CROSS JOIN LATERAL (
  SELECT o.order_id, o.ordered_at
  FROM orders o
  WHERE o.customer_id = c.customer_id
  ORDER BY o.ordered_at DESC, o.order_id DESC
  LIMIT 2
) AS recent
WHERE c.country_id = 31
ORDER BY c.customer_id, recent.ordered_at DESC;`,
      alternativeSolutions: [`SELECT c.customer_id, r.order_id, r.ordered_at FROM customers c, LATERAL (SELECT order_id, ordered_at FROM orders WHERE customer_id = c.customer_id ORDER BY ordered_at DESC LIMIT 2) r WHERE c.country_id = 31 ORDER BY 1, 3 DESC;`],
      wrongAnswers: [
        `SELECT c.customer_id, o.order_id, o.ordered_at FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE c.country_id = 31 ORDER BY c.customer_id, o.ordered_at DESC LIMIT 2;`,
        `SELECT c.customer_id, recent.order_id, recent.ordered_at FROM customers c CROSS JOIN LATERAL (SELECT o.order_id, o.ordered_at FROM orders o WHERE o.customer_id = c.customer_id ORDER BY o.ordered_at LIMIT 2) AS recent WHERE c.country_id = 31 ORDER BY c.customer_id, recent.ordered_at DESC;`,
      ],
      explanation: `\`LATERAL\` lets the subquery reference \`c.customer_id\`, so PostgreSQL runs it once per customer: sort that customer's orders newest first and keep 2.

A LIMIT on the outer query cuts the *whole* result to 2 rows, not 2 per customer. CROSS JOIN LATERAL also drops customers whose subquery returns nothing, as requested. \`LEFT JOIN LATERAL … ON true\` would keep them.`,
      commonMistakes: ['A global LIMIT instead of a per-customer one.', 'Sorting ascending (oldest orders).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q11', topic: 6, relatedTopics: [1, 4, 5], previewTopics: [19], difficulty: 'hard', type: 'write-query',
      title: 'Verified-purchase reviews',
      prompt: `A review counts as a **verified purchase** if its author placed a **non-cancelled order containing that product before writing the review** (\`orders.ordered_at < reviews.created_at\`).

List the verified reviews.

- **Columns:** \`review_id\`, \`product_id\`, \`customer_id\`
- **Sort:** by \`review_id\`.`,
      hints: ['For each review, ask: *does such an order exist?* That\'s EXISTS over orders joined to order_items.', 'Inside EXISTS, match customer, product, status and date.'],
      referenceSolution: `SELECT r.review_id, r.product_id, r.customer_id
FROM reviews r
WHERE EXISTS (
  SELECT 1
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.customer_id = r.customer_id
    AND oi.product_id = r.product_id
    AND o.status <> 'cancelled'
    AND o.ordered_at < r.created_at
)
ORDER BY r.review_id;`,
      alternativeSolutions: [
        `SELECT DISTINCT r.review_id, r.product_id, r.customer_id FROM reviews r JOIN orders o ON o.customer_id = r.customer_id AND o.status <> 'cancelled' AND o.ordered_at < r.created_at JOIN order_items oi ON oi.order_id = o.order_id AND oi.product_id = r.product_id ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT r.review_id, r.product_id, r.customer_id FROM reviews r JOIN orders o ON o.customer_id = r.customer_id AND o.status <> 'cancelled' AND o.ordered_at < r.created_at JOIN order_items oi ON oi.order_id = o.order_id AND oi.product_id = r.product_id ORDER BY r.review_id;`,
        `SELECT r.review_id, r.product_id, r.customer_id FROM reviews r WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = r.customer_id AND o.status <> 'cancelled' AND o.ordered_at < r.created_at) ORDER BY r.review_id;`,
      ],
      explanation: `The EXISTS subquery is a semi-join with four conditions: same customer, same product, a real order, placed before the review. It returns each review at most once.

- A plain join returns a review **once per qualifying order**. Customers who bought the product twice produce duplicate rows.
- Checking only "the customer has *some* order" verifies the wrong thing: the review must be about a product they actually bought.

Anonymised reviews (NULL customer) are never verified, because \`o.customer_id = NULL\` never matches.`,
      commonMistakes: ['Join without DISTINCT, which gives duplicate reviews.', 'Not checking that the order contained the reviewed product.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q12', topic: 6, relatedTopics: [1, 4, 5], previewTopics: [11, 14], difficulty: 'hard', type: 'write-query',
      title: 'Return requests per day, gaps included',
      prompt: `Show the number of **return requests per day for June 2025** (by the UTC date of \`requested_at\`). **Every day of June** must appear, days without requests showing **0**.

- **Columns:** \`day\` (type \`date\`), \`requests\`
- **Sort:** by \`day\`.`,
      hints: ['Build the calendar: `generate_series(DATE \'2025-06-01\', DATE \'2025-06-30\', INTERVAL \'1 day\')::date`.', 'LEFT JOIN returns on the day, then GROUP BY day.', 'Count a column from the returns side, so empty days count 0.'],
      referenceSolution: `SELECT g.ts::date AS day, count(r.return_id) AS requests
FROM generate_series(DATE '2025-06-01', DATE '2025-06-30', INTERVAL '1 day') AS g(ts)
LEFT JOIN returns r ON r.requested_at::date = g.ts::date
GROUP BY g.ts
ORDER BY day;`,
      alternativeSolutions: [
        `SELECT g::date AS day, count(r.return_id) AS requests
FROM generate_series('2025-06-01'::date, '2025-06-30'::date, '1 day') AS g
LEFT JOIN returns r ON r.requested_at >= g AND r.requested_at < g + INTERVAL '1 day'
GROUP BY g ORDER BY g;`,
      ],
      wrongAnswers: [
        `SELECT requested_at::date AS day, count(*) AS requests FROM returns WHERE requested_at >= '2025-06-01' AND requested_at < '2025-07-01' GROUP BY 1 ORDER BY 1;`,
        `SELECT g::date AS day, count(*) AS requests FROM generate_series('2025-06-01'::date, '2025-06-30'::date, '1 day') AS g LEFT JOIN returns r ON r.requested_at::date = g::date GROUP BY g ORDER BY g;`,
      ],
      explanation: `Days with no data don't exist in the data, so you have to **generate** them. \`generate_series\` creates one row per day (Topic 11), and the LEFT JOIN attaches that day's returns.

\`count(r.return_id)\` counts only real matches, so an empty day gives 0. \`count(*)\` would count the NULL-extended row as 1. Without the calendar, empty days are simply missing from the output.`,
      commonMistakes: ['Grouping the returns table directly, which skips empty days.', 'count(*) after the LEFT JOIN, which shows 1 for empty days.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q13', topic: 6, relatedTopics: [1, 5], difficulty: 'hard', type: 'write-query',
      title: 'Manager and skip-level manager',
      prompt: `For every employee, show their manager's id and their **manager's manager's** id (the "skip-level"). Either can be NULL near the top of the hierarchy, and those employees must still appear.

- **Columns:** \`employee_id\`, \`manager_id\`, \`skip_level_id\`
- **Sort:** by \`employee_id\`.`,
      hints: ['Self-join twice: employee → manager → manager\'s manager.', 'Both joins must be LEFT joins.'],
      referenceSolution: `SELECT e.employee_id, m.employee_id AS manager_id, mm.employee_id AS skip_level_id
FROM employees e
LEFT JOIN employees m  ON m.employee_id  = e.manager_id
LEFT JOIN employees mm ON mm.employee_id = m.manager_id
ORDER BY e.employee_id;`,
      alternativeSolutions: [`SELECT e.employee_id, e.manager_id, m.manager_id AS skip_level_id FROM employees e LEFT JOIN employees m ON m.employee_id = e.manager_id ORDER BY 1;`],
      wrongAnswers: [
        `SELECT e.employee_id, m.employee_id AS manager_id, mm.employee_id AS skip_level_id FROM employees e LEFT JOIN employees m ON m.employee_id = e.manager_id JOIN employees mm ON mm.employee_id = m.manager_id ORDER BY e.employee_id;`,
        `SELECT e.employee_id, e.manager_id, e.manager_id AS skip_level_id FROM employees e ORDER BY e.employee_id;`,
      ],
      explanation: `Each extra hierarchy level is one more self-join. They must all be LEFT joins: the CEO has no manager, and the VPs' manager (the CEO) has no manager either. An inner second join drops exactly those rows.

The alternative is shorter: the manager's \`manager_id\` *is* the skip-level id, so one join suffices. For hierarchies of unknown depth, use a recursive CTE (Topic 20).`,
      commonMistakes: ['Inner join on the second level.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't06-q14', topic: 6, relatedTopics: [1, 5], difficulty: 'hard', type: 'predict-output',
      title: 'Counting a cross join',
      prompt: `How many rows does this query count?`,
      referenceSolution: `SELECT count(*) AS n
FROM (VALUES (1), (2), (3)) AS a(x)
CROSS JOIN (VALUES ('a'), ('b')) AS b(y)
LEFT JOIN (VALUES (1), (1)) AS c(z) ON c.z = a.x;`,
      options: [
        { table: { columns: ['n'], rows: [['6']] } },
        { table: { columns: ['n'], rows: [['8']] } },
        { table: { columns: ['n'], rows: [['5']] } },
        { table: { columns: ['n'], rows: [['12']] } },
      ],
      correctOption: 1,
      hints: ['The CROSS JOIN gives 3 × 2 rows. Two of those have x = 1, and each of them matches **two** rows of c.'],
      explanation: `1. CROSS JOIN: 3 × 2 = **6** rows.
2. LEFT JOIN to c: the 2 rows with x = 1 each match both c rows, giving 4 rows. The 4 rows with x = 2 or 3 match nothing and are kept once each, giving 4 rows.

4 + 4 = **8**. LEFT JOIN never drops rows, but it can multiply them.`,
      commonMistakes: ['Assuming a LEFT JOIN keeps the row count unchanged.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't06-q15', topic: 6, relatedTopics: [1, 4, 5], previewTopics: [19], difficulty: 'interview', type: 'write-query',
      title: 'Bought a laptop and a mouse',
      prompt: `Find customers who have bought **both** a product in the **Laptops** category (slug \`'laptops'\`) **and** a product in the **Mice** category (slug \`'mice'\`), in non-cancelled orders. The two products may be in different orders.

- **Columns:** \`customer_id\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Two independent existence tests, combined with AND.', 'Each EXISTS joins orders → order_items → products → categories.'],
      referenceSolution: `SELECT c.customer_id
FROM customers c
WHERE EXISTS (
        SELECT 1 FROM orders o
        JOIN order_items oi ON oi.order_id = o.order_id
        JOIN products p     ON p.product_id = oi.product_id
        JOIN categories cat ON cat.category_id = p.category_id
        WHERE o.customer_id = c.customer_id AND o.status <> 'cancelled' AND cat.slug = 'laptops')
  AND EXISTS (
        SELECT 1 FROM orders o
        JOIN order_items oi ON oi.order_id = o.order_id
        JOIN products p     ON p.product_id = oi.product_id
        JOIN categories cat ON cat.category_id = p.category_id
        WHERE o.customer_id = c.customer_id AND o.status <> 'cancelled' AND cat.slug = 'mice')
ORDER BY c.customer_id;`,
      alternativeSolutions: [
        `SELECT o.customer_id
FROM orders o JOIN order_items oi USING (order_id) JOIN products p USING (product_id) JOIN categories cat USING (category_id)
WHERE o.status <> 'cancelled' AND cat.slug IN ('laptops', 'mice')
GROUP BY o.customer_id
HAVING count(DISTINCT cat.slug) = 2
ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT DISTINCT o.customer_id FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id JOIN categories cat ON cat.category_id = p.category_id WHERE o.status <> 'cancelled' AND cat.slug = 'laptops' AND cat.slug = 'mice' ORDER BY 1;`,
        `SELECT DISTINCT o.customer_id FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id JOIN categories cat ON cat.category_id = p.category_id WHERE o.status <> 'cancelled' AND cat.slug IN ('laptops', 'mice') ORDER BY 1;`,
      ],
      explanation: `"Bought A **and** B" is a question about **two different rows**. A single row's slug can't be both 'laptops' and 'mice', so \`slug = 'laptops' AND slug = 'mice'\` returns nothing, and \`IN\` means "A *or* B".

Solutions:

1. **Two EXISTS** (semi-joins), one per category: readable and efficient.
2. **Group and count distinct categories** (alternative, Topic 14): keep customers with both slugs among their purchases. This generalises nicely to "all of these N categories".`,
      commonMistakes: ['AND on one row (always empty).', 'IN / OR, which finds customers with either category.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't06-q16', topic: 6, relatedTopics: [1, 4, 5], difficulty: 'interview', type: 'write-query',
      title: 'Latest review in every category',
      prompt: `For **every category**, show its **most recent review** (latest \`created_at\`, ties broken by the higher \`review_id\`) of any product in that category. Categories without any review (including parent categories, which hold no products directly) must still appear with NULLs.

- **Columns:** \`category_id\`, \`review_id\`, \`rating\`, \`created_at\`
- **Sort:** by \`category_id\`.`,
      hints: ['Per category, a subquery that finds one review: `LEFT JOIN LATERAL (… ORDER BY … LIMIT 1) ON true`.', 'Inside, join reviews to products to filter by the category.'],
      referenceSolution: `SELECT c.category_id, lr.review_id, lr.rating, lr.created_at
FROM categories c
LEFT JOIN LATERAL (
  SELECT r.review_id, r.rating, r.created_at
  FROM reviews r
  JOIN products p ON p.product_id = r.product_id
  WHERE p.category_id = c.category_id
  ORDER BY r.created_at DESC, r.review_id DESC
  LIMIT 1
) AS lr ON true
ORDER BY c.category_id;`,
      alternativeSolutions: [
        `SELECT c.category_id, x.review_id, x.rating, x.created_at
FROM categories c
LEFT JOIN (SELECT DISTINCT ON (p.category_id) p.category_id, r.review_id, r.rating, r.created_at
           FROM reviews r JOIN products p USING (product_id)
           ORDER BY p.category_id, r.created_at DESC, r.review_id DESC) AS x ON x.category_id = c.category_id
ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT c.category_id, lr.review_id, lr.rating, lr.created_at FROM categories c CROSS JOIN LATERAL (SELECT r.review_id, r.rating, r.created_at FROM reviews r JOIN products p ON p.product_id = r.product_id WHERE p.category_id = c.category_id ORDER BY r.created_at DESC, r.review_id DESC LIMIT 1) AS lr ORDER BY c.category_id;`,
        `SELECT c.category_id, lr.review_id, lr.rating, lr.created_at FROM categories c LEFT JOIN LATERAL (SELECT r.review_id, r.rating, r.created_at FROM reviews r JOIN products p ON p.product_id = r.product_id WHERE p.category_id = c.category_id ORDER BY r.created_at, r.review_id LIMIT 1) AS lr ON true ORDER BY c.category_id;`,
      ],
      explanation: `\`LEFT JOIN LATERAL (…) ON true\` is the PostgreSQL idiom for "for each row, fetch the top-1 related row, or NULL if there is none":

- the subquery sees \`c.category_id\` and returns at most one review: the newest, with the id as tie-breaker;
- \`ON true\` because the matching already happened inside the subquery;
- LEFT keeps categories whose subquery returns nothing. CROSS JOIN LATERAL would drop them.

The alternative pre-computes the newest review per category with \`DISTINCT ON\` (Topic 1) and LEFT JOINs it.`,
      commonMistakes: ['CROSS JOIN LATERAL, which drops categories without reviews.', 'Sorting ascending, which gives the oldest review.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
