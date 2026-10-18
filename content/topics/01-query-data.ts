import type { Topic } from '../types.ts';

const explanation = `\`SELECT\` reads rows from tables and shapes the result: which columns, computed how, in which order and how many. This topic covers the parts of a query that don't filter rows. Filtering with \`WHERE\` comes in Topic 4.

\`\`\`text
SELECT [DISTINCT | DISTINCT ON (…)] expression [AS alias], …
FROM table [AS t]
ORDER BY expression [ASC | DESC] [NULLS FIRST | NULLS LAST], …
LIMIT n OFFSET m        -- or: OFFSET m ROWS FETCH FIRST n ROWS ONLY | WITH TIES
\`\`\`

## Columns, expressions and aliases

- \`SELECT *\` returns every column. It's handy for exploring, but name the columns in real queries so the result doesn't change when the table does.
- Any expression can be a column: arithmetic (\`price - cost\`), concatenation (\`first_name || ' ' || last_name\`), constants, function calls.
- \`AS\` gives a column its name. Unquoted identifiers are folded to lower case. Use double quotes for names with spaces or capitals: \`AS "Full name"\`. Single quotes are for **string values**, never for names.
- A table alias (\`FROM products AS p\`) shortens qualified names: \`p.price\`.
- \`SELECT\` works without \`FROM\` too: \`SELECT 2 + 3 AS five;\`

\`\`\`sql
SELECT sku,
       name AS product,
       price,
       cost,
       price - cost AS margin
FROM products
ORDER BY product_id
LIMIT 5;
\`\`\`

Arithmetic with NULL gives NULL: products with an unknown \`cost\` have an unknown \`margin\`.

## DISTINCT and DISTINCT ON

\`SELECT DISTINCT\` removes duplicate **rows** from the result. It looks at all selected columns together. Two NULLs count as duplicates here.

\`\`\`sql
SELECT DISTINCT region, currency
FROM countries
ORDER BY region, currency;
\`\`\`

PostgreSQL also has \`DISTINCT ON (expr)\`. It keeps only the **first row of each group** of equal \`expr\` values, where "first" is decided by \`ORDER BY\`. The ORDER BY must start with the DISTINCT ON expressions.

\`\`\`sql
-- The cheapest product in each category
SELECT DISTINCT ON (category_id) category_id, product_id, name, price
FROM products
ORDER BY category_id, price, product_id;
\`\`\`

## ORDER BY

Without \`ORDER BY\`, PostgreSQL returns rows in whatever order is convenient, and that order can change. If order matters, say so.

- Several keys: \`ORDER BY price DESC, product_id\`. The second key only breaks ties of the first.
- You can sort by an output alias (\`ORDER BY margin\`), a column position (\`ORDER BY 2\`), or any expression.
- **NULLs sort last in ascending order and first in descending order.** Override with \`NULLS FIRST\` / \`NULLS LAST\`.
- With \`SELECT DISTINCT\`, you can only ORDER BY expressions that appear in the select list.

\`\`\`sql
SELECT product_id, price - cost AS margin
FROM products
ORDER BY margin DESC NULLS LAST, product_id
LIMIT 5;
\`\`\`

## LIMIT, OFFSET and FETCH

- \`LIMIT n\` keeps the first *n* rows, and \`OFFSET m\` skips *m* rows first. Page *k* of size *s* is \`LIMIT s OFFSET (k - 1) * s\`.
- Always combine LIMIT with an ORDER BY that has a **unique tie-breaker**. Otherwise "the first 10" is not well defined.
- The SQL-standard spelling is \`OFFSET m ROWS FETCH FIRST n ROWS ONLY\`. \`FETCH FIRST n ROWS WITH TIES\` also returns every row that ties with the last one (it needs an ORDER BY).

\`\`\`sql
-- The 5 cheapest prices, plus anything tied with the 5th
SELECT product_id, name, price
FROM products
ORDER BY price
FETCH FIRST 5 ROWS WITH TIES;
\`\`\`

## The order in which a query is evaluated

You *write* \`SELECT … FROM … ORDER BY … LIMIT\`, but PostgreSQL logically evaluates:

1. \`FROM\` (and joins), then \`WHERE\`, \`GROUP BY\` and \`HAVING\` (later topics),
2. \`SELECT\`: compute the expressions and aliases,
3. \`DISTINCT\`,
4. \`ORDER BY\`, which can therefore use the aliases from step 2,
5. \`LIMIT\` / \`OFFSET\`.

## Gotchas

- \`'text'\` is a string and \`"text"\` is an identifier. \`SELECT "price" FROM products\` works, while \`SELECT 'price' FROM products\` returns the word *price* on every row.
- \`OFFSET\` paging gets slower on deep pages, because skipped rows are still read. It's fine for our small tables.
- Text sorts by the database collation, and capital letters, spaces and accents affect the order. Our customer names are deliberately messy.`;

