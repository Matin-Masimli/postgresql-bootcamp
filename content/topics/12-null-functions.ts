import type { Topic } from '../types.ts';

const explanation = `NULL means **"unknown / not applicable"**. It isn't zero, not an empty string, not false. Almost every operation on NULL yields NULL, which is mathematically sound and a constant source of bugs. This topic collects the tools for handling it.

## How NULL behaves

| expression | result |
|---|---|
| \`NULL = NULL\`, \`NULL <> 1\`, \`NULL > 0\` | NULL (unknown) |
| \`NULL + 1\`, \`'a' || NULL\` | NULL |
| \`NULL AND false\` / \`NULL OR true\` | false / true (the known side decides) |
| \`x IN (1, NULL)\` when x = 2 | NULL |
| \`x NOT IN (1, NULL)\` | never true |
| \`count(col)\`, \`sum(col)\`, \`avg(col)\` | ignore NULLs. \`count(*)\` counts rows |
| \`ORDER BY col\` | NULLs last ascending, first descending |
| \`DISTINCT\`, \`GROUP BY\`, \`UNION\` | treat all NULLs as **one** value |

\`WHERE\` keeps only rows where the condition is **true**. Unknown is dropped, just like false.

## Testing: IS NULL and IS DISTINCT FROM

\`\`\`sql
SELECT count(*) FILTER (WHERE email IS NULL)                     AS no_email,
       count(*) FILTER (WHERE email = NULL)                      AS always_zero,
       count(*) FILTER (WHERE city IS DISTINCT FROM 'Berlin')    AS not_berlin_incl_unknown,
       count(*) FILTER (WHERE city <> 'Berlin')                  AS not_berlin_known_only
FROM customers;
\`\`\`

\`a IS DISTINCT FROM b\` is "not equal, treating NULL as a normal value". \`IS NOT DISTINCT FROM\` is the NULL-safe equality.

## COALESCE: the first non-NULL value

\`\`\`sql
SELECT customer_id,
       coalesce(phone, email, 'no contact') AS best_contact,
       coalesce(city, '(unknown)')          AS city
FROM customers
ORDER BY customer_id
LIMIT 8;
\`\`\`

\`coalesce(a, b, c)\` returns the first argument that isn't NULL, or NULL if all are. All arguments must have compatible types: \`coalesce(weight_kg, 'n/a')\` fails, while \`coalesce(weight_kg::text, 'n/a')\` works.

## NULLIF: turn a value into NULL

\`nullif(a, b)\` returns NULL if a = b, otherwise a. Two classic uses:

\`\`\`sql
SELECT nullif(trim('   '), '')          AS empty_becomes_null,
       100.0 / nullif(0, 0)             AS no_division_error,   -- NULL instead of an error
       coalesce(nullif('n/a', 'n/a'), 'unknown') AS cleaned;
\`\`\`

- Treat "fake" values ('', 'n/a', 0) as missing: \`nullif(trim(email), '')\`.
- Avoid division by zero: \`a / nullif(b, 0)\`.

## Concatenation and NULL

\`first_name || ' ' || city\` is NULL whenever city is NULL. \`concat(…)\` and \`concat_ws(sep, …)\` skip NULLs. Or wrap the optional part: \`coalesce(' (' || city || ')', '')\`.

## Gotchas

- \`NOT (commission_pct > 0.05)\` is **not** "everyone else": rows with a NULL commission are excluded by both the condition and its negation. Decide what NULL should mean and write it out (\`coalesce(commission_pct, 0) <= 0.05\`).
- \`WHERE col <> 'x'\` silently drops NULL rows. Use \`IS DISTINCT FROM\` if they belong in the result.
- In joins, \`IS NOT DISTINCT FROM\` makes NULL match NULL. That's usually **not** what you want (two unknown phone numbers aren't the same phone).
- Unique constraints allow many NULLs (Topic 2). CHECK constraints let NULL pass.`;

