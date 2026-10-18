import type { Topic } from '../types.ts';

const explanation = `A **function** takes values and returns a value: \`upper('abc')\`, \`round(2.567, 2)\`. This topic covers how functions work in general, and the functions that **convert and format** values between types. Topics 9–12 then cover the string, numeric, date and NULL functions in detail.

## Kinds of functions

| kind | input → output | examples |
|---|---|---|
| **scalar** | one row → one value | \`upper(name)\`, \`price::int\`, \`to_char(ordered_at, 'YYYY')\` |
| **aggregate** | many rows → one value | \`count(*)\`, \`sum(amount)\`, \`max(price)\` (Topic 14) |
| **window** | many rows → one value *per row* | \`row_number() OVER (…)\` (Topics 15–18) |
| **set-returning** | one call → many rows | \`generate_series(1, 5)\`, \`unnest(array)\` |

Functions can be nested (\`upper(trim(name))\`) and used anywhere an expression is allowed: SELECT, WHERE, ORDER BY…

\`\`\`sql
SELECT upper('postgres')               AS scalar_result,
       pg_typeof(42)                   AS type_of_42,
       (SELECT count(*) FROM products) AS aggregate_result;
\`\`\`

## Casting: changing the type of a value

\`\`\`sql
SELECT '42'::int + 1              AS pg_style,      -- PostgreSQL shorthand
       CAST('42' AS integer) + 1  AS sql_standard,  -- same thing
       DATE '2025-06-30'          AS typed_literal, -- type name before a string literal
       3.7::int                   AS numeric_to_int,-- rounds (to 4)
       7 / 2                      AS int_division,  -- 3: integer ÷ integer stays integer
       7::numeric / 2             AS numeric_division;
\`\`\`

- \`value::type\` and \`CAST(value AS type)\` are equivalent.
- Casting numeric → integer **rounds**, half away from zero. It doesn't truncate.
- An impossible cast is an **error**, not a NULL: \`'n/a'::numeric\` fails the whole query.
- PostgreSQL 16+ can test first: \`pg_input_is_valid('n/a', 'numeric')\` → false.
- \`pg_typeof(expr)\` tells you the type of any expression, which is handy for debugging.
- **Implicit casts** happen when the target is unambiguous: \`order_id = '42'\` works because the literal is cast to integer. Comparing a *column* of type text to a number does not work.

## Formatting values as text: to_char

\`to_char(value, format)\` turns numbers and dates into text with a pattern:

\`\`\`sql
SELECT to_char(1234.5, 'FM999,990.00')                      AS money_text,  -- '1,234.50'
       to_char(1234.5, '999,990.00')                        AS padded,      -- leading spaces!
       to_char(TIMESTAMPTZ '2024-02-29 14:05:00+00', 'YYYY-MM-DD HH24:MI') AS iso_minute,
       to_char(DATE '2024-02-29', 'FMDay, FMDD FMMonth YYYY') AS long_date;  -- 'Thursday, 29 February 2024'
\`\`\`

Common patterns: \`9\` digit (blank if not needed), \`0\` digit (always shown), \`,\` and \`.\` literal separators, \`G\` and \`D\` locale group and decimal separators, \`YYYY\`, \`MM\`, \`DD\`, \`HH24\`, \`MI\`, \`SS\`, \`Mon\`/\`Month\`, \`Dy\`/\`Day\`. **\`FM\` removes padding**: without it, numbers get leading spaces and month or day names are padded to 9 characters.

## Parsing text: to_date, to_timestamp, to_number

The reverse direction reads text in a given format:

\`\`\`sql
SELECT to_date('05/04/2023', 'DD/MM/YYYY')        AS dmy,     -- 2023-04-05
       to_date('Apr 05, 2023', 'Mon DD, YYYY')    AS mon_dd,  -- 2023-04-05
       to_number('$1,234.50', 'L9G999G999D99')    AS money,   -- 1234.50
       '2023-04-05'::date                         AS iso_cast;-- ISO text casts directly
\`\`\`

Use these whenever text isn't in PostgreSQL's default format. Our \`staging_customer_import\` table is full of such text: each source file uses its own date format.

## format(): building strings

\`format('%s (%s)', name, sku)\` substitutes the arguments into the template. \`%s\` inserts any value as text, and \`%L\` / \`%I\` quote literals and identifiers safely for dynamic SQL.

## Gotchas

- **AND doesn't guarantee evaluation order.** \`WHERE raw <> 'n/a' AND raw::numeric > 0\` can still try to cast 'n/a'. Only \`CASE\` guarantees order (Topic 13).
- \`to_char\` returns **text**, and text sorts alphabetically: '10' < '9'. Sort by the original value instead.
- Casting a timestamp to date drops the time **in the session time zone** (UTC here).`;

