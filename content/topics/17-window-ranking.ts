import type { Topic } from '../types.ts';

const explanation = `Ranking functions give every row a **position** inside a group of rows: 1st, 2nd, 3rd… Unlike \`GROUP BY\`, they don't collapse rows. Every input row stays, and it gets a new column holding its rank.

\`\`\`text
function() OVER ( [PARTITION BY expr, …]  ORDER BY expr [ASC|DESC] [NULLS FIRST|LAST], … )
\`\`\`

- \`ORDER BY\` *inside* \`OVER\` decides what "first" means. It is separate from the query's final \`ORDER BY\`, which only sorts the output.
- \`PARTITION BY\` restarts the numbering for each group, e.g. "rank *within each department*". Without it, the whole result is one partition.

## ROW_NUMBER, RANK and DENSE_RANK

The three functions differ only in how they treat **ties** (rows with equal ORDER BY values, called *peers*):

| salary | ROW_NUMBER() | RANK() | DENSE_RANK() |
|---|---|---|---|
| 100 | 1 | 1 | 1 |
| 100 | 2 | 1 | 1 |
| 90  | 3 | 3 | 2 |
| 80  | 4 | 4 | 3 |

- **ROW_NUMBER**: always 1, 2, 3, … with no repeats. Use it when you need *exactly* one row (or exactly N rows) per group.
- **RANK**: peers share a rank, and the next rank **skips** ahead (1, 1, 3), like sports results. Use it for "top 3, ties included".
- **DENSE_RANK**: peers share a rank, with **no gaps** (1, 1, 2). Use it for "the 2nd highest *distinct* value".

Two of our laptops share the highest price, so the three functions disagree:

\`\`\`sql
SELECT p.product_id, p.name, p.price,
       ROW_NUMBER() OVER (ORDER BY p.price DESC) AS row_num,
       RANK()       OVER (ORDER BY p.price DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY p.price DESC) AS dense_rnk
FROM products p
JOIN categories c ON c.category_id = p.category_id
WHERE c.slug = 'laptops'
ORDER BY p.price DESC, p.product_id;
\`\`\`

> **Ties and ROW_NUMBER.** When two rows tie on the window's ORDER BY, PostgreSQL may number them either way, and the order can change between runs or datasets. Add a unique tie-breaker (usually the primary key) whenever you use ROW_NUMBER: \`ORDER BY price DESC, product_id\`.

## PARTITION BY: rank within groups

\`\`\`sql
-- Salary position within each department (active staff only)
SELECT d.name AS department, e.first_name, e.last_name, e.salary,
       DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS salary_rank
FROM employees e
JOIN departments d ON d.department_id = e.department_id
WHERE e.termination_date IS NULL
ORDER BY department, salary_rank, e.employee_id;
\`\`\`

Partition by a **key**, not by a label that might repeat. Our category tree has two different categories both named *Shoes* (Men and Women). \`PARTITION BY c.name\` would quietly merge them, while \`PARTITION BY p.category_id\` keeps them apart.

## Filtering on a rank: "top N per group"

Window functions are computed **after** \`FROM\`, \`WHERE\`, \`GROUP BY\` and \`HAVING\`, and just before the final \`ORDER BY\`/\`LIMIT\`. So you can't use them in \`WHERE\`:

\`\`\`sql
-- ERROR:  window functions are not allowed in WHERE
SELECT * FROM products WHERE ROW_NUMBER() OVER (ORDER BY price DESC) <= 3;
\`\`\`

PostgreSQL has no \`QUALIFY\` clause (some other databases do). The standard pattern computes the rank in an inner query, then filters in an outer query. This needs a **subquery in FROM** or a **CTE**, which Topics 19 and 20 cover in depth. For now, treat it as a recipe:

\`\`\`sql
-- Recipe 1: subquery in FROM (needs an alias, here "ranked")
SELECT category_id, product_id, name, price
FROM (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC, product_id) AS pos
  FROM products p
  WHERE discontinued_at IS NULL
) AS ranked
WHERE pos <= 2
ORDER BY category_id, pos;
\`\`\`

\`\`\`sql
-- Recipe 2: the same with a CTE (WITH … AS), often easier to read
WITH ranked AS (
  SELECT p.*, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY price DESC, product_id) AS pos
  FROM products p
  WHERE discontinued_at IS NULL
)
SELECT category_id, product_id, name, price
FROM ranked
WHERE pos <= 2
ORDER BY category_id, pos;
\`\`\`

Where you put a filter matters. A condition **inside** the inner query removes rows *before* ranking. The same condition in the **outer** query removes rows *after* ranking, which can leave a group without its rank-1 row.

**Which function for "top N"?** "The 3 most expensive products" means exactly 3 rows, so use ROW_NUMBER. "Everything priced in the top 3", ties included, means RANK ≤ 3. "The top 3 *distinct* prices" means DENSE_RANK ≤ 3.

**PostgreSQL shortcut for "first row per group":** \`SELECT DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at DESC\` keeps the first row of each customer according to the ORDER BY. It is concise but PostgreSQL-only. ROW_NUMBER works everywhere and also handles "first N".

## Ranking groups (window over an aggregate)

Because windows run after \`GROUP BY\`, you can rank aggregated values directly:

\`\`\`sql
SELECT c.name AS country, count(cu.customer_id) AS customers,
       RANK() OVER (ORDER BY count(cu.customer_id) DESC) AS rnk
FROM countries c
LEFT JOIN customers cu ON cu.country_id = c.country_id
GROUP BY c.name
ORDER BY rnk, country;
\`\`\`

## NTILE, PERCENT_RANK and CUME_DIST

- **NTILE(n)** splits the ordered partition into *n* buckets that are as equal as possible. When the rows don't divide evenly, the **first** buckets get one extra row (7 rows into 3 → 3, 2, 2). Peers can land in different buckets, so add a tie-breaker to make it deterministic.
- **PERCENT_RANK()** = (rank − 1) / (rows in partition − 1). It runs from 0 to 1, and a one-row partition gets 0.
- **CUME_DIST()** = (rows up to and including the current row's peers) / (rows in partition). It runs from 1/N to 1.

Both return \`double precision\`. Cast to numeric to round: \`round(percent_rank() OVER (…)::numeric, 3)\`.

\`\`\`sql
SELECT x,
       NTILE(3)       OVER (ORDER BY x) AS bucket,
       PERCENT_RANK() OVER (ORDER BY x) AS pct_rank,
       CUME_DIST()    OVER (ORDER BY x) AS cume
FROM generate_series(1, 7) AS g(x);
\`\`\`

## More PostgreSQL notes and gotchas

- The ranking functions return **bigint**. Date arithmetic such as \`day - ROW_NUMBER() OVER (…)\` needs a cast: \`::int\`.
- **NULLs sort last in ascending order and first in descending order.** \`ORDER BY commission_pct DESC\` therefore ranks NULL commissions first! Use \`NULLS LAST\` or filter them out.
- Reuse a window definition with the \`WINDOW\` clause: \`… RANK() OVER w … WINDOW w AS (PARTITION BY department_id ORDER BY salary DESC)\`.
- Ranking functions ignore any frame clause (\`ROWS BETWEEN …\`). Frames matter for aggregates and value functions (Topics 16 and 18).
- The window's ORDER BY doesn't sort the output. Always finish with the query's own \`ORDER BY\` when order matters.

Remember the reference date: the data ends on **2025-06-30**, so use literal dates rather than \`CURRENT_DATE\`.`;

