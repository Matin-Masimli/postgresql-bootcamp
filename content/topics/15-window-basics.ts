import type { Topic } from '../types.ts';

const explanation = `A **window function** computes a value from a set of related rows, its *window*, but unlike GROUP BY it **keeps every row**. You get the detail *and* the aggregate side by side.

\`\`\`sql
SELECT order_item_id, order_id,
       quantity * unit_price                          AS line_value,
       sum(quantity * unit_price) OVER (PARTITION BY order_id) AS order_total,
       count(*) OVER (PARTITION BY order_id)          AS lines_in_order
FROM order_items
WHERE order_id <= 3
ORDER BY order_item_id;
\`\`\`

## Anatomy of OVER

\`\`\`text
function(args) OVER (
    PARTITION BY …     -- which rows belong together (default: all rows)
    ORDER BY …         -- order inside each partition (needed for ranking, running totals, LAG…)
    frame              -- ROWS/RANGE … (Topic 16)
)
\`\`\`

- \`OVER ()\`: the window is the whole result: \`count(*) OVER ()\` = total rows, on every row.
- \`OVER (PARTITION BY x)\`: the rows with the same x. Each partition is computed independently.
- Any aggregate (\`sum\`, \`avg\`, \`min\`, \`max\`, \`count\`) can be used as a window function. Ranking functions (Topic 17) and value functions (Topic 18) **only** work with OVER.

## GROUP BY versus windows

| | GROUP BY | window |
|---|---|---|
| rows out | one per group | **all** input rows |
| can show detail columns | only grouped ones | any |
| typical use | totals per group | "compare each row with its group" |

\`\`\`sql
-- Each product's price next to its category's average and maximum
SELECT product_id, category_id, price,
       round(avg(price) OVER (PARTITION BY category_id), 2) AS category_avg,
       max(price)       OVER (PARTITION BY category_id)     AS category_max
FROM products
ORDER BY category_id, product_id
LIMIT 10;
\`\`\`

## ORDER BY inside OVER changes the meaning

With an ORDER BY in the window, an aggregate becomes **cumulative**: it covers the rows from the start of the partition up to the current row, **including rows that tie with it** (peers). Without ORDER BY it covers the whole partition. Topic 16 explores this in depth.

\`\`\`sql
SELECT x,
       sum(x) OVER ()            AS whole_total,
       sum(x) OVER (ORDER BY x)  AS running_total
FROM (VALUES (1), (2), (2), (3)) AS t(x);
\`\`\`

## When windows are evaluated

Logical order: FROM → WHERE → GROUP BY → HAVING → **window functions** → SELECT list → DISTINCT → ORDER BY → LIMIT.

So:

- **WHERE runs first.** Rows it removes are not in any window. "Is this the customer's first order?" must be computed over *all* orders before you filter.
- **You can't filter on a window function in WHERE.** Compute it in a subquery or CTE, and filter outside (Topics 19–20).
- **Windows can use aggregates:** \`sum(sum(x)) OVER ()\` in a grouped query gives the grand total next to each group.

Reuse a definition with a named window: \`… OVER w … WINDOW w AS (PARTITION BY department_id)\`.

## Gotchas

- \`avg(x) OVER (ORDER BY …)\` is a *running* average, not the group average. Leave out ORDER BY for the group value.
- PARTITION BY uses equality: all NULLs form one partition.
- Window results aren't available in WHERE, GROUP BY or HAVING of the same query level.`;

const lineValue = 'oi.quantity * oi.unit_price * (1 - oi.discount)';

