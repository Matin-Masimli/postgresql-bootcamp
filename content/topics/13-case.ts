import type { Topic } from '../types.ts';

const explanation = `\`CASE\` is SQL's if/else. It's an **expression**, so it can appear anywhere a value can: SELECT, WHERE, ORDER BY, GROUP BY, inside functions, UPDATE … SET.

## Two forms

\`\`\`sql
-- Searched CASE: any conditions, tested top to bottom
SELECT product_id, price,
       CASE
         WHEN price < 50  THEN 'budget'
         WHEN price < 500 THEN 'mid-range'
         ELSE 'premium'
       END AS tier
FROM products
ORDER BY product_id
LIMIT 6;
\`\`\`

\`\`\`sql
-- Simple CASE: compare one expression with values
SELECT order_id, status,
       CASE status
         WHEN 'delivered' THEN 'done'
         WHEN 'returned'  THEN 'done'
         WHEN 'cancelled' THEN 'void'
         ELSE 'open'
       END AS stage
FROM orders
ORDER BY order_id
LIMIT 6;
\`\`\`

## Rules worth knowing

- The **first** WHEN that is true wins, and later ones are skipped. Order your conditions from most to least specific: \`WHEN price < 500\` before \`WHEN price < 50\` would put everything cheap into the first branch.
- Without ELSE, a row that matches nothing gets **NULL**.
- \`WHEN\` must be **true**. Unknown (NULL) counts as not matched. In a simple CASE, \`CASE x WHEN NULL\` never matches. Use \`CASE WHEN x IS NULL\`.
- All branches must have **compatible types**. \`THEN 'unknown' ELSE weight_kg\` fails. Cast: \`ELSE weight_kg::text\`.
- CASE is the one construct that **guarantees evaluation order**: \`CASE WHEN qty > 0 THEN total / qty END\` never divides by zero, and \`CASE WHEN valid THEN raw::numeric END\` never casts junk (Topic 8).

## Common patterns

**Bucketing and labelling:** tiers, age groups, SLA categories.

**Custom sort order:**

\`\`\`sql
SELECT order_id, status
FROM orders
WHERE ordered_at >= '2025-06-25'
ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'processing' THEN 2 WHEN 'shipped' THEN 3 ELSE 4 END,
         order_id
LIMIT 10;
\`\`\`

**Conditional aggregation / pivoting** (aggregates in depth in Topic 14): count or sum only the rows that match, one column per category:

\`\`\`sql
SELECT count(*)                                               AS orders,
       sum(CASE WHEN channel = 'phone'  THEN 1 ELSE 0 END)   AS phone_orders,
       count(*) FILTER (WHERE channel = 'mobile')            AS mobile_orders -- PostgreSQL's shorter form
FROM orders;
\`\`\`

**Conditional updates:**

\`\`\`sql
UPDATE products
SET price = CASE WHEN price < 50 THEN price * 1.05 ELSE price END
WHERE discontinued_at IS NULL
RETURNING product_id, price;
\`\`\`

## CASE versus the shortcuts

- \`coalesce(a, b)\` = \`CASE WHEN a IS NOT NULL THEN a ELSE b END\`
- \`nullif(a, b)\` = \`CASE WHEN a = b THEN NULL ELSE a END\`
- \`greatest(a, b)\` ≈ \`CASE WHEN a >= b THEN a ELSE b END\` (but greatest ignores NULLs)

Use the shortcut when it fits. It's shorter and says what you mean.

## Gotchas

- Overlapping or out-of-order WHEN conditions: the first match wins, silently.
- Forgetting the ELSE turns unexpected values into NULL. Sometimes that's useful (it flags gaps), sometimes it's a bug.
- \`sum(CASE … THEN 1 END)\` without ELSE returns NULL, not 0, when nothing matches. Add \`ELSE 0\`, or use \`count(*) FILTER (…)\`.`;

