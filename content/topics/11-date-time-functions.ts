import type { Topic } from '../types.ts';

const explanation = `Dates and times are where many "correct-looking" queries go wrong: month ends, leap days, time zones, daylight saving. Our data contains all of these on purpose.

> **Reference date:** the data ends on **2025-06-30**. Treat that as "today" and write \`DATE '2025-06-30'\` instead of \`CURRENT_DATE\` or \`now()\`, so answers stay reproducible.

## The types

| type | holds | example |
|---|---|---|
| \`date\` | a calendar day | \`DATE '2024-02-29'\` |
| \`timestamptz\` | an absolute **moment** (stored as UTC, shown in the session zone) | \`TIMESTAMPTZ '2024-02-29 14:30:00+00'\` |
| \`timestamp\` | a wall-clock date and time **without** a zone | \`TIMESTAMP '2024-02-29 14:30'\` |
| \`interval\` | a duration | \`INTERVAL '1 month 3 days'\` |

Our \`ordered_at\`, \`paid_at\` etc. are \`timestamptz\`. The session time zone is UTC, so \`ordered_at::date\` is the **UTC** calendar day.

## Arithmetic

\`\`\`sql
SELECT DATE '2025-06-30' - DATE '2025-01-01'           AS days_between,    -- integer: 180
       DATE '2025-06-30' + 7                            AS week_later,      -- date
       TIMESTAMPTZ '2025-06-30 12:00+00' - INTERVAL '36 hours' AS earlier, -- timestamptz
       DATE '2024-01-31' + INTERVAL '1 month'           AS month_end_jump,  -- 2024-02-29: clamped!
       age(DATE '2025-06-30', DATE '2000-02-29')        AS age_of_leapling; -- 25 years 4 mons 1 day
\`\`\`

- \`date - date\` is an **integer** number of days. \`timestamptz - timestamptz\` is an **interval**.
- Adding months **clamps** to the end of the month: 31 January + 1 month = 29 February (in 2024).
- Compare intervals with intervals: \`delivered_at - shipped_at > INTERVAL '7 days'\`, never \`> 7\`.
- \`extract(epoch FROM interval)\` gives seconds, and dividing by 86400 gives fractional days.

## extract / date_part and date_trunc

\`\`\`sql
SELECT ordered_at,
       extract(year FROM ordered_at)   AS yr,
       extract(quarter FROM ordered_at) AS qtr,
       extract(isodow FROM ordered_at) AS iso_weekday,   -- 1 = Monday … 7 = Sunday
       date_trunc('month', ordered_at) AS month_start,   -- still a timestamptz
       date_trunc('week', ordered_at)::date AS iso_week_monday
FROM orders
ORDER BY order_id
LIMIT 5;
\`\`\`

- \`extract\` returns \`numeric\`. Cast with \`::int\` for clean output.
- \`dow\` counts **Sunday = 0** … Saturday = 6. \`isodow\` counts Monday = 1 … **Sunday = 7**.
- ISO weeks: \`extract(week …)\` is the ISO week number, and it belongs to \`isoyear\`, which can differ from \`year\`. 30 December 2024 is in **week 1 of ISO year 2025**.
- \`date_trunc('month', ts)\` returns the first instant of the month. Add \`INTERVAL '1 month' - INTERVAL '1 day'\` for the last day.

## Time zones

\`AT TIME ZONE\` converts in both directions:

\`\`\`sql
SELECT TIMESTAMPTZ '2024-03-31 01:30:00+00' AT TIME ZONE 'Europe/Berlin' AS berlin_wall_clock, -- 03:30 (CEST)
       TIMESTAMP   '2024-03-31 12:00:00'    AT TIME ZONE 'Asia/Tokyo'    AS moment_from_tokyo;  -- 03:00+00
\`\`\`

- \`timestamptz AT TIME ZONE 'zone'\` gives the **local wall-clock time** there (a \`timestamp\`).
- \`timestamp AT TIME ZONE 'zone'\` interprets a wall-clock time as local to that zone and gives the **moment** (\`timestamptz\`).
- Use IANA names (\`'Europe/Berlin'\`), not fixed offsets. Names follow daylight-saving rules, offsets don't.
- "Orders per local day" means \`(ordered_at AT TIME ZONE c.timezone)::date\`, which differs from the UTC day near midnight.

## Generating dates

\`\`\`sql
SELECT d::date AS day, to_char(d, 'Dy') AS weekday
FROM generate_series(DATE '2024-02-26', DATE '2024-03-02', INTERVAL '1 day') AS d;
\`\`\`

\`make_date(2025, 6, 30)\`, \`make_timestamptz(…)\` and \`make_interval(days => 3)\` build values from parts.

## Gotchas

- \`BETWEEN '2024-02-01' AND '2024-02-29'\` on a timestamp stops at midnight on the 29th. Use half-open ranges (Topic 4).
- \`extract(day …) = 31\` is not "the last day of the month".
- \`ordered_at::date\` depends on the session time zone. Ours is UTC.
- \`now()\` / \`CURRENT_DATE\` change every day. Fine in applications, but not in reproducible reports.`;

