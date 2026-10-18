import type { Topic } from '../types.ts';

const explanation = `DML (Data Manipulation Language) changes the **data**: \`INSERT\` adds rows, \`UPDATE\` changes them, \`DELETE\` removes them. Topic 2's DDL changes the structure instead.

> Every Run and Check in this app is wrapped in a transaction that is **rolled back**, so experiment freely. In a real database, test your WHERE clause with a SELECT before running an UPDATE or DELETE.

UPDATE and DELETE need a \`WHERE\` clause to pick the rows they touch. WHERE is covered fully in Topic 4. Here we only use simple conditions such as \`WHERE department_id = 7\`.

## INSERT

\`\`\`sql
INSERT INTO departments (department_id, name, location, budget)
VALUES (11, 'Data Science', 'Berlin', 500000),
       (12, 'Partnerships', NULL, NULL)
RETURNING *;
\`\`\`

- **Always list the columns.** It documents intent and survives column additions. Columns you leave out get their DEFAULT (or NULL), and identity columns generate their value.
- One statement can insert several rows, or the rows of a query: \`INSERT INTO t (cols) SELECT …\`.
- \`RETURNING\` hands back the inserted rows, including generated ids, so you don't need a second query.

\`\`\`sql
INSERT INTO suppliers (name, country_id, created_at)
VALUES ('Nordwind Imports', 9, DATE '2025-06-30')
RETURNING supplier_id, name;
\`\`\`

## UPDATE

\`\`\`sql
UPDATE departments
SET budget = budget * 1.10,
    location = 'Amsterdam'
WHERE name = 'Marketing'
RETURNING department_id, budget, location;
\`\`\`

- \`SET\` can assign several columns. Every expression sees the row's **old** values.
- **Without WHERE, every row is updated.** PostgreSQL reports \`UPDATE n\`, so check that number.
- PostgreSQL's \`UPDATE … FROM other_table WHERE join-condition\` updates rows using values from another table. Always write the join condition, or each row is matched against *every* row of the other table.

\`\`\`sql
-- Give orders without a shipping country the customer's home country
UPDATE orders o
SET ship_country_id = c.country_id
FROM customers c
WHERE c.customer_id = o.customer_id
  AND o.ship_country_id IS NULL;
\`\`\`

## DELETE

\`\`\`sql
DELETE FROM payments
WHERE status = 'failed'
RETURNING payment_id;
\`\`\`

\`DELETE FROM t\` without WHERE empties the table. \`DELETE … USING other\` is the join form, mirroring UPDATE … FROM. Foreign keys may block a delete (error 23503) unless they were declared \`ON DELETE CASCADE\`.

## Upsert: INSERT … ON CONFLICT

\`\`\`sql
INSERT INTO departments (department_id, name, location, budget)
VALUES (2, 'Sales', 'Paris', 4500000)
ON CONFLICT (department_id) DO UPDATE
  SET location = EXCLUDED.location,
      budget   = EXCLUDED.budget;
\`\`\`

When the new row would violate the unique key, \`DO NOTHING\` skips it, and \`DO UPDATE\` changes the existing row instead. \`EXCLUDED\` refers to the row you tried to insert.

## MERGE

PostgreSQL 15+ supports the standard \`MERGE\`. It applies a source to a target and decides per row what to do:

\`\`\`sql
MERGE INTO departments AS d
USING (VALUES (3, 3300000.00), (14, 100000.00)) AS v(department_id, budget)
ON d.department_id = v.department_id
WHEN MATCHED THEN UPDATE SET budget = v.budget
WHEN NOT MATCHED THEN INSERT (department_id, name, budget) VALUES (v.department_id, 'Dept ' || v.department_id, v.budget);
SELECT * FROM departments ORDER BY department_id;
\`\`\`

## Good habits and gotchas

- Run the WHERE clause as a \`SELECT\` first. Then turn it into the UPDATE/DELETE.
- Arithmetic with NULL stays NULL: \`SET budget = budget + 1\` leaves NULL budgets NULL.
- Writing to a \`numeric(10,2)\` column rounds to 2 decimals automatically.
- \`TRUNCATE\` (Topic 2) is faster than \`DELETE\` for emptying a table, but it can't filter rows.
- In real work, wrap related changes in \`BEGIN … COMMIT\`, so they all succeed or all fail. The app does this for you.`;

const deptVerify = `SELECT department_id, name, location, budget FROM departments`;

