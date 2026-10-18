import type { Topic } from '../types.ts';

const explanation = `Prices, quantities, salaries, percentages: most reports involve arithmetic. The traps are integer division, rounding rules and floating-point surprises.

## Numeric types

| type | use | note |
|---|---|---|
| \`integer\`, \`bigint\` | counts, ids | exact, no fractions |
| \`numeric(p, s)\` | **money**, exact decimals | exact. Our prices are \`numeric(10,2)\` |
| \`real\`, \`double precision\` | measurements, science | approximate (binary floating point) |

## Operators

\`+ - * /\`, \`%\` (remainder), \`^\` (power), \`|/\` (square root), \`@\` or \`abs()\` (absolute value).

\`\`\`sql
SELECT 7 / 2        AS int_div,      -- 3   integer ÷ integer = integer!
       7 % 2        AS remainder,    -- 1
       7 / 2.0      AS exact_div,    -- 3.5
       7::numeric / 2 AS cast_first, -- 3.5
       2 ^ 10       AS power,
       |/ 16        AS square_root;
\`\`\`

**Integer division** is the classic bug: \`count_a / count_b * 100\` is 0 whenever a < b. Make one operand numeric *before* dividing: \`100.0 * a / b\`.

## Rounding

\`\`\`sql
SELECT round(2.567, 2)  AS round_2dp,     -- 2.57
       round(1234.5, -2) AS round_hundreds,-- 1200
       trunc(2.567, 1)   AS trunc_1dp,     -- 2.5 (cuts, no rounding)
       ceil(2.1)         AS ceil,          -- 3   (up)
       floor(-2.1)       AS floor,         -- -3  (down, towards -infinity)
       round(2.5)        AS half_numeric,  -- 3   (numeric: half away from zero)
       round(2.5::float8) AS half_float;   -- 2   (float: half to even!)
\`\`\`

- A **negative precision** rounds to tens, hundreds…: \`round(x, -2)\`.
- \`trunc\` moves towards zero, \`floor\` towards −∞. They differ for negative numbers.
- \`round\` on **numeric** rounds halves away from zero. On **double precision** it rounds halves to even ("banker's rounding").
- Assigning to a \`numeric(10,2)\` column also rounds to 2 decimals.

## Floating point is approximate

\`0.1::float8 + 0.2::float8 = 0.3::float8\` is **false** (the sum is 0.30000000000000004). With numeric the same comparison is true. Keep money in numeric, and never compare floats with \`=\`.

## Handy functions

- \`abs(x)\`, \`sign(x)\`, \`mod(a, b)\`, \`power(a, b)\`, \`sqrt(x)\`, \`exp\`, \`ln\`, \`log10\`.
- \`greatest(a, b, …)\` / \`least(a, b, …)\`: the largest or smallest argument, **ignoring NULLs**.
- \`width_bucket(x, low, high, n)\` puts x into one of n equal-width bands between low and high. Below the range gives 0, and at or above the top gives n + 1.
- \`div(a, b)\`: integer quotient. \`gcd\`, \`lcm\`, \`factorial\` also exist.

\`\`\`sql
SELECT product_id, price,
       width_bucket(price, 0, 2500, 5) AS price_band,
       round((price - cost) / price * 100, 1) AS margin_pct
FROM products
ORDER BY product_id
LIMIT 8;
\`\`\`

## Gotchas

- \`x / 0\` is an error ("division by zero"). Guard it with \`NULLIF(divisor, 0)\` (Topic 12).
- Percent change is \`(new - old) / old * 100\`, divided by the **old** value.
- Round **once, at the end**. Rounding intermediate results accumulates error.
- \`numeric\` division shows many decimals (\`3.5000000000000000\`). Round or cast to \`numeric(p, s)\` for display.`;