const topic: Topic = {
  id: 1,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Select Lists (7.3), including DISTINCT and DISTINCT ON', url: 'https://www.postgresql.org/docs/18/queries-select-lists.html' },
    { title: 'PostgreSQL 18: Sorting Rows, ORDER BY (7.5)', url: 'https://www.postgresql.org/docs/18/queries-order.html' },
    { title: 'PostgreSQL 18: LIMIT and OFFSET (7.6)', url: 'https://www.postgresql.org/docs/18/queries-limit.html' },
    { title: 'PostgreSQL 18 Reference: SELECT', url: 'https://www.postgresql.org/docs/18/sql-select.html' },
    { title: 'PGExercises: Basic queries (practice set)', url: 'https://pgexercises.com/questions/basic/' },
  ],
  questions: [
    {
      id: 't01-q01', topic: 1, relatedTopics: [], difficulty: 'easy', type: 'write-query',
      title: 'List the departments',
      prompt: `List every department with its id, name and location, sorted alphabetically by name.

- **Columns:** \`department_id\`, \`name\`, \`location\`
- **Sort:** by \`name\`.`,
      hints: ['All three columns are in the `departments` table.', 'Sort with `ORDER BY name`.'],
      referenceSolution: `SELECT department_id, name, location
FROM departments
ORDER BY name;`,
      alternativeSolutions: [`SELECT d.department_id, d.name, d.location FROM departments AS d ORDER BY 2 ASC;`],
      wrongAnswers: [
        `SELECT department_id, name, location FROM departments ORDER BY department_id;`,
        `SELECT department_id, name FROM departments ORDER BY name;`,
      ],
      explanation: `1. \`FROM departments\` picks the table.
2. The select list names the three columns in the requested order.
3. \`ORDER BY name\` sorts alphabetically. Ascending is the default, so \`ASC\` is optional.

Departments without a location show NULL in that column. They are still listed, because nothing filters rows here.`,
      commonMistakes: ['Forgetting ORDER BY. Without it, the row order is not guaranteed.', 'Listing the columns in a different order than requested.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't01-q02', topic: 1, relatedTopics: [], difficulty: 'easy', type: 'write-query',
      title: 'Product price list',
      prompt: `Produce a price list of all products. Show the price under the name **\`list_price\`**.

- **Columns:** \`sku\`, \`name\`, \`list_price\`
- **Sort:** most expensive first. Products with the same price are ordered by \`sku\`.`,
      hints: ['Rename a column with `AS`: `price AS list_price`.', 'Sort by two keys: `ORDER BY price DESC, sku`.'],
      referenceSolution: `SELECT sku, name, price AS list_price
FROM products
ORDER BY list_price DESC, sku;`,
      alternativeSolutions: [`SELECT sku, name, price list_price FROM products ORDER BY price DESC, sku ASC;`],
      wrongAnswers: [
        `SELECT sku, name, price AS list_price FROM products ORDER BY list_price, sku;`,
        `SELECT sku, name, price FROM products ORDER BY price DESC, sku;`,
        `SELECT sku, name, price AS list_price FROM products ORDER BY list_price DESC, name;`,
      ],
      explanation: `1. \`price AS list_price\` renames the output column. \`AS\` is optional, but it makes the intent clear.
2. \`ORDER BY list_price DESC\` puts the most expensive first. ORDER BY may use the alias, because it's evaluated after SELECT.
3. Many products share a price, so \`sku\` breaks those ties.`,
      commonMistakes: ['Forgetting DESC, which gives cheapest first.', 'Not naming the column `list_price`.', 'Breaking ties by name instead of sku.'],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't01-q03', topic: 1, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'Which clause runs last?',
      prompt: `In this query, which clause is **logically evaluated last**?

\`\`\`sql
SELECT DISTINCT price AS p FROM products ORDER BY p DESC LIMIT 3;
\`\`\``,
      options: [{ text: '`FROM`' }, { text: '`SELECT` (computing `p`)' }, { text: '`ORDER BY`' }, { text: '`LIMIT`' }],
      correctOption: 3,
      hints: ['ORDER BY can use the alias `p`, so it must come after SELECT. What still has to happen after sorting?'],
      explanation: `The logical order is FROM → SELECT (expressions and aliases) → DISTINCT → ORDER BY → LIMIT.

LIMIT must come after ORDER BY: "the first 3 rows" only means something once the rows are sorted. That's also why ORDER BY can use the alias \`p\` defined in SELECT.`,
      commonMistakes: ['Assuming clauses run in the order they are written. SELECT is written first but evaluated after FROM.'],
    },
    {
      id: 't01-q04', topic: 1, relatedTopics: [], difficulty: 'easy', type: 'predict-output',
      title: 'DISTINCT and NULL',
      prompt: `Predict the result of this query.`,
      referenceSolution: `SELECT DISTINCT x
FROM (VALUES (2), (NULL), (2), (1), (NULL)) AS t(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x'], rows: [[null], ['1'], ['2']] } },
        { table: { columns: ['x'], rows: [['1'], ['2'], [null]] } },
        { table: { columns: ['x'], rows: [['1'], ['2']] } },
        { table: { columns: ['x'], rows: [['1'], ['2'], [null], [null]] } },
      ],
      correctOption: 1,
      hints: ['For DISTINCT, two NULLs count as duplicates.', 'In ascending order, where do NULLs go by default?'],
      explanation: `- DISTINCT keeps one copy of each value. Two NULLs are treated as duplicates here, so one NULL remains.
- Ascending order puts NULLs **last** by default in PostgreSQL.

So the result is 1, 2, NULL. \`(VALUES …) AS t(x)\` is a tiny inline table with one column named \`x\`.`,
      commonMistakes: ['Thinking DISTINCT removes NULLs. It keeps one.', 'Expecting NULLs first in ascending order (other databases differ).'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't01-q05', topic: 1, relatedTopics: [], difficulty: 'medium', type: 'write-query',
      title: 'Region and currency combinations',
      prompt: `Which combinations of **region** and **currency** occur in the \`countries\` table? List each combination once.

- **Columns:** \`region\`, \`currency\`
- **Sort:** by \`region\`, then \`currency\`.`,
      hints: ['DISTINCT applies to the whole row: both columns together.'],
      referenceSolution: `SELECT DISTINCT region, currency
FROM countries
ORDER BY region, currency;`,
      alternativeSolutions: [`SELECT DISTINCT ON (region, currency) region, currency FROM countries ORDER BY region, currency;`],
      wrongAnswers: [
        `SELECT region, currency FROM countries ORDER BY region, currency;`,
        `SELECT DISTINCT region FROM countries ORDER BY region;`,
      ],
      explanation: `\`SELECT DISTINCT region, currency\` removes rows whose region *and* currency are both equal to another row's. Europe appears with EUR, GBP, SEK and more. Each pair appears once.

Without DISTINCT you get one row per country (34 rows), with many repeated pairs.`,
      commonMistakes: ['Selecting only region, which loses the currency dimension.', 'Forgetting DISTINCT.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't01-q06', topic: 1, relatedTopics: [], difficulty: 'medium', type: 'write-query',
      title: 'The ten most expensive products',
      prompt: `Show the **10 most expensive products**. When prices are equal, the lower \`product_id\` comes first.

- **Columns:** \`product_id\`, \`name\`, \`price\`
- **Sort:** by \`price\` (highest first), then \`product_id\`. Exactly 10 rows.`,
      hints: ['Sort, then keep the first rows with LIMIT.', '`ORDER BY price DESC, product_id LIMIT 10`'],
      referenceSolution: `SELECT product_id, name, price
FROM products
ORDER BY price DESC, product_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT product_id, name, price FROM products ORDER BY 3 DESC, 1 FETCH FIRST 10 ROWS ONLY;`],
      wrongAnswers: [
        `SELECT product_id, name, price FROM products ORDER BY price, product_id LIMIT 10;`,
        `SELECT product_id, name, price FROM products ORDER BY price DESC, product_id LIMIT 10 OFFSET 1;`,
      ],
      explanation: `\`ORDER BY price DESC, product_id\` puts the most expensive first and makes tied prices deterministic. \`LIMIT 10\` then keeps the first ten.

\`FETCH FIRST 10 ROWS ONLY\` is the SQL-standard spelling of the same thing.`,
      commonMistakes: ['Applying LIMIT without ORDER BY. The "first 10" is then arbitrary.', 'Sorting ascending, which gives the cheapest products.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't01-q07', topic: 1, relatedTopics: [], difficulty: 'medium', type: 'write-query',
      title: 'Largest margins (unknown costs last)',
      prompt: `The margin of a product is \`price - cost\`. Some products have no recorded \`cost\`, so their margin is unknown (NULL).

Show the **15 products with the largest margin**. Products with an unknown margin must come **after** all known ones. Equal margins are ordered by \`product_id\`.

- **Columns:** \`product_id\`, \`price\`, \`cost\`, \`margin\`
- **Sort:** margin highest first with NULLs last, then \`product_id\`. 15 rows.`,
      hints: ['`price - cost AS margin` is NULL when cost is NULL.', 'In descending order PostgreSQL puts NULLs **first**. Add `NULLS LAST`.'],
      referenceSolution: `SELECT product_id, price, cost, price - cost AS margin
FROM products
ORDER BY margin DESC NULLS LAST, product_id
LIMIT 15;`,
      alternativeSolutions: [`SELECT product_id, price, cost, price - cost AS margin FROM products ORDER BY price - cost DESC NULLS LAST, 1 LIMIT 15;`],
      wrongAnswers: [
        `SELECT product_id, price, cost, price - cost AS margin FROM products ORDER BY margin DESC, product_id LIMIT 15;`,
        `SELECT product_id, price, cost, cost - price AS margin FROM products ORDER BY margin DESC NULLS LAST, product_id LIMIT 15;`,
      ],
      explanation: `1. \`price - cost AS margin\` computes the margin. Anything minus NULL is NULL.
2. PostgreSQL treats NULL as *larger* than every value when sorting, so in \`DESC\` order the NULL margins come first and fill your top 15.
3. \`NULLS LAST\` moves them to the end. The \`product_id\` tie-breaker makes the order deterministic.`,
      commonMistakes: ['Sorting `DESC` without `NULLS LAST`, so unknown margins head the list.', 'Computing cost − price, which flips the sign.'],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't01-q08', topic: 1, relatedTopics: [], difficulty: 'medium', type: 'write-query',
      title: 'Third page of the catalogue',
      prompt: `The online catalogue lists products alphabetically by \`name\` (ties by \`product_id\`), 20 per page. Return **page 3**.

- **Columns:** \`product_id\`, \`name\`
- **Sort:** by \`name\`, then \`product_id\`. At most 20 rows.`,
      hints: ['Page 3 skips pages 1 and 2: that is 2 × 20 rows.', '`LIMIT 20 OFFSET 40`'],
      referenceSolution: `SELECT product_id, name
FROM products
ORDER BY name, product_id
LIMIT 20 OFFSET 40;`,
      alternativeSolutions: [`SELECT product_id, name FROM products ORDER BY name, product_id OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY;`],
      wrongAnswers: [
        `SELECT product_id, name FROM products ORDER BY name, product_id LIMIT 20 OFFSET 60;`,
        `SELECT product_id, name FROM products ORDER BY name, product_id LIMIT 20 OFFSET 2;`,
      ],
      explanation: `Page *k* with page size *s* skips \`(k − 1) × s\` rows: \`OFFSET 40\`, then \`LIMIT 20\`.

The sort must be the same as for the earlier pages and must include a unique tie-breaker. Otherwise products could appear on two pages, or on none.`,
      commonMistakes: ['Using OFFSET 60 (that is page 4) or OFFSET 2 (that counts pages, not rows).', 'Paging without a deterministic ORDER BY.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't01-q09', topic: 1, relatedTopics: [], difficulty: 'medium', type: 'write-query',
      title: 'Full names of the first customers',
      prompt: `Show the **25 earliest customers to sign up** with their full name: \`first_name\`, a single space, then \`last_name\`. Keep the names exactly as stored, messy spacing and capitalisation included.

- **Columns:** \`customer_id\`, \`full_name\`, \`signup_at\`
- **Sort:** by \`signup_at\`, then \`customer_id\`. 25 rows.`,
      hints: ['`||` concatenates text: `first_name || \' \' || last_name`.'],
      referenceSolution: `SELECT customer_id,
       first_name || ' ' || last_name AS full_name,
       signup_at
FROM customers
ORDER BY signup_at, customer_id
LIMIT 25;`,
      alternativeSolutions: [`SELECT customer_id, concat(first_name, ' ', last_name) AS full_name, signup_at FROM customers ORDER BY 3, 1 LIMIT 25;`],
      wrongAnswers: [
        `SELECT customer_id, first_name || last_name AS full_name, signup_at FROM customers ORDER BY signup_at, customer_id LIMIT 25;`,
        `SELECT customer_id, first_name || ' ' || last_name AS full_name, signup_at FROM customers ORDER BY signup_at DESC, customer_id LIMIT 25;`,
      ],
      explanation: `\`||\` joins strings: \`first_name || ' ' || last_name\`. The space is a string literal in single quotes.

\`concat(…)\` does the same, and it also treats NULL as an empty string. Both name columns are NOT NULL here, so the results are identical.

Cleaning the messy names (trim, capitalisation) is a job for the string functions in Topic 9.`,
      commonMistakes: ['Forgetting the space between the names.', 'Using double quotes `" "` for the space. Double quotes mean an identifier.'],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't01-q10', topic: 1, relatedTopics: [], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: sorted list of currencies',
      prompt: `This query should list each **currency** used by our countries **once**, sorted alphabetically by the currency code. It fails with an error. Fix it.

- **Columns:** \`currency\`
- **Sort:** by \`currency\`.`,
      starterSql: `SELECT DISTINCT currency
FROM countries
ORDER BY name;`,
      hints: ['Read the error message. With DISTINCT, what may ORDER BY refer to?'],
      referenceSolution: `SELECT DISTINCT currency
FROM countries
ORDER BY currency;`,
      alternativeSolutions: [`SELECT DISTINCT currency FROM countries ORDER BY 1;`],
      wrongAnswers: [`SELECT currency FROM countries ORDER BY currency;`],
      explanation: `The error is *for SELECT DISTINCT, ORDER BY expressions must appear in select list*. After DISTINCT, a row like \`EUR\` stands for several countries with different names, so "sort by name" has no single answer.

Sort by something in the select list, here the currency itself.`,
      commonMistakes: ['Removing DISTINCT to silence the error, which brings back the duplicates.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't01-q11', topic: 1, relatedTopics: [], difficulty: 'hard', type: 'write-query',
      title: 'Cheapest product of each category',
      prompt: `For **each \`category_id\`**, show its **cheapest product** (if several share the lowest price, the one with the lowest \`product_id\`). Use PostgreSQL's \`DISTINCT ON\`.

- **Columns:** \`category_id\`, \`product_id\`, \`name\`, \`price\`
- **Sort:** by \`category_id\`.`,
      hints: ['`DISTINCT ON (category_id)` keeps the first row of each category.', 'Which row is "first" is decided by ORDER BY, which must start with `category_id`.'],
      referenceSolution: `SELECT DISTINCT ON (category_id) category_id, product_id, name, price
FROM products
ORDER BY category_id, price, product_id;`,
      alternativeSolutions: [`SELECT DISTINCT ON (p.category_id) p.category_id, p.product_id, p.name, p.price FROM products p ORDER BY p.category_id ASC, p.price ASC, p.product_id ASC;`],
      wrongAnswers: [
        `SELECT DISTINCT ON (category_id) category_id, product_id, name, price FROM products ORDER BY category_id, price DESC, product_id;`,
        `SELECT DISTINCT ON (category_id) category_id, product_id, name, price FROM products ORDER BY category_id, product_id;`,
      ],
      explanation: `\`DISTINCT ON (category_id)\` keeps exactly one row per category: the first one in ORDER BY order.

\`ORDER BY category_id, price, product_id\` makes that row the cheapest product, with the lowest id winning a tie. The ORDER BY must *begin* with the DISTINCT ON expression.

DISTINCT ON is PostgreSQL-specific. Topic 17 shows the portable equivalent with ROW_NUMBER().`,
      commonMistakes: ['Ordering by price DESC, which returns the most expensive product.', 'Leaving price out of ORDER BY, which returns an arbitrary product per category.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't01-q12', topic: 1, relatedTopics: [], difficulty: 'hard', type: 'write-query',
      title: 'Cheapest products, ties included',
      prompt: `Show the **5 cheapest products**, but if other products have the **same price as the 5th one**, include them as well (so the result can have more than 5 rows).

- **Columns:** \`product_id\`, \`name\`, \`price\`
- **Sort:** any order. Only the set of rows is checked.`,
      hints: ['LIMIT cuts ties off. The SQL standard has a variant that keeps them.', '`ORDER BY price FETCH FIRST 5 ROWS WITH TIES`'],
      referenceSolution: `SELECT product_id, name, price
FROM products
ORDER BY price
FETCH FIRST 5 ROWS WITH TIES;`,
      alternativeSolutions: [`SELECT product_id, name, price FROM products ORDER BY price ASC FETCH FIRST 5 ROW WITH TIES;`],
      wrongAnswers: [
        `SELECT product_id, name, price FROM products ORDER BY price LIMIT 5;`,
        `SELECT product_id, name, price FROM products ORDER BY price, product_id FETCH FIRST 5 ROWS WITH TIES;`,
      ],
      explanation: `\`FETCH FIRST 5 ROWS WITH TIES\` returns the first 5 rows *plus* every following row whose ORDER BY values equal those of the 5th. On the practice data, several products share the 5th-lowest price, so you get more than 5 rows.

Note that the ORDER BY must contain **only** the column that defines a tie. Adding \`product_id\` makes every row unique, so there are no more ties and the result is exactly 5 rows.`,
      commonMistakes: ['Using LIMIT 5, which drops products tied with the 5th.', 'Adding a tie-breaker to ORDER BY. Rows then never tie.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't01-q13', topic: 1, relatedTopics: [], difficulty: 'hard', type: 'write-query',
      title: 'Highest commission rates',
      prompt: `Show the **10 employees with the highest \`commission_pct\`**. Employees without a commission (NULL) must never appear before employees who have one. On equal commission, the higher \`salary\` comes first, then the lower \`employee_id\`.

- **Columns:** \`employee_id\`, \`first_name\`, \`last_name\`, \`commission_pct\`, \`salary\`
- **Sort:** as described. 10 rows.`,
      hints: ['How does PostgreSQL sort NULLs in a DESC sort by default?', '`ORDER BY commission_pct DESC NULLS LAST, salary DESC, employee_id`'],
      referenceSolution: `SELECT employee_id, first_name, last_name, commission_pct, salary
FROM employees
ORDER BY commission_pct DESC NULLS LAST, salary DESC, employee_id
LIMIT 10;`,
      alternativeSolutions: [`SELECT employee_id, first_name, last_name, commission_pct, salary FROM employees ORDER BY 4 DESC NULLS LAST, 5 DESC, 1 FETCH FIRST 10 ROWS ONLY;`],
      wrongAnswers: [
        `SELECT employee_id, first_name, last_name, commission_pct, salary FROM employees ORDER BY commission_pct DESC, salary DESC, employee_id LIMIT 10;`,
        `SELECT employee_id, first_name, last_name, commission_pct, salary FROM employees ORDER BY commission_pct DESC NULLS LAST, salary, employee_id LIMIT 10;`,
      ],
      explanation: `Most employees have no commission at all. In a \`DESC\` sort, PostgreSQL puts NULLs **first**, so a plain \`ORDER BY commission_pct DESC\` returns ten employees *without* commission!

\`NULLS LAST\` fixes that. The remaining keys implement the tie rules: salary high to low, then id.`,
      commonMistakes: ['Forgetting NULLS LAST, so the top 10 is all NULLs.', 'Sorting salary ascending in the tie-break.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't01-q14', topic: 1, relatedTopics: [], difficulty: 'hard', type: 'predict-output',
      title: 'Descending with a NULL',
      prompt: `Predict the result.`,
      referenceSolution: `SELECT x
FROM (VALUES (2), (NULL), (1)) AS t(x)
ORDER BY x DESC
LIMIT 2;`,
      options: [
        { table: { columns: ['x'], rows: [['2'], ['1']] } },
        { table: { columns: ['x'], rows: [[null], ['2']] } },
        { table: { columns: ['x'], rows: [['2'], [null]] } },
        { table: { columns: ['x'], rows: [['1'], ['2']] } },
      ],
      correctOption: 1,
      hints: ['PostgreSQL treats NULL as larger than any value when sorting.'],
      explanation: `PostgreSQL sorts NULL as if it were larger than every non-NULL value. In descending order NULL therefore comes **first**, followed by 2. \`LIMIT 2\` keeps those two rows.

Use \`ORDER BY x DESC NULLS LAST\` to get 2, 1.`,
      commonMistakes: ['Assuming NULLs are always at the end.', 'Assuming NULLs are dropped by ORDER BY. They never are.'],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't01-q15', topic: 1, relatedTopics: [], difficulty: 'interview', type: 'write-query',
      title: 'Third-highest distinct price',
      prompt: `What is the **third-highest distinct price** in the catalogue? If several products share the highest price, that price still counts once.

- **Columns:** \`price\`
- One row.`,
      hints: ['First reduce the prices to distinct values.', 'Then sort descending and skip the first two values: `OFFSET 2 LIMIT 1`.'],
      referenceSolution: `SELECT DISTINCT price
FROM products
ORDER BY price DESC
LIMIT 1 OFFSET 2;`,
      alternativeSolutions: [`SELECT DISTINCT price FROM products ORDER BY 1 DESC OFFSET 2 ROWS FETCH FIRST 1 ROW ONLY;`],
      wrongAnswers: [
        `SELECT price FROM products ORDER BY price DESC LIMIT 1 OFFSET 2;`,
        `SELECT DISTINCT price FROM products ORDER BY price DESC LIMIT 1 OFFSET 3;`,
      ],
      explanation: `This is the classic "Nth highest value" interview question, solved without window functions:

1. \`SELECT DISTINCT price\` collapses equal prices into one row.
2. \`ORDER BY price DESC\` puts the highest first.
3. \`OFFSET 2\` skips the two highest distinct prices, and \`LIMIT 1\` keeps the next one.

Without DISTINCT, two products tied at the second-highest price would occupy positions 2 and 3, and you'd return the 2nd-highest price instead. Topic 17 solves the same problem per group with \`DENSE_RANK()\`.`,
      commonMistakes: ['Forgetting DISTINCT, which counts duplicates as separate positions.', 'Using OFFSET 3 for the third value. The offset counts the rows *skipped*.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't01-q16', topic: 1, relatedTopics: [], difficulty: 'interview', type: 'write-query',
      title: 'Newest customer per country',
      prompt: `For **each \`country_id\` value** (customers with an unknown country form their own NULL group), show the customer who **signed up most recently**. If two signed up at the same moment, take the higher \`customer_id\`.

- **Columns:** \`country_id\`, \`customer_id\`, \`signup_at\`
- **Sort:** by \`country_id\` ascending (the NULL group last).`,
      hints: ['`DISTINCT ON (country_id)` keeps one row per country.', 'Choose the row with `ORDER BY country_id, signup_at DESC, customer_id DESC`.'],
      referenceSolution: `SELECT DISTINCT ON (country_id) country_id, customer_id, signup_at
FROM customers
ORDER BY country_id, signup_at DESC, customer_id DESC;`,
      alternativeSolutions: [`SELECT DISTINCT ON (country_id) country_id, customer_id, signup_at FROM customers ORDER BY country_id NULLS LAST, signup_at DESC, customer_id DESC;`],
      wrongAnswers: [
        `SELECT DISTINCT ON (country_id) country_id, customer_id, signup_at FROM customers ORDER BY country_id, signup_at, customer_id;`,
        `SELECT DISTINCT ON (country_id) country_id, customer_id, signup_at FROM customers ORDER BY country_id, customer_id;`,
      ],
      explanation: `"The latest row per group" is one of the most common reporting tasks.

1. \`DISTINCT ON (country_id)\` returns one row per distinct country_id, and NULL counts as a group of its own.
2. \`ORDER BY country_id, signup_at DESC, customer_id DESC\` makes the newest signup the first row of each group, so that's the one kept.
3. The final order is by country_id. In ascending order NULL comes last, which matches the requirement.

The portable alternative is \`ROW_NUMBER() OVER (PARTITION BY country_id ORDER BY signup_at DESC, customer_id DESC)\` (Topic 17).`,
      commonMistakes: ['Ordering signup_at ascending, which returns the oldest customer.', 'Omitting signup_at from ORDER BY, so the kept row is arbitrary.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
