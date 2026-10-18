import type { Topic } from '../types.ts';

const explanation = `A **common table expression** (CTE) names a subquery up front with \`WITH\`, so the main query, and later CTEs, can use it like a table. CTEs turn a deeply nested query into a readable sequence of steps.

\`\`\`sql
WITH order_value AS (
  SELECT o.order_id, o.customer_id,
         sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id
),
customer_value AS (            -- a later CTE can use an earlier one
  SELECT customer_id, count(*) AS orders, sum(value) AS spend
  FROM order_value
  GROUP BY customer_id
)
SELECT *
FROM customer_value
ORDER BY spend DESC
LIMIT 5;
\`\`\`

## Rules worth knowing

- A CTE exists only for the **one statement** it belongs to.
- CTEs are separated by commas, with \`WITH\` written once. Each can reference those **before** it.
- A CTE can be referenced several times. PostgreSQL inlines a CTE that is used once (and has no side effects) into the main query. Add \`MATERIALIZED\` / \`NOT MATERIALIZED\` to force a choice.
- A CTE can contain INSERT/UPDATE/DELETE … RETURNING (a *data-modifying CTE*). All parts of the statement see the **same snapshot**: the main query does not see the rows a CTE changed.

## Recursive CTEs

\`WITH RECURSIVE\` lets a CTE refer to itself. It has two parts joined by \`UNION ALL\` (or \`UNION\`):

\`\`\`text
WITH RECURSIVE name AS (
    <anchor>        -- the starting rows
  UNION ALL
    <recursive term> -- joins name to produce the next rows; stops when it produces none
)
\`\`\`

PostgreSQL runs the anchor, then runs the recursive term again and again on the rows produced in the **previous** step, until a step returns nothing.

\`\`\`sql
-- Walk the category tree from the roots down
WITH RECURSIVE tree AS (
  SELECT category_id, name, 1 AS depth, name::text AS path
  FROM categories
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.category_id, c.name, t.depth + 1, t.path || ' > ' || c.name
  FROM categories c
  JOIN tree t ON c.parent_id = t.category_id
)
SELECT * FROM tree
WHERE path LIKE 'Electronics%'
ORDER BY path;
\`\`\`

Typical uses: hierarchies (categories, org charts, referral chains), generating series, graph walks.

### Pitfalls

- **Termination.** The recursive term needs a condition that eventually produces no rows (\`WHERE n < 10\`, or a tree that ends). Cyclic data needs \`UNION\` (drops repeated rows), a visited-path check, or PostgreSQL's \`CYCLE\` clause.
- **Types must match.** The anchor fixes the column types. \`date + interval\` is a timestamp, so a date anchor plus an interval step fails. Use \`date + 1\` or cast.
- **Direction.** Joining \`child.parent_id = tree.id\` walks **down**. \`tree.parent_id = parent.id\` walks **up**.

\`\`\`sql
-- Every day of the first week of June 2025
WITH RECURSIVE days AS (
  SELECT DATE '2025-06-01' AS day
  UNION ALL
  SELECT day + 1 FROM days WHERE day < DATE '2025-06-07'
)
SELECT day FROM days;
\`\`\`

## CTE or subquery?

They are interchangeable for non-recursive queries. Use a CTE when it makes the steps clearer, when you need the same intermediate result twice, or when you need recursion. Use a small inline subquery when it's a one-off value.`;

const lineValue = 'oi.quantity * oi.unit_price * (1 - oi.discount)';