const topic: Topic = {
  id: 13,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Conditional Expressions, CASE (9.18.1)', url: 'https://www.postgresql.org/docs/18/functions-conditional.html#FUNCTIONS-CASE' },
    { title: 'PostgreSQL 18: Expression Evaluation Rules (4.2.14)', url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-EXPRESS-EVAL' },
    { title: 'Neon PostgreSQL Tutorial: CASE', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-case' },
    { title: 'ThoughtSpot (Mode) SQL Tutorial: CASE', url: 'https://www.thoughtspot.com/sql-tutorial/sql-case' },
  ],
  questions: [
    {
      id: 't13-q01', topic: 13, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'Price tiers',
      prompt: `Label every product with a price tier: **\`'budget'\`** below 50, **\`'mid-range'\`** from 50 up to (but not including) 500, **\`'premium'\`** from 500.

- **Columns:** \`product_id\`, \`price\`, \`tier\`
- **Sort:** by \`product_id\`.`,
      hints: ['A searched CASE with two WHENs and an ELSE.', 'The first true WHEN wins, so test the lowest boundary first.'],
      referenceSolution: `SELECT product_id, price,
       CASE WHEN price < 50  THEN 'budget'
            WHEN price < 500 THEN 'mid-range'
            ELSE 'premium'
       END AS tier
FROM products
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT product_id, price, CASE WHEN price >= 500 THEN 'premium' WHEN price >= 50 THEN 'mid-range' ELSE 'budget' END AS tier FROM products ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id, price, CASE WHEN price < 500 THEN 'mid-range' WHEN price < 50 THEN 'budget' ELSE 'premium' END AS tier FROM products ORDER BY product_id;`,
        `SELECT product_id, price, CASE WHEN price < 50 THEN 'budget' WHEN price <= 500 THEN 'mid-range' END AS tier FROM products ORDER BY product_id;`,
      ],
      explanation: `CASE checks the WHENs **in order** and stops at the first true one. Testing \`< 500\` before \`< 50\` means "budget" is never reached, because every cheap product already matched "mid-range".

Without an ELSE, premium products would get NULL.`,
      commonMistakes: ['Conditions in the wrong order.', 'Forgetting the ELSE.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q02', topic: 13, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'No WHEN matches',
      prompt: `What does a CASE expression return for a row where **no WHEN condition is true** and there is **no ELSE**?`,
      options: [{ text: 'An error.' }, { text: 'NULL.' }, { text: 'The value of the last THEN.' }, { text: 'An empty string.' }],
      correctOption: 1,
      hints: ['The missing ELSE behaves like `ELSE NULL`.'],
      explanation: `A CASE without ELSE implicitly ends with \`ELSE NULL\`. That can be useful, for example \`sum(CASE WHEN … THEN amount END)\` ignores non-matching rows. It can also hide gaps in your categories.`,
      commonMistakes: ['Expecting an error or a default value.'],
    },
    {
      id: 't13-q03', topic: 13, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Which WHEN wins?',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT x,
       CASE WHEN x > 10  THEN 'big'
            WHEN x > 100 THEN 'huge'
            ELSE 'small'
       END AS size
FROM (VALUES (5), (50), (500)) AS t(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 'size'], rows: [['5', 'small'], ['50', 'big'], ['500', 'huge']] } },
        { table: { columns: ['x', 'size'], rows: [['5', 'small'], ['50', 'big'], ['500', 'big']] } },
        { table: { columns: ['x', 'size'], rows: [['5', null], ['50', 'big'], ['500', 'huge']] } },
        { table: { columns: ['x', 'size'], rows: [['5', 'small'], ['50', 'huge'], ['500', 'huge']] } },
      ],
      correctOption: 1,
      hints: ['500 > 10 is already true.'],
      explanation: `500 satisfies the first condition (\`x > 10\`), so it's 'big', and the 'huge' branch is never reached. Put the more specific condition (\`> 100\`) first.`,
      commonMistakes: ['Expecting CASE to pick the "best" match rather than the first.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't13-q04', topic: 13, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Order stage',
      prompt: `For orders placed **on or after 2025-05-01**, show a stage: \`'done'\` for delivered or returned orders, \`'void'\` for cancelled ones, and \`'open'\` for everything else.

- **Columns:** \`order_id\`, \`status\`, \`stage\`
- **Sort:** by \`order_id\`.`,
      hints: ['A simple CASE compares one value: `CASE status WHEN \'delivered\' THEN …`.'],
      referenceSolution: `SELECT order_id, status,
       CASE status
         WHEN 'delivered' THEN 'done'
         WHEN 'returned'  THEN 'done'
         WHEN 'cancelled' THEN 'void'
         ELSE 'open'
       END AS stage
FROM orders
WHERE ordered_at >= '2025-05-01'
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, status, CASE WHEN status IN ('delivered', 'returned') THEN 'done' WHEN status = 'cancelled' THEN 'void' ELSE 'open' END AS stage FROM orders WHERE ordered_at >= DATE '2025-05-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, status, CASE status WHEN 'delivered' THEN 'done' WHEN 'cancelled' THEN 'void' ELSE 'open' END AS stage FROM orders WHERE ordered_at >= '2025-05-01' ORDER BY order_id;`,
        `SELECT order_id, status, CASE status WHEN 'delivered' THEN 'done' WHEN 'returned' THEN 'done' WHEN 'cancelled' THEN 'void' END AS stage FROM orders WHERE ordered_at >= '2025-05-01' ORDER BY order_id;`,
      ],
      explanation: `The simple form \`CASE status WHEN 'a' THEN …\` is a compact way to compare one value against a list. For "one of several values", the searched form with \`IN (…)\` reads better.`,
      commonMistakes: ['Forgetting the returned status.', 'Forgetting the ELSE.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q05', topic: 13, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Orders by urgency',
      prompt: `List orders placed in **June 2025**, sorted by how urgently they need action: **pending** first, then **processing**, **shipped**, **delivered**, **returned**, and **cancelled** last. Within each status, by \`order_id\`.

- **Columns:** \`order_id\`, \`status\`
- **Sort:** as described.`,
      hints: ['ORDER BY can use a CASE that maps each status to a number.'],
      referenceSolution: `SELECT order_id, status
FROM orders
WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01'
ORDER BY CASE status
           WHEN 'pending'    THEN 1
           WHEN 'processing' THEN 2
           WHEN 'shipped'    THEN 3
           WHEN 'delivered'  THEN 4
           WHEN 'returned'   THEN 5
           ELSE 6
         END,
         order_id;`,
      alternativeSolutions: [`SELECT order_id, status FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY array_position(ARRAY['pending','processing','shipped','delivered','returned','cancelled'], status), order_id;`],
      wrongAnswers: [
        `SELECT order_id, status FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY status, order_id;`,
        `SELECT order_id, status FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'processing' THEN 2 ELSE 3 END, order_id;`,
      ],
      explanation: `Sorting by the text itself is alphabetical: cancelled, delivered, pending… CASE maps each status to its rank, and ORDER BY sorts by that number. \`array_position\` on an array of the desired order is a compact PostgreSQL alternative.`,
      commonMistakes: ['Sorting alphabetically.', 'Ranking only some statuses.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q06', topic: 13, relatedTopics: [1, 4], previewTopics: [14], difficulty: 'medium', type: 'write-query',
      title: 'Orders by channel in one row',
      prompt: `For **2024** (UTC), count all orders, and in separate columns the **web**, **mobile**, **phone** and **marketplace** orders: one row in total.

- **Columns:** \`total\`, \`web\`, \`mobile\`, \`phone\`, \`marketplace\``,
      hints: ['`sum(CASE WHEN channel = \'web\' THEN 1 ELSE 0 END)` counts matching rows.', 'PostgreSQL also has `count(*) FILTER (WHERE …)`.'],
      referenceSolution: `SELECT count(*)                                              AS total,
       sum(CASE WHEN channel = 'web'         THEN 1 ELSE 0 END)  AS web,
       sum(CASE WHEN channel = 'mobile'      THEN 1 ELSE 0 END)  AS mobile,
       sum(CASE WHEN channel = 'phone'       THEN 1 ELSE 0 END)  AS phone,
       sum(CASE WHEN channel = 'marketplace' THEN 1 ELSE 0 END)  AS marketplace
FROM orders
WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01';`,
      alternativeSolutions: [`SELECT count(*) AS total, count(*) FILTER (WHERE channel = 'web') AS web, count(*) FILTER (WHERE channel = 'mobile') AS mobile, count(*) FILTER (WHERE channel = 'phone') AS phone, count(*) FILTER (WHERE channel = 'marketplace') AS marketplace FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01';`],
      wrongAnswers: [
        `SELECT count(*) AS total, count(CASE WHEN channel = 'web' THEN 1 ELSE 0 END) AS web, count(CASE WHEN channel = 'mobile' THEN 1 ELSE 0 END) AS mobile, count(CASE WHEN channel = 'phone' THEN 1 ELSE 0 END) AS phone, count(CASE WHEN channel = 'marketplace' THEN 1 ELSE 0 END) AS marketplace FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01';`,
        `SELECT count(*) AS total, sum(CASE WHEN channel = 'web' THEN 1 ELSE 0 END) AS web, sum(CASE WHEN channel = 'mobile' THEN 1 ELSE 0 END) AS mobile, sum(CASE WHEN channel = 'phone' THEN 1 ELSE 0 END) AS phone, sum(CASE WHEN channel = 'marketplace' THEN 1 ELSE 0 END) AS marketplace FROM orders;`,
      ],
      explanation: `**Conditional aggregation:** the CASE produces 1 for matching rows and 0 for the others, and SUM adds them up. That's a pivot of one dimension into columns.

The trap: \`count(CASE … THEN 1 ELSE 0 END)\` counts **every** row, because 0 isn't NULL, and count only skips NULLs. Either use sum, or omit the ELSE inside count, or use \`count(*) FILTER (WHERE …)\`.`,
      commonMistakes: ['count() with ELSE 0, which counts everything.', 'Forgetting the year filter.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q07', topic: 13, relatedTopics: [1, 4, 11], difficulty: 'medium', type: 'write-query',
      title: 'Age groups',
      prompt: `For customers **1 to 40**, assign an age group based on their age in completed years on **2025-06-30**: \`'18-29'\`, \`'30-44'\`, \`'45-64'\`, \`'65+'\`, or \`'unknown'\` when \`birth_date\` is NULL.

- **Columns:** \`customer_id\`, \`age_group\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Age: `extract(year FROM age(DATE \'2025-06-30\', birth_date))` (Topic 11).', 'Handle the NULL birth date in the first WHEN.'],
      referenceSolution: `SELECT customer_id,
       CASE
         WHEN birth_date IS NULL THEN 'unknown'
         WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) < 30 THEN '18-29'
         WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) < 45 THEN '30-44'
         WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) < 65 THEN '45-64'
         ELSE '65+'
       END AS age_group
FROM customers
WHERE customer_id BETWEEN 1 AND 40
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, coalesce(CASE WHEN a < 30 THEN '18-29' WHEN a < 45 THEN '30-44' WHEN a < 65 THEN '45-64' WHEN a >= 65 THEN '65+' END, 'unknown') AS age_group FROM (SELECT customer_id, extract(year FROM age(DATE '2025-06-30', birth_date)) AS a FROM customers WHERE customer_id <= 40) t ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, CASE WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) < 30 THEN '18-29' WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) < 45 THEN '30-44' WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) < 65 THEN '45-64' ELSE '65+' END AS age_group FROM customers WHERE customer_id BETWEEN 1 AND 40 ORDER BY customer_id;`,
        `SELECT customer_id, CASE WHEN birth_date IS NULL THEN 'unknown' WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) <= 30 THEN '18-29' WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) <= 45 THEN '30-44' WHEN extract(year FROM age(DATE '2025-06-30', birth_date)) <= 65 THEN '45-64' ELSE '65+' END AS age_group FROM customers WHERE customer_id BETWEEN 1 AND 40 ORDER BY customer_id;`,
      ],
      explanation: `For a NULL birth date every age comparison is unknown, so a CASE without the explicit NULL test falls through to the **ELSE**, and these customers are labelled '65+'! Test for NULL first.

Band boundaries: '18-29' means age < 30, so a 30-year-old belongs in '30-44'. Using \`<=\` shifts every boundary by one year.`,
      commonMistakes: ['Unknown ages falling into the ELSE bucket.', 'Off-by-one boundaries.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q08', topic: 13, relatedTopics: [1, 8], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: weight label',
      prompt: `This query should show each of the first 20 products' weight, or **\`'unknown'\`** if \`weight_kg\` is NULL. It fails. Fix it.

- **Columns:** \`product_id\`, \`weight_label\` (text)
- **Sort:** by \`product_id\`. 20 rows.`,
      starterSql: `SELECT product_id,
       CASE WHEN weight_kg IS NULL THEN 'unknown' ELSE weight_kg END AS weight_label
FROM products
ORDER BY product_id
LIMIT 20;`,
      hints: ['All branches of a CASE must have the same type.'],
      referenceSolution: `SELECT product_id,
       CASE WHEN weight_kg IS NULL THEN 'unknown' ELSE weight_kg::text END AS weight_label
FROM products
ORDER BY product_id
LIMIT 20;`,
      alternativeSolutions: [`SELECT product_id, coalesce(weight_kg::text, 'unknown') AS weight_label FROM products ORDER BY 1 LIMIT 20;`],
      wrongAnswers: [`SELECT product_id, CASE WHEN weight_kg IS NULL THEN '0' ELSE weight_kg::text END AS weight_label FROM products ORDER BY product_id LIMIT 20;`],
      explanation: `Error: *invalid input syntax for type numeric: "unknown"*. PostgreSQL resolves one result type for the CASE, here numeric from the ELSE branch, and then can't turn 'unknown' into a number. Cast the numeric branch to text so both branches are text. \`coalesce(weight_kg::text, 'unknown')\` is the short form.`,
      commonMistakes: ['Replacing NULL with a fake number.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q09', topic: 13, relatedTopics: [1, 4, 5, 11], difficulty: 'medium', type: 'write-query',
      title: 'Shipping speed categories',
      prompt: `For shipments of orders placed in **June 2025**, categorise the delivery speed: \`'in transit'\` if not delivered yet, \`'fast'\` within **3 days**, \`'normal'\` within **7 days**, otherwise \`'slow'\` (durations measured as \`delivered_at - shipped_at\`, boundaries inclusive).

- **Columns:** \`shipment_id\`, \`speed\`
- **Sort:** by \`shipment_id\`.`,
      hints: ['Compare intervals: `delivered_at - shipped_at <= INTERVAL \'3 days\'`.', 'The NULL case first.'],
      referenceSolution: `SELECT s.shipment_id,
       CASE
         WHEN s.delivered_at IS NULL                              THEN 'in transit'
         WHEN s.delivered_at - s.shipped_at <= INTERVAL '3 days'  THEN 'fast'
         WHEN s.delivered_at - s.shipped_at <= INTERVAL '7 days'  THEN 'normal'
         ELSE 'slow'
       END AS speed
FROM shipments s
JOIN orders o ON o.order_id = s.order_id
WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01'
ORDER BY s.shipment_id;`,
      alternativeSolutions: [`SELECT shipment_id, CASE WHEN delivered_at IS NULL THEN 'in transit' WHEN extract(epoch FROM delivered_at - shipped_at) <= 3 * 86400 THEN 'fast' WHEN extract(epoch FROM delivered_at - shipped_at) <= 7 * 86400 THEN 'normal' ELSE 'slow' END AS speed FROM shipments WHERE order_id IN (SELECT order_id FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01') ORDER BY 1;`],
      wrongAnswers: [
        `SELECT s.shipment_id, CASE WHEN s.delivered_at - s.shipped_at <= INTERVAL '3 days' THEN 'fast' WHEN s.delivered_at - s.shipped_at <= INTERVAL '7 days' THEN 'normal' ELSE 'slow' END AS speed FROM shipments s JOIN orders o ON o.order_id = s.order_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY s.shipment_id;`,
        `SELECT s.shipment_id, CASE WHEN s.delivered_at IS NULL THEN 'in transit' WHEN s.delivered_at::date - s.shipped_at::date <= 3 THEN 'fast' WHEN s.delivered_at::date - s.shipped_at::date <= 7 THEN 'normal' ELSE 'slow' END AS speed FROM shipments s JOIN orders o ON o.order_id = s.order_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY s.shipment_id;`,
      ],
      explanation: `Undelivered shipments have a NULL \`delivered_at\`, which makes every duration comparison unknown. Without an explicit first WHEN, they fall into the ELSE and are reported as 'slow'.

The second wrong answer counts calendar days instead of elapsed time. That's a different rule, and it disagrees for parcels near the boundaries.`,
      commonMistakes: ['Undelivered parcels landing in the ELSE.', 'Using calendar days.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q10', topic: 13, relatedTopics: [1, 12], difficulty: 'medium', type: 'predict-output',
      title: 'CASE meets NULL',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT CASE NULL WHEN NULL THEN 'match' ELSE 'no match' END AS a,
       CASE WHEN NULL THEN 'yes' ELSE 'no' END            AS b,
       CASE WHEN NULL IS NULL THEN 'yes' ELSE 'no' END    AS c;`,
      options: [
        { table: { columns: ['a', 'b', 'c'], rows: [['match', 'no', 'yes']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['no match', 'no', 'yes']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [[null, null, 'yes']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['no match', null, 'yes']] } },
      ],
      correctOption: 1,
      hints: ['The simple CASE compares with `=`. What is `NULL = NULL`?'],
      explanation: `- **a:** simple CASE tests \`NULL = NULL\`, which is unknown, so no match: 'no match'.
- **b:** a WHEN condition that is NULL counts as not true, so the ELSE gives 'no'.
- **c:** \`NULL IS NULL\` is true: 'yes'.

To branch on NULL, always use the searched form with \`IS NULL\`.`,
      commonMistakes: ['Writing CASE x WHEN NULL.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't13-q11', topic: 13, relatedTopics: [1, 4, 11], previewTopics: [14], difficulty: 'hard', type: 'write-query',
      title: 'Captured payments by method and year',
      prompt: `Pivot **captured** payment amounts: one row per **year** of \`paid_at\` (UTC), one column per method.

- **Columns:** \`year\` (integer), \`card\`, \`paypal\`, \`bank_transfer\`, \`gift_card\`, \`wallet\` (sums; 0 if none)
- **Sort:** by \`year\`.`,
      hints: ['GROUP BY the year. For each method, `sum(CASE WHEN method = \'card\' THEN amount ELSE 0 END)`.', 'Only captured payments.'],
      referenceSolution: `SELECT extract(year FROM paid_at)::int AS year,
       sum(CASE WHEN method = 'card'          THEN amount ELSE 0 END) AS card,
       sum(CASE WHEN method = 'paypal'        THEN amount ELSE 0 END) AS paypal,
       sum(CASE WHEN method = 'bank_transfer' THEN amount ELSE 0 END) AS bank_transfer,
       sum(CASE WHEN method = 'gift_card'     THEN amount ELSE 0 END) AS gift_card,
       sum(CASE WHEN method = 'wallet'        THEN amount ELSE 0 END) AS wallet
FROM payments
WHERE status = 'captured'
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [`SELECT extract(year FROM paid_at)::int AS year, coalesce(sum(amount) FILTER (WHERE method = 'card'), 0) AS card, coalesce(sum(amount) FILTER (WHERE method = 'paypal'), 0) AS paypal, coalesce(sum(amount) FILTER (WHERE method = 'bank_transfer'), 0) AS bank_transfer, coalesce(sum(amount) FILTER (WHERE method = 'gift_card'), 0) AS gift_card, coalesce(sum(amount) FILTER (WHERE method = 'wallet'), 0) AS wallet FROM payments WHERE status = 'captured' GROUP BY 1 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT extract(year FROM paid_at)::int AS year, sum(CASE WHEN method = 'card' THEN amount ELSE 0 END) AS card, sum(CASE WHEN method = 'paypal' THEN amount ELSE 0 END) AS paypal, sum(CASE WHEN method = 'bank_transfer' THEN amount ELSE 0 END) AS bank_transfer, sum(CASE WHEN method = 'gift_card' THEN amount ELSE 0 END) AS gift_card, sum(CASE WHEN method = 'wallet' THEN amount ELSE 0 END) AS wallet FROM payments GROUP BY 1 ORDER BY 1;`,
        `SELECT extract(year FROM paid_at)::int AS year, sum(CASE WHEN method = 'card' THEN 1 ELSE 0 END) AS card, sum(CASE WHEN method = 'paypal' THEN 1 ELSE 0 END) AS paypal, sum(CASE WHEN method = 'bank_transfer' THEN 1 ELSE 0 END) AS bank_transfer, sum(CASE WHEN method = 'gift_card' THEN 1 ELSE 0 END) AS gift_card, sum(CASE WHEN method = 'wallet' THEN 1 ELSE 0 END) AS wallet FROM payments WHERE status = 'captured' GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `A pivot turns the values of one column (method) into columns. Group by the row dimension (year), and for each output column sum only the rows of that method. The CASE puts the amount in or contributes 0.

Without the status filter, failed attempts and refunds are added to the totals. PostgreSQL's \`sum(amount) FILTER (WHERE …)\` is equivalent. It gives NULL instead of 0 when nothing matches, hence the coalesce.`,
      commonMistakes: ['Summing all payment statuses.', 'Counting rows instead of summing amounts.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q12', topic: 13, relatedTopics: [1, 10], difficulty: 'hard', type: 'write-query',
      title: 'Margin category, unknowns included',
      prompt: `Categorise every product's margin \`(price - cost) / price\`: \`'unknown'\` when cost is NULL, \`'high'\` at **50% or more**, \`'medium'\` at **30% or more**, otherwise \`'low'\`.

- **Columns:** \`product_id\`, \`margin_category\`
- **Sort:** by \`product_id\`.`,
      hints: ['Test the NULL cost first.', 'Compare the fraction with 0.5 and 0.3.'],
      referenceSolution: `SELECT product_id,
       CASE
         WHEN cost IS NULL                   THEN 'unknown'
         WHEN (price - cost) / price >= 0.5  THEN 'high'
         WHEN (price - cost) / price >= 0.3  THEN 'medium'
         ELSE 'low'
       END AS margin_category
FROM products
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT product_id, CASE WHEN cost IS NULL THEN 'unknown' WHEN cost <= price * 0.5 THEN 'high' WHEN cost <= price * 0.7 THEN 'medium' ELSE 'low' END AS margin_category FROM products ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id, CASE WHEN (price - cost) / price >= 0.5 THEN 'high' WHEN (price - cost) / price >= 0.3 THEN 'medium' ELSE 'low' END AS margin_category FROM products ORDER BY product_id;`,
        `SELECT product_id, CASE WHEN cost IS NULL THEN 'unknown' WHEN (price - cost) / price >= 0.3 THEN 'medium' WHEN (price - cost) / price >= 0.5 THEN 'high' ELSE 'low' END AS margin_category FROM products ORDER BY product_id;`,
      ],
      explanation: `Two classic CASE traps in one question:

1. **NULL falls through to ELSE.** Without the first WHEN, unknown costs end up labelled 'low'.
2. **The order of overlapping conditions.** Testing \`>= 0.3\` before \`>= 0.5\` sends every high-margin product to 'medium'.

The alternative rewrites "margin ≥ 50%" as "cost ≤ half the price", which avoids the division.`,
      commonMistakes: ['Not handling NULL first.', 'Wrong order of overlapping thresholds.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q13', topic: 13, relatedTopics: [1, 3, 4], difficulty: 'hard', type: 'write-query',
      title: 'Tiered price increase',
      prompt: `Apply a **tiered price increase** to products **still on sale** with a single UPDATE: **+5%** for prices below 50, **+3%** for prices from 50 up to (but not including) 500, and **no change** from 500 upwards. (Prices are \`numeric(10,2)\`, so they're rounded to cents automatically.)`,
      hints: ['`SET price = CASE WHEN … THEN price * 1.05 WHEN … THEN price * 1.03 ELSE price END`'],
      referenceSolution: `UPDATE products
SET price = CASE
              WHEN price < 50  THEN price * 1.05
              WHEN price < 500 THEN price * 1.03
              ELSE price
            END
WHERE discontinued_at IS NULL;`,
      alternativeSolutions: [`UPDATE products SET price = price * 1.03 WHERE discontinued_at IS NULL AND price >= 50 AND price < 500;
UPDATE products SET price = price * 1.05 WHERE discontinued_at IS NULL AND price < 50;`],
      wrongAnswers: [
        `UPDATE products SET price = CASE WHEN price < 50 THEN price * 1.05 WHEN price < 500 THEN price * 1.03 END WHERE discontinued_at IS NULL;`,
        `UPDATE products SET price = price * 1.05 WHERE discontinued_at IS NULL AND price < 50;
UPDATE products SET price = price * 1.03 WHERE discontinued_at IS NULL AND price < 500;`,
      ],
      verificationQuery: `SELECT product_id, price FROM products`,
      explanation: `A CASE in SET computes each row's new value in one pass, and every branch sees the row's **old** price.

- Without \`ELSE price\`, expensive products would get NULL. Here the NOT NULL constraint would reject that, so it's an error.
- Two separate UPDATEs are the classic trap: a product at 49.99 is raised to 52.49 by the first statement, then *again* by the second, which now sees it in the 50–500 range. One CASE avoids the double application. (Two UPDATEs do work if you run the **higher** tier first, as in the alternative: raised products can't fall back into a lower tier.)`,
      commonMistakes: ['Missing ELSE, which sets the price to NULL.', 'Sequential UPDATEs that hit some rows twice.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q14', topic: 13, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Catalogue sort: on sale first',
      prompt: `Sort the whole catalogue like this: products **still on sale first**, most expensive first; then **discontinued** products, most recently discontinued first. Ties by \`product_id\`.

- **Columns:** \`product_id\`, \`price\`, \`discontinued_at\`
- **Sort:** as described.`,
      hints: ['First sort key: a CASE that is 0 for on-sale and 1 for discontinued products.', 'Each group has its own second key. A CASE can return NULL for the "other" group, so it doesn\'t interfere.'],
      referenceSolution: `SELECT product_id, price, discontinued_at
FROM products
ORDER BY CASE WHEN discontinued_at IS NULL THEN 0 ELSE 1 END,
         CASE WHEN discontinued_at IS NULL THEN price END DESC,
         discontinued_at DESC,
         product_id;`,
      alternativeSolutions: [
        `SELECT product_id, price, discontinued_at FROM products ORDER BY discontinued_at IS NOT NULL, CASE WHEN discontinued_at IS NULL THEN price END DESC NULLS LAST, discontinued_at DESC NULLS FIRST, product_id;`,
      ],
      wrongAnswers: [
        `SELECT product_id, price, discontinued_at FROM products ORDER BY discontinued_at NULLS FIRST, price DESC, product_id;`,
        `SELECT product_id, price, discontinued_at FROM products ORDER BY CASE WHEN discontinued_at IS NULL THEN 0 ELSE 1 END, price DESC, product_id;`,
      ],
      explanation: `Conditional sorting needs one key per rule:

1. The group: 0 = on sale, 1 = discontinued.
2. Within on-sale products, price descending. For discontinued rows this CASE is NULL, so all of them tie on this key and the next key decides.
3. Discontinued date descending. For on-sale rows it's NULL, and they've already been ordered by the previous keys.

A tempting shortcut is \`ORDER BY discontinued_at DESC, price DESC, product_id\`. In descending order NULLs come first, so on-sale products lead, sorted by price. It's *almost* right: discontinued products that share a discontinued date are then ordered by price instead of by \`product_id\`, and the hidden data has such a tie. The explicit CASE version states each rule exactly.`,
      commonMistakes: ['A single shared second key for both groups.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q15', topic: 13, relatedTopics: [1, 4, 5], previewTopics: [14, 20], difficulty: 'interview', type: 'write-query',
      title: 'Customer segments',
      prompt: `Segment customers by their **non-cancelled** orders:

| segment | rule (checked in this order) |
|---|---|
| \`'vip'\` | total spend ≥ 5000 **and** at least 10 orders |
| \`'loyal'\` | at least 5 orders |
| \`'big spender'\` | total spend ≥ 2000 |
| \`'regular'\` | everyone else **with** at least one order |
| \`'prospect'\` | no non-cancelled orders at all |

Spend = sum of \`quantity * unit_price * (1 - discount)\` over the order lines.

- **Columns:** \`customer_id\`, \`orders\`, \`spend\` (rounded to 2 decimals, 0 for prospects), \`segment\`
- **Sort:** by \`customer_id\`. Every customer appears.`,
      hints: ['Aggregate per customer first: count distinct orders and sum line values (Topic 14).', 'LEFT JOIN that summary to customers, so prospects appear with NULL, then coalesce to 0.', 'One CASE with the rules in the given order.'],
      referenceSolution: `WITH stats AS (
  SELECT o.customer_id,
         count(DISTINCT o.order_id) AS orders,
         sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS spend
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.customer_id
)
SELECT c.customer_id,
       coalesce(s.orders, 0)            AS orders,
       round(coalesce(s.spend, 0), 2)   AS spend,
       CASE
         WHEN s.orders IS NULL                     THEN 'prospect'
         WHEN s.spend >= 5000 AND s.orders >= 10   THEN 'vip'
         WHEN s.orders >= 5                        THEN 'loyal'
         WHEN s.spend >= 2000                      THEN 'big spender'
         ELSE 'regular'
       END AS segment
FROM customers c
LEFT JOIN stats s ON s.customer_id = c.customer_id
ORDER BY c.customer_id;`,
      alternativeSolutions: [
        `SELECT c.customer_id, coalesce(x.n, 0) AS orders, round(coalesce(x.v, 0), 2) AS spend,
  CASE WHEN coalesce(x.n, 0) = 0 THEN 'prospect' WHEN x.v >= 5000 AND x.n >= 10 THEN 'vip' WHEN x.n >= 5 THEN 'loyal' WHEN x.v >= 2000 THEN 'big spender' ELSE 'regular' END AS segment
FROM customers c LEFT JOIN (
  SELECT o.customer_id, count(DISTINCT o.order_id) AS n, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS v
  FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1) x USING (customer_id)
ORDER BY 1;`,
      ],
      wrongAnswers: [
        `WITH stats AS (SELECT o.customer_id, count(*) AS orders, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS spend FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id)
SELECT c.customer_id, coalesce(s.orders, 0) AS orders, round(coalesce(s.spend, 0), 2) AS spend, CASE WHEN s.orders IS NULL THEN 'prospect' WHEN s.spend >= 5000 AND s.orders >= 10 THEN 'vip' WHEN s.orders >= 5 THEN 'loyal' WHEN s.spend >= 2000 THEN 'big spender' ELSE 'regular' END AS segment FROM customers c LEFT JOIN stats s ON s.customer_id = c.customer_id ORDER BY c.customer_id;`,
        `WITH stats AS (SELECT o.customer_id, count(DISTINCT o.order_id) AS orders, sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS spend FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id)
SELECT c.customer_id, coalesce(s.orders, 0) AS orders, round(coalesce(s.spend, 0), 2) AS spend, CASE WHEN s.orders IS NULL THEN 'prospect' WHEN s.orders >= 5 THEN 'loyal' WHEN s.spend >= 5000 AND s.orders >= 10 THEN 'vip' WHEN s.spend >= 2000 THEN 'big spender' ELSE 'regular' END AS segment FROM customers c LEFT JOIN stats s ON s.customer_id = c.customer_id ORDER BY c.customer_id;`,
      ],
      explanation: `A classic analytics task: **aggregate, then classify**.

1. **Per-customer statistics:** joining orders to lines multiplies rows, so count orders with \`count(DISTINCT order_id)\`, not \`count(*)\`, which would count lines.
2. **Keep everyone:** LEFT JOIN the summary to customers. Prospects have no summary row, so their stats are NULL. Coalesce for display and test \`IS NULL\` in the CASE.
3. **Classify in priority order:** VIPs also satisfy the 'loyal' rule, so the VIP test must come first.`,
      commonMistakes: ['count(*) after joining lines, which counts lines rather than orders.', 'Testing the broader rule before the more specific one.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't13-q16', topic: 13, relatedTopics: [1, 4], previewTopics: [14], difficulty: 'interview', type: 'write-query',
      title: 'Status by channel matrix',
      prompt: `Build a **channel × status** matrix of order counts: one row per \`channel\`, one column per status.

- **Columns:** \`channel\`, \`pending\`, \`processing\`, \`shipped\`, \`delivered\`, \`returned\`, \`cancelled\`, \`total\`
- **Sort:** by \`channel\`.`,
      hints: ['GROUP BY channel, and per status `count(*) FILTER (WHERE status = …)` or `sum(CASE …)`.'],
      referenceSolution: `SELECT channel,
       count(*) FILTER (WHERE status = 'pending')    AS pending,
       count(*) FILTER (WHERE status = 'processing') AS processing,
       count(*) FILTER (WHERE status = 'shipped')    AS shipped,
       count(*) FILTER (WHERE status = 'delivered')  AS delivered,
       count(*) FILTER (WHERE status = 'returned')   AS returned,
       count(*) FILTER (WHERE status = 'cancelled')  AS cancelled,
       count(*)                                      AS total
FROM orders
GROUP BY channel
ORDER BY channel;`,
      alternativeSolutions: [
        `SELECT channel, sum(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, sum(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
  sum(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped, sum(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
  sum(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned, sum(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, count(*) AS total
FROM orders GROUP BY channel ORDER BY channel;`,
      ],
      wrongAnswers: [
        `SELECT channel, count(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, count(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing, count(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped, count(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered, count(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned, count(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, count(*) AS total FROM orders GROUP BY channel ORDER BY channel;`,
        `SELECT channel, status, count(*) AS total FROM orders GROUP BY channel, status ORDER BY channel, status;`,
      ],
      explanation: `Pivoting with conditional aggregation: GROUP BY the row dimension, and one filtered count per column value.

- \`count(*) FILTER (WHERE …)\` is PostgreSQL's (and the SQL standard's) clean syntax.
- \`sum(CASE … THEN 1 ELSE 0 END)\` is the portable version.
- \`count(CASE … ELSE 0 END)\` counts every row, because 0 isn't NULL.

GROUP BY channel, status gives the same numbers in "long" format (one row per pair). A pivot is the "wide" format.`,
      commonMistakes: ['count with ELSE 0.', 'Returning the long format instead of a matrix.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
