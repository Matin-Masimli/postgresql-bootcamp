import type { Topic } from '../types.ts';

const explanation = `Text typed by humans is messy: stray spaces, random capitalisation, inconsistent formats. String functions clean, split, search and build text. Our \`customers\`, \`reviews\` and \`staging_customer_import\` tables give you plenty to practise on.

## Cleaning: case and whitespace

| function | example | result |
|---|---|---|
| \`lower(s)\`, \`upper(s)\` | \`upper('zoë')\` | \`'ZOË'\` |
| \`initcap(s)\` | \`initcap('anna DE vries')\` | \`'Anna De Vries'\` |
| \`trim(s)\` / \`ltrim\` / \`rtrim\` | \`trim('  Berlin ')\` | \`'Berlin'\` |
| \`trim(both 'x' from s)\` | \`trim(both '-' from '--a--')\` | \`'a'\` |

\`\`\`sql
SELECT customer_id,
       first_name,
       initcap(trim(first_name)) AS cleaned
FROM customers
WHERE first_name <> initcap(trim(first_name))
ORDER BY customer_id
LIMIT 8;
\`\`\`

## Measuring and cutting

- \`length(s)\` / \`char_length(s)\` count **characters**. \`octet_length(s)\` counts **bytes**: 'Zoë' is 3 characters but 4 bytes in UTF-8.
- \`left(s, n)\`, \`right(s, n)\`, \`substring(s FROM start FOR len)\` (positions start at **1**). A negative n in \`left\`/\`right\` means "all but the last/first n".
- \`position('@' IN email)\` or \`strpos(email, '@')\` returns the position of a substring, 0 if absent.
- \`split_part(s, delimiter, n)\` returns the *n*-th field. A negative *n* counts from the end (PostgreSQL 14+).

\`\`\`sql
SELECT email,
       split_part(email, '@', 1)        AS local_part,
       lower(split_part(email, '@', 2)) AS domain,
       position('@' IN email)           AS at_position
FROM customers
WHERE email IS NOT NULL
ORDER BY customer_id
LIMIT 5;
\`\`\`

## Building and replacing

- Concatenate with \`||\` (NULL if any part is NULL), \`concat(a, b, …)\` (ignores NULLs), or \`concat_ws(', ', a, b)\` (with a separator, skipping NULLs).
- \`replace(s, from, to)\` replaces every occurrence of a substring. \`translate(s, 'abc', 'xyz')\` maps single characters, and deletes characters that have no counterpart.
- \`lpad(s, n, '0')\` / \`rpad\` pad to a fixed width: \`lpad('42', 6, '0')\` gives \`'000042'\`.
- \`repeat(s, n)\`, \`reverse(s)\`, \`format('%s-%s', a, b)\`.

## Regular expressions

PostgreSQL has full POSIX regular expressions:

| operator / function | meaning |
|---|---|
| \`s ~ 'pattern'\`, \`s ~* 'pattern'\` | matches (case-sensitive / case-insensitive) |
| \`s !~ 'pattern'\` | doesn't match |
| \`regexp_replace(s, pattern, repl, 'g')\` | replace matches. **\`'g'\` = every match**, not just the first |
| \`regexp_match(s, pattern)\` | the first match's capture groups, as an array (\`[1]\` for the first) |
| \`regexp_split_to_table(s, pattern)\` | one row per piece |

\`\`\`sql
SELECT phone,
       regexp_replace(phone, '[^0-9]', '', 'g') AS digits_only
FROM customers
WHERE phone IS NOT NULL
ORDER BY customer_id
LIMIT 5;
\`\`\`

Useful classes: \`\\d\` digit, \`\\D\` non-digit, \`\\s\` whitespace, \`\\m\` / \`\\M\` start / end of a word, \`^\` / \`$\` start / end of the string.

## Gotchas

- \`substring(s, 0, 3)\` returns only **2** characters: positions start at 1, and a start of 0 "uses up" one character of the length.
- \`LIKE\` is case-sensitive. Use \`ILIKE\`, \`lower()\` or \`~*\`.
- \`regexp_replace\` without \`'g'\` replaces only the **first** match.
- \`initcap\` capitalises after every non-letter: "o'brien" becomes "O'Brien", but "mcdonald" becomes "Mcdonald".
- Comparing text is exact. Normalise both sides (\`lower(trim(…))\`) before comparing or grouping.`;