const topic: Topic = {
  id: 20,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: WITH Queries (Common Table Expressions) (7.8)', url: 'https://www.postgresql.org/docs/18/queries-with.html' },
    { title: 'PostgreSQL 18: SELECT, the WITH clause', url: 'https://www.postgresql.org/docs/18/sql-select.html#SQL-WITH' },
    { title: 'Neon PostgreSQL Tutorial: CTE', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-cte' },
    { title: 'Neon PostgreSQL Tutorial: Recursive Query', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-recursive-query' },
    { title: 'PostgreSQL Wiki: CTEReadme', url: 'https://wiki.postgresql.org/wiki/CTEReadme' },
  ],
  questions: [
    {
      id: 't20-q01', topic: 20, relatedTopics: [1, 4, 5, 11, 14, 19], difficulty: 'easy', type: 'write-query',
      title: 'Above-average months',
      prompt: `Using a CTE for the monthly figures: which months of **2024** had a revenue (non-cancelled orders) **above the average monthly revenue of 2024**?

- **Columns:** \`month\` (date), \`revenue\` (2 decimals)
- **Sort:** by \`month\`.`,
      hints: ['`WITH monthly AS (SELECT date_trunc(\'month\', …)::date AS month, sum(…) AS revenue … GROUP BY 1)`', 'Then `WHERE revenue > (SELECT avg(revenue) FROM monthly)`.'],
      referenceSolution: `WITH monthly AS (
  SELECT date_trunc('month', o.ordered_at)::date AS month,
         sum(${lineValue}) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
    AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01'
  GROUP BY 1
)
SELECT month, round(revenue, 2) AS revenue
FROM monthly
WHERE revenue > (SELECT avg(revenue) FROM monthly)
ORDER BY month;`,
      alternativeSolutions: [`SELECT month, round(revenue, 2) AS revenue FROM (SELECT date_trunc('month', o.ordered_at)::date AS month, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue, avg(sum(oi.quantity * oi.unit_price * (1 - oi.discount))) OVER () AS a FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1) m WHERE revenue > a ORDER BY 1;`],
      wrongAnswers: [
        `WITH monthly AS (SELECT date_trunc('month', o.ordered_at)::date AS month, sum(${lineValue}) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1) SELECT month, round(revenue, 2) AS revenue FROM monthly WHERE revenue > (SELECT avg(${lineValue}) FROM order_items oi) ORDER BY month;`,
        `WITH monthly AS (SELECT date_trunc('month', o.ordered_at)::date AS month, sum(${lineValue}) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY 1) SELECT month, round(revenue, 2) AS revenue FROM monthly WHERE revenue > (SELECT avg(revenue) FROM monthly) AND month >= '2024-01-01' AND month < '2025-01-01' ORDER BY month;`,
      ],
      explanation: `The CTE is computed once and used **twice**: as the row source and inside the scalar subquery for the average. Written without a CTE, the monthly aggregation would have to be repeated.

Where the 2024 filter sits matters: in the CTE, the average covers 2024's months only. Filtering only in the main query (second wrong answer) compares 2024 months with the all-time monthly average.`,
      commonMistakes: ['Comparing with the average line value.', 'Averaging over all months, not just 2024.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't20-q02', topic: 20, relatedTopics: [19], difficulty: 'easy', type: 'concept-mc',
      title: 'What a CTE is',
      prompt: `Which statement about a (non-recursive) CTE is **true**?`,
      options: [
        { text: 'It is stored in the database and can be reused by later queries, like a view' },
        { text: 'It exists only within the single statement it belongs to, and a later CTE in the same WITH can refer to an earlier one' },
        { text: 'Each CTE can only be referenced once in the main query' },
        { text: 'CTEs are always computed separately and are therefore always faster than subqueries' },
      ],
      correctOption: 1,
      hints: ['Think of a CTE as a named subquery.'],
      explanation: `A CTE is a named subquery, scoped to one statement. CTEs can build on earlier ones and can be referenced many times. Since PostgreSQL 12, a CTE that is referenced once (and has no side effects) is inlined like a subquery, so it's neither automatically faster nor slower. Use \`MATERIALIZED\` to force a separate computation. To keep a query around, create a **view** (Topic 21).`,
      commonMistakes: ['Confusing a CTE with a view or temporary table.'],
    },
    {
      id: 't20-q03', topic: 20, relatedTopics: [1, 14], difficulty: 'easy', type: 'predict-output',
      title: 'Counting with recursion',
      prompt: `What does this query return?`,
      referenceSolution: `WITH RECURSIVE n AS (
  SELECT 1 AS i
  UNION ALL
  SELECT i + 1 FROM n WHERE i < 5
)
SELECT count(*) AS rows, sum(i) AS total, max(i) AS last
FROM n;`,
      options: [
        { table: { columns: ['rows', 'total', 'last'], rows: [['5', '15', '5']] } },
        { table: { columns: ['rows', 'total', 'last'], rows: [['4', '10', '4']] } },
        { table: { columns: ['rows', 'total', 'last'], rows: [['6', '21', '6']] } },
        { table: { columns: ['rows', 'total', 'last'], rows: [['1', '1', '1']] } },
      ],
      correctOption: 0,
      hints: ['The condition is checked on the *previous* row: from i = 4 one more row (5) is produced.'],
      explanation: `The anchor produces 1. Each step adds \`i + 1\` for rows where \`i < 5\`: 2, 3, 4, and from 4 it produces 5. From 5 the condition fails, the step returns no rows, and recursion stops. Rows 1–5: count 5, sum 15, max 5.`,
      commonMistakes: ['Off-by-one: expecting the WHERE to stop at 4 or to allow 6.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't20-q04', topic: 20, relatedTopics: [1, 5, 14], difficulty: 'easy', type: 'write-query',
      title: 'How many orders do customers place?',
      prompt: `Show the distribution of customers by number of orders: how many customers placed exactly 1 order, exactly 2, and so on (any status; only customers with at least one order).

- **Columns:** \`orders\`, \`customers\`
- **Sort:** by \`orders\`.`,
      hints: ['CTE 1: orders per customer. Main query: group that CTE by its count.'],
      referenceSolution: `WITH per_customer AS (
  SELECT customer_id, count(*) AS orders
  FROM orders
  GROUP BY customer_id
)
SELECT orders, count(*) AS customers
FROM per_customer
GROUP BY orders
ORDER BY orders;`,
      alternativeSolutions: [`SELECT n AS orders, count(*) AS customers FROM (SELECT count(*) AS n FROM orders GROUP BY customer_id) t GROUP BY 1 ORDER BY 1;`],
      wrongAnswers: [
        `WITH per_customer AS (SELECT o.customer_id, count(*) AS orders FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY o.customer_id) SELECT orders, count(*) AS customers FROM per_customer GROUP BY orders ORDER BY orders;`,
        `WITH per_customer AS (SELECT customer_id, count(*) AS orders FROM orders WHERE status <> 'cancelled' GROUP BY customer_id) SELECT orders, count(*) AS customers FROM per_customer GROUP BY orders ORDER BY orders;`,
      ],
      explanation: `Two levels of grouping: first per customer, then per count. A CTE names the first level, so the second reads naturally.

Joining order_items before counting counts **lines**, not orders. The task says any status, so cancelled orders count too.`,
      commonMistakes: ['Counting order lines after a join.', 'Filtering statuses the task didn\'t ask to filter.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't20-q05', topic: 20, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Everything under Electronics',
      prompt: `List **all** categories below the root category **Electronics** (slug \`'electronics'\`) at any depth, with their depth below it (direct children = 1).

- **Columns:** \`category_id\`, \`name\`, \`depth\`
- **Sort:** by \`depth\`, then \`category_id\`.`,
      hints: ['Anchor: the children of Electronics (depth 1).', 'Recursive term: `JOIN tree t ON c.parent_id = t.category_id`, depth + 1.'],
      referenceSolution: `WITH RECURSIVE tree AS (
  SELECT c.category_id, c.name, 1 AS depth
  FROM categories c
  JOIN categories root ON root.category_id = c.parent_id
  WHERE root.slug = 'electronics'
  UNION ALL
  SELECT c.category_id, c.name, t.depth + 1
  FROM categories c
  JOIN tree t ON c.parent_id = t.category_id
)
SELECT category_id, name, depth
FROM tree
ORDER BY depth, category_id;`,
      alternativeSolutions: [
        `WITH RECURSIVE t AS (SELECT category_id, name, 0 AS depth FROM categories WHERE slug = 'electronics' UNION ALL SELECT c.category_id, c.name, t.depth + 1 FROM categories c JOIN t ON c.parent_id = t.category_id) SELECT category_id, name, depth FROM t WHERE depth > 0 ORDER BY 3, 1;`,
      ],
      wrongAnswers: [
        `SELECT c.category_id, c.name, 1 AS depth FROM categories c JOIN categories root ON root.category_id = c.parent_id WHERE root.slug = 'electronics' ORDER BY depth, c.category_id;`,
        `WITH RECURSIVE t AS (SELECT category_id, name, 0 AS depth FROM categories WHERE slug = 'electronics' UNION ALL SELECT c.category_id, c.name, t.depth + 1 FROM categories c JOIN t ON c.parent_id = t.category_id) SELECT category_id, name, depth FROM t ORDER BY depth, category_id;`,
      ],
      explanation: `A plain join only reaches one level. The recursive CTE keeps joining children to the rows found in the previous step until a step finds no children: Electronics → Computers → Computer Accessories → Keyboards, and so on.

Starting the anchor at the root itself (depth 0) is fine, as long as you then leave the root out of the result.`,
      commonMistakes: ['Only direct children.', 'Including the root itself.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't20-q06', topic: 20, relatedTopics: [1, 4, 6], difficulty: 'medium', type: 'write-query',
      title: 'Up the management chain',
      prompt: `For the employee with the **highest \`employee_id\` among those at the bottom of the hierarchy** (the deepest level), list that employee and **every manager above them** up to the top, with the number of steps from the employee (the employee is 0).

To keep it simple, the employee is given: use \`employee_id = (SELECT max(employee_id) FROM employees WHERE manager_id IS NOT NULL AND employee_id NOT IN (SELECT manager_id FROM employees WHERE manager_id IS NOT NULL))\`.

- **Columns:** \`steps\`, \`employee_id\`, \`job_title\`
- **Sort:** by \`steps\`.`,
      hints: ['Anchor: the employee (steps 0).', 'Walk **up**: `JOIN chain ch ON e.employee_id = ch.manager_id`.'],
      referenceSolution: `WITH RECURSIVE chain AS (
  SELECT employee_id, manager_id, job_title, 0 AS steps
  FROM employees
  WHERE employee_id = (SELECT max(employee_id) FROM employees
                       WHERE manager_id IS NOT NULL
                         AND employee_id NOT IN (SELECT manager_id FROM employees WHERE manager_id IS NOT NULL))
  UNION ALL
  SELECT e.employee_id, e.manager_id, e.job_title, ch.steps + 1
  FROM employees e
  JOIN chain ch ON e.employee_id = ch.manager_id
)
SELECT steps, employee_id, job_title
FROM chain
ORDER BY steps;`,
      alternativeSolutions: [
        `WITH RECURSIVE me AS (SELECT max(employee_id) AS id FROM employees e WHERE manager_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM employees r WHERE r.manager_id = e.employee_id)), chain AS (SELECT e.employee_id, e.manager_id, e.job_title, 0 AS steps FROM employees e JOIN me ON e.employee_id = me.id UNION ALL SELECT e.employee_id, e.manager_id, e.job_title, c.steps + 1 FROM employees e JOIN chain c ON e.employee_id = c.manager_id) SELECT steps, employee_id, job_title FROM chain ORDER BY 1;`,
      ],
      wrongAnswers: [
        `WITH RECURSIVE chain AS (SELECT employee_id, manager_id, job_title, 0 AS steps FROM employees WHERE employee_id = (SELECT max(employee_id) FROM employees WHERE manager_id IS NOT NULL AND employee_id NOT IN (SELECT manager_id FROM employees WHERE manager_id IS NOT NULL)) UNION ALL SELECT e.employee_id, e.manager_id, e.job_title, ch.steps + 1 FROM employees e JOIN chain ch ON e.manager_id = ch.employee_id) SELECT steps, employee_id, job_title FROM chain ORDER BY steps;`,
        `SELECT 0 AS steps, e.employee_id, e.job_title FROM employees e WHERE e.employee_id = (SELECT max(employee_id) FROM employees WHERE manager_id IS NOT NULL AND employee_id NOT IN (SELECT manager_id FROM employees WHERE manager_id IS NOT NULL)) UNION ALL SELECT 1, m.employee_id, m.job_title FROM employees e JOIN employees m ON m.employee_id = e.manager_id WHERE e.employee_id = (SELECT max(employee_id) FROM employees WHERE manager_id IS NOT NULL AND employee_id NOT IN (SELECT manager_id FROM employees WHERE manager_id IS NOT NULL)) ORDER BY steps;`,
      ],
      explanation: `To walk **up**, the next row is the one whose \`employee_id\` equals the current row's \`manager_id\`. The recursion stops at the top manager, whose \`manager_id\` is NULL (the join finds nothing).

Reversing the join condition walks **down** to the employee's reports. A bottom-level employee has none, so you'd only get the starting row. A self-join reaches just one level.`,
      commonMistakes: ['Joining in the downward direction.', 'A single self-join (one level).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't20-q07', topic: 20, relatedTopics: [1, 4, 5, 11, 14], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: a calendar that won’t build',
      prompt: `This query should show **every day of June 2025** with the number of **phone** orders (\`channel = 'phone'\`) placed that day, **including days with 0**. It fails with a type error. Fix it.

- **Columns:** \`day\` (date), \`phone_orders\`
- **Sort:** by \`day\`.`,
      starterSql: `WITH RECURSIVE days AS (
  SELECT DATE '2025-06-01' AS day
  UNION ALL
  SELECT day + interval '1 day' FROM days WHERE day < DATE '2025-06-30'
)
SELECT d.day, count(o.order_id) AS phone_orders
FROM days d
LEFT JOIN orders o ON o.ordered_at::date = d.day AND o.channel = 'phone'
GROUP BY d.day
ORDER BY d.day;`,
      hints: ['`date + interval` is a **timestamp**, but the anchor column is a **date**.', '`day + 1` adds one day and stays a date.'],
      referenceSolution: `WITH RECURSIVE days AS (
  SELECT DATE '2025-06-01' AS day
  UNION ALL
  SELECT day + 1 FROM days WHERE day < DATE '2025-06-30'
)
SELECT d.day, count(o.order_id) AS phone_orders
FROM days d
LEFT JOIN orders o ON o.ordered_at::date = d.day AND o.channel = 'phone'
GROUP BY d.day
ORDER BY d.day;`,
      alternativeSolutions: [
        `WITH RECURSIVE days AS (SELECT DATE '2025-06-01' AS day UNION ALL SELECT (day + interval '1 day')::date FROM days WHERE day < DATE '2025-06-30') SELECT d.day, count(o.order_id) AS phone_orders FROM days d LEFT JOIN orders o ON o.ordered_at::date = d.day AND o.channel = 'phone' GROUP BY 1 ORDER BY 1;`,
        `SELECT g::date AS day, count(o.order_id) AS phone_orders FROM generate_series(DATE '2025-06-01', DATE '2025-06-30', interval '1 day') g LEFT JOIN orders o ON o.ordered_at::date = g::date AND o.channel = 'phone' GROUP BY 1 ORDER BY 1;`,
      ],
      wrongAnswers: [
        `WITH RECURSIVE days AS (SELECT DATE '2025-06-01' AS day UNION ALL SELECT day + 1 FROM days WHERE day < DATE '2025-06-30') SELECT d.day, count(*) AS phone_orders FROM days d LEFT JOIN orders o ON o.ordered_at::date = d.day AND o.channel = 'phone' GROUP BY d.day ORDER BY d.day;`,
        `WITH RECURSIVE days AS (SELECT DATE '2025-06-01' AS day UNION ALL SELECT day + 1 FROM days WHERE day < DATE '2025-06-30') SELECT d.day, count(o.order_id) AS phone_orders FROM days d LEFT JOIN orders o ON o.ordered_at::date = d.day WHERE o.channel = 'phone' GROUP BY d.day ORDER BY d.day;`,
      ],
      explanation: `The anchor fixes the CTE's column type as **date**. \`day + interval '1 day'\` produces a **timestamp**, and PostgreSQL refuses: *recursive query "days" column 1 has type date in non-recursive term but type timestamp without time zone overall*. \`date + integer\` stays a date (or cast the result back).

The rest is the classic "include empty days" pattern: LEFT JOIN the calendar to the orders, keep the channel filter in the **ON** clause, and count a column from the orders side. \`count(*)\` would count 1 for empty days, and a WHERE on the channel would drop them again.`,
      commonMistakes: ['count(*) instead of count(o.order_id).', 'Putting the channel filter in WHERE.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't20-q08', topic: 20, relatedTopics: [1, 4, 5, 14], difficulty: 'medium', type: 'write-query',
      title: 'Big spenders',
      prompt: `Find customers whose total spend (non-cancelled orders, line values, no shipping) is **more than three times the average customer spend** (the average over customers who spent anything).

- **Columns:** \`customer_id\`, \`spend\` (2 decimals)
- **Sort:** by \`spend\` (highest first), then \`customer_id\`.`,
      hints: ['CTE with one row per customer and their spend.', 'Reference it twice: as the source and in `(SELECT avg(spend) FROM …)`.'],
      referenceSolution: `WITH spend AS (
  SELECT o.customer_id, sum(${lineValue}) AS spend
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.customer_id
)
SELECT customer_id, round(spend, 2) AS spend
FROM spend
WHERE spend > 3 * (SELECT avg(spend) FROM spend)
ORDER BY spend DESC, customer_id;`,
      alternativeSolutions: [`SELECT customer_id, round(s, 2) AS spend FROM (SELECT o.customer_id, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS s, avg(sum(oi.quantity * oi.unit_price * (1 - oi.discount))) OVER () AS a FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1) t WHERE s > 3 * a ORDER BY 2 DESC, 1;`],
      wrongAnswers: [
        `WITH spend AS (SELECT o.customer_id, sum(${lineValue}) AS spend FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id) SELECT customer_id, round(spend, 2) AS spend FROM spend WHERE spend > 3 * (SELECT avg(${lineValue}) FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled') ORDER BY spend DESC, customer_id;`,
        `WITH spend AS (SELECT c.customer_id, coalesce(sum(${lineValue}), 0) AS spend FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status <> 'cancelled' LEFT JOIN order_items oi ON oi.order_id = o.order_id GROUP BY c.customer_id) SELECT customer_id, round(spend, 2) AS spend FROM spend WHERE spend > 3 * (SELECT avg(spend) FROM spend) ORDER BY spend DESC, customer_id;`,
      ],
      explanation: `The CTE is the per-customer table, used twice. The benchmark must be an average **of customer totals**, not of order lines.

Including customers who never spent anything (with 0) lowers the average and lets more customers through. The task defines the average over customers who spent something.`,
      commonMistakes: ['Averaging line values instead of customer totals.', 'Including zero-spend customers in the average.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't20-q09', topic: 20, relatedTopics: [1, 7, 10], difficulty: 'medium', type: 'predict-output',
      title: 'UNION stops a cycle',
      prompt: `What does this query return?`,
      referenceSolution: `WITH RECURSIVE t(n) AS (
  SELECT 1
  UNION
  SELECT n % 3 + 1 FROM t
)
SELECT n FROM t ORDER BY n;`,
      options: [
        { table: { columns: ['n'], rows: [['1'], ['2'], ['3']] } },
        { table: { columns: ['n'], rows: [['1']] } },
        { table: { columns: ['n'], rows: [['1'], ['2'], ['3'], ['1']] } },
        { table: { columns: ['n'], rows: [['1'], ['2']] } },
      ],
      correctOption: 0,
      hints: ['`n % 3 + 1` maps 1 → 2 → 3 → 1. With UNION, rows that were already produced are discarded.'],
      explanation: `The sequence cycles 1, 2, 3, 1, … With \`UNION\` (not UNION ALL), each step's new rows are de-duplicated against everything produced so far. When the step from 3 produces 1 again, it is discarded, the step is empty, and recursion ends. With \`UNION ALL\` this query would never terminate.`,
      commonMistakes: ['Expecting duplicates as with UNION ALL.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't20-q10', topic: 20, relatedTopics: [1, 6, 14], difficulty: 'medium', type: 'write-query',
      title: 'Head count per hierarchy level',
      prompt: `The top of the organisation is the employee without a manager (level 1). Their direct reports are level 2, and so on. Count the employees (current and former) at each level.

- **Columns:** \`level\`, \`employees\`
- **Sort:** by \`level\`.`,
      hints: ['Anchor: `WHERE manager_id IS NULL`, level 1.', 'Recursive term: employees whose manager is in the previous level.'],
      referenceSolution: `WITH RECURSIVE org AS (
  SELECT employee_id, 1 AS level
  FROM employees
  WHERE manager_id IS NULL
  UNION ALL
  SELECT e.employee_id, o.level + 1
  FROM employees e
  JOIN org o ON e.manager_id = o.employee_id
)
SELECT level, count(*) AS employees
FROM org
GROUP BY level
ORDER BY level;`,
      alternativeSolutions: [],
      wrongAnswers: [
        `WITH RECURSIVE org AS (SELECT employee_id, 1 AS level FROM employees UNION ALL SELECT e.employee_id, o.level + 1 FROM employees e JOIN org o ON e.manager_id = o.employee_id) SELECT level, count(*) AS employees FROM org GROUP BY level ORDER BY level;`,
        `SELECT CASE WHEN manager_id IS NULL THEN 1 ELSE 2 END AS level, count(*) AS employees FROM employees GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `The anchor must be the **root only**. If every employee is an anchor (first wrong answer), each one starts its own walk and is counted again at every level below each of their managers.

A recursive walk is the only general way to compute depth. A CASE can only tell "top" from "not top".`,
      commonMistakes: ['Every row as an anchor.', 'Hard-coding levels.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't20-q11', topic: 20, relatedTopics: [1, 4, 6, 9], difficulty: 'hard', type: 'write-query',
      title: 'Breadcrumbs for leaf categories',
      prompt: `For every **leaf** category (one with no subcategories), build its full path from the root, with names joined by \`' > '\`, e.g. \`'Electronics > Computers > Laptops'\`.

- **Columns:** \`category_id\`, \`path\`
- **Sort:** by \`path\`.`,
      hints: ['Start at the roots and append the child\'s name on the way down: `t.path || \' > \' || c.name`.', 'Keep the leaves: `NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = t.category_id)`.', 'Cast the anchor\'s name to `text`, so the column type fits the longer paths.'],
      referenceSolution: `WITH RECURSIVE tree AS (
  SELECT category_id, name::text AS path
  FROM categories
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.category_id, t.path || ' > ' || c.name
  FROM categories c
  JOIN tree t ON c.parent_id = t.category_id
)
SELECT t.category_id, t.path
FROM tree t
WHERE NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = t.category_id)
ORDER BY t.path;`,
      alternativeSolutions: [
        `WITH RECURSIVE up AS (SELECT c.category_id AS leaf, c.parent_id, c.name::text AS path FROM categories c WHERE c.category_id NOT IN (SELECT parent_id FROM categories WHERE parent_id IS NOT NULL) UNION ALL SELECT u.leaf, p.parent_id, p.name || ' > ' || u.path FROM up u JOIN categories p ON p.category_id = u.parent_id) SELECT leaf AS category_id, path FROM up WHERE parent_id IS NULL ORDER BY 2;`,
      ],
      wrongAnswers: [
        `WITH RECURSIVE tree AS (SELECT category_id, name::text AS path FROM categories WHERE parent_id IS NULL UNION ALL SELECT c.category_id, c.name || ' > ' || t.path FROM categories c JOIN tree t ON c.parent_id = t.category_id) SELECT t.category_id, t.path FROM tree t WHERE NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = t.category_id) ORDER BY t.path;`,
        `WITH RECURSIVE tree AS (SELECT category_id, name::text AS path FROM categories WHERE parent_id IS NULL UNION ALL SELECT c.category_id, t.path || ' > ' || c.name FROM categories c JOIN tree t ON c.parent_id = t.category_id) SELECT t.category_id, t.path FROM tree t ORDER BY t.path;`,
      ],
      explanation: `The path is accumulated as the recursion goes **down**: each step appends the child's name to its parent's path. Prepending instead builds the path backwards ("Laptops > Computers > Electronics").

The alternative walks **up** from each leaf, prepending parent names, and keeps the row that reached a root. Both are common. Without the leaf filter you get a breadcrumb for every category.`,
      commonMistakes: ['Building the path in reverse order.', 'Including non-leaf categories.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't20-q12', topic: 20, relatedTopics: [1, 4, 5, 14], difficulty: 'hard', type: 'write-query',
      title: 'Revenue per top-level category',
      prompt: `Products are attached to categories at various depths. Report the revenue (non-cancelled orders, line values) of each **root category**, counting the sales of **all categories below it** at any depth.

- **Columns:** \`root_id\`, \`root_name\`, \`revenue\` (2 decimals)
- **Sort:** by \`revenue\` (highest first), then \`root_id\`.`,
      hints: ['A recursive CTE that maps every category to its root: the anchor is the roots (root_id = category_id), and children inherit their parent\'s root_id.', 'Then join products → order_items → orders and group by root.'],
      referenceSolution: `WITH RECURSIVE to_root AS (
  SELECT category_id, category_id AS root_id
  FROM categories
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.category_id, t.root_id
  FROM categories c
  JOIN to_root t ON c.parent_id = t.category_id
)
SELECT r.root_id, rc.name AS root_name, round(sum(${lineValue}), 2) AS revenue
FROM to_root r
JOIN categories rc  ON rc.category_id = r.root_id
JOIN products p     ON p.category_id = r.category_id
JOIN order_items oi ON oi.product_id = p.product_id
JOIN orders o       ON o.order_id = oi.order_id
WHERE o.status <> 'cancelled'
GROUP BY r.root_id, rc.name
ORDER BY revenue DESC, r.root_id;`,
      alternativeSolutions: [],
      wrongAnswers: [
        `SELECT c.parent_id AS root_id, rc.name AS root_name, round(sum(${lineValue}), 2) AS revenue FROM categories c JOIN categories rc ON rc.category_id = c.parent_id JOIN products p ON p.category_id = c.category_id JOIN order_items oi ON oi.product_id = p.product_id JOIN orders o ON o.order_id = oi.order_id WHERE o.status <> 'cancelled' AND rc.parent_id IS NULL GROUP BY c.parent_id, rc.name ORDER BY revenue DESC, root_id;`,
        `SELECT rc.category_id AS root_id, rc.name AS root_name, round(sum(${lineValue}), 2) AS revenue FROM categories rc JOIN products p ON p.category_id = rc.category_id JOIN order_items oi ON oi.product_id = p.product_id JOIN orders o ON o.order_id = oi.order_id WHERE o.status <> 'cancelled' AND rc.parent_id IS NULL GROUP BY rc.category_id, rc.name ORDER BY revenue DESC, root_id;`,
      ],
      explanation: `The trick is to carry the **root id down** the tree: the anchor sets \`root_id = category_id\` for each root, and every child copies its parent's \`root_id\`. The result maps each category, at whatever depth, to its root, and an ordinary join and GROUP BY finishes the job.

Joining only children directly under the roots misses products in deeper categories (Laptops sits two levels below Electronics). Products attached to the roots themselves: there are none.`,
      commonMistakes: ['Only one level below the root.', 'Only products attached to the root category itself.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't20-q13', topic: 20, relatedTopics: [1, 4, 6], difficulty: 'hard', type: 'write-query',
      title: 'Referral chains',
      prompt: `Customers can be referred by other customers (\`referred_by\`), who may themselves have been referred, and so on. For every customer who is **at least 3 steps** from the start of their chain, show the **original referrer** (the customer at the top, who wasn't referred by anyone) and the number of steps.

- **Columns:** \`customer_id\`, \`original_referrer\`, \`steps\`
- **Sort:** by \`steps\` (highest first), then \`customer_id\`.`,
      hints: ['Anchor: customers with `referred_by IS NULL`, with `original_referrer = customer_id` and steps 0.', 'Recursive term: customers referred by someone in the previous step inherit `original_referrer`, steps + 1.'],
      referenceSolution: `WITH RECURSIVE chain AS (
  SELECT customer_id, customer_id AS original_referrer, 0 AS steps
  FROM customers
  WHERE referred_by IS NULL
  UNION ALL
  SELECT c.customer_id, ch.original_referrer, ch.steps + 1
  FROM customers c
  JOIN chain ch ON c.referred_by = ch.customer_id
)
SELECT customer_id, original_referrer, steps
FROM chain
WHERE steps >= 3
ORDER BY steps DESC, customer_id;`,
      alternativeSolutions: [
        `WITH RECURSIVE up AS (SELECT customer_id AS start, referred_by AS next, customer_id AS cur, 0 AS steps FROM customers UNION ALL SELECT u.start, c.referred_by, c.customer_id, u.steps + 1 FROM up u JOIN customers c ON c.customer_id = u.next) SELECT start AS customer_id, cur AS original_referrer, steps FROM up WHERE next IS NULL AND steps >= 3 ORDER BY 3 DESC, 1;`,
      ],
      wrongAnswers: [
        `WITH RECURSIVE chain AS (SELECT customer_id, customer_id AS original_referrer, 0 AS steps FROM customers WHERE referred_by IS NULL UNION ALL SELECT c.customer_id, c.referred_by, ch.steps + 1 FROM customers c JOIN chain ch ON c.referred_by = ch.customer_id) SELECT customer_id, original_referrer, steps FROM chain WHERE steps >= 3 ORDER BY steps DESC, customer_id;`,
        `WITH RECURSIVE chain AS (SELECT customer_id, customer_id AS original_referrer, 1 AS steps FROM customers WHERE referred_by IS NULL UNION ALL SELECT c.customer_id, ch.original_referrer, ch.steps + 1 FROM customers c JOIN chain ch ON c.referred_by = ch.customer_id) SELECT customer_id, original_referrer, steps FROM chain WHERE steps >= 3 ORDER BY steps DESC, customer_id;`,
      ],
      explanation: `To know the top of the chain at every depth, **carry it along**: set it once in the anchor and copy it unchanged in each step. Writing \`c.referred_by\` instead gives the *direct* referrer, which is just the previous link.

Counting starts at 0 for the original referrer, so "3 steps" means three referrals deep. The upward alternative starts from every customer and climbs until \`referred_by\` is NULL.`,
      commonMistakes: ['Recording the direct referrer instead of the original one.', 'Counting the referrer as step 1.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't20-q14', topic: 20, relatedTopics: [2, 3, 14], difficulty: 'hard', type: 'predict-output',
      title: 'What the main query sees',
      prompt: `What does the **last** statement return?`,
      referenceSolution: `CREATE TABLE t (x integer);
INSERT INTO t VALUES (1), (2), (3);
WITH removed AS (
  DELETE FROM t WHERE x > 1 RETURNING x
)
SELECT (SELECT count(*) FROM t)       AS rows_seen,
       (SELECT count(*) FROM removed) AS rows_deleted;`,
      options: [
        { table: { columns: ['rows_seen', 'rows_deleted'], rows: [['3', '2']] } },
        { table: { columns: ['rows_seen', 'rows_deleted'], rows: [['1', '2']] } },
        { table: { columns: ['rows_seen', 'rows_deleted'], rows: [['1', '0']] } },
        { table: { columns: ['rows_seen', 'rows_deleted'], rows: [['3', '0']] } },
      ],
      correctOption: 0,
      hints: ['All parts of one statement run on the same snapshot of the data.'],
      explanation: `The data-modifying CTE does delete two rows, and its RETURNING output (\`removed\`) has 2 rows. But the main query reads \`t\` from the **snapshot taken when the statement started**, before the delete, so it still counts 3. Afterwards, a new statement would see 1 row. To work with the changed rows within the same statement, use the RETURNING output.`,
      commonMistakes: ['Expecting the main query to see the CTE\'s changes.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't20-q15', topic: 20, relatedTopics: [1, 6, 14], difficulty: 'interview', type: 'write-query',
      title: 'Everyone under each manager',
      prompt: `For every employee who has at least one report, count **all** the employees below them in the hierarchy (direct and indirect, current and former), and sum those employees' salaries.

- **Columns:** \`manager_id\`, \`reports\`, \`team_salary\`
- **Sort:** by \`reports\` (highest first), then \`manager_id\`.`,
      hints: ['Build all (manager, subordinate) pairs: the anchor is every direct pair, and the recursive term extends a pair one level down.', 'Then join to employees for the subordinate\'s salary and group by manager.'],
      referenceSolution: `WITH RECURSIVE below AS (
  SELECT manager_id, employee_id AS subordinate_id
  FROM employees
  WHERE manager_id IS NOT NULL
  UNION ALL
  SELECT b.manager_id, e.employee_id
  FROM below b
  JOIN employees e ON e.manager_id = b.subordinate_id
)
SELECT b.manager_id, count(*) AS reports, sum(e.salary) AS team_salary
FROM below b
JOIN employees e ON e.employee_id = b.subordinate_id
GROUP BY b.manager_id
ORDER BY reports DESC, b.manager_id;`,
      alternativeSolutions: [
        `WITH RECURSIVE up AS (SELECT employee_id AS sub, manager_id AS boss FROM employees WHERE manager_id IS NOT NULL UNION ALL SELECT u.sub, e.manager_id FROM up u JOIN employees e ON e.employee_id = u.boss WHERE e.manager_id IS NOT NULL) SELECT u.boss AS manager_id, count(*) AS reports, sum(s.salary) AS team_salary FROM up u JOIN employees s ON s.employee_id = u.sub GROUP BY 1 ORDER BY 2 DESC, 1;`,
      ],
      wrongAnswers: [
        `SELECT manager_id, count(*) AS reports, sum(salary) AS team_salary FROM employees WHERE manager_id IS NOT NULL GROUP BY manager_id ORDER BY reports DESC, manager_id;`,
        `WITH RECURSIVE below AS (SELECT manager_id, employee_id AS subordinate_id FROM employees WHERE manager_id IS NOT NULL UNION ALL SELECT b.manager_id, e.employee_id FROM below b JOIN employees e ON e.manager_id = b.subordinate_id) SELECT b.manager_id, count(*) AS reports, sum(e.salary) AS team_salary FROM below b JOIN employees e ON e.employee_id = b.manager_id GROUP BY b.manager_id ORDER BY reports DESC, b.manager_id;`,
      ],
      explanation: `This builds the hierarchy's **transitive closure**: every (manager, anyone-below) pair. The anchor holds direct reports. Each step takes a pair (M, S) and adds (M, S's reports), so the original manager is carried along while the subordinate moves down.

GROUP BY on the plain table only counts direct reports. Joining the salary on the manager instead of the subordinate sums the manager's own salary once per report.`,
      commonMistakes: ['Direct reports only.', 'Joining salaries on the wrong side of the pair.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't20-q16', topic: 20, relatedTopics: [1, 4, 5, 10, 14, 17], difficulty: 'interview', type: 'write-query',
      title: 'How concentrated is each category?',
      prompt: `For each category with **at least 4 products sold**, what share of the category's revenue (non-cancelled orders, line values) comes from its **top 3 products**? Build it as a chain of CTEs.

- **Columns:** \`category_id\`, \`top3_revenue\`, \`category_revenue\` (2 decimals), \`top3_share_pct\` (1 decimal)
- **Sort:** by \`top3_share_pct\` (highest first), then \`category_id\`.`,
      hints: ['CTE 1: revenue per product (with its category).', 'CTE 2: `row_number() OVER (PARTITION BY category_id ORDER BY revenue DESC, product_id)` and `count(*) OVER (PARTITION BY category_id)`.', 'Main query: sum with `FILTER (WHERE rn <= 3)` against the full sum, per category.'],
      referenceSolution: `WITH product_revenue AS (
  SELECT p.category_id, p.product_id, sum(${lineValue}) AS revenue
  FROM order_items oi
  JOIN orders o   ON o.order_id = oi.order_id
  JOIN products p ON p.product_id = oi.product_id
  WHERE o.status <> 'cancelled'
  GROUP BY p.category_id, p.product_id
), ranked AS (
  SELECT category_id, revenue,
         row_number() OVER (PARTITION BY category_id ORDER BY revenue DESC, product_id) AS rn,
         count(*)     OVER (PARTITION BY category_id) AS products_sold
  FROM product_revenue
)
SELECT category_id,
       round(sum(revenue) FILTER (WHERE rn <= 3), 2) AS top3_revenue,
       round(sum(revenue), 2) AS category_revenue,
       round(100 * sum(revenue) FILTER (WHERE rn <= 3) / sum(revenue), 1) AS top3_share_pct
FROM ranked
WHERE products_sold >= 4
GROUP BY category_id
ORDER BY top3_share_pct DESC, category_id;`,
      alternativeSolutions: [],
      wrongAnswers: [
        `WITH product_revenue AS (SELECT p.category_id, p.product_id, sum(${lineValue}) AS revenue FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status <> 'cancelled' GROUP BY p.category_id, p.product_id), ranked AS (SELECT category_id, revenue, row_number() OVER (PARTITION BY category_id ORDER BY revenue DESC, product_id) AS rn, count(*) OVER (PARTITION BY category_id) AS products_sold FROM product_revenue)
SELECT category_id, round(sum(revenue), 2) AS top3_revenue, round(sum(revenue), 2) AS category_revenue, round(100.0, 1) AS top3_share_pct FROM ranked WHERE products_sold >= 4 AND rn <= 3 GROUP BY category_id ORDER BY top3_share_pct DESC, category_id;`,
        `WITH product_revenue AS (SELECT p.category_id, p.product_id, sum(${lineValue}) AS revenue FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status <> 'cancelled' GROUP BY p.category_id, p.product_id), ranked AS (SELECT category_id, revenue, row_number() OVER (PARTITION BY category_id ORDER BY revenue, product_id) AS rn, count(*) OVER (PARTITION BY category_id) AS products_sold FROM product_revenue)
SELECT category_id, round(sum(revenue) FILTER (WHERE rn <= 3), 2) AS top3_revenue, round(sum(revenue), 2) AS category_revenue, round(100 * sum(revenue) FILTER (WHERE rn <= 3) / sum(revenue), 1) AS top3_share_pct FROM ranked WHERE products_sold >= 4 GROUP BY category_id ORDER BY top3_share_pct DESC, category_id;`,
      ],
      explanation: `Each CTE does one job: product totals, then ranks within the category, then the final comparison. Readers (and you, next month) can check each step on its own.

The key move is filtering **inside the aggregate** (\`FILTER (WHERE rn <= 3)\`) rather than in WHERE. A WHERE on \`rn <= 3\` would also shrink the denominator to the top 3, giving 100% everywhere. Ranking ascending picks the three *weakest* products.`,
      commonMistakes: ['Filtering rn <= 3 in WHERE, which shrinks the denominator.', 'Ascending order in the ranking.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