const topic: Topic = {
  id: 3,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18: Data Manipulation (chapter 6)', url: 'https://www.postgresql.org/docs/18/dml.html' },
    { title: 'PostgreSQL 18 Reference: INSERT (incl. ON CONFLICT)', url: 'https://www.postgresql.org/docs/18/sql-insert.html' },
    { title: 'PostgreSQL 18 Reference: UPDATE', url: 'https://www.postgresql.org/docs/18/sql-update.html' },
    { title: 'PostgreSQL 18 Reference: MERGE', url: 'https://www.postgresql.org/docs/18/sql-merge.html' },
    { title: 'Neon PostgreSQL Tutorial: UPSERT with INSERT ON CONFLICT', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-upsert' },
  ],
  questions: [
    {
      id: 't03-q02', topic: 3, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'Add a department',
      prompt: `Insert a new department: id **11**, name **'Data Science'**, location **'Berlin'**, budget **500000**.`,
      hints: ['`INSERT INTO departments (department_id, name, location, budget) VALUES (…)`'],
      referenceSolution: `INSERT INTO departments (department_id, name, location, budget)
VALUES (11, 'Data Science', 'Berlin', 500000);`,
      alternativeSolutions: [`INSERT INTO departments VALUES (11, 'Data Science', 'Berlin', 500000.00);`],
      wrongAnswers: [
        `INSERT INTO departments (department_id, name, location, budget) VALUES (11, 'Data Science', 'berlin', 500000);`,
        `INSERT INTO departments (department_id, name, location, budget) VALUES (11, 'Data Science', 'Berlin', 50000);`,
      ],
      verificationQuery: deptVerify,
      explanation: `Name the columns, then give the values in the same order. Text needs single quotes, numbers don't.

Leaving out the column list works too, but it silently depends on the table's column order. If a column is ever added, the statement breaks or puts values in the wrong place.`,
      commonMistakes: ['Double quotes around text values. Those mean identifiers.', 'Typos in values: comparisons are exact, and \'berlin\' ≠ \'Berlin\'.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't03-q03', topic: 3, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'Two new suppliers',
      prompt: `Add two suppliers, **in this order**, and let the database generate their \`supplier_id\`:

| name | country_id | contact_email | rating | created_at |
|---|---|---|---|---|
| Nordwind Imports | 9 | orders@nordwind.example | *(none)* | 2025-06-30 |
| Pampas Supply | 5 | *(none)* | 4.5 | 2025-06-30 |`,
      hints: ['Don\'t list `supplier_id`: the identity column fills it in.', 'One INSERT can carry several rows: `VALUES (…), (…)`. Use NULL for "none".'],
      referenceSolution: `INSERT INTO suppliers (name, country_id, contact_email, rating, created_at)
VALUES ('Nordwind Imports', 9, 'orders@nordwind.example', NULL, DATE '2025-06-30'),
       ('Pampas Supply',    5, NULL,                      4.5,  DATE '2025-06-30');`,
      alternativeSolutions: [
        `INSERT INTO suppliers (name, country_id, contact_email, created_at) VALUES ('Nordwind Imports', 9, 'orders@nordwind.example', '2025-06-30');
INSERT INTO suppliers (name, country_id, rating, created_at) VALUES ('Pampas Supply', 5, 4.5, '2025-06-30');`,
      ],
      wrongAnswers: [
        `INSERT INTO suppliers (name, country_id, contact_email, rating, created_at) VALUES ('Pampas Supply', 5, NULL, 4.5, DATE '2025-06-30'), ('Nordwind Imports', 9, 'orders@nordwind.example', NULL, DATE '2025-06-30');`,
        `INSERT INTO suppliers (name, country_id, contact_email, rating, created_at) VALUES ('Nordwind Imports', 9, 'orders@nordwind.example', NULL, DATE '2025-06-30');`,
        `INSERT INTO suppliers (name, country_id, contact_email, rating, created_at) VALUES ('Nordwind Imports', 9, 'orders@nordwind.example', 0, DATE '2025-06-30'), ('Pampas Supply', 5, '', 4.5, DATE '2025-06-30');`,
      ],
      verificationQuery: `SELECT supplier_id, name, country_id, contact_email, rating, created_at FROM suppliers`,
      explanation: `- \`supplier_id\` is \`GENERATED BY DEFAULT AS IDENTITY\`. Leave it out of the column list and the next numbers are assigned, in insert order.
- "None" is NULL, not \`0\` and not \`''\`. An empty string is a value. NULL means "unknown / not provided".
- A single multi-row INSERT is the usual way to add several rows, and it's atomic: all rows or none.`,
      commonMistakes: ['Using 0 or \'\' instead of NULL for missing values.', 'Inserting in a different order, which swaps the generated ids.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q04', topic: 3, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'What does RETURNING do?',
      prompt: `What does adding \`RETURNING order_id, status\` to an \`UPDATE orders …\` statement do?`,
      options: [
        { text: 'It returns the listed columns of every row the UPDATE changed, with their new values.' },
        { text: 'It returns the listed columns of the rows *before* they were changed.' },
        { text: 'It undoes the update if no row matched.' },
        { text: 'It only works with INSERT, so it causes a syntax error.' },
      ],
      correctOption: 0,
      hints: ['RETURNING works with INSERT, UPDATE, DELETE and MERGE.'],
      explanation: `\`RETURNING\` makes a data-changing statement also return rows: the affected rows, with values **after** the change (for DELETE, the deleted rows). It saves a second SELECT and is the standard way to get generated ids back from an INSERT.`,
      commonMistakes: ['Expecting the old values. Use a CTE or a prior SELECT for those.'],
    },
    {
      id: 't03-q05', topic: 3, relatedTopics: [1], previewTopics: [4], difficulty: 'easy', type: 'write-query',
      title: 'Raise a department budget',
      prompt: `Increase the **Marketing** department's budget by **100 000**. No other department may change.`,
      hints: ['`UPDATE departments SET budget = budget + 100000 WHERE …`'],
      referenceSolution: `UPDATE departments
SET budget = budget + 100000
WHERE name = 'Marketing';`,
      alternativeSolutions: [`UPDATE departments SET budget = budget + 100000.00 WHERE department_id = 3;`],
      wrongAnswers: [
        `UPDATE departments SET budget = budget + 100000;`,
        `UPDATE departments SET budget = 100000 WHERE name = 'Marketing';`,
      ],
      verificationQuery: deptVerify,
      explanation: `\`SET budget = budget + 100000\` reads the old value and adds to it. WHERE limits the change to one row. Without WHERE, *every* department would get the raise (and NULL budgets would stay NULL).`,
      commonMistakes: ['Forgetting WHERE.', 'Setting the budget *to* 100000 instead of adding.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't03-q01',
      topic: 3,
      relatedTopics: [1],
      previewTopics: [4],
      difficulty: 'medium',
      type: 'write-query',
      title: 'Cancel stale pending orders',
      prompt: `Customer support is closing out abandoned checkouts.

Write **one \`UPDATE\` statement** that sets \`status\` to \`'cancelled'\` for every order that:

- still has \`status = 'pending'\`, **and**
- was placed **before 1 June 2025**, i.e. \`ordered_at < '2025-06-01'\` (timestamps are UTC).

All other orders, including pending orders placed on or after 1 June 2025, must stay unchanged.

*The checker runs your statement, then inspects the \`orders\` table. Every run is rolled back afterwards, so you can try as often as you like.*`,
      hints: [
        'The statement has the shape `UPDATE orders SET … WHERE …`.',
        'The WHERE clause needs two conditions joined with AND: one on `status` and one on `ordered_at`.',
        'Run `SELECT order_id, status, ordered_at FROM orders WHERE status = \'pending\'` first to see which rows you are about to change.',
      ],
      referenceSolution: `UPDATE orders
SET status = 'cancelled'
WHERE status = 'pending'
  AND ordered_at < '2025-06-01';`,
      alternativeSolutions: [
        `UPDATE orders SET status = 'cancelled' WHERE ordered_at < TIMESTAMPTZ '2025-06-01 00:00:00+00' AND status = 'pending';`,
        `UPDATE orders AS o SET status = 'cancelled' WHERE o.status IN ('pending') AND o.ordered_at < DATE '2025-06-01';`,
      ],
      wrongAnswers: [
        `UPDATE orders SET status = 'cancelled' WHERE status = 'pending';`,
        `UPDATE orders SET status = 'cancelled' WHERE ordered_at < '2025-06-01';`,
        `UPDATE orders SET status = 'canceled' WHERE status = 'pending' AND ordered_at < '2025-06-01';`,
      ],
      verificationQuery: `SELECT order_id, status FROM orders WHERE status IN ('pending', 'cancelled')`,
      explanation: `1. **Pick the table and the new value:** \`UPDATE orders SET status = 'cancelled'\`.
2. **Restrict the rows:** without a WHERE clause, UPDATE changes *every* row in the table. Here a row must satisfy both conditions, so combine them with AND.
3. **Compare timestamps carefully:** \`ordered_at\` is a \`timestamptz\`. The literal \`'2025-06-01'\` is read as midnight at the start of 1 June in the session time zone (UTC here), so \`<\` keeps exactly the orders placed before that day.
4. **Check the effect:** PostgreSQL reports \`UPDATE n\`, the number of rows changed. A quick \`SELECT status, count(*) FROM orders GROUP BY status\` before and after (in the same run) confirms it.`,
      commonMistakes: [
        'Forgetting the date condition, which also cancels pending orders that are only a few days old.',
        'Forgetting the status condition, which cancels delivered orders too. Always check how many rows an UPDATE affects.',
        "Misspelling the value (`'canceled'`). The CHECK constraint on `orders.status` rejects it with an error.",
      ],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q06', topic: 3, relatedTopics: [1, 2], previewTopics: [4], difficulty: 'medium', type: 'write-query',
      title: 'Archive discontinued products',
      prompt: `Create a table and fill it in one go:

1. Create **\`discontinued_products\`** with columns \`product_id integer PRIMARY KEY\`, \`sku text NOT NULL\`, \`discontinued_at date NOT NULL\`.
2. Copy into it **every product that has a \`discontinued_at\` date**.`,
      hints: ['`INSERT INTO target (cols) SELECT cols FROM source WHERE …` inserts the rows of a query.', 'Only products with `discontinued_at IS NOT NULL`.'],
      referenceSolution: `CREATE TABLE discontinued_products (
  product_id      integer PRIMARY KEY,
  sku             text NOT NULL,
  discontinued_at date NOT NULL
);

INSERT INTO discontinued_products (product_id, sku, discontinued_at)
SELECT product_id, sku, discontinued_at
FROM products
WHERE discontinued_at IS NOT NULL;`,
      alternativeSolutions: [
        `CREATE TABLE discontinued_products (product_id integer PRIMARY KEY, sku text NOT NULL, discontinued_at date NOT NULL);
INSERT INTO discontinued_products SELECT product_id, sku, discontinued_at FROM products WHERE NOT (discontinued_at IS NULL);`,
      ],
      wrongAnswers: [
        `CREATE TABLE discontinued_products (product_id integer PRIMARY KEY, sku text NOT NULL, discontinued_at date NOT NULL);
INSERT INTO discontinued_products (product_id, sku, discontinued_at) SELECT product_id, sku, launched_at FROM products WHERE discontinued_at IS NOT NULL;`,
        `CREATE TABLE discontinued_products (product_id integer PRIMARY KEY, sku text NOT NULL, discontinued_at date NOT NULL);
INSERT INTO discontinued_products (product_id, sku, discontinued_at) SELECT product_id, sku, discontinued_at FROM products WHERE discontinued_at > '2024-01-01';`,
      ],
      verificationQuery: `SELECT product_id, sku, discontinued_at FROM discontinued_products`,
      explanation: `\`INSERT … SELECT\` inserts whatever the query returns. That's set-based and much faster than inserting rows one by one.

The columns of the SELECT are matched to the INSERT column list **by position**, not by name. Selecting \`launched_at\` into the \`discontinued_at\` column would happily store the wrong dates.`,
      commonMistakes: ['Selecting the wrong date column. Matching is by position.', 'Forgetting the filter. The NOT NULL constraint then rejects products without a date.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q07', topic: 3, relatedTopics: [1], previewTopics: [4, 5], difficulty: 'medium', type: 'write-query',
      title: 'Fill in missing shipping countries',
      prompt: `Some orders have no \`ship_country_id\` (NULL). For those orders only, set \`ship_country_id\` to the **ordering customer's** \`country_id\`. Orders that already have a shipping country must not change.

*(If the customer's country is also unknown, the order simply stays NULL.)*`,
      hints: ['PostgreSQL\'s `UPDATE … FROM customers c WHERE c.customer_id = orders.customer_id …` reads values from another table.', 'Don\'t forget the condition that limits the update to orders without a shipping country.'],
      referenceSolution: `UPDATE orders AS o
SET ship_country_id = c.country_id
FROM customers AS c
WHERE c.customer_id = o.customer_id
  AND o.ship_country_id IS NULL;`,
      alternativeSolutions: [
        `UPDATE orders SET ship_country_id = (SELECT c.country_id FROM customers c WHERE c.customer_id = orders.customer_id) WHERE ship_country_id IS NULL;`,
      ],
      wrongAnswers: [
        `UPDATE orders AS o SET ship_country_id = c.country_id FROM customers AS c WHERE c.customer_id = o.customer_id;`,
        `UPDATE orders AS o SET ship_country_id = c.country_id FROM customers AS c WHERE o.ship_country_id IS NULL;`,
      ],
      verificationQuery: `SELECT order_id, ship_country_id FROM orders`,
      explanation: `1. \`UPDATE orders AS o … FROM customers AS c\` makes the customer row available.
2. \`WHERE c.customer_id = o.customer_id\` is the **join condition**. Without it, each order is matched with *every* customer, and an arbitrary customer's country is written.
3. \`AND o.ship_country_id IS NULL\` protects orders that already have a country.

The alternative uses a correlated subquery (Topic 19). It's equivalent here.`,
      commonMistakes: ['Leaving out the join condition, which writes an arbitrary customer\'s country.', 'Leaving out the IS NULL filter, which overwrites real shipping countries.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q08', topic: 3, relatedTopics: [1], previewTopics: [4], difficulty: 'medium', type: 'write-query',
      title: 'Purge old failed payments',
      prompt: `Delete every payment with \`status = 'failed'\` that was made **before 1 January 2025** (\`paid_at < '2025-01-01'\`). All other payments stay.`,
      hints: ['`DELETE FROM payments WHERE … AND …`'],
      referenceSolution: `DELETE FROM payments
WHERE status = 'failed'
  AND paid_at < '2025-01-01';`,
      alternativeSolutions: [`DELETE FROM payments WHERE paid_at < TIMESTAMPTZ '2025-01-01 00:00:00+00' AND status IN ('failed');`],
      wrongAnswers: [
        `DELETE FROM payments WHERE status = 'failed';`,
        `DELETE FROM payments WHERE status = 'failed' AND paid_at < '2024-01-01';`,
      ],
      verificationQuery: `SELECT payment_id, status FROM payments`,
      explanation: `Both conditions must hold, so combine them with AND. "Before 1 January 2025" is \`paid_at < '2025-01-01'\`, which includes the whole of 31 December. Be careful with \`<= '2024-12-31'\`: on a timestamp it means "up to 31 Dec **00:00**" and misses that day's payments.`,
      commonMistakes: ['Deleting all failed payments.', 'Using the wrong cut-off year.', 'Using `<= \'2024-12-31\'` on a timestamp, which misses the last day.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q09', topic: 3, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Upsert departments',
      prompt: `Apply this department data with a **single INSERT … ON CONFLICT** statement:

| department_id | name | location | budget |
|---|---|---|---|
| 2 | Sales | Paris | 4500000 |
| 12 | Partnerships | Dublin | 800000 |

If a department with that id already exists, **update its location and budget** (keep its name). Otherwise, insert it.`,
      hints: ['`INSERT … VALUES (…), (…) ON CONFLICT (department_id) DO UPDATE SET …`', 'Inside DO UPDATE, `EXCLUDED.col` is the value you tried to insert.'],
      referenceSolution: `INSERT INTO departments (department_id, name, location, budget)
VALUES (2, 'Sales', 'Paris', 4500000),
       (12, 'Partnerships', 'Dublin', 800000)
ON CONFLICT (department_id) DO UPDATE
SET location = EXCLUDED.location,
    budget   = EXCLUDED.budget;`,
      alternativeSolutions: [
        `INSERT INTO departments AS d VALUES (2, 'Sales', 'Paris', 4500000), (12, 'Partnerships', 'Dublin', 800000)
ON CONFLICT ON CONSTRAINT departments_pkey DO UPDATE SET (location, budget) = (EXCLUDED.location, EXCLUDED.budget);`,
      ],
      wrongAnswers: [
        `INSERT INTO departments (department_id, name, location, budget) VALUES (2, 'Sales', 'Paris', 4500000), (12, 'Partnerships', 'Dublin', 800000) ON CONFLICT (department_id) DO NOTHING;`,
        `INSERT INTO departments (department_id, name, location, budget) VALUES (2, 'Sales', 'Paris', 4500000), (12, 'Partnerships', 'Dublin', 800000) ON CONFLICT (department_id) DO UPDATE SET location = EXCLUDED.location;`,
        `INSERT INTO departments (department_id, name, location, budget) VALUES (2, 'Sales', 'Paris', 4500000), (12, 'Partnerships', 'Dublin', 800000);`,
      ],
      verificationQuery: deptVerify,
      explanation: `\`ON CONFLICT (department_id)\` names the unique key that may clash:

- department 12 doesn't exist yet, so it's inserted normally;
- department 2 exists, so \`DO UPDATE\` modifies that row instead. \`EXCLUDED.location\` and \`EXCLUDED.budget\` are the values from the VALUES list that "lost" the conflict.

\`DO NOTHING\` would silently skip department 2. Without ON CONFLICT, the whole statement fails with a duplicate-key error (23505), and *neither* row is inserted.`,
      commonMistakes: ['DO NOTHING when the task asks for an update.', 'Updating only some of the requested columns.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't03-q10', topic: 3, relatedTopics: [1], previewTopics: [4], difficulty: 'medium', type: 'predict-output',
      title: 'Adding to a NULL budget',
      prompt: `Department 7 (Human Resources) has a budget of 900000.00. Department 9 (Procurement) has **no** budget (NULL). What does this statement return?`,
      referenceSolution: `UPDATE departments
SET budget = budget + 1
WHERE department_id IN (7, 9)
RETURNING department_id, budget;`,
      options: [
        { table: { columns: ['department_id', 'budget'], rows: [['7', '900001.00'], ['9', '1.00']] } },
        { table: { columns: ['department_id', 'budget'], rows: [['7', '900001.00'], ['9', null]] } },
        { table: { columns: ['department_id', 'budget'], rows: [['7', '900001.00']] } },
        { table: { columns: ['department_id', 'budget'], rows: [['7', '900000.00'], ['9', null]] } },
      ],
      correctOption: 1,
      hints: ['What is NULL + 1?', 'Is department 9 still updated, even though its value doesn\'t change?'],
      explanation: `Both rows match the WHERE clause, so both are updated and returned. For department 9, \`NULL + 1\` is NULL, so the "new" value is still NULL.

RETURNING shows values **after** the update: 900001.00 and NULL. To treat a missing budget as 0, write \`SET budget = coalesce(budget, 0) + 1\` (Topic 12).`,
      commonMistakes: ['Thinking NULL behaves like 0 in arithmetic.', 'Thinking rows whose value didn\'t change aren\'t returned.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't03-q11', topic: 3, relatedTopics: [1], previewTopics: [4, 5], difficulty: 'hard', type: 'fix-query',
      title: 'Fix: discount on fiction books',
      prompt: `The bookshop wants **10% off every product in the Fiction category** (category slug \`'fiction'\`). The statement below runs without error, but it changes far too many prices. Fix it so that only fiction products change.

*(Prices are \`numeric(10,2)\`, so the result is rounded to cents automatically.)*`,
      starterSql: `UPDATE products
SET price = price * 0.9
FROM categories
WHERE categories.slug = 'fiction';`,
      hints: ['Run the statement and look at the row count it reports. How many products changed?', 'UPDATE … FROM needs a condition that connects each product to *its* category.'],
      referenceSolution: `UPDATE products AS p
SET price = p.price * 0.9
FROM categories AS c
WHERE c.category_id = p.category_id
  AND c.slug = 'fiction';`,
      alternativeSolutions: [
        `UPDATE products SET price = price * 0.90 WHERE category_id = (SELECT category_id FROM categories WHERE slug = 'fiction');`,
      ],
      wrongAnswers: [`UPDATE products AS p SET price = p.price * 0.9 FROM categories AS c WHERE c.category_id = p.supplier_id AND c.slug = 'fiction';`],
      verificationQuery: `SELECT product_id, price FROM products`,
      explanation: `In \`UPDATE products … FROM categories WHERE categories.slug = 'fiction'\`, nothing ties a product to a category. The fiction row from \`categories\` "matches" **every** product, so every price drops by 10%.

Add the join condition \`c.category_id = p.category_id\`. Now only products whose own category is Fiction are updated. The alternative avoids the join with a subquery that looks up the category id.`,
      commonMistakes: ['Joining on the wrong column (e.g. supplier_id).', 'Not checking the reported row count after an UPDATE.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q12', topic: 3, relatedTopics: [1], previewTopics: [4, 19], difficulty: 'hard', type: 'write-query',
      title: 'Delete reviews from non-buyers',
      prompt: `Delete every review written by a customer who has **never placed any order** (of any status). Reviews from anonymised accounts (\`customer_id\` NULL) must be **kept**.`,
      hints: ['"Has never placed an order" is `NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = reviews.customer_id)`.', 'Think about what your condition does when `reviews.customer_id` is NULL.'],
      referenceSolution: `DELETE FROM reviews r
WHERE r.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = r.customer_id);`,
      alternativeSolutions: [
        `DELETE FROM reviews WHERE customer_id NOT IN (SELECT customer_id FROM orders);`,
        `DELETE FROM reviews r USING customers c WHERE c.customer_id = r.customer_id AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);`,
      ],
      wrongAnswers: [
        `DELETE FROM reviews r WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = r.customer_id);`,
        `DELETE FROM reviews r WHERE NOT EXISTS (SELECT 1 FROM orders o JOIN order_items oi USING (order_id) WHERE o.customer_id = r.customer_id AND oi.product_id = r.product_id);`,
      ],
      verificationQuery: `SELECT review_id FROM reviews`,
      explanation: `\`NOT EXISTS (…)\` is true when the subquery finds no order for that customer.

The NULL trap: for an anonymised review, \`o.customer_id = NULL\` never matches, so \`NOT EXISTS\` is **true**, and the review would be deleted. The extra \`r.customer_id IS NOT NULL\` keeps those.

Interestingly, the \`NOT IN\` alternative keeps them automatically: \`NULL NOT IN (…)\` is NULL, not true, so the row isn't deleted. (\`NOT IN\` has its own NULL trap when the *subquery* can return NULL. \`orders.customer_id\` is NOT NULL, so it's safe here.)

Deleting reviews whose reviewer didn't buy *that product* is a different, stricter rule. Read the task carefully.`,
      commonMistakes: ['Deleting anonymised reviews too.', 'Checking for the specific product instead of any order.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q13', topic: 3, relatedTopics: [1], previewTopics: [4], difficulty: 'hard', type: 'write-query',
      title: 'Apply budget changes with MERGE',
      prompt: `Finance sends these budgets as \`(department_id, budget)\` pairs:

\`(3, 3300000)\`, \`(9, 1200000)\`, \`(13, 250000)\`

Use a single **MERGE** statement. Existing departments get the **new budget** (name and location unchanged). Unknown ids are **inserted**, with name \`'New department <id>'\` (e.g. \`'New department 13'\`) and no location.`,
      hints: ['`MERGE INTO departments d USING (VALUES …) AS v(department_id, budget) ON d.department_id = v.department_id`', 'Two branches: `WHEN MATCHED THEN UPDATE …` and `WHEN NOT MATCHED THEN INSERT …`.', 'Build the name with `\'New department \' || v.department_id`.'],
      referenceSolution: `MERGE INTO departments AS d
USING (VALUES (3, 3300000), (9, 1200000), (13, 250000)) AS v(department_id, budget)
ON d.department_id = v.department_id
WHEN MATCHED THEN
  UPDATE SET budget = v.budget
WHEN NOT MATCHED THEN
  INSERT (department_id, name, location, budget)
  VALUES (v.department_id, 'New department ' || v.department_id, NULL, v.budget);`,
      alternativeSolutions: [
        `INSERT INTO departments (department_id, name, budget)
SELECT v.id, 'New department ' || v.id, v.b FROM (VALUES (3, 3300000), (9, 1200000), (13, 250000)) AS v(id, b)
ON CONFLICT (department_id) DO UPDATE SET budget = EXCLUDED.budget;`,
      ],
      wrongAnswers: [
        `MERGE INTO departments AS d USING (VALUES (3, 3300000), (9, 1200000), (13, 250000)) AS v(department_id, budget) ON d.department_id = v.department_id
WHEN MATCHED THEN UPDATE SET budget = v.budget;`,
        `MERGE INTO departments AS d USING (VALUES (3, 3300000), (9, 1200000), (13, 250000)) AS v(department_id, budget) ON d.department_id = v.department_id
WHEN MATCHED THEN UPDATE SET budget = v.budget, name = 'New department ' || v.department_id
WHEN NOT MATCHED THEN INSERT (department_id, name, budget) VALUES (v.department_id, 'New department ' || v.department_id, v.budget);`,
      ],
      verificationQuery: deptVerify,
      explanation: `MERGE compares a **source** (here an inline VALUES table) with a **target** on the \`ON\` condition and handles each source row:

- **WHEN MATCHED:** the department exists, so update just the budget.
- **WHEN NOT MATCHED:** no department with that id exists, so insert it. \`||\` concatenates text and a number (the number is converted automatically).

\`INSERT … ON CONFLICT DO UPDATE\` reaches the same final state here. MERGE is more general: it can also DELETE matched rows, and it can match on any condition, not just a unique key.`,
      commonMistakes: ['Forgetting the NOT MATCHED branch, so department 13 is never created.', 'Overwriting the name of existing departments.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't03-q14', topic: 3, relatedTopics: [1], previewTopics: [4, 10], difficulty: 'hard', type: 'write-query',
      title: 'Annual raise with history',
      prompt: `Every **active** employee of the **Sales** department (\`department_id = 2\`, \`termination_date IS NULL\`) gets a **3% raise**, rounded to the **nearest 500**: new salary = \`round(salary * 1.03 / 500) * 500\`.

Keep \`salary_history\` consistent too:

1. Close each affected employee's current period (the one with \`effective_to IS NULL\`) by setting \`effective_to = '2025-06-30'\`.
2. Insert a new period with \`effective_from = '2025-07-01'\`, \`effective_to\` NULL, the new salary, and \`change_reason = 'annual review'\`.
3. Update \`employees.salary\` to the new salary.

Use as many statements as you need.`,
      hints: ['Order matters. If you update employees first, you can copy the new salary into the history afterwards.', 'The history insert can be an `INSERT … SELECT … FROM employees WHERE …`.', 'Close the old periods **before** inserting the new open ones, or your WHERE effective_to IS NULL will match the new rows too.'],
      referenceSolution: `UPDATE employees
SET salary = round(salary * 1.03 / 500) * 500
WHERE department_id = 2 AND termination_date IS NULL;

UPDATE salary_history h
SET effective_to = '2025-06-30'
FROM employees e
WHERE e.employee_id = h.employee_id
  AND e.department_id = 2 AND e.termination_date IS NULL
  AND h.effective_to IS NULL;

INSERT INTO salary_history (employee_id, effective_from, effective_to, salary, change_reason)
SELECT employee_id, '2025-07-01', NULL, salary, 'annual review'
FROM employees
WHERE department_id = 2 AND termination_date IS NULL;`,
      alternativeSolutions: [
        `UPDATE salary_history SET effective_to = DATE '2025-06-30'
WHERE effective_to IS NULL AND employee_id IN (SELECT employee_id FROM employees WHERE department_id = 2 AND termination_date IS NULL);
INSERT INTO salary_history (employee_id, effective_from, salary, change_reason)
SELECT employee_id, DATE '2025-07-01', round(salary * 1.03 / 500) * 500, 'annual review' FROM employees WHERE department_id = 2 AND termination_date IS NULL;
UPDATE employees SET salary = round(salary * 1.03 / 500) * 500 WHERE department_id = 2 AND termination_date IS NULL;`,
      ],
      wrongAnswers: [
        `UPDATE employees SET salary = round(salary * 1.03 / 500) * 500 WHERE department_id = 2 AND termination_date IS NULL;
INSERT INTO salary_history (employee_id, effective_from, effective_to, salary, change_reason) SELECT employee_id, '2025-07-01', NULL, salary, 'annual review' FROM employees WHERE department_id = 2 AND termination_date IS NULL;`,
        `UPDATE employees SET salary = salary * 1.03 WHERE department_id = 2 AND termination_date IS NULL;
UPDATE salary_history h SET effective_to = '2025-06-30' FROM employees e WHERE e.employee_id = h.employee_id AND e.department_id = 2 AND e.termination_date IS NULL AND h.effective_to IS NULL;
INSERT INTO salary_history (employee_id, effective_from, effective_to, salary, change_reason) SELECT employee_id, '2025-07-01', NULL, salary, 'annual review' FROM employees WHERE department_id = 2 AND termination_date IS NULL;`,
        `UPDATE employees SET salary = round(salary * 1.03 / 500) * 500 WHERE department_id = 2;
UPDATE salary_history h SET effective_to = '2025-06-30' FROM employees e WHERE e.employee_id = h.employee_id AND e.department_id = 2 AND h.effective_to IS NULL;
INSERT INTO salary_history (employee_id, effective_from, effective_to, salary, change_reason) SELECT employee_id, '2025-07-01', NULL, salary, 'annual review' FROM employees WHERE department_id = 2;`,
      ],
      verificationQuery: `SELECT e.employee_id, e.salary AS current_salary, h.effective_from, h.effective_to, h.salary, h.change_reason
FROM employees e
JOIN salary_history h ON h.employee_id = e.employee_id
WHERE e.department_id = 2`,
      explanation: `Real changes often touch several tables, and the statements must keep them consistent:

1. **Raise:** \`round(salary * 1.03 / 500) * 500\` rounds to the nearest multiple of 500 (divide, round, multiply back).
2. **Close the open period:** UPDATE … FROM restricts the history change to active Sales employees. \`effective_to IS NULL\` picks each one's current period.
3. **Open the new period:** INSERT … SELECT copies the (already raised) salary.

Statement order matters. Closing periods *after* inserting the new ones would close the new ones too. Terminated Sales staff must not be touched, which is why every statement repeats the same filter.

In production all three would run inside one transaction, so either all happen or none do.`,
      commonMistakes: ['Forgetting to close the old period, which leaves two open periods.', 'Skipping the rounding rule.', 'Raising terminated employees too.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q15', topic: 3, relatedTopics: [1], previewTopics: [4, 12], difficulty: 'interview', type: 'write-query',
      title: 'Remove exact duplicate import rows',
      prompt: `\`staging_customer_import\` contains rows that are **exact duplicates**: every column except \`import_row_id\` is identical (\`source_file\`, \`imported_at\`, \`full_name\`, \`email\`, \`phone\`, \`signup_date_raw\`, \`country_raw\`, \`lifetime_value_raw\`). Two NULLs in the same column count as identical.

Delete the duplicates, **keeping only the row with the lowest \`import_row_id\`** of each identical group.`,
      hints: ['Self-join: `DELETE FROM staging_customer_import a USING staging_customer_import b WHERE …`.', 'Delete `a` when an identical row `b` with a *smaller* id exists.', '`=` is never true for two NULLs. Use `IS NOT DISTINCT FROM`, which treats NULLs as equal.'],
      referenceSolution: `DELETE FROM staging_customer_import a
USING staging_customer_import b
WHERE b.import_row_id < a.import_row_id
  AND a.source_file        IS NOT DISTINCT FROM b.source_file
  AND a.imported_at        IS NOT DISTINCT FROM b.imported_at
  AND a.full_name          IS NOT DISTINCT FROM b.full_name
  AND a.email              IS NOT DISTINCT FROM b.email
  AND a.phone              IS NOT DISTINCT FROM b.phone
  AND a.signup_date_raw    IS NOT DISTINCT FROM b.signup_date_raw
  AND a.country_raw        IS NOT DISTINCT FROM b.country_raw
  AND a.lifetime_value_raw IS NOT DISTINCT FROM b.lifetime_value_raw;`,
      alternativeSolutions: [
        `DELETE FROM staging_customer_import
WHERE import_row_id NOT IN (
  SELECT min(import_row_id) FROM staging_customer_import
  GROUP BY source_file, imported_at, full_name, email, phone, signup_date_raw, country_raw, lifetime_value_raw
);`,
        `DELETE FROM staging_customer_import WHERE import_row_id IN (
  SELECT import_row_id FROM (
    SELECT import_row_id, ROW_NUMBER() OVER (PARTITION BY source_file, imported_at, full_name, email, phone, signup_date_raw, country_raw, lifetime_value_raw ORDER BY import_row_id) AS rn
    FROM staging_customer_import) t WHERE rn > 1);`,
      ],
      wrongAnswers: [
        `DELETE FROM staging_customer_import a USING staging_customer_import b WHERE b.import_row_id < a.import_row_id
  AND a.source_file = b.source_file AND a.imported_at = b.imported_at AND a.full_name = b.full_name AND a.email = b.email AND a.phone = b.phone
  AND a.signup_date_raw = b.signup_date_raw AND a.country_raw = b.country_raw AND a.lifetime_value_raw = b.lifetime_value_raw;`,
        `DELETE FROM staging_customer_import a USING staging_customer_import b WHERE b.import_row_id <> a.import_row_id
  AND a.source_file IS NOT DISTINCT FROM b.source_file AND a.imported_at IS NOT DISTINCT FROM b.imported_at AND a.full_name IS NOT DISTINCT FROM b.full_name
  AND a.email IS NOT DISTINCT FROM b.email AND a.phone IS NOT DISTINCT FROM b.phone AND a.signup_date_raw IS NOT DISTINCT FROM b.signup_date_raw
  AND a.country_raw IS NOT DISTINCT FROM b.country_raw AND a.lifetime_value_raw IS NOT DISTINCT FROM b.lifetime_value_raw;`,
      ],
      verificationQuery: `SELECT import_row_id FROM staging_customer_import`,
      explanation: `"Delete duplicates but keep one" is a very common interview task. Three good solutions:

1. **Self-join with DELETE … USING** (reference): delete row \`a\` whenever an identical row \`b\` with a smaller id exists. Only the smallest id of each group has no smaller twin, so it survives.
2. **Keep the minimum per group** (alternative 1): GROUP BY all business columns and keep \`min(import_row_id)\`. GROUP BY treats NULLs as equal, so it handles NULLs correctly.
3. **ROW_NUMBER** (alternative 2, Topic 17): number the rows within each group and delete number > 1.

The traps: \`=\` returns NULL when both sides are NULL, so duplicates with a missing phone or e-mail would survive. Use \`IS NOT DISTINCT FROM\`. And comparing with \`<>\` instead of \`<\` deletes **every** copy, because each row has a different-id twin.`,
      commonMistakes: ['Comparing columns with = (NULLs never match).', 'Using <> instead of <, which deletes all copies including the one to keep.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't03-q16', topic: 3, relatedTopics: [1], previewTopics: [4, 5, 14, 20], difficulty: 'interview', type: 'write-query',
      title: 'Reconcile underpaid orders',
      prompt: `For a handful of **delivered** orders, the captured payments don't add up to the order value. The order value is \`ROUND(SUM(quantity * unit_price * (1 - discount)) + shipping_fee, 2)\`, and the captured amount is the sum of the order's payments with \`status = 'captured'\`.

For **every delivered order whose captured amount is lower than its order value**, insert one payment:

- \`amount\` = order value − captured amount
- \`method\` = \`'bank_transfer'\`, \`status\` = \`'captured'\`, \`paid_at\` = \`'2025-06-30 12:00:00+00'\`

Let the database generate \`payment_id\`.`,
      hints: ['Compute order values and captured sums per order in two aggregates (CTEs or subqueries), then join them.', '`INSERT INTO payments (order_id, paid_at, method, amount, status) SELECT …` inserts the result.', 'Only orders with `status = \'delivered\'` and a positive difference.'],
      referenceSolution: `WITH order_value AS (
  SELECT o.order_id,
         ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) + o.shipping_fee, 2) AS value
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'delivered'
  GROUP BY o.order_id, o.shipping_fee
), captured AS (
  SELECT order_id, SUM(amount) AS paid
  FROM payments
  WHERE status = 'captured'
  GROUP BY order_id
)
INSERT INTO payments (order_id, paid_at, method, amount, status)
SELECT v.order_id, '2025-06-30 12:00:00+00', 'bank_transfer', v.value - c.paid, 'captured'
FROM order_value v
JOIN captured c ON c.order_id = v.order_id
WHERE c.paid < v.value;`,
      alternativeSolutions: [
        `INSERT INTO payments (order_id, paid_at, method, amount, status)
SELECT o.order_id, TIMESTAMPTZ '2025-06-30 12:00:00+00', 'bank_transfer',
       (SELECT round(sum(quantity * unit_price * (1 - discount)), 2) FROM order_items WHERE order_id = o.order_id) + o.shipping_fee
       - (SELECT sum(amount) FROM payments p WHERE p.order_id = o.order_id AND p.status = 'captured'),
       'captured'
FROM orders o
WHERE o.status = 'delivered'
  AND (SELECT round(sum(quantity * unit_price * (1 - discount)), 2) FROM order_items WHERE order_id = o.order_id) + o.shipping_fee
      > (SELECT sum(amount) FROM payments p WHERE p.order_id = o.order_id AND p.status = 'captured');`,
      ],
      wrongAnswers: [
        `WITH order_value AS (SELECT o.order_id, ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' GROUP BY o.order_id),
captured AS (SELECT order_id, SUM(amount) AS paid FROM payments WHERE status = 'captured' GROUP BY order_id)
INSERT INTO payments (order_id, paid_at, method, amount, status) SELECT v.order_id, '2025-06-30 12:00:00+00', 'bank_transfer', v.value - c.paid, 'captured' FROM order_value v JOIN captured c ON c.order_id = v.order_id WHERE c.paid < v.value;`,
        `WITH order_value AS (SELECT o.order_id, ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) + o.shipping_fee, 2) AS value FROM orders o JOIN order_items oi ON oi.order_id = o.order_id WHERE o.status = 'delivered' GROUP BY o.order_id, o.shipping_fee),
captured AS (SELECT order_id, SUM(amount) AS paid FROM payments WHERE status = 'captured' GROUP BY order_id)
INSERT INTO payments (order_id, paid_at, method, amount, status) SELECT v.order_id, '2025-06-30 12:00:00+00', 'bank_transfer', c.paid - v.value, 'captured' FROM order_value v JOIN captured c ON c.order_id = v.order_id WHERE c.paid < v.value;`,
      ],
      verificationQuery: `SELECT order_id, paid_at, method, amount, status FROM payments WHERE paid_at = TIMESTAMPTZ '2025-06-30 12:00:00+00'
UNION ALL
SELECT NULL, NULL, 'total payments', count(*), NULL FROM payments`,
      explanation: `Breaking the problem into named steps keeps it manageable:

1. **order_value:** sum the line values of delivered orders and add the shipping fee *once* per order. The fee is a column of \`orders\`, so it goes in GROUP BY, not inside SUM.
2. **captured:** sum only payments with \`status = 'captured'\`. Failed attempts and refunds must not count.
3. **Join and compare:** keep orders where \`paid < value\`, and insert the difference as a new payment.

A CTE (\`WITH … INSERT …\`) lets you write the steps top to bottom. Topic 20 covers CTEs. The checker compares the inserted rows and the total number of payments, so inserting extra or duplicate rows is caught too.`,
      commonMistakes: ['Forgetting the shipping fee in the order value.', 'Counting failed or refunded payments as paid.', 'Subtracting the wrong way round, which gives negative amounts (the CHECK on payments.amount rejects them).', 'Adding the fee inside SUM, which multiplies it by the number of lines.'],
      checkConfig: { orderMatters: false, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
