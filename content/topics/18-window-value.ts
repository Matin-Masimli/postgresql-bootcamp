import type { Topic } from '../types.ts';

const explanation = `Value functions return a value **from another row** of the window: the previous one, the next one, the first, the last or the n-th. They answer "compared with last time" questions: days since the previous order, month-over-month growth, the top earner next to everyone else.

## LAG and LEAD

\`\`\`text
lag(expr [, offset [, default]])  OVER (PARTITION BY … ORDER BY …)   -- offset rows before
lead(expr [, offset [, default]]) OVER (PARTITION BY … ORDER BY …)   -- offset rows after
\`\`\`

- \`offset\` defaults to 1. Where no such row exists in the partition, the result is \`default\` (NULL unless given).
- They ignore the frame: they count rows in the partition's ORDER BY order. Give them a unique ORDER BY (add a tie-breaker), or "the previous row" is arbitrary among ties.

\`\`\`sql
SELECT customer_id, order_id, ordered_at::date AS order_date,
       lag(ordered_at::date)  OVER w AS previous_order,
       ordered_at::date - lag(ordered_at::date) OVER w AS days_since_previous,
       lead(ordered_at::date) OVER w AS next_order
FROM orders
WHERE customer_id <= 3
WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at, order_id)
ORDER BY customer_id, ordered_at;
\`\`\`

## Period over period

Aggregate per period first, then compare with \`lag\`:

\`\`\`sql
SELECT date_trunc('month', ordered_at)::date AS month,
       count(*) AS orders,
       lag(count(*)) OVER (ORDER BY date_trunc('month', ordered_at)::date) AS previous_month,
       count(*) - lag(count(*)) OVER (ORDER BY date_trunc('month', ordered_at)::date) AS change
FROM orders
WHERE ordered_at >= '2025-01-01'
GROUP BY 1
ORDER BY 1;
\`\`\`

\`lag(x, 12)\` over monthly rows is "the same month last year", as long as no month is missing. Remember that **WHERE runs before windows**: if you filter to 2025, January has no December to look back to. Compute the window over the wider range, then filter in an outer query.

## FIRST_VALUE, LAST_VALUE, NTH_VALUE

These **do** use the frame, and that's the classic trap:

\`\`\`sql
SELECT x,
       first_value(x) OVER (ORDER BY x) AS first_v,
       last_value(x)  OVER (ORDER BY x) AS last_default_frame,
       last_value(x)  OVER (ORDER BY x ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last_whole
FROM (VALUES (1), (2), (3)) AS t(x)
ORDER BY x;
\`\`\`

The default frame ends at the current row (and its peers), so \`last_value\` just returns the current row's value. Extend the frame to \`UNBOUNDED FOLLOWING\`, or flip the ORDER BY and use \`first_value\`. Similarly, \`nth_value(x, 2)\` is NULL on the first row unless the frame reaches the second row.

## Patterns

| question | tool |
|---|---|
| days since previous event | \`t - lag(t) OVER (PARTITION BY who ORDER BY t)\` |
| growth vs previous period | \`(v - lag(v)) / lag(v)\` after GROUP BY period |
| "did they come back within N days?" | \`lead(t) OVER (…) <= t + interval 'N days'\` |
| split events into sessions (gaps and islands) | flag rows where the gap to \`lag\` exceeds a limit, then a running \`sum\` of the flags numbers the sessions |
| best/worst in the group on every row | \`first_value(…) OVER (… ORDER BY … DESC)\` |

## Gotchas

- Forgetting PARTITION BY: the first row of each customer "sees" the previous customer's last order.
- \`lag(x, 1, 0)\` makes a missing previous value look like a real 0. Usually NULL is more honest.
- PostgreSQL 18 doesn't support \`IGNORE NULLS\` on these functions.`;

const lineValue = 'oi.quantity * oi.unit_price * (1 - oi.discount)';

