import type { Topic } from '../types.ts';

const explanation = `Aggregate functions turn **many rows into one value**: how many, how much, the average, the largest. With \`GROUP BY\` you get one result **per group**.

\`\`\`sql
SELECT status,
       count(*)                 AS orders,
       min(ordered_at)::date    AS first_order,
       max(ordered_at)::date    AS last_order
FROM orders
GROUP BY status
ORDER BY orders DESC;
\`\`\`

## The core aggregates

| function | notes |
|---|---|
| \`count(*)\` | counts rows |
| \`count(expr)\` | counts non-NULL values. \`count(DISTINCT expr)\` counts different values |
| \`sum\`, \`avg\` | ignore NULLs. \`avg\` of integers returns numeric |
| \`min\`, \`max\` | work on numbers, text, dates |
| \`string_agg(expr, sep ORDER BY …)\`, \`array_agg(… ORDER BY …)\` | concatenate values (order them explicitly!) |
| \`bool_and\`, \`bool_or\` | "all true?" / "any true?" |
| \`percentile_cont(0.5) WITHIN GROUP (ORDER BY x)\` | the **median** (interpolated). \`percentile_disc\` picks an actual value |
| \`mode() WITHIN GROUP (ORDER BY x)\` | the most frequent value |

Over **zero rows**, \`count\` returns 0 and every other aggregate returns NULL.

## GROUP BY rules

Every column in the SELECT list must either be **inside an aggregate** or **listed in GROUP BY**. Otherwise PostgreSQL can't know which value to show (*must appear in the GROUP BY clause or be used in an aggregate function*). PostgreSQL makes one exception: if you group by a table's **primary key**, you may select its other columns.

You can group by expressions: \`GROUP BY date_trunc('month', ordered_at)\`, or refer to output columns by position (\`GROUP BY 1\`).

## WHERE versus HAVING

- \`WHERE\` filters **rows before** grouping. It can't use aggregates.
- \`HAVING\` filters **groups after** aggregation.

\`\`\`sql
-- Customers with at least 10 non-cancelled orders
SELECT customer_id, count(*) AS orders
FROM orders
WHERE status <> 'cancelled'      -- rows
GROUP BY customer_id
HAVING count(*) >= 10            -- groups
ORDER BY orders DESC, customer_id;
\`\`\`

## FILTER: conditional aggregates

\`\`\`sql
SELECT date_trunc('year', ordered_at)::date AS year,
       count(*)                                        AS all_orders,
       count(*) FILTER (WHERE status = 'cancelled')    AS cancelled,
       round(100.0 * count(*) FILTER (WHERE status = 'cancelled') / count(*), 1) AS cancel_pct
FROM orders
GROUP BY 1
ORDER BY 1;
\`\`\`

## Two-level aggregation

"Average **order** value" needs two steps: first sum the lines **per order**, then average those totals. A single \`avg(line value)\` averages lines, which is a different number. Use a subquery or CTE (Topics 19–20).

## Subtotals: GROUPING SETS, ROLLUP, CUBE

\`GROUP BY ROLLUP (region, country)\` adds subtotal rows per region and a grand total. The rolled-up columns show NULL there, and \`GROUPING(col)\` tells you whether a NULL is a subtotal marker.

## Gotchas

- Joining a "many" table multiplies rows, so \`sum\` or \`count(*)\` over-count (Topic 5). Count orders with \`count(DISTINCT order_id)\`.
- \`sum(x) / count(*)\` is not \`avg(x)\` when x has NULLs, and with integers it's integer division too.
- \`string_agg\` without ORDER BY has no guaranteed order.`;

const lineValue = 'oi.quantity * oi.unit_price * (1 - oi.discount)';