const topic: Topic = {
  id: 9,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: String Functions and Operators (9.4)', url: 'https://www.postgresql.org/docs/18/functions-string.html' },
    { title: 'PostgreSQL 18: Pattern Matching, LIKE / SIMILAR TO / POSIX regex (9.7)', url: 'https://www.postgresql.org/docs/18/functions-matching.html' },
    { title: 'Neon PostgreSQL Tutorial: String Functions', url: 'https://neon.com/postgresql/postgresql-string-functions' },
    { title: 'Neon PostgreSQL Tutorial: REGEXP_REPLACE', url: 'https://neon.com/postgresql/postgresql-string-functions/regexp_replace' },
  ],
  questions: [
    {
      id: 't09-q01', topic: 9, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Tidy customer names',
      prompt: `For customers **1 to 20**, produce a tidy full name: first and last name each **trimmed** and in **initcap** (first letter of each word upper-case), joined by one space.

- **Columns:** \`customer_id\`, \`full_name\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`initcap(trim(first_name)) || \' \' || initcap(trim(last_name))`'],
      referenceSolution: `SELECT customer_id,
       initcap(trim(first_name)) || ' ' || initcap(trim(last_name)) AS full_name
FROM customers
WHERE customer_id BETWEEN 1 AND 20
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, initcap(trim(first_name) || ' ' || trim(last_name)) AS full_name FROM customers WHERE customer_id <= 20 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, initcap(first_name) || ' ' || initcap(last_name) AS full_name FROM customers WHERE customer_id BETWEEN 1 AND 20 ORDER BY customer_id;`,
        `SELECT customer_id, trim(first_name) || ' ' || trim(last_name) AS full_name FROM customers WHERE customer_id BETWEEN 1 AND 20 ORDER BY customer_id;`,
      ],
      explanation: `\`trim\` removes the stray spaces some names have, and \`initcap\` fixes 'HARUTO' and 'patel'. The order of the two calls doesn't matter here. Applying \`initcap\` to the joined string (as in the alternative) gives the same result, because initcap capitalises every word.`,
      commonMistakes: ['Forgetting trim, which leaves double spaces.', 'Forgetting to fix the capitalisation.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q02', topic: 9, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'E-mail domains',
      prompt: `For every customer **with an e-mail address**, show the **domain** (the part after \`@\`) in **lower case**, without surrounding spaces.

- **Columns:** \`customer_id\`, \`domain\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`split_part(email, \'@\', 2)` returns the text after the first @.', 'Trim before splitting, so a trailing space doesn\'t end up in the domain.'],
      referenceSolution: `SELECT customer_id, lower(split_part(trim(email), '@', 2)) AS domain
FROM customers
WHERE email IS NOT NULL
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, lower(trim(substring(email FROM position('@' IN email) + 1))) AS domain FROM customers WHERE email IS NOT NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, split_part(email, '@', 2) AS domain FROM customers WHERE email IS NOT NULL ORDER BY customer_id;`,
        `SELECT customer_id, lower(split_part(trim(email), '@', 1)) AS domain FROM customers WHERE email IS NOT NULL ORDER BY customer_id;`,
      ],
      explanation: `\`split_part(s, '@', 2)\` returns the second field when splitting on @. A few addresses are stored in upper case or with a trailing space, so normalise with \`lower(trim(…))\`. Field 1 would be the user name.`,
      commonMistakes: ['Forgetting lower/trim.', 'Taking field 1 instead of 2.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q03', topic: 9, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'Characters or bytes?',
      prompt: `What do \`length('Zoë')\` and \`octet_length('Zoë')\` return in a UTF-8 database?`,
      options: [{ text: '3 and 3' }, { text: '3 and 4' }, { text: '4 and 4' }, { text: '4 and 3' }],
      correctOption: 1,
      hints: ['ë is a single character, but it needs more than one byte in UTF-8.'],
      explanation: `\`length\` (= \`char_length\`) counts **characters**: Z, o, ë = 3. \`octet_length\` counts **bytes**. ë takes 2 bytes in UTF-8, so the total is 4. Use character length for business rules ("at most 30 characters") and byte length only for storage questions.`,
      commonMistakes: ['Assuming one byte per character.'],
    },
    {
      id: 't09-q04', topic: 9, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Trim, length and position',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT trim('  a b  ') = 'a b'  AS same,
       length('  a b  ')         AS len,
       upper('zoë')              AS up,
       position('b' IN 'abcb')   AS pos;`,
      options: [
        { table: { columns: ['same', 'len', 'up', 'pos'], rows: [['true', '3', 'ZOË', '2']] } },
        { table: { columns: ['same', 'len', 'up', 'pos'], rows: [['true', '7', 'ZOË', '2']] } },
        { table: { columns: ['same', 'len', 'up', 'pos'], rows: [['false', '7', 'ZOe', '4']] } },
        { table: { columns: ['same', 'len', 'up', 'pos'], rows: [['true', '7', 'ZOË', '4']] } },
      ],
      correctOption: 1,
      hints: ['trim removes only leading and trailing spaces.', 'length counts every character, including spaces.', 'position finds the *first* occurrence.'],
      explanation: `- \`trim\` removes the outer spaces only, so 'a b' = 'a b' is **true** (the inner space stays).
- \`length('  a b  ')\` counts all **7** characters, spaces included.
- \`upper\` handles accented letters: **ZOË**.
- \`position\` returns the first match: **2**.`,
      commonMistakes: ['Thinking trim removes inner spaces.', 'Thinking length ignores spaces.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't09-q05', topic: 9, relatedTopics: [1, 8], difficulty: 'medium', type: 'write-query',
      title: 'Split the SKU',
      prompt: `SKUs look like \`'LAP-1014'\`: a letter code, a hyphen, a number. Split every product's SKU into its two parts.

- **Columns:** \`product_id\`, \`sku\`, \`code\` (text before the hyphen), \`seq\` (the number after it, as an **integer**)
- **Sort:** by \`product_id\`.`,
      hints: ['`split_part(sku, \'-\', 1)` and `split_part(sku, \'-\', 2)`.', 'Cast the second part to integer: `::int`.'],
      referenceSolution: `SELECT product_id, sku,
       split_part(sku, '-', 1)      AS code,
       split_part(sku, '-', 2)::int AS seq
FROM products
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT product_id, sku, left(sku, position('-' IN sku) - 1) AS code, substring(sku FROM position('-' IN sku) + 1)::integer AS seq FROM products ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id, sku, left(sku, 3) AS code, right(sku, 3)::int AS seq FROM products ORDER BY product_id;`,
        `SELECT product_id, sku, split_part(sku, '-', 2) AS code, split_part(sku, '-', 1)::int AS seq FROM products ORDER BY product_id;`,
      ],
      explanation: `\`split_part\` handles variable-length parts. \`left(sku, 3)\` / \`right(sku, 3)\` assume fixed widths: the number has 4 digits, so \`right(…, 3)\` cuts one off.

Cast the number part to integer: as text it would sort and compare alphabetically ('9' > '10'), and you couldn't calculate with it.`,
      commonMistakes: ['Fixed-width cuts.', 'Mixing up the field numbers.', 'Leaving the number as text.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q06', topic: 9, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Phone numbers as digits only',
      prompt: `Phone numbers are stored in many formats (\`'+1 956 303 8604'\`, \`'(631) 987-1445'\`, \`'760.552.9971'\`, …). For every customer with a phone, return the number with **every non-digit character removed**.

- **Columns:** \`customer_id\`, \`digits\`
- **Sort:** by \`customer_id\`.`,
      hints: ['`regexp_replace(phone, \'\\D\', \'\', …)`: `\\D` matches a non-digit.', 'By default only the first match is replaced. Which flag replaces all of them?'],
      referenceSolution: `SELECT customer_id, regexp_replace(phone, '\\D', '', 'g') AS digits
FROM customers
WHERE phone IS NOT NULL
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, regexp_replace(phone, '[^0-9]+', '', 'g') AS digits FROM customers WHERE phone IS NOT NULL ORDER BY 1;`, `SELECT customer_id, translate(phone, '+()-. ', '') AS digits FROM customers WHERE phone IS NOT NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, regexp_replace(phone, '\\D', '') AS digits FROM customers WHERE phone IS NOT NULL ORDER BY customer_id;`,
        `SELECT customer_id, replace(phone, ' ', '') AS digits FROM customers WHERE phone IS NOT NULL ORDER BY customer_id;`,
      ],
      explanation: `\`regexp_replace(s, pattern, replacement, 'g')\`: \`\\D\` (or \`[^0-9]\`) matches any non-digit, and the empty replacement deletes it. Without the **\`g\`** (global) flag, only the *first* non-digit is removed.

\`translate(phone, '+()-. ', '')\` also works here, because it deletes each listed character. It breaks as soon as a new kind of separator turns up, though.`,
      commonMistakes: ['Forgetting the g flag.', 'Only removing spaces.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q07', topic: 9, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Reviews that mention the battery',
      prompt: `Find reviews whose **body** mentions **"battery"** in any capitalisation ("Battery", "BATTERY", …).

- **Columns:** \`review_id\`, \`rating\`
- **Sort:** by \`review_id\`.`,
      hints: ['Case-insensitive matching: `ILIKE \'%battery%\'` or `~* \'battery\'`.'],
      referenceSolution: `SELECT review_id, rating
FROM reviews
WHERE body ILIKE '%battery%'
ORDER BY review_id;`,
      alternativeSolutions: [`SELECT review_id, rating FROM reviews WHERE body ~* 'battery' ORDER BY 1;`, `SELECT review_id, rating FROM reviews WHERE position('battery' IN lower(body)) > 0 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT review_id, rating FROM reviews WHERE body LIKE '%battery%' ORDER BY review_id;`,
        `SELECT review_id, rating FROM reviews WHERE body ILIKE 'battery%' ORDER BY review_id;`,
      ],
      explanation: `Most reviews write "Battery life …" with a capital B, so a case-sensitive LIKE misses most of them. ILIKE, \`~*\` or \`lower()\` make the search case-insensitive. Reviews without a body (NULL) never match, which is fine here.`,
      commonMistakes: ['Case-sensitive LIKE.', 'Anchoring the pattern at the start.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q08', topic: 9, relatedTopics: [1, 4, 8], difficulty: 'medium', type: 'write-query',
      title: 'Invoice numbers',
      prompt: `Generate invoice numbers for orders placed in **June 2025**: \`'INV-'\` followed by the order id **padded with zeros to 6 digits**, e.g. order 7461 becomes \`INV-007461\`.

- **Columns:** \`order_id\`, \`invoice_no\`
- **Sort:** by \`order_id\`.`,
      hints: ['`lpad(order_id::text, 6, \'0\')`'],
      referenceSolution: `SELECT order_id, 'INV-' || lpad(order_id::text, 6, '0') AS invoice_no
FROM orders
WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01'
ORDER BY order_id;`,
      alternativeSolutions: [`SELECT order_id, 'INV-' || to_char(order_id, 'FM000000') AS invoice_no FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT order_id, 'INV-' || rpad(order_id::text, 6, '0') AS invoice_no FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY order_id;`,
        `SELECT order_id, 'INV-' || lpad(order_id::text, 5, '0') AS invoice_no FROM orders WHERE ordered_at >= '2025-06-01' AND ordered_at < '2025-07-01' ORDER BY order_id;`,
      ],
      explanation: `\`lpad(text, 6, '0')\` adds zeros on the **left** until the string is 6 characters long. \`rpad\` pads on the right and changes the number. \`to_char(order_id, 'FM000000')\` (Topic 8) is an alternative: each \`0\` is a mandatory digit.

Careful: lpad *truncates* strings that are already longer than the target width.`,
      commonMistakes: ['Padding on the right.', 'Wrong width.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q09', topic: 9, relatedTopics: [1], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: three-letter category codes',
      prompt: `This query should show each category's **first three slug letters in upper case** (\`'electronics'\` becomes \`'ELE'\`), but the codes come out with only two letters. Fix it.

- **Columns:** \`category_id\`, \`slug\`, \`code\`
- **Sort:** by \`category_id\`.`,
      starterSql: `SELECT category_id, slug, upper(substring(slug, 0, 3)) AS code
FROM categories
ORDER BY category_id;`,
      hints: ['At which position does the first character of a string sit in SQL?'],
      referenceSolution: `SELECT category_id, slug, upper(substring(slug, 1, 3)) AS code
FROM categories
ORDER BY category_id;`,
      alternativeSolutions: [`SELECT category_id, slug, upper(left(slug, 3)) AS code FROM categories ORDER BY 1;`],
      wrongAnswers: [`SELECT category_id, slug, upper(substring(slug, 2, 3)) AS code FROM categories ORDER BY category_id;`],
      explanation: `SQL strings are **1-based**: the first character is at position 1. \`substring(s, 0, 3)\` covers positions 0, 1 and 2, and position 0 doesn't exist, so only two characters come back.

Start at 1, or use \`left(slug, 3)\`, which says exactly what you mean. (\`substring(slug, 0, 4)\` would also produce the right codes, but it only works by compensating one off-by-one error with another.)`,
      commonMistakes: ['Thinking positions start at 0, as in most programming languages.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't09-q10', topic: 9, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: '“Last, First” to “First Last”',
      prompt: `In \`staging_customer_import\`, some names in \`full_name\` are written **\`'Last, First'\`** (with a comma). For **every row whose \`full_name\` contains a comma**, rewrite it as **\`'First Last'\`**: trimmed parts, one space between.

- **Columns:** \`import_row_id\`, \`full_name\`, \`fixed_name\`
- **Sort:** by \`import_row_id\`.`,
      hints: ['`split_part(full_name, \',\', 1)` is the last name and part 2 the first name.', 'Trim each part. Some have extra spaces.'],
      referenceSolution: `SELECT import_row_id, full_name,
       trim(split_part(full_name, ',', 2)) || ' ' || trim(split_part(full_name, ',', 1)) AS fixed_name
FROM staging_customer_import
WHERE full_name LIKE '%,%'
ORDER BY import_row_id;`,
      alternativeSolutions: [`SELECT import_row_id, full_name, concat_ws(' ', trim(substring(full_name FROM position(',' IN full_name) + 1)), trim(left(full_name, position(',' IN full_name) - 1))) AS fixed_name FROM staging_customer_import WHERE position(',' IN full_name) > 0 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT import_row_id, full_name, split_part(full_name, ',', 2) || ' ' || split_part(full_name, ',', 1) AS fixed_name FROM staging_customer_import WHERE full_name LIKE '%,%' ORDER BY import_row_id;`,
        `SELECT import_row_id, full_name, replace(full_name, ',', '') AS fixed_name FROM staging_customer_import WHERE full_name LIKE '%,%' ORDER BY import_row_id;`,
      ],
      explanation: `\`split_part\` on the comma gives "Last" (field 1) and " First" (field 2, usually with a leading space). Swap them, trim each part, and join with a single space. Without trim you'd get a leading space and double spaces. Just deleting the comma keeps the wrong order.`,
      commonMistakes: ['Not trimming the parts.', 'Removing the comma without swapping.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q11', topic: 9, relatedTopics: [1, 4, 6], difficulty: 'hard', type: 'write-query',
      title: 'Same e-mail, different spelling',
      prompt: `Some customers registered twice with the **same e-mail address written differently** (case or surrounding spaces). Find pairs of **different customers** whose \`lower(trim(email))\` is equal **but whose raw \`email\` values differ**.

- **Columns:** \`customer_a\`, \`customer_b\` (with \`customer_a < customer_b\`), \`email_a\`, \`email_b\`
- **Sort:** by \`customer_a\`, then \`customer_b\`.`,
      hints: ['Self-join customers on the normalised e-mail.', 'Keep pairs where the raw values differ, and use `<` to list each pair once.'],
      referenceSolution: `SELECT a.customer_id AS customer_a, b.customer_id AS customer_b, a.email AS email_a, b.email AS email_b
FROM customers a
JOIN customers b
  ON lower(trim(b.email)) = lower(trim(a.email))
 AND a.customer_id < b.customer_id
WHERE a.email <> b.email
ORDER BY customer_a, customer_b;`,
      alternativeSolutions: [`SELECT a.customer_id AS customer_a, b.customer_id AS customer_b, a.email AS email_a, b.email AS email_b FROM customers a, customers b WHERE lower(trim(a.email)) = lower(trim(b.email)) AND a.email IS DISTINCT FROM b.email AND a.customer_id < b.customer_id ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT a.customer_id AS customer_a, b.customer_id AS customer_b, a.email AS email_a, b.email AS email_b FROM customers a JOIN customers b ON lower(trim(b.email)) = lower(trim(a.email)) AND a.customer_id <> b.customer_id WHERE a.email <> b.email ORDER BY customer_a, customer_b;`,
        `SELECT a.customer_id AS customer_a, b.customer_id AS customer_b, a.email AS email_a, b.email AS email_b FROM customers a JOIN customers b ON lower(trim(b.email)) = lower(trim(a.email)) AND a.customer_id < b.customer_id ORDER BY customer_a, customer_b;`,
      ],
      explanation: `Normalise in the join condition: \`lower(trim(email))\` on both sides makes 'Anna@x.com ' and 'anna@x.com' equal. \`a.customer_id < b.customer_id\` keeps each pair once. The final \`a.email <> b.email\` keeps only pairs that are spelled *differently*. Without it, you also get customers who share an identical address.

Without trim, the variants with a trailing space are missed. NULL e-mails never pair up, because NULL = NULL is not true.`,
      commonMistakes: ['Normalising case but not whitespace.', 'Using <> instead of <, which lists every pair twice.', 'Including identical spellings.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q12', topic: 9, relatedTopics: [1, 4, 8], difficulty: 'hard', type: 'write-query',
      title: 'Screen sizes from product names',
      prompt: `Many product names contain a size in inches, like \`Laptop 15.6"\` or \`Monitor 27"\` (a number directly followed by \`"\`). For products whose name contains such a size, extract it as a **numeric** value.

- **Columns:** \`product_id\`, \`name\`, \`inches\`
- **Sort:** by \`product_id\`.`,
      hints: ['`regexp_match(name, \'(\\d+(\\.\\d+)?)"\')` returns the capture groups as an array, or NULL if there is no match.', 'Take the first element with `[1]` and cast it to numeric. Filter with `name ~ \'\\d"\'`.'],
      referenceSolution: `SELECT product_id, name,
       (regexp_match(name, '(\\d+(?:\\.\\d+)?)"'))[1]::numeric AS inches
FROM products
WHERE name ~ '\\d"'
ORDER BY product_id;`,
      alternativeSolutions: [`SELECT product_id, name, substring(name FROM '(\\d+\\.?\\d*)"')::numeric AS inches FROM products WHERE name LIKE '%"%' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT product_id, name, (regexp_match(name, '(\\d+)"'))[1]::numeric AS inches FROM products WHERE name ~ '\\d"' ORDER BY product_id;`,
        `SELECT product_id, name, (regexp_match(name, '(\\d+(?:\\.\\d+)?)'))[1]::numeric AS inches FROM products WHERE name ~ '\\d"' ORDER BY product_id;`,
      ],
      explanation: `The pattern \`(\\d+(?:\\.\\d+)?)"\` means: digits, optionally a dot and more digits, captured in group 1, followed by a literal quote. \`regexp_match\` returns the groups as a text array, so \`[1]\` is the number.

- \`(\\d+)"\` misses the decimal part (15.6 becomes 6).
- Without the \`"\` anchor, the first number in the name wins, which may be a model number such as "500".

\`substring(s FROM pattern)\` returns the first capture group directly.`,
      commonMistakes: ['Ignoring decimal sizes.', 'Matching any number instead of the one before the inch mark.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q13', topic: 9, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Coupon codes, normalised',
      prompt: `Customers typed coupon codes inconsistently: \`'welcome10'\`, \`' WELCOME10'\`, \`'free-ship'\`, \`'BlackFriday'\`, …

List the **distinct normalised codes**, where normalising means: trim, upper-case, and remove hyphens.

- **Columns:** \`code\`
- **Sort:** by \`code\`.`,
      hints: ['`upper(replace(trim(coupon_code), \'-\', \'\'))`', 'Exclude orders without a coupon.'],
      referenceSolution: `SELECT DISTINCT upper(replace(trim(coupon_code), '-', '')) AS code
FROM orders
WHERE coupon_code IS NOT NULL
ORDER BY code;`,
      alternativeSolutions: [`SELECT upper(translate(trim(coupon_code), '-', '')) AS code FROM orders WHERE coupon_code IS NOT NULL GROUP BY 1 ORDER BY 1;`],
      wrongAnswers: [
        `SELECT DISTINCT upper(trim(coupon_code)) AS code FROM orders WHERE coupon_code IS NOT NULL ORDER BY code;`,
        `SELECT DISTINCT upper(replace(coupon_code, '-', '')) AS code FROM orders WHERE coupon_code IS NOT NULL ORDER BY code;`,
      ],
      explanation: `Each normalisation step removes one kind of variation: \`trim\` (spaces), \`upper\` (case), \`replace(…, '-', '')\` (hyphens). Then DISTINCT collapses the variants: 11 raw spellings become 6 real codes.

Skipping any one step leaves duplicates such as 'FREE-SHIP' / 'FREESHIP', or ' WELCOME10' / 'WELCOME10'.`,
      commonMistakes: ['Forgetting the hyphen.', 'Forgetting to trim.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't09-q14', topic: 9, relatedTopics: [1], difficulty: 'hard', type: 'predict-output',
      title: 'Cutting strings',
      prompt: `What does this query return?`,
      referenceSolution: `SELECT split_part('a.b.c', '.', -1)         AS a,
       left('abcdef', -2)                     AS b,
       right('abcdef', 2)                     AS c,
       substring('abcdef' FROM 2 FOR 3)       AS d;`,
      options: [
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['c', 'abcd', 'ef', 'bcd']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['a', 'ef', 'ef', 'bcd']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [['c', 'ab', 'ef', 'cde']] } },
        { table: { columns: ['a', 'b', 'c', 'd'], rows: [[null, 'abcd', 'ef', 'bc']] } },
      ],
      correctOption: 0,
      hints: ['A negative field number in split_part counts from the end.', '`left(s, -n)` means "all but the last n characters".'],
      explanation: `- \`split_part(…, -1)\` is the **last** field: 'c' (PostgreSQL 14+).
- \`left('abcdef', -2)\` drops the last 2 characters: 'abcd'.
- \`right('abcdef', 2)\` is the last 2: 'ef'.
- \`substring(… FROM 2 FOR 3)\` is 3 characters starting at position 2: 'bcd'.`,
      commonMistakes: ['Not knowing negative arguments.', 'Counting positions from 0.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't09-q15', topic: 9, relatedTopics: [1, 4], difficulty: 'interview', type: 'write-query',
      title: 'Masked e-mail addresses',
      prompt: `For a support screen, mask customers' e-mails: keep the **first character of the user name**, then \`***\`, then \`@\` and the full **domain**, everything **lower case and trimmed**. For example \`' Anna.Kim@Gmail.com'\` becomes \`a***@gmail.com\`.

For customers **1 to 30** with an e-mail address.

- **Columns:** \`customer_id\`, \`masked_email\`
- **Sort:** by \`customer_id\`.`,
      hints: ['Normalise first: `lower(trim(email))`.', 'First character: `left(…, 1)`. Domain: `split_part(…, \'@\', 2)`.'],
      referenceSolution: `SELECT customer_id,
       left(lower(trim(email)), 1) || '***@' || split_part(lower(trim(email)), '@', 2) AS masked_email
FROM customers
WHERE customer_id BETWEEN 1 AND 30
  AND email IS NOT NULL
ORDER BY customer_id;`,
      alternativeSolutions: [`SELECT customer_id, regexp_replace(lower(trim(email)), '^(.)[^@]*', '\\1***') AS masked_email FROM customers WHERE customer_id <= 30 AND email IS NOT NULL ORDER BY 1;`],
      wrongAnswers: [
        `SELECT customer_id, left(email, 1) || '***@' || split_part(email, '@', 2) AS masked_email FROM customers WHERE customer_id BETWEEN 1 AND 30 AND email IS NOT NULL ORDER BY customer_id;`,
        `SELECT customer_id, left(lower(trim(email)), 1) || '***' || split_part(lower(trim(email)), '@', 2) AS masked_email FROM customers WHERE customer_id BETWEEN 1 AND 30 AND email IS NOT NULL ORDER BY customer_id;`,
      ],
      explanation: `Build the result from normalised pieces: the first character, a fixed mask, the @ and the domain. The regex alternative captures the first character (\`^(.)\`), matches the rest of the user name (\`[^@]*\`), and replaces both with the captured character plus \`***\`. \`\\1\` refers back to group 1.

Normalising first matters: without \`trim\`, an address with a leading space would show the space as its "first character".`,
      commonMistakes: ['Not normalising.', 'Dropping the @ sign.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't09-q16', topic: 9, relatedTopics: [1, 4], previewTopics: [14], difficulty: 'interview', type: 'write-query',
      title: 'Most common words in review titles',
      prompt: `Which words appear most often in review **titles**? Split titles into words on anything that isn't a letter, lower-case them, and count only words of **at least 4 letters**. Return the **10 most frequent** words.

- **Columns:** \`word\`, \`uses\`
- **Sort:** by \`uses\` (highest first), then \`word\`. 10 rows.`,
      hints: ['`regexp_split_to_table(lower(title), \'[^a-z]+\')` turns each title into one row per word.', 'Filter `length(word) >= 4`, then GROUP BY word and count (Topic 14).'],
      referenceSolution: `SELECT word, count(*) AS uses
FROM reviews,
     regexp_split_to_table(lower(title), '[^a-z]+') AS word
WHERE length(word) >= 4
GROUP BY word
ORDER BY uses DESC, word
LIMIT 10;`,
      alternativeSolutions: [
        `SELECT w AS word, count(*) AS uses FROM (SELECT unnest(string_to_array(regexp_replace(lower(title), '[^a-z]+', ' ', 'g'), ' ')) AS w FROM reviews WHERE title IS NOT NULL) t WHERE length(w) >= 4 GROUP BY w ORDER BY 2 DESC, 1 LIMIT 10;`,
      ],
      wrongAnswers: [
        `SELECT word, count(*) AS uses FROM reviews, regexp_split_to_table(title, '[^a-zA-Z]+') AS word WHERE length(word) >= 4 GROUP BY word ORDER BY uses DESC, word LIMIT 10;`,
        `SELECT word, count(*) AS uses FROM reviews, regexp_split_to_table(lower(title), '[^a-z]+') AS word WHERE length(word) > 4 GROUP BY word ORDER BY uses DESC, word LIMIT 10;`,
      ],
      explanation: `A classic text-analytics question:

1. **Tokenise:** \`regexp_split_to_table(lower(title), '[^a-z]+')\` splits on every run of non-letters and returns one row per word. Used in FROM with a comma, it runs once per review (an implicit LATERAL join).
2. **Filter** short words, which also drops the empty strings produced at the edges.
3. **Count** per word and take the top 10, with the word as tie-breaker.

Splitting only on spaces leaves punctuation attached ("excellent!" ≠ "excellent"). Not lower-casing counts "AMAZING" and "amazing" separately. And "at least 4 letters" is \`>= 4\`: words like "good" and "love" count.`,
      commonMistakes: ['Not lower-casing.', 'Splitting only on spaces.', 'Using > 4 instead of >= 4.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