const topic: Topic = {
  id: 11,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Date/Time Functions and Operators (9.9)', url: 'https://www.postgresql.org/docs/18/functions-datetime.html' },
    { title: 'PostgreSQL 18: Date/Time Types (8.5)', url: 'https://www.postgresql.org/docs/18/datatype-datetime.html' },
    { title: 'PostgreSQL 18: AT TIME ZONE (9.9.4)', url: 'https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-ZONECONVERT' },
    { title: 'Neon PostgreSQL Tutorial: Date Functions', url: 'https://neon.com/postgresql/postgresql-date-functions' },
    { title: 'PGExercises: Working with timestamps', url: 'https://pgexercises.com/questions/date/' },
  ],
  questions: [
    {
      id: 't11-q01', topic: 11, relatedTopics: [1, 4, 8], difficulty: 'easy', type: 'write-query',
      title: 'Year and month of the first orders',
      prompt: `For orders **1 to 10**, show the year and the month number in which they were placed (UTC), as integers.

- **Columns:** \`order_id\`, \`ordered_at\`, \`order_year\`, \`order_month\`
- **Sort:** by \`order_id\`.`,
      hints: ['`extract(year FROM ordered_at)` and `extract(month FROM …)`. Cast with `::int`.'],
      referenceSolution: `SELECT order_id, ordered_at,
       extract(year FROM ordered_at)::int  AS order_year,
       extract(month FROM ordered_at)::int AS order_month
FROM orders
WHERE order_id BETWEEN 1 AND 10
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, ordered_at, date_part('year', ordered_at)::int AS order_year, date_part('month', ordered_at)::int AS order_month FROM orders WHERE order_id <= 10 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, ordered_at, extract(year FROM ordered_at)::int AS order_year, extract(day FROM ordered_at)::int AS order_month FROM orders WHERE order_id BETWEEN 1 AND 10 ORDER BY order_id;`,
        `SELECT order_id, ordered_at, extract(year FROM ordered_at)::int AS order_year, extract(quarter FROM ordered_at)::int AS order_month FROM orders WHERE order_id BETWEEN 1 AND 10 ORDER BY order_id;`,
      ],
      explanation: `\`extract(field FROM value)\` pulls one component out of a date or timestamp: year, month, day, hour, dow, quarter, epoch… It returns \`numeric\`, hence the \`::int\`. \`date_part('month', ts)\` is the function-call form of the same thing.`,
      commonMistakes: ['Extracting the wrong field.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q02', topic: 11, relatedTopics: [8], difficulty: 'easy', type: 'concept-mc',
      title: 'Subtracting dates and timestamps',
      prompt: `What are the result types of \`DATE '2025-06-30' - DATE '2025-06-01'\` and \`TIMESTAMPTZ '2025-06-30 12:00+00' - TIMESTAMPTZ '2025-06-01 12:00+00'\`?`,
      options: [{ text: 'interval and interval' }, { text: 'integer (days) and interval' }, { text: 'date and timestamp' }, { text: 'integer and integer' }],
      correctOption: 1,
      hints: ['A date has no time of day.'],
      explanation: `\`date − date\` gives the number of **days** as an integer (29). \`timestamptz − timestamptz\` gives an **interval** ('29 days'). To compare a timestamp difference, use an interval (\`> INTERVAL '7 days'\`), or convert it with \`extract(epoch FROM …)\`.`,
      commonMistakes: ['Comparing an interval with a plain number.'],
    },
    {
      id: 't11-q03', topic: 11, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Adding a month at the end of the month',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT DATE '2024-01-31' + INTERVAL '1 month' AS a,
       DATE '2025-01-31' + INTERVAL '1 month' AS b,
       DATE '2024-02-29' + INTERVAL '1 year'  AS c;`,
      options: [
        { table: { columns: ['a', 'b', 'c'], rows: [['2024-03-02 00:00:00', '2025-03-03 00:00:00', '2025-03-01 00:00:00']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['2024-02-29 00:00:00', '2025-02-28 00:00:00', '2025-02-28 00:00:00']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['2024-02-28 00:00:00', '2025-02-28 00:00:00', '2025-03-01 00:00:00']] } },
        { table: { columns: ['a', 'b', 'c'], rows: [['2024-02-29 00:00:00', '2025-02-29 00:00:00', '2025-02-29 00:00:00']] } },
      ],
      correctOption: 1,
      hints: ['February 31 doesn\'t exist. Does PostgreSQL overflow into March, or clamp to the last day?', 'date + interval gives a timestamp.'],
      explanation: `Adding months or years keeps the day number when it can and otherwise **clamps to the last day** of the target month:

- 31 Jan 2024 + 1 month gives 29 Feb 2024 (a leap year).
- 31 Jan 2025 + 1 month gives 28 Feb 2025.
- 29 Feb 2024 + 1 year gives 28 Feb 2025.

\`date + interval\` returns a \`timestamp\`, which is why there's a time part. Note that clamping isn't reversible: 28 Feb − 1 month is 28 Jan, not 31 Jan.`,
      commonMistakes: ['Expecting an overflow into March.', 'Forgetting leap years.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't11-q04', topic: 11, relatedTopics: [1, 4, 8], difficulty: 'easy', type: 'write-query',
      title: 'Transit time in days',
      prompt: `For **delivered** shipments of orders **1 to 30**, show how many **calendar days** (UTC) passed between shipping and delivery.

- **Columns:** \`shipment_id\`, \`shipped_at\`, \`delivered_at\`, \`transit_days\` (integer)
- **Sort:** by \`shipment_id\`.`,
      hints: ['Cast both timestamps to date and subtract: the result is an integer number of days.'],
      referenceSolution: `SELECT shipment_id, shipped_at, delivered_at,
       delivered_at::date - shipped_at::date AS transit_days
FROM shipments
WHERE order_id BETWEEN 1 AND 30
  AND delivered_at IS NOT NULL
ORDER BY shipment_id;`,
      alternativeSolutions: [`SELECT shipment_id, shipped_at, delivered_at, (date_trunc('day', delivered_at)::date - date_trunc('day', shipped_at)::date) AS transit_days FROM shipments WHERE order_id <= 30 AND delivered_at IS NOT NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT shipment_id, shipped_at, delivered_at, extract(day FROM delivered_at - shipped_at)::int AS transit_days FROM shipments WHERE order_id BETWEEN 1 AND 30 AND delivered_at IS NOT NULL ORDER BY shipment_id;`,
        `SELECT shipment_id, shipped_at, delivered_at, extract(day FROM delivered_at)::int - extract(day FROM shipped_at)::int AS transit_days FROM shipments WHERE order_id BETWEEN 1 AND 30 AND delivered_at IS NOT NULL ORDER BY shipment_id;`,
      ],
      explanation: `"Calendar days" counts midnights crossed, so convert to dates first: \`delivered_at::date - shipped_at::date\`.

\`extract(day FROM interval)\` returns the *days field* of the interval, i.e. whole 24-hour periods, so 23:00 → 01:00 the next day gives 0. Subtracting the day-of-month numbers breaks across month boundaries.`,
      commonMistakes: ['Counting 24-hour periods instead of calendar days.', 'Subtracting day-of-month numbers.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q05', topic: 11, relatedTopics: [1, 4, 8], difficulty: 'medium', type: 'write-query',
      title: 'Month and week of each June order',
      prompt: `For orders placed in **June 2025** (UTC), show the first day of the order's **month** and the **Monday** of its ISO week, both as \`date\`.

- **Columns:** \`order_id\`, \`month_start\`, \`week_start\`
- **Sort:** by \`order_id\`.`,
      hints: ['`date_trunc(\'month\', ts)` and `date_trunc(\'week\', ts)`. ISO weeks start on Monday.', 'Cast the results to date.'],
      referenceSolution: `SELECT order_id,
       date_trunc('month', ordered_at)::date AS month_start,
       date_trunc('week', ordered_at)::date  AS week_start
FROM orders
WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01'
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, DATE '2025-06-01' AS month_start, ordered_at::date - (extract(isodow FROM ordered_at)::int - 1) AS week_start FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, date_trunc('month', ordered_at)::date AS month_start, ordered_at::date - extract(dow FROM ordered_at)::int AS week_start FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY order_id;`,
        `SELECT order_id, date_trunc('month', ordered_at)::date AS month_start, date_trunc('day', ordered_at)::date AS week_start FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY order_id;`,
      ],
      explanation: `\`date_trunc(unit, ts)\` rounds a timestamp **down** to the start of the unit. For \`'week'\` that's Monday 00:00 (ISO weeks).

Subtracting \`dow\` days gives the **Sunday** before, because \`dow\` counts Sunday as 0. The alternative uses \`isodow\` (Monday = 1), which matches ISO weeks.`,
      commonMistakes: ['Sunday-based weeks via dow.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q06', topic: 11, relatedTopics: [1, 4, 8], difficulty: 'medium', type: 'write-query',
      title: 'Weekend orders in June',
      prompt: `List orders placed on a **Saturday or Sunday** (UTC) in **June 2025**, with the weekday name.

- **Columns:** \`order_id\`, \`weekday\` (e.g. \`'Saturday'\`, no padding)
- **Sort:** by \`order_id\`.`,
      hints: ['`extract(isodow …)` is 6 for Saturday and 7 for Sunday.', 'Weekday name without padding: `to_char(ordered_at, \'FMDay\')`.'],
      referenceSolution: `SELECT order_id, to_char(ordered_at, 'FMDay') AS weekday
FROM orders
WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01'
  AND extract(isodow FROM ordered_at) IN (6, 7)
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, trim(to_char(ordered_at, 'Day')) AS weekday FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' AND extract(dow FROM ordered_at) IN (0, 6) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, to_char(ordered_at, 'FMDay') AS weekday FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' AND extract(dow FROM ordered_at) IN (6, 7) ORDER BY order_id;`,
        `SELECT order_id, to_char(ordered_at, 'Day') AS weekday FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' AND extract(isodow FROM ordered_at) IN (6, 7) ORDER BY order_id;`,
      ],
      explanation: `Two numbering schemes exist: \`dow\` (Sunday = 0 … Saturday = 6) and \`isodow\` (Monday = 1 … Sunday = 7). Mixing them up, e.g. \`dow IN (6, 7)\`, silently loses the Sundays, because dow never returns 7.

\`to_char(…, 'Day')\` pads to 9 characters, and \`FM\` removes the padding.`,
      commonMistakes: ['dow IN (6, 7), which misses Sundays.', 'Padded weekday names.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q07', topic: 11, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Local order time in Tokyo',
      prompt: `For customers whose \`timezone\` is **\`'Asia/Tokyo'\`**, show their orders placed in **June 2025** (UTC) with the **local wall-clock time** in Tokyo.

- **Columns:** \`order_id\`, \`ordered_at\`, \`local_time\` (a \`timestamp\` without time zone)
- **Sort:** by \`order_id\`.`,
      hints: ['`ordered_at AT TIME ZONE c.timezone` turns the moment into local wall-clock time.'],
      referenceSolution: `SELECT o.order_id, o.ordered_at, o.ordered_at AT TIME ZONE c.timezone AS local_time
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE c.timezone = 'Asia/Tokyo'
  AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01'
ORDER BY o.order_id;`,
      alternativeSolutions: [`SELECT o.order_id, o.ordered_at, timezone('Asia/Tokyo', o.ordered_at) AS local_time FROM orders o JOIN customers c USING (customer_id) WHERE c.timezone = 'Asia/Tokyo' AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT o.order_id, o.ordered_at, o.ordered_at::timestamp AS local_time FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.timezone = 'Asia/Tokyo' AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY o.order_id;`,
        `SELECT o.order_id, o.ordered_at, o.ordered_at::timestamp AT TIME ZONE 'Asia/Tokyo' AS local_time FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.timezone = 'Asia/Tokyo' AND o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY o.order_id;`,
      ],
      explanation: `\`timestamptz AT TIME ZONE 'Asia/Tokyo'\` answers "what did the clock in Tokyo show at that moment?" (UTC+9).

- \`::timestamp\` just drops the zone, giving the **UTC** wall clock.
- \`timestamp AT TIME ZONE\` goes the *other* way: it reads a wall-clock time as Tokyo time and returns a moment. Applied to the UTC wall clock, it shifts the time 9 hours in the wrong direction.`,
      commonMistakes: ['Dropping the zone instead of converting.', 'Converting in the wrong direction.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q08', topic: 11, relatedTopics: [1, 4, 8], difficulty: 'medium', type: 'write-query',
      title: 'Customer ages on the reference date',
      prompt: `For customers **1 to 60** with a known \`birth_date\`, compute their **age in completed years** on **2025-06-30**. One of them was born on a leap day.

- **Columns:** \`customer_id\`, \`birth_date\`, \`age\` (integer)
- **Sort:** by \`customer_id\`.`,
      hints: ['`age(later_date, earlier_date)` returns an interval like "25 years 4 mons 1 day".', 'Take its years: `extract(year FROM age(…))::int`.'],
      referenceSolution: `SELECT customer_id, birth_date,
       extract(year FROM age(DATE '2025-06-30', birth_date))::int AS age
FROM customers
WHERE customer_id BETWEEN 1 AND 60
  AND birth_date IS NOT NULL
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, birth_date, date_part('year', age('2025-06-30'::date, birth_date))::int AS age FROM customers WHERE customer_id <= 60 AND birth_date IS NOT NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, birth_date, ((DATE '2025-06-30' - birth_date) / 365) AS age FROM customers WHERE customer_id BETWEEN 1 AND 60 AND birth_date IS NOT NULL ORDER BY customer_id;`,
        `SELECT customer_id, birth_date, (2025 - extract(year FROM birth_date))::int AS age FROM customers WHERE customer_id BETWEEN 1 AND 60 AND birth_date IS NOT NULL ORDER BY customer_id;`,
      ],
      explanation: `\`age(a, b)\` computes a calendar-aware difference: whole years, then months, then days. Its year component is the number of birthdays that have passed, which is exactly "age in completed years".

- Subtracting the years ignores whether this year's birthday has happened yet.
- Dividing days by 365 drifts by a day every four years, so people near their birthday get the wrong age.

The leap-day customer (born 2000-02-29) is 25 on the reference date.`,
      commonMistakes: ['Year subtraction.', 'Days ÷ 365.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q09', topic: 11, relatedTopics: [1, 4], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: slow deliveries',
      prompt: `This query should list shipments whose **delivery took more than 7 days** after shipping, but it fails. Fix it.

- **Columns:** \`shipment_id\`, \`transit\` (the interval \`delivered_at - shipped_at\`)
- **Sort:** by \`shipment_id\`.`,
      starterSql: `SELECT shipment_id, delivered_at - shipped_at AS transit
FROM shipments
WHERE delivered_at - shipped_at > 7
ORDER BY shipment_id;`,
      hints: ['What type is `delivered_at - shipped_at`? Can you compare it with the integer 7?'],
      referenceSolution: `SELECT shipment_id, delivered_at - shipped_at AS transit
FROM shipments
WHERE delivered_at - shipped_at > INTERVAL '7 days'
ORDER BY shipment_id;`,
      alternativeSolutions: [`SELECT shipment_id, delivered_at - shipped_at AS transit FROM shipments WHERE delivered_at > shipped_at + INTERVAL '7 days' ORDER BY 1;`, `SELECT shipment_id, delivered_at - shipped_at AS transit FROM shipments WHERE extract(epoch FROM delivered_at - shipped_at) > 7 * 86400 ORDER BY 1;`],
      wrongAnswers: [`SELECT shipment_id, delivered_at - shipped_at AS transit FROM shipments WHERE delivered_at::date - shipped_at::date > 7 ORDER BY shipment_id;`],
      explanation: `\`timestamptz - timestamptz\` is an **interval**, and \`interval > integer\` doesn't exist (*operator does not exist*). Compare with an interval literal: \`> INTERVAL '7 days'\`.

Comparing **calendar** days (\`::date - ::date > 7\`) is a different rule: it counts midnights crossed, not time elapsed. A parcel shipped at 08:00 that arrives 7 days and 3 hours later is "more than 7 days" by the clock, but only 7 calendar days apart. Stick to the definition you're given.`,
      commonMistakes: ['Comparing an interval with a number.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q10', topic: 11, relatedTopics: [1, 8], difficulty: 'medium', type: 'write-query',
      title: 'A calendar of 2024',
      prompt: `Generate one row per **month of 2024** with the month's first day and its full name.

- **Columns:** \`month_start\` (date), \`month_name\` (e.g. \`'January'\`, no padding)
- **Sort:** by \`month_start\`. 12 rows.`,
      hints: ['`generate_series(DATE \'2024-01-01\', DATE \'2024-12-01\', INTERVAL \'1 month\')`', '`to_char(d, \'FMMonth\')`'],
      referenceSolution: `SELECT d::date AS month_start, to_char(d, 'FMMonth') AS month_name
FROM generate_series(DATE '2024-01-01', DATE '2024-12-01', INTERVAL '1 month') AS d
ORDER BY month_start;`,
      alternativeSolutions: [`SELECT make_date(2024, m, 1) AS month_start, to_char(make_date(2024, m, 1), 'FMMonth') AS month_name FROM generate_series(1, 12) AS m ORDER BY 1;`],
      wrongAnswers: [
        `SELECT d::date AS month_start, to_char(d, 'FMMonth') AS month_name FROM generate_series(DATE '2024-01-01', DATE '2024-12-31', INTERVAL '30 days') AS d ORDER BY month_start;`,
        `SELECT d::date AS month_start, to_char(d, 'Month') AS month_name FROM generate_series(DATE '2024-01-01', DATE '2024-12-01', INTERVAL '1 month') AS d ORDER BY month_start;`,
      ],
      explanation: `\`generate_series(start, stop, step)\` with dates and an interval step produces a timestamp per step. A step of \`'1 month'\` always lands on the 1st. \`'30 days'\` drifts, landing on 31 January, 1 March…, and gives 13 rows.

\`make_date(year, month, day)\` over \`generate_series(1, 12)\` is an equally good approach.`,
      commonMistakes: ['A 30-day step instead of 1 month.', 'Padded month names.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't11-q11', topic: 11, relatedTopics: [1, 4, 8], difficulty: 'hard', type: 'write-query',
      title: 'Orders on the last day of a month',
      prompt: `List all orders placed on the **last calendar day of their month** (UTC): 31 January, 29 February 2024, 30 April, …

- **Columns:** \`order_id\`, \`order_day\` (date)
- **Sort:** by \`order_id\`.`,
      hints: ['The last day of a month = first day of the month + 1 month − 1 day.', 'Or: the next day is the 1st, i.e. `extract(day FROM ordered_at::date + 1) = 1`.'],
      referenceSolution: `SELECT order_id, ordered_at::date AS order_day
FROM orders
WHERE ordered_at::date = (date_trunc('month', ordered_at) + INTERVAL '1 month' - INTERVAL '1 day')::date
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, ordered_at::date AS order_day FROM orders WHERE extract(day FROM ordered_at::date + 1) = 1 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, ordered_at::date AS order_day FROM orders WHERE extract(day FROM ordered_at) = 31 ORDER BY order_id;`,
        `SELECT order_id, ordered_at::date AS order_day FROM orders WHERE extract(day FROM ordered_at) IN (30, 31) ORDER BY order_id;`,
      ],
      explanation: `Months have 28, 29, 30 or 31 days, so no single day number works. Compute the month end: \`date_trunc('month', ts) + INTERVAL '1 month' - INTERVAL '1 day'\`. Or use the neat trick that the *next* day is the 1st of a month.

The data deliberately contains orders on 29 February 2024 and 30 April 2024, which the day-31 version misses. The 30-or-31 version wrongly includes 30 January and similar days.`,
      commonMistakes: ['Assuming months end on day 31.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q12', topic: 11, relatedTopics: [1, 4, 8], difficulty: 'hard', type: 'write-query',
      title: 'Orders in ISO week 1 of 2025',
      prompt: `List orders placed in **ISO week 1 of ISO year 2025** (UTC). Careful: that week starts on Monday **30 December 2024**.

- **Columns:** \`order_id\`, \`order_day\` (date)
- **Sort:** by \`order_id\`.`,
      hints: ['`extract(week …)` is the ISO week, and it belongs to `extract(isoyear …)`, not to `year`.'],
      referenceSolution: `SELECT order_id, ordered_at::date AS order_day
FROM orders
WHERE extract(isoyear FROM ordered_at) = 2025
  AND extract(week FROM ordered_at) = 1
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, ordered_at::date AS order_day FROM orders WHERE ordered_at >= '2024-12-30' AND ordered_at < '2025-01-06' ORDER BY 1;`, `SELECT order_id, ordered_at::date AS order_day FROM orders WHERE to_char(ordered_at, 'IYYY-IW') = '2025-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, ordered_at::date AS order_day FROM orders WHERE extract(year FROM ordered_at) = 2025 AND extract(week FROM ordered_at) = 1 ORDER BY order_id;`,
        `SELECT order_id, ordered_at::date AS order_day FROM orders WHERE ordered_at >= '2025-01-01' AND ordered_at < '2025-01-08' ORDER BY order_id;`,
      ],
      explanation: `ISO weeks start on Monday, and week 1 is the week containing the year's first Thursday. So 30–31 December 2024 belong to **week 1 of 2025**. \`extract(year)\` says 2024 for those days, so combining \`year\` with \`week\` loses them. Use \`isoyear\` together with \`week\`, the explicit date range, or the \`IYYY-IW\` pattern of \`to_char\`.`,
      commonMistakes: ['Pairing the ISO week with the calendar year.', 'Assuming week 1 starts on 1 January.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q13', topic: 11, relatedTopics: [1, 4, 5, 8], difficulty: 'hard', type: 'write-query',
      title: 'Time from signup to first order',
      prompt: `For every customer who has placed an order, how long after signing up did they place their **first** order (any status)? Express it in **days with one decimal** (24 hours = 1 day).

- **Columns:** \`customer_id\`, \`first_order_id\`, \`days_to_first_order\`
- **Sort:** by \`customer_id\`.`,
      hints: ['First order per customer: `DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at, order_id`.', 'Seconds between two timestamps: `extract(epoch FROM later - earlier)`. Divide by 86400.'],
      referenceSolution: `SELECT DISTINCT ON (o.customer_id)
       o.customer_id,
       o.order_id AS first_order_id,
       round(extract(epoch FROM o.ordered_at - c.signup_at) / 86400, 1) AS days_to_first_order
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
ORDER BY o.customer_id, o.ordered_at, o.order_id;`,
      alternativeSolutions: [
        `SELECT customer_id, order_id AS first_order_id, round((extract(epoch FROM ordered_at) - extract(epoch FROM signup_at)) / 86400.0, 1) AS days_to_first_order
FROM (SELECT DISTINCT ON (customer_id) customer_id, order_id, ordered_at FROM orders ORDER BY customer_id, ordered_at, order_id) f
JOIN customers USING (customer_id) ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT DISTINCT ON (o.customer_id) o.customer_id, o.order_id AS first_order_id, round((o.ordered_at::date - c.signup_at::date)::numeric, 1) AS days_to_first_order FROM orders o JOIN customers c ON c.customer_id = o.customer_id ORDER BY o.customer_id, o.ordered_at, o.order_id;`,
        `SELECT DISTINCT ON (o.customer_id) o.customer_id, o.order_id AS first_order_id, extract(day FROM o.ordered_at - c.signup_at) AS days_to_first_order FROM orders o JOIN customers c ON c.customer_id = o.customer_id ORDER BY o.customer_id, o.ordered_at, o.order_id;`,
      ],
      explanation: `\`DISTINCT ON (customer_id)\` with \`ORDER BY customer_id, ordered_at, order_id\` keeps each customer's earliest order (Topic 1).

The duration is an interval. \`extract(epoch FROM interval)\` converts it to seconds, including the fractional days, and \`/ 86400\` turns seconds into days.

- Date subtraction counts calendar days and loses the hours.
- \`extract(day FROM interval)\` returns only the *days field*, dropping the hours, and for long intervals it's not even the total number of days.`,
      commonMistakes: ['Losing the time of day by casting to date.', 'extract(day) on an interval.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q14', topic: 11, relatedTopics: [1], difficulty: 'hard', type: 'predict-output',
      title: 'AT TIME ZONE in both directions',
      prompt: `On 31 March 2024, Berlin's clocks jumped from 02:00 to 03:00. What does this query return?`,
      referenceSolution: `SELECT TIMESTAMPTZ '2024-03-31 01:30:00+00' AT TIME ZONE 'Europe/Berlin' AS a,
       TIMESTAMP   '2024-03-31 12:00:00'    AT TIME ZONE 'Europe/Berlin' AS b;`,
      options: [
        { table: { columns: ['a', 'b'], rows: [['2024-03-31 02:30:00', '2024-03-31 11:00:00+00']] } },
        { table: { columns: ['a', 'b'], rows: [['2024-03-31 03:30:00', '2024-03-31 10:00:00+00']] } },
        { table: { columns: ['a', 'b'], rows: [['2024-03-31 03:30:00', '2024-03-31 14:00:00+00']] } },
        { table: { columns: ['a', 'b'], rows: [['2024-03-31 00:30:00', '2024-03-31 12:00:00+00']] } },
      ],
      correctOption: 1,
      hints: ['After the jump, Berlin is UTC+2 (CEST).', 'timestamptz → AT TIME ZONE gives local time. timestamp → AT TIME ZONE gives the UTC moment.'],
      explanation: `- **a:** 01:30 UTC is after the switch (01:00 UTC = 03:00 local), so Berlin is at UTC+2: local time **03:30**. The result is a timestamp without zone.
- **b:** 12:00 Berlin wall-clock time, at UTC+2, is the moment **10:00 UTC**. The result is a timestamptz, displayed in our UTC session.

A fixed \`+01\` offset would get both wrong for this day.`,
      commonMistakes: ['Using winter time (+1) after the switch.', 'Converting in the wrong direction.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't11-q15', topic: 11, relatedTopics: [1, 4, 8], previewTopics: [19], difficulty: 'interview', type: 'write-query',
      title: 'Upcoming birthdays',
      prompt: `Marketing sends a birthday coupon. Find customers whose **next birthday after the reference date 2025-06-30** falls **within 30 days** (2025-07-01 up to and including 2025-07-30).

- **Columns:** \`customer_id\`, \`birth_date\`, \`next_birthday\` (date), \`days_until\`
- **Sort:** by \`days_until\`, then \`customer_id\`.`,
      hints: ['Next birthday = birth date + (age in years + 1) years.', '`age(DATE \'2025-06-30\', birth_date)` gives the completed years. Adding years with an interval handles 29 February by clamping.', '`days_until` = next_birthday − DATE \'2025-06-30\'.'],
      referenceSolution: `SELECT customer_id, birth_date, next_birthday, next_birthday - DATE '2025-06-30' AS days_until
FROM (
  SELECT customer_id, birth_date,
         (birth_date + (extract(year FROM age(DATE '2025-06-30', birth_date))::int + 1) * INTERVAL '1 year')::date AS next_birthday
  FROM customers
  WHERE birth_date IS NOT NULL
) AS b
WHERE next_birthday <= DATE '2025-07-30'
ORDER BY days_until, customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id, birth_date, make_date(2025, extract(month FROM birth_date)::int, extract(day FROM birth_date)::int) AS next_birthday,
       make_date(2025, extract(month FROM birth_date)::int, extract(day FROM birth_date)::int) - DATE '2025-06-30' AS days_until
FROM customers
WHERE birth_date IS NOT NULL AND extract(month FROM birth_date) = 7 AND extract(day FROM birth_date) <= 30
ORDER BY 4, 1;`,
      ],
      wrongAnswers: [
        `SELECT customer_id, birth_date, next_birthday, next_birthday - DATE '2025-06-30' AS days_until FROM (SELECT customer_id, birth_date, (birth_date + (extract(year FROM age(DATE '2025-06-30', birth_date))::int + 1) * INTERVAL '1 year')::date AS next_birthday FROM customers WHERE birth_date IS NOT NULL) AS b WHERE next_birthday < DATE '2025-07-30' ORDER BY days_until, customer_id;`,
        `SELECT customer_id, birth_date, next_birthday, next_birthday - DATE '2025-06-30' AS days_until FROM (SELECT customer_id, birth_date, (birth_date + (2025 - extract(year FROM birth_date))::int * INTERVAL '1 year')::date AS next_birthday FROM customers WHERE birth_date IS NOT NULL) AS b WHERE next_birthday BETWEEN DATE '2025-06-30' AND DATE '2025-07-30' ORDER BY days_until, customer_id;`,
      ],
      explanation: `The robust way to get the next birthday is "birth date plus (completed years + 1) years". Adding a year interval handles 29 February correctly (it clamps to 28 February in non-leap years), and it works whatever the window, even one that crosses New Year.

The alternative uses \`make_date\` with this year's month and day. That's fine here because the window lies within one month and can't contain 29 February. It would break for windows crossing a year end, or for leap-day birthdays.

The second wrong answer uses "this year's birthday", which includes people whose birthday is *on* the reference date. Their *next* birthday is a year away.`,
      commonMistakes: ['Excluding the last day of the window.', 'Using this year\'s birthday, which may already be past.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't11-q16', topic: 11, relatedTopics: [1, 4], previewTopics: [19], difficulty: 'interview', type: 'write-query',
      title: 'Customers gone quiet',
      prompt: `Find customers whose **most recent successful login** was **more than 90 days before** the reference date (\`last_login < DATE '2025-06-30' - 90\`, comparing the login's UTC date). Customers who never logged in don't count.

- **Columns:** \`customer_id\`, \`last_login\` (timestamptz), \`days_since\` (integer: reference date − login date)
- **Sort:** by \`days_since\` (highest first), then \`customer_id\`.`,
      hints: ['Most recent login per customer: `DISTINCT ON (customer_id) … ORDER BY customer_id, logged_in_at DESC`.', 'Filter the result in an outer query.'],
      referenceSolution: `SELECT customer_id, last_login, DATE '2025-06-30' - last_login::date AS days_since
FROM (
  SELECT DISTINCT ON (customer_id) customer_id, logged_in_at AS last_login
  FROM user_logins
  WHERE success
  ORDER BY customer_id, logged_in_at DESC
) AS latest
WHERE last_login::date < DATE '2025-06-30' - 90
ORDER BY days_since DESC, customer_id;`,
      alternativeSolutions: [
        `SELECT customer_id, max(logged_in_at) AS last_login, DATE '2025-06-30' - max(logged_in_at)::date AS days_since FROM user_logins WHERE success GROUP BY customer_id HAVING max(logged_in_at)::date < DATE '2025-06-30' - 90 ORDER BY 3 DESC, 1;`,
      ],
      wrongAnswers: [
        `SELECT DISTINCT ON (customer_id) customer_id, logged_in_at AS last_login, DATE '2025-06-30' - logged_in_at::date AS days_since FROM user_logins WHERE success AND logged_in_at::date < DATE '2025-06-30' - 90 ORDER BY customer_id, logged_in_at DESC;`,
        `SELECT customer_id, last_login, DATE '2025-06-30' - last_login AS days_since FROM (SELECT DISTINCT ON (customer_id) customer_id, logged_in_at AS last_login FROM user_logins WHERE success ORDER BY customer_id, logged_in_at DESC) AS latest WHERE last_login::date < DATE '2025-06-30' - 90 ORDER BY days_since DESC, customer_id;`,
      ],
      explanation: `The trap: filtering \`logged_in_at < cut-off\` **before** picking the latest login returns each customer's latest *old* login, even for customers who logged in yesterday. The "latest" must be chosen over **all** logins first, then filtered. That's a subquery (Topic 19) around DISTINCT ON, or GROUP BY with HAVING (Topic 14).

\`DATE - integer\` subtracts days, so \`DATE '2025-06-30' - 90\` is 2025-04-01. For \`days_since\`, subtract **dates** (an integer). \`DATE - timestamptz\` gives an interval instead. Failed login attempts don't count as activity.`,
      commonMistakes: ['Filtering by date before finding the latest login.', 'Counting failed logins.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