const topic: Topic = {
  id: 14,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Aggregate Functions (9.21)', url: 'https://www.postgresql.org/docs/18/functions-aggregate.html' },
    { title: 'PostgreSQL 18: GROUP BY and HAVING (7.2.3)', url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-GROUP' },
    { title: 'PostgreSQL 18: GROUPING SETS, CUBE and ROLLUP (7.2.4)', url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-GROUPING-SETS' },
    { title: 'PGExercises: Aggregation', url: 'https://pgexercises.com/questions/aggregates/' },
    { title: 'Neon PostgreSQL Tutorial: GROUP BY', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-group-by' },
  ],
  questions: [
    {
      id: 't14-q01', topic: 14, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'Customers per country',
      prompt: `How many customers live in each \`country_id\`? Customers without a country form their own group (NULL).

- **Columns:** \`country_id\`, \`customers\`
- **Sort:** by \`country_id\` ascending (NULL group last).`,
      hints: ['`GROUP BY country_id` and `count(*)`.'],
      referenceSolution: `SELECT country_id, count(*) AS customers
FROM customers
GROUP BY country_id
ORDER BY country_id;`,
      alternativeSolutions: [`SELECT country_id, count(customer_id) AS customers FROM customers GROUP BY 1 ORDER BY 1 NULLS LAST;`],
      wrongAnswers: [
        `SELECT country_id, count(country_id) AS customers FROM customers GROUP BY country_id ORDER BY country_id;`,
        `SELECT country_id, count(*) AS customers FROM customers WHERE country_id IS NOT NULL GROUP BY country_id ORDER BY country_id;`,
      ],
      explanation: `GROUP BY puts all NULL country_ids into **one** group, and \`count(*)\` counts its rows.

\`count(country_id)\` counts non-NULL values, so the NULL group would show 0, even though it contains real customers.`,
      commonMistakes: ['count(column) for the NULL group, which shows 0.', 'Dropping the NULL group.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q02', topic: 14, relatedTopics: [4], difficulty: 'easy', type: 'concept-mc',
      title: 'WHERE or HAVING?',
      prompt: `You want customers with **more than 5 orders placed in 2024**. Which skeleton is correct?`,
      options: [
        { text: '`… WHERE count(*) > 5 AND ordered_at >= \'2024-01-01\' … GROUP BY customer_id`' },
        { text: '`… WHERE ordered_at >= \'2024-01-01\' AND ordered_at < \'2025-01-01\' GROUP BY customer_id HAVING count(*) > 5`' },
        { text: '`… GROUP BY customer_id HAVING ordered_at >= \'2024-01-01\' AND count(*) > 5`' },
        { text: '`… GROUP BY customer_id WHERE count(*) > 5`' },
      ],
      correctOption: 1,
      hints: ['Which conditions are about single rows, and which are about groups?'],
      explanation: `The date condition is about **rows**, so it belongs in WHERE (before grouping). The count condition is about **groups**, so it belongs in HAVING (after grouping).

Aggregates aren't allowed in WHERE. HAVING can't reference ungrouped row columns such as \`ordered_at\`. And WHERE can't come after GROUP BY.`,
      commonMistakes: ['Putting aggregate conditions in WHERE.'],
    },
    {
      id: 't14-q03', topic: 14, relatedTopics: [1, 4], difficulty: 'easy', type: 'predict-output',
      title: 'Aggregating nothing',
      prompt: `The WHERE clause removes every row. What does the query return?`,
      referenceSolution: `SELECT count(*) AS n, sum(x) AS total, max(x) AS biggest
FROM (VALUES (1), (2)) AS t(x)
WHERE x > 10;`,
      options: [
        { table: { columns: ['n', 'total', 'biggest'], rows: [] } },
        { table: { columns: ['n', 'total', 'biggest'], rows: [['0', '0', null]] } },
        { table: { columns: ['n', 'total', 'biggest'], rows: [['0', null, null]] } },
        { table: { columns: ['n', 'total', 'biggest'], rows: [[null, null, null]] } },
      ],
      correctOption: 2,
      hints: ['Without GROUP BY, an aggregate query always returns exactly one row.'],
      explanation: `An aggregate query **without GROUP BY** always returns one row, even over zero input rows. \`count\` gives 0, while \`sum\` and \`max\` give **NULL**: there's nothing to add or compare.

With a GROUP BY, zero input rows would produce zero groups, and so no rows. Use \`coalesce(sum(x), 0)\` when you need a 0.`,
      commonMistakes: ['Expecting sum over nothing to be 0.', 'Expecting no rows.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't14-q04', topic: 14, relatedTopics: [1, 4, 5, 11], difficulty: 'easy', type: 'write-query',
      title: 'Revenue per year',
      prompt: `Total revenue per year (UTC year of \`ordered_at\`) from **non-cancelled** orders. Revenue = sum of \`quantity * unit_price * (1 - discount)\` over the order lines, rounded to 2 decimals.

- **Columns:** \`year\` (integer), \`revenue\`
- **Sort:** by \`year\`.`,
      hints: ['Join orders to order_items, filter the status, group by the extracted year.'],
      referenceSolution: `SELECT extract(year FROM o.ordered_at)::int AS year,
       round(sum(${lineValue}), 2) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [`SELECT date_part('year', o.ordered_at)::int AS year, round(sum(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS revenue FROM order_items oi JOIN orders o USING (order_id) WHERE o.status != 'cancelled' GROUP BY date_part('year', o.ordered_at) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT extract(year FROM o.ordered_at)::int AS year, round(sum(${lineValue}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY 1 ORDER BY 1;`,
        `SELECT extract(year FROM o.ordered_at)::int AS year, round(sum(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `Filter rows with WHERE (cancelled orders out), group by the year expression, and sum the line values. \`GROUP BY 1\` refers to the first output column. Round once, at the end.`,
      commonMistakes: ['Including cancelled orders.', 'Forgetting the discount.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q05', topic: 14, relatedTopics: [1, 4, 5], previewTopics: [19, 20], difficulty: 'medium', type: 'write-query',
      title: 'Average order value per channel',
      prompt: `What is the **average order value** per \`channel\`, for **non-cancelled** orders? An order's value is the sum of its line values (\`quantity * unit_price * (1 - discount)\`) **plus its shipping_fee**. Round to 2 decimals.

- **Columns:** \`channel\`, \`orders\`, \`avg_order_value\`
- **Sort:** by \`channel\`.`,
      hints: ['Two levels: first compute each order\'s value (GROUP BY order), then average those per channel.', 'Add the shipping fee once per order, not once per line.'],
      referenceSolution: `WITH order_value AS (
  SELECT o.order_id, o.channel,
         sum(${lineValue}) + o.shipping_fee AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id, o.channel, o.shipping_fee
)
SELECT channel, count(*) AS orders, round(avg(value), 2) AS avg_order_value
FROM order_value
GROUP BY channel
ORDER BY channel;`,
      alternativeSolutions: [
        `SELECT channel, count(*) AS orders, round(avg(v), 2) AS avg_order_value FROM (SELECT o.channel, o.shipping_fee + sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS v FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY o.order_id) t GROUP BY channel ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT o.channel, count(DISTINCT o.order_id) AS orders, round(avg(${lineValue} + o.shipping_fee), 2) AS avg_order_value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.channel ORDER BY o.channel;`,
        `WITH order_value AS (SELECT o.order_id, o.channel, sum(${lineValue} + o.shipping_fee) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.order_id, o.channel)
SELECT channel, count(*) AS orders, round(avg(value), 2) AS avg_order_value FROM order_value GROUP BY channel ORDER BY channel;`,
      ],
      explanation: `Averages are only meaningful over the right unit. Averaging **lines** gives the average line value, not the average order value. So:

1. **Per order:** sum the lines and add the fee *once*. The fee is a column of \`orders\`, so it's grouped, not summed per line.
2. **Per channel:** average those order totals.

The second wrong answer adds the fee to every line, so multi-line orders pay it several times. Grouping by \`o.order_id\` alone is enough in PostgreSQL to select \`o.channel\` and \`o.shipping_fee\`, because they're functionally dependent on the primary key.`,
      commonMistakes: ['Averaging lines instead of orders.', 'Adding the shipping fee per line.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q06', topic: 14, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Frequent customers',
      prompt: `Find customers with **at least 10 non-cancelled orders**.

- **Columns:** \`customer_id\`, \`orders\`
- **Sort:** by \`orders\` (highest first), then \`customer_id\`.`,
      hints: ['WHERE for the status, HAVING for the count.'],
      referenceSolution: `SELECT customer_id, count(*) AS orders
FROM orders
WHERE status <> 'cancelled'
GROUP BY customer_id
HAVING count(*) >= 10
ORDER BY orders DESC, customer_id;`,
      alternativeSolutions: [`SELECT customer_id, count(order_id) AS orders FROM orders WHERE status != 'cancelled' GROUP BY customer_id HAVING count(order_id) > 9 ORDER BY 2 DESC, 1;`],
      wrongAnswers: [
        `SELECT customer_id, count(*) AS orders FROM orders GROUP BY customer_id HAVING count(*) >= 10 ORDER BY orders DESC, customer_id;`,
        `SELECT customer_id, count(*) AS orders FROM orders WHERE status <> 'cancelled' GROUP BY customer_id HAVING count(*) > 10 ORDER BY orders DESC, customer_id;`,
      ],
      explanation: `The status filter applies to **rows**, before they're counted, so it goes in WHERE. The threshold applies to the **count**, so it goes in HAVING. "At least 10" means \`>= 10\`.`,
      commonMistakes: ['Counting cancelled orders.', 'Using > instead of >=.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q07', topic: 14, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'What was in each order?',
      prompt: `For orders placed in **June 2025**, list the **product names** of each order as one text, **alphabetically sorted**, separated by \`', '\`.

- **Columns:** \`order_id\`, \`products\`
- **Sort:** by \`order_id\`.`,
      hints: ['`string_agg(p.name, \', \' ORDER BY p.name)`'],
      referenceSolution: `SELECT o.order_id, string_agg(p.name, ', ' ORDER BY p.name) AS products
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01'
GROUP BY o.order_id
ORDER BY o.order_id;`,
      alternativeSolutions: [`SELECT order_id, array_to_string(array_agg(p.name ORDER BY p.name), ', ') AS products FROM orders o JOIN order_items USING (order_id) JOIN products p USING (product_id) WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' GROUP BY order_id ORDER BY 1;`],
      wrongAnswers: [
        `SELECT o.order_id, string_agg(p.name, ', ' ORDER BY oi.line_no) AS products FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' GROUP BY o.order_id ORDER BY o.order_id;`,
        `SELECT o.order_id, string_agg(p.name, ',' ORDER BY p.name) AS products FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' GROUP BY o.order_id ORDER BY o.order_id;`,
      ],
      explanation: `\`string_agg(value, separator ORDER BY …)\` concatenates a group's values. The ORDER BY **inside** the aggregate controls the order within the text. Without it, the order is whatever the join produced. The query's final ORDER BY only sorts the output rows.`,
      commonMistakes: ['Ordering by line number instead of name.', 'The wrong separator.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q08', topic: 14, relatedTopics: [1, 4, 11], difficulty: 'medium', type: 'write-query',
      title: 'Orders and buyers per month',
      prompt: `For each month of **2024** (UTC), count the orders (any status) and the **number of different customers** who ordered.

- **Columns:** \`month\` (date, first day), \`orders\`, \`customers\`
- **Sort:** by \`month\`.`,
      hints: ['`date_trunc(\'month\', ordered_at)::date` as the group.', '`count(DISTINCT customer_id)`'],
      referenceSolution: `SELECT date_trunc('month', ordered_at)::date AS month,
       count(*)                    AS orders,
       count(DISTINCT customer_id) AS customers
FROM orders
WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [`SELECT make_date(2024, extract(month FROM ordered_at)::int, 1) AS month, count(order_id) AS orders, count(DISTINCT customer_id) AS customers FROM orders WHERE extract(year FROM ordered_at) = 2024 GROUP BY 1 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT date_trunc('month', ordered_at)::date AS month, count(*) AS orders, count(customer_id) AS customers FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
        `SELECT extract(month FROM ordered_at)::int AS month, count(*) AS orders, count(DISTINCT customer_id) AS customers FROM orders GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `\`count(customer_id)\` counts orders again, one per row. \`count(DISTINCT customer_id)\` counts **different** customers.

Grouping by the month *number* without a year filter would merge January 2021–2025 into one group.`,
      commonMistakes: ['count instead of count(DISTINCT).', 'Grouping by month number across years.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q09', topic: 14, relatedTopics: [1, 5], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: products per category',
      prompt: `This query should show each category's id, name and number of products. It fails. Fix it.

- **Columns:** \`category_id\`, \`name\`, \`products\`
- **Sort:** by \`category_id\`. Only categories that have products.`,
      starterSql: `SELECT c.category_id, c.name, count(*) AS products
FROM categories c
JOIN products p ON p.category_id = c.category_id
GROUP BY p.category_id
ORDER BY c.category_id;`,
      hints: ['Read the error: which column isn\'t grouped?', 'Group by the **categories** primary key, then its other columns may be selected.'],
      referenceSolution: `SELECT c.category_id, c.name, count(*) AS products
FROM categories c
JOIN products p ON p.category_id = c.category_id
GROUP BY c.category_id
ORDER BY c.category_id;`,
      alternativeSolutions: [`SELECT c.category_id, c.name, count(p.product_id) AS products FROM categories c JOIN products p USING (category_id) GROUP BY c.category_id, c.name ORDER BY 1;`],
      wrongAnswers: [`SELECT c.category_id, c.name, count(*) AS products FROM categories c LEFT JOIN products p ON p.category_id = c.category_id GROUP BY c.category_id ORDER BY c.category_id;`],
      explanation: `Error: *column "c.name" must appear in the GROUP BY clause or be used in an aggregate function*. The query groups by \`p.category_id\`, and PostgreSQL doesn't treat \`c.name\` as determined by that column.

Group by **\`c.category_id\`**, the primary key of \`categories\`. PostgreSQL then knows each group has exactly one \`c.name\` (functional dependency). Listing \`c.name\` in GROUP BY as well works everywhere.

A LEFT JOIN would add the empty categories with a count of 1, because count(*) counts the NULL-extended row.`,
      commonMistakes: ['Grouping by the wrong table\'s column.', 'LEFT JOIN with count(*).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q10', topic: 14, relatedTopics: [1, 10, 12], difficulty: 'medium', type: 'predict-output',
      title: 'avg versus sum / count',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT avg(x)            AS a,
       sum(x) / count(*) AS b,
       sum(x) / count(x) AS c
FROM (VALUES (2), (4), (NULL)) AS t(x);`,
      options: [
        { table: { columns: ['a', 'b', 'c'], rows: [['3', '2', '3']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['2', '2', '3']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['3', '3', '3']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [[null, null, '3']] } },
      ],
      correctOption: 0,
      hints: ['avg ignores NULLs. count(*) doesn\'t. All values are integers.'],
      explanation: `- \`avg(x)\` = (2 + 4) / 2 = **3** (shown as numeric, 3.0000000000000000), NULL ignored.
- \`sum(x) / count(*)\` = 6 / 3 = **2**: the NULL row is counted in the denominator, and it's integer division too.
- \`sum(x) / count(x)\` = 6 / 2 = **3**.

So "sum divided by count" equals the average only if you count the same rows avg uses.`,
      commonMistakes: ['Assuming sum/count(*) equals avg when NULLs are present.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't14-q11', topic: 14, relatedTopics: [1, 4, 5, 10], previewTopics: [20], difficulty: 'hard', type: 'write-query',
      title: 'Median order value per channel',
      prompt: `What is the **median** order value per channel (non-cancelled orders; order value = line values + shipping_fee), rounded to 2 decimals? Use the interpolated median.

- **Columns:** \`channel\`, \`median_order_value\`
- **Sort:** by \`channel\`.`,
      hints: ['Compute per-order values first (as in "Average order value per channel").', '`percentile_cont(0.5) WITHIN GROUP (ORDER BY value)` returns double precision. Cast to numeric before rounding.'],
      referenceSolution: `WITH order_value AS (
  SELECT o.order_id, o.channel,
         sum(${lineValue}) + o.shipping_fee AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id
)
SELECT channel,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY value))::numeric, 2) AS median_order_value
FROM order_value
GROUP BY channel
ORDER BY channel;`,
      alternativeSolutions: [],
      wrongAnswers: [
        `WITH order_value AS (SELECT o.order_id, o.channel, sum(${lineValue}) + o.shipping_fee AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.order_id)
SELECT channel, round(avg(value), 2) AS median_order_value FROM order_value GROUP BY channel ORDER BY channel;`,
        `SELECT o.channel, round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${lineValue}))::numeric, 2) AS median_order_value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.channel ORDER BY o.channel;`,
      ],
      explanation: `The median is the middle value: half the orders are cheaper, half more expensive. Unlike the average, it isn't pulled up by a few huge orders, and our order values are heavily skewed, so the two differ a lot.

\`percentile_cont(0.5) WITHIN GROUP (ORDER BY x)\` interpolates between the two middle values when the count is even. \`percentile_disc\` would return an actual data value instead. The result is double precision, so cast before \`round(…, 2)\`.

As with the average, compute it over **orders**, not lines.`,
      commonMistakes: ['Using avg (that\'s the mean, not the median).', 'Taking the median of line values.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, numericTolerance: 0.005 },
    },
    {
      id: 't14-q12', topic: 14, relatedTopics: [1, 4, 5], difficulty: 'hard', type: 'write-query',
      title: 'Revenue with region subtotals',
      prompt: `Revenue of **non-cancelled orders in 2024** by the **shipping country's region and country**, with a **subtotal per region** and a **grand total**. Revenue = sum of line values, rounded to 2 decimals. Orders without a shipping country are excluded.

- **Columns:** \`region\`, \`country\` (NULL on subtotal rows), \`revenue\` (region also NULL on the grand total)
- **Sort:** by \`region\` (NULLs last), then \`country\` (NULLs last).`,
      hints: ['`GROUP BY ROLLUP (co.region, co.name)` produces (region, country), (region) and () groupings.'],
      referenceSolution: `SELECT co.region, co.name AS country,
       round(sum(${lineValue}), 2) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN countries co   ON co.country_id = o.ship_country_id
WHERE o.status <> 'cancelled'
  AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01'
GROUP BY ROLLUP (co.region, co.name)
ORDER BY co.region NULLS LAST, co.name NULLS LAST;`,
      alternativeSolutions: [`SELECT co.region, co.name AS country, round(sum(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS revenue FROM orders o JOIN order_items oi USING (order_id) JOIN countries co ON co.country_id = o.ship_country_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY GROUPING SETS ((co.region, co.name), (co.region), ()) ORDER BY 1 NULLS LAST, 2 NULLS LAST;`],
      wrongAnswers: [
        `SELECT co.region, co.name AS country, round(sum(${lineValue}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN countries co ON co.country_id = o.ship_country_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY co.region, co.name ORDER BY co.region NULLS LAST, co.name NULLS LAST;`,
        `SELECT co.region, co.name AS country, round(sum(${lineValue}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN countries co ON co.country_id = o.ship_country_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY CUBE (co.region, co.name) ORDER BY co.region NULLS LAST, co.name NULLS LAST;`,
      ],
      explanation: `\`ROLLUP (a, b)\` is shorthand for \`GROUPING SETS ((a, b), (a), ())\`: detail rows, a subtotal per \`a\`, and a grand total. On subtotal rows the rolled-up column is NULL. \`GROUPING(co.name) = 1\` would tell you that the NULL is a subtotal marker rather than a real NULL.

\`CUBE\` adds every combination, including per-country totals across regions. That's more than asked.`,
      commonMistakes: ['Plain GROUP BY (no subtotals).', 'CUBE instead of ROLLUP.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q13', topic: 14, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Customers whose orders all arrived',
      prompt: `Find customers with **at least 3 orders** where **every one** of their orders has status \`'delivered'\`.

- **Columns:** \`customer_id\`, \`orders\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`bool_and(status = \'delivered\')` is true only if the condition holds for every row of the group.', 'Don\'t filter statuses in WHERE, or the other orders disappear before you can check them.'],
      referenceSolution: `SELECT customer_id, count(*) AS orders
FROM orders
GROUP BY customer_id
HAVING count(*) >= 3
   AND bool_and(status = 'delivered')
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, count(*) AS orders FROM orders GROUP BY customer_id HAVING count(*) >= 3 AND count(*) = count(*) FILTER (WHERE status = 'delivered') ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, count(*) AS orders FROM orders WHERE status = 'delivered' GROUP BY customer_id HAVING count(*) >= 3 ORDER BY customer_id;`,
        `SELECT customer_id, count(*) AS orders FROM orders GROUP BY customer_id HAVING count(*) >= 3 AND bool_or(status = 'delivered') ORDER BY customer_id;`,
      ],
      explanation: `"All rows satisfy X" is a group-level question, so answer it in HAVING: \`bool_and(X)\`, or compare the filtered count with the total count.

Filtering \`status = 'delivered'\` in WHERE removes the non-delivered orders **before** grouping, so every remaining group looks perfect. \`bool_or\` means "at least one".`,
      commonMistakes: ['Filtering in WHERE, which hides the orders that break the rule.', 'bool_or instead of bool_and.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q14', topic: 14, relatedTopics: [1, 4, 5, 10], difficulty: 'hard', type: 'write-query',
      title: 'Cancellation rate by category',
      prompt: `For each product category, how many **units** were ordered in total, how many of those were in **cancelled** orders, and what percentage that is (1 decimal)? Only categories with **at least 200 units** ordered.

- **Columns:** \`category_id\`, \`units\`, \`cancelled_units\`, \`cancel_pct\`
- **Sort:** by \`cancel_pct\` (highest first), then \`category_id\`.`,
      hints: ['`sum(quantity)` and `sum(quantity) FILTER (WHERE o.status = \'cancelled\')`.', 'The threshold on units goes in HAVING. Watch out for integer division in the percentage.'],
      referenceSolution: `SELECT p.category_id,
       sum(oi.quantity) AS units,
       coalesce(sum(oi.quantity) FILTER (WHERE o.status = 'cancelled'), 0) AS cancelled_units,
       round(100.0 * coalesce(sum(oi.quantity) FILTER (WHERE o.status = 'cancelled'), 0) / sum(oi.quantity), 1) AS cancel_pct
FROM order_items oi
JOIN orders o   ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.category_id
HAVING sum(oi.quantity) >= 200
ORDER BY cancel_pct DESC, p.category_id;`,
      alternativeSolutions: [`SELECT p.category_id, sum(oi.quantity) AS units, sum(CASE WHEN o.status = 'cancelled' THEN oi.quantity ELSE 0 END) AS cancelled_units, round(sum(CASE WHEN o.status = 'cancelled' THEN oi.quantity ELSE 0 END) * 100.0 / sum(oi.quantity), 1) AS cancel_pct FROM order_items oi JOIN orders o USING (order_id) JOIN products p USING (product_id) GROUP BY 1 HAVING sum(oi.quantity) >= 200 ORDER BY 4 DESC, 1;`],
      wrongAnswers: [
        `SELECT p.category_id, sum(oi.quantity) AS units, sum(oi.quantity) FILTER (WHERE o.status = 'cancelled') AS cancelled_units, round(100 * sum(oi.quantity) FILTER (WHERE o.status = 'cancelled') / sum(oi.quantity), 1) AS cancel_pct FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY p.category_id HAVING sum(oi.quantity) >= 200 ORDER BY cancel_pct DESC, p.category_id;`,
        `SELECT p.category_id, count(*) AS units, count(*) FILTER (WHERE o.status = 'cancelled') AS cancelled_units, round(100.0 * count(*) FILTER (WHERE o.status = 'cancelled') / count(*), 1) AS cancel_pct FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY p.category_id HAVING count(*) >= 200 ORDER BY cancel_pct DESC, p.category_id;`,
      ],
      explanation: `\`FILTER (WHERE …)\` restricts one aggregate to some rows while the others see the whole group. That gives part and total side by side, ready for a ratio.

- \`100 * a / b\` with integer sums truncates the percentage. Use \`100.0\`.
- \`count(*)\` counts order **lines**, not units (a line can have quantity 10).
- A filtered sum over no matching rows is NULL. Coalesce it to 0 for display.`,
      commonMistakes: ['Integer division.', 'Counting lines instead of summing units.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q15', topic: 14, relatedTopics: [1, 4, 5, 11], previewTopics: [20], difficulty: 'interview', type: 'write-query',
      title: '90-day repeat rate by signup month',
      prompt: `For customers who signed up in **2024**, grouped by **signup month** (UTC), what share placed **at least two non-cancelled orders within 90 days of signing up** (\`ordered_at < signup_at + INTERVAL '90 days'\`)?

- **Columns:** \`signup_month\` (date), \`customers\` (all who signed up that month), \`repeaters\`, \`repeat_pct\` (1 decimal)
- **Sort:** by \`signup_month\`.`,
      hints: ['Count each customer\'s qualifying orders first: a LEFT JOIN with the conditions in ON, grouped per customer.', 'Then aggregate per signup month: `count(*)` and `count(*) FILTER (WHERE n >= 2)`.'],
      referenceSolution: `WITH per_customer AS (
  SELECT c.customer_id,
         date_trunc('month', c.signup_at)::date AS signup_month,
         count(o.order_id) AS early_orders
  FROM customers c
  LEFT JOIN orders o
         ON o.customer_id = c.customer_id
        AND o.status <> 'cancelled'
        AND o.ordered_at < c.signup_at + INTERVAL '90 days'
  WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01'
  GROUP BY c.customer_id
)
SELECT signup_month,
       count(*)                                    AS customers,
       count(*) FILTER (WHERE early_orders >= 2)   AS repeaters,
       round(100.0 * count(*) FILTER (WHERE early_orders >= 2) / count(*), 1) AS repeat_pct
FROM per_customer
GROUP BY signup_month
ORDER BY signup_month;`,
      alternativeSolutions: [
        `SELECT date_trunc('month', c.signup_at)::date AS signup_month, count(*) AS customers,
       count(*) FILTER (WHERE (SELECT count(*) FROM orders o WHERE o.customer_id = c.customer_id AND o.status <> 'cancelled' AND o.ordered_at < c.signup_at + INTERVAL '90 days') >= 2) AS repeaters,
       round(100.0 * count(*) FILTER (WHERE (SELECT count(*) FROM orders o WHERE o.customer_id = c.customer_id AND o.status <> 'cancelled' AND o.ordered_at < c.signup_at + INTERVAL '90 days') >= 2) / count(*), 1) AS repeat_pct
FROM customers c WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01' GROUP BY 1 ORDER BY 1;`,
      ],
      wrongAnswers: [
        `WITH per_customer AS (SELECT c.customer_id, date_trunc('month', c.signup_at)::date AS signup_month, count(o.order_id) AS early_orders FROM customers c JOIN orders o ON o.customer_id = c.customer_id AND o.status <> 'cancelled' AND o.ordered_at < c.signup_at + INTERVAL '90 days' WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01' GROUP BY c.customer_id)
SELECT signup_month, count(*) AS customers, count(*) FILTER (WHERE early_orders >= 2) AS repeaters, round(100.0 * count(*) FILTER (WHERE early_orders >= 2) / count(*), 1) AS repeat_pct FROM per_customer GROUP BY signup_month ORDER BY signup_month;`,
        `WITH per_customer AS (SELECT c.customer_id, date_trunc('month', c.signup_at)::date AS signup_month, count(o.order_id) AS early_orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE c.signup_at >= '2024-01-01' AND c.signup_at < '2025-01-01' AND o.status <> 'cancelled' AND o.ordered_at < c.signup_at + INTERVAL '90 days' GROUP BY c.customer_id)
SELECT signup_month, count(*) AS customers, count(*) FILTER (WHERE early_orders >= 2) AS repeaters, round(100.0 * count(*) FILTER (WHERE early_orders >= 2) / count(*), 1) AS repeat_pct FROM per_customer GROUP BY signup_month ORDER BY signup_month;`,
      ],
      explanation: `A cohort-retention query in two steps:

1. **One row per customer** with the number of qualifying orders. The **LEFT JOIN with the order conditions in ON** keeps customers with zero early orders. They belong in the denominator!
2. **One row per cohort**, with a FILTER for the repeaters.

Both wrong answers shrink the denominator. An inner join, or order conditions in WHERE (which turn the LEFT JOIN into an inner join), drop customers who never ordered early, and inflate the repeat rate.`,
      commonMistakes: ['Losing non-buyers from the denominator.', 'Order conditions in WHERE after a LEFT JOIN.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q16', topic: 14, relatedTopics: [1, 4, 5, 11], previewTopics: [20], difficulty: 'interview', type: 'write-query',
      title: 'Best-selling category each year',
      prompt: `For each year (UTC) of non-cancelled orders, which **category** had the **highest revenue**? If two tie, take the lower \`category_id\`.

- **Columns:** \`year\`, \`category_id\`, \`revenue\` (rounded to 2 decimals)
- **Sort:** by \`year\`.`,
      hints: ['Aggregate revenue per (year, category) first.', 'Then keep the top row per year: `DISTINCT ON (year) … ORDER BY year, revenue DESC, category_id` (Topic 1).'],
      referenceSolution: `WITH yearly AS (
  SELECT extract(year FROM o.ordered_at)::int AS year,
         p.category_id,
         sum(${lineValue}) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  JOIN products p     ON p.product_id = oi.product_id
  WHERE o.status <> 'cancelled'
  GROUP BY 1, 2
)
SELECT DISTINCT ON (year) year, category_id, round(revenue, 2) AS revenue
FROM yearly
ORDER BY year, revenue DESC, category_id;`,
      alternativeSolutions: [
        `SELECT year, category_id, round(revenue, 2) AS revenue FROM (
  SELECT extract(year FROM o.ordered_at)::int AS year, p.category_id, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS revenue,
         row_number() OVER (PARTITION BY extract(year FROM o.ordered_at)::int ORDER BY sum(oi.quantity * oi.unit_price * (1 - oi.discount)) DESC, p.category_id) AS rn
  FROM orders o JOIN order_items oi USING (order_id) JOIN products p USING (product_id) WHERE o.status <> 'cancelled' GROUP BY 1, 2) t
WHERE rn = 1 ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT extract(year FROM o.ordered_at)::int AS year, max(p.category_id) AS category_id, round(max(${lineValue}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status <> 'cancelled' GROUP BY 1 ORDER BY 1;`,
        `WITH yearly AS (SELECT extract(year FROM o.ordered_at)::int AS year, p.category_id, sum(oi.quantity) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status <> 'cancelled' GROUP BY 1, 2)
SELECT DISTINCT ON (year) year, category_id, round(revenue, 2) AS revenue FROM yearly ORDER BY year, revenue DESC, category_id;`,
      ],
      explanation: `"The top X per group" needs two steps: **aggregate** to the (group, X) level, then **pick** the best row per group.

\`max()\` can't do the picking. \`max(category_id)\` is just the highest id, unrelated to revenue. PostgreSQL's \`DISTINCT ON\` keeps the first row per year in the given order. The portable version uses \`row_number()\` (Topic 17). Ranking by units instead of revenue answers a different question.`,
      commonMistakes: ['Using max() to "find" the top category.', 'Ranking by units instead of revenue.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't14-q17', topic: 14, relatedTopics: [1, 4, 9], difficulty: 'interview', type: 'write-query',
      title: 'E-mail addresses used more than once',
      prompt: `Data quality check: which **normalised e-mail addresses** (\`lower(trim(email))\`) are used by **more than one customer**? Show the customer ids as a sorted array.

- **Columns:** \`email\`, \`customers\` (count), \`customer_ids\` (integer array, ascending)
- **Sort:** by \`email\`.`,
      hints: ['GROUP BY the normalised expression, HAVING count(*) > 1.', '`array_agg(customer_id ORDER BY customer_id)`'],
      referenceSolution: `SELECT lower(trim(email)) AS email,
       count(*) AS customers,
       array_agg(customer_id ORDER BY customer_id) AS customer_ids
FROM customers
WHERE email IS NOT NULL
GROUP BY lower(trim(email))
HAVING count(*) > 1
ORDER BY email;`,
      alternativeSolutions: [`SELECT lower(trim(email)) AS email, count(customer_id) AS customers, array_agg(customer_id ORDER BY customer_id) AS customer_ids FROM customers GROUP BY 1 HAVING count(customer_id) >= 2 AND lower(trim(email)) IS NOT NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT email, count(*) AS customers, array_agg(customer_id ORDER BY customer_id) AS customer_ids FROM customers WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1 ORDER BY email;`,
        `SELECT lower(trim(email)) AS email, count(*) AS customers, array_agg(customer_id ORDER BY customer_id) AS customer_ids FROM customers GROUP BY lower(trim(email)) HAVING count(*) > 1 ORDER BY email;`,
      ],
      explanation: `Group by the **normalised** value, so that case and whitespace variants collapse into one group. HAVING keeps groups with more than one customer. \`array_agg(… ORDER BY …)\` lists the members, which is handy for follow-up merges.

Grouping the raw e-mail misses the variants. Without excluding NULL, the ~150 customers without an e-mail form one big "duplicate" group, because GROUP BY treats all NULLs as one value.`,
      commonMistakes: ['Grouping the raw value.', 'Forgetting that NULLs form one group.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