const topic: Topic = {
  id: 8,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Type Casts (4.2.9)', url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SQL-SYNTAX-TYPE-CASTS' },
    { title: 'PostgreSQL 18: Data Type Formatting Functions, to_char / to_date / to_number (9.8)', url: 'https://www.postgresql.org/docs/18/functions-formatting.html' },
    { title: 'PostgreSQL 18: Type Conversion (chapter 10)', url: 'https://www.postgresql.org/docs/18/typeconv.html' },
    { title: 'PostgreSQL 18: System Information Functions, pg_input_is_valid / pg_typeof (9.27)', url: 'https://www.postgresql.org/docs/18/functions-info.html' },
    { title: 'Neon PostgreSQL Tutorial: CAST', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-cast' },
  ],
  questions: [
    {
      id: 't08-q01', topic: 8, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'Whole-euro prices',
      prompt: `For the **first 10 products** by \`product_id\`, show the price and the price **cast to an integer**.

- **Columns:** \`product_id\`, \`price\`, \`whole_price\`
- **Sort:** by \`product_id\`. 10 rows.`,
      hints: ['`price::int` or `CAST(price AS integer)`.'],
      referenceSolution: `SELECT product_id, price, price::int AS whole_price
FROM products
ORDER BY product_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT product_id, price, CAST(price AS integer) AS whole_price FROM products ORDER BY 1 LIMIT 10;`],
      wrongAnswers: [
        `SELECT product_id, price, floor(price) AS whole_price FROM products ORDER BY product_id LIMIT 10;`,
        `SELECT product_id, price, price::text AS whole_price FROM products ORDER BY product_id LIMIT 10;`,
      ],
      explanation: `\`price::int\` converts numeric to integer, and PostgreSQL **rounds** (half away from zero) when doing so: 49.99 becomes 50. If you want to cut off the decimals, use \`trunc()\` or \`floor()\` (Topic 10). Here those would give 49.`,
      commonMistakes: ['Expecting the cast to truncate. It rounds.'],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't08-q02', topic: 8, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'Kinds of functions',
      prompt: `Which of these is a **set-returning** function, i.e. one call produces **several rows**?`,
      options: [{ text: '`upper(name)`' }, { text: '`count(*)`' }, { text: '`generate_series(1, 10)`' }, { text: '`row_number() OVER (ORDER BY id)`' }],
      correctOption: 2,
      hints: ['Scalar: one value per row. Aggregate: one value for many rows. Window: one value per row, computed over many rows.'],
      explanation: `\`generate_series(1, 10)\` returns 10 rows from a single call, which is why it's usually used in FROM. \`upper\` is scalar, \`count\` is an aggregate (many rows in, one value out), and \`row_number\` is a window function (one value per row, computed over a window of rows).`,
      commonMistakes: ['Confusing window functions (one result per row) with set-returning functions (many rows per call).'],
    },
    {
      id: 't08-q03', topic: 8, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Casts and division',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT '42'::int + 1               AS a,
       CAST('3.7' AS numeric)::int  AS b,
       7 / 2                        AS c,
       7::numeric / 2               AS d;`,
      options: [
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['421', '3', '3.5', '3.5']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['43', '3', '3', '3.5']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['43', '4', '3', '3.5']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['43', '4', '3.5', '3.5']] } },
      ],
      correctOption: 2,
      hints: ['Does casting 3.7 to integer round or truncate?', 'What type is 7 / 2?'],
      explanation: `- **a = 43:** '42' becomes the integer 42 before adding. \`+\` is arithmetic, never string concatenation.
- **b = 4:** numeric → integer rounds.
- **c = 3:** integer ÷ integer is integer division, and the fraction is discarded.
- **d = 3.5:** once one operand is numeric, the division is exact (shown as 3.5000000000000000).`,
      commonMistakes: ['Expecting 7 / 2 = 3.5.', 'Expecting the integer cast to truncate.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't08-q04', topic: 8, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Readable order dates',
      prompt: `Show the orders placed on **29 February 2024** (UTC) with the order date formatted like **\`29 Feb 2024\`**.

- **Columns:** \`order_id\`, \`order_day\` (text)
- **Sort:** by \`order_id\`.`,
      hints: ['`to_char(timestamp, pattern)`. The pattern for "29 Feb 2024" is `\'DD Mon YYYY\'`.'],
      referenceSolution: `SELECT order_id, to_char(ordered_at, 'DD Mon YYYY') AS order_day
FROM orders
WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01'
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, to_char(ordered_at::date, 'FMDD Mon YYYY') AS order_day FROM orders WHERE ordered_at::date = '2024-02-29' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, to_char(ordered_at, 'DD Month YYYY') AS order_day FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01' ORDER BY order_id;`,
        `SELECT order_id, to_char(ordered_at, 'YYYY-MM-DD') AS order_day FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01' ORDER BY order_id;`,
      ],
      explanation: `\`to_char\` formats a timestamp with a pattern: \`DD\` is the day of the month, \`Mon\` the abbreviated month name, \`YYYY\` the year. \`Month\` would give "February" padded to 9 characters. Add \`FM\` (\`FMMonth\`) to remove padding.

The result is text. Sort or filter by the original timestamp, not by the formatted string.`,
      commonMistakes: ['Using Month (full name, padded) instead of Mon.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q05', topic: 8, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Parse the February export’s dates',
      prompt: `In \`staging_customer_import\`, the file **\`crm_export_2024_02.csv\`** stores signup dates as text in **day/month/year** format, e.g. \`'18/03/2022'\`. Some rows have an empty string, \`'unknown'\` or NULL instead.

For that file's rows with a real date, return the parsed **\`date\`**.

- **Columns:** \`import_row_id\`, \`signup_date\` (type \`date\`)
- **Sort:** by \`import_row_id\`.`,
      hints: ['`to_date(text, \'DD/MM/YYYY\')` parses this format.', 'Exclude `\'\'` and `\'unknown\'`. NULL is excluded by any comparison automatically.'],
      referenceSolution: `SELECT import_row_id, to_date(signup_date_raw, 'DD/MM/YYYY') AS signup_date
FROM staging_customer_import
WHERE source_file = 'crm_export_2024_02.csv'
  AND signup_date_raw NOT IN ('', 'unknown')
ORDER BY import_row_id;`,
      alternativeSolutions: [`SELECT import_row_id, to_date(signup_date_raw, 'DD/MM/YYYY') AS signup_date FROM staging_customer_import WHERE source_file = 'crm_export_2024_02.csv' AND signup_date_raw LIKE '__/__/____' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT import_row_id, to_date(signup_date_raw, 'MM/DD/YYYY') AS signup_date FROM staging_customer_import WHERE source_file = 'crm_export_2024_02.csv' AND signup_date_raw NOT IN ('', 'unknown') ORDER BY import_row_id;`,
        `SELECT import_row_id, signup_date_raw::date AS signup_date FROM staging_customer_import WHERE source_file = 'crm_export_2024_02.csv' AND signup_date_raw NOT IN ('', 'unknown') ORDER BY import_row_id;`,
      ],
      explanation: `\`'18/03/2022'\` isn't in PostgreSQL's default ISO format, so a plain \`::date\` cast fails. \`to_date(text, 'DD/MM/YYYY')\` tells PostgreSQL exactly where the day, month and year are.

Reading it as MM/DD would produce wrong dates when the day is ≤ 12, and an error as soon as the "month" is 13 or more. Junk values must be filtered out first, because \`to_date('unknown', …)\` is an error.`,
      commonMistakes: ['Swapping day and month.', 'Casting with ::date, which can\'t read this format.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q06', topic: 8, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Read money written with a currency sign',
      prompt: `The file **\`legacy_dump.csv\`** stores lifetime values like \`'$1,234.50'\` (some rows have \`'n/a'\` or an empty string instead).

For that file's rows with a real amount, convert it to a **number**.

- **Columns:** \`import_row_id\`, \`lifetime_value\` (numeric)
- **Sort:** by \`import_row_id\`.`,
      hints: ['`to_number(text, pattern)`: `L` matches the currency symbol, `G` the thousands separator, `D` the decimal point.', 'A pattern such as `\'L9G999G999D99\'` covers values up to 9 999 999.99.'],
      referenceSolution: `SELECT import_row_id, to_number(lifetime_value_raw, 'L9G999G999D99') AS lifetime_value
FROM staging_customer_import
WHERE source_file = 'legacy_dump.csv'
  AND lifetime_value_raw LIKE '$%'
ORDER BY import_row_id;`,
      alternativeSolutions: [
        `SELECT import_row_id, replace(replace(lifetime_value_raw, '$', ''), ',', '')::numeric AS lifetime_value FROM staging_customer_import WHERE source_file = 'legacy_dump.csv' AND lifetime_value_raw NOT IN ('n/a', '') ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT import_row_id, to_number(lifetime_value_raw, 'L999D99') AS lifetime_value FROM staging_customer_import WHERE source_file = 'legacy_dump.csv' AND lifetime_value_raw LIKE '$%' ORDER BY import_row_id;`,
        `SELECT import_row_id, to_number(lifetime_value_raw, 'L9G999G999') AS lifetime_value FROM staging_customer_import WHERE source_file = 'legacy_dump.csv' AND lifetime_value_raw LIKE '$%' ORDER BY import_row_id;`,
      ],
      explanation: `\`to_number\` reads text with a picture of the format: \`L\` currency symbol, \`9\` digits, \`G\` group (thousands) separator, \`D\` decimal point. The pattern must allow for the largest value, and it must include the decimal part. Without \`D99\` the cents are lost, and a pattern that's too short truncates big amounts.

Stripping the formatting with \`replace()\` (Topic 9) and casting is an equally valid approach.`,
      commonMistakes: ['A pattern too short for the largest values.', 'Leaving out the decimal part.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q07', topic: 8, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Product labels with format()',
      prompt: `Build shelf labels for the **10 most expensive products** (ties by \`product_id\`), in the form **\`<sku> | <name> | <price> EUR\`**, e.g. \`LAP-1014 | Halcyon Laptop 14" | 1999.00 EUR\`.

- **Columns:** \`product_id\`, \`label\`
- **Sort:** by \`price\` (highest first), then \`product_id\`.`,
      hints: ['`format(\'%s | %s | %s EUR\', sku, name, price)`'],
      referenceSolution: `SELECT product_id, format('%s | %s | %s EUR', sku, name, price) AS label
FROM products
ORDER BY price DESC, product_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT product_id, sku || ' | ' || name || ' | ' || price || ' EUR' AS label FROM products ORDER BY price DESC, product_id LIMIT 10;`],
      wrongAnswers: [
        `SELECT product_id, format('%s | %s | %s', sku, name, price) AS label FROM products ORDER BY price DESC, product_id LIMIT 10;`,
        `SELECT product_id, format('%s | %s | %s EUR', name, sku, price) AS label FROM products ORDER BY price DESC, product_id LIMIT 10;`,
      ],
      explanation: `\`format()\` fills the \`%s\` placeholders with its arguments, in order, converting each to text. It's often more readable than a long chain of \`||\`.

Bonus: \`format\` treats NULL arguments as empty strings, while \`||\` turns the whole result NULL if any part is NULL.`,
      commonMistakes: ['Arguments in the wrong order.', 'Forgetting the currency suffix.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q08', topic: 8, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Prices with thousands separators',
      prompt: `Show the **10 most expensive products** (ties by \`product_id\`) with the price formatted as text with a **comma as thousands separator and exactly two decimals**, and **no leading spaces**: \`1,999.00\`, \`549.99\`.

- **Columns:** \`product_id\`, \`price_text\`
- **Sort:** by \`price\` (highest first), then \`product_id\`.`,
      hints: ['`to_char(price, \'999,990.00\')` pads with spaces. Which prefix removes the padding?'],
      referenceSolution: `SELECT product_id, to_char(price, 'FM999,990.00') AS price_text
FROM products
ORDER BY price DESC, product_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT product_id, trim(to_char(price, '999G990D00')) AS price_text FROM products ORDER BY price DESC, product_id LIMIT 10;`],
      wrongAnswers: [
        `SELECT product_id, to_char(price, '999,990.00') AS price_text FROM products ORDER BY price DESC, product_id LIMIT 10;`,
        `SELECT product_id, price::text AS price_text FROM products ORDER BY price DESC, product_id LIMIT 10;`,
      ],
      explanation: `In \`to_char\` number patterns, \`9\` is an optional digit, \`0\` a mandatory one, and \`,\` / \`.\` are literal separators. Without \`FM\` ("fill mode"), the result is padded on the left to the pattern's full width, plus a space for the sign. \`FM\` removes that padding.

\`'990.00'\` guarantees "0.50" rather than " .50" for values below 1.`,
      commonMistakes: ['Forgetting FM, which leaves leading spaces.', 'Using ::text, which has no thousands separator.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q09', topic: 8, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Which raw dates are not ISO dates?',
      prompt: `The file **\`crm_export_2024_01.csv\`** should contain ISO dates (\`YYYY-MM-DD\`) in \`signup_date_raw\`. Find its rows where the value is **present (not NULL) but not a valid date** for PostgreSQL.

- **Columns:** \`import_row_id\`, \`signup_date_raw\`
- **Sort:** by \`import_row_id\`.`,
      hints: ['PostgreSQL 16+ has `pg_input_is_valid(text, \'date\')`, which tests a cast without raising an error.'],
      referenceSolution: `SELECT import_row_id, signup_date_raw
FROM staging_customer_import
WHERE source_file = 'crm_export_2024_01.csv'
  AND signup_date_raw IS NOT NULL
  AND NOT pg_input_is_valid(signup_date_raw, 'date')
ORDER BY import_row_id;`,
      alternativeSolutions: [`SELECT import_row_id, signup_date_raw FROM staging_customer_import WHERE source_file = 'crm_export_2024_01.csv' AND signup_date_raw IS NOT NULL AND signup_date_raw NOT LIKE '____-__-__' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT import_row_id, signup_date_raw FROM staging_customer_import WHERE signup_date_raw IS NOT NULL AND NOT pg_input_is_valid(signup_date_raw, 'date') ORDER BY import_row_id;`,
        `SELECT import_row_id, signup_date_raw FROM staging_customer_import WHERE source_file = 'crm_export_2024_01.csv' AND signup_date_raw = 'unknown' ORDER BY import_row_id;`,
      ],
      explanation: `\`pg_input_is_valid(value, type)\` answers "would this cast succeed?" without failing the query. It's the clean way to find bad data before converting it.

NULL needs no special handling in practice: \`pg_input_is_valid(NULL, 'date')\` returns NULL, so NOT of it is NULL too, and those rows drop out anyway. The explicit \`IS NOT NULL\` just documents the intent.

Don't forget the file filter: the other files use non-ISO formats, so almost all their dates would be reported as "invalid". And looking only for one known junk value misses the empty strings.`,
      commonMistakes: ['Checking every file, including those that legitimately use another format.', 'Looking only for one known junk value.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q10', topic: 8, relatedTopics: [1, 4], previewTopics: [13], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: a cast that crashes on junk',
      prompt: `This query should list the rows of the two **CRM export files** (\`source_file LIKE 'crm_export%'\`) whose lifetime value is **above 1000**. In those files the value is a plain number like \`'2006.31'\`, but some rows contain \`'n/a'\` or \`''\`. The query fails. Fix it.

- **Columns:** \`import_row_id\`, \`lifetime_value_raw\`
- **Sort:** by \`import_row_id\`.`,
      starterSql: `SELECT import_row_id, lifetime_value_raw
FROM staging_customer_import
WHERE source_file LIKE 'crm_export%'
  AND lifetime_value_raw::numeric > 1000
ORDER BY import_row_id;`,
      hints: ['Which values can\'t be cast to numeric?', 'AND doesn\'t guarantee that the safe condition is evaluated first. CASE does: `CASE WHEN … THEN raw::numeric END > 1000`.'],
      referenceSolution: `SELECT import_row_id, lifetime_value_raw
FROM staging_customer_import
WHERE source_file LIKE 'crm_export%'
  AND CASE WHEN pg_input_is_valid(lifetime_value_raw, 'numeric')
           THEN lifetime_value_raw::numeric END > 1000
ORDER BY import_row_id;`,
      alternativeSolutions: [
        `SELECT import_row_id, lifetime_value_raw FROM staging_customer_import WHERE source_file LIKE 'crm_export%' AND CASE WHEN lifetime_value_raw IN ('n/a', '') THEN NULL ELSE lifetime_value_raw::numeric END > 1000 ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT import_row_id, lifetime_value_raw FROM staging_customer_import WHERE source_file LIKE 'crm_export%' AND lifetime_value_raw > '1000' ORDER BY import_row_id;`,
      ],
      explanation: `\`'n/a'::numeric\` raises *invalid input syntax for type numeric*, and one bad row fails the whole query.

You might add \`AND lifetime_value_raw NOT IN ('n/a', '')\` and hope it's checked first, but **SQL doesn't promise any evaluation order for AND/OR**. The planner may evaluate the cast first. \`CASE WHEN safe THEN cast END\` is guaranteed to evaluate the THEN branch only when the condition is true (Topic 13). Unsafe rows become NULL, and \`NULL > 1000\` simply filters them out.

Comparing as **text** (\`> '1000'\`) runs, but it's wrong: '999' > '1000' alphabetically.`,
      commonMistakes: ['Relying on AND to short-circuit.', 'Comparing numbers as text.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q11', topic: 8, relatedTopics: [1, 4, 7], difficulty: 'hard', type: 'write-query',
      title: 'Parse every file’s dates',
      prompt: `Each file in \`staging_customer_import\` uses its own date format in \`signup_date_raw\`:

| source_file | format | example |
|---|---|---|
| \`crm_export_2024_01.csv\` | \`YYYY-MM-DD\` | 2022-12-23 |
| \`crm_export_2024_02.csv\` | \`DD/MM/YYYY\` | 18/03/2022 |
| \`legacy_dump.csv\` | \`Mon DD, YYYY\` | Jun 11, 2023 |

Return the parsed date of **every row that has a real date** (not NULL, not \`''\`, not \`'unknown'\`), across all three files.

- **Columns:** \`import_row_id\`, \`signup_date\` (type \`date\`)
- **Sort:** by \`import_row_id\`.`,
      hints: ['One SELECT per file, each with its own `to_date` pattern, combined with UNION ALL (Topic 7).', 'The filter on junk values goes in every branch.'],
      referenceSolution: `SELECT import_row_id, to_date(signup_date_raw, 'YYYY-MM-DD') AS signup_date
FROM staging_customer_import
WHERE source_file = 'crm_export_2024_01.csv' AND signup_date_raw NOT IN ('', 'unknown')
UNION ALL
SELECT import_row_id, to_date(signup_date_raw, 'DD/MM/YYYY')
FROM staging_customer_import
WHERE source_file = 'crm_export_2024_02.csv' AND signup_date_raw NOT IN ('', 'unknown')
UNION ALL
SELECT import_row_id, to_date(signup_date_raw, 'Mon DD, YYYY')
FROM staging_customer_import
WHERE source_file = 'legacy_dump.csv' AND signup_date_raw NOT IN ('', 'unknown')
ORDER BY import_row_id;`,
      alternativeSolutions: [
        `SELECT import_row_id,
  CASE source_file WHEN 'crm_export_2024_01.csv' THEN signup_date_raw::date
                   WHEN 'crm_export_2024_02.csv' THEN to_date(signup_date_raw, 'DD/MM/YYYY')
                   ELSE to_date(signup_date_raw, 'Mon DD, YYYY') END AS signup_date
FROM staging_customer_import WHERE signup_date_raw NOT IN ('', 'unknown') ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT import_row_id, to_date(signup_date_raw, 'YYYY-MM-DD') AS signup_date FROM staging_customer_import WHERE source_file = 'crm_export_2024_01.csv' AND signup_date_raw NOT IN ('', 'unknown')
UNION ALL SELECT import_row_id, to_date(signup_date_raw, 'MM/DD/YYYY') FROM staging_customer_import WHERE source_file = 'crm_export_2024_02.csv' AND signup_date_raw NOT IN ('', 'unknown') AND split_part(signup_date_raw, '/', 1)::int <= 12
UNION ALL SELECT import_row_id, to_date(signup_date_raw, 'Mon DD, YYYY') FROM staging_customer_import WHERE source_file = 'legacy_dump.csv' AND signup_date_raw NOT IN ('', 'unknown') ORDER BY import_row_id;`,
        `SELECT import_row_id, to_date(signup_date_raw, 'YYYY-MM-DD') AS signup_date FROM staging_customer_import WHERE source_file = 'crm_export_2024_01.csv' AND signup_date_raw NOT IN ('', 'unknown')
UNION ALL SELECT import_row_id, to_date(signup_date_raw, 'Mon DD, YYYY') FROM staging_customer_import WHERE source_file = 'legacy_dump.csv' AND signup_date_raw NOT IN ('', 'unknown') ORDER BY import_row_id;`,
      ],
      explanation: `When different rows need different conversions, split the work: one branch per format, each with its own \`to_date\` pattern, stitched together with UNION ALL. The branches can't overlap (different files), so UNION ALL is right.

CASE (Topic 13) can express the same thing in one SELECT, as in the alternative. Either way, the junk filter must be applied before any conversion.`,
      commonMistakes: ['Using one pattern for all files.', 'Forgetting a file.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q12', topic: 8, relatedTopics: [1], difficulty: 'hard', type: 'predict-output',
      title: 'What type is that?',
      prompt: `What does \`pg_typeof\` report for each expression?`,
      referenceSolution: `SELECT pg_typeof(1)                                   AS a,
       pg_typeof(1.5)                                 AS b,
       pg_typeof('abc'::text || 1)                    AS c,
       pg_typeof(DATE '2025-06-30' - DATE '2025-01-01') AS d;`,
      options: [
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['integer', 'numeric', 'text', 'integer']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['integer', 'double precision', 'text', 'interval']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['bigint', 'numeric', 'text', 'interval']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['integer', 'numeric', 'integer', 'date']] } },
      ],
      correctOption: 0,
      hints: ['A literal with a decimal point is numeric unless cast otherwise.', 'Subtracting two dates gives a number of days.'],
      explanation: `- \`1\` is **integer**.
- \`1.5\` is **numeric**: PostgreSQL treats decimal literals as exact numeric, not floating point.
- \`text || integer\` concatenates, and the result is **text**.
- \`date - date\` is the number of days as an **integer**. Timestamps subtracted give an *interval* instead (Topic 11).`,
      commonMistakes: ['Assuming decimal literals are floating point.', 'Expecting an interval from subtracting dates.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't08-q13', topic: 8, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Long-form leap-day dates',
      prompt: `For orders placed on **29 February 2024** (UTC), show the date written out in full, exactly like **\`Thursday, 29 February 2024\`**: no extra spaces anywhere.

- **Columns:** \`order_id\`, \`long_date\`
- **Sort:** by \`order_id\`.`,
      hints: ['`Day` gives the weekday name and `Month` the month name, both padded to 9 characters.', 'Prefix each padded field with `FM`: `\'FMDay, FMDD FMMonth YYYY\'`.'],
      referenceSolution: `SELECT order_id, to_char(ordered_at, 'FMDay, FMDD FMMonth YYYY') AS long_date
FROM orders
WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01'
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, trim(to_char(ordered_at, 'Day')) || ', ' || to_char(ordered_at, 'DD') || ' ' || trim(to_char(ordered_at, 'Month')) || ' ' || to_char(ordered_at, 'YYYY') AS long_date FROM orders WHERE ordered_at::date = '2024-02-29' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, to_char(ordered_at, 'Day, DD Month YYYY') AS long_date FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01' ORDER BY order_id;`,
        `SELECT order_id, to_char(ordered_at, 'FMDy, FMDD FMMon YYYY') AS long_date FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01' ORDER BY order_id;`,
      ],
      explanation: `\`Day\` and \`Month\` are padded with spaces to the width of the longest name ("Wednesday", "September"), so without \`FM\` you get \`'Thursday , 29 February  2024'\`. \`FM\` applies to the next field only, so it's repeated before each field.

\`Dy\` / \`Mon\` are the three-letter abbreviations.`,
      commonMistakes: ['Forgetting FM (padding).', 'Using the abbreviated names.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q14', topic: 8, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Commission as a percentage label',
      prompt: `For **active Sales employees** (\`department_id = 2\`, \`termination_date IS NULL\`), show their commission as a label like **\`'7.5%'\`** or **\`'10.0%'\`** (always one decimal). Employees without a commission show NULL.

- **Columns:** \`employee_id\`, \`commission_label\`
- **Sort:** by \`employee_id\`.`,
      hints: ['`commission_pct` is a fraction (0.075), so multiply by 100.', '`to_char(…, \'FM990.0\')`, then append `\'%\'` with `||`.'],
      referenceSolution: `SELECT employee_id,
       to_char(commission_pct * 100, 'FM990.0') || '%' AS commission_label
FROM employees
WHERE department_id = 2 AND termination_date IS NULL
ORDER BY employee_id;`,
      alternativeSolutions: [`SELECT employee_id, (commission_pct * 100)::numeric(5,1) || '%' AS commission_label FROM employees WHERE department_id = 2 AND termination_date IS NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT employee_id, to_char(commission_pct, 'FM990.0') || '%' AS commission_label FROM employees WHERE department_id = 2 AND termination_date IS NULL ORDER BY employee_id;`,
        `SELECT employee_id, (commission_pct * 100) || '%' AS commission_label FROM employees WHERE department_id = 2 AND termination_date IS NULL ORDER BY employee_id;`,
      ],
      explanation: `1. Fraction to percent: \`commission_pct * 100\` (0.075 becomes 7.500).
2. Exactly one decimal: \`to_char(…, 'FM990.0')\`, or cast to \`numeric(5,1)\`. Concatenating the raw number would show \`7.500%\`.
3. \`|| '%'\` appends the sign. A NULL commission stays NULL: \`to_char(NULL)\` is NULL, and NULL || '%' is NULL.`,
      commonMistakes: ['Forgetting to multiply by 100.', 'Not controlling the number of decimals.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q15', topic: 8, relatedTopics: [1, 4], previewTopics: [9, 12], difficulty: 'interview', type: 'write-query',
      title: 'Clean lifetime values from every file',
      prompt: `Convert \`lifetime_value_raw\` to a **numeric** value for **all rows** of \`staging_customer_import\`:

- CRM files store plain numbers (\`'2006.31'\`), and the legacy file uses \`'$1,234.50'\`;
- \`'n/a'\`, \`''\` and NULL must become **NULL** (no error).

- **Columns:** \`import_row_id\`, \`lifetime_value\`
- **Sort:** by \`import_row_id\`. One row per import row.`,
      hints: ['Strip the formatting first: `replace(replace(raw, \'$\', \'\'), \',\', \'\')`.', '`NULLIF(x, \'\')` turns an empty string into NULL (Topic 12). Treat `\'n/a\'` the same way.', 'Casting NULL gives NULL, without an error.'],
      referenceSolution: `SELECT import_row_id,
       NULLIF(NULLIF(replace(replace(lifetime_value_raw, '$', ''), ',', ''), 'n/a'), '')::numeric AS lifetime_value
FROM staging_customer_import
ORDER BY import_row_id;`,
      alternativeSolutions: [
        `SELECT import_row_id, CASE WHEN pg_input_is_valid(translate(lifetime_value_raw, '$,', ''), 'numeric') THEN translate(lifetime_value_raw, '$,', '')::numeric END AS lifetime_value FROM staging_customer_import ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT import_row_id, NULLIF(NULLIF(replace(lifetime_value_raw, '$', ''), 'n/a'), '')::numeric AS lifetime_value FROM staging_customer_import ORDER BY import_row_id;`,
        `SELECT import_row_id, NULLIF(NULLIF(replace(replace(lifetime_value_raw, '$', ''), ',', ''), 'n/a'), '')::numeric AS lifetime_value FROM staging_customer_import WHERE source_file LIKE 'crm%' ORDER BY import_row_id;`,
      ],
      explanation: `Cleaning text into numbers is everyday data-engineering work. A robust recipe:

1. **Remove formatting:** strip \`$\` and the thousands separator. \`translate(raw, '$,', '')\` deletes both in one call.
2. **Turn junk into NULL:** \`NULLIF(x, 'n/a')\` and \`NULLIF(x, '')\` return NULL for those exact values.
3. **Cast:** \`::numeric\`. NULL casts to NULL, without an error.

Forget step 1's comma and \`'1,234.50'\` fails to cast. Filtering out the legacy file "avoids" the problem but returns too few rows. \`pg_input_is_valid\` + CASE (the alternative) is the most defensive version: anything unparsable becomes NULL.`,
      commonMistakes: ['Not removing the thousands separator.', 'Filtering rows away instead of converting them.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't08-q16', topic: 8, relatedTopics: [1, 4, 7], previewTopics: [19], difficulty: 'interview', type: 'write-query',
      title: 'Impossible signup dates',
      prompt: `A signup can't be **after** the moment its row was imported. Parse \`signup_date_raw\` with each file's format (see the table in the "Parse every file's dates" question: ISO, DD/MM/YYYY, Mon DD, YYYY) and find rows whose parsed signup date is **later than \`imported_at::date\`**. Ignore NULL, \`''\` and \`'unknown'\`.

- **Columns:** \`import_row_id\`, \`source_file\`, \`signup_date\`, \`imported_on\` (\`imported_at::date\`)
- **Sort:** by \`import_row_id\`.

*It's fine if the answer is empty: a clean result is also a result. Here it isn't empty only if the data has problems…*`,
      hints: ['Reuse the UNION ALL parsing pattern, keeping `source_file` and `imported_at` in each branch.', 'Wrap the UNION ALL in a subquery, then filter `signup_date > imported_on`.'],
      referenceSolution: `SELECT import_row_id, source_file, signup_date, imported_on
FROM (
  SELECT import_row_id, source_file, imported_at::date AS imported_on, to_date(signup_date_raw, 'YYYY-MM-DD') AS signup_date
  FROM staging_customer_import WHERE source_file = 'crm_export_2024_01.csv' AND signup_date_raw NOT IN ('', 'unknown')
  UNION ALL
  SELECT import_row_id, source_file, imported_at::date, to_date(signup_date_raw, 'DD/MM/YYYY')
  FROM staging_customer_import WHERE source_file = 'crm_export_2024_02.csv' AND signup_date_raw NOT IN ('', 'unknown')
  UNION ALL
  SELECT import_row_id, source_file, imported_at::date, to_date(signup_date_raw, 'Mon DD, YYYY')
  FROM staging_customer_import WHERE source_file = 'legacy_dump.csv' AND signup_date_raw NOT IN ('', 'unknown')
) AS parsed
WHERE signup_date > imported_on
ORDER BY import_row_id;`,
      alternativeSolutions: [
        `SELECT import_row_id, source_file, d AS signup_date, imported_at::date AS imported_on FROM (
  SELECT *, CASE source_file WHEN 'crm_export_2024_01.csv' THEN to_date(signup_date_raw, 'YYYY-MM-DD') WHEN 'crm_export_2024_02.csv' THEN to_date(signup_date_raw, 'DD/MM/YYYY') ELSE to_date(signup_date_raw, 'Mon DD, YYYY') END AS d
  FROM staging_customer_import WHERE signup_date_raw NOT IN ('', 'unknown')) t
WHERE d > imported_at::date ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT import_row_id, source_file, signup_date, imported_on FROM (
  SELECT import_row_id, source_file, imported_at::date AS imported_on, to_date(signup_date_raw, 'YYYY-MM-DD') AS signup_date FROM staging_customer_import WHERE source_file = 'crm_export_2024_01.csv' AND signup_date_raw NOT IN ('', 'unknown')
  UNION ALL SELECT import_row_id, source_file, imported_at::date, to_date(signup_date_raw, 'MM/DD/YYYY') FROM staging_customer_import WHERE source_file = 'crm_export_2024_02.csv' AND signup_date_raw NOT IN ('', 'unknown') AND split_part(signup_date_raw, '/', 1)::int <= 12
  UNION ALL SELECT import_row_id, source_file, imported_at::date, to_date(signup_date_raw, 'Mon DD, YYYY') FROM staging_customer_import WHERE source_file = 'legacy_dump.csv' AND signup_date_raw NOT IN ('', 'unknown')
) AS parsed WHERE signup_date > imported_on ORDER BY import_row_id;`,
      ],
      explanation: `Validating parsed data against other columns is how real data-quality checks work. Parse each file with its own pattern (UNION ALL), keep the columns you need for the comparison, then filter in an outer query.

With the correct day/month order every signup is in the past, so this query returns **no rows**. That's the right answer, and the checker accepts an empty result here. Swapping day and month for the DD/MM file is exactly the kind of bug this check is meant to catch: suddenly many signups land in the "future".`,
      commonMistakes: ['Swapping day and month (MM/DD).', 'Comparing a timestamp with a date without deciding what "later" means.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowEmptyResult: true, allowSameOnHidden: true },
    },
  ],
};

export default topic;