const topic: Topic = {
  id: 12,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Conditional Expressions, COALESCE / NULLIF (9.18)', url: 'https://www.postgresql.org/docs/18/functions-conditional.html' },
    { title: 'PostgreSQL 18: Comparison Predicates, IS NULL / IS DISTINCT FROM (9.2)', url: 'https://www.postgresql.org/docs/18/functions-comparison.html' },
    { title: 'Neon PostgreSQL Tutorial: COALESCE', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-coalesce' },
    { title: 'Neon PostgreSQL Tutorial: NULLIF', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-nullif' },
  ],
  questions: [
    {
      id: 't12-q01',
      topic: 12,
      relatedTopics: [1, 8],
      difficulty: 'easy',
      type: 'predict-output',
      title: 'Four ways to meet NULL',
      prompt: `Without running it, predict the single row this query returns.`,
      referenceSolution: `SELECT NULL = NULL        AS a,
       NULL IS NULL      AS b,
       COALESCE(NULL, 0) + 1 AS c,
       NULLIF(5, 5)      AS d;`,
      options: [
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['true', 'true', '1', null]] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [[null, 'true', '1', null]] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['false', 'true', null, '5']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [[null, 'true', null, '0']] } },
      ],
      correctOption: 1,
      hints: [
        'Comparing anything with NULL using `=` gives "unknown", which is NULL, not TRUE or FALSE.',
        '`COALESCE` returns its first non-NULL argument. `NULLIF(x, y)` returns NULL when x = y, otherwise x.',
      ],
      explanation: `- **a = NULL:** \`NULL = NULL\` asks "is an unknown value equal to another unknown value?". The answer is unknown, so the result is NULL, not TRUE. That's why you need \`IS NULL\`.
- **b = true:** \`IS NULL\` is the dedicated test, and it always returns TRUE or FALSE.
- **c = 1:** \`COALESCE(NULL, 0)\` skips the NULL and returns 0, and 0 + 1 = 1. (Without COALESCE, \`NULL + 1\` would be NULL.)
- **d = NULL:** \`NULLIF(5, 5)\` returns NULL because both arguments are equal. It is often used to turn a value into NULL, e.g. \`x / NULLIF(y, 0)\` to avoid division by zero.`,
      commonMistakes: [
        'Expecting `NULL = NULL` to be TRUE. Equality with NULL is always NULL ("unknown").',
        'Thinking COALESCE returns NULL when its first argument is NULL. It moves on to the next argument.',
        'Mixing up NULLIF and COALESCE. NULLIF creates NULLs, COALESCE replaces them.',
      ],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't12-q02', topic: 12, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Phone or a placeholder',
      prompt: `For customers **1 to 20**, show the phone number, or **\`'n/a'\`** if it's missing.

- **Columns:** \`customer_id\`, \`phone\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`coalesce(phone, \'n/a\')`'],
      referenceSolution: `SELECT customer_id, coalesce(phone, 'n/a') AS phone
FROM customers
WHERE customer_id BETWEEN 1 AND 20
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, CASE WHEN phone IS NULL THEN 'n/a' ELSE phone END AS phone FROM customers WHERE customer_id <= 20 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, phone FROM customers WHERE customer_id BETWEEN 1 AND 20 ORDER BY customer_id;`,
        `SELECT customer_id, coalesce(phone, 'n/a') AS phone FROM customers WHERE customer_id BETWEEN 1 AND 20 AND phone IS NOT NULL ORDER BY customer_id;`,
      ],
      explanation: `\`coalesce(phone, 'n/a')\` returns the phone when it exists, and otherwise the next argument. Every customer stays in the list. Filtering out the missing phones answers a different question.`,
      commonMistakes: ['Filtering out the NULL rows instead of replacing their value.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q03', topic: 12, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'COALESCE with several arguments',
      prompt: `What does \`coalesce(NULL, NULL, 3, 4)\` return?`,
      options: [{ text: 'NULL' }, { text: '3' }, { text: '4' }, { text: '7' }],
      correctOption: 1,
      hints: ['It returns the *first* argument that isn\'t NULL.'],
      explanation: `COALESCE scans left to right and returns the **first** non-NULL argument: 3. It stops there, and later arguments aren't even evaluated.`,
      commonMistakes: ['Thinking COALESCE sums or returns the last value.'],
    },
    {
      id: 't12-q04', topic: 12, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Incomplete addresses',
      prompt: `List customers whose **city or country is unknown**.

- **Columns:** \`customer_id\`, \`city\`, \`country_id\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Two IS NULL tests joined with OR.'],
      referenceSolution: `SELECT customer_id, city, country_id
FROM customers
WHERE city IS NULL OR country_id IS NULL
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, city, country_id FROM customers WHERE NOT (city IS NOT NULL AND country_id IS NOT NULL) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, city, country_id FROM customers WHERE city IS NULL AND country_id IS NULL ORDER BY customer_id;`,
        `SELECT customer_id, city, country_id FROM customers WHERE city = NULL OR country_id = NULL ORDER BY customer_id;`,
      ],
      explanation: `\`IS NULL\` is the only way to test for missing values: \`= NULL\` is never true. "City **or** country unknown" is OR. AND would require both to be missing.`,
      commonMistakes: ['Using = NULL.', 'AND instead of OR.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q05', topic: 12, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Best way to reach a customer',
      prompt: `For customers **1 to 40**, show the best contact: the **e-mail** if there is one, otherwise the **phone**, otherwise **\`'no contact'\`**.

- **Columns:** \`customer_id\`, \`contact\`
- **Sort:** by \`customer_id\`.`,
      hints: ['COALESCE accepts more than two arguments.'],
      referenceSolution: `SELECT customer_id, coalesce(email, phone, 'no contact') AS contact
FROM customers
WHERE customer_id BETWEEN 1 AND 40
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, coalesce(email, coalesce(phone, 'no contact')) AS contact FROM customers WHERE customer_id <= 40 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, coalesce(phone, email, 'no contact') AS contact FROM customers WHERE customer_id BETWEEN 1 AND 40 ORDER BY customer_id;`,
        `SELECT customer_id, coalesce(email, 'no contact') AS contact FROM customers WHERE customer_id BETWEEN 1 AND 40 ORDER BY customer_id;`,
      ],
      explanation: `COALESCE implements a **fallback chain**: the arguments are tried left to right, so their order encodes the priority. Swapping e-mail and phone changes the result for everyone who has both.`,
      commonMistakes: ['Wrong priority order.', 'Skipping a fallback.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q06', topic: 12, relatedTopics: [1, 4, 9], difficulty: 'medium', type: 'write-query',
      title: 'Fake values are missing values',
      prompt: `In \`staging_customer_import\`, missing e-mails appear as NULL, as an empty string, or as \`'n/a'\`. For **every row**, show the trimmed e-mail, with **all three kinds of "missing" shown as \`'unknown'\`**.

- **Columns:** \`import_row_id\`, \`email\`
- **Sort:** by \`import_row_id\`.`,
      hints: ['`nullif(x, \'\')` turns \'\' into NULL, and nesting handles \'n/a\' too.', 'Then `coalesce(…, \'unknown\')`.'],
      referenceSolution: `SELECT import_row_id,
       coalesce(nullif(nullif(trim(email), ''), 'n/a'), 'unknown') AS email
FROM staging_customer_import
ORDER BY import_row_id;`,
      alternativeSolutions: [`SELECT import_row_id, CASE WHEN email IS NULL OR trim(email) IN ('', 'n/a') THEN 'unknown' ELSE trim(email) END AS email FROM staging_customer_import ORDER BY 1;`],
      wrongAnswers: [
        `SELECT import_row_id, coalesce(trim(email), 'unknown') AS email FROM staging_customer_import ORDER BY import_row_id;`,
        `SELECT import_row_id, coalesce(nullif(trim(email), ''), 'unknown') AS email FROM staging_customer_import ORDER BY import_row_id;`,
      ],
      explanation: `COALESCE only replaces real NULLs. NULLIF first converts the placeholder values into NULL, then COALESCE replaces all three uniformly. Nesting NULLIF handles several placeholders.

This "nullif then coalesce" pattern is the standard way to clean placeholder values.`,
      commonMistakes: ['COALESCE alone, which leaves \'\' and \'n/a\'.', 'Handling only one placeholder.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q07', topic: 12, relatedTopics: [1, 4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Time zone different from the country default',
      prompt: `Find customers whose \`timezone\` is **different from their country's \`default_timezone\`**, where a **missing timezone counts as different**. Customers without a country are left out.

- **Columns:** \`customer_id\`, \`timezone\`, \`default_timezone\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Join customers to countries.', '`<>` drops rows where timezone is NULL. Use the NULL-safe comparison.'],
      referenceSolution: `SELECT c.customer_id, c.timezone, co.default_timezone
FROM customers c
JOIN countries co ON co.country_id = c.country_id
WHERE c.timezone IS DISTINCT FROM co.default_timezone
ORDER BY c.customer_id;`,
      alternativeSolutions: [`SELECT c.customer_id, c.timezone, co.default_timezone FROM customers c JOIN countries co USING (country_id) WHERE c.timezone <> co.default_timezone OR c.timezone IS NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT c.customer_id, c.timezone, co.default_timezone FROM customers c JOIN countries co ON co.country_id = c.country_id WHERE c.timezone <> co.default_timezone ORDER BY c.customer_id;`,
        `SELECT c.customer_id, c.timezone, co.default_timezone FROM customers c JOIN countries co ON co.country_id = c.country_id WHERE coalesce(c.timezone, co.default_timezone) <> co.default_timezone ORDER BY c.customer_id;`,
      ],
      explanation: `\`timezone <> default_timezone\` is unknown for a NULL timezone, so those customers vanish. \`IS DISTINCT FROM\` treats NULL vs 'Europe/Berlin' as different. Replacing a missing timezone with the default (\`coalesce(timezone, default)\`) does the opposite of what's asked: it treats "missing" as "same". The inner join leaves out customers without a country, as requested.

US and Canadian customers often use another zone of their country, which is perfectly valid but "different".`,
      commonMistakes: ['<>, which loses NULL timezones.', 'Coalescing the missing timezone to the default, which treats missing as equal.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q08', topic: 12, relatedTopics: [1], previewTopics: [14], difficulty: 'medium', type: 'predict-output',
      title: 'Counting with NULLs',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT count(*)          AS all_rows,
       count(x)          AS non_null,
       count(DISTINCT x) AS distinct_non_null,
       sum(x)            AS total
FROM (VALUES (1), (NULL), (1), (2)) AS t(x);`,
      options: [
        { table: { columns: ['all_rows', 'non_null', 'distinct_non_null', 'total'], rows: [['4', '4', '3', null]] } },
        { table: { columns: ['all_rows', 'non_null', 'distinct_non_null', 'total'], rows: [['4', '3', '2', '4']] } },
        { table: { columns: ['all_rows', 'non_null', 'distinct_non_null', 'total'], rows: [['3', '3', '2', '4']] } },
        { table: { columns: ['all_rows', 'non_null', 'distinct_non_null', 'total'], rows: [['4', '3', '3', null]] } },
      ],
      correctOption: 1,
      hints: ['count(*) counts rows. count(x) counts non-NULL values. Aggregates skip NULLs.'],
      explanation: `- \`count(*)\` counts **rows**: 4.
- \`count(x)\` counts **non-NULL values**: 3.
- \`count(DISTINCT x)\` counts different non-NULL values: {1, 2} = 2.
- \`sum(x)\` ignores the NULL: 1 + 1 + 2 = **4**, not NULL. (It's NULL only if *all* values are NULL.)`,
      commonMistakes: ['Expecting sum to become NULL because one value is NULL.', 'Counting NULL as a distinct value.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't12-q09', topic: 12, relatedTopics: [1, 4, 9], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: names that vanish',
      prompt: `This query should show a label like \`'Anna Kim (Berlin)'\` for customers **1 to 30**. For customers without a city it should show just \`'Anna Kim'\`, with no empty parentheses. Right now those customers get NULL. Fix it.

- **Columns:** \`customer_id\`, \`label\`
- **Sort:** by \`customer_id\`.`,
      starterSql: `SELECT customer_id,
       first_name || ' ' || last_name || ' (' || city || ')' AS label
FROM customers
WHERE customer_id BETWEEN 1 AND 30
ORDER BY customer_id;`,
      hints: ['`||` with NULL gives NULL. Make the optional part disappear when city is NULL.', '`coalesce(\' (\' || city || \')\', \'\')`'],
      referenceSolution: `SELECT customer_id,
       first_name || ' ' || last_name || coalesce(' (' || city || ')', '') AS label
FROM customers
WHERE customer_id BETWEEN 1 AND 30
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, concat(first_name, ' ', last_name, CASE WHEN city IS NOT NULL THEN ' (' || city || ')' END) AS label FROM customers WHERE customer_id <= 30 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, concat(first_name, ' ', last_name, ' (', city, ')') AS label FROM customers WHERE customer_id BETWEEN 1 AND 30 ORDER BY customer_id;`,
        `SELECT customer_id, first_name || ' ' || last_name || ' (' || coalesce(city, '') || ')' AS label FROM customers WHERE customer_id BETWEEN 1 AND 30 ORDER BY customer_id;`,
      ],
      explanation: `In \`' (' || city || ')'\`, a NULL city makes the **whole optional part** NULL, which is exactly what we want. Wrapping that part in \`coalesce(…, '')\` replaces it with an empty string, and the name survives.

\`concat()\` skips NULLs but still adds the literal parentheses, giving 'Anna Kim ()'. So does \`coalesce(city, '')\`.`,
      commonMistakes: ['Ending up with empty parentheses.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q10', topic: 12, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Unknown costs first',
      prompt: `Show the **15 products with the lowest cost**, but list products with an **unknown cost first** (they need attention). Ties by \`product_id\`.

- **Columns:** \`product_id\`, \`cost\`
- **Sort:** unknown costs first, then cost ascending, then \`product_id\`. 15 rows.`,
      hints: ['In ascending order NULLs come last by default. Override with `NULLS FIRST`.'],
      referenceSolution: `SELECT product_id, cost
FROM products
ORDER BY cost NULLS FIRST, product_id
LIMIT 15;`,
      alternativeSolutions: [`SELECT product_id, cost FROM products ORDER BY cost IS NOT NULL, cost, product_id LIMIT 15;`],
      wrongAnswers: [
        `SELECT product_id, cost FROM products ORDER BY cost, product_id LIMIT 15;`,
        `SELECT product_id, cost FROM products ORDER BY cost IS NULL, cost, product_id LIMIT 15;`,
      ],
      explanation: `\`NULLS FIRST\` puts unknown costs before every known value. The alternative sorts on the boolean \`cost IS NOT NULL\` (false < true) first.

Be careful with the boolean trick's direction: \`cost IS NULL\` is *true* for unknown costs, and true sorts **after** false, which sends them to the end. Replacing NULL with 0 (\`coalesce(cost, 0)\`) happens to work on this data, but it would mix unknown costs with any real zero costs.`,
      commonMistakes: ['Relying on the default (NULLs last when ascending).', 'Sorting on `cost IS NULL` (true sorts last).', 'Using coalesce(cost, 0) as a fake value.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q11', topic: 12, relatedTopics: [1, 5], difficulty: 'hard', type: 'write-query',
      title: 'Products with supplier and country, defaults included',
      prompt: `List every product with its supplier's name and the supplier's country name. If there is **no supplier**, show **\`'(no supplier)'\`** and **\`'(unknown)'\`**.

- **Columns:** \`product_id\`, \`supplier\`, \`supplier_country\`
- **Sort:** by \`product_id\`.`,
      hints: ['Two LEFT JOINs: products → suppliers → countries.', 'Apply COALESCE to the columns that come from the optional side.'],
      referenceSolution: `SELECT p.product_id,
       coalesce(s.name, '(no supplier)') AS supplier,
       coalesce(co.name, '(unknown)')    AS supplier_country
FROM products p
LEFT JOIN suppliers s  ON s.supplier_id = p.supplier_id
LEFT JOIN countries co ON co.country_id = s.country_id
ORDER BY p.product_id;`,
      alternativeSolutions: [`SELECT p.product_id, coalesce(s.name, '(no supplier)') AS supplier, coalesce((SELECT name FROM countries WHERE country_id = s.country_id), '(unknown)') AS supplier_country FROM products p LEFT JOIN suppliers s USING (supplier_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT p.product_id, coalesce(s.name, '(no supplier)') AS supplier, coalesce(co.name, '(unknown)') AS supplier_country FROM products p JOIN suppliers s ON s.supplier_id = p.supplier_id JOIN countries co ON co.country_id = s.country_id ORDER BY p.product_id;`,
        `SELECT p.product_id, s.name AS supplier, co.name AS supplier_country FROM products p LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id LEFT JOIN countries co ON co.country_id = s.country_id ORDER BY p.product_id;`,
      ],
      explanation: `Outer joins create NULLs, and COALESCE turns them into readable defaults. Both joins must be LEFT: an inner join removes the supplier-less products before COALESCE ever sees them.`,
      commonMistakes: ['Inner joins.', 'Leaving the NULLs in.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q12', topic: 12, relatedTopics: [1, 4, 5], difficulty: 'hard', type: 'write-query',
      title: 'Matching imports to customers by phone',
      prompt: `Match \`staging_customer_import\` rows to \`customers\` by **identical phone number** (exact text). Rows **without** a phone must **not** match anything.

- **Columns:** \`import_row_id\`, \`customer_id\`
- **Sort:** by \`import_row_id\`, then \`customer_id\`.`,
      hints: ['A normal `=` join never matches NULL with NULL, and here that\'s exactly what you want.', 'What would `IS NOT DISTINCT FROM` do with the many NULL phones?'],
      referenceSolution: `SELECT s.import_row_id, c.customer_id
FROM staging_customer_import s
JOIN customers c ON c.phone = s.phone
ORDER BY s.import_row_id, c.customer_id;`,
      alternativeSolutions: [`SELECT s.import_row_id, c.customer_id FROM staging_customer_import s JOIN customers c ON c.phone = s.phone AND s.phone IS NOT NULL ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT s.import_row_id, c.customer_id FROM staging_customer_import s JOIN customers c ON c.phone IS NOT DISTINCT FROM s.phone ORDER BY s.import_row_id, c.customer_id;`,
        `SELECT s.import_row_id, c.customer_id FROM staging_customer_import s JOIN customers c ON coalesce(c.phone, '') = coalesce(s.phone, '') ORDER BY s.import_row_id, c.customer_id;`,
      ],
      explanation: `Two unknown phone numbers are not "the same phone". The plain equality join gets this right automatically, because \`NULL = NULL\` is not true.

\`IS NOT DISTINCT FROM\` (and \`coalesce(x, '') = coalesce(y, '')\`) make NULL equal NULL, pairing **every** phone-less import row with **every** phone-less customer: a huge, meaningless cross product. Use NULL-safe equality only when NULL really means "the same unknown value".`,
      commonMistakes: ['NULL-safe equality in a join on optional data.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q13', topic: 12, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Commission of at most 5%',
      prompt: `List the **active Sales employees** (\`department_id = 2\`, \`termination_date IS NULL\`) whose commission is **not above 5%**. Employees **without** a commission count as 0%, so they belong in the list.

- **Columns:** \`employee_id\`, \`commission_pct\`
- **Sort:** by \`employee_id\`.`,
      hints: ['`NOT (commission_pct > 0.05)` is unknown when commission_pct is NULL.', 'Make the rule explicit: `coalesce(commission_pct, 0) <= 0.05`.'],
      referenceSolution: `SELECT employee_id, commission_pct
FROM employees
WHERE department_id = 2
  AND termination_date IS NULL
  AND coalesce(commission_pct, 0) <= 0.05
ORDER BY employee_id;`,
      alternativeSolutions: [`SELECT employee_id, commission_pct FROM employees WHERE department_id = 2 AND termination_date IS NULL AND (commission_pct <= 0.05 OR commission_pct IS NULL) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT employee_id, commission_pct FROM employees WHERE department_id = 2 AND termination_date IS NULL AND NOT (commission_pct > 0.05) ORDER BY employee_id;`,
        `SELECT employee_id, commission_pct FROM employees WHERE department_id = 2 AND termination_date IS NULL AND commission_pct < 0.05 ORDER BY employee_id;`,
      ],
      explanation: `\`NOT (x > 0.05)\` feels like "everything else", but for NULL it's NOT(unknown) = unknown, so those rows are dropped. Decide what NULL means (here: 0%) and say so: \`coalesce(commission_pct, 0) <= 0.05\`, or add \`OR commission_pct IS NULL\`.

"Not above 5%" includes exactly 5%: \`<=\`.`,
      commonMistakes: ['Expecting NOT to include the NULL rows.', 'Excluding exactly 5%.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q14', topic: 12, relatedTopics: [1, 4], difficulty: 'hard', type: 'predict-output',
      title: 'IN, NOT IN and NULL',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT 1 IN (1, NULL)                  AS a,
       2 IN (1, NULL)                  AS b,
       2 NOT IN (1, NULL)              AS c,
       NULL IS DISTINCT FROM NULL      AS d;`,
      options: [
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['true', 'false', 'true', 'false']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['true', null, null, 'false']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [[null, null, null, null]] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['true', null, 'true', 'true']] } },
      ],
      correctOption: 1,
      hints: ['`x IN (a, b)` = `x = a OR x = b`. `x NOT IN (a, b)` = `x <> a AND x <> b`.'],
      explanation: `- **a:** \`1 = 1 OR 1 = NULL\` → true OR unknown → **true**.
- **b:** \`2 = 1 OR 2 = NULL\` → false OR unknown → **NULL**.
- **c:** \`2 <> 1 AND 2 <> NULL\` → true AND unknown → **NULL**. NOT IN with a NULL in the list can never be true.
- **d:** two NULLs are *not distinct* → **false**.`,
      commonMistakes: ['Expecting NOT IN to be true when the value isn\'t in the list.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't12-q15', topic: 12, relatedTopics: [1, 4, 9], difficulty: 'interview', type: 'write-query',
      title: 'Normalised contact for every customer',
      prompt: `Build a single contact value for **every customer**: the e-mail, **lower-cased and trimmed**, if it's present and not empty; otherwise the phone number **reduced to its digits** (\`regexp_replace(phone, '\\D', '', 'g')\`), if that's not empty; otherwise NULL.

- **Columns:** \`customer_id\`, \`contact\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Each candidate: normalise it, then `nullif(…, \'\')` so an empty result counts as missing.', 'Combine the candidates with COALESCE in priority order.'],
      referenceSolution: `SELECT customer_id,
       coalesce(nullif(lower(trim(email)), ''),
                nullif(regexp_replace(phone, '\\D', '', 'g'), '')) AS contact
FROM customers
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, CASE WHEN coalesce(trim(email), '') <> '' THEN lower(trim(email)) WHEN coalesce(regexp_replace(phone, '[^0-9]', '', 'g'), '') <> '' THEN regexp_replace(phone, '[^0-9]', '', 'g') END AS contact FROM customers ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, coalesce(lower(trim(email)), phone) AS contact FROM customers ORDER BY customer_id;`,
        `SELECT customer_id, coalesce(regexp_replace(phone, '\\D', '', 'g'), lower(trim(email))) AS contact FROM customers ORDER BY customer_id;`,
      ],
      explanation: `A robust fallback chain normalises **each candidate first**, then turns "empty after cleaning" into NULL with \`nullif(…, '')\`, and only then lets COALESCE choose. Without the NULLIFs, a value that's empty after cleaning would win over a real phone number.

Order matters: e-mail first, as specified.`,
      commonMistakes: ['Not normalising the phone.', 'Wrong priority.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't12-q16', topic: 12, relatedTopics: [1, 4, 5, 6], previewTopics: [19], difficulty: 'interview', type: 'write-query',
      title: 'Escalation contact',
      prompt: `Every employee needs an **escalation e-mail**: their **manager's** e-mail; if they have no manager, or the manager has **left** (\`termination_date\` not NULL), use the **VP of their department** (the employee in the same department whose \`job_title\` starts with \`'VP of'\`); if that doesn't exist either, use the **CEO's** e-mail (the employee with no manager).

- **Columns:** \`employee_id\`, \`escalation_email\`
- **Sort:** by \`employee_id\`.`,
      hints: ['LEFT JOIN the manager, but only if they are still active: put that condition in ON.', 'LEFT JOIN the department\'s VP: `vp.department_id = e.department_id AND vp.job_title LIKE \'VP of%\'`.', 'Join the CEO with `ceo.manager_id IS NULL`, then COALESCE the three e-mails.'],
      referenceSolution: `SELECT e.employee_id,
       coalesce(m.email, vp.email, ceo.email) AS escalation_email
FROM employees e
LEFT JOIN employees m   ON m.employee_id = e.manager_id AND m.termination_date IS NULL
LEFT JOIN employees vp  ON vp.department_id = e.department_id AND vp.job_title LIKE 'VP of%'
CROSS JOIN (SELECT email FROM employees WHERE manager_id IS NULL) AS ceo
ORDER BY e.employee_id;`,
      alternativeSolutions: [
        `SELECT e.employee_id, coalesce(
  (SELECT m.email FROM employees m WHERE m.employee_id = e.manager_id AND m.termination_date IS NULL),
  (SELECT vp.email FROM employees vp WHERE vp.department_id = e.department_id AND vp.job_title LIKE 'VP of%'),
  (SELECT c.email FROM employees c WHERE c.manager_id IS NULL)) AS escalation_email
FROM employees e ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT e.employee_id, coalesce(m.email, vp.email, ceo.email) AS escalation_email FROM employees e LEFT JOIN employees m ON m.employee_id = e.manager_id LEFT JOIN employees vp ON vp.department_id = e.department_id AND vp.job_title LIKE 'VP of%' CROSS JOIN (SELECT email FROM employees WHERE manager_id IS NULL) AS ceo ORDER BY e.employee_id;`,
        `SELECT e.employee_id, coalesce(m.email, ceo.email) AS escalation_email FROM employees e LEFT JOIN employees m ON m.employee_id = e.manager_id AND m.termination_date IS NULL CROSS JOIN (SELECT email FROM employees WHERE manager_id IS NULL) AS ceo ORDER BY e.employee_id;`,
      ],
      explanation: `Each fallback is an optional row, joined with LEFT JOIN, and COALESCE picks the first one that exists:

1. **Manager, if still active:** the activity condition goes in the **ON** clause. Otherwise a departed manager would still be "found", and their e-mail used.
2. **The department's VP:** a second self-join on department and title. Employees without a department, and the VPs' own departments (matching themselves), are handled naturally.
3. **The CEO:** a one-row subquery cross-joined to every employee as the last resort.

The team whose manager left in 2024 is the case that separates right from wrong here.`,
      commonMistakes: ['Ignoring that the manager may have left.', 'Skipping the VP level.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
  ],
};

export default topic;