const topic: Topic = {
  id: 10,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Mathematical Functions and Operators (9.3)', url: 'https://www.postgresql.org/docs/18/functions-math.html' },
    { title: 'PostgreSQL 18: Numeric Types (8.1)', url: 'https://www.postgresql.org/docs/18/datatype-numeric.html' },
    { title: 'PostgreSQL 18: Conditional Expressions, GREATEST and LEAST (9.18.4)', url: 'https://www.postgresql.org/docs/18/functions-conditional.html#FUNCTIONS-GREATEST-LEAST' },
    { title: 'Neon PostgreSQL Tutorial: Math Functions', url: 'https://neon.com/postgresql/postgresql-math-functions' },
  ],
  questions: [
    {
      id: 't10-q01', topic: 10, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Line values',
      prompt: `For the order lines of orders **1 to 5**, compute the **line value** \`quantity * unit_price * (1 - discount)\`, rounded to 2 decimals.

- **Columns:** \`order_item_id\`, \`order_id\`, \`line_value\`
- **Sort:** by \`order_item_id\`.`,
      hints: ['`discount` is a fraction: 0.150 means 15% off, so you pay `(1 - discount)` of the price.'],
      referenceSolution: `SELECT order_item_id, order_id,
       round(quantity * unit_price * (1 - discount), 2) AS line_value
FROM order_items
WHERE order_id BETWEEN 1 AND 5
ORDER BY order_item_id;`,
      alternativeSolutions: [`SELECT order_item_id, order_id, (quantity * unit_price * (1 - discount))::numeric(12,2) AS line_value FROM order_items WHERE order_id <= 5 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_item_id, order_id, round(quantity * unit_price, 2) AS line_value FROM order_items WHERE order_id BETWEEN 1 AND 5 ORDER BY order_item_id;`,
        `SELECT order_item_id, order_id, round(quantity * unit_price * discount, 2) AS line_value FROM order_items WHERE order_id BETWEEN 1 AND 5 ORDER BY order_item_id;`,
      ],
      explanation: `\`discount\` is the fraction taken *off*, so the customer pays \`1 - discount\` of the price. Multiply by quantity and unit price, then round once, at the end. Casting to \`numeric(12,2)\` rounds the same way.`,
      commonMistakes: ['Ignoring the discount.', 'Multiplying by the discount instead of (1 − discount).'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q02', topic: 10, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'Seven divided by two',
      prompt: `What does \`SELECT 7 / 2, 7 % 2;\` return in PostgreSQL?`,
      options: [{ text: '3.5 and 1' }, { text: '3 and 1' }, { text: '4 and 1' }, { text: '3.5 and 0.5' }],
      correctOption: 1,
      hints: ['What types are 7 and 2?'],
      explanation: `Both operands are integers, so \`/\` performs **integer division** and discards the fraction: 3. \`%\` is the remainder: 1. Write \`7 / 2.0\` or \`7::numeric / 2\` for 3.5.`,
      commonMistakes: ['Expecting a fractional result from integer division.'],
    },
    {
      id: 't10-q03', topic: 10, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Rounding negative numbers',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT round(2.5) AS a, round(-2.5) AS b, trunc(-2.7) AS c, ceil(-2.3) AS d, floor(-2.3) AS e;`,
      options: [
        { table: { columns: ['a', 'b', 'c', 'd', 'e'], rows: [['3', '-3', '-2', '-2', '-3']] } },
        { table: { columns: ['a', 'b', 'c', 'd', 'e'], rows: [['2', '-2', '-3', '-2', '-3']] } },
        { table: { columns: ['a', 'b', 'c', 'd', 'e'], rows: [['3', '-2', '-2', '-3', '-2']] } },
        { table: { columns: ['a', 'b', 'c', 'd', 'e'], rows: [['3', '-3', '-3', '-3', '-2']] } },
      ],
      correctOption: 0,
      hints: ['For numeric, round() moves halves away from zero.', 'trunc goes towards zero, ceil towards +∞, floor towards −∞.'],
      explanation: `- \`round(2.5)\` = **3**, \`round(-2.5)\` = **-3**: numeric rounding moves halves away from zero.
- \`trunc(-2.7)\` = **-2**: it cuts off the fraction, moving towards zero.
- \`ceil(-2.3)\` = **-2**: the smallest integer ≥ −2.3.
- \`floor(-2.3)\` = **-3**: the largest integer ≤ −2.3.`,
      commonMistakes: ['Thinking floor and trunc are the same for negative numbers.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't10-q04', topic: 10, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Margin percentage',
      prompt: `For products with a known \`cost\`, compute the **margin percentage** \`(price - cost) / price * 100\`, rounded to **1 decimal**. Show the **10 highest** margins (ties by \`product_id\`).

- **Columns:** \`product_id\`, \`price\`, \`cost\`, \`margin_pct\`
- **Sort:** by \`margin_pct\` (highest first), then \`product_id\`.`,
      hints: ['`round((price - cost) / price * 100, 1)`. prices are numeric, so no integer division here.'],
      referenceSolution: `SELECT product_id, price, cost,
       round((price - cost) / price * 100, 1) AS margin_pct
FROM products
WHERE cost IS NOT NULL
ORDER BY margin_pct DESC, product_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT product_id, price, cost, round(100 * (1 - cost / price), 1) AS margin_pct FROM products WHERE cost IS NOT NULL ORDER BY 4 DESC, 1 LIMIT 10;`],
      wrongAnswers: [
        `SELECT product_id, price, cost, round((price - cost) / cost * 100, 1) AS margin_pct FROM products WHERE cost IS NOT NULL ORDER BY margin_pct DESC, product_id LIMIT 10;`,
        `SELECT product_id, price, cost, round((price - cost) / price * 100, 1) AS margin_pct FROM products ORDER BY margin_pct DESC, product_id LIMIT 10;`,
      ],
      explanation: `Margin is relative to the **selling price**. Dividing by cost gives the *markup*, a different metric. Products without a cost would get a NULL margin, and in a DESC sort NULLs come first. That's another reason to filter them out.`,
      commonMistakes: ['Dividing by cost (markup) instead of price.', 'Forgetting to exclude unknown costs.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q05', topic: 10, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Commission in euros',
      prompt: `For **active Sales employees with a commission** (\`department_id = 2\`, \`termination_date IS NULL\`, \`commission_pct\` not NULL), compute their commission in euros: \`salary * commission_pct\`, rounded to **whole euros**.

- **Columns:** \`employee_id\`, \`salary\`, \`commission_pct\`, \`commission_eur\`
- **Sort:** by \`commission_eur\` (highest first), then \`employee_id\`.`,
      hints: ['`round(x)` without a second argument rounds to an integer value.'],
      referenceSolution: `SELECT employee_id, salary, commission_pct,
       round(salary * commission_pct) AS commission_eur
FROM employees
WHERE department_id = 2
  AND termination_date IS NULL
  AND commission_pct IS NOT NULL
ORDER BY commission_eur DESC, employee_id;`,
      alternativeSolutions: [`SELECT employee_id, salary, commission_pct, (salary * commission_pct)::int AS commission_eur FROM employees WHERE department_id = 2 AND termination_date IS NULL AND commission_pct IS NOT NULL ORDER BY 4 DESC, 1;`],
      wrongAnswers: [
        `SELECT employee_id, salary, commission_pct, trunc(salary * commission_pct) AS commission_eur FROM employees WHERE department_id = 2 AND termination_date IS NULL AND commission_pct IS NOT NULL ORDER BY commission_eur DESC, employee_id;`,
        `SELECT employee_id, salary, commission_pct, round(salary * commission_pct * 100) AS commission_eur FROM employees WHERE department_id = 2 AND termination_date IS NULL AND commission_pct IS NOT NULL ORDER BY commission_eur DESC, employee_id;`,
      ],
      explanation: `\`commission_pct\` is stored as a fraction (0.050 = 5%), so multiply directly. Don't multiply by 100 again. \`round(x)\` rounds to the nearest whole number, while \`trunc\` would always round down.`,
      commonMistakes: ['Treating the fraction as a percentage (×100).', 'Truncating instead of rounding.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q06', topic: 10, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Grams and weight classes',
      prompt: `For the **first 20 products** (by \`product_id\`) that have a \`weight_kg\`, show the weight in **whole grams** and a **weight class**: class 1 is up to 5 kg, class 2 above 5 and up to 10 kg, and so on, i.e. \`ceil(weight_kg / 5)\`.

- **Columns:** \`product_id\`, \`weight_kg\`, \`grams\` (integer), \`weight_class\`
- **Sort:** by \`product_id\`. 20 rows.`,
      hints: ['Grams: `round(weight_kg * 1000)::int`.', 'Class: `ceil(weight_kg / 5)`. A weight of exactly 5 kg is class 1.'],
      referenceSolution: `SELECT product_id, weight_kg,
       round(weight_kg * 1000)::int AS grams,
       ceil(weight_kg / 5) AS weight_class
FROM products
WHERE weight_kg IS NOT NULL
ORDER BY product_id
LIMIT 20;`,
      alternativeSolutions: [`SELECT product_id, weight_kg, (weight_kg * 1000)::integer AS grams, ceiling(weight_kg / 5.0) AS weight_class FROM products WHERE weight_kg IS NOT NULL ORDER BY 1 LIMIT 20;`],
      wrongAnswers: [
        `SELECT product_id, weight_kg, (trunc(weight_kg) * 1000)::int AS grams, ceil(weight_kg / 5) AS weight_class FROM products WHERE weight_kg IS NOT NULL ORDER BY product_id LIMIT 20;`,
        `SELECT product_id, weight_kg, round(weight_kg * 1000)::int AS grams, round(weight_kg / 5) AS weight_class FROM products WHERE weight_kg IS NOT NULL ORDER BY product_id LIMIT 20;`,
      ],
      explanation: `\`ceil\` rounds **up**, which is exactly "which 5-kg band is this in, counting from 1": 0.4 kg → 1, 5.0 kg → 1, 5.2 kg → 2.

\`floor(x / 5) + 1\` looks equivalent, but it's one too high at exact multiples of 5. \`round\` puts light products in class 0. For the grams, multiply first and round once: truncating the kilograms first throws away everything after the decimal point.`,
      commonMistakes: ['floor + 1 (wrong at exact boundaries).', 'round instead of ceil.', 'Rounding before converting units.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q07', topic: 10, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Price bands',
      prompt: `Put every product **still on sale** into one of **5 equal-width price bands between 0 and 2500** (band 1 = 0–500, …, band 5 = 2000–2500; anything at or above 2500 is band 6).

- **Columns:** \`product_id\`, \`price\`, \`band\`
- **Sort:** by \`product_id\`.`,
      hints: ['`width_bucket(value, low, high, number_of_buckets)`'],
      referenceSolution: `SELECT product_id, price, width_bucket(price, 0, 2500, 5) AS band
FROM products
WHERE discontinued_at IS NULL
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT product_id, price, floor(price / 500)::int + 1 AS band FROM products WHERE discontinued_at IS NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id, price, width_bucket(price, 0, 2000, 5) AS band FROM products WHERE discontinued_at IS NULL ORDER BY product_id;`,
        `SELECT product_id, price, width_bucket(price, 0, 2500, 4) AS band FROM products WHERE discontinued_at IS NULL ORDER BY product_id;`,
      ],
      explanation: `\`width_bucket(price, 0, 2500, 5)\` splits [0, 2500) into 5 bands of width 500 and returns 1–5, or 6 for values ≥ 2500. Each band **includes its lower bound and excludes its upper bound**, which is equivalent to \`floor(price / 500) + 1\` here.

Watch the boundaries when you write it by hand: \`ceil(price / 500)\` looks equivalent, but it puts a price of exactly 500.00 in band 1 instead of band 2.`,
      commonMistakes: ['Wrong number of buckets.', 'Off-by-one at band boundaries.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q08', topic: 10, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: share of a line that was returned',
      prompt: `For every return, the query should show **what percentage of the order line's quantity** was returned, rounded to 1 decimal (returning 1 of 3 units = 33.3). It only ever shows 0 or 100. Fix it.

- **Columns:** \`return_id\`, \`pct_returned\`
- **Sort:** by \`return_id\`.`,
      starterSql: `SELECT r.return_id,
       round(r.quantity / oi.quantity * 100, 1) AS pct_returned
FROM returns r
JOIN order_items oi ON oi.order_item_id = r.order_item_id
ORDER BY r.return_id;`,
      hints: ['Both quantities are integers. What is 1 / 3 in integer arithmetic?'],
      referenceSolution: `SELECT r.return_id,
       round(100.0 * r.quantity / oi.quantity, 1) AS pct_returned
FROM returns r
JOIN order_items oi ON oi.order_item_id = r.order_item_id
ORDER BY r.return_id;`,
      alternativeSolutions: [`SELECT r.return_id, round(r.quantity::numeric / oi.quantity * 100, 1) AS pct_returned FROM returns r JOIN order_items oi USING (order_item_id) ORDER BY 1;`],
      wrongAnswers: [`SELECT r.return_id, round((r.quantity / oi.quantity)::numeric * 100, 1) AS pct_returned FROM returns r JOIN order_items oi ON oi.order_item_id = r.order_item_id ORDER BY r.return_id;`],
      explanation: `\`r.quantity / oi.quantity\` divides two integers: 1 / 3 = 0, 3 / 3 = 1. Multiplying by 100 *afterwards* can't bring the fraction back. Make the division numeric first, either with \`100.0 * a / b\` (evaluated left to right, so 100.0 * a is numeric) or by casting one operand.

Casting the *result* of the integer division (the wrong answer) is too late.`,
      commonMistakes: ['Casting after the integer division.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q09', topic: 10, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'The higher of two shipping amounts',
      prompt: `For shipments of orders placed in **June 2025**, compare what the carrier charged us (\`shipments.shipping_cost\`, sometimes NULL) with what the customer paid (\`orders.shipping_fee\`). Show the **higher** of the two. If the carrier cost is unknown, use the fee.

- **Columns:** \`shipment_id\`, \`shipping_cost\`, \`shipping_fee\`, \`higher\`
- **Sort:** by \`shipment_id\`.`,
      hints: ['`greatest(a, b)` returns the largest argument, and it ignores NULLs.'],
      referenceSolution: `SELECT s.shipment_id, s.shipping_cost, o.shipping_fee,
       greatest(s.shipping_cost, o.shipping_fee) AS higher
FROM shipments s
JOIN orders o ON o.order_id = s.order_id
WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01'
ORDER BY s.shipment_id;`,
      alternativeSolutions: [`SELECT s.shipment_id, s.shipping_cost, o.shipping_fee, CASE WHEN s.shipping_cost > o.shipping_fee THEN s.shipping_cost ELSE o.shipping_fee END AS higher FROM shipments s JOIN orders o USING (order_id) WHERE o.ordered_at >= '2025-06-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT s.shipment_id, s.shipping_cost, o.shipping_fee, (s.shipping_cost + o.shipping_fee + abs(s.shipping_cost - o.shipping_fee)) / 2 AS higher FROM shipments s JOIN orders o ON o.order_id = s.order_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY s.shipment_id;`,
        `SELECT s.shipment_id, s.shipping_cost, o.shipping_fee, least(s.shipping_cost, o.shipping_fee) AS higher FROM shipments s JOIN orders o ON o.order_id = s.order_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY s.shipment_id;`,
      ],
      explanation: `\`greatest\` and \`least\` **skip NULL arguments** in PostgreSQL. They return NULL only if *all* arguments are NULL. That's exactly "use the fee when the cost is unknown". The arithmetic trick \`(a + b + |a − b|) / 2\` is mathematically the maximum, but any NULL makes it NULL.

(The SQL standard and some databases return NULL from greatest/least if *any* argument is NULL. PostgreSQL doesn't.)`,
      commonMistakes: ['Arithmetic formulas that turn NULL into NULL.', 'least instead of greatest.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q10', topic: 10, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Salary in three years',
      prompt: `Project the salaries of the **Finance** department's active employees (\`department_id = 6\`, \`termination_date IS NULL\`) after **three yearly raises of 3%**, compounded, rounded to the **nearest hundred**.

- **Columns:** \`employee_id\`, \`salary\`, \`projected\`
- **Sort:** by \`employee_id\`.`,
      hints: ['Compounding: `salary * 1.03 ^ 3`.', 'Round to hundreds with a negative precision: `round(x, -2)`.'],
      referenceSolution: `SELECT employee_id, salary,
       round(salary * 1.03 ^ 3, -2) AS projected
FROM employees
WHERE department_id = 6 AND termination_date IS NULL
ORDER BY employee_id;`,
      alternativeSolutions: [`SELECT employee_id, salary, round(salary * power(1.03, 3) / 100) * 100 AS projected FROM employees WHERE department_id = 6 AND termination_date IS NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT employee_id, salary, round(salary * 1.09, -2) AS projected FROM employees WHERE department_id = 6 AND termination_date IS NULL ORDER BY employee_id;`,
        `SELECT employee_id, salary, round(salary * 1.03 ^ 3, 2) AS projected FROM employees WHERE department_id = 6 AND termination_date IS NULL ORDER BY employee_id;`,
      ],
      explanation: `Three compounded raises multiply by 1.03 three times: \`1.03 ^ 3\` ≈ 1.0927, not 1.09. \`round(x, -2)\` rounds to the nearest hundred, the same as \`round(x / 100) * 100\`.`,
      commonMistakes: ['Adding percentages instead of compounding.', 'Rounding to cents instead of hundreds.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q11', topic: 10, relatedTopics: [1, 8], difficulty: 'hard', type: 'predict-output',
      title: 'Float versus numeric',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT 0.1::float8 + 0.2::float8 = 0.3::float8 AS float_equal,
       0.1 + 0.2 = 0.3                          AS numeric_equal,
       round(2.5::float8)                       AS float_round,
       round(2.5)                               AS numeric_round;`,
      options: [
        { table: { columns: ['float_equal', 'numeric_equal', 'float_round', 'numeric_round'], rows: [['true', 'true', '3', '3']] } },
        { table: { columns: ['float_equal', 'numeric_equal', 'float_round', 'numeric_round'], rows: [['false', 'true', '2', '3']] } },
        { table: { columns: ['float_equal', 'numeric_equal', 'float_round', 'numeric_round'], rows: [['false', 'false', '3', '3']] } },
        { table: { columns: ['float_equal', 'numeric_equal', 'float_round', 'numeric_round'], rows: [['false', 'true', '3', '2']] } },
      ],
      correctOption: 1,
      hints: ['0.1 has no exact binary representation.', 'Floating-point round() uses "round half to even".'],
      explanation: `- In binary floating point, 0.1 + 0.2 = 0.30000000000000004, so it's **not equal** to 0.3.
- \`0.1\` without a cast is **numeric** (exact decimal), so the sum is exactly 0.3: **true**.
- \`round()\` on double precision rounds halves to the nearest **even** number: 2.
- On numeric it rounds halves away from zero: 3.

This is why money belongs in numeric.`,
      commonMistakes: ['Expecting floats to be exact.', 'Assuming every round() rounds .5 up.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't10-q12', topic: 10, relatedTopics: [1], difficulty: 'hard', type: 'write-query',
      title: 'Split prices into net and VAT',
      prompt: `Our list prices **include 19% VAT**. For the **10 most expensive products** (ties by \`product_id\`), split the price into a **net** amount and the **VAT** amount, both to the cent, such that **net + VAT always equals the price exactly**.

- **Columns:** \`product_id\`, \`price\`, \`net\`, \`vat\`
- **Sort:** by \`price\` (highest first), then \`product_id\`.`,
      hints: ['Net = price / 1.19, rounded to 2 decimals.', 'Compute VAT as the *difference*, `price - net`, so the two always add up.'],
      referenceSolution: `SELECT product_id, price,
       round(price / 1.19, 2)         AS net,
       price - round(price / 1.19, 2) AS vat
FROM products
ORDER BY price DESC, product_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT product_id, price, net, price - net AS vat FROM (SELECT product_id, price, round(price / 1.19, 2) AS net FROM products) t ORDER BY price DESC, product_id LIMIT 10;`],
      wrongAnswers: [
        `SELECT product_id, price, round(price * 0.81, 2) AS net, round(price * 0.19, 2) AS vat FROM products ORDER BY price DESC, product_id LIMIT 10;`,
        `SELECT product_id, price, round(price * 0.81, 2) AS net, price - round(price * 0.81, 2) AS vat FROM products ORDER BY price DESC, product_id LIMIT 10;`,
      ],
      explanation: `VAT is a percentage of the **net** price: gross = net × 1.19, so net = gross / 1.19. Taking 19% of the gross price is a common mistake.

Rounding both parts independently can produce totals that are a cent off. Round one part and derive the other as the difference, and the parts always add back up to the original price. The same idea applies to splitting any amount (invoices, allocations).`,
      commonMistakes: ['Taking 19% of the gross price.', 'Rounding net and VAT independently, which can make them a cent off.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q13', topic: 10, relatedTopics: [1, 4, 8], difficulty: 'hard', type: 'write-query',
      title: 'Cash prices rounded to 5 cents',
      prompt: `In Switzerland, cash amounts are rounded to the nearest **0.05**. For the **discounted** order lines (\`discount > 0\`) of orders **1 to 200**, compute the effective unit price \`unit_price * (1 - discount)\` and its cash price rounded to the nearest 0.05.

- **Columns:** \`order_item_id\`, \`effective_price\` (rounded to 2 decimals), \`cash_price\` (as \`numeric(10,2)\`)
- **Sort:** by \`order_item_id\`.`,
      hints: ['Rounding to the nearest 0.05 = rounding to the nearest *twentieth*: `round(x * 20) / 20`.', 'Round the unrounded effective price, then cast: `::numeric(10,2)`.'],
      referenceSolution: `SELECT order_item_id,
       round(unit_price * (1 - discount), 2)                     AS effective_price,
       (round(unit_price * (1 - discount) * 20) / 20)::numeric(10,2) AS cash_price
FROM order_items
WHERE order_id BETWEEN 1 AND 200
  AND discount > 0
ORDER BY order_item_id;`,
      alternativeSolutions: [`SELECT order_item_id, round(unit_price * (1 - discount), 2) AS effective_price, round(round(unit_price * (1 - discount) / 0.05) * 0.05, 2) AS cash_price FROM order_items WHERE order_id <= 200 AND discount > 0 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_item_id, round(unit_price * (1 - discount), 2) AS effective_price, round(unit_price * (1 - discount), 1) AS cash_price FROM order_items WHERE order_id BETWEEN 1 AND 200 AND discount > 0 ORDER BY order_item_id;`,
        `SELECT order_item_id, round(unit_price * (1 - discount), 2) AS effective_price, (trunc(unit_price * (1 - discount) * 20) / 20)::numeric(10,2) AS cash_price FROM order_items WHERE order_id BETWEEN 1 AND 200 AND discount > 0 ORDER BY order_item_id;`,
      ],
      explanation: `To round to the nearest *step*, scale so the step becomes 1, round, and scale back: \`round(x * 20) / 20\` for steps of 0.05. For example, 42.49 → 849.8 → 850 → 42.50, and 8.4915 → 169.83 → 170 → 8.50.

- \`round(x, 1)\` rounds to steps of **0.10**: 42.47 becomes 42.5 instead of 42.45.
- \`trunc\` always rounds down.

(List prices ending in .99 happen to round the same way to 0.05 and to 0.10. Discounted prices don't, which is why this question uses them.)`,
      commonMistakes: ['Rounding to one decimal instead of to 0.05.', 'Truncating instead of rounding.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q14', topic: 10, relatedTopics: [1, 4, 8], difficulty: 'hard', type: 'write-query',
      title: 'Boxes needed',
      prompt: `A box holds **4 units**. For every order line with a quantity of **at least 3**, how many boxes are needed?

- **Columns:** \`order_item_id\`, \`quantity\`, \`boxes\` (integer)
- **Sort:** by \`order_item_id\`.`,
      hints: ['Partly filled boxes still count, so round **up**.', 'Watch the integer division: `quantity / 4` already throws away the fraction.'],
      referenceSolution: `SELECT order_item_id, quantity,
       ceil(quantity / 4.0)::int AS boxes
FROM order_items
WHERE quantity >= 3
ORDER BY order_item_id;`,
      alternativeSolutions: [`SELECT order_item_id, quantity, (quantity + 3) / 4 AS boxes FROM order_items WHERE quantity >= 3 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_item_id, quantity, ceil(quantity / 4)::int AS boxes FROM order_items WHERE quantity >= 3 ORDER BY order_item_id;`,
        `SELECT order_item_id, quantity, round(quantity / 4.0)::int AS boxes FROM order_items WHERE quantity >= 3 ORDER BY order_item_id;`,
      ],
      explanation: `\`ceil(quantity / 4.0)\` rounds up: 5 units → 1.25 → 2 boxes. With \`quantity / 4\`, integer division happens *before* ceil, so 5 / 4 = 1 and ceil(1) = 1, which is too few boxes.

The integer-only trick \`(quantity + 3) / 4\` (add divisor − 1, then integer-divide) is a classic "ceiling division".`,
      commonMistakes: ['ceil of an integer division.', 'round instead of ceil.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q15', topic: 10, relatedTopics: [1, 4, 5], difficulty: 'interview', type: 'write-query',
      title: 'Biggest effective discounts',
      prompt: `For each order line, the **effective unit price** is \`unit_price * (1 - discount)\`. Compare it with the product's **current list price** (\`products.price\`).

Show the **10 order lines** with the largest **percentage below list price**, \`(price - effective) / price * 100\`, rounded to 2 decimals. Ties by \`order_item_id\`.

- **Columns:** \`order_item_id\`, \`list_price\`, \`effective_price\` (rounded to 2 decimals), \`pct_below_list\`
- **Sort:** by \`pct_below_list\` (highest first), then \`order_item_id\`.`,
      hints: ['Join order_items to products.', 'Percentage below list = (list − effective) / **list** × 100. Compute it once with an alias and sort by that alias.'],
      referenceSolution: `SELECT oi.order_item_id,
       p.price AS list_price,
       round(oi.unit_price * (1 - oi.discount), 2) AS effective_price,
       round((p.price - oi.unit_price * (1 - oi.discount)) / p.price * 100, 2) AS pct_below_list
FROM order_items oi
JOIN products p ON p.product_id = oi.product_id
ORDER BY pct_below_list DESC, oi.order_item_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT order_item_id, list_price, round(eff, 2) AS effective_price, round(100 * (1 - eff / list_price), 2) AS pct_below_list FROM (SELECT oi.order_item_id, p.price AS list_price, oi.unit_price * (1 - oi.discount) AS eff FROM order_items oi JOIN products p USING (product_id)) t ORDER BY 4 DESC, 1 LIMIT 10;`],
      wrongAnswers: [
        `SELECT oi.order_item_id, p.price AS list_price, round(oi.unit_price, 2) AS effective_price, round((p.price - oi.unit_price) / p.price * 100, 2) AS pct_below_list FROM order_items oi JOIN products p ON p.product_id = oi.product_id ORDER BY pct_below_list DESC, oi.order_item_id LIMIT 10;`,
        `SELECT oi.order_item_id, p.price AS list_price, round(oi.unit_price * (1 - oi.discount), 2) AS effective_price, round((p.price - oi.unit_price * (1 - oi.discount)) / (oi.unit_price * (1 - oi.discount)) * 100, 2) AS pct_below_list FROM order_items oi JOIN products p ON p.product_id = oi.product_id ORDER BY pct_below_list DESC, oi.order_item_id LIMIT 10;`,
      ],
      explanation: `Two sources of "cheaper than list": an older (lower) \`unit_price\`, and the line \`discount\`. The effective price combines both.

The percentage is relative to the **list** price (the reference you compare *against*). Dividing by the effective price gives a different, larger number. Compute with full precision and round only for display.`,
      commonMistakes: ['Ignoring the line discount.', 'Dividing by the effective price instead of the list price.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't10-q16', topic: 10, relatedTopics: [1, 4], difficulty: 'interview', type: 'write-query',
      title: 'Tenure in years',
      prompt: `For **active employees**, compute their tenure on the reference date **2025-06-30** in years with **one decimal**: days employed divided by 365.25. Show the **15 longest-serving** (ties by \`employee_id\`).

- **Columns:** \`employee_id\`, \`hire_date\`, \`tenure_years\`
- **Sort:** by \`tenure_years\` (highest first), then \`employee_id\`.`,
      hints: ['`DATE \'2025-06-30\' - hire_date` is a number of days (integer).', 'Divide by 365.25 (a numeric literal), so the division isn\'t integer division.'],
      referenceSolution: `SELECT employee_id, hire_date,
       round((DATE '2025-06-30' - hire_date) / 365.25, 1) AS tenure_years
FROM employees
WHERE termination_date IS NULL
ORDER BY tenure_years DESC, employee_id
LIMIT 15;`,
      alternativeSolutions: [`SELECT employee_id, hire_date, round(('2025-06-30'::date - hire_date)::numeric / 365.25, 1) AS tenure_years FROM employees WHERE termination_date IS NULL ORDER BY 3 DESC, 1 LIMIT 15;`],
      wrongAnswers: [
        `SELECT employee_id, hire_date, round((DATE '2025-06-30' - hire_date) / 365, 1) AS tenure_years FROM employees WHERE termination_date IS NULL ORDER BY tenure_years DESC, employee_id LIMIT 15;`,
        `SELECT employee_id, hire_date, round((DATE '2025-06-30' - hire_date) / 365.25, 1) AS tenure_years FROM employees ORDER BY tenure_years DESC, employee_id LIMIT 15;`,
      ],
      explanation: `\`date - date\` returns whole **days** as an integer. Dividing by the *integer* 365 is integer division, which silently drops the fraction (12.9 years becomes 12.0). Dividing by the numeric 365.25 keeps the fraction, and it also accounts for leap years on average.

For calendar-exact ages ("how many birthdays have passed"), use \`age()\` and \`extract\` (Topic 11).`,
      commonMistakes: ['Integer division by 365.', 'Including former employees.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
