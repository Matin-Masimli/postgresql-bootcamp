import type { Topic } from '../types.ts';
import { ATTEMPT_FN, attemptsShape, columnsShape } from '../helpers.ts';

/** Verification for a view: its columns (name, type, order) and every row it returns, as text. */
const verifyView = (view: string) => `${columnsShape(view)}
UNION ALL
SELECT 'row' AS kind, 0 AS n, v::text AS detail FROM ${view} v`;

/** Verification for a materialized view: its kind, its columns and its rows. */
const verifyMatview = (view: string) => `SELECT 'relkind' AS kind, 0 AS n, CASE relkind WHEN 'm' THEN 'materialized view' WHEN 'v' THEN 'view' WHEN 'r' THEN 'table' ELSE relkind::text END AS detail
FROM pg_class WHERE oid = '${view}'::regclass
UNION ALL
${verifyView(view)}`;

const explanation = `A **view** is a stored, named query. Selecting from it runs the query at that moment, so it always reflects the current data and stores no rows of its own.

\`\`\`sql
CREATE VIEW active_staff AS
SELECT employee_id, first_name, last_name, department_id, salary
FROM employees
WHERE termination_date IS NULL;

SELECT department_id, count(*) AS people
FROM active_staff
GROUP BY department_id
ORDER BY department_id;
\`\`\`

(In this app every run is rolled back, so the view disappears afterwards. In a real database it stays until dropped.)

## Why use views

- **Reuse:** define a business rule ("active", "revenue", "VIP customer") once instead of copying it into every query.
- **Simplify:** hide joins and calculations behind a plain table-like name. Views can build on other views.
- **Restrict:** expose only some columns or rows to a role, without granting access to the table.

## Managing views

\`\`\`text
CREATE VIEW name [(col, …)] AS query [WITH [CASCADED | LOCAL] CHECK OPTION];
CREATE OR REPLACE VIEW name AS query;   -- same columns, same order; new columns only at the end
ALTER VIEW name RENAME TO new_name;
DROP VIEW [IF EXISTS] name [CASCADE];
\`\`\`

- The view's column list is fixed when it's created. \`SELECT *\` in a view is expanded **at creation time**: columns added to the table later don't appear.
- A table with dependent views can't be dropped (or have a used column dropped) unless you add \`CASCADE\`, which drops the views too.

## Updatable views

A **simple** view (one table in FROM, no GROUP BY, DISTINCT, aggregates, window functions, set operations or LIMIT) is automatically updatable: INSERT, UPDATE and DELETE on it are applied to the underlying table.

By default you can update a row **out of** the view's WHERE condition, or insert a row the view would never show. \`WITH CHECK OPTION\` forbids that: the new row must satisfy the view's condition, or the statement fails (SQLSTATE 44000).

\`\`\`sql
-- ERROR: new row violates check option
CREATE VIEW cheap AS
SELECT product_id, name, price FROM products WHERE price < 20
WITH CHECK OPTION;

UPDATE cheap SET price = 50
WHERE product_id = (SELECT min(product_id) FROM cheap);
\`\`\`

## Materialized views

\`CREATE MATERIALIZED VIEW name AS query\` runs the query **once** and stores the result like a table. Reads are fast, and you can index it, but the data is a snapshot. It's only updated by \`REFRESH MATERIALIZED VIEW name\`.

- \`REFRESH … CONCURRENTLY\` lets readers keep using the old data during the refresh, but it requires a **unique index** on the materialized view.
- Use them for expensive reports that may be slightly stale (daily dashboards). Use plain views when the data must be current.`;

const lineValue = 'oi.quantity * oi.unit_price * (1 - oi.discount)';

