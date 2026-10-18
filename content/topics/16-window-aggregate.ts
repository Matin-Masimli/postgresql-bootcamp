import type { Topic } from '../types.ts';

const explanation = `Topic 15 put a group's total next to every row. Add an **ORDER BY** inside OVER and a **frame**, and the same aggregates answer "so far" and "nearby" questions: running totals, moving averages, rolling 30-day counts.

## Running totals

\`\`\`sql
SELECT ordered_at::date AS day,
       count(*)                               AS orders,
       sum(count(*)) OVER (ORDER BY ordered_at::date) AS orders_so_far
FROM orders
WHERE ordered_at >= '2025-06-01'
GROUP BY 1
ORDER BY 1
LIMIT 10;
\`\`\`

With ORDER BY, each row's window is a **frame**: a slice of the partition relative to the current row.

## The frame clause

\`\`\`text
{ ROWS | RANGE | GROUPS } BETWEEN <start> AND <end>  [EXCLUDE …]

start / end:  UNBOUNDED PRECEDING | n PRECEDING | CURRENT ROW | n FOLLOWING | UNBOUNDED FOLLOWING
\`\`\`

- **ROWS** counts physical rows: \`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\` = this row and the two before it.
- **RANGE** works on *values* of the ORDER BY column: \`RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW\` = every row whose date is within 6 days of this one, however many rows that is.
- **GROUPS** counts groups of peers (rows with equal ORDER BY values).
- **Defaults:** without ORDER BY the frame is the whole partition. With ORDER BY it is \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`, which **includes all peers of the current row**.

## ROWS versus RANGE: ties

\`\`\`sql
SELECT x,
       sum(x) OVER (ORDER BY x)                       AS range_default,
       sum(x) OVER (ORDER BY x ROWS UNBOUNDED PRECEDING) AS rows_frame
FROM (VALUES (1), (2), (2), (3)) AS t(x)
ORDER BY x, rows_frame;
\`\`\`

With RANGE, both 2s see each other (5, 5). With ROWS they're counted one at a time (3, 5), but which of the tied rows comes first is **arbitrary**. Fix that with a unique tie-breaker in the window's ORDER BY: \`ORDER BY paid_at, payment_id\`. With a unique ORDER BY, ROWS and RANGE give the same running total.

## Moving windows

\`\`\`sql
-- 3-month moving average of monthly order counts
SELECT date_trunc('month', ordered_at)::date AS month,
       count(*) AS orders,
       round(avg(count(*)) OVER (ORDER BY date_trunc('month', ordered_at)::date
                                 ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3m
FROM orders
WHERE ordered_at >= '2025-01-01'
GROUP BY 1
ORDER BY 1;
\`\`\`

The first rows have a shorter frame (January averages only itself). \`ROWS n PRECEDING\` means "n *rows*", which equals n periods only if no period is missing. When gaps are possible, use \`RANGE\` with an interval.

## Partitions reset the accumulation

\`sum(x) OVER (PARTITION BY year ORDER BY month)\` restarts at every year: a **year-to-date** total. \`PARTITION BY customer_id ORDER BY ordered_at\` gives each customer's own running spend.

## EXCLUDE

\`EXCLUDE CURRENT ROW\` removes the row itself from its frame, e.g. "average of my colleagues, not counting me":

\`\`\`sql
SELECT employee_id, department_id, salary,
       round(avg(salary) OVER (PARTITION BY department_id
                               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                               EXCLUDE CURRENT ROW), 2) AS colleagues_avg
FROM employees
WHERE department_id = 1 AND termination_date IS NULL
ORDER BY employee_id
LIMIT 8;
\`\`\`

## Limits

- \`count(DISTINCT x) OVER (…)\` is **not supported**. Cumulative distinct counts need another approach (find each value's first occurrence, then run a total).
- Window results can't be filtered in the same query level. Wrap the query (Topics 19–20).`;

const lineValue = 'oi.quantity * oi.unit_price * (1 - oi.discount)';