const topic: Topic = {
  id: 17,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18 Tutorial: Window Functions (3.5)', url: 'https://www.postgresql.org/docs/18/tutorial-window.html' },
    { title: 'PostgreSQL 18 Reference: Window Functions (9.22)', url: 'https://www.postgresql.org/docs/18/functions-window.html' },
    { title: 'PostgreSQL 18: Window Function Calls, syntax and processing (4.2.8)', url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-WINDOW-FUNCTIONS' },
    { title: 'Neon PostgreSQL Tutorial: RANK() by example', url: 'https://neon.com/postgresql/window-function/rank-function' },
    { title: 'ThoughtSpot (Mode) SQL Tutorial: Window Functions', url: 'https://www.thoughtspot.com/sql-tutorial/sql-window-functions' },
    { title: 'StrataScratch: Types of Window Functions with interview questions', url: 'https://www.stratascratch.com/blog/types-of-window-functions-in-sql-and-questions-asked-by-airbnb-netflix-twitter-and-uber' },
  ],
  questions: [
    // ───────────────────────────── easy ─────────────────────────────
    {
      id: 't17-q01',
      topic: 17,
      relatedTopics: [1, 4, 5, 15],
      difficulty: 'easy',
      type: 'write-query',
      title: 'Rank the laptops by price',
      prompt: `Rank **every product in the Laptops category** (category \`slug = 'laptops'\`, including discontinued ones) by price, most expensive first. Products with the same price share a rank, and the next rank skips accordingly (1, 1, 3, …).

- **Columns:** \`product_id\`, \`name\`, \`price\`, \`price_rank\`
- **Sort:** by \`price_rank\`, then \`product_id\`.`,
      hints: [
        'Find the laptops by joining `products` to `categories` and filtering on `slug`.',
        'Which ranking function shares a rank between equal prices *and* leaves a gap afterwards?',
        '`RANK() OVER (ORDER BY p.price DESC) AS price_rank`',
      ],
      referenceSolution: `SELECT p.product_id, p.name, p.price,
       RANK() OVER (ORDER BY p.price DESC) AS price_rank
FROM products p
JOIN categories c ON c.category_id = p.category_id
WHERE c.slug = 'laptops'
ORDER BY price_rank, p.product_id;`,
      alternativeSolutions: [
        `SELECT product_id, name, price, RANK() OVER w AS price_rank
FROM products
WHERE category_id = (SELECT category_id FROM categories WHERE slug = 'laptops')
WINDOW w AS (ORDER BY price DESC)
ORDER BY 4, 1;`,
      ],
      wrongAnswers: [
        `SELECT p.product_id, p.name, p.price, ROW_NUMBER() OVER (ORDER BY p.price DESC, p.product_id) AS price_rank
FROM products p JOIN categories c ON c.category_id = p.category_id WHERE c.slug = 'laptops' ORDER BY price_rank, p.product_id;`,
        `SELECT p.product_id, p.name, p.price, DENSE_RANK() OVER (ORDER BY p.price DESC) AS price_rank
FROM products p JOIN categories c ON c.category_id = p.category_id WHERE c.slug = 'laptops' ORDER BY price_rank, p.product_id;`,
        `SELECT p.product_id, p.name, p.price, RANK() OVER (ORDER BY p.price) AS price_rank
FROM products p JOIN categories c ON c.category_id = p.category_id WHERE c.slug = 'laptops' ORDER BY price_rank, p.product_id;`,
      ],
      explanation: `1. **Select the laptops:** join \`products\` to \`categories\` and keep \`slug = 'laptops'\`. Filtering on the unique slug is safer than filtering on the name.
2. **Choose the function:** equal prices must share a rank, and the following rank must skip. That is exactly \`RANK()\`. \`DENSE_RANK()\` wouldn't skip (1, 1, 2), and \`ROW_NUMBER()\` would never share (1, 2, 3).
3. **Define "first":** \`ORDER BY p.price DESC\` inside \`OVER\` makes the most expensive laptop rank 1.
4. **Sort the output:** the window's ORDER BY doesn't sort the result, so finish with \`ORDER BY price_rank, p.product_id\`. The \`product_id\` tie-breaker makes the order of tied rows fixed.

Two laptops share the top price, so they both get rank 1, and the next laptop is rank 3.`,
      commonMistakes: [
        'Using ROW_NUMBER, which gives tied laptops different ranks (1 and 2).',
        'Using DENSE_RANK, which gives the laptop after a tie rank 2 instead of 3.',
        'Ordering ascending inside OVER, which makes the cheapest laptop rank 1.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't17-q02',
      topic: 17,
      relatedTopics: [15],
      difficulty: 'easy',
      type: 'concept-mc',
      title: 'DENSE_RANK with a tie',
      prompt: `Four salaries are ranked highest first: **100, 100, 90, 80**.

Which numbers does \`DENSE_RANK() OVER (ORDER BY salary DESC)\` assign, in that order?`,
      options: [
        { text: '1, 1, 3, 4' },
        { text: '1, 2, 3, 4' },
        { text: '1, 1, 2, 3' },
        { text: '1, 1, 2, 2' },
      ],
      correctOption: 2,
      hints: ['DENSE_RANK gives peers the same rank, then continues with the very next number. It "counts distinct values".'],
      explanation: `- The two 100s are peers, so both get **1**.
- DENSE_RANK has **no gaps**, so 90 gets **2** and 80 gets **3**.

For comparison: \`RANK()\` gives 1, 1, 3, 4 (it skips the positions the tie used), and \`ROW_NUMBER()\` gives 1, 2, 3, 4 (no ties at all). "1, 1, 2, 2" is impossible, because 90 and 80 are different values and can't share a rank.`,
      commonMistakes: [
        'Mixing up RANK (gaps after ties) with DENSE_RANK (no gaps).',
        'Thinking ties are broken automatically. They share a rank unless you use ROW_NUMBER.',
      ],
    },
    {
      id: 't17-q03',
      topic: 17,
      relatedTopics: [1, 15],
      difficulty: 'easy',
      type: 'predict-output',
      title: 'Three functions, one tie',
      prompt: `Without running it, predict the output of this query.`,
      referenceSolution: `SELECT v,
       ROW_NUMBER() OVER (ORDER BY v DESC) AS rn,
       RANK()       OVER (ORDER BY v DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY v DESC) AS drnk
FROM (VALUES (30), (20), (30), (10)) AS t(v)
ORDER BY v DESC, rn;`,
      options: [
        { table: { columns: ['v', 'rn', 'rnk', 'drnk'], rows: [['30', '1', '1', '1'], ['30', '2', '1', '1'], ['20', '3', '3', '2'], ['10', '4', '4', '3']] } },
        { table: { columns: ['v', 'rn', 'rnk', 'drnk'], rows: [['30', '1', '1', '1'], ['30', '2', '1', '1'], ['20', '3', '2', '2'], ['10', '4', '3', '3']] } },
        { table: { columns: ['v', 'rn', 'rnk', 'drnk'], rows: [['30', '1', '1', '1'], ['30', '1', '1', '1'], ['20', '2', '3', '2'], ['10', '3', '4', '3']] } },
        { table: { columns: ['v', 'rn', 'rnk', 'drnk'], rows: [['30', '1', '1', '1'], ['30', '2', '2', '1'], ['20', '3', '3', '2'], ['10', '4', '4', '3']] } },
      ],
      correctOption: 0,
      hints: [
        'Work out each column separately: ROW_NUMBER never repeats, while RANK and DENSE_RANK repeat for equal values.',
        'After two rows tied for 1st place, RANK continues at 3 and DENSE_RANK at 2.',
      ],
      explanation: `- **rn (ROW_NUMBER):** 1, 2, 3, 4. Even the two 30s get different numbers. Which 30 gets 1 is arbitrary, but the output looks the same either way.
- **rnk (RANK):** the 30s share **1**. Two rows used positions 1 and 2, so 20 is **3** and 10 is **4**.
- **drnk (DENSE_RANK):** the 30s share **1**, then 20 is **2** and 10 is **3**, with no gap.

\`(VALUES …) AS t(v)\` builds a tiny inline table with one column named \`v\`. It's handy for experiments like this one.`,
      commonMistakes: [
        'Giving the tied 30s the same ROW_NUMBER.',
        'Continuing RANK at 2 after the tie, which is DENSE_RANK behaviour.',
        'Giving the second 30 a different RANK. Peers always share RANK and DENSE_RANK.',
      ],
      checkConfig: { orderMatters: true },
    },
    {
      id: 't17-q04',
      topic: 17,
      relatedTopics: [1, 4, 15],
      difficulty: 'easy',
      type: 'write-query',
      title: 'Number each customer’s orders',
      prompt: `For the customers with \`customer_id\` **1 to 5**, number each customer's orders in the order they were placed: their first order is 1, their second is 2, and so on. If two orders of the same customer have the same \`ordered_at\`, the lower \`order_id\` comes first. Include all statuses.

- **Columns:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`order_number\`
- **Sort:** by \`customer_id\`, then \`order_number\`.`,
      hints: [
        'The numbering must restart for every customer. Which clause inside OVER does that?',
        'Every order needs a distinct number, even with ties, so use ROW_NUMBER with a tie-breaker.',
        '`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)`',
      ],
      referenceSolution: `SELECT customer_id, order_id, ordered_at,
       ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS order_number
FROM orders
WHERE customer_id BETWEEN 1 AND 5
ORDER BY customer_id, order_number;`,
      alternativeSolutions: [
        `SELECT customer_id, order_id, ordered_at, ROW_NUMBER() OVER w AS order_number
FROM orders
WHERE customer_id IN (1, 2, 3, 4, 5)
WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at ASC, order_id ASC)
ORDER BY 1, 4;`,
      ],
      wrongAnswers: [
        // No PARTITION BY: numbering runs across all five customers.
        `SELECT customer_id, order_id, ordered_at, ROW_NUMBER() OVER (ORDER BY ordered_at, order_id) AS order_number
FROM orders WHERE customer_id BETWEEN 1 AND 5 ORDER BY customer_id, order_number;`,
        // Newest order gets number 1.
        `SELECT customer_id, order_id, ordered_at, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC) AS order_number
FROM orders WHERE customer_id BETWEEN 1 AND 5 ORDER BY customer_id, order_number;`,
      ],
      explanation: `1. **Filter first:** \`WHERE customer_id BETWEEN 1 AND 5\`. WHERE runs before the window function, so only these customers' orders get numbered.
2. **Restart per customer:** \`PARTITION BY customer_id\` starts a fresh numbering for each customer.
3. **Oldest first:** \`ORDER BY ordered_at, order_id\` inside OVER. The \`order_id\` tie-breaker guarantees a fixed order if two orders share a timestamp.
4. **Exactly one number per order:** \`ROW_NUMBER()\`. RANK could hand two orders the same number.
5. **Sort the output** by customer, then by the new number.`,
      commonMistakes: [
        'Forgetting PARTITION BY, so the numbers keep counting across customers.',
        'Ordering by ordered_at DESC, which numbers the most recent order as 1.',
        'Sorting the final output by ordered_at only. Use the columns the task asks for.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },

    // ───────────────────────────── medium ─────────────────────────────
    {
      id: 't17-q05',
      topic: 17,
      relatedTopics: [1, 4, 5, 15],
      difficulty: 'medium',
      type: 'write-query',
      title: 'Salary rank within each department',
      prompt: `HR wants to see where each **active** employee (\`termination_date IS NULL\`) stands within their own department. Employees without a department are left out.

Rank by salary, highest first. Equal salaries share a rank, and the ranks have **no gaps** (1, 2, 2, 3, …).

- **Columns:** \`department\` (the department's name), \`employee_id\`, \`salary\`, \`salary_rank\`
- **Sort:** by \`department\`, then \`salary_rank\`, then \`employee_id\`.`,
      hints: [
        'Join `employees` to `departments`. An inner join drops employees without a department automatically.',
        '"No gaps" means DENSE_RANK. "Within their department" means PARTITION BY.',
        '`DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC)`',
      ],
      referenceSolution: `SELECT d.name AS department, e.employee_id, e.salary,
       DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS salary_rank
FROM employees e
JOIN departments d ON d.department_id = e.department_id
WHERE e.termination_date IS NULL
ORDER BY department, salary_rank, e.employee_id;`,
      alternativeSolutions: [
        `SELECT d.name AS department, e.employee_id, e.salary,
       DENSE_RANK() OVER (PARTITION BY d.name ORDER BY e.salary DESC) AS salary_rank
FROM employees e JOIN departments d USING (department_id)
WHERE e.termination_date IS NULL
ORDER BY 1, 4, 2;`,
      ],
      wrongAnswers: [
        `SELECT d.name AS department, e.employee_id, e.salary, RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS salary_rank
FROM employees e JOIN departments d ON d.department_id = e.department_id WHERE e.termination_date IS NULL ORDER BY department, salary_rank, e.employee_id;`,
        `SELECT d.name AS department, e.employee_id, e.salary, DENSE_RANK() OVER (ORDER BY e.salary DESC) AS salary_rank
FROM employees e JOIN departments d ON d.department_id = e.department_id WHERE e.termination_date IS NULL ORDER BY department, salary_rank, e.employee_id;`,
        `SELECT d.name AS department, e.employee_id, e.salary, DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS salary_rank
FROM employees e JOIN departments d ON d.department_id = e.department_id ORDER BY department, salary_rank, e.employee_id;`,
      ],
      explanation: `1. **Rows:** active employees with a department. \`JOIN departments\` (an inner join) removes the two contractors who have no department, and \`WHERE termination_date IS NULL\` removes former staff. Both happen *before* ranking, so former employees don't take up rank positions.
2. **Groups:** \`PARTITION BY e.department_id\` ranks each department separately.
3. **No gaps:** \`DENSE_RANK()\`. In Sales the two directors earn the same salary. Both are rank 2, and the next salary is rank 3. With RANK it would be 4.
4. **Output order:** department name, then rank, then employee id for ties.

Partitioning by \`d.name\` also works here, because department names are unique (there's a UNIQUE constraint). Partitioning by the key is still the safer habit.`,
      commonMistakes: [
        'Using RANK, which leaves a gap after the tied Sales directors.',
        'Forgetting PARTITION BY, which ranks the whole company in one list.',
        'Filtering terminated employees after ranking (or not at all). Former staff then occupy rank positions.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't17-q06',
      topic: 17,
      relatedTopics: [1, 5, 14, 15],
      difficulty: 'medium',
      type: 'write-query',
      title: 'Countries by number of customers',
      prompt: `Rank **all countries**, including those with no customers at all, by how many customers live there (\`customers.country_id\`).

Countries with the same number of customers share a rank, and the ranks have no gaps.

- **Columns:** \`country\` (country name), \`customers\` (number of customers), \`popularity_rank\`
- **Sort:** by \`popularity_rank\`, then \`country\`.`,
      hints: [
        'Countries without customers must still appear, so join from `countries` with a LEFT JOIN.',
        'Count a column from the customers side (`count(cu.customer_id)`), not `count(*)`, so empty countries get 0.',
        'A window function can rank an aggregate: `DENSE_RANK() OVER (ORDER BY count(cu.customer_id) DESC)`.',
      ],
      referenceSolution: `SELECT c.name AS country,
       count(cu.customer_id) AS customers,
       DENSE_RANK() OVER (ORDER BY count(cu.customer_id) DESC) AS popularity_rank
FROM countries c
LEFT JOIN customers cu ON cu.country_id = c.country_id
GROUP BY c.country_id, c.name
ORDER BY popularity_rank, country;`,
      alternativeSolutions: [
        `SELECT country, customers, DENSE_RANK() OVER (ORDER BY customers DESC) AS popularity_rank
FROM (
  SELECT c.name AS country, count(cu.customer_id) AS customers
  FROM countries c LEFT JOIN customers cu USING (country_id)
  GROUP BY c.name
) AS per_country
ORDER BY popularity_rank, country;`,
      ],
      wrongAnswers: [
        `SELECT c.name AS country, count(*) AS customers, DENSE_RANK() OVER (ORDER BY count(*) DESC) AS popularity_rank
FROM countries c JOIN customers cu ON cu.country_id = c.country_id GROUP BY c.name ORDER BY popularity_rank, country;`,
        `SELECT c.name AS country, count(*) AS customers, DENSE_RANK() OVER (ORDER BY count(*) DESC) AS popularity_rank
FROM countries c LEFT JOIN customers cu ON cu.country_id = c.country_id GROUP BY c.name ORDER BY popularity_rank, country;`,
        `SELECT c.name AS country, count(cu.customer_id) AS customers, RANK() OVER (ORDER BY count(cu.customer_id) DESC) AS popularity_rank
FROM countries c LEFT JOIN customers cu ON cu.country_id = c.country_id GROUP BY c.name ORDER BY popularity_rank, country;`,
      ],
      explanation: `1. **Keep every country:** \`FROM countries LEFT JOIN customers\`. Iceland, Kenya and Luxembourg have no customers. An inner join would drop them.
2. **Count correctly:** after a LEFT JOIN, a country without customers still produces *one* row, with NULLs on the customer side. \`count(*)\` counts that row (giving 1), while \`count(cu.customer_id)\` ignores the NULL (giving 0).
3. **Rank the aggregate:** window functions run after GROUP BY, so \`DENSE_RANK() OVER (ORDER BY count(cu.customer_id) DESC)\` can rank the counts directly. No subquery is needed.
4. **Ties:** several countries share a count (for example the three countries with 0), so they share a rank, with no gaps.`,
      commonMistakes: [
        'Using an inner JOIN, which loses the countries without customers.',
        'Using count(*) after a LEFT JOIN, which reports 1 customer for countries that have none.',
        'Using RANK when the task says the ranks have no gaps.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't17-q07',
      topic: 17,
      relatedTopics: [1, 4, 5, 15],
      previewTopics: [19, 20],
      difficulty: 'medium',
      type: 'write-query',
      title: 'Three most expensive products per category',
      prompt: `For **each category** (by \`category_id\`), list its **3 most expensive products that are still on sale** (\`discontinued_at IS NULL\`). Exactly 3 per category, or fewer if the category has fewer products. When prices tie, the lower \`product_id\` wins the better position.

- **Columns:** \`category_id\`, \`category\` (category name), \`product_id\`, \`product\` (product name), \`price\`, \`pos\` (1, 2 or 3)
- **Sort:** by \`category_id\`, then \`pos\`.

*Filtering on a ranking needs the "rank in an inner query, filter in an outer query" pattern from the explanation above.*`,
      hints: [
        '"Exactly 3, ties broken by product_id" points to ROW_NUMBER with `product_id` as a tie-breaker.',
        'Partition by `category_id`. Two different categories are both called "Shoes".',
        'Compute `pos` in a subquery or CTE, then keep `WHERE pos <= 3` in the outer query.',
      ],
      referenceSolution: `WITH ranked AS (
  SELECT p.category_id, c.name AS category, p.product_id, p.name AS product, p.price,
         ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC, p.product_id) AS pos
  FROM products p
  JOIN categories c ON c.category_id = p.category_id
  WHERE p.discontinued_at IS NULL
)
SELECT category_id, category, product_id, product, price, pos
FROM ranked
WHERE pos <= 3
ORDER BY category_id, pos;`,
      alternativeSolutions: [
        `SELECT category_id, category, product_id, product, price, pos
FROM (
  SELECT p.category_id, c.name AS category, p.product_id, p.name AS product, p.price,
         ROW_NUMBER() OVER (PARTITION BY c.category_id ORDER BY p.price DESC, p.product_id ASC) AS pos
  FROM categories c JOIN products p USING (category_id)
  WHERE p.discontinued_at IS NULL
) AS t
WHERE pos BETWEEN 1 AND 3
ORDER BY 1, 6;`,
      ],
      wrongAnswers: [
        // Partitions by the category *name*: the two "Shoes" categories merge.
        `WITH ranked AS (SELECT p.category_id, c.name AS category, p.product_id, p.name AS product, p.price,
  ROW_NUMBER() OVER (PARTITION BY c.name ORDER BY p.price DESC, p.product_id) AS pos
  FROM products p JOIN categories c ON c.category_id = p.category_id WHERE p.discontinued_at IS NULL)
SELECT category_id, category, product_id, product, price, pos FROM ranked WHERE pos <= 3 ORDER BY category_id, pos;`,
        // DENSE_RANK returns more than 3 rows when prices tie.
        `WITH ranked AS (SELECT p.category_id, c.name AS category, p.product_id, p.name AS product, p.price,
  DENSE_RANK() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS pos
  FROM products p JOIN categories c ON c.category_id = p.category_id WHERE p.discontinued_at IS NULL)
SELECT category_id, category, product_id, product, price, pos FROM ranked WHERE pos <= 3 ORDER BY category_id, pos;`,
        // Discontinued filter applied after ranking: categories lose positions.
        `WITH ranked AS (SELECT p.category_id, c.name AS category, p.product_id, p.name AS product, p.price, p.discontinued_at,
  ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC, p.product_id) AS pos
  FROM products p JOIN categories c ON c.category_id = p.category_id)
SELECT category_id, category, product_id, product, price, pos FROM ranked WHERE pos <= 3 AND discontinued_at IS NULL ORDER BY category_id, pos;`,
      ],
      explanation: `1. **Rank inside each category:** \`ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC, p.product_id)\`. ROW_NUMBER guarantees exactly one row per position, and \`product_id\` settles ties the way the task asks.
2. **Filter before ranking:** \`discontinued_at IS NULL\` belongs *inside* the ranked query. Applied afterwards, a discontinued product could take position 1, and the category would show only two products.
3. **Filter on the rank:** window results can't be used in WHERE of the same query, so the ranking goes in a CTE (or subquery) and the outer query keeps \`pos <= 3\`.
4. **Partition by the key:** *Shoes* exists under both Men and Women. \`PARTITION BY c.name\` would treat them as one category, and one of them would lose its products.`,
      commonMistakes: [
        'Writing `WHERE ROW_NUMBER() OVER (…) <= 3`. Window functions aren\'t allowed in WHERE.',
        'Partitioning by category name, which merges the two "Shoes" categories.',
        'Using RANK or DENSE_RANK, which return extra rows when prices tie.',
        'Filtering discontinued products in the outer query, after positions were already handed out.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't17-q08',
      topic: 17,
      relatedTopics: [1, 4, 5, 15],
      previewTopics: [19, 20],
      difficulty: 'medium',
      type: 'write-query',
      title: 'Second-highest distinct price per category',
      prompt: `For each category, find the **second-highest distinct price** among its products that are still on sale (\`discontinued_at IS NULL\`).

If several products share the highest price, the second-highest *distinct* price is the next lower price. Categories with fewer than two distinct prices don't appear.

- **Columns:** \`category_id\`, \`category\` (category name), \`second_price\`
- **Sort:** by \`category_id\`. One row per category.`,
      hints: [
        '"Distinct" values with ties → DENSE_RANK. Equal prices share a rank and no number is skipped.',
        'Rank prices within each category, then keep rank 2 in an outer query.',
        'Several products can share the second price. Make sure each category appears only once (DISTINCT).',
      ],
      referenceSolution: `WITH ranked AS (
  SELECT p.category_id, c.name AS category, p.price,
         DENSE_RANK() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS price_rank
  FROM products p
  JOIN categories c ON c.category_id = p.category_id
  WHERE p.discontinued_at IS NULL
)
SELECT DISTINCT category_id, category, price AS second_price
FROM ranked
WHERE price_rank = 2
ORDER BY category_id;`,
      alternativeSolutions: [
        `SELECT category_id, category, second_price
FROM (
  SELECT c.category_id, c.name AS category, p.price AS second_price,
         DENSE_RANK() OVER (PARTITION BY c.category_id ORDER BY p.price DESC) AS r
  FROM categories c JOIN products p ON p.category_id = c.category_id
  WHERE p.discontinued_at IS NULL
  GROUP BY c.category_id, c.name, p.price
) AS x
WHERE r = 2
ORDER BY category_id;`,
      ],
      wrongAnswers: [
        // RANK skips 2 when the top price is tied: those categories disappear.
        `WITH ranked AS (SELECT p.category_id, c.name AS category, p.price, RANK() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS r
  FROM products p JOIN categories c ON c.category_id = p.category_id WHERE p.discontinued_at IS NULL)
SELECT DISTINCT category_id, category, price AS second_price FROM ranked WHERE r = 2 ORDER BY category_id;`,
        // ROW_NUMBER = 2 returns the top price again when it is tied.
        `WITH ranked AS (SELECT p.category_id, c.name AS category, p.price, ROW_NUMBER() OVER (PARTITION BY p.category_id ORDER BY p.price DESC, p.product_id) AS r
  FROM products p JOIN categories c ON c.category_id = p.category_id WHERE p.discontinued_at IS NULL)
SELECT category_id, category, price AS second_price FROM ranked WHERE r = 2 ORDER BY category_id;`,
        // Missing DISTINCT: duplicate rows when two products share the second price.
        `WITH ranked AS (SELECT p.category_id, c.name AS category, p.price, DENSE_RANK() OVER (PARTITION BY p.category_id ORDER BY p.price DESC) AS r
  FROM products p JOIN categories c ON c.category_id = p.category_id WHERE p.discontinued_at IS NULL)
SELECT category_id, category, price AS second_price FROM ranked WHERE r = 2 ORDER BY category_id;`,
      ],
      explanation: `This is the classic "Nth highest value" interview question, asked per group.

1. **DENSE_RANK counts distinct values.** All products with the highest price get 1, and the next lower price gets 2, whatever the size of the tie.
2. **Why not RANK?** In *Monitors* several products share the top price. With RANK they're all 1 and the next price jumps to 4, so \`= 2\` finds nothing and the category vanishes.
3. **Why not ROW_NUMBER?** With a tied top price, row 2 is just another top-priced product, so you'd report the highest price as the "second highest".
4. **DISTINCT:** two products can share the second price. Each then has rank 2, and without DISTINCT the category appears twice.

The alternative groups by price first, so every price appears once before ranking. Then DISTINCT isn't needed.`,
      commonMistakes: [
        'Using RANK, which loses categories whose top price is tied.',
        'Using ROW_NUMBER, which returns the top price again when it is tied.',
        'Forgetting DISTINCT, which gives one row per product that has the second price.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't17-q09',
      topic: 17,
      relatedTopics: [1, 4, 15],
      previewTopics: [19],
      difficulty: 'medium',
      type: 'fix-query',
      title: 'Fix: best-paid employee per department',
      prompt: `This query should return the **best-paid active employee in each department**: one row per \`department_id\`. If two employees tie on salary, the lower \`employee_id\` wins. Employees without a department (\`department_id\` NULL) form their own group.

It fails with an error. Fix it.

- **Columns:** \`employee_id\`, \`department_id\`, \`salary\`
- **Sort:** by \`department_id\` ascending, with NULLs last (PostgreSQL's default for ascending order).`,
      starterSql: `SELECT employee_id, department_id, salary
FROM employees
WHERE termination_date IS NULL
  AND ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC, employee_id) = 1
ORDER BY department_id;`,
      hints: [
        'Run it and read the error: where are window functions not allowed?',
        'Compute the row number in an inner query (give it an alias such as `pos`), then filter on `pos = 1` outside.',
      ],
      referenceSolution: `SELECT employee_id, department_id, salary
FROM (
  SELECT employee_id, department_id, salary,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC, employee_id) AS pos
  FROM employees
  WHERE termination_date IS NULL
) AS ranked
WHERE pos = 1
ORDER BY department_id;`,
      alternativeSolutions: [
        `WITH ranked AS (
  SELECT employee_id, department_id, salary,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC, employee_id) AS pos
  FROM employees WHERE termination_date IS NULL
)
SELECT employee_id, department_id, salary FROM ranked WHERE pos = 1 ORDER BY department_id NULLS LAST;`,
        `SELECT DISTINCT ON (department_id) employee_id, department_id, salary
FROM employees
WHERE termination_date IS NULL
ORDER BY department_id, salary DESC, employee_id;`,
      ],
      wrongAnswers: [
        // An alias from SELECT can't be used in WHERE of the same query.
        `SELECT employee_id, department_id, salary,
  ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC, employee_id) AS pos
FROM employees WHERE termination_date IS NULL AND pos = 1 ORDER BY department_id;`,
        // Lowest salary instead of highest.
        `SELECT employee_id, department_id, salary FROM (SELECT employee_id, department_id, salary,
  ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary, employee_id) AS pos
  FROM employees WHERE termination_date IS NULL) AS ranked WHERE pos = 1 ORDER BY department_id;`,
      ],
      explanation: `**The error:** \`window functions are not allowed in WHERE\`. WHERE filters rows *before* window functions are computed, so the row number doesn't exist yet at that point.

**The fix:** compute the ranking in an inner query (a subquery in FROM, which needs an alias), then filter on its result in the outer query:

1. The inner query keeps active employees and numbers them per department, highest salary first, with \`employee_id\` breaking ties.
2. The outer query keeps \`pos = 1\`: exactly one row per department.
3. \`PARTITION BY department_id\` puts all NULL departments into one group, so the two contractors form a group of their own, as required.

PostgreSQL's \`DISTINCT ON (department_id)\` is a valid shortcut here. It keeps the first row of each department according to the ORDER BY.`,
      commonMistakes: [
        'Moving the alias into WHERE (`AND pos = 1`). Aliases from SELECT aren\'t visible in WHERE either.',
        'Using HAVING to filter the window result. Windows are computed after HAVING too.',
        'Dropping the tie-breaker, which makes the winner of a tie unpredictable.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't17-q10',
      topic: 17,
      relatedTopics: [1, 4, 9, 15],
      previewTopics: [19, 20],
      difficulty: 'medium',
      type: 'write-query',
      title: 'Deduplicate imported contacts',
      prompt: `\`staging_customer_import\` contains the same people several times, sometimes with different capitalisation or stray spaces in the e-mail address.

Keep **one row per normalised e-mail**, where the normalised e-mail is \`lower(trim(email))\`. Of each group, keep the row that was **imported first** (\`imported_at\`), and if that ties, the lowest \`import_row_id\`. Ignore rows whose \`email\` is NULL or contains no \`@\`.

- **Columns:** \`import_row_id\`, \`email\` (the normalised address)
- **Sort:** by \`email\`.`,
      hints: [
        'Group by the *normalised* address: `PARTITION BY lower(trim(email))`.',
        'Number the rows in each group by import time and row id, then keep row 1 in an outer query.',
        'Filter out NULL and @-less addresses before numbering: `WHERE email LIKE \'%@%\'`. NULL never matches LIKE.',
      ],
      referenceSolution: `WITH numbered AS (
  SELECT import_row_id,
         lower(trim(email)) AS email,
         ROW_NUMBER() OVER (PARTITION BY lower(trim(email)) ORDER BY imported_at, import_row_id) AS rn
  FROM staging_customer_import
  WHERE email LIKE '%@%'
)
SELECT import_row_id, email
FROM numbered
WHERE rn = 1
ORDER BY email;`,
      alternativeSolutions: [
        `SELECT DISTINCT ON (lower(trim(email))) import_row_id, lower(trim(email)) AS email
FROM staging_customer_import
WHERE position('@' IN email) > 0
ORDER BY lower(trim(email)), imported_at, import_row_id;`,
      ],
      wrongAnswers: [
        // Partitions by the raw e-mail: case/space variants survive as separate rows.
        `WITH numbered AS (SELECT import_row_id, lower(trim(email)) AS email, ROW_NUMBER() OVER (PARTITION BY email ORDER BY imported_at, import_row_id) AS rn
  FROM staging_customer_import WHERE email LIKE '%@%')
SELECT import_row_id, email FROM numbered WHERE rn = 1 ORDER BY email;`,
        // Keeps the most recent import instead of the first.
        `WITH numbered AS (SELECT import_row_id, lower(trim(email)) AS email, ROW_NUMBER() OVER (PARTITION BY lower(trim(email)) ORDER BY imported_at DESC, import_row_id DESC) AS rn
  FROM staging_customer_import WHERE email LIKE '%@%')
SELECT import_row_id, email FROM numbered WHERE rn = 1 ORDER BY email;`,
      ],
      explanation: `Deduplication is one of the most common real-world uses of ROW_NUMBER:

1. **Define "the same":** \`lower(trim(email))\` folds \`' Anna.Kim@Gmail.com'\` and \`'anna.kim@gmail.com'\` into one key. Partition by that expression, not by the raw column.
2. **Define the survivor:** \`ORDER BY imported_at, import_row_id\` makes the earliest import number 1. The row id breaks ties within the same file.
3. **Keep the survivors:** filter \`rn = 1\` in an outer query.
4. **Ignore junk first:** \`email LIKE '%@%'\` drops NULLs (NULL never matches LIKE), empty strings and \`'n/a'\` before numbering.

PostgreSQL's \`DISTINCT ON\` does the same in one step: it keeps the first row per key according to the ORDER BY.`,
      commonMistakes: [
        'Partitioning by the raw `email`, so capitalisation and spacing variants count as different people.',
        'Using DISTINCT on the e-mail only. You lose the information about which row to keep.',
        'Ordering by imported_at DESC, which keeps the latest copy instead of the first.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't17-q11',
      topic: 17,
      relatedTopics: [1, 8, 15],
      difficulty: 'medium',
      type: 'predict-output',
      title: 'NTILE with an uneven split',
      prompt: `Seven rows are split into three buckets. Which \`bucket\` values does this query return, in order?`,
      referenceSolution: `SELECT x, NTILE(3) OVER (ORDER BY x) AS bucket
FROM generate_series(1, 7) AS g(x)
ORDER BY x;`,
      options: [
        { table: { columns: ['x', 'bucket'], rows: [['1', '1'], ['2', '1'], ['3', '2'], ['4', '2'], ['5', '3'], ['6', '3'], ['7', '3']] } },
        { table: { columns: ['x', 'bucket'], rows: [['1', '1'], ['2', '1'], ['3', '1'], ['4', '2'], ['5', '2'], ['6', '3'], ['7', '3']] } },
        { table: { columns: ['x', 'bucket'], rows: [['1', '1'], ['2', '1'], ['3', '2'], ['4', '2'], ['5', '2'], ['6', '3'], ['7', '3']] } },
        { table: { columns: ['x', 'bucket'], rows: [['1', '1'], ['2', '1'], ['3', '1'], ['4', '2'], ['5', '2'], ['6', '2'], ['7', '3']] } },
      ],
      correctOption: 1,
      hints: ['7 = 3 + 2 + 2. Which buckets get the extra row: the first ones or the last ones?'],
      explanation: `NTILE(3) makes the buckets as equal as possible. 7 rows ÷ 3 buckets = 2 rows each, with 1 row left over. The leftover rows go to the **first** buckets, so the sizes are **3, 2, 2**:

- x = 1, 2, 3 → bucket 1
- x = 4, 5 → bucket 2
- x = 6, 7 → bucket 3

\`generate_series(1, 7)\` produces the integers 1 to 7 as a set of rows. \`AS g(x)\` names the column.`,
      commonMistakes: [
        'Giving the extra rows to the last bucket.',
        'Assuming NTILE looks at values. It only counts rows in order, so equal values can end up in different buckets.',
      ],
      checkConfig: { orderMatters: true },
    },

    // ───────────────────────────── hard ─────────────────────────────
    {
      id: 't17-q12',
      topic: 17,
      relatedTopics: [1, 4, 5, 15],
      previewTopics: [19, 20],
      difficulty: 'hard',
      type: 'write-query',
      title: 'Latest order of each customer in Germany',
      prompt: `For every customer **who lives in Germany** (their \`customers.country_id\` points to the country named \`'Germany'\`) and has placed at least one order, show their **most recent order** (latest \`ordered_at\`; if two orders share it, the higher \`order_id\`). Include orders of any status.

- **Columns:** \`customer_id\`, \`order_id\`, \`ordered_at\`, \`status\`
- **Sort:** by \`customer_id\`.`,
      hints: [
        'Where the customer *lives* is `customers.country_id`, not the order\'s `ship_country_id`.',
        'Number each customer\'s orders newest first: `PARTITION BY customer_id ORDER BY ordered_at DESC, order_id DESC`.',
        'Keep row 1 in an outer query.',
      ],
      referenceSolution: `WITH ranked AS (
  SELECT o.customer_id, o.order_id, o.ordered_at, o.status,
         ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at DESC, o.order_id DESC) AS rn
  FROM orders o
  JOIN customers cu ON cu.customer_id = o.customer_id
  JOIN countries co ON co.country_id = cu.country_id
  WHERE co.name = 'Germany'
)
SELECT customer_id, order_id, ordered_at, status
FROM ranked
WHERE rn = 1
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT DISTINCT ON (o.customer_id) o.customer_id, o.order_id, o.ordered_at, o.status
FROM orders o
JOIN customers cu USING (customer_id)
WHERE cu.country_id = (SELECT country_id FROM countries WHERE name = 'Germany')
ORDER BY o.customer_id, o.ordered_at DESC, o.order_id DESC;`,
      ],
      wrongAnswers: [
        // Oldest order instead of newest.
        `WITH ranked AS (SELECT o.customer_id, o.order_id, o.ordered_at, o.status,
  ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) AS rn
  FROM orders o JOIN customers cu ON cu.customer_id = o.customer_id JOIN countries co ON co.country_id = cu.country_id WHERE co.name = 'Germany')
SELECT customer_id, order_id, ordered_at, status FROM ranked WHERE rn = 1 ORDER BY customer_id;`,
        // Filters on the shipping country instead of where the customer lives.
        `WITH ranked AS (SELECT o.customer_id, o.order_id, o.ordered_at, o.status,
  ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at DESC, o.order_id DESC) AS rn
  FROM orders o JOIN countries co ON co.country_id = o.ship_country_id WHERE co.name = 'Germany')
SELECT customer_id, order_id, ordered_at, status FROM ranked WHERE rn = 1 ORDER BY customer_id;`,
      ],
      explanation: `"Latest row per entity" is a staple of interviews and of real reporting.

1. **Find the right customers:** join orders → customers → countries and filter \`countries.name = 'Germany'\`. The *customer's* country is meant, not \`orders.ship_country_id\`. A few orders ship somewhere other than the customer's home country, so the two filters really do give different results.
2. **Number newest first:** \`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC, order_id DESC)\`. The task's tie rule becomes the second sort key.
3. **Keep the newest:** \`rn = 1\` in the outer query. Customers without orders never appear, because they have no order rows.

A tempting alternative is \`max(ordered_at)\` per customer, but then you need a second join to get the order's other columns, and ties are awkward. ROW_NUMBER (or PostgreSQL's DISTINCT ON) returns the whole row directly.`,
      commonMistakes: [
        'Filtering on ship_country_id when the question is about where the customer lives.',
        'Ordering ascending, which returns each customer\'s first order.',
        'Using max(ordered_at) with GROUP BY and then trying to select status as well. It isn\'t grouped.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't17-q13',
      topic: 17,
      relatedTopics: [1, 4, 5, 11, 14, 15],
      previewTopics: [19, 20],
      difficulty: 'hard',
      type: 'write-query',
      title: 'Top-spending customer of each month in 2024',
      prompt: `For **each month of 2024** (orders with \`ordered_at\` from 2024-01-01 up to, but not including, 2025-01-01, UTC), find the customer or customers with the **highest spend** that month. If several customers tie for the top, include all of them.

- **Spend** = sum of \`quantity * unit_price * (1 - discount)\` over the customer's order lines that month, counting only orders whose \`status\` is **not** \`'cancelled'\`.
- **Columns:** \`month\` (first day of the month, type \`date\`), \`customer_id\`, \`spend\` (rounded to 2 decimals)
- **Sort:** by \`month\`, then \`customer_id\`.`,
      hints: [
        'First aggregate spend per month and customer: `date_trunc(\'month\', ordered_at)::date` and SUM over the joined order lines.',
        'Then rank customers within each month: `RANK() OVER (PARTITION BY month ORDER BY spend DESC)`. RANK keeps ties.',
        'Keep rank 1 in an outer query, and round only when displaying.',
      ],
      referenceSolution: `WITH monthly AS (
  SELECT date_trunc('month', o.ordered_at)::date AS month,
         o.customer_id,
         SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) AS spend
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
    AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01'
  GROUP BY 1, 2
), ranked AS (
  SELECT month, customer_id, spend,
         RANK() OVER (PARTITION BY month ORDER BY spend DESC) AS rnk
  FROM monthly
)
SELECT month, customer_id, round(spend, 2) AS spend
FROM ranked
WHERE rnk = 1
ORDER BY month, customer_id;`,
      alternativeSolutions: [
        `SELECT month, customer_id, round(spend, 2) AS spend
FROM (
  SELECT date_trunc('month', o.ordered_at)::date AS month, o.customer_id,
         sum(oi.quantity * oi.unit_price * (1 - oi.discount)) AS spend,
         RANK() OVER (PARTITION BY date_trunc('month', o.ordered_at)
                      ORDER BY sum(oi.quantity * oi.unit_price * (1 - oi.discount)) DESC) AS rnk
  FROM orders o JOIN order_items oi USING (order_id)
  WHERE o.status != 'cancelled' AND EXTRACT(YEAR FROM o.ordered_at) = 2024
  GROUP BY date_trunc('month', o.ordered_at), o.customer_id
) AS t
WHERE rnk = 1
ORDER BY month, customer_id;`,
      ],
      wrongAnswers: [
        // Counts cancelled orders too.
        `WITH monthly AS (SELECT date_trunc('month', o.ordered_at)::date AS month, o.customer_id, SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) AS spend
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1, 2),
ranked AS (SELECT month, customer_id, spend, RANK() OVER (PARTITION BY month ORDER BY spend DESC) AS rnk FROM monthly)
SELECT month, customer_id, round(spend, 2) AS spend FROM ranked WHERE rnk = 1 ORDER BY month, customer_id;`,
        // No PARTITION BY: only the single best month-customer of the whole year.
        `WITH monthly AS (SELECT date_trunc('month', o.ordered_at)::date AS month, o.customer_id, SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) AS spend
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1, 2),
ranked AS (SELECT month, customer_id, spend, RANK() OVER (ORDER BY spend DESC) AS rnk FROM monthly)
SELECT month, customer_id, round(spend, 2) AS spend FROM ranked WHERE rnk = 1 ORDER BY month, customer_id;`,
        // Ignores the line discount.
        `WITH monthly AS (SELECT date_trunc('month', o.ordered_at)::date AS month, o.customer_id, SUM(oi.quantity * oi.unit_price) AS spend
  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' AND o.ordered_at >= '2024-01-01' AND o.ordered_at < '2025-01-01' GROUP BY 1, 2),
ranked AS (SELECT month, customer_id, spend, RANK() OVER (PARTITION BY month ORDER BY spend DESC) AS rnk FROM monthly)
SELECT month, customer_id, round(spend, 2) AS spend FROM ranked WHERE rnk = 1 ORDER BY month, customer_id;`,
      ],
      explanation: `A three-step pipeline: **aggregate → rank → filter**.

1. **Aggregate:** join orders to their lines, keep non-cancelled 2024 orders, and sum the line values per \`(month, customer)\`. \`date_trunc('month', ordered_at)::date\` turns a timestamp into the first day of its month, as a date. The half-open range \`>= '2024-01-01' AND < '2025-01-01'\` catches every timestamp in 2024, including 31 December 23:59.
2. **Rank inside each month:** \`RANK() OVER (PARTITION BY month ORDER BY spend DESC)\`. RANK (or DENSE_RANK) keeps ties at the top, as required. ROW_NUMBER would silently drop a tied customer.
3. **Filter and present:** keep \`rnk = 1\` and round only in the final SELECT. Ranking on unrounded values avoids false ties.

The alternative does steps 1 and 2 in one SELECT. A window can rank an aggregate because windows are evaluated after GROUP BY.`,
      commonMistakes: [
        'Forgetting to exclude cancelled orders.',
        'Leaving out PARTITION BY month, which returns only the single best customer of the year.',
        'Ignoring the discount column when computing spend.',
        'Using ROW_NUMBER, which drops customers who tie for the top.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, numericTolerance: 0.005 },
    },
    {
      id: 't17-q14',
      topic: 17,
      relatedTopics: [1, 4, 10, 14, 15],
      previewTopics: [19, 20],
      difficulty: 'hard',
      type: 'write-query',
      title: 'Price quartiles',
      prompt: `Split all products **still on sale** (\`discontinued_at IS NULL\`) into **4 price quartiles** with \`NTILE(4)\`: quartile 1 holds the cheapest products. Order by \`price\`, and for equal prices by \`product_id\`, so the split is deterministic.

Then summarise each quartile.

- **Columns:** \`quartile\`, \`products\` (how many), \`min_price\`, \`max_price\`, \`avg_price\` (rounded to 2 decimals)
- **Sort:** by \`quartile\`.`,
      hints: [
        'Step 1: assign `NTILE(4) OVER (ORDER BY price, product_id)` to every on-sale product.',
        'Step 2: in an outer query, GROUP BY the quartile and aggregate.',
      ],
      referenceSolution: `WITH bucketed AS (
  SELECT product_id, price,
         NTILE(4) OVER (ORDER BY price, product_id) AS quartile
  FROM products
  WHERE discontinued_at IS NULL
)
SELECT quartile,
       count(*) AS products,
       min(price) AS min_price,
       max(price) AS max_price,
       round(avg(price), 2) AS avg_price
FROM bucketed
GROUP BY quartile
ORDER BY quartile;`,
      alternativeSolutions: [
        `SELECT quartile, count(*) AS products, min(price) AS min_price, max(price) AS max_price, round(avg(price)::numeric, 2) AS avg_price
FROM (SELECT price, NTILE(4) OVER (ORDER BY price ASC, product_id ASC) AS quartile FROM products WHERE discontinued_at IS NULL) AS b
GROUP BY 1
ORDER BY 1;`,
      ],
      wrongAnswers: [
        // Quartile 1 = most expensive.
        `WITH bucketed AS (SELECT product_id, price, NTILE(4) OVER (ORDER BY price DESC, product_id) AS quartile FROM products WHERE discontinued_at IS NULL)
SELECT quartile, count(*) AS products, min(price) AS min_price, max(price) AS max_price, round(avg(price), 2) AS avg_price FROM bucketed GROUP BY quartile ORDER BY quartile;`,
        // Includes discontinued products.
        `WITH bucketed AS (SELECT product_id, price, NTILE(4) OVER (ORDER BY price, product_id) AS quartile FROM products)
SELECT quartile, count(*) AS products, min(price) AS min_price, max(price) AS max_price, round(avg(price), 2) AS avg_price FROM bucketed GROUP BY quartile ORDER BY quartile;`,
      ],
      explanation: `1. **Bucket the rows:** \`NTILE(4) OVER (ORDER BY price, product_id)\` walks through the products from cheapest to most expensive and deals them into 4 nearly equal buckets. When the count isn't divisible by 4, the first quartiles get one product more.
2. **Make it deterministic:** several products share a price, and NTILE splits on row positions, not values. Without the \`product_id\` tie-breaker, tied products could land in different quartiles from run to run.
3. **Summarise:** windows can't be grouped in the same SELECT that computes them, so bucket in a CTE (or subquery) and GROUP BY \`quartile\` outside.

Notice that the bucket boundaries are row positions. Two products with the same price can sit in neighbouring quartiles, so one quartile's \`max_price\` may equal the next one's \`min_price\`. That's normal NTILE behaviour, and the reason to use \`percentile_cont\` (Topic 14) when you need value-based boundaries.`,
      commonMistakes: [
        'Ordering DESC, which makes quartile 1 the most expensive one.',
        'Forgetting the discontinued filter.',
        'Trying to GROUP BY a window function in the same query level. Compute it first, then group.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't17-q15',
      topic: 17,
      relatedTopics: [1, 4, 15],
      previewTopics: [19],
      difficulty: 'hard',
      type: 'fix-query',
      title: 'Fix: each customer’s first real order',
      prompt: `For every customer who has at least one order that was **not cancelled**, the query should return their **first non-cancelled order**: the earliest \`ordered_at\`, and on a tie the lower \`order_id\`.

The query below runs without an error, but returns the wrong rows. Find and fix the bug(s).

- **Columns:** \`customer_id\`, \`order_id\`, \`ordered_at\`
- **Sort:** by \`customer_id\`.`,
      starterSql: `SELECT customer_id, order_id, ordered_at
FROM (
  SELECT customer_id, order_id, ordered_at, status,
         ROW_NUMBER() OVER (ORDER BY ordered_at, order_id) AS rn
  FROM orders
) AS t
WHERE rn = 1
  AND status <> 'cancelled'
ORDER BY customer_id;`,
      hints: [
        'Run it: how many rows come back? Should the numbering restart somewhere?',
        'Where is the cancelled filter applied: before or after the numbering? What happens to a customer whose very first order was cancelled?',
      ],
      referenceSolution: `SELECT customer_id, order_id, ordered_at
FROM (
  SELECT customer_id, order_id, ordered_at,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS rn
  FROM orders
  WHERE status <> 'cancelled'
) AS t
WHERE rn = 1
ORDER BY customer_id;`,
      alternativeSolutions: [
        `SELECT DISTINCT ON (customer_id) customer_id, order_id, ordered_at
FROM orders
WHERE status != 'cancelled'
ORDER BY customer_id, ordered_at, order_id;`,
      ],
      wrongAnswers: [
        // Partition fixed, but the cancelled filter still runs after numbering.
        `SELECT customer_id, order_id, ordered_at FROM (SELECT customer_id, order_id, ordered_at, status,
  ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS rn FROM orders) AS t
WHERE rn = 1 AND status <> 'cancelled' ORDER BY customer_id;`,
        // Filter fixed, but the partition is still missing.
        `SELECT customer_id, order_id, ordered_at FROM (SELECT customer_id, order_id, ordered_at,
  ROW_NUMBER() OVER (ORDER BY ordered_at, order_id) AS rn FROM orders WHERE status <> 'cancelled') AS t
WHERE rn = 1 ORDER BY customer_id;`,
      ],
      explanation: `There are **two bugs**:

1. **No PARTITION BY.** The numbering runs over *all* orders, so only one row in the whole table has \`rn = 1\`. Adding \`PARTITION BY customer_id\` restarts the count for each customer.
2. **The cancelled filter is in the wrong place.** It's applied *after* numbering. A customer whose first order was cancelled has \`rn = 1\` on that cancelled order, the outer filter throws it away, and the customer disappears, even if they placed real orders later. Move \`status <> 'cancelled'\` into the inner query, so cancelled orders never get a number.

General rule: conditions that define **which rows compete** go inside, before the window. Conditions on the **result of the ranking** go outside.`,
      commonMistakes: [
        'Fixing only the partition and leaving the status filter outside, which loses customers whose first order was cancelled.',
        'Fixing only the filter, which still returns a single row.',
        'Ordering descending, which returns the latest order instead of the first.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },

    // ───────────────────────────── interview ─────────────────────────────
    {
      id: 't17-q16',
      topic: 17,
      relatedTopics: [1, 4, 5, 15],
      previewTopics: [19, 20],
      difficulty: 'interview',
      type: 'write-query',
      title: 'Top three salaries in every department',
      prompt: `A classic interview question. For every department, list the **active** employees (\`termination_date IS NULL\`) whose salary is one of the department's **three highest distinct salaries**. If several people earn one of those salaries, list all of them. Employees without a department are left out.

- **Columns:** \`department\` (department name), \`employee_id\`, \`salary\`
- **Sort:** by \`department\`, then \`salary\` (highest first), then \`employee_id\`.`,
      hints: [
        '"Three highest *distinct* salaries" with ties included → DENSE_RANK.',
        'Rank within each department in a CTE or subquery, then keep rank ≤ 3.',
        'Sales has two directors with the same salary. Check that your answer still reaches the 3rd distinct salary there.',
      ],
      referenceSolution: `WITH ranked AS (
  SELECT d.name AS department, e.employee_id, e.salary,
         DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS salary_rank
  FROM employees e
  JOIN departments d ON d.department_id = e.department_id
  WHERE e.termination_date IS NULL
)
SELECT department, employee_id, salary
FROM ranked
WHERE salary_rank <= 3
ORDER BY department, salary DESC, employee_id;`,
      alternativeSolutions: [
        `SELECT d.name AS department, e.employee_id, e.salary
FROM employees e
JOIN departments d USING (department_id)
WHERE e.termination_date IS NULL
  AND (SELECT count(DISTINCT e2.salary) FROM employees e2
       WHERE e2.department_id = e.department_id AND e2.termination_date IS NULL AND e2.salary > e.salary) < 3
ORDER BY 1, 3 DESC, 2;`,
      ],
      wrongAnswers: [
        `WITH ranked AS (SELECT d.name AS department, e.employee_id, e.salary, RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS r
  FROM employees e JOIN departments d ON d.department_id = e.department_id WHERE e.termination_date IS NULL)
SELECT department, employee_id, salary FROM ranked WHERE r <= 3 ORDER BY department, salary DESC, employee_id;`,
        `WITH ranked AS (SELECT d.name AS department, e.employee_id, e.salary, ROW_NUMBER() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC, e.employee_id) AS r
  FROM employees e JOIN departments d ON d.department_id = e.department_id WHERE e.termination_date IS NULL)
SELECT department, employee_id, salary FROM ranked WHERE r <= 3 ORDER BY department, salary DESC, employee_id;`,
        `WITH ranked AS (SELECT d.name AS department, e.employee_id, e.salary, DENSE_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS r
  FROM employees e JOIN departments d ON d.department_id = e.department_id)
SELECT department, employee_id, salary FROM ranked WHERE r <= 3 ORDER BY department, salary DESC, employee_id;`,
      ],
      explanation: `Interviewers love this one because all three ranking functions look plausible, and only one is right.

- **DENSE_RANK ≤ 3** keeps every employee whose salary is among the three highest *distinct* values. In Sales the VP is 1, the two directors (same salary) are both 2, and the next salary is 3. That's 4 people, which is correct.
- **RANK ≤ 3** gives Sales 1, 2, 2, 4 and stops after the directors, missing the third distinct salary.
- **ROW_NUMBER ≤ 3** returns exactly 3 people and ignores the meaning of "distinct salaries".

Remember to filter \`termination_date IS NULL\` **before** ranking. Otherwise a former employee's salary could occupy a top-3 slot.

The alternative solution is the pre-window-function approach: keep an employee if fewer than 3 distinct salaries in the department are higher than theirs. It's correct, but harder to read and slower on big tables.`,
      commonMistakes: [
        'Using RANK, which loses the third distinct salary when there is a tie above it.',
        'Using ROW_NUMBER, which always returns exactly three people.',
        'Ranking before excluding terminated employees.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't17-q17',
      topic: 17,
      relatedTopics: [1, 4, 11, 14, 15],
      previewTopics: [20],
      difficulty: 'interview',
      type: 'write-query',
      title: 'Longest login streaks (gaps and islands)',
      prompt: `A **streak** is a run of consecutive calendar days (UTC dates of \`logged_in_at\`) on which a customer had at least one **successful** login (\`success = true\`). Several logins on the same day count as one day.

For each customer, find their **longest** streak. If a customer has several streaks of that length, use the earliest one. Then return the **5 customers with the longest streaks**.

- **Columns:** \`customer_id\`, \`streak_days\`, \`streak_start\`, \`streak_end\` (both \`date\`)
- **Sort:** by \`streak_days\` (longest first), then \`customer_id\`. Return exactly the first 5 rows of that order.`,
      hints: [
        'Reduce the data to one row per customer and day first: `SELECT DISTINCT customer_id, logged_in_at::date`.',
        'The "gaps and islands" trick: within a customer, `day - ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY day)` stays constant along consecutive days. Group by it.',
        'Then pick each customer\'s best run with another ROW_NUMBER (longest first, earliest start), and finish with ORDER BY … LIMIT 5. ROW_NUMBER returns bigint, so cast it with `::int` before subtracting from a date.',
      ],
      referenceSolution: `WITH days AS (
  SELECT DISTINCT customer_id, logged_in_at::date AS day
  FROM user_logins
  WHERE success
), islands AS (
  SELECT customer_id, day,
         day - (ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY day))::int AS island
  FROM days
), runs AS (
  SELECT customer_id, island,
         count(*) AS streak_days, min(day) AS streak_start, max(day) AS streak_end
  FROM islands
  GROUP BY customer_id, island
), best AS (
  SELECT customer_id, streak_days, streak_start, streak_end,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY streak_days DESC, streak_start) AS pick
  FROM runs
)
SELECT customer_id, streak_days, streak_start, streak_end
FROM best
WHERE pick = 1
ORDER BY streak_days DESC, customer_id
LIMIT 5;`,
      alternativeSolutions: [
        `WITH d AS (
  SELECT customer_id, logged_in_at::date AS day FROM user_logins WHERE success = true GROUP BY 1, 2
), r AS (
  SELECT customer_id, min(day) AS streak_start, max(day) AS streak_end, count(*) AS streak_days
  FROM (SELECT customer_id, day, day - DENSE_RANK() OVER (PARTITION BY customer_id ORDER BY day)::integer AS grp FROM d) AS g
  GROUP BY customer_id, grp
)
SELECT DISTINCT ON (customer_id, streak_days) customer_id, streak_days, streak_start, streak_end
FROM r
WHERE (customer_id, streak_days) IN (SELECT customer_id, max(streak_days) FROM r GROUP BY customer_id)
ORDER BY streak_days DESC, customer_id, streak_start
LIMIT 5;`,
      ],
      wrongAnswers: [
        // Without DISTINCT days, several logins on one day break the arithmetic.
        `WITH days AS (SELECT customer_id, logged_in_at::date AS day FROM user_logins WHERE success),
islands AS (SELECT customer_id, day, day - (ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY day))::int AS island FROM days),
runs AS (SELECT customer_id, island, count(*) AS streak_days, min(day) AS streak_start, max(day) AS streak_end FROM islands GROUP BY customer_id, island),
best AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY streak_days DESC, streak_start) AS pick FROM runs)
SELECT customer_id, streak_days, streak_start, streak_end FROM best WHERE pick = 1 ORDER BY streak_days DESC, customer_id LIMIT 5;`,
        // Keeps timestamps instead of dates: timestamptz - integer doesn't exist.
        `WITH days AS (SELECT DISTINCT customer_id, date_trunc('day', logged_in_at) AS day FROM user_logins WHERE success),
islands AS (SELECT customer_id, day, day - (ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY day))::int AS island FROM days),
runs AS (SELECT customer_id, island, count(*) AS streak_days, min(day) AS streak_start, max(day) AS streak_end FROM islands GROUP BY customer_id, island),
best AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY streak_days DESC, streak_start) AS pick FROM runs)
SELECT customer_id, streak_days, streak_start, streak_end FROM best WHERE pick = 1 ORDER BY streak_days DESC, customer_id LIMIT 5;`,
      ],
      explanation: `"Gaps and islands" is one of the most famous SQL interview patterns.

1. **One row per active day:** \`SELECT DISTINCT customer_id, logged_in_at::date\`. Without DISTINCT, two logins on the same day give two rows, and the arithmetic below breaks.
2. **The island key:** number each customer's days 1, 2, 3, … and subtract that number from the date:

   | day | row_number | day − row_number |
   |---|---|---|
   | 2024-02-15 | 1 | 2024-02-14 |
   | 2024-02-16 | 2 | 2024-02-14 |
   | 2024-02-17 | 3 | 2024-02-14 |
   | 2024-02-20 | 4 | 2024-02-16 |

   Consecutive days keep the same difference. A gap changes it. Each distinct difference is one *island* (streak).
3. **Measure each island:** \`GROUP BY customer_id, island\` gives the length, first day and last day.
4. **Best island per customer:** ROW_NUMBER ordered by length (desc) and start date (asc) picks the longest, and the earliest of equally long ones.
5. **Top 5:** sort by length, then customer, and \`LIMIT 5\`.

\`ROW_NUMBER()\` returns \`bigint\`, and PostgreSQL has no \`date - bigint\` operator, so cast with \`::int\`.

On the practice data, two customers tie with 21-day streaks, and those streaks run across the leap day 2024-02-29.`,
      commonMistakes: [
        'Skipping DISTINCT, so multiple logins per day break the date − row_number trick.',
        'Keeping timestamps (e.g. `date_trunc(\'day\', logged_in_at)`) instead of dates. You can subtract an integer from a `date`, but not from a `timestamptz`.',
        'Subtracting a bigint from a date without a cast. There is no `date - bigint` operator.',
        'Counting failed logins.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't17-q18',
      topic: 17,
      relatedTopics: [1, 4, 5, 11, 12, 13, 14, 15],
      previewTopics: [20],
      difficulty: 'interview',
      type: 'write-query',
      title: 'How fast do customers come back?',
      prompt: `Growth wants to know how quickly customers place a **second order**, broken down by the year they signed up.

Consider only orders whose \`status\` is not \`'cancelled'\`. A customer's first and second orders are their earliest two of those, ordered by \`ordered_at\` and then \`order_id\`.

Group customers by **signup year** (\`EXTRACT(YEAR FROM signup_at)\`, as an integer). Only customers with at least one non-cancelled order count. For each year report:

- \`repeat_customers\`: customers who have a second order;
- \`fast_repeaters\`: those whose second order came **at most 30 days** after the first (\`second.ordered_at - first.ordered_at <= INTERVAL '30 days'\`);
- \`pct_fast\`: \`fast_repeaters\` as a percentage of \`repeat_customers\`, rounded to 1 decimal (NULL if there are no repeat customers).

- **Columns:** \`signup_year\`, \`repeat_customers\`, \`fast_repeaters\`, \`pct_fast\`
- **Sort:** by \`signup_year\`.`,
      hints: [
        'Number each customer\'s non-cancelled orders with ROW_NUMBER (partition by customer, order by ordered_at, order_id).',
        'Pivot orders 1 and 2 into columns per customer: `MIN(ordered_at) FILTER (WHERE n = 1)` and the same for `n = 2`.',
        'Watch out for integer division when computing the percentage. Multiply by `100.0`, and use NULLIF to avoid dividing by zero.',
      ],
      referenceSolution: `WITH numbered AS (
  SELECT customer_id, ordered_at,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS n
  FROM orders
  WHERE status <> 'cancelled'
), first_two AS (
  SELECT customer_id,
         MIN(ordered_at) FILTER (WHERE n = 1) AS first_at,
         MIN(ordered_at) FILTER (WHERE n = 2) AS second_at
  FROM numbered
  WHERE n <= 2
  GROUP BY customer_id
)
SELECT EXTRACT(YEAR FROM c.signup_at)::int AS signup_year,
       count(f.second_at) AS repeat_customers,
       count(*) FILTER (WHERE f.second_at - f.first_at <= INTERVAL '30 days') AS fast_repeaters,
       round(100.0 * count(*) FILTER (WHERE f.second_at - f.first_at <= INTERVAL '30 days')
             / NULLIF(count(f.second_at), 0), 1) AS pct_fast
FROM first_two f
JOIN customers c ON c.customer_id = f.customer_id
GROUP BY 1
ORDER BY 1;`,
      alternativeSolutions: [
        `WITH numbered AS (
  SELECT o.customer_id, o.ordered_at, EXTRACT(YEAR FROM c.signup_at)::int AS signup_year,
         ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.ordered_at, o.order_id) AS n
  FROM orders o JOIN customers c USING (customer_id)
  WHERE o.status != 'cancelled'
), per_customer AS (
  SELECT customer_id, signup_year,
         max(CASE WHEN n = 1 THEN ordered_at END) AS first_at,
         max(CASE WHEN n = 2 THEN ordered_at END) AS second_at
  FROM numbered GROUP BY customer_id, signup_year
)
SELECT signup_year,
       sum(CASE WHEN second_at IS NOT NULL THEN 1 ELSE 0 END) AS repeat_customers,
       sum(CASE WHEN second_at <= first_at + INTERVAL '30 days' THEN 1 ELSE 0 END) AS fast_repeaters,
       round(sum(CASE WHEN second_at <= first_at + INTERVAL '30 days' THEN 1 ELSE 0 END) * 100.0
             / NULLIF(sum(CASE WHEN second_at IS NOT NULL THEN 1 ELSE 0 END), 0), 1) AS pct_fast
FROM per_customer
GROUP BY signup_year
ORDER BY signup_year;`,
      ],
      wrongAnswers: [
        // Integer division truncates the percentage.
        `WITH numbered AS (SELECT customer_id, ordered_at, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS n FROM orders WHERE status <> 'cancelled'),
first_two AS (SELECT customer_id, MIN(ordered_at) FILTER (WHERE n = 1) AS first_at, MIN(ordered_at) FILTER (WHERE n = 2) AS second_at FROM numbered WHERE n <= 2 GROUP BY customer_id)
SELECT EXTRACT(YEAR FROM c.signup_at)::int AS signup_year, count(f.second_at) AS repeat_customers,
  count(*) FILTER (WHERE f.second_at - f.first_at <= INTERVAL '30 days') AS fast_repeaters,
  round(100 * count(*) FILTER (WHERE f.second_at - f.first_at <= INTERVAL '30 days') / NULLIF(count(f.second_at), 0), 1) AS pct_fast
FROM first_two f JOIN customers c ON c.customer_id = f.customer_id GROUP BY 1 ORDER BY 1;`,
        // Cancelled orders are counted as first/second orders.
        `WITH numbered AS (SELECT customer_id, ordered_at, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id) AS n FROM orders),
first_two AS (SELECT customer_id, MIN(ordered_at) FILTER (WHERE n = 1) AS first_at, MIN(ordered_at) FILTER (WHERE n = 2) AS second_at FROM numbered WHERE n <= 2 GROUP BY customer_id)
SELECT EXTRACT(YEAR FROM c.signup_at)::int AS signup_year, count(f.second_at) AS repeat_customers,
  count(*) FILTER (WHERE f.second_at - f.first_at <= INTERVAL '30 days') AS fast_repeaters,
  round(100.0 * count(*) FILTER (WHERE f.second_at - f.first_at <= INTERVAL '30 days') / NULLIF(count(f.second_at), 0), 1) AS pct_fast
FROM first_two f JOIN customers c ON c.customer_id = f.customer_id GROUP BY 1 ORDER BY 1;`,
      ],
      explanation: `A compact retention analysis built on ranking:

1. **Number the real orders:** \`ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at, order_id)\` over non-cancelled orders. Cancelled orders are excluded *before* numbering, so they can't count as a "first" or "second" order.
2. **Pivot to one row per customer:** keep \`n <= 2\` and use conditional aggregation (\`MIN(…) FILTER (WHERE n = 1)\`) to put the first and second timestamps side by side. \`second_at\` is NULL for one-time buyers.
3. **Join the signup year** and aggregate:
   - \`count(f.second_at)\` counts only non-NULL values, i.e. repeat customers;
   - the FILTER with \`<= INTERVAL '30 days'\` counts the fast ones. Subtracting two timestamptz values gives an interval;
   - \`100.0 * … / NULLIF(…, 0)\`: \`100.0\` forces numeric division (\`100 * 7 / 9\` would be integer division, giving 77 instead of 77.8), and NULLIF turns a zero denominator into NULL instead of an error.
4. \`EXTRACT\` returns \`numeric\` in PostgreSQL, so cast it with \`::int\` for a clean year column.`,
      commonMistakes: [
        'Integer division in the percentage: `100 * a / b` truncates. Use `100.0`.',
        'Numbering all orders and filtering cancelled ones afterwards (or not at all).',
        'Using count(*) for repeat customers, which also counts one-time buyers.',
        'Measuring from signup date instead of from the first order.',
      ],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