const topic: Topic = {
  id: 21,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: CREATE VIEW', url: 'https://www.postgresql.org/docs/18/sql-createview.html' },
    { title: 'PostgreSQL 18 Tutorial: Views (3.2)', url: 'https://www.postgresql.org/docs/18/tutorial-views.html' },
    { title: 'PostgreSQL 18: Materialized Views (39.3)', url: 'https://www.postgresql.org/docs/18/rules-materializedviews.html' },
    { title: 'PostgreSQL 18: REFRESH MATERIALIZED VIEW', url: 'https://www.postgresql.org/docs/18/sql-refreshmaterializedview.html' },
    { title: 'Neon PostgreSQL Tutorial: Views', url: 'https://neon.com/postgresql/postgresql-views' },
  ],
  questions: [
    {
      id: 't21-q01', topic: 21, relatedTopics: [1, 2, 4], difficulty: 'easy', type: 'write-query',
      title: 'A view of active employees',
      prompt: `Create a view **\`active_employees\`** with the columns \`employee_id\`, \`first_name\`, \`last_name\`, \`department_id\`, \`salary\` (in this order), showing only employees who are **still employed**.`,
      hints: ['`CREATE VIEW active_employees AS SELECT … FROM employees WHERE …`', 'Still employed = no termination date.'],
      referenceSolution: `CREATE VIEW active_employees AS
SELECT employee_id, first_name, last_name, department_id, salary
FROM employees
WHERE termination_date IS NULL;`,
      alternativeSolutions: [`CREATE OR REPLACE VIEW active_employees (employee_id, first_name, last_name, department_id, salary) AS SELECT employee_id, first_name, last_name, department_id, salary FROM employees e WHERE NOT (e.termination_date IS NOT NULL);`],
      wrongAnswers: [
        `CREATE VIEW active_employees AS SELECT employee_id, first_name, last_name, department_id, salary FROM employees;`,
        `CREATE VIEW active_employees AS SELECT employee_id, last_name, first_name, department_id, salary FROM employees WHERE termination_date IS NULL;`,
      ],
      verificationQuery: verifyView('active_employees'),
      explanation: `A view is just a named SELECT. The checker reads the view's column list from the catalog and then every row it returns. A view's columns have a fixed order and names, so swapping two of them is a different view, even if the data is "all there".`,
      commonMistakes: ['Forgetting the WHERE clause.', 'Columns in a different order.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q02', topic: 21, relatedTopics: [20], difficulty: 'easy', type: 'concept-mc',
      title: 'What does a view store?',
      prompt: `You create a (regular) view over \`orders\`, then insert new orders into the table. What does the view return afterwards?`,
      options: [
        { text: 'The rows as they were when the view was created, until you refresh it' },
        { text: 'The current rows, including the new orders: a view stores only its query, which runs each time it is used' },
        { text: 'An error until the view is recreated' },
        { text: 'Only the new orders' },
      ],
      correctOption: 1,
      hints: ['Compare with a materialized view.'],
      explanation: `A regular view stores **no data**, only its definition. Every query against it runs the definition against the current tables. A **materialized** view stores a result and needs \`REFRESH MATERIALIZED VIEW\` to see changes.`,
      commonMistakes: ['Confusing regular and materialized views.'],
    },
    {
      id: 't21-q03', topic: 21, relatedTopics: [2, 3, 4, 14], difficulty: 'easy', type: 'predict-output',
      title: 'Views follow their table',
      prompt: `What does the **last** statement return?`,
      referenceSolution: `CREATE TABLE scores (player text, points integer);
INSERT INTO scores VALUES ('ana', 5), ('ben', 12);
CREATE VIEW high_scores AS SELECT player FROM scores WHERE points >= 10;
INSERT INTO scores VALUES ('cleo', 20);
UPDATE scores SET points = 3 WHERE player = 'ben';
SELECT count(*) AS players, string_agg(player, ',' ORDER BY player) AS names FROM high_scores;`,
      options: [
        { table: { columns: ['players', 'names'], rows: [['1', 'cleo']] } },
        { table: { columns: ['players', 'names'], rows: [['1', 'ben']] } },
        { table: { columns: ['players', 'names'], rows: [['2', 'ben,cleo']] } },
        { table: { columns: ['players', 'names'], rows: [['0', null]] } },
      ],
      correctOption: 0,
      hints: ['The view\'s query runs when you select from it, not when it was created.'],
      explanation: `When the view was created, only ben qualified, but that doesn't matter: the view runs its query **now**. Now cleo has 20 points and ben has 3, so only cleo is returned.`,
      commonMistakes: ['Thinking the view captured the rows at creation time.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't21-q04', topic: 21, relatedTopics: [1, 2, 11, 14], difficulty: 'easy', type: 'write-query',
      title: 'A customer order summary',
      prompt: `Create a view **\`customer_order_summary\`** with one row per customer who has placed orders (any status):

| column | meaning |
|---|---|
| \`customer_id\` | the customer |
| \`orders\` | number of orders |
| \`first_order\` | date (UTC) of the first order, type \`date\` |
| \`last_order\` | date (UTC) of the latest order, type \`date\` |`,
      hints: ['GROUP BY customer_id, `count(*)`, `min(ordered_at)::date`, `max(ordered_at)::date`.'],
      referenceSolution: `CREATE VIEW customer_order_summary AS
SELECT customer_id,
       count(*)              AS orders,
       min(ordered_at)::date AS first_order,
       max(ordered_at)::date AS last_order
FROM orders
GROUP BY customer_id;`,
      alternativeSolutions: [`CREATE VIEW customer_order_summary (customer_id, orders, first_order, last_order) AS SELECT customer_id, count(order_id), min(ordered_at::date), max(ordered_at::date) FROM orders GROUP BY 1;`],
      wrongAnswers: [
        `CREATE VIEW customer_order_summary AS SELECT customer_id, count(*) AS orders, min(ordered_at) AS first_order, max(ordered_at) AS last_order FROM orders GROUP BY customer_id;`,
        `CREATE VIEW customer_order_summary AS SELECT customer_id, count(*) AS orders, min(ordered_at)::date AS first_order, max(ordered_at)::date AS last_order FROM orders WHERE status <> 'cancelled' GROUP BY customer_id;`,
      ],
      verificationQuery: verifyView('customer_order_summary'),
      explanation: `Views can contain any query, aggregates included. The column **types** are part of the view's definition: without the \`::date\` casts, \`first_order\` and \`last_order\` would be timestamps. The task says any status, so cancelled orders count.`,
      commonMistakes: ['Leaving the dates as timestamps.', 'Filtering out cancelled orders.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q05', topic: 21, relatedTopics: [1, 2, 5, 11, 14], difficulty: 'medium', type: 'write-query',
      title: 'A monthly revenue view',
      prompt: `Create a view **\`monthly_revenue\`** with the columns \`month\` (type \`date\`, the first day of the month, UTC) and \`revenue\` (sum of line values \`quantity * unit_price * (1 - discount)\` of **non-cancelled** orders, **rounded to 2 decimals**), one row per month with orders.`,
      hints: ['Join orders and order_items, filter, `GROUP BY 1`.', 'Put the rounding inside the view.'],
      referenceSolution: `CREATE VIEW monthly_revenue AS
SELECT date_trunc('month', o.ordered_at)::date AS month,
       round(sum(${lineValue}), 2) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY 1;`,
      alternativeSolutions: [`CREATE VIEW monthly_revenue AS SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS revenue FROM orders o JOIN order_items oi USING (order_id) WHERE o.status IN ('pending', 'processing', 'shipped', 'delivered', 'returned') GROUP BY 1;`],
      wrongAnswers: [
        `CREATE VIEW monthly_revenue AS SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(${lineValue}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY 1;`,
        `CREATE VIEW monthly_revenue AS SELECT date_trunc('month', o.ordered_at)::date AS month, round(sum(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY 1;`,
      ],
      verificationQuery: verifyView('monthly_revenue'),
      explanation: `This is the main reason views exist: the definition of "revenue" (which statuses count, how discounts apply) lives in **one** place. Every report that selects from \`monthly_revenue\` uses the same rule, and fixing the rule fixes all of them.`,
      commonMistakes: ['Including cancelled orders.', 'Ignoring the discount.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q06', topic: 21, relatedTopics: [2, 3, 4, 10, 19], difficulty: 'medium', type: 'write-query',
      title: 'Updating through a view',
      prompt: `1. Create a view **\`on_sale_products\`** with the columns \`product_id\`, \`category_id\`, \`name\`, \`price\`, showing products that are **not discontinued**.
2. Then, **through the view**, lower the price of every product in it with \`category_id = 8\` (monitors) by **10%**, rounded to 2 decimals.`,
      hints: ['A single-table view without aggregates is automatically updatable.', '`UPDATE on_sale_products SET price = round(price * 0.9, 2) WHERE category_id = 8;`'],
      referenceSolution: `CREATE VIEW on_sale_products AS
SELECT product_id, category_id, name, price
FROM products
WHERE discontinued_at IS NULL;

UPDATE on_sale_products
SET price = round(price * 0.9, 2)
WHERE category_id = 8;`,
      alternativeSolutions: [`CREATE VIEW on_sale_products AS SELECT product_id, category_id, name, price FROM products WHERE discontinued_at IS NULL;
UPDATE products SET price = round(price * 0.9, 2) WHERE category_id = 8 AND discontinued_at IS NULL;`],
      wrongAnswers: [
        `CREATE VIEW on_sale_products AS SELECT product_id, category_id, name, price FROM products WHERE discontinued_at IS NULL;
UPDATE products SET price = round(price * 0.9, 2) WHERE category_id = 8;`,
        `CREATE VIEW on_sale_products AS SELECT product_id, category_id, name, price FROM products WHERE discontinued_at IS NULL;
UPDATE on_sale_products SET price = round(price * 0.1, 2) WHERE category_id = 8;`,
      ],
      verificationQuery: `${columnsShape('on_sale_products')}
UNION ALL
SELECT 'product', product_id, price::text || CASE WHEN discontinued_at IS NULL THEN '' ELSE ' (discontinued)' END
FROM products WHERE category_id = 8`,
      explanation: `PostgreSQL makes simple views **automatically updatable**: an UPDATE on the view is rewritten into an UPDATE on \`products\`, and only rows **visible through the view** are affected. The discontinued monitors keep their price.

Updating the table directly with the same filter has the same effect, but you have to repeat the view's condition yourself. That's exactly the duplication views avoid. "Lower by 10%" means multiplying by 0.9, not 0.1.`,
      commonMistakes: ['Updating the table without the view\'s condition.', 'Multiplying by 0.1.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q07', topic: 21, relatedTopics: [1, 2], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: adding a column to a view',
      prompt: `The first statement creates a view. The second should add the customers' \`email\` to it, but fails with *cannot change name of view column*. Fix the script so that the final view has the columns \`customer_id\`, \`first_name\`, \`last_name\`, \`email\`, in this order.`,
      starterSql: `CREATE VIEW customer_contacts AS
SELECT customer_id, first_name, last_name FROM customers;

CREATE OR REPLACE VIEW customer_contacts AS
SELECT customer_id, email, first_name, last_name FROM customers;`,
      hints: ['CREATE OR REPLACE VIEW must keep the existing columns (same names, types and order). New columns may only be **added at the end**.'],
      referenceSolution: `CREATE VIEW customer_contacts AS
SELECT customer_id, first_name, last_name FROM customers;

CREATE OR REPLACE VIEW customer_contacts AS
SELECT customer_id, first_name, last_name, email FROM customers;`,
      alternativeSolutions: [
        `CREATE VIEW customer_contacts AS SELECT customer_id, first_name, last_name FROM customers;
DROP VIEW customer_contacts;
CREATE VIEW customer_contacts AS SELECT customer_id, first_name, last_name, email FROM customers;`,
      ],
      wrongAnswers: [
        `CREATE VIEW customer_contacts AS SELECT customer_id, first_name, last_name FROM customers;
CREATE OR REPLACE VIEW customer_contacts AS SELECT customer_id, email, first_name, last_name FROM customers;`,
        `CREATE VIEW customer_contacts AS SELECT customer_id, first_name, last_name FROM customers;
DROP VIEW customer_contacts;
CREATE VIEW customer_contacts AS SELECT customer_id, email, first_name, last_name FROM customers;`,
      ],
      verificationQuery: verifyView('customer_contacts'),
      explanation: `\`CREATE OR REPLACE VIEW\` replaces the query but keeps the view's identity, so other objects that depend on it keep working. That's only safe if the existing columns stay as they are. You may **append** columns, but not rename, reorder, retype or remove them.

For bigger changes, \`DROP VIEW\` and \`CREATE VIEW\` again (with \`CASCADE\` if other views depend on it, recreating those too).`,
      commonMistakes: ['Inserting the new column in the middle.', 'Dropping and recreating with the wrong column order.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q08', topic: 21, relatedTopics: [2, 3, 4], difficulty: 'medium', type: 'write-query',
      title: 'Keep cheap products cheap',
      prompt: `Create a view **\`cheap_products\`** with the columns \`product_id\`, \`name\`, \`price\`, showing products priced **under 20**. Updates through the view must **not** be able to move a product out of the view (e.g. raise its price to 20 or more).`,
      hints: ['`… WHERE price < 20 WITH CHECK OPTION`'],
      referenceSolution: `CREATE VIEW cheap_products AS
SELECT product_id, name, price
FROM products
WHERE price < 20
WITH CHECK OPTION;`,
      alternativeSolutions: [`CREATE VIEW cheap_products AS SELECT product_id, name, price FROM products WHERE price < 20.00 WITH CASCADED CHECK OPTION;`],
      wrongAnswers: [
        `CREATE VIEW cheap_products AS SELECT product_id, name, price FROM products WHERE price < 20;`,
        `CREATE VIEW cheap_products AS SELECT product_id, name, price FROM products WHERE price <= 20 WITH CHECK OPTION;`,
      ],
      verificationQuery: `${ATTEMPT_FN};
${columnsShape('cheap_products')}
UNION ALL
SELECT 'rows', 0, count(*)::text FROM cheap_products
UNION ALL
${attemptsShape([
  ['raise a cheap product to 25', `UPDATE cheap_products SET price = 25 WHERE product_id = (SELECT min(product_id) FROM cheap_products)`],
  ['raise a cheap product to exactly 20', `UPDATE cheap_products SET price = 20 WHERE product_id = (SELECT min(product_id) FROM cheap_products)`],
  ['lower a cheap product to 9.99', `UPDATE cheap_products SET price = 9.99 WHERE product_id = (SELECT min(product_id) FROM cheap_products)`],
])}`,
      explanation: `Without a check option, \`UPDATE cheap_products SET price = 25 …\` succeeds and the product silently vanishes from the view. \`WITH CHECK OPTION\` makes PostgreSQL verify that every row inserted or updated through the view still satisfies its WHERE, and reject it otherwise (SQLSTATE 44000).

"Under 20" excludes 20 itself, so \`price <= 20\` would let a product be raised to exactly 20.`,
      commonMistakes: ['Forgetting WITH CHECK OPTION.', '<= instead of <.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q09', topic: 21, relatedTopics: [1, 2], difficulty: 'medium', type: 'predict-output',
      title: 'SELECT * in a view',
      prompt: `What does the **last** statement return?`,
      referenceSolution: `CREATE TABLE pets (name text);
INSERT INTO pets VALUES ('Rex');
CREATE VIEW all_pets AS SELECT * FROM pets;
ALTER TABLE pets ADD COLUMN species text DEFAULT 'dog';
SELECT * FROM all_pets;`,
      options: [
        { table: { columns: ['name'], rows: [['Rex']] } },
        { table: { columns: ['name', 'species'], rows: [['Rex', 'dog']] } },
        { table: { columns: ['name', 'species'], rows: [['Rex', null]] } },
        { table: { columns: ['species', 'name'], rows: [['dog', 'Rex']] } },
      ],
      correctOption: 0,
      hints: ['When is the `*` of a view expanded?'],
      explanation: `\`SELECT *\` in a view definition is expanded into the column list **when the view is created**. The view is stored as \`SELECT pets.name FROM pets\`, so the column added later isn't part of it. To include it, recreate the view (or \`CREATE OR REPLACE\` it, adding the column at the end).`,
      commonMistakes: ['Expecting the view to pick up new columns.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't21-q10', topic: 21, relatedTopics: [1, 2, 5, 14], difficulty: 'hard', type: 'write-query',
      title: 'A materialized category report',
      prompt: `Create a **materialized view** \`category_revenue\` with the columns \`category_id\` and \`revenue\` (sum of line values of non-cancelled orders for products in that category, **rounded to 2 decimals**), one row per category that has sales.`,
      hints: ['`CREATE MATERIALIZED VIEW category_revenue AS SELECT …`'],
      referenceSolution: `CREATE MATERIALIZED VIEW category_revenue AS
SELECT p.category_id, round(sum(${lineValue}), 2) AS revenue
FROM order_items oi
JOIN orders o   ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE o.status <> 'cancelled'
GROUP BY p.category_id;`,
      alternativeSolutions: [`CREATE MATERIALIZED VIEW category_revenue (category_id, revenue) AS SELECT p.category_id, round(sum(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) FROM products p JOIN order_items oi USING (product_id) JOIN orders o USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1 WITH DATA;`],
      wrongAnswers: [
        `CREATE VIEW category_revenue AS SELECT p.category_id, round(sum(${lineValue}), 2) AS revenue FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status <> 'cancelled' GROUP BY p.category_id;`,
        `CREATE MATERIALIZED VIEW category_revenue AS SELECT p.category_id, round(sum(${lineValue}), 2) AS revenue FROM order_items oi JOIN orders o ON o.order_id = oi.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY p.category_id;`,
      ],
      verificationQuery: verifyMatview('category_revenue'),
      explanation: `A materialized view runs its query once, at creation (\`WITH DATA\` is the default), and stores the result. Reading it is as cheap as reading a small table, which suits reports over big joins. In exchange the data is frozen until \`REFRESH MATERIALIZED VIEW category_revenue\`.

The checker looks at the relation's kind in \`pg_class\`: \`m\` for a materialized view, \`v\` for a regular view.`,
      commonMistakes: ['Creating a regular view.', 'Including cancelled orders.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q11', topic: 21, relatedTopics: [2, 3, 14], difficulty: 'hard', type: 'predict-output',
      title: 'A stale snapshot',
      prompt: `What does the **last** statement return?`,
      referenceSolution: `CREATE TABLE visits (id integer);
INSERT INTO visits VALUES (1), (2);
CREATE MATERIALIZED VIEW visit_count AS SELECT count(*) AS n FROM visits;
CREATE VIEW live_count AS SELECT count(*) AS n FROM visits;
INSERT INTO visits VALUES (3), (4);
CREATE TABLE snapshot AS SELECT n FROM visit_count;
REFRESH MATERIALIZED VIEW visit_count;
INSERT INTO visits VALUES (5);
SELECT (SELECT n FROM snapshot)    AS before_refresh,
       (SELECT n FROM visit_count) AS materialized,
       (SELECT n FROM live_count)  AS live;`,
      options: [
        { table: { columns: ['before_refresh', 'materialized', 'live'], rows: [['2', '4', '5']] } },
        { table: { columns: ['before_refresh', 'materialized', 'live'], rows: [['4', '4', '5']] } },
        { table: { columns: ['before_refresh', 'materialized', 'live'], rows: [['2', '5', '5']] } },
        { table: { columns: ['before_refresh', 'materialized', 'live'], rows: [['2', '2', '5']] } },
      ],
      correctOption: 0,
      hints: ['The materialized view only changes when it is refreshed. The regular view is computed on every read.'],
      explanation: `The materialized view counted 2 rows at creation and still said 2 before the refresh (copied into \`snapshot\`). The refresh re-ran its query when there were 4 rows. The 5th row came later, so it still says **4**. The regular view always counts the current rows: **5**.`,
      commonMistakes: ['Expecting the materialized view to update itself.', 'Expecting the regular view to be cached.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't21-q12', topic: 21, relatedTopics: [1, 2, 5, 14, 19], difficulty: 'hard', type: 'write-query',
      title: 'A view on a view',
      prompt: `Create two views:

1. **\`customer_spend\`**: \`customer_id\`, \`orders\` (number of non-cancelled orders), \`spend\` (sum of their line values, rounded to 2 decimals), one row per customer with non-cancelled orders.
2. **\`vip_customers\`**: \`customer_id\`, \`spend\` for customers whose spend is **at least 5 000**, built **on top of \`customer_spend\`**.`,
      hints: ['Count orders with `count(DISTINCT o.order_id)` after joining the lines.', '`CREATE VIEW vip_customers AS SELECT customer_id, spend FROM customer_spend WHERE spend >= 5000;`'],
      referenceSolution: `CREATE VIEW customer_spend AS
SELECT o.customer_id,
       count(DISTINCT o.order_id) AS orders,
       round(sum(${lineValue}), 2) AS spend
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY o.customer_id;

CREATE VIEW vip_customers AS
SELECT customer_id, spend
FROM customer_spend
WHERE spend >= 5000;`,
      alternativeSolutions: [],
      wrongAnswers: [
        `CREATE VIEW customer_spend AS SELECT o.customer_id, count(*) AS orders, round(sum(${lineValue}), 2) AS spend FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id;
CREATE VIEW vip_customers AS SELECT customer_id, spend FROM customer_spend WHERE spend >= 5000;`,
        `CREATE VIEW customer_spend AS SELECT o.customer_id, count(DISTINCT o.order_id) AS orders, round(sum(${lineValue}), 2) AS spend FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id;
CREATE VIEW vip_customers AS SELECT o.customer_id, round(sum(${lineValue}), 2) AS spend FROM orders o JOIN order_items oi ON oi.order_id = o.order_id GROUP BY o.customer_id HAVING sum(${lineValue}) >= 5000;`,
      ],
      verificationQuery: `${verifyView('customer_spend')}
UNION ALL
${verifyView('vip_customers')}`,
      explanation: `Views compose: \`vip_customers\` reuses the spend rule from \`customer_spend\`, so the definition of "spend" lives in one place. PostgreSQL expands nested views into one query when you select from them.

Re-deriving the spend inside \`vip_customers\` instead of reusing the first view is how rules drift apart: the copy above forgot the cancelled filter. The trap in the first view is the grain: after joining order lines, \`count(*)\` counts **lines**. Use \`count(DISTINCT o.order_id)\`.`,
      commonMistakes: ['count(*) after joining order lines.', 'Recomputing spend in the second view instead of reusing the first.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q13', topic: 21, relatedTopics: [2], difficulty: 'hard', type: 'concept-mc',
      title: 'Dropping a table that a view uses',
      prompt: `The view \`monthly_revenue\` selects from \`orders\` and \`order_items\`. What happens on \`DROP TABLE order_items;\`?`,
      options: [
        { text: 'The table is dropped, and the view returns an error the next time it is used' },
        { text: 'The table is dropped, and the view returns no rows' },
        { text: 'The DROP fails because the view depends on the table. `DROP TABLE order_items CASCADE` would drop the view as well.' },
        { text: 'The view keeps a copy of the data, so it keeps working' },
      ],
      correctOption: 2,
      hints: ['PostgreSQL tracks dependencies between objects.'],
      explanation: `PostgreSQL records that the view depends on the table (in \`pg_depend\`) and refuses to drop the table while the view exists: *cannot drop table order_items because other objects depend on it*. \`CASCADE\` drops the dependent views too, which is convenient but easy to regret. The same protection applies to \`ALTER TABLE … DROP COLUMN\` of a column the view uses.`,
      commonMistakes: ['Assuming views break silently, as in some other databases.'],
    },
    {
      id: 't21-q14', topic: 21, relatedTopics: [1, 2, 11, 17], difficulty: 'hard', type: 'write-query',
      title: 'Each customer’s latest order',
      prompt: `Create a view **\`latest_orders\`** with one row per customer: their **most recent** order (by \`ordered_at\`; if two orders share the timestamp, the higher \`order_id\`), with the columns \`customer_id\`, \`order_id\`, \`ordered_at\`, \`status\`.`,
      hints: ['`DISTINCT ON (customer_id) … ORDER BY customer_id, ordered_at DESC, order_id DESC`', 'Or `row_number()` in a subquery, keeping rn = 1.'],
      referenceSolution: `CREATE VIEW latest_orders AS
SELECT DISTINCT ON (customer_id) customer_id, order_id, ordered_at, status
FROM orders
ORDER BY customer_id, ordered_at DESC, order_id DESC;`,
      alternativeSolutions: [
        `CREATE VIEW latest_orders AS SELECT customer_id, order_id, ordered_at, status FROM (SELECT customer_id, order_id, ordered_at, status, row_number() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC, order_id DESC) AS rn FROM orders) t WHERE rn = 1;`,
      ],
      wrongAnswers: [
        `CREATE VIEW latest_orders AS SELECT DISTINCT ON (customer_id) customer_id, order_id, ordered_at, status FROM orders ORDER BY customer_id, ordered_at, order_id;`,
        `CREATE VIEW latest_orders AS SELECT customer_id, max(order_id) AS order_id, max(ordered_at) AS ordered_at, max(status) AS status FROM orders GROUP BY customer_id;`,
      ],
      verificationQuery: verifyView('latest_orders'),
      explanation: `"The latest row per group" is a pattern worth hiding behind a view. DISTINCT ON keeps the first row of each customer in the given order, so the order must be **descending** by time.

Taking \`max()\` of each column separately mixes values from different orders: the highest \`order_id\`, the latest time and the alphabetically last status don't have to belong to the same order.`,
      commonMistakes: ['Ascending order, which keeps the first order.', 'max() per column, which mixes rows.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q15', topic: 21, relatedTopics: [1, 2, 5, 11, 14], difficulty: 'interview', type: 'write-query',
      title: 'A refreshable daily sales snapshot',
      prompt: `Create a **materialized view** \`daily_sales\` with the columns \`day\` (type \`date\`, UTC), \`orders\` (number of non-cancelled orders that day) and \`revenue\` (their line values, rounded to 2 decimals). Make it possible to refresh it with \`REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales\`, which requires a **unique index** on the materialized view, here on \`day\`.`,
      hints: ['Count orders with `count(DISTINCT o.order_id)`.', '`CREATE UNIQUE INDEX ON daily_sales (day);`'],
      referenceSolution: `CREATE MATERIALIZED VIEW daily_sales AS
SELECT o.ordered_at::date AS day,
       count(DISTINCT o.order_id) AS orders,
       round(sum(${lineValue}), 2) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY 1;

CREATE UNIQUE INDEX daily_sales_day_idx ON daily_sales (day);`,
      alternativeSolutions: [
        `CREATE MATERIALIZED VIEW daily_sales (day, orders, revenue) AS SELECT o.ordered_at::date, count(DISTINCT o.order_id), round(sum(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1;
CREATE UNIQUE INDEX ON daily_sales (day);
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sales;`,
      ],
      wrongAnswers: [
        `CREATE MATERIALIZED VIEW daily_sales AS SELECT o.ordered_at::date AS day, count(DISTINCT o.order_id) AS orders, round(sum(${lineValue}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY 1;
CREATE INDEX ON daily_sales (day);`,
        `CREATE MATERIALIZED VIEW daily_sales AS SELECT o.ordered_at::date AS day, count(*) AS orders, round(sum(${lineValue}), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY 1;
CREATE UNIQUE INDEX ON daily_sales (day);`,
      ],
      verificationQuery: `${verifyMatview('daily_sales')}
UNION ALL
SELECT 'index', 0, (SELECT string_agg(a.attname, ', ' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey))
                   || CASE WHEN i.indisunique THEN ' (unique)' ELSE '' END
FROM pg_index i
WHERE i.indrelid = 'daily_sales'::regclass`,
      explanation: `A plain \`REFRESH MATERIALIZED VIEW\` locks the view against reads while it rebuilds. \`CONCURRENTLY\` builds the new result on the side and applies the differences, so readers are never blocked. To match old and new rows it needs a **unique index** covering every row (a plain index isn't enough).

Indexes on materialized views also speed up lookups like \`WHERE day = …\`. And as always with order lines: count distinct orders.`,
      commonMistakes: ['A non-unique index, so CONCURRENTLY refuses to run.', 'Counting order lines.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't21-q16', topic: 21, relatedTopics: [1, 2, 5, 11, 14, 19, 20], difficulty: 'interview', type: 'write-query',
      title: 'An RFM view',
      prompt: `Marketing wants a view **\`customer_rfm\`** with one row per customer who has **non-cancelled** orders:

| column | meaning |
|---|---|
| \`customer_id\` | the customer |
| \`recency_days\` | days from their latest non-cancelled order (UTC date) to the reference date **2025-06-30** (integer) |
| \`frequency\` | number of non-cancelled orders |
| \`monetary\` | total line value of those orders, rounded to 2 decimals |`,
      hints: ['Aggregate per order first (or count distinct orders), then per customer.', '`DATE \'2025-06-30\' - max(ordered_at)::date` is an integer.'],
      referenceSolution: `CREATE VIEW customer_rfm AS
WITH order_value AS (
  SELECT o.order_id, o.customer_id, o.ordered_at, sum(${lineValue}) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status <> 'cancelled'
  GROUP BY o.order_id
)
SELECT customer_id,
       DATE '2025-06-30' - max(ordered_at)::date AS recency_days,
       count(*)                                   AS frequency,
       round(sum(value), 2)                       AS monetary
FROM order_value
GROUP BY customer_id;`,
      alternativeSolutions: [
        `CREATE VIEW customer_rfm AS SELECT o.customer_id, DATE '2025-06-30' - max(o.ordered_at::date) AS recency_days, count(DISTINCT o.order_id) AS frequency, round(sum(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS monetary FROM orders o JOIN order_items oi USING (order_id) WHERE o.status <> 'cancelled' GROUP BY 1;`,
      ],
      wrongAnswers: [
        `CREATE VIEW customer_rfm AS SELECT o.customer_id, DATE '2025-06-30' - max(o.ordered_at::date) AS recency_days, count(*) AS frequency, round(sum(${lineValue}), 2) AS monetary FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id;`,
        `CREATE VIEW customer_rfm AS SELECT o.customer_id, DATE '2025-06-30' - min(o.ordered_at::date) AS recency_days, count(DISTINCT o.order_id) AS frequency, round(sum(${lineValue}), 2) AS monetary FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status <> 'cancelled' GROUP BY o.customer_id;`,
      ],
      verificationQuery: verifyView('customer_rfm'),
      explanation: `RFM (recency, frequency, monetary) is a standard customer-segmentation input, and a good candidate for a view: analysts query it constantly, and it encodes several decisions (which orders count, the reference date, the money formula) that should be the same everywhere.

A view can contain a CTE. Recency uses the **latest** order (\`max\`). Frequency counts orders, not lines, which is why the order values are built first.`,
      commonMistakes: ['Counting lines as frequency.', 'Using the first order for recency.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