const topic: Topic = {
  id: 16,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Window Function Calls and frame clause (4.2.8)', url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS' },
    { title: 'PostgreSQL 18 Tutorial: Window Functions (3.5)', url: 'https://www.postgresql.org/docs/18/tutorial-window.html' },
    { title: 'PostgreSQL 18: SELECT, the WINDOW clause', url: 'https://www.postgresql.org/docs/18/sql-select.html#SQL-WINDOW' },
    { title: 'PostgreSQL 18: Aggregate Functions (9.21)', url: 'https://www.postgresql.org/docs/18/functions-aggregate.html' },
    { title: 'Neon PostgreSQL Tutorial: Window Functions', url: 'https://neon.com/postgresql/postgresql-window-function' },
  ],
  questions: [
    {
      id: 't16-q01', topic: 16, relatedTopics: [1, 4, 5, 11, 14, 15], difficulty: 'easy', type: 'write-query',
      title: 'Running revenue in June 2025',
      prompt: `For each day of **June 2025** (UTC) with orders, show the revenue of non-cancelled orders that day and the **running total** since June 1 (both rounded to 2 decimals).

- **Columns:** \`day\` (date), \`revenue\`, \`running_total\`
- **Sort:** by \`day\`.`,
      hints: ['Group by day. `sum(sum(…)) OVER (ORDER BY day)` accumulates the daily sums.'],
      referenceSolution: `SELECT o.ordered_at::date AS day,
       round(sum(${lineValue}), 2) AS revenue,
       round(sum(sum(${lineValue})) OVER (ORDER BY o.ordered_at::date), 2) AS running_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
  AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [`SELECT day, round(revenue, 2) AS revenue, round(sum(revenue) OVER (ORDER BY day ROWS UNBOUNDED PRECEDING), 2) AS running_total FROM (SELECT o.ordered_at::date AS day, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' GROUP BY 1) d ORDER BY 1;`],
      wrongAnswers: [
        `SELECT o.ordered_at::date AS day, round(sum(${lineValue}), 2) AS revenue, round(sum(sum(${lineValue})) OVER (), 2) AS running_total FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' GROUP BY 1 ORDER BY 1;`,
        `SELECT o.ordered_at::date AS day, round(sum(${lineValue}), 2) AS revenue, round(sum(${lineValue}) OVER (ORDER BY o.ordered_at::date), 2) AS running_total FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' GROUP BY 1, ${lineValue} ORDER BY 1;`,
      ],
      explanation: `Windows run after GROUP BY, so the window sums the **daily** sums: \`sum(sum(x)) OVER (ORDER BY day)\`. Day values are unique after grouping, so the default RANGE frame and \`ROWS UNBOUNDED PRECEDING\` give the same result.

\`OVER ()\` puts the month total on every day. It doesn't accumulate.`,
      commonMistakes: ['OVER () instead of OVER (ORDER BY day).', 'Windowing over line values instead of daily totals.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q02', topic: 16, relatedTopics: [15], difficulty: 'easy', type: 'concept-mc',
      title: 'The default frame',
      prompt: `What frame does \`sum(amount) OVER (ORDER BY paid_at)\` use when you don't write one?`,
      options: [
        { text: '`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`' },
        { text: '`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, so rows with the same `paid_at` are all included' },
        { text: '`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`' },
        { text: 'There is no default. A frame is required when ORDER BY is used.' },
      ],
      correctOption: 1,
      hints: ['What happens to tied paid_at values in a running total?'],
      explanation: `With ORDER BY, the default is \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`. RANGE treats rows with equal ORDER BY values (*peers*) as one step, so tied payments get the same running total. Without ORDER BY, the frame is the whole partition.`,
      commonMistakes: ['Assuming the default is ROWS.'],
    },
    {
      id: 't16-q03', topic: 16, relatedTopics: [1, 15], difficulty: 'easy', type: 'predict-output',
      title: 'ROWS versus RANGE on ties',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       sum(x) OVER (ORDER BY x)                          AS range_sum,
       sum(x) OVER (ORDER BY x ROWS UNBOUNDED PRECEDING) AS rows_sum
FROM (VALUES (1), (2), (2), (3)) AS t(x)
ORDER BY x, rows_sum;`,
      options: [
        { table: { columns: ['x', 'range_sum', 'rows_sum'], rows: [['1', '1', '1'], ['2', '5', '3'], ['2', '5', '5'], ['3', '8', '8']] } },
        { table: { columns: ['x', 'range_sum', 'rows_sum'], rows: [['1', '1', '1'], ['2', '3', '3'], ['2', '5', '5'], ['3', '8', '8']] } },
        { table: { columns: ['x', 'range_sum', 'rows_sum'], rows: [['1', '1', '1'], ['2', '5', '5'], ['2', '5', '5'], ['3', '8', '8']] } },
        { table: { columns: ['x', 'range_sum', 'rows_sum'], rows: [['1', '1', '1'], ['2', '3', '5'], ['2', '5', '3'], ['3', '8', '8']] } },
      ],
      correctOption: 0,
      hints: ['RANGE includes peers (equal x). ROWS stops at the current physical row.'],
      explanation: `The default frame (RANGE) gives both 2s the sum up to and including all peers: 1 + 2 + 2 = 5. \`ROWS UNBOUNDED PRECEDING\` (short for \`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`) stops at the current row, so the first 2 gets 3 and the second 5. Which of the two physical 2s gets 3 is arbitrary, which is why the query sorts by \`rows_sum\` too.`,
      commonMistakes: ['Thinking ROWS and RANGE are the same.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't16-q04', topic: 16, relatedTopics: [1, 4, 11, 14, 15], difficulty: 'easy', type: 'write-query',
      title: 'Customer base growth in 2024',
      prompt: `For each month of **2024**, show how many customers signed up that month and the **cumulative** number of 2024 sign-ups up to the end of that month.

- **Columns:** \`month\` (date, first day of the month), \`signups\`, \`cumulative_signups\`
- **Sort:** by \`month\`.`,
      hints: ['`date_trunc(\'month\', signup_at)::date`', 'Then `sum(count(*)) OVER (ORDER BY month)`.'],
      referenceSolution: `SELECT date_trunc('month', signup_at)::date AS month,
       count(*) AS signups,
       sum(count(*)) OVER (ORDER BY date_trunc('month', signup_at)::date) AS cumulative_signups
FROM customers
WHERE signup_at >= '2024-01-01' AND signup_at < '2025-01-01'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [`SELECT month, n AS signups, sum(n) OVER (ORDER BY month) AS cumulative_signups FROM (SELECT date_trunc('month', signup_at)::date AS month, count(*) AS n FROM customers WHERE extract(year FROM signup_at) = 2024 GROUP BY 1) t ORDER BY 1;`],
      wrongAnswers: [
        `SELECT date_trunc('month', signup_at)::date AS month, count(*) AS signups, count(*) OVER (ORDER BY date_trunc('month', signup_at)::date) AS cumulative_signups FROM customers WHERE signup_at >= '2024-01-01' AND signup_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
        `SELECT date_trunc('month', signup_at)::date AS month, count(*) AS signups, sum(count(*)) OVER () AS cumulative_signups FROM customers WHERE signup_at >= '2024-01-01' AND signup_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `After GROUP BY there is one row per month. \`count(*) OVER (ORDER BY month)\` would count those **month rows** (1, 2, 3, … 12). To accumulate the per-month counts you need \`sum(count(*)) OVER (…)\`: the inner count is the aggregate, the outer sum is the window.`,
      commonMistakes: ['count(*) OVER (…) on grouped rows, which counts months.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q05', topic: 16, relatedTopics: [1, 4, 5, 11, 14, 15], difficulty: 'medium', type: 'write-query',
      title: '3-month moving average',
      prompt: `For each month from **January 2024 to June 2025**, show the revenue of non-cancelled orders and its **3-month moving average** (the month itself and the two before it, within this period; the first two months average fewer months). Round both to 2 decimals.

- **Columns:** \`month\` (date), \`revenue\`, \`moving_avg_3m\`
- **Sort:** by \`month\`.`,
      hints: ['`avg(sum(…)) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`'],
      referenceSolution: `SELECT date_trunc('month', o.ordered_at)::date AS month,
       round(sum(${lineValue}), 2) AS revenue,
       round(avg(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date
                                          ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS moving_avg_3m
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
  AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-07-01'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [
        `SELECT month, round(revenue, 2) AS revenue, round(avg(revenue) OVER (ORDER BY month RANGE BETWEEN INTERVAL '2 months' PRECEDING AND CURRENT ROW), 2) AS moving_avg_3m FROM (SELECT date_trunc('month', o.ordered_at)::date AS month, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-07-01' GROUP BY 1) m ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue, round(avg(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS moving_avg_3m FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-07-01' GROUP BY 1 ORDER BY 1;`,
        `SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue, round(avg(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date ROWS BETWEEN 3 PRECEDING AND CURRENT ROW), 2) AS moving_avg_3m FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-07-01' GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `\`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW\` is a frame of three rows: the current month and the two before it. "3 PRECEDING" would make it four months. Without a frame you get the default (from the first row to the current one), i.e. a running average since January 2024.

Every month here has orders, so "2 rows back" equals "2 months back". If months could be missing, \`RANGE BETWEEN INTERVAL '2 months' PRECEDING AND CURRENT ROW\` (the alternative) would still mean calendar months.`,
      commonMistakes: ['Off-by-one: 3 PRECEDING is four rows.', 'No frame, which gives a running average.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q06', topic: 16, relatedTopics: [1, 4, 5, 11, 14, 15], difficulty: 'medium', type: 'write-query',
      title: 'Year-to-date revenue',
      prompt: `For each month from **2023 to June 2025**, show the revenue of non-cancelled orders and the **year-to-date** revenue (from January of the same year up to and including that month). Round both to 2 decimals.

- **Columns:** \`year\` (integer), \`month\` (date), \`revenue\`, \`ytd_revenue\`
- **Sort:** by \`month\`.`,
      hints: ['Partition by year, order by month.'],
      referenceSolution: `SELECT extract(year FROM o.ordered_at)::int AS year,
       date_trunc('month', o.ordered_at)::date AS month,
       round(sum(${lineValue}), 2) AS revenue,
       round(sum(sum(${lineValue})) OVER (PARTITION BY extract(year FROM o.ordered_at)::int
                                          ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS ytd_revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
  AND o.ordered_at >= '2023-01-01'
GROUP BY 1, 2
ORDER BY 2;`,
      alternativeSolutions: [`SELECT year, month, round(revenue, 2) AS revenue, round(sum(revenue) OVER (PARTITION BY year ORDER BY month), 2) AS ytd_revenue FROM (SELECT extract(year FROM o.ordered_at)::int AS year, date_trunc('month', o.ordered_at)::date AS month, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' AND o.ordered_at >= '2023-01-01' GROUP BY 1, 2) m ORDER BY 2;`],
      wrongAnswers: [
        `SELECT extract(year FROM o.ordered_at)::int AS year, date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue, round(sum(sum(${lineValue})) OVER (ORDER BY date_trunc('month', o.ordered_at)::date), 2) AS ytd_revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2023-01-01' GROUP BY 1, 2 ORDER BY 2;`,
        `SELECT extract(year FROM o.ordered_at)::int AS year, date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue, round(sum(sum(${lineValue})) OVER (PARTITION BY extract(year FROM o.ordered_at)::int), 2) AS ytd_revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2023-01-01' GROUP BY 1, 2 ORDER BY 2;`,
      ],
      explanation: `PARTITION BY year makes the running total **restart** every January. Without it, the total keeps growing across years. Without the ORDER BY, each month shows the whole year's total.`,
      commonMistakes: ['No PARTITION BY year, so the total never resets.', 'No ORDER BY in the window.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q07', topic: 16, relatedTopics: [1, 15], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: order numbers that repeat',
      prompt: `This query should number each customer's orders 1, 2, 3, … in the order they were placed (by \`ordered_at\`, ties broken by \`order_id\`). But some customers placed two orders on the same day, and those get the same number. Fix it without using ranking functions.

- **Columns:** \`customer_id\`, \`order_id\`, \`order_no\`
- **Sort:** by \`customer_id\`, then \`order_no\`.`,
      starterSql: `SELECT customer_id, order_id,
       count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at::date) AS order_no
FROM orders
ORDER BY customer_id, order_no;`,
      hints: ['Cast to date makes same-day orders peers, and the default RANGE frame counts all peers.', 'Order by the full timestamp plus a unique tie-breaker.'],
      referenceSolution: `SELECT customer_id, order_id,
       count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS order_no
FROM orders
ORDER BY customer_id, order_no;`,
      alternativeSolutions: [`SELECT customer_id, order_id, count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS order_no FROM orders ORDER BY 1, 3;`],
      wrongAnswers: [
        `SELECT customer_id, order_id, count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at::date) AS order_no FROM orders ORDER BY customer_id, order_no;`,
        `SELECT customer_id, order_id, count(*) OVER (PARTITION BY customer_id) AS order_no FROM orders ORDER BY customer_id, order_no;`,
      ],
      explanation: `A running count is a numbering only if no two rows are peers. \`ordered_at::date\` throws away the time, so two orders on the same day become peers, and the default RANGE frame counts both: each gets the higher number.

With \`ORDER BY ordered_at, order_id\` every row is unique, so the frame grows by exactly one row at a time. (\`ROWS UNBOUNDED PRECEDING\` alone would also give distinct numbers, but without a tie-breaker the order of the tied rows is arbitrary.) Topic 17's \`row_number()\` does this directly.`,
      commonMistakes: ['Sorting by a value with ties.', 'Adding ROWS without a tie-breaker, which gives arbitrary numbering.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q08', topic: 16, relatedTopics: [1, 15], difficulty: 'medium', type: 'predict-output',
      title: 'A centred window',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       sum(x) OVER (ORDER BY x ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS s
FROM (VALUES (1), (2), (3), (4)) AS t(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 's'], rows: [['1', '3'], ['2', '6'], ['3', '9'], ['4', '7']] } },
        { table: { columns: ['x', 's'], rows: [['1', '1'], ['2', '3'], ['3', '6'], ['4', '10']] } },
        { table: { columns: ['x', 's'], rows: [['1', null], ['2', '6'], ['3', '9'], ['4', null]] } },
        { table: { columns: ['x', 's'], rows: [['1', '3'], ['2', '5'], ['3', '7'], ['4', '7']] } },
      ],
      correctOption: 0,
      hints: ['Each frame is the previous row, the row itself and the next row, when they exist.'],
      explanation: `The frame is up to three rows: x = 1 has no previous row (1 + 2 = 3), x = 2 sees 1 + 2 + 3 = 6, x = 3 sees 2 + 3 + 4 = 9, and x = 4 has no next row (3 + 4 = 7). Frames are simply shorter at the edges. They don't produce NULL.`,
      commonMistakes: ['Expecting NULL at the edges.', 'Confusing it with a running total.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't16-q09', topic: 16, relatedTopics: [1, 4, 5, 13, 15], difficulty: 'medium', type: 'write-query',
      title: 'Running payment balance',
      prompt: `For orders placed in **May or June 2025**, list every payment with the order's **running balance**: captured payments add their amount, refunded ones subtract it, failed ones change nothing. Payments are applied in \`paid_at\` order, ties broken by \`payment_id\`.

- **Columns:** \`order_id\`, \`payment_id\`, \`status\`, \`amount\`, \`balance\`
- **Sort:** by \`order_id\`, then \`paid_at\`, then \`payment_id\`.`,
      hints: ['`sum(CASE status WHEN … THEN amount WHEN … THEN -amount ELSE 0 END) OVER (PARTITION BY order_id ORDER BY paid_at, payment_id)`'],
      referenceSolution: `SELECT p.order_id, p.payment_id, p.status, p.amount,
       sum(CASE p.status WHEN 'captured' THEN p.amount
                         WHEN 'refunded' THEN -p.amount
                         ELSE 0 END)
         OVER (PARTITION BY p.order_id ORDER BY p.paid_at, p.payment_id) AS balance
FROM payments p
JOIN orders o ON o.order_id = p.order_id
WHERE o.ordered_at >= '2025-05-01' AND o.ordered_at < '2025-07-01'
ORDER BY p.order_id, p.paid_at, p.payment_id;`,
      alternativeSolutions: [`SELECT order_id, payment_id, status, amount, sum(CASE WHEN status = 'captured' THEN amount WHEN status = 'refunded' THEN -amount ELSE 0 END) OVER (PARTITION BY order_id ORDER BY paid_at, payment_id ROWS UNBOUNDED PRECEDING) AS balance FROM payments WHERE order_id IN (SELECT order_id FROM orders WHERE ordered_at >= '2025-05-01' AND ordered_at < '2025-07-01') ORDER BY order_id, paid_at, payment_id;`],
      wrongAnswers: [
        `SELECT p.order_id, p.payment_id, p.status, p.amount, sum(p.amount) OVER (PARTITION BY p.order_id ORDER BY p.paid_at, p.payment_id) AS balance FROM payments p JOIN orders o ON o.order_id = p.order_id WHERE o.ordered_at >= '2025-05-01' AND o.ordered_at < '2025-07-01' ORDER BY p.order_id, p.paid_at, p.payment_id;`,
        `SELECT p.order_id, p.payment_id, p.status, p.amount, sum(CASE p.status WHEN 'captured' THEN p.amount WHEN 'refunded' THEN -p.amount ELSE 0 END) OVER (ORDER BY p.order_id, p.paid_at, p.payment_id) AS balance FROM payments p JOIN orders o ON o.order_id = p.order_id WHERE o.ordered_at >= '2025-05-01' AND o.ordered_at < '2025-07-01' ORDER BY p.order_id, p.paid_at, p.payment_id;`,
      ],
      explanation: `A CASE inside the aggregate turns each payment into a signed movement, and the window accumulates those per order. Partitioning by order is what makes each order's balance start from zero. Without it the balance runs across all orders.

A failed payment contributes 0, so the balance stays where it was. Don't leave out the \`ELSE 0\`: a CASE without ELSE yields NULL, and if an order's *first* payment failed, its running sum is NULL (sum of only NULLs) instead of 0. Some payments share a \`paid_at\`. The \`payment_id\` tie-breaker keeps their running balances distinct and deterministic.`,
      commonMistakes: ['Summing raw amounts (failed and refunded payments added).', 'Forgetting PARTITION BY order_id.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q10', topic: 16, relatedTopics: [1, 4, 11, 14, 15], previewTopics: [20], difficulty: 'hard', type: 'write-query',
      title: 'Cumulative distinct buyers',
      prompt: `For each month of **2024**, how many **distinct customers** had placed at least one order (any status) in 2024 **up to the end of that month**?

- **Columns:** \`month\` (date), \`new_buyers\` (customers whose first 2024 order was that month), \`cumulative_buyers\`
- **Sort:** by \`month\`.`,
      hints: ['`count(DISTINCT …) OVER` isn\'t supported in PostgreSQL.', 'Find each customer\'s **first** 2024 order month, count customers per first month, and run a total over those counts.'],
      referenceSolution: `WITH first_month AS (
  SELECT customer_id, min(date_trunc('month', ordered_at))::date AS month
  FROM orders
  WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01'
  GROUP BY customer_id
)
SELECT month,
       count(*) AS new_buyers,
       sum(count(*)) OVER (ORDER BY month) AS cumulative_buyers
FROM first_month
GROUP BY month
ORDER BY month;`,
      alternativeSolutions: [
        `SELECT m.month, (SELECT count(*) FROM (SELECT customer_id FROM orders WHERE ordered_at >= '2024-01-01' GROUP BY 1 HAVING date_trunc('month', min(ordered_at))::date = m.month) a) AS new_buyers, (SELECT count(DISTINCT customer_id) FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < m.month + interval '1 month') AS cumulative_buyers FROM (SELECT DISTINCT date_trunc('month', ordered_at)::date AS month FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01') m ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT date_trunc('month', ordered_at)::date AS month, count(DISTINCT customer_id) AS new_buyers, sum(count(DISTINCT customer_id)) OVER (ORDER BY date_trunc('month', ordered_at)::date) AS cumulative_buyers FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
        `WITH first_month AS (SELECT customer_id, min(date_trunc('month', ordered_at))::date AS month FROM orders GROUP BY customer_id) SELECT month, count(*) AS new_buyers, sum(count(*)) OVER (ORDER BY month) AS cumulative_buyers FROM first_month WHERE month >= '2024-01-01' AND month < '2025-01-01' GROUP BY month ORDER BY month;`,
      ],
      explanation: `Summing monthly distinct counts double-counts every customer who buys in several months. The fix is to count each customer **once**, in the month they first appear, and then a running total of "new" customers is exactly the cumulative distinct count.

The second wrong answer finds the first order **ever**, so customers who already bought before 2024 are never counted. The question's scope is 2024 only.`,
      commonMistakes: ['Summing monthly distinct counts.', 'Using the first order ever instead of the first in 2024.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q11', topic: 16, relatedTopics: [1, 4, 11, 15], previewTopics: [19], difficulty: 'hard', type: 'write-query',
      title: 'Bursts of orders',
      prompt: `For every order, count how many orders the same customer placed in the **30 days up to and including it** (from \`ordered_at - 30 days\` to \`ordered_at\`, any status). Show only orders where that count is **3 or more**.

- **Columns:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`orders_30d\`
- **Sort:** by \`customer_id\`, then \`ordered_at\`, then \`order_id\`.`,
      hints: ['`count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at RANGE BETWEEN INTERVAL \'30 days\' PRECEDING AND CURRENT ROW)`', 'Filter on the count in an outer query.'],
      referenceSolution: `SELECT customer_id, order_id, ordered_at, orders_30d
FROM (
  SELECT customer_id, order_id, ordered_at,
         count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at
                        RANGE BETWEEN INTERVAL '30 days' PRECEDING AND CURRENT ROW) AS orders_30d
  FROM orders
) AS t
WHERE orders_30d >= 3
ORDER BY customer_id, ordered_at, order_id;`,
      alternativeSolutions: [`SELECT o.customer_id, o.order_id, o.ordered_at, x.n AS orders_30d FROM orders o CROSS JOIN LATERAL (SELECT count(*) AS n FROM orders e WHERE e.customer_id = o.customer_id AND e.ordered_at BETWEEN o.ordered_at - interval '30 days' AND o.ordered_at) x WHERE x.n >= 3 ORDER BY 1, 3, 2;`],
      wrongAnswers: [
        `SELECT customer_id, order_id, ordered_at, orders_30d FROM (SELECT customer_id, order_id, ordered_at, count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS orders_30d FROM orders) AS t WHERE orders_30d >= 3 ORDER BY customer_id, ordered_at, order_id;`,
        `SELECT customer_id, order_id, ordered_at, orders_30d FROM (SELECT customer_id, order_id, ordered_at, count(*) OVER (PARTITION BY customer_id ORDER BY ordered_at) AS orders_30d FROM orders) AS t WHERE orders_30d >= 3 ORDER BY customer_id, ordered_at, order_id;`,
      ],
      explanation: `"The last 30 days" is a span of **time**, not a number of rows, so it needs a RANGE frame with an interval offset: for each order, the frame holds the customer's orders whose \`ordered_at\` lies within 30 days before it. \`ROWS 29 PRECEDING\` means "the previous 29 orders", however long ago, and the default frame counts all orders so far.

RANGE with an offset requires exactly one ORDER BY column of a type that supports it (numbers, dates, timestamps).`,
      commonMistakes: ['ROWS n PRECEDING for a time window.', 'A running count since the first order.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q12', topic: 16, relatedTopics: [1, 4, 5, 10, 14, 15], previewTopics: [20], difficulty: 'hard', type: 'write-query',
      title: 'Products that make half the revenue',
      prompt: `Rank products by their all-time revenue from non-cancelled orders (highest first, ties by \`product_id\`). Return the **smallest set of top products whose combined revenue reaches at least 50%** of total revenue, i.e. every product up to and including the one where the running share crosses 50%.

- **Columns:** \`product_id\`, \`revenue\` (2 decimals), \`running_share_pct\` (running share in percent, 2 decimals)
- **Sort:** by \`revenue\` (highest first), then \`product_id\`.`,
      hints: ['Running sum: `sum(revenue) OVER (ORDER BY revenue DESC, product_id)`, and `sum(revenue) OVER ()` for the total.', 'A product belongs to the set if the share **before** it was still below 50%.'],
      referenceSolution: `WITH product_revenue AS (
  SELECT oi.product_id, sum(${lineValue}) AS revenue
  FROM order_items oi
  JOIN orders o ON o.order_id = oi.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY oi.product_id
), running AS (
  SELECT product_id, revenue,
         sum(revenue) OVER (ORDER BY revenue DESC, product_id) AS running_revenue,
         sum(revenue) OVER () AS total_revenue
  FROM product_revenue
)
SELECT product_id, round(revenue, 2) AS revenue,
       round(100 * running_revenue / total_revenue, 2) AS running_share_pct
FROM running
WHERE running_revenue - revenue < 0.5 * total_revenue
ORDER BY revenue DESC, product_id;`,
      alternativeSolutions: [
        `SELECT product_id, round(revenue, 2) AS revenue, round(100 * run / total, 2) AS running_share_pct FROM (SELECT product_id, revenue, sum(revenue) OVER (ORDER BY revenue DESC, product_id ROWS UNBOUNDED PRECEDING) AS run, coalesce(sum(revenue) OVER (ORDER BY revenue DESC, product_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before, sum(revenue) OVER () AS total FROM (SELECT oi.product_id, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM order_items oi JOIN orders o USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1) pr) t WHERE before < 0.5 * total ORDER BY 2 DESC, 1;`,
      ],
      wrongAnswers: [
        `WITH product_revenue AS (SELECT oi.product_id, sum(${lineValue}) AS revenue FROM order_items oi JOIN orders o ON o.order_id = oi.order_id WHERE o.status <> 'cancelled' GROUP BY oi.product_id), running AS (SELECT product_id, revenue, sum(revenue) OVER (ORDER BY revenue DESC, product_id) AS running_revenue, sum(revenue) OVER () AS total_revenue FROM product_revenue)
SELECT product_id, round(revenue, 2) AS revenue, round(100 * running_revenue / total_revenue, 2) AS running_share_pct FROM running WHERE running_revenue <= 0.5 * total_revenue ORDER BY revenue DESC, product_id;`,
        `WITH product_revenue AS (SELECT oi.product_id, sum(${lineValue}) AS revenue FROM order_items oi JOIN orders o ON o.order_id = oi.order_id GROUP BY oi.product_id), running AS (SELECT product_id, revenue, sum(revenue) OVER (ORDER BY revenue DESC, product_id) AS running_revenue, sum(revenue) OVER () AS total_revenue FROM product_revenue)
SELECT product_id, round(revenue, 2) AS revenue, round(100 * running_revenue / total_revenue, 2) AS running_share_pct FROM running WHERE running_revenue - revenue < 0.5 * total_revenue ORDER BY revenue DESC, product_id;`,
      ],
      explanation: `A classic Pareto question. Two windows over the same per-product rows: a running sum (ordered by revenue, with a tie-breaker so it is strictly increasing) and the grand total.

The boundary is subtle: \`running <= 50%\` stops **before** the product that crosses the line, so the set never actually reaches 50%. Checking the share *before* the current product (\`running - revenue < 50%\`) includes the crossing product and nothing after it.`,
      commonMistakes: ['Stopping before the threshold-crossing product.', 'Forgetting the cancelled filter.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q13', topic: 16, relatedTopics: [1, 15], difficulty: 'hard', type: 'predict-output',
      title: 'EXCLUDE CURRENT ROW',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       sum(x) OVER w   AS others_sum,
       count(*) OVER w AS others
FROM (VALUES (10), (20), (30)) AS t(x)
WINDOW w AS (ORDER BY x ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING EXCLUDE CURRENT ROW)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 'others_sum', 'others'], rows: [['10', '50', '2'], ['20', '40', '2'], ['30', '30', '2']] } },
        { table: { columns: ['x', 'others_sum', 'others'], rows: [['10', '60', '3'], ['20', '60', '3'], ['30', '60', '3']] } },
        { table: { columns: ['x', 'others_sum', 'others'], rows: [['10', null, '0'], ['20', '10', '1'], ['30', '30', '2']] } },
        { table: { columns: ['x', 'others_sum', 'others'], rows: [['10', '50', '3'], ['20', '40', '3'], ['30', '30', '3']] } },
      ],
      correctOption: 0,
      hints: ['The frame is the whole partition minus the current row.'],
      explanation: `The frame covers every row, and \`EXCLUDE CURRENT ROW\` removes the row itself: for 10, the others are 20 + 30 = 50; for 20, 10 + 30 = 40; for 30, 10 + 20 = 30. Each sees 2 rows. Other options: \`EXCLUDE GROUP\` (the row and its peers), \`EXCLUDE TIES\` (peers but not the row), \`EXCLUDE NO OTHERS\` (the default).`,
      commonMistakes: ['Thinking EXCLUDE only affects the sum, not the count.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't16-q14', topic: 16, relatedTopics: [1, 4, 10, 15], difficulty: 'medium', type: 'write-query',
      title: 'Salary versus colleagues',
      prompt: `For **active** employees in a department, show their salary and the **average salary of their active colleagues in the same department, not counting themselves** (2 decimals; NULL if they have no colleagues).

- **Columns:** \`department_id\`, \`employee_id\`, \`salary\`, \`colleagues_avg\`
- **Sort:** by \`department_id\`, then \`employee_id\`.`,
      hints: ['A frame over the whole partition with `EXCLUDE CURRENT ROW`.', 'Or: `(sum - salary) / nullif(count - 1, 0)`.'],
      referenceSolution: `SELECT department_id, employee_id, salary,
       round(avg(salary) OVER (PARTITION BY department_id
                               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                               EXCLUDE CURRENT ROW), 2) AS colleagues_avg
FROM employees
WHERE termination_date IS NULL
  AND department_id IS NOT NULL
ORDER BY department_id, employee_id;`,
      alternativeSolutions: [`SELECT department_id, employee_id, salary, round((sum(salary) OVER d - salary) / nullif(count(*) OVER d - 1, 0), 2) AS colleagues_avg FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL WINDOW d AS (PARTITION BY department_id) ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT department_id, employee_id, salary, round(avg(salary) OVER (PARTITION BY department_id), 2) AS colleagues_avg FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL ORDER BY department_id, employee_id;`,
        `SELECT department_id, employee_id, salary, round(avg(salary) OVER (PARTITION BY department_id ORDER BY employee_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 2) AS colleagues_avg FROM employees WHERE termination_date IS NULL AND department_id IS NOT NULL ORDER BY department_id, employee_id;`,
      ],
      explanation: `\`EXCLUDE CURRENT ROW\` removes the employee from their own frame. The frame needs an explicit \`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\`. An empty frame (a department of one) makes \`avg\` return NULL.

The arithmetic alternative works too: subtract one's own salary from the department sum and divide by one fewer person. \`nullif\` avoids division by zero for single-person departments. "1 PRECEDING" only looks at the colleagues *before* the employee in the window order.`,
      commonMistakes: ['Including the employee in their own average.', 'A frame that only looks backwards.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q15', topic: 16, relatedTopics: [1, 4, 5, 11, 14, 15], previewTopics: [19], difficulty: 'interview', type: 'write-query',
      title: 'Record sales days',
      prompt: `Which days (UTC) set a **new all-time record** for daily revenue of non-cancelled orders, i.e. higher than every earlier day's revenue? The very first day counts as a record.

- **Columns:** \`day\` (date), \`revenue\` (2 decimals), \`previous_record\` (2 decimals, NULL for the first day)
- **Sort:** by \`day\`.`,
      hints: ['The previous record is the max over all **earlier** rows: `ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING`.', 'A day is a record if the previous record is NULL or lower.'],
      referenceSolution: `SELECT day, round(revenue, 2) AS revenue, round(previous_record, 2) AS previous_record
FROM (
  SELECT o.ordered_at::date AS day,
         sum(${lineValue}) AS revenue,
         max(sum(${lineValue})) OVER (ORDER BY o.ordered_at::date
                                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS previous_record
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY 1
) AS d
WHERE previous_record IS NULL OR revenue > previous_record
ORDER BY day;`,
      alternativeSolutions: [
        `WITH d AS (SELECT o.ordered_at::date AS day, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1), m AS (SELECT day, revenue, max(revenue) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev FROM d)
SELECT day, round(revenue, 2) AS revenue, round(prev, 2) AS previous_record FROM m WHERE revenue > coalesce(prev, -1) ORDER BY day;`,
      ],
      wrongAnswers: [
        `SELECT day, round(revenue, 2) AS revenue, round(previous_record, 2) AS previous_record FROM (SELECT o.ordered_at::date AS day, sum(${lineValue}) AS revenue, max(sum(${lineValue})) OVER (ORDER BY o.ordered_at::date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS previous_record FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY 1) AS d WHERE revenue > previous_record ORDER BY day;`,
        `SELECT day, round(revenue, 2) AS revenue, round(previous_record, 2) AS previous_record FROM (SELECT o.ordered_at::date AS day, sum(${lineValue}) AS revenue, max(sum(${lineValue})) OVER (PARTITION BY extract(year FROM o.ordered_at) ORDER BY o.ordered_at::date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS previous_record FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY 1, extract(year FROM o.ordered_at)) AS d WHERE previous_record IS NULL OR revenue > previous_record ORDER BY day;`,
      ],
      explanation: `The frame \`ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING\` holds every earlier day but **not** the current one, so its max is "the record before today". Including the current row would make every day compare against itself.

For the first day the frame is empty and max returns NULL. \`revenue > NULL\` is unknown, which is why the first wrong answer loses the first day. Partitioning by year would reset the record every January ("yearly records"), a different question.`,
      commonMistakes: ['Losing the first day to NULL comparison.', 'Resetting the record per year.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't16-q16', topic: 16, relatedTopics: [1, 4, 5, 14, 15], previewTopics: [20], difficulty: 'interview', type: 'write-query',
      title: 'The order that crossed 1 000',
      prompt: `For each customer, find the **order at which their cumulative spend first reached 1 000 or more** (non-cancelled orders, line values without shipping, orders in \`ordered_at\` order with ties by \`order_id\`). Customers who never reach 1 000 are left out.

- **Columns:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`cumulative_spend\` (2 decimals, the running total including that order)
- **Sort:** by \`customer_id\`.`,
      hints: ['Step 1: order values. Step 2: running total per customer. Step 3: the first order with running total ≥ 1 000.', '`DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at, order_id` keeps the first qualifying order.'],
      referenceSolution: `WITH order_value AS (
  SELECT o.order_id, o.customer_id, o.ordered_at, sum(${lineValue}) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id
), running AS (
  SELECT order_id, customer_id, ordered_at,
         sum(value) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS cumulative
  FROM order_value
)
SELECT DISTINCT ON (customer_id)
       customer_id, order_id, ordered_at, round(cumulative, 2) AS cumulative_spend
FROM running
WHERE cumulative >= 1000
ORDER BY customer_id, ordered_at, order_id;`,
      alternativeSolutions: [
        `WITH r AS (SELECT o.customer_id, o.order_id, o.ordered_at, sum(sum(oi.quantity * oi.unit_price * (1 - oi.discount))) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) AS cum, sum(sum(oi.quantity * oi.unit_price * (1 - oi.discount))) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) - sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS before FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY o.order_id)
SELECT customer_id, order_id, ordered_at, round(cum, 2) AS cumulative_spend FROM r WHERE cum >= 1000 AND before < 1000 ORDER BY 1;`,
      ],
      wrongAnswers: [
        `WITH running AS (SELECT o.order_id, o.customer_id, o.ordered_at, sum(${lineValue}) OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id, oi.order_item_id) AS cumulative FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled')
SELECT DISTINCT ON (customer_id) customer_id, order_id, ordered_at, round(cumulative, 2) AS cumulative_spend FROM running WHERE cumulative >= 1000 ORDER BY customer_id, ordered_at, order_id, cumulative;`,
        `WITH order_value AS (SELECT o.order_id, o.customer_id, o.ordered_at, sum(${lineValue}) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY o.order_id), running AS (SELECT order_id, customer_id, ordered_at, sum(value) OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS cumulative FROM order_value)
SELECT DISTINCT ON (customer_id) customer_id, order_id, ordered_at, round(cumulative, 2) AS cumulative_spend FROM running WHERE cumulative >= 1000 ORDER BY customer_id, ordered_at, order_id;`,
      ],
      explanation: `Running totals must be computed at the right **grain**. Accumulating over order *lines* (first wrong answer) finds the right order but reports a partial total: the moment within the order where 1 000 was crossed, not the order's full running total.

Because the running total only grows (values are non-negative), the first row with \`cumulative >= 1000\` is the crossing order. \`DISTINCT ON\` keeps it. Equivalently, the crossing order is the one where the total *before* it was still under 1 000 (the alternative).`,
      commonMistakes: ['Accumulating at line level.', 'Forgetting the cancelled filter.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