const topic: Topic = {
  id: 18,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Window Functions (9.22)', url: 'https://www.postgresql.org/docs/18/functions-window.html' },
    { title: 'PostgreSQL 18: Window Function Calls (4.2.8)', url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS' },
    { title: 'PostgreSQL 18 Tutorial: Window Functions (3.5)', url: 'https://www.postgresql.org/docs/18/tutorial-window.html' },
    { title: 'Neon PostgreSQL Tutorial: LAG function', url: 'https://neon.com/postgresql/postgresql-window-function/postgresql-lag-function' },
    { title: 'Neon PostgreSQL Tutorial: LAST_VALUE function', url: 'https://neon.com/postgresql/postgresql-window-function/postgresql-last_value-function' },
  ],
  questions: [
    {
      id: 't18-q01', topic: 18, relatedTopics: [1, 4, 5, 11, 15], difficulty: 'easy', type: 'write-query',
      title: 'Days since the previous order',
      prompt: `For customers from **Chile** (\`country_id = 6\`), list every order with the date of the **customer's previous order** and the number of **days** since it (UTC dates; NULL for a customer's first order). Order a customer's orders by \`ordered_at\`, ties by \`order_id\`.

- **Columns:** \`customer_id\`, \`order_id\`, \`order_date\`, \`previous_order_date\`, \`days_since_previous\` (integer)
- **Sort:** by \`customer_id\`, then \`order_date\`, then \`order_id\`.`,
      hints: ['`lag(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id)`', '`date - date` is an integer number of days.'],
      referenceSolution: `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date,
       lag(o.ordered_at::date) OVER w AS previous_order_date,
       o.ordered_at::date - lag(o.ordered_at::date) OVER w AS days_since_previous
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE c.country_id = 6
WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id)
ORDER BY o.customer_id, order_date, o.order_id;`,
      alternativeSolutions: [`SELECT customer_id, order_id, d AS order_date, p AS previous_order_date, d - p AS days_since_previous FROM (SELECT o.customer_id, o.order_id, o.ordered_at::date AS d, lag(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) AS p FROM orders o WHERE o.customer_id IN (SELECT customer_id FROM customers WHERE country_id = 6)) t ORDER BY 1, 3, 2;`],
      wrongAnswers: [
        `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date, lag(o.ordered_at::date) OVER w AS previous_order_date, o.ordered_at::date - lag(o.ordered_at::date) OVER w AS days_since_previous FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 WINDOW w AS (ORDER BY o.customer_id, o.ordered_at, o.order_id) ORDER BY o.customer_id, order_date, o.order_id;`,
        `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date, lead(o.ordered_at::date) OVER w AS previous_order_date, lead(o.ordered_at::date) OVER w - o.ordered_at::date AS days_since_previous FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) ORDER BY o.customer_id, order_date, o.order_id;`,
      ],
      explanation: `\`lag\` reads the previous row **within the partition**, so each customer's first order gets NULL. Without PARTITION BY, a customer's first order would "see" the previous customer's last order.

\`lead\` looks forward: it gives the *next* order, the mirror question.`,
      commonMistakes: ['No PARTITION BY customer.', 'lead instead of lag.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q02', topic: 18, relatedTopics: [15, 16], difficulty: 'easy', type: 'concept-mc',
      title: 'The last_value surprise',
      prompt: `\`last_value(price) OVER (PARTITION BY category_id ORDER BY price)\` was meant to show each category's **highest** price on every row, but it mostly shows the row's own price. Why?`,
      options: [
        { text: 'last_value ignores ORDER BY and returns an arbitrary row' },
        { text: 'The default frame ends at the current row (and its peers), so the "last" row of the frame is the current one' },
        { text: 'last_value only works without PARTITION BY' },
        { text: 'It needs DESC: last_value returns the smallest value with ascending order' },
      ],
      correctOption: 1,
      hints: ['Which rows are in the frame when ORDER BY is present and no frame is given?'],
      explanation: `With ORDER BY, the default frame is \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`. The last row of that frame is the current row (or its last peer). Fix it with \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\`, or use \`first_value(price) OVER (… ORDER BY price DESC)\`, or simply \`max(price) OVER (PARTITION BY category_id)\`.`,
      commonMistakes: ['Expecting last_value to look at the whole partition by default.'],
    },
    {
      id: 't18-q03', topic: 18, relatedTopics: [1, 15], difficulty: 'easy', type: 'predict-output',
      title: 'LAG and LEAD with offsets and defaults',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       lag(x)        OVER w AS prev,
       lead(x, 1, 0) OVER w AS next_or_0,
       lag(x, 2)     OVER w AS two_back
FROM (VALUES (10), (20), (30)) AS t(x)
WINDOW w AS (ORDER BY x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 'prev', 'next_or_0', 'two_back'], rows: [['10', null, '20', null], ['20', '10', '30', null], ['30', '20', '0', '10']] } },
        { table: { columns: ['x', 'prev', 'next_or_0', 'two_back'], rows: [['10', '0', '20', '0'], ['20', '10', '30', '0'], ['30', '20', '0', '10']] } },
        { table: { columns: ['x', 'prev', 'next_or_0', 'two_back'], rows: [['10', null, '20', null], ['20', '10', '30', '10'], ['30', '20', null, '20']] } },
        { table: { columns: ['x', 'prev', 'next_or_0', 'two_back'], rows: [['10', null, '30', null], ['20', '10', '0', null], ['30', '20', '0', '10']] } },
      ],
      correctOption: 0,
      hints: ['The default value only applies to the function it is given to.'],
      explanation: `\`lag(x)\` is the previous row's x: NULL, 10, 20. \`lead(x, 1, 0)\` is the next row's, with 0 where there is none: 20, 30, 0. \`lag(x, 2)\` looks two rows back, so only the third row has one (10).`,
      commonMistakes: ['Applying a default to every function.', 'Thinking offset 2 means "two rows including this one".'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't18-q04', topic: 18, relatedTopics: [1, 4, 5, 11, 14, 15], difficulty: 'easy', type: 'write-query',
      title: 'Month-over-month change',
      prompt: `For each month of **2024**, show the revenue of non-cancelled orders, the **previous month's revenue** and the **change** (revenue − previous). For January, the previous month and the change are NULL. Round to 2 decimals.

- **Columns:** \`month\` (date), \`revenue\`, \`previous_month\`, \`change\`
- **Sort:** by \`month\`.`,
      hints: ['Group by month, then `lag(sum(…)) OVER (ORDER BY month)`.'],
      referenceSolution: `SELECT date_trunc('month', o.ordered_at)::date AS month,
       round(sum(${lineValue}), 2) AS revenue,
       round(lag(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS previous_month,
       round(sum(${lineValue}) - lag(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS change
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
  AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [`SELECT month, round(rev, 2) AS revenue, round(prev, 2) AS previous_month, round(rev - prev, 2) AS change FROM (SELECT month, rev, lag(rev) OVER (ORDER BY month) AS prev FROM (SELECT date_trunc('month', o.ordered_at)::date AS month, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS rev FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' AND extract(year FROM o.ordered_at) = 2024 GROUP BY 1) m) t ORDER BY 1;`],
      wrongAnswers: [
        `SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue, round(lead(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS previous_month, round(sum(${lineValue}) - lead(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS change FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
        `SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue, round(lag(sum(${lineValue}), 1, 0) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS previous_month, round(sum(${lineValue}) - lag(sum(${lineValue}), 1, 0) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS change FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `After grouping, each month is one row, so \`lag(sum(…))\` is the previous month's total. The window's ORDER BY must be the grouped expression.

A default of 0 would make January look like it grew by its entire revenue. NULL ("no previous month in scope") is the honest answer.`,
      commonMistakes: ['lead instead of lag.', 'A default of 0 for the missing previous month.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q05', topic: 18, relatedTopics: [1, 4, 5, 10, 11, 14, 15], previewTopics: [19], difficulty: 'medium', type: 'write-query',
      title: 'Year-over-year by month',
      prompt: `For each month from **January 2024 to June 2025**, show the revenue of non-cancelled orders, the revenue of the **same month one year earlier**, and the growth in percent (1 decimal). Every month since 2023 has orders.

- **Columns:** \`month\` (date), \`revenue\` (2 decimals), \`last_year\` (2 decimals), \`yoy_pct\`
- **Sort:** by \`month\`.`,
      hints: ['`lag(revenue, 12)` over monthly rows is the same month last year.', 'The window must see 2023 to look back from 2024, so compute it first and filter the months outside.'],
      referenceSolution: `SELECT month, round(revenue, 2) AS revenue, round(last_year, 2) AS last_year,
       round(100 * (revenue - last_year) / last_year, 1) AS yoy_pct
FROM (
  SELECT date_trunc('month', o.ordered_at)::date AS month,
         sum(${lineValue}) AS revenue,
         lag(sum(${lineValue}), 12) OVER (ORDER BY date_trunc('month', o.ordered_at)::date) AS last_year
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
    AND o.ordered_at >= '2023-01-01'
  GROUP BY 1
) AS m
WHERE month >= '2024-01-01'
ORDER BY month;`,
      alternativeSolutions: [
        `WITH m AS (SELECT date_trunc('month', o.ordered_at)::date AS month, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1)
SELECT cur.month, round(cur.revenue, 2) AS revenue, round(prev.revenue, 2) AS last_year, round(100 * (cur.revenue - prev.revenue) / prev.revenue, 1) AS yoy_pct FROM m cur LEFT JOIN m prev ON prev.month = cur.month - interval '1 year' WHERE cur.month >= '2024-01-01' ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue, round(lag(sum(${lineValue}), 12) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS last_year, round(100 * (sum(${lineValue}) - lag(sum(${lineValue}), 12) OVER (ORDER BY date_trunc('month', o.ordered_at)::date)) / lag(sum(${lineValue}), 12) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 1) AS yoy_pct FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' GROUP BY 1 ORDER BY 1;`,
        `SELECT month, round(revenue, 2) AS revenue, round(last_year, 2) AS last_year, round(100 * (revenue - last_year) / revenue, 1) AS yoy_pct FROM (SELECT date_trunc('month', o.ordered_at)::date AS month, sum(${lineValue}) AS revenue, lag(sum(${lineValue}), 12) OVER (ORDER BY date_trunc('month', o.ordered_at)::date) AS last_year FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2023-01-01' GROUP BY 1) AS m WHERE month >= '2024-01-01' ORDER BY month;`,
      ],
      explanation: `\`lag(x, 12)\` over one row per month = the value 12 months back. But **WHERE runs before windows**: filtering to 2024+ in the same query (first wrong answer) leaves the window nothing to look back to, so every 2024 month gets NULL. Compute the window over the wider range and filter in an outer query.

Growth is relative to the **old** value: (new − old) / old. The self-join alternative matches months by date arithmetic, which also works when months are missing.`,
      commonMistakes: ['Filtering before the window, so 2024 has no history.', 'Dividing by the new value.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q06', topic: 18, relatedTopics: [1, 4, 15, 17], difficulty: 'medium', type: 'write-query',
      title: 'The top earner on every row',
      prompt: `For **active** employees with a department, show next to each employee the **id and salary of the best-paid active employee in their department** (ties broken by the lowest \`employee_id\`).

- **Columns:** \`department_id\`, \`employee_id\`, \`salary\`, \`top_earner_id\`, \`top_salary\`
- **Sort:** by \`department_id\`, then \`employee_id\`.`,
      hints: ['`first_value(employee_id) OVER (PARTITION BY department_id ORDER BY salary DESC, employee_id)`'],
      referenceSolution: `SELECT department_id, employee_id, salary,
       first_value(employee_id) OVER w AS top_earner_id,
       first_value(salary)      OVER w AS top_salary
FROM employees
WHERE termination_date IS NULL
  AND department_id IS NOT NULL
WINDOW w AS (PARTITION BY department_id ORDER BY salary DESC, employee_id)
ORDER BY department_id, employee_id;`,
      alternativeSolutions: [`SELECT department_id, employee_id, salary, last_value(employee_id) OVER w AS top_earner_id, last_value(salary) OVER w AS top_salary FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL WINDOW w AS (PARTITION BY department_id ORDER BY salary, employee_id DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT department_id, employee_id, salary, last_value(employee_id) OVER w AS top_earner_id, last_value(salary) OVER w AS top_salary FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL WINDOW w AS (PARTITION BY department_id ORDER BY salary, employee_id DESC) ORDER BY department_id, employee_id;`,
        `SELECT department_id, employee_id, salary, first_value(employee_id) OVER w AS top_earner_id, first_value(salary) OVER w AS top_salary FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL WINDOW w AS (PARTITION BY department_id ORDER BY salary, employee_id) ORDER BY department_id, employee_id;`,
      ],
      explanation: `\`first_value\` with a descending order is the safe way to get "the top row of the group": the first row is always in the default frame. The \`employee_id\` tie-breaker makes "the" top earner well-defined when two people share the highest salary.

\`last_value\` with ascending order only works with a frame extended to \`UNBOUNDED FOLLOWING\`. With the default frame it returns the current employee.`,
      commonMistakes: ['last_value with the default frame.', 'Ascending order, which gives the lowest paid.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q07', topic: 18, relatedTopics: [1, 4, 5, 11, 15, 16], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: latest order on every row',
      prompt: `For customers from **Chile** (\`country_id = 6\`), this query should show each order together with the date of the customer's **latest** order. Instead, \`latest_order_date\` just repeats each row's own date. Fix it.

- **Columns:** \`customer_id\`, \`order_id\`, \`order_date\`, \`latest_order_date\`
- **Sort:** by \`customer_id\`, then \`order_id\`.`,
      starterSql: `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date,
       last_value(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at) AS latest_order_date
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE c.country_id = 6
ORDER BY o.customer_id, o.order_id;`,
      hints: ['What is the last row of the default frame?', 'Extend the frame to `UNBOUNDED FOLLOWING`, or use `max(…) OVER (PARTITION BY …)`.'],
      referenceSolution: `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date,
       last_value(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at
                                            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS latest_order_date
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE c.country_id = 6
ORDER BY o.customer_id, o.order_id;`,
      alternativeSolutions: [
        `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date, max(o.ordered_at::date) OVER (PARTITION BY o.customer_id) AS latest_order_date FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 ORDER BY 1, 2;`,
        `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date, first_value(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at DESC) AS latest_order_date FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 ORDER BY 1, 2;`,
      ],
      wrongAnswers: [
        `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date, last_value(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS latest_order_date FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 ORDER BY o.customer_id, o.order_id;`,
        `SELECT o.customer_id, o.order_id, o.ordered_at::date AS order_date, last_value(o.ordered_at::date) OVER (ORDER BY o.ordered_at ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS latest_order_date FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 ORDER BY o.customer_id, o.order_id;`,
      ],
      explanation: `The window has an ORDER BY but no frame, so the frame stops at the current row: the "last value" is the current order's date. Three fixes:

1. Extend the frame: \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\`.
2. Flip the order and take the first value: \`first_value(…) OVER (… ORDER BY ordered_at DESC)\`.
3. For the latest *date*, plain \`max(…) OVER (PARTITION BY customer_id)\` is simplest. last_value earns its keep when you need another column of the last row.`,
      commonMistakes: ['Spelling out the default frame, which changes nothing.', 'Dropping PARTITION BY while fixing the frame.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q08', topic: 18, relatedTopics: [1, 15, 16], difficulty: 'medium', type: 'predict-output',
      title: 'first_value and last_value with ties',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       first_value(x) OVER (ORDER BY x) AS first_v,
       last_value(x)  OVER (ORDER BY x) AS last_v
FROM (VALUES (1), (2), (2), (3)) AS t(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 'first_v', 'last_v'], rows: [['1', '1', '1'], ['2', '1', '2'], ['2', '1', '2'], ['3', '1', '3']] } },
        { table: { columns: ['x', 'first_v', 'last_v'], rows: [['1', '1', '3'], ['2', '1', '3'], ['2', '1', '3'], ['3', '1', '3']] } },
        { table: { columns: ['x', 'first_v', 'last_v'], rows: [['1', '1', '1'], ['2', '2', '2'], ['2', '2', '2'], ['3', '3', '3']] } },
        { table: { columns: ['x', 'first_v', 'last_v'], rows: [['1', '1', '1'], ['2', '1', '1'], ['2', '1', '2'], ['3', '1', '2']] } },
      ],
      correctOption: 0,
      hints: ['The default frame ends at the current row **including its peers**.'],
      explanation: `The frame starts at the first row, so \`first_value\` is 1 everywhere. It ends at the current row's last peer, so \`last_value\` is the current value: both 2s have each other in the frame, and the last of them is a 2. Only with \`UNBOUNDED FOLLOWING\` would last_value be 3 throughout.`,
      commonMistakes: ['Expecting last_value to be 3 on every row.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't18-q09', topic: 18, relatedTopics: [1, 4, 10, 15], previewTopics: [19], difficulty: 'medium', type: 'write-query',
      title: 'Salary changes',
      prompt: `From \`salary_history\`, list every salary **change**: each period that has a previous period for the same employee, with the old salary, the new one and the change in percent (1 decimal).

- **Columns:** \`employee_id\`, \`effective_from\`, \`old_salary\`, \`new_salary\`, \`change_pct\`, \`change_reason\`
- **Sort:** by \`employee_id\`, then \`effective_from\`.`,
      hints: ['`lag(salary) OVER (PARTITION BY employee_id ORDER BY effective_from)`', 'Remove the first period (no previous salary) in an outer query.'],
      referenceSolution: `SELECT employee_id, effective_from, old_salary, salary AS new_salary,
       round(100 * (salary - old_salary) / old_salary, 1) AS change_pct,
       change_reason
FROM (
  SELECT employee_id, effective_from, salary, change_reason,
         lag(salary) OVER (PARTITION BY employee_id ORDER BY effective_from) AS old_salary
  FROM salary_history
) AS h
WHERE old_salary IS NOT NULL
ORDER BY employee_id, effective_from;`,
      alternativeSolutions: [`SELECT cur.employee_id, cur.effective_from, prev.salary AS old_salary, cur.salary AS new_salary, round(100 * (cur.salary - prev.salary) / prev.salary, 1) AS change_pct, cur.change_reason FROM salary_history cur JOIN LATERAL (SELECT salary FROM salary_history p WHERE p.employee_id = cur.employee_id AND p.effective_from < cur.effective_from ORDER BY p.effective_from DESC LIMIT 1) prev ON true ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT employee_id, effective_from, old_salary, salary AS new_salary, round(100 * (salary - old_salary) / old_salary, 1) AS change_pct, change_reason FROM (SELECT employee_id, effective_from, salary, change_reason, lag(salary) OVER (ORDER BY employee_id, effective_from) AS old_salary FROM salary_history) AS h WHERE old_salary IS NOT NULL ORDER BY employee_id, effective_from;`,
        `SELECT employee_id, effective_from, old_salary, salary AS new_salary, round(100 * (salary - old_salary) / old_salary, 1) AS change_pct, change_reason FROM (SELECT employee_id, effective_from, salary, change_reason, lag(salary) OVER (PARTITION BY employee_id ORDER BY salary) AS old_salary FROM salary_history) AS h WHERE old_salary IS NOT NULL ORDER BY employee_id, effective_from;`,
      ],
      explanation: `"Previous" means previous **in time** for the **same employee**: partition by employee, order by \`effective_from\`.

Without PARTITION BY, every employee's first period compares with the previous employee's last salary and turns into a fake "change". Ordering by salary assumes salaries only go up. One employee in the data had a pay cut, and that row would come out wrong.`,
      commonMistakes: ['No PARTITION BY employee.', 'Ordering by salary instead of by date.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q10', topic: 18, relatedTopics: [1, 11, 14, 15], previewTopics: [19], difficulty: 'medium', type: 'write-query',
      title: 'Longest break between orders',
      prompt: `Which **10 customers** had the longest break (in days, by UTC date) between two **consecutive** orders (any status)?

- **Columns:** \`customer_id\`, \`longest_gap_days\`
- **Sort:** by \`longest_gap_days\` (highest first), then \`customer_id\`; **10 rows**.`,
      hints: ['Inner query: the gap to the previous order with `lag`.', 'Outer query: `max(gap)` per customer.'],
      referenceSolution: `SELECT customer_id, max(gap) AS longest_gap_days
FROM (
  SELECT customer_id,
         ordered_at::date - lag(ordered_at::date) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS gap
  FROM orders
) AS g
GROUP BY customer_id
HAVING max(gap) IS NOT NULL
ORDER BY longest_gap_days DESC, customer_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT customer_id, max(next_d - d) AS longest_gap_days FROM (SELECT customer_id, ordered_at::date AS d, lead(ordered_at::date) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS next_d FROM orders) t WHERE next_d IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10;`],
      wrongAnswers: [
        `SELECT customer_id, max(gap) AS longest_gap_days FROM (SELECT customer_id, ordered_at::date - first_value(ordered_at::date) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS gap FROM orders) AS g GROUP BY customer_id ORDER BY longest_gap_days DESC, customer_id LIMIT 10;`,
        `SELECT customer_id, max(gap) AS longest_gap_days FROM (SELECT customer_id, ordered_at::date - lag(ordered_at::date) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS gap FROM orders) AS g GROUP BY customer_id ORDER BY longest_gap_days DESC, customer_id LIMIT 10;`,
      ],
      explanation: `Window functions can't be nested inside aggregates at the same level, so this takes two steps: compute each gap with \`lag\`, then aggregate. Customers with a single order only have a NULL gap, so their \`max\` is NULL. **NULLs sort first in a descending sort**, so without the HAVING (or a WHERE on the gap) the top 10 is filled with one-order customers.

Measuring from the **first** order (\`first_value\`) gives the customer's tenure, not a break between consecutive orders.`,
      commonMistakes: ['Distance from the first order instead of the previous one.', 'Keeping one-order customers, whose NULL gap sorts first.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q11', topic: 18, relatedTopics: [1, 4, 5, 11, 15, 16], previewTopics: [19], difficulty: 'hard', type: 'write-query',
      title: 'From first to second order',
      prompt: `For customers who **signed up in 2024** and have **at least two orders** (any status), show the dates (UTC) of their first and second order and the days between them. Order a customer's orders by \`ordered_at\`, ties by \`order_id\`.

- **Columns:** \`customer_id\`, \`first_order\`, \`second_order\`, \`days_between\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`nth_value(ordered_at::date, 2)` needs a frame that reaches the second row from every row: `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.', 'Alternatively: `lead` on each customer\'s first order.'],
      referenceSolution: `SELECT DISTINCT customer_id, first_order, second_order, second_order - first_order AS days_between
FROM (
  SELECT o.customer_id,
         first_value(o.ordered_at::date) OVER w   AS first_order,
         nth_value(o.ordered_at::date, 2) OVER w  AS second_order
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id
  WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01'
  WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
) AS t
WHERE second_order IS NOT NULL
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id, first_order, second_order, second_order - first_order AS days_between FROM (SELECT o.customer_id, o.ordered_at::date AS first_order, lead(o.ordered_at::date) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) AS second_order, row_number() OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) AS rn FROM orders o JOIN customers c USING (customer_id) WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01') t WHERE rn = 1 AND second_order IS NOT NULL ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT DISTINCT customer_id, first_order, second_order, second_order - first_order AS days_between FROM (SELECT o.customer_id, first_value(o.ordered_at::date) OVER w AS first_order, nth_value(o.ordered_at::date, 2) OVER w AS second_order FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01' WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)) AS t ORDER BY customer_id;`,
        `SELECT DISTINCT customer_id, first_order, second_order, second_order - first_order AS days_between FROM (SELECT o.customer_id, first_value(o.ordered_at::date) OVER w AS first_order, nth_value(o.ordered_at::date, 2) OVER w AS second_order FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01' WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at DESC, o.order_id DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)) AS t WHERE second_order IS NOT NULL ORDER BY customer_id;`,
      ],
      explanation: `With the full frame, every row of a customer carries the same first and second date, and DISTINCT collapses them to one row per customer. Customers with one order get NULL for the second date and are removed.

The \`lead\` alternative takes the customer's first row (via \`row_number\`) and reads the next row. A descending order turns "first and second" into "latest and second latest".`,
      commonMistakes: ['Keeping one-order customers.', 'Descending order inside the window.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q12', topic: 18, relatedTopics: [1, 4, 11, 13, 14, 15], previewTopics: [19], difficulty: 'hard', type: 'write-query',
      title: 'Did they come back within 30 days?',
      prompt: `For each month of **2024**, take all orders placed that month (any status) and compute the share that were **followed by another order from the same customer within 30 days** (\`next ordered_at <= ordered_at + 30 days\`). The next order may fall in 2025.

- **Columns:** \`month\` (date), \`orders\`, \`reordered_30d\`, \`reorder_pct\` (1 decimal)
- **Sort:** by \`month\`.`,
      hints: ['`lead(ordered_at) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)` over **all** orders.', 'Then restrict to 2024 and aggregate with `count(*) FILTER (WHERE …)`.'],
      referenceSolution: `SELECT date_trunc('month', ordered_at)::date AS month,
       count(*) AS orders,
       count(*) FILTER (WHERE next_at <= ordered_at + interval '30 days') AS reordered_30d,
       round(100.0 * count(*) FILTER (WHERE next_at <= ordered_at + interval '30 days') / count(*), 1) AS reorder_pct
FROM (
  SELECT customer_id, ordered_at,
         lead(ordered_at) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS next_at
  FROM orders
) AS o
WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [`SELECT date_trunc('month', o.ordered_at)::date AS month, count(*) AS orders, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders n WHERE n.customer_id = o.customer_id AND (n.ordered_at, n.order_id) > (o.ordered_at, o.order_id) AND n.ordered_at <= o.ordered_at + interval '30 days')) AS reordered_30d, round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders n WHERE n.customer_id = o.customer_id AND (n.ordered_at, n.order_id) > (o.ordered_at, o.order_id) AND n.ordered_at <= o.ordered_at + interval '30 days')) / count(*), 1) AS reorder_pct FROM orders o WHERE o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT date_trunc('month', ordered_at)::date AS month, count(*) AS orders, count(*) FILTER (WHERE next_at <= ordered_at + interval '30 days') AS reordered_30d, round(100.0 * count(*) FILTER (WHERE next_at <= ordered_at + interval '30 days') / count(*), 1) AS reorder_pct FROM (SELECT customer_id, ordered_at, lead(ordered_at) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS next_at FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01') AS o GROUP BY 1 ORDER BY 1;`,
        `SELECT date_trunc('month', ordered_at)::date AS month, count(*) AS orders, count(*) FILTER (WHERE prev_at >= ordered_at - interval '30 days') AS reordered_30d, round(100.0 * count(*) FILTER (WHERE prev_at >= ordered_at - interval '30 days') / count(*), 1) AS reorder_pct FROM (SELECT customer_id, ordered_at, lag(ordered_at) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS prev_at FROM orders) AS o WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `\`lead\` finds each order's *next* order directly, with no self-join. The window must run over **all** orders: if 2024 is filtered first (first wrong answer), December orders can't see their January 2025 follow-ups and the December rate drops.

\`lag\` answers a different question ("did this order come within 30 days of the previous one?").`,
      commonMistakes: ['Filtering to 2024 before the window.', 'Looking back (lag) instead of forward.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q13', topic: 18, relatedTopics: [1, 15, 16], difficulty: 'hard', type: 'predict-output',
      title: 'nth_value and a short frame',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       nth_value(x, 2) OVER (ORDER BY x) AS second_v,
       last_value(x) OVER (ORDER BY x ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING) AS next_or_self
FROM (VALUES (1), (2), (3)) AS t(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 'second_v', 'next_or_self'], rows: [['1', null, '2'], ['2', '2', '3'], ['3', '2', '3']] } },
        { table: { columns: ['x', 'second_v', 'next_or_self'], rows: [['1', '2', '2'], ['2', '2', '3'], ['3', '2', '3']] } },
        { table: { columns: ['x', 'second_v', 'next_or_self'], rows: [['1', null, '2'], ['2', '2', '3'], ['3', '2', null]] } },
        { table: { columns: ['x', 'second_v', 'next_or_self'], rows: [['1', null, '1'], ['2', '2', '2'], ['3', '3', '3']] } },
      ],
      correctOption: 0,
      hints: ['On the first row, the default frame contains only that row.', 'The second frame is "this row and the next one, if any".'],
      explanation: `\`nth_value(x, 2)\` with the default frame: on row 1 the frame has one row, so there is no 2nd value (NULL). From row 2 on, the 2nd value is 2.

\`ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING\` holds the row and the next one. On the last row the frame has just the row itself, so last_value is 3, not NULL.`,
      commonMistakes: ['Expecting nth_value to see the whole partition.', 'Expecting NULL when the frame is cut short.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't18-q14', topic: 18, relatedTopics: [1, 4, 12, 15], previewTopics: [19], difficulty: 'hard', type: 'write-query',
      title: 'The biggest price jump in each category',
      prompt: `Within each category, sort the **on-sale** products by price (ties by \`product_id\`). For each product, the *jump* is its price minus the price of the product just before it. Return, per category, the product with the **largest jump** (ties: lowest \`product_id\`). Categories with a single on-sale product have no jump and are left out.

- **Columns:** \`category_id\`, \`product_id\`, \`price\`, \`previous_price\`, \`jump\`
- **Sort:** by \`category_id\`.`,
      hints: ['`price - lag(price) OVER (PARTITION BY category_id ORDER BY price, product_id)`', '`DISTINCT ON (category_id) … ORDER BY category_id, jump DESC …`. Where do NULLs go in a descending sort?'],
      referenceSolution: `SELECT DISTINCT ON (category_id) category_id, product_id, price, previous_price, jump
FROM (
  SELECT category_id, product_id, price,
         lag(price) OVER w AS previous_price,
         price - lag(price) OVER w AS jump
  FROM products
  WHERE discontinued_at IS NULL
  WINDOW w AS (PARTITION BY category_id ORDER BY price, product_id)
) AS p
WHERE jump IS NOT NULL
ORDER BY category_id, jump DESC, product_id;`,
      alternativeSolutions: [`SELECT DISTINCT ON (category_id) category_id, product_id, price, previous_price, price - previous_price AS jump FROM (SELECT category_id, product_id, price, lag(price) OVER (PARTITION BY category_id ORDER BY price, product_id) AS previous_price FROM products WHERE discontinued_at IS NULL) p WHERE previous_price IS NOT NULL ORDER BY category_id, price - previous_price DESC NULLS LAST, product_id;`],
      wrongAnswers: [
        `SELECT DISTINCT ON (category_id) category_id, product_id, price, previous_price, jump FROM (SELECT category_id, product_id, price, lag(price) OVER w AS previous_price, price - lag(price) OVER w AS jump FROM products WHERE discontinued_at IS NULL WINDOW w AS (PARTITION BY category_id ORDER BY price, product_id)) AS p ORDER BY category_id, jump DESC, product_id;`,
        `SELECT DISTINCT ON (category_id) category_id, product_id, price, previous_price, jump FROM (SELECT category_id, product_id, price, discontinued_at, lag(price) OVER w AS previous_price, price - lag(price) OVER w AS jump FROM products WINDOW w AS (PARTITION BY category_id ORDER BY price, product_id)) AS p WHERE discontinued_at IS NULL AND jump IS NOT NULL ORDER BY category_id, jump DESC, product_id;`,
      ],
      explanation: `The cheapest product in each category has no previous product, so its jump is NULL. **In a descending sort, NULLs come first**, and DISTINCT ON would pick exactly that row (first wrong answer). Remove the NULLs, or sort with \`DESC NULLS LAST\`.

Filtering discontinued products *after* the window (second wrong answer) compares on-sale products with discontinued neighbours.`,
      commonMistakes: ['NULL jumps winning the descending sort.', 'Filtering after the window.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q15', topic: 18, relatedTopics: [1, 4, 5, 14, 15], previewTopics: [20], difficulty: 'interview', type: 'write-query',
      title: 'Three growing orders in a row',
      prompt: `Find orders that complete a run of **three consecutive orders of strictly increasing value** by the same customer: the order's value is higher than the previous order's, which is higher than the one before that. Use non-cancelled orders only, line values without shipping, in \`ordered_at\` order (ties by \`order_id\`).

- **Columns:** \`customer_id\`, \`order_id\`, \`two_before\`, \`one_before\`, \`value\` (all values rounded to 2 decimals)
- **Sort:** by \`customer_id\`, then \`order_id\`.`,
      hints: ['First compute order values (GROUP BY order).', '`lag(value, 1)` and `lag(value, 2)` over the customer\'s orders.'],
      referenceSolution: `WITH order_value AS (
  SELECT o.order_id, o.customer_id, o.ordered_at, sum(${lineValue}) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id
), with_prev AS (
  SELECT customer_id, order_id, value,
         lag(value, 1) OVER w AS one_before,
         lag(value, 2) OVER w AS two_before
  FROM order_value
  WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at, order_id)
)
SELECT customer_id, order_id,
       round(two_before, 2) AS two_before, round(one_before, 2) AS one_before, round(value, 2) AS value
FROM with_prev
WHERE value > one_before AND one_before > two_before
ORDER BY customer_id, order_id;`,
      alternativeSolutions: [
        `SELECT customer_id, order_id, round(v2, 2) AS two_before, round(v1, 2) AS one_before, round(v, 2) AS value FROM (SELECT o.customer_id, o.order_id, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS v, lag(sum(oi.quantity * oi.unit_price * (1 - oi.discount))) OVER w AS v1, lag(sum(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) OVER w AS v2 FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY o.order_id WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id)) t WHERE v > v1 AND v1 > v2 ORDER BY 1, 2;`,
      ],
      wrongAnswers: [
        `WITH order_value AS (SELECT o.order_id, o.customer_id, o.ordered_at, sum(${lineValue}) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.order_id), with_prev AS (SELECT customer_id, order_id, value, lag(value, 1) OVER w AS one_before, lag(value, 2) OVER w AS two_before FROM order_value WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at, order_id))
SELECT customer_id, order_id, round(two_before, 2) AS two_before, round(one_before, 2) AS one_before, round(value, 2) AS value FROM with_prev WHERE value > one_before AND value > two_before ORDER BY customer_id, order_id;`,
        `WITH order_value AS (SELECT o.order_id, o.customer_id, o.ordered_at, sum(${lineValue}) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.order_id), with_prev AS (SELECT customer_id, order_id, value, lag(value, 1) OVER w AS one_before, lag(value, 2) OVER w AS two_before FROM order_value WINDOW w AS (ORDER BY ordered_at, order_id))
SELECT customer_id, order_id, round(two_before, 2) AS two_before, round(one_before, 2) AS one_before, round(value, 2) AS value FROM with_prev WHERE value > one_before AND one_before > two_before ORDER BY customer_id, order_id;`,
      ],
      explanation: `\`lag(value, 2)\` reaches two orders back. A strictly increasing run needs **both** links: v₋₂ < v₋₁ **and** v₋₁ < v. Checking only that the current order beats both earlier ones (first wrong answer) also accepts 50 → 20 → 80.

Customers with fewer than three orders have NULL lags, the comparisons are unknown, and WHERE drops them, which is exactly what we want.`,
      commonMistakes: ['Comparing the current order with both previous ones instead of chaining.', 'lag across customers.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't18-q16', topic: 18, relatedTopics: [1, 4, 5, 11, 13, 14, 15, 16], previewTopics: [20], difficulty: 'interview', type: 'write-query',
      title: 'Shopping sprees (gaps and islands)',
      prompt: `For customers from **Chile** (\`country_id = 6\`), group each customer's orders (any status, by \`ordered_at\`, ties by \`order_id\`) into **sprees**: a new spree starts with the customer's first order and whenever **more than 30 days** have passed since their previous order. Number the sprees 1, 2, 3… per customer, and return the sprees that contain **at least 2 orders**.

- **Columns:** \`customer_id\`, \`spree_no\`, \`orders\`, \`spree_start\`, \`spree_end\` (UTC dates of the first and last order)
- **Sort:** by \`customer_id\`, then \`spree_no\`.`,
      hints: ['Step 1: flag = 1 when `lag(ordered_at)` is NULL or more than 30 days earlier, else 0.', 'Step 2: `sum(flag) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)` numbers the sprees.', 'Step 3: GROUP BY customer and spree number.'],
      referenceSolution: `WITH flagged AS (
  SELECT o.customer_id, o.order_id, o.ordered_at,
         CASE WHEN lag(o.ordered_at) OVER w IS NULL
                OR o.ordered_at - lag(o.ordered_at) OVER w > interval '30 days'
              THEN 1 ELSE 0 END AS new_spree
  FROM orders o
  JOIN customers c ON c.customer_id = o.customer_id
  WHERE c.country_id = 6
  WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id)
), numbered AS (
  SELECT customer_id, order_id, ordered_at,
         sum(new_spree) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS spree_no
  FROM flagged
)
SELECT customer_id, spree_no, count(*) AS orders,
       min(ordered_at)::date AS spree_start, max(ordered_at)::date AS spree_end
FROM numbered
GROUP BY customer_id, spree_no
HAVING count(*) >= 2
ORDER BY customer_id, spree_no;`,
      alternativeSolutions: [
        `WITH f AS (SELECT o.customer_id, o.order_id, o.ordered_at, (coalesce(o.ordered_at - lag(o.ordered_at) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id), interval '1000 days') > interval '30 days')::int AS s FROM orders o WHERE o.customer_id IN (SELECT customer_id FROM customers WHERE country_id = 6)), n AS (SELECT f.*, sum(s) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id ROWS UNBOUNDED PRECEDING) AS spree_no FROM f)
SELECT customer_id, spree_no, count(*) AS orders, min(ordered_at)::date AS spree_start, max(ordered_at)::date AS spree_end FROM n GROUP BY 1, 2 HAVING count(*) > 1 ORDER BY 1, 2;`,
      ],
      wrongAnswers: [
        `WITH flagged AS (SELECT o.customer_id, o.order_id, o.ordered_at, CASE WHEN lead(o.ordered_at) OVER w IS NULL OR lead(o.ordered_at) OVER w - o.ordered_at > interval '30 days' THEN 1 ELSE 0 END AS new_spree FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id)), numbered AS (SELECT customer_id, order_id, ordered_at, sum(new_spree) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS spree_no FROM flagged)
SELECT customer_id, spree_no, count(*) AS orders, min(ordered_at)::date AS spree_start, max(ordered_at)::date AS spree_end FROM numbered GROUP BY customer_id, spree_no HAVING count(*) >= 2 ORDER BY customer_id, spree_no;`,
        `WITH flagged AS (SELECT o.customer_id, o.order_id, o.ordered_at, CASE WHEN o.ordered_at - lag(o.ordered_at) OVER w > interval '30 days' THEN 1 ELSE 0 END AS new_spree FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.country_id = 6 WINDOW w AS (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id)), numbered AS (SELECT customer_id, order_id, ordered_at, sum(new_spree) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS spree_no FROM flagged)
SELECT customer_id, spree_no, count(*) AS orders, min(ordered_at)::date AS spree_start, max(ordered_at)::date AS spree_end FROM numbered GROUP BY customer_id, spree_no HAVING count(*) >= 2 ORDER BY customer_id, spree_no;`,
      ],
      explanation: `The **gaps-and-islands** pattern:

1. \`lag\` marks the rows where a new island starts (flag 1).
2. A running \`sum\` of the flags gives every row its island number: it only increases at a start row.
3. GROUP BY the island number to describe each island.

The first order has no previous order. Its comparison is NULL, so without the explicit \`IS NULL\` check the flag is 0 and the first spree is numbered 0 (second wrong answer). Looking *forward* with \`lead\` flags the **last** order of each spree instead of the first, which shifts every boundary by one order.`,
      commonMistakes: ['Not starting the first spree (NULL lag).', 'Flagging the end of a spree instead of the start.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