const topic: Topic = {
  id: 15,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18 Tutorial: Window Functions (3.5)', url: 'https://www.postgresql.org/docs/18/tutorial-window.html' },
    { title: 'PostgreSQL 18: Window Function Calls (4.2.8)', url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS' },
    { title: 'PostgreSQL 18: Window Function Processing (7.2.5)', url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-WINDOW' },
    { title: 'Neon PostgreSQL Tutorial: Window Functions', url: 'https://neon.com/postgresql/postgresql-window-function' },
    { title: 'ThoughtSpot (Mode) SQL Tutorial: Window Functions', url: 'https://www.thoughtspot.com/sql-tutorial/sql-window-functions' },
  ],
  questions: [
    {
      id: 't15-q01', topic: 15, relatedTopics: [1, 4, 10], difficulty: 'easy', type: 'write-query',
      title: 'Line value next to the order total',
      prompt: `For the lines of orders **1 to 5**, show each line's value (\`quantity * unit_price * (1 - discount)\`, rounded to 2 decimals) and, on the same row, the **total of its order** (also rounded).

- **Columns:** \`order_item_id\`, \`order_id\`, \`line_value\`, \`order_total\`
- **Sort:** by \`order_item_id\`.`,
      hints: ['`sum(…) OVER (PARTITION BY order_id)` sums all lines of the same order, on every line.'],
      referenceSolution: `SELECT order_item_id, order_id,
       round(quantity * unit_price * (1 - discount), 2) AS line_value,
       round(sum(quantity * unit_price * (1 - discount)) OVER (PARTITION BY order_id), 2) AS order_total
FROM order_items
WHERE order_id BETWEEN 1 AND 5
ORDER BY order_item_id;`,
      alternativeSolutions: [`SELECT order_item_id, order_id, round(quantity * unit_price * (1 - discount), 2) AS line_value, round(sum(quantity * unit_price * (1 - discount)) OVER w, 2) AS order_total FROM order_items WHERE order_id <= 5 WINDOW w AS (PARTITION BY order_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_item_id, order_id, round(quantity * unit_price * (1 - discount), 2) AS line_value, round(sum(quantity * unit_price * (1 - discount)) OVER (), 2) AS order_total FROM order_items WHERE order_id BETWEEN 1 AND 5 ORDER BY order_item_id;`,
        `SELECT order_item_id, order_id, round(quantity * unit_price * (1 - discount), 2) AS line_value, round(sum(quantity * unit_price * (1 - discount)) OVER (PARTITION BY order_id ORDER BY order_item_id), 2) AS order_total FROM order_items WHERE order_id BETWEEN 1 AND 5 ORDER BY order_item_id;`,
      ],
      explanation: `\`PARTITION BY order_id\` makes each order its own window, so the sum covers that order's lines and appears on every one of them. \`OVER ()\` would be the total of all five orders.

Adding an ORDER BY inside the window turns the sum into a *running* total (Topic 16). That's not what's asked here.`,
      commonMistakes: ['OVER () instead of PARTITION BY.', 'ORDER BY inside the window, which gives a running sum.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q02', topic: 15, relatedTopics: [14], difficulty: 'easy', type: 'concept-mc',
      title: 'How many rows come out?',
      prompt: `\`orders\` has 7 785 rows on the practice data, with 4 channels. How many rows do these return?

1. \`SELECT channel, count(*) FROM orders GROUP BY channel;\`
2. \`SELECT channel, count(*) OVER (PARTITION BY channel) FROM orders;\``,
      options: [{ text: '4 and 4' }, { text: '4 and 7 785' }, { text: '7 785 and 4' }, { text: '7 785 and 7 785' }],
      correctOption: 1,
      hints: ['Do window functions collapse rows?'],
      explanation: `GROUP BY returns **one row per group** (4). A window function returns **every input row** (7 785), each carrying its group's count. Add DISTINCT to the second query and you'd be back to 4.`,
      commonMistakes: ['Thinking PARTITION BY groups rows like GROUP BY.'],
    },
    {
      id: 't15-q03', topic: 15, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Counting with OVER',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT g, x,
       count(*) OVER ()               AS total,
       count(*) OVER (PARTITION BY g) AS in_group
FROM (VALUES ('a', 1), ('a', 2), ('b', 3)) AS t(g, x)
ORDER BY x;`,
      options: [
        { table: { columns: ['g', 'x', 'total', 'in_group'], rows: [['a', '1', '3', '2'], ['a', '2', '3', '2'], ['b', '3', '3', '1']] } },
        { table: { columns: ['g', 'x', 'total', 'in_group'], rows: [['a', '1', '1', '1'], ['a', '2', '2', '2'], ['b', '3', '3', '1']] } },
        { table: { columns: ['g', 'x', 'total', 'in_group'], rows: [['a', '1', '3', '2'], ['b', '3', '3', '1']] } },
        { table: { columns: ['g', 'x', 'total', 'in_group'], rows: [['a', '1', '2', '2'], ['a', '2', '2', '2'], ['b', '3', '1', '1']] } },
      ],
      correctOption: 0,
      hints: ['OVER () is the whole result. PARTITION BY g is the rows with the same g.'],
      explanation: `Every row keeps its identity. \`count(*) OVER ()\` counts all 3 rows, and \`PARTITION BY g\` counts the rows sharing the row's g: 2 for 'a', 1 for 'b'. Without an ORDER BY in the window, the count is over the whole partition, not cumulative.`,
      commonMistakes: ['Expecting cumulative counts without an ORDER BY.', 'Expecting rows to collapse.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't15-q04', topic: 15, relatedTopics: [1, 10], difficulty: 'easy', type: 'write-query',
      title: 'Price versus category average',
      prompt: `For every product, show its price, the **average price of its category** (rounded to 2 decimals) and the **difference** \`price - category average\` (rounded to 2 decimals).

- **Columns:** \`product_id\`, \`category_id\`, \`price\`, \`category_avg\`, \`diff\`
- **Sort:** by \`product_id\`.`,
      hints: ['`avg(price) OVER (PARTITION BY category_id)`. Compute the difference from the unrounded average.'],
      referenceSolution: `SELECT product_id, category_id, price,
       round(avg(price) OVER (PARTITION BY category_id), 2)          AS category_avg,
       round(price - avg(price) OVER (PARTITION BY category_id), 2)  AS diff
FROM products
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT product_id, category_id, price, round(a, 2) AS category_avg, round(price - a, 2) AS diff FROM (SELECT product_id, category_id, price, avg(price) OVER (PARTITION BY category_id) AS a FROM products) t ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id, category_id, price, round(avg(price) OVER (), 2) AS category_avg, round(price - avg(price) OVER (), 2) AS diff FROM products ORDER BY product_id;`,
        `SELECT product_id, category_id, price, round(avg(price) OVER (PARTITION BY category_id ORDER BY product_id), 2) AS category_avg, round(price - avg(price) OVER (PARTITION BY category_id ORDER BY product_id), 2) AS diff FROM products ORDER BY product_id;`,
      ],
      explanation: `The window average sits on every row, so you can do arithmetic with it directly. That's impossible with GROUP BY, which would have removed the individual products.

Adding ORDER BY to the window turns it into a running average: product 1's "average" would be its own price.`,
      commonMistakes: ['The overall average instead of the category\'s.', 'ORDER BY inside the window.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q05', topic: 15, relatedTopics: [1, 10], difficulty: 'medium', type: 'write-query',
      title: 'Share of the total budget',
      prompt: `For each department **with a budget**, show what percentage of the **total budget of all departments** it represents (1 decimal).

- **Columns:** \`name\`, \`budget\`, \`share_pct\`
- **Sort:** by \`share_pct\` (highest first), then \`name\`.`,
      hints: ['`sum(budget) OVER ()` is the grand total on every row.', 'Departments with a NULL budget are excluded before the window, so they aren\'t in the total either. Is that what you want? Here, yes.'],
      referenceSolution: `SELECT name, budget,
       round(100 * budget / sum(budget) OVER (), 1) AS share_pct
FROM departments
WHERE budget IS NOT NULL
ORDER BY share_pct DESC, name;`,
      alternativeSolutions: [`SELECT name, budget, round(budget * 100.0 / (SELECT sum(budget) FROM departments), 1) AS share_pct FROM departments WHERE budget IS NOT NULL ORDER BY 3 DESC, 1;`],
      wrongAnswers: [
        `SELECT name, budget, round(100 * budget / sum(budget) OVER (PARTITION BY name), 1) AS share_pct FROM departments WHERE budget IS NOT NULL ORDER BY share_pct DESC, name;`,
        `SELECT name, budget, round(100 * budget / sum(budget) OVER (ORDER BY budget DESC), 1) AS share_pct FROM departments WHERE budget IS NOT NULL ORDER BY share_pct DESC, name;`,
      ],
      explanation: `"Share of total" = value / total. \`sum(budget) OVER ()\` puts the total on every row. Partitioning by name makes each department its own total (100% everywhere), and an ORDER BY makes the total cumulative.

\`budget\` is numeric, so \`100 * budget / …\` is exact.`,
      commonMistakes: ['Partitioning by the row\'s own key.', 'A running total as the denominator.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't15-q06', topic: 15, relatedTopics: [1, 4, 5], previewTopics: [19], difficulty: 'medium', type: 'write-query',
      title: 'Paid above the department average',
      prompt: `List **active** employees whose salary is **above the average salary of their department's active employees**. Employees without a department are left out.

- **Columns:** \`department_id\`, \`employee_id\`, \`salary\`, \`dept_avg\` (rounded to 2 decimals)
- **Sort:** by \`department_id\`, then \`salary\` (highest first), then \`employee_id\`.`,
      hints: ['Compute `avg(salary) OVER (PARTITION BY department_id)` in a subquery over active employees.', 'Filter `salary > dept_avg` outside. Window results can\'t be used in WHERE of the same query.'],
      referenceSolution: `SELECT department_id, employee_id, salary, round(dept_avg, 2) AS dept_avg
FROM (
  SELECT department_id, employee_id, salary,
         avg(salary) OVER (PARTITION BY department_id) AS dept_avg
  FROM employees
  WHERE termination_date IS NULL
    AND department_id IS NOT NULL
) AS e
WHERE salary > dept_avg
ORDER BY department_id, salary DESC, employee_id;`,
      alternativeSolutions: [`SELECT e.department_id, e.employee_id, e.salary, round(d.a, 2) AS dept_avg FROM employees e JOIN (SELECT department_id, avg(salary) AS a FROM employees WHERE termination_date IS NULL GROUP BY 1) d USING (department_id) WHERE e.termination_date IS NULL AND e.salary > d.a ORDER BY 1, 3 DESC, 2;`],
      wrongAnswers: [
        `SELECT department_id, employee_id, salary, round(dept_avg, 2) AS dept_avg FROM (SELECT department_id, employee_id, salary, termination_date, avg(salary) OVER (PARTITION BY department_id) AS dept_avg FROM employees WHERE department_id IS NOT NULL) AS e WHERE salary > dept_avg AND termination_date IS NULL ORDER BY department_id, salary DESC, employee_id;`,
        `SELECT department_id, employee_id, salary, round(dept_avg, 2) AS dept_avg FROM (SELECT department_id, employee_id, salary, avg(salary) OVER () AS dept_avg FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL) AS e WHERE salary > dept_avg ORDER BY department_id, salary DESC, employee_id;`,
      ],
      explanation: `Two lessons:

1. You can't write \`WHERE salary > avg(salary) OVER (…)\`, because windows are computed after WHERE. Compute the average in an inner query and compare outside.
2. **What's in the window matters.** The task says "average of the department's *active* employees", so the active filter belongs *inside*, before the window. Filtering afterwards (first wrong answer) lets former employees' salaries distort the average.`,
      commonMistakes: ['Filtering active employees after computing the average.', 'The company-wide average.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q07', topic: 15, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Orders per customer on each order',
      prompt: `For customers living in **Chile** (\`country_id = 6\`), list all their orders, and on each row show **how many orders that customer has in total** and the date of their **first** and **latest** order (UTC dates).

- **Columns:** \`customer_id\`, \`order_id\`, \`orders_total\`, \`first_order\`, \`latest_order\`
- **Sort:** by \`customer_id\`, then \`order_id\`.`,
      hints: ['count, min and max as window functions, partitioned by customer.', 'A named window keeps it short: `WINDOW w AS (PARTITION BY o.customer_id)`.'],
      referenceSolution: `SELECT o.customer_id, o.order_id,
       count(*)              OVER w AS orders_total,
       min(o.ordered_at::date) OVER w AS first_order,
       max(o.ordered_at::date) OVER w AS latest_order
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE c.country_id = 6
WINDOW w AS (PARTITION BY o.customer_id)
ORDER BY o.customer_id, o.order_id;`,
      alternativeSolutions: [`SELECT o.customer_id, o.order_id, count(*) OVER (PARTITION BY o.customer_id) AS orders_total, (min(o.ordered_at) OVER (PARTITION BY o.customer_id))::date AS first_order, (max(o.ordered_at) OVER (PARTITION BY o.customer_id))::date AS latest_order FROM orders o WHERE o.customer_id IN (SELECT customer_id FROM customers WHERE country_id = 6) ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT o.customer_id, o.order_id, count(*) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at) AS orders_total, min(o.ordered_at::date) OVER (PARTITION BY o.customer_id) AS first_order, max(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at) AS latest_order FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 ORDER BY o.customer_id, o.order_id;`,
        `SELECT o.customer_id, o.order_id, count(*) OVER () AS orders_total, min(o.ordered_at::date) OVER () AS first_order, max(o.ordered_at::date) OVER () AS latest_order FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 ORDER BY o.customer_id, o.order_id;`,
      ],
      explanation: `Several window aggregates can share one window, and the \`WINDOW\` clause names it once. Without ORDER BY in the window, each function sees all of the customer's orders, so every row shows the same totals.

With an ORDER BY, count and max become "so far" values: the 1st order would show 1 order, and its own date as the latest.`,
      commonMistakes: ['ORDER BY inside the window (running values).', 'No PARTITION BY.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q08', topic: 15, relatedTopics: [1, 14], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: price next to the category average',
      prompt: `This query should list every product with its price and its **category's average price** (rounded to 2 decimals). It fails. Fix it.

- **Columns:** \`product_id\`, \`category_id\`, \`price\`, \`category_avg\`
- **Sort:** by \`product_id\`.`,
      starterSql: `SELECT product_id, category_id, price, round(avg(price), 2) AS category_avg
FROM products
GROUP BY category_id
ORDER BY product_id;`,
      hints: ['GROUP BY collapses the products of each category into one row, so product_id and price no longer exist individually.', 'You want the average *and* every row: a window function.'],
      referenceSolution: `SELECT product_id, category_id, price,
       round(avg(price) OVER (PARTITION BY category_id), 2) AS category_avg
FROM products
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT p.product_id, p.category_id, p.price, round(a.avg_price, 2) AS category_avg FROM products p JOIN (SELECT category_id, avg(price) AS avg_price FROM products GROUP BY 1) a USING (category_id) ORDER BY 1;`],
      wrongAnswers: [`SELECT product_id, category_id, price, round(avg(price), 2) AS category_avg FROM products GROUP BY product_id ORDER BY product_id;`],
      explanation: `GROUP BY can only output one row per category, so selecting product_id and price fails (*must appear in the GROUP BY clause…*). Grouping by product_id instead makes each product its own group, and the "average" is just its own price.

\`avg(price) OVER (PARTITION BY category_id)\` computes the category average without collapsing rows. That's exactly what window functions are for. Joining a grouped subquery back (the alternative) is the pre-window way to do it.`,
      commonMistakes: ['Grouping by the product, which makes the average trivial.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q09', topic: 15, relatedTopics: [1, 4, 5, 14], difficulty: 'medium', type: 'write-query',
      title: 'Each order versus the customer’s biggest',
      prompt: `For orders placed in **2025** (non-cancelled), compute each order's value (sum of line values, without shipping, rounded to 2 decimals) and the value of that **customer's largest 2025 order**.

- **Columns:** \`order_id\`, \`customer_id\`, \`order_value\`, \`customer_max\`
- **Sort:** by \`customer_id\`, then \`order_id\`.`,
      hints: ['GROUP BY order to get order values. In the same query, `max(sum(…)) OVER (PARTITION BY customer_id)` puts the customer maximum next to each order.'],
      referenceSolution: `SELECT o.order_id, o.customer_id,
       round(sum(${lineValue}), 2) AS order_value,
       round(max(sum(${lineValue})) OVER (PARTITION BY o.customer_id), 2) AS customer_max
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
  AND o.ordered_at >= '2025-01-01' AND o.ordered_at < '2026-01-01'
GROUP BY o.order_id
ORDER BY o.customer_id, o.order_id;`,
      alternativeSolutions: [`SELECT order_id, customer_id, round(v, 2) AS order_value, round(max(v) OVER (PARTITION BY customer_id), 2) AS customer_max FROM (SELECT o.order_id, o.customer_id, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS v FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' AND o.ordered_at >= '2025-01-01' GROUP BY 1, 2) t ORDER BY 2, 1;`],
      wrongAnswers: [
        `SELECT o.order_id, o.customer_id, round(sum(${lineValue}), 2) AS order_value, round(max(${lineValue}) OVER (PARTITION BY o.customer_id), 2) AS customer_max FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2025-01-01' AND o.ordered_at < '2026-01-01' GROUP BY o.order_id, oi.quantity, oi.unit_price, oi.discount ORDER BY o.customer_id, o.order_id;`,
        `SELECT o.order_id, o.customer_id, round(sum(${lineValue}), 2) AS order_value, round(max(sum(${lineValue})) OVER (), 2) AS customer_max FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2025-01-01' AND o.ordered_at < '2026-01-01' GROUP BY o.order_id ORDER BY o.customer_id, o.order_id;`,
      ],
      explanation: `Windows run **after** GROUP BY, so they can aggregate aggregates. \`sum(…)\` is each order's value (one row per order), and \`max(sum(…)) OVER (PARTITION BY customer_id)\` is the largest of those values per customer.

Grouping by \`o.order_id\` lets us select \`o.customer_id\` (functional dependency). The window's PARTITION BY may also use it, because windows see the grouped rows.`,
      commonMistakes: ['A window over line values instead of order values.', 'No PARTITION BY.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q10', topic: 15, relatedTopics: [1], difficulty: 'medium', type: 'predict-output',
      title: 'ORDER BY inside OVER with ties',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       sum(x) OVER (ORDER BY x) AS s
FROM (VALUES (1), (2), (2), (3)) AS t(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 's'], rows: [['1', '1'], ['2', '3'], ['2', '5'], ['3', '8']] } },
        { table: { columns: ['x', 's'], rows: [['1', '1'], ['2', '5'], ['2', '5'], ['3', '8']] } },
        { table: { columns: ['x', 's'], rows: [['1', '8'], ['2', '8'], ['2', '8'], ['3', '8']] } },
        { table: { columns: ['x', 's'], rows: [['1', '1'], ['2', '2'], ['2', '2'], ['3', '3']] } },
      ],
      correctOption: 1,
      hints: ['With ORDER BY, the default frame runs from the first row to the current row **and all its peers** (rows with the same x).'],
      explanation: `An ORDER BY in the window makes the sum cumulative. The default frame (\`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`) includes every **peer** of the current row: both rows with x = 2 see 1 + 2 + 2 = **5**. That's why running totals over non-unique sort keys "jump". Topic 16 shows how \`ROWS\` changes that.`,
      commonMistakes: ['Expecting 3 then 5 for the tied rows.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't15-q11', topic: 15, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'How far below the top of the category',
      prompt: `For products **still on sale**, show how far each one's price is **below the most expensive on-sale product in its category** (0 for the most expensive).

- **Columns:** \`product_id\`, \`category_id\`, \`price\`, \`below_top\`
- **Sort:** by \`category_id\`, then \`below_top\`, then \`product_id\`.`,
      hints: ['`max(price) OVER (PARTITION BY category_id) - price`', 'The on-sale filter goes in WHERE, so discontinued products don\'t set the maximum.'],
      referenceSolution: `SELECT product_id, category_id, price,
       max(price) OVER (PARTITION BY category_id) - price AS below_top
FROM products
WHERE discontinued_at IS NULL
ORDER BY category_id, below_top, product_id;`,
      alternativeSolutions: [`SELECT product_id, category_id, price, max(price) OVER w - price AS below_top FROM products WHERE discontinued_at IS NULL WINDOW w AS (PARTITION BY category_id) ORDER BY 2, 4, 1;`],
      wrongAnswers: [
        `SELECT product_id, category_id, price, below_top FROM (SELECT product_id, category_id, price, discontinued_at, max(price) OVER (PARTITION BY category_id) - price AS below_top FROM products) t WHERE discontinued_at IS NULL ORDER BY category_id, below_top, product_id;`,
        `SELECT product_id, category_id, price, max(price) OVER (PARTITION BY category_id ORDER BY price) - price AS below_top FROM products WHERE discontinued_at IS NULL ORDER BY category_id, below_top, product_id;`,
      ],
      explanation: `WHERE runs **before** windows, so filtering there defines what the window sees: only on-sale products compete for the maximum. Filtering *after* the window (first wrong answer) lets a discontinued product set the "top" price.

With \`ORDER BY price\` inside the window, max becomes "max so far", which is the row's own price, so every difference is 0.`,
      commonMistakes: ['Filtering after the window.', 'ORDER BY inside the window.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q12', topic: 15, relatedTopics: [1, 4, 5, 11, 14], difficulty: 'hard', type: 'write-query',
      title: 'Category share of each year',
      prompt: `For each **year** (UTC) and **category_id**, show the revenue of non-cancelled orders and that category's **share of the year's total revenue** in percent (2 decimals). Only rows with a share of **at least 5%**.

- **Columns:** \`year\`, \`category_id\`, \`revenue\` (2 decimals), \`share_pct\`
- **Sort:** by \`year\`, then \`share_pct\` (highest first), then \`category_id\`.`,
      hints: ['Group by year and category, and use `sum(sum(…)) OVER (PARTITION BY year)` for the year total.', 'Filtering on the share needs an outer query.'],
      referenceSolution: `SELECT year, category_id, round(revenue, 2) AS revenue, round(share_pct, 2) AS share_pct
FROM (
  SELECT extract(year FROM o.ordered_at)::int AS year,
         p.category_id,
         sum(${lineValue}) AS revenue,
         100 * sum(${lineValue}) / sum(sum(${lineValue})) OVER (PARTITION BY extract(year FROM o.ordered_at)::int) AS share_pct
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  JOIN products p     ON p.product_id = oi.product_id
  WHERE o.status <> 'cancelled'
  GROUP BY 1, 2
) AS t
WHERE share_pct >= 5
ORDER BY year, share_pct DESC, category_id;`,
      alternativeSolutions: [
        `WITH r AS (SELECT extract(year FROM o.ordered_at)::int AS year, p.category_id, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM orders o JOIN order_items oi USING (order_id) JOIN products p USING (product_id) WHERE o.status <> 'cancelled' GROUP BY 1, 2),
s AS (SELECT r.*, 100 * revenue / sum(revenue) OVER (PARTITION BY year) AS share FROM r)
SELECT year, category_id, round(revenue, 2) AS revenue, round(share, 2) AS share_pct FROM s WHERE share >= 5 ORDER BY 1, 4 DESC, 2;`,
      ],
      wrongAnswers: [
        `SELECT year, category_id, round(revenue, 2) AS revenue, round(share_pct, 2) AS share_pct FROM (SELECT extract(year FROM o.ordered_at)::int AS year, p.category_id, sum(${lineValue}) AS revenue, 100 * sum(${lineValue}) / sum(sum(${lineValue})) OVER () AS share_pct FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status <> 'cancelled' GROUP BY 1, 2) AS t WHERE share_pct >= 5 ORDER BY year, share_pct DESC, category_id;`,
        `SELECT year, category_id, round(revenue, 2) AS revenue, round(share_pct, 2) AS share_pct FROM (SELECT extract(year FROM o.ordered_at)::int AS year, p.category_id, sum(${lineValue}) AS revenue, 100 * sum(${lineValue}) / sum(sum(${lineValue})) OVER (PARTITION BY extract(year FROM o.ordered_at)::int) AS share_pct FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY 1, 2) AS t WHERE share_pct >= 5 ORDER BY year, share_pct DESC, category_id;`,
      ],
      explanation: `\`sum(sum(x)) OVER (PARTITION BY year)\` reads as "the sum, over this year's groups, of the per-group sums", i.e. the year's total, attached to each (year, category) row. Dividing gives each category's share.

Two levels of filtering: the cancelled filter in WHERE (rows), and the 5% threshold outside, because window results can't be filtered at the same level. \`OVER ()\` would divide by the all-time total.`,
      commonMistakes: ['Dividing by the all-time total.', 'Forgetting the cancelled filter.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q13', topic: 15, relatedTopics: [1, 4, 10], difficulty: 'hard', type: 'write-query',
      title: 'Department statistics on every row',
      prompt: `For **active** employees with a department, show each one's salary together with the department's **minimum, maximum and average** (2 decimals) salary and **head count**, and the employee's salary as a **percentage of the department maximum** (1 decimal). Use a named window.

- **Columns:** \`department_id\`, \`employee_id\`, \`salary\`, \`dept_min\`, \`dept_max\`, \`dept_avg\`, \`headcount\`, \`pct_of_max\`
- **Sort:** by \`department_id\`, then \`employee_id\`.`,
      hints: ['`… OVER d … WINDOW d AS (PARTITION BY department_id)`'],
      referenceSolution: `SELECT department_id, employee_id, salary,
       min(salary) OVER d               AS dept_min,
       max(salary) OVER d               AS dept_max,
       round(avg(salary) OVER d, 2)     AS dept_avg,
       count(*) OVER d                  AS headcount,
       round(100 * salary / max(salary) OVER d, 1) AS pct_of_max
FROM employees
WHERE termination_date IS NULL
  AND department_id IS NOT NULL
WINDOW d AS (PARTITION BY department_id)
ORDER BY department_id, employee_id;`,
      alternativeSolutions: [`SELECT e.department_id, e.employee_id, e.salary, s.mn AS dept_min, s.mx AS dept_max, round(s.av, 2) AS dept_avg, s.n AS headcount, round(100 * e.salary / s.mx, 1) AS pct_of_max FROM employees e JOIN (SELECT department_id, min(salary) mn, max(salary) mx, avg(salary) av, count(*) n FROM employees WHERE termination_date IS NULL GROUP BY 1) s USING (department_id) WHERE e.termination_date IS NULL ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT department_id, employee_id, salary, min(salary) OVER d AS dept_min, max(salary) OVER d AS dept_max, round(avg(salary) OVER d, 2) AS dept_avg, count(*) OVER d AS headcount, round(100 * salary / max(salary) OVER d, 1) AS pct_of_max FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL WINDOW d AS (PARTITION BY department_id ORDER BY salary) ORDER BY department_id, employee_id;`,
        `SELECT department_id, employee_id, salary, min(salary) OVER d AS dept_min, max(salary) OVER d AS dept_max, round(avg(salary) OVER d, 2) AS dept_avg, count(*) OVER d AS headcount, round(100 * salary / max(salary) OVER d, 1) AS pct_of_max FROM employees WHERE department_id IS NOT NULL WINDOW d AS (PARTITION BY department_id) ORDER BY department_id, employee_id;`,
      ],
      explanation: `A named window (\`WINDOW d AS (…)\`) is defined once and reused by several functions. That's shorter, and it guarantees they all use the same definition.

Every value is computed over the department's active staff only, because the WHERE runs before the windows. Adding ORDER BY to the window definition would make all of them running statistics.`,
      commonMistakes: ['ORDER BY in the window definition.', 'Forgetting the active filter.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q14', topic: 15, relatedTopics: [1, 4], previewTopics: [19], difficulty: 'hard', type: 'write-query',
      title: 'Was it the customer’s first order?',
      prompt: `For orders placed in **June 2025**, show whether each was the **customer's first order ever** (any status, earliest \`ordered_at\` across their whole history).

- **Columns:** \`order_id\`, \`customer_id\`, \`is_first\` (boolean)
- **Sort:** by \`order_id\`.`,
      hints: ['The first order must be found over **all** of the customer\'s orders, not just June\'s.', 'Compute `min(ordered_at) OVER (PARTITION BY customer_id)` over all orders in a subquery, then filter June outside.'],
      referenceSolution: `SELECT order_id, customer_id, ordered_at = first_at AS is_first
FROM (
  SELECT order_id, customer_id, ordered_at,
         min(ordered_at) OVER (PARTITION BY customer_id) AS first_at
  FROM orders
) AS o
WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01'
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT o.order_id, o.customer_id, NOT EXISTS (SELECT 1 FROM orders e WHERE e.customer_id = o.customer_id AND e.ordered_at < o.ordered_at) AS is_first FROM orders o WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, customer_id, ordered_at = min(ordered_at) OVER (PARTITION BY customer_id) AS is_first FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY order_id;`,
        `SELECT order_id, customer_id, ordered_at = min(ordered_at) OVER () AS is_first FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY order_id;`,
      ],
      explanation: `The most important rule about window functions: **WHERE runs first**. In the wrong answer, the window only sees June's orders, so a long-time customer's first June order looks like their "first order".

Compute the window over the full history in an inner query, and apply the June filter in the outer query.`,
      commonMistakes: ['Filtering before computing the window.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q15', topic: 15, relatedTopics: [1, 4, 5, 14], previewTopics: [20], difficulty: 'interview', type: 'write-query',
      title: 'One order dominates the spend',
      prompt: `Find customers with **at least 2 non-cancelled orders** whose **single largest order accounts for more than 50%** of their total spend (line values, no shipping).

- **Columns:** \`customer_id\`, \`orders\`, \`total_spend\`, \`largest_order\`, \`largest_share_pct\` (amounts rounded to 2 decimals, the share to 1 decimal)
- **Sort:** by \`largest_share_pct\` (highest first), then \`customer_id\`.`,
      hints: ['Step 1: order values (GROUP BY order).', 'Step 2: per customer, count, sum and max over those values (windows or GROUP BY).', 'Step 3: filter on the ratio and the order count.'],
      referenceSolution: `WITH order_value AS (
  SELECT o.order_id, o.customer_id, sum(${lineValue}) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id
), per_customer AS (
  SELECT customer_id, count(*) AS orders, sum(value) AS total_spend, max(value) AS largest_order
  FROM order_value
  GROUP BY customer_id
)
SELECT customer_id, orders,
       round(total_spend, 2)   AS total_spend,
       round(largest_order, 2) AS largest_order,
       round(100 * largest_order / total_spend, 1) AS largest_share_pct
FROM per_customer
WHERE orders >= 2
  AND largest_order > 0.5 * total_spend
ORDER BY largest_share_pct DESC, customer_id;`,
      alternativeSolutions: [
        `SELECT DISTINCT customer_id, n AS orders, round(t, 2) AS total_spend, round(m, 2) AS largest_order, round(100 * m / t, 1) AS largest_share_pct FROM (
  SELECT o.customer_id, count(*) OVER w AS n, sum(sum(oi.quantity * oi.unit_price * (1 - oi.discount))) OVER w AS t, max(sum(oi.quantity * oi.unit_price * (1 - oi.discount))) OVER w AS m
  FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY o.order_id WINDOW w AS (PARTITION BY o.customer_id)) x
WHERE n >= 2 AND m > 0.5 * t ORDER BY 5 DESC, 1;`,
      ],
      wrongAnswers: [
        `WITH order_value AS (SELECT o.order_id, o.customer_id, sum(${lineValue}) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.order_id), per_customer AS (SELECT customer_id, count(*) AS orders, sum(value) AS total_spend, max(value) AS largest_order FROM order_value GROUP BY customer_id)
SELECT customer_id, orders, round(total_spend, 2) AS total_spend, round(largest_order, 2) AS largest_order, round(100 * largest_order / total_spend, 1) AS largest_share_pct FROM per_customer WHERE largest_order > 0.5 * total_spend ORDER BY largest_share_pct DESC, customer_id;`,
        `SELECT o.customer_id, count(DISTINCT o.order_id) AS orders, round(sum(${lineValue}), 2) AS total_spend, round(max(${lineValue}), 2) AS largest_order, round(100 * max(${lineValue}) / sum(${lineValue}), 1) AS largest_share_pct FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id HAVING count(DISTINCT o.order_id) >= 2 AND max(${lineValue}) > 0.5 * sum(${lineValue}) ORDER BY largest_share_pct DESC, customer_id;`,
      ],
      explanation: `Build it in layers: line → order → customer. The largest **order** has to be computed from order totals. \`max(line value)\` (second wrong answer) finds the largest *line*.

Without the "at least 2 orders" rule, every single-order customer qualifies trivially (their only order is 100%). The window alternative shows how windows over grouped rows can replace a second GROUP BY, at the cost of needing DISTINCT.`,
      commonMistakes: ['The largest line instead of the largest order.', 'Forgetting the minimum-orders rule.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't15-q16', topic: 15, relatedTopics: [1, 4, 5, 11, 14], previewTopics: [19], difficulty: 'interview', type: 'write-query',
      title: 'Above-average sales days',
      prompt: `On which days of **2024** (UTC) was the daily revenue of non-cancelled orders **more than 1.5 times the average daily revenue of 2024**? (Average over the days that had orders.)

- **Columns:** \`day\` (date), \`revenue\` (2 decimals), \`avg_day\` (2 decimals)
- **Sort:** by \`day\`.`,
      hints: ['Group by day, and add `avg(sum(…)) OVER ()` to get the average of the daily totals on every row.', 'Filter in an outer query.'],
      referenceSolution: `SELECT day, round(revenue, 2) AS revenue, round(avg_day, 2) AS avg_day
FROM (
  SELECT o.ordered_at::date AS day,
         sum(${lineValue}) AS revenue,
         avg(sum(${lineValue})) OVER () AS avg_day
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
    AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01'
  GROUP BY 1
) AS d
WHERE revenue > 1.5 * avg_day
ORDER BY day;`,
      alternativeSolutions: [
        `WITH d AS (SELECT o.ordered_at::date AS day, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1)
SELECT day, round(revenue, 2) AS revenue, round((SELECT avg(revenue) FROM d), 2) AS avg_day FROM d WHERE revenue > 1.5 * (SELECT avg(revenue) FROM d) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT day, round(revenue, 2) AS revenue, round(avg_day, 2) AS avg_day FROM (SELECT o.ordered_at::date AS day, sum(${lineValue}) AS revenue, avg(${lineValue}) OVER () AS avg_day FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1, ${lineValue}) AS d WHERE revenue > 1.5 * avg_day ORDER BY day;`,
        `SELECT day, round(revenue, 2) AS revenue, round(avg_day, 2) AS avg_day FROM (SELECT o.ordered_at::date AS day, sum(${lineValue}) AS revenue, avg(sum(${lineValue})) OVER (ORDER BY o.ordered_at::date) AS avg_day FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1) AS d WHERE revenue > 1.5 * avg_day ORDER BY day;`,
      ],
      explanation: `\`avg(sum(x)) OVER ()\` = "the average of the daily sums", attached to every day. It's computed after GROUP BY day, over all day rows. With an ORDER BY in the window it would become a running average up to each day: a different (and moving) benchmark.

Peaks cluster around November and December, as you'd expect for a retailer.`,
      commonMistakes: ['Averaging line values instead of daily totals.', 'A running average as the benchmark.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
