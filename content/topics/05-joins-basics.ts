import type { Topic } from '../types.ts';

const explanation = `Data about one thing is spread over several tables: an order row stores \`customer_id\`, not the customer's name. A **join** combines rows from two tables whenever a condition, usually "this id equals that id", is true.

\`\`\`sql
SELECT o.order_id, o.ordered_at, c.first_name, c.last_name
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
ORDER BY o.order_id
LIMIT 5;
\`\`\`

Give each table a short alias (\`o\`, \`c\`) and qualify columns with it. When two tables share a column name (\`customer_id\`), an unqualified reference is an error: *column reference is ambiguous*.

## INNER JOIN

\`JOIN\` (short for \`INNER JOIN\`) keeps only pairs of rows that match. A row without a partner disappears. A row with *several* partners appears *several times*, once per match.

## LEFT, RIGHT and FULL OUTER JOIN

| join | keeps |
|---|---|
| \`A JOIN B\` | only matching pairs |
| \`A LEFT JOIN B\` | every row of A. B's columns are NULL where nothing matches |
| \`A RIGHT JOIN B\` | every row of B (same as \`B LEFT JOIN A\`) |
| \`A FULL JOIN B\` | every row of both, with NULLs on whichever side has no match |

\`\`\`sql
-- Every customer, with their orders if they have any
SELECT c.customer_id, o.order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
ORDER BY c.customer_id, o.order_id
LIMIT 12;
\`\`\`

**Finding rows without a partner** (an *anti-join*): LEFT JOIN, then keep the rows where the right side is NULL. Test a column that can't be NULL in a real match, such as the primary key.

\`\`\`sql
SELECT c.customer_id, c.first_name, c.last_name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
ORDER BY c.customer_id
LIMIT 10;
\`\`\`

## ON versus WHERE with outer joins

For an outer join the two places are **not** interchangeable:

- a condition in **ON** decides which right-hand rows *match*. Unmatched left rows are still kept, with NULLs;
- a condition in **WHERE** filters the *joined result*. It removes the NULL-extended rows, which turns your LEFT JOIN back into an inner join.

\`\`\`sql
-- Every department with its ACTIVE employees (Legal has none and still appears)
SELECT d.name, e.employee_id
FROM departments d
LEFT JOIN employees e
       ON e.department_id = d.department_id
      AND e.termination_date IS NULL
ORDER BY d.name, e.employee_id;
\`\`\`

## USING and multi-table joins

\`JOIN orders USING (customer_id)\` is shorthand for an equality on a column with the same name in both tables, and that column then appears only once in the output. \`NATURAL JOIN\` joins on *all* same-named columns. Avoid it, because adding a column can silently change its meaning.

Joins chain left to right:

\`\`\`sql
SELECT o.order_id, oi.line_no, p.name AS product, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.order_id = 1000
ORDER BY oi.line_no;
\`\`\`

## Row multiplication: the most common join bug

Joining an order to its 3 lines **and** its 2 payments gives 3 × 2 = 6 rows. Summing payment amounts over those rows counts every payment three times. Join one "many" side at a time, or aggregate each side before joining (Topics 14 and 19).

## Gotchas

- A LEFT JOIN followed by an INNER JOIN on the right-hand table drops the unmatched rows again. Keep the whole chain LEFT once you start.
- \`count(*)\` after a LEFT JOIN counts the NULL-extended row as 1. Count a right-hand column instead (Topic 14).
- Joining on the wrong columns (e.g. \`p.product_id = oi.order_id\`) usually still "works", it just returns garbage. Check row counts.`;

const topic: Topic = {
  id: 5,
  status: 'complete',
  explanation,
  sources: [
    { title: 'PostgreSQL 18 Tutorial: Joins Between Tables (2.6)', url: 'https://www.postgresql.org/docs/18/tutorial-join.html' },
    { title: 'PostgreSQL 18: Joined Tables (7.2.1.1)', url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-JOIN' },
    { title: 'Neon PostgreSQL Tutorial: Joins', url: 'https://neon.com/postgresql/postgresql-tutorial/postgresql-joins' },
    { title: 'PGExercises: Joins and subqueries', url: 'https://pgexercises.com/questions/joins/' },
    { title: 'ThoughtSpot (Mode) SQL Tutorial: SQL Joins', url: 'https://www.thoughtspot.com/sql-tutorial/sql-joins' },
  ],
  questions: [
    {
      id: 't05-q01', topic: 5, relatedTopics: [1, 4], difficulty: 'easy', type: 'write-query',
      title: 'Who placed the June orders?',
      prompt: `List every order placed in **June 2025** together with the name of the customer who placed it.

- **Columns:** \`order_id\`, \`ordered_at\`, \`first_name\`, \`last_name\`
- **Sort:** by \`order_id\`.`,
      hints: ['Join `orders` to `customers` on `customer_id`.', 'June 2025: `ordered_at >= \'2025-06-01\' AND ordered_at < \'2025-07-01\'`.'],
      referenceSolution: `SELECT o.order_id, o.ordered_at, c.first_name, c.last_name
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01'
ORDER BY o.order_id;`,
      alternativeSolutions: [`SELECT order_id, ordered_at, first_name, last_name FROM orders JOIN customers USING (customer_id) WHERE ordered_at >= DATE '2025-06-01' ORDER BY order_id;`],
      wrongAnswers: [
        `SELECT o.order_id, o.ordered_at, c.first_name, c.last_name FROM orders o JOIN customers c ON c.customer_id = o.order_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY o.order_id;`,
        `SELECT o.order_id, o.ordered_at, c.first_name, c.last_name FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-06-30' ORDER BY o.order_id;`,
      ],
      explanation: `\`JOIN customers c ON c.customer_id = o.customer_id\` attaches the customer row to each order. Every order has exactly one customer (it's a required foreign key), so the join neither loses nor duplicates orders.

The date filter is a half-open range. \`< '2025-06-30'\` would drop the last day of the month.`,
      commonMistakes: ['Joining on the wrong column pair (order_id = customer_id) still runs, but it returns the wrong people.', 'Cutting off 30 June.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q02', topic: 5, relatedTopics: [1], difficulty: 'easy', type: 'write-query',
      title: 'Products with their category',
      prompt: `List every product with the **name of its category**.

- **Columns:** \`product_id\`, \`product\` (product name), \`category\` (category name)
- **Sort:** by \`product_id\`.`,
      hints: ['Both tables have a `name` column. Alias them in the SELECT list.'],
      referenceSolution: `SELECT p.product_id, p.name AS product, c.name AS category
FROM products p
JOIN categories c ON c.category_id = p.category_id
ORDER BY p.product_id;`,
      alternativeSolutions: [`SELECT p.product_id, p.name AS product, c.name AS category FROM categories c INNER JOIN products p USING (category_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT p.product_id, p.name AS product, c.name AS category FROM products p JOIN categories c ON c.category_id = p.supplier_id ORDER BY p.product_id;`,
        `SELECT p.product_id, p.name AS product, c.slug AS category FROM products p JOIN categories c ON c.category_id = p.category_id ORDER BY p.product_id;`,
      ],
      explanation: `Both tables have a \`name\` column. In the output you need different column names, so alias them: \`p.name AS product, c.name AS category\`. Without the table prefix, \`name\` would be ambiguous.`,
      commonMistakes: ['Selecting `name` without a table prefix: an ambiguity error.', 'Returning the slug instead of the name.'],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't05-q03', topic: 5, relatedTopics: [], difficulty: 'easy', type: 'concept-mc',
      title: 'What does LEFT JOIN keep?',
      prompt: `\`customers LEFT JOIN orders ON orders.customer_id = customers.customer_id\`. Which rows are in the result?`,
      options: [
        { text: 'Only customers who have at least one order.' },
        { text: 'Every customer at least once. Customers with orders appear once per order, and customers without orders appear once with NULL order columns.' },
        { text: 'Every customer exactly once.' },
        { text: 'Every order, plus customers without orders.' },
      ],
      correctOption: 1,
      hints: ['LEFT JOIN never loses a left-hand row, but it can repeat one.'],
      explanation: `A LEFT JOIN keeps **every** row of the left table. A customer with 5 orders produces 5 rows (one per match). A customer with no orders produces one row, with NULL in all order columns. "Exactly once" is wrong because matches multiply rows.`,
      commonMistakes: ['Expecting one row per customer after joining a one-to-many relationship.'],
    },
    {
      id: 't05-q04', topic: 5, relatedTopics: [1], difficulty: 'easy', type: 'predict-output',
      title: 'Inner versus left join',
      prompt: `Two tiny tables, joined two ways. What does the query return?`,
      referenceSolution: `SELECT
  (SELECT count(*) FROM (VALUES (1), (2), (3)) a(id) JOIN      (VALUES (1), (1), (4)) b(id) ON a.id = b.id) AS inner_rows,
  (SELECT count(*) FROM (VALUES (1), (2), (3)) a(id) LEFT JOIN (VALUES (1), (1), (4)) b(id) ON a.id = b.id) AS left_rows;`,
      options: [
        { table: { columns: ['inner_rows', 'left_rows'], rows: [['1', '3']] } },
        { table: { columns: ['inner_rows', 'left_rows'], rows: [['2', '4']] } },
        { table: { columns: ['inner_rows', 'left_rows'], rows: [['2', '3']] } },
        { table: { columns: ['inner_rows', 'left_rows'], rows: [['3', '5']] } },
      ],
      correctOption: 1,
      hints: ['a.id = 1 matches **two** rows in b.', 'In the LEFT JOIN, a.id = 2 and 3 have no match. Do they appear?'],
      explanation: `- **Inner:** a=1 matches the two b=1 rows, giving **2** rows. a=2 and a=3 match nothing, and b=4 matches nothing.
- **Left:** the same 2 matched rows, plus a=2 and a=3 once each with NULLs, giving **4** rows. b=4 is not kept, because only the left side is preserved.`,
      commonMistakes: ['Forgetting that duplicates on the right side multiply rows.', 'Thinking LEFT JOIN also keeps unmatched right rows (that\'s FULL JOIN).'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't05-q05', topic: 5, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Customers who never ordered',
      prompt: `Find the customers who have **never placed an order**.

- **Columns:** \`customer_id\`, \`first_name\`, \`last_name\`
- **Sort:** by \`customer_id\`.`,
      hints: ['LEFT JOIN orders, then keep the rows where nothing matched.', 'Test the right side\'s primary key: `WHERE o.order_id IS NULL`.'],
      referenceSolution: `SELECT c.customer_id, c.first_name, c.last_name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
ORDER BY c.customer_id;`,
      alternativeSolutions: [`SELECT c.customer_id, c.first_name, c.last_name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id) ORDER BY 1;`],
      wrongAnswers: [
        `SELECT c.customer_id, c.first_name, c.last_name FROM customers c JOIN orders o ON o.customer_id = c.customer_id WHERE o.order_id IS NULL ORDER BY c.customer_id;`,
        `SELECT c.customer_id, c.first_name, c.last_name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id WHERE o.coupon_code IS NULL ORDER BY c.customer_id;`,
      ],
      explanation: `This is the **anti-join** pattern:

1. \`LEFT JOIN orders\` keeps every customer. Those without orders get one row with NULL order columns.
2. \`WHERE o.order_id IS NULL\` keeps exactly those rows. \`order_id\` is the primary key, so it's never NULL in a real match.

Testing a nullable column such as \`coupon_code\` is a trap: real orders without a coupon also have NULL there. An inner JOIN can never produce the NULL rows at all. \`NOT EXISTS\` (Topic 19) is the other standard way to write an anti-join.`,
      commonMistakes: ['Using an inner join (returns nothing).', 'Testing a column that can be NULL in real matches.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q06', topic: 5, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Products and their supplier, if any',
      prompt: `List **all products** with the name of their supplier. A few products have no supplier: they must still appear, with NULL as the supplier name.

- **Columns:** \`product_id\`, \`product\`, \`supplier\`
- **Sort:** by \`product_id\`.`,
      hints: ['Which join keeps products that have no matching supplier?'],
      referenceSolution: `SELECT p.product_id, p.name AS product, s.name AS supplier
FROM products p
LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
ORDER BY p.product_id;`,
      alternativeSolutions: [`SELECT p.product_id, p.name AS product, s.name AS supplier FROM suppliers s RIGHT JOIN products p ON p.supplier_id = s.supplier_id ORDER BY 1;`],
      wrongAnswers: [
        `SELECT p.product_id, p.name AS product, s.name AS supplier FROM products p JOIN suppliers s ON s.supplier_id = p.supplier_id ORDER BY p.product_id;`,
        `SELECT p.product_id, p.name AS product, s.name AS supplier FROM products p FULL JOIN suppliers s ON s.supplier_id = p.supplier_id ORDER BY p.product_id;`,
      ],
      explanation: `\`products LEFT JOIN suppliers\` keeps every product. Where \`supplier_id\` is NULL (or matches nothing), the supplier columns are NULL. An inner join would drop those products.

A FULL JOIN would *also* add the suppliers that have no products, as rows with a NULL product. That's more than was asked.`,
      commonMistakes: ['Inner join loses products without a supplier.', 'FULL JOIN adds unwanted supplier-only rows.'],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't05-q07', topic: 5, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'What was bought on leap day?',
      prompt: `Show **every order line** of the orders placed on **29 February 2024** (UTC) with the product name.

- **Columns:** \`order_id\`, \`line_no\`, \`product\` (product name), \`quantity\`, \`unit_price\`
- **Sort:** by \`order_id\`, then \`line_no\`.`,
      hints: ['Three tables: orders → order_items → products.', 'A whole day: `>= \'2024-02-29\' AND < \'2024-03-01\'`.'],
      referenceSolution: `SELECT o.order_id, oi.line_no, p.name AS product, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.ordered_at >= '2024-02-29' AND o.ordered_at < '2024-03-01'
ORDER BY o.order_id, oi.line_no;`,
      alternativeSolutions: [`SELECT order_id, line_no, p.name AS product, quantity, unit_price FROM order_items JOIN orders USING (order_id) JOIN products p USING (product_id) WHERE ordered_at::date = '2024-02-29' ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT o.order_id, oi.line_no, p.name AS product, oi.quantity, p.price AS unit_price FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.ordered_at >= '2024-02-29' AND o.ordered_at < '2024-03-01' ORDER BY o.order_id, oi.line_no;`,
        `SELECT o.order_id, oi.line_no, p.name AS product, oi.quantity, oi.unit_price FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.order_id WHERE o.ordered_at >= '2024-02-29' AND o.ordered_at < '2024-03-01' ORDER BY o.order_id, oi.line_no;`,
      ],
      explanation: `Chain the joins along the foreign keys: an order has lines, and each line points to a product. The date filter goes on the order.

Note the difference between \`order_items.unit_price\` (what was charged) and \`products.price\` (today's list price). Some lines were sold at an older price.`,
      commonMistakes: ['Showing today\'s list price instead of the price on the order line.', 'Joining products on the wrong key.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q08', topic: 5, relatedTopics: [1, 4], difficulty: 'medium', type: 'fix-query',
      title: 'Fix: ambiguous column',
      prompt: `This query should list each **phone order** with the customer's id and first name, but it fails. Fix it.

- **Columns:** \`order_id\`, \`customer_id\`, \`first_name\`
- **Sort:** by \`order_id\`.`,
      starterSql: `SELECT order_id, customer_id, first_name
FROM orders
JOIN customers ON orders.customer_id = customers.customer_id
WHERE channel = 'phone'
ORDER BY order_id;`,
      hints: ['Which column exists in both tables?'],
      referenceSolution: `SELECT o.order_id, o.customer_id, c.first_name
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.channel = 'phone'
ORDER BY o.order_id;`,
      alternativeSolutions: [`SELECT order_id, customer_id, first_name FROM orders JOIN customers USING (customer_id) WHERE channel = 'phone' ORDER BY order_id;`],
      wrongAnswers: [`SELECT o.order_id, o.customer_id, c.first_name FROM orders o JOIN customers c ON o.customer_id = c.customer_id ORDER BY o.order_id;`],
      explanation: `Error: *column reference "customer_id" is ambiguous*. Both tables have a \`customer_id\` column, and PostgreSQL won't guess which one you mean, even though they're equal here.

Qualify it (\`o.customer_id\`), or join with \`USING (customer_id)\`, which merges the two columns into one unqualified \`customer_id\`.`,
      commonMistakes: ['Dropping the WHERE clause while fixing the error.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q09', topic: 5, relatedTopics: [1, 4], difficulty: 'medium', type: 'write-query',
      title: 'Departments and their recent hires',
      prompt: `List **every department** with the employees it **hired on or after 1 January 2024** (\`hire_date >= '2024-01-01'\`, whether still employed or not). A department without any such hire must still appear once, with NULL as the employee id.

- **Columns:** \`department\` (department name), \`employee_id\`, \`hire_date\`
- **Sort:** by \`department\`, then \`employee_id\`.`,
      hints: ['LEFT JOIN from departments.', 'Where does the hire-date condition go so it doesn\'t remove departments without matches: ON or WHERE?'],
      referenceSolution: `SELECT d.name AS department, e.employee_id, e.hire_date
FROM departments d
LEFT JOIN employees e
       ON e.department_id = d.department_id
      AND e.hire_date >= '2024-01-01'
ORDER BY department, e.employee_id;`,
      alternativeSolutions: [`SELECT d.name AS department, e.employee_id, e.hire_date FROM employees e RIGHT JOIN departments d ON d.department_id = e.department_id AND e.hire_date >= DATE '2024-01-01' ORDER BY 1, 2;`],
      wrongAnswers: [
        `SELECT d.name AS department, e.employee_id, e.hire_date FROM departments d LEFT JOIN employees e ON e.department_id = d.department_id WHERE e.hire_date >= '2024-01-01' ORDER BY department, e.employee_id;`,
        `SELECT d.name AS department, e.employee_id, e.hire_date FROM departments d LEFT JOIN employees e ON e.department_id = d.department_id ORDER BY department, e.employee_id;`,
      ],
      explanation: `Put the hire-date condition **in ON**. It then only decides which employees count as a match. A department with no matching employee still survives, as one row with NULL employee columns.

In WHERE, the condition runs *after* the join. For a department without recent hires, the remaining rows are either older employees (which fail the test) or the NULL-extended row, where \`NULL >= '2024-01-01'\` is unknown. Both are removed, so the department disappears: the LEFT JOIN has silently become an inner join.

Rule of thumb: **conditions on the optional (right-hand) side of a LEFT JOIN belong in ON**. Conditions on the preserved side can go in WHERE.`,
      commonMistakes: ['Putting the condition in WHERE, which drops departments without recent hires (and Legal).', 'Forgetting the hire-date filter entirely.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q10', topic: 5, relatedTopics: [1], difficulty: 'medium', type: 'write-query',
      title: 'Every supplier and every product',
      prompt: `Produce one list that contains **every supplier and every product**: products are paired with their supplier, suppliers without products appear once with NULL product columns, and products without a supplier appear once with NULL supplier columns.

- **Columns:** \`supplier_id\`, \`supplier\`, \`product_id\`, \`product\`
- **Sort:** by \`supplier_id\` (NULLs last), then \`product_id\` (NULLs last).`,
      hints: ['Both sides must be preserved: that\'s a FULL OUTER JOIN.'],
      referenceSolution: `SELECT s.supplier_id, s.name AS supplier, p.product_id, p.name AS product
FROM suppliers s
FULL JOIN products p ON p.supplier_id = s.supplier_id
ORDER BY s.supplier_id NULLS LAST, p.product_id NULLS LAST;`,
      alternativeSolutions: [`SELECT s.supplier_id, s.name AS supplier, p.product_id, p.name AS product FROM products p FULL OUTER JOIN suppliers s ON s.supplier_id = p.supplier_id ORDER BY 1, 3;`],
      wrongAnswers: [
        `SELECT s.supplier_id, s.name AS supplier, p.product_id, p.name AS product FROM suppliers s LEFT JOIN products p ON p.supplier_id = s.supplier_id ORDER BY s.supplier_id NULLS LAST, p.product_id NULLS LAST;`,
        `SELECT s.supplier_id, s.name AS supplier, p.product_id, p.name AS product FROM suppliers s RIGHT JOIN products p ON p.supplier_id = s.supplier_id ORDER BY s.supplier_id NULLS LAST, p.product_id NULLS LAST;`,
      ],
      explanation: `A FULL JOIN is a LEFT and a RIGHT join at once. Matching pairs appear normally, unmatched suppliers get NULL product columns, and unmatched products get NULL supplier columns.

It's typically used to **compare two lists**: what's on one side only, what's on the other, what's in both.`,
      commonMistakes: ['LEFT JOIN loses products without a supplier.', 'RIGHT JOIN loses suppliers without products.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q11', topic: 5, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'Products that were sent back',
      prompt: `List each **product that was part of at least one order with status \`'returned'\`**, once.

- **Columns:** \`product_id\`, \`name\`
- **Sort:** by \`product_id\`.`,
      hints: ['orders → order_items → products, filtered on the order status.', 'A product can be in several returned orders. How do you list it only once?'],
      referenceSolution: `SELECT DISTINCT p.product_id, p.name
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p     ON p.product_id = oi.product_id
WHERE o.status = 'returned'
ORDER BY p.product_id;`,
      alternativeSolutions: [`SELECT p.product_id, p.name FROM products p WHERE EXISTS (SELECT 1 FROM order_items oi JOIN orders o USING (order_id) WHERE oi.product_id = p.product_id AND o.status = 'returned') ORDER BY 1;`],
      wrongAnswers: [
        `SELECT p.product_id, p.name FROM orders o JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id WHERE o.status = 'returned' ORDER BY p.product_id;`,
        `SELECT DISTINCT p.product_id, p.name FROM returns r JOIN order_items oi ON oi.order_item_id = r.order_item_id JOIN products p ON p.product_id = oi.product_id ORDER BY p.product_id;`,
      ],
      explanation: `The join produces one row per (returned order, line). A product that appears in several returned orders shows up several times, and \`DISTINCT\` collapses them.

The second wrong answer reads the \`returns\` table instead. That's a different question: it includes return *requests* that were rejected, and lines returned from orders that are still 'delivered' overall.`,
      commonMistakes: ['Forgetting DISTINCT (row multiplication).', 'Answering a different question via the returns table.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q12', topic: 5, relatedTopics: [1, 4], difficulty: 'hard', type: 'write-query',
      title: 'New Zealand customers, orders and parcels',
      prompt: `For every customer living in **New Zealand** (\`country_id = 31\`), list their orders and each order's shipments. Customers without orders must still appear (with NULL order and shipment columns), and orders without shipments must still appear (with NULL shipment columns).

- **Columns:** \`customer_id\`, \`order_id\`, \`shipment_id\`, \`carrier\`
- **Sort:** by \`customer_id\`, \`order_id\`, \`shipment_id\` (NULLs last in each).`,
      hints: ['Two LEFT JOINs in a row: customers → orders → shipments.', 'If the second join is an inner join, what happens to customers without orders?'],
      referenceSolution: `SELECT c.customer_id, o.order_id, s.shipment_id, s.carrier
FROM customers c
LEFT JOIN orders o    ON o.customer_id = c.customer_id
LEFT JOIN shipments s ON s.order_id = o.order_id
WHERE c.country_id = 31
ORDER BY c.customer_id, o.order_id NULLS LAST, s.shipment_id NULLS LAST;`,
      alternativeSolutions: [`SELECT c.customer_id, o.order_id, s.shipment_id, s.carrier FROM customers c LEFT JOIN (orders o LEFT JOIN shipments s USING (order_id)) ON o.customer_id = c.customer_id WHERE c.country_id = 31 ORDER BY 1, 2, 3;`],
      wrongAnswers: [
        `SELECT c.customer_id, o.order_id, s.shipment_id, s.carrier FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id JOIN shipments s ON s.order_id = o.order_id WHERE c.country_id = 31 ORDER BY c.customer_id, o.order_id NULLS LAST, s.shipment_id NULLS LAST;`,
        `SELECT c.customer_id, o.order_id, s.shipment_id, s.carrier FROM customers c JOIN orders o ON o.customer_id = c.customer_id LEFT JOIN shipments s ON s.order_id = o.order_id WHERE c.country_id = 31 ORDER BY c.customer_id, o.order_id NULLS LAST, s.shipment_id NULLS LAST;`,
      ],
      explanation: `Once you start a LEFT JOIN chain, **stay left**. In the first wrong answer the second join is an inner join, so rows whose order is NULL (customers without orders) or whose order has no shipment (pending, cancelled…) are thrown away again.

The WHERE condition is on the *preserved* table (customers), so it's safe in WHERE.`,
      commonMistakes: ['Mixing LEFT and INNER joins in a chain.', 'Starting with an inner join to orders, which loses customers without orders.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
    {
      id: 't05-q13', topic: 5, relatedTopics: [1, 4], previewTopics: [14], difficulty: 'hard', type: 'fix-query',
      title: 'Fix: inflated payment totals',
      prompt: `This query should show, for orders **1 to 50**, the order id and the **total captured payment amount**. The totals come out too high for some orders. Fix it.

- **Columns:** \`order_id\`, \`captured\`
- **Sort:** by \`order_id\`. Only orders with at least one captured payment appear.`,
      starterSql: `SELECT o.order_id, SUM(p.amount) AS captured
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN payments p     ON p.order_id = o.order_id
WHERE o.order_id BETWEEN 1 AND 50
  AND p.status = 'captured'
GROUP BY o.order_id
ORDER BY o.order_id;`,
      hints: ['How many rows does the join produce for an order with 3 lines and 1 payment?', 'Do you need order_items at all to sum payments?'],
      referenceSolution: `SELECT o.order_id, SUM(p.amount) AS captured
FROM orders o
JOIN payments p ON p.order_id = o.order_id
WHERE o.order_id BETWEEN 1 AND 50
  AND p.status = 'captured'
GROUP BY o.order_id
ORDER BY o.order_id;`,
      alternativeSolutions: [`SELECT order_id, sum(amount) AS captured FROM payments WHERE status = 'captured' AND order_id <= 50 GROUP BY order_id ORDER BY order_id;`],
      wrongAnswers: [`SELECT o.order_id, SUM(p.amount) AS captured FROM orders o JOIN payments p ON p.order_id = o.order_id WHERE o.order_id BETWEEN 1 AND 50 GROUP BY o.order_id ORDER BY o.order_id;`],
      explanation: `Joining \`order_items\` multiplies each payment by the number of order lines: an order with 3 lines and one payment of 50 sums to 150. \`order_items\` isn't needed for this question at all, so remove it.

\`SUM(DISTINCT amount)\` is a tempting patch, but it's wrong when one order has two *different* payments of the same amount. Fix the join instead of hiding the duplicates. (GROUP BY and SUM are covered in Topic 14.)`,
      commonMistakes: ['Patching row multiplication with DISTINCT.', 'Removing the join but also the status filter, which counts failed and refunded payments.', 'Keeping joins that the question doesn\'t need.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true, allowSameOnHidden: true },
    },
    {
      id: 't05-q14', topic: 5, relatedTopics: [1, 4], difficulty: 'hard', type: 'predict-output',
      title: 'Filter in ON or in WHERE?',
      prompt: `How many rows does each query return?`,
      referenceSolution: `SELECT
  (SELECT count(*) FROM (VALUES (1), (2)) a(id)
     LEFT JOIN (VALUES (1, 'x'), (2, 'y')) b(id, tag) ON b.id = a.id AND b.tag = 'x') AS filter_in_on,
  (SELECT count(*) FROM (VALUES (1), (2)) a(id)
     LEFT JOIN (VALUES (1, 'x'), (2, 'y')) b(id, tag) ON b.id = a.id
     WHERE b.tag = 'x') AS filter_in_where;`,
      options: [
        { table: { columns: ['filter_in_on', 'filter_in_where'], rows: [['2', '2']] } },
        { table: { columns: ['filter_in_on', 'filter_in_where'], rows: [['1', '1']] } },
        { table: { columns: ['filter_in_on', 'filter_in_where'], rows: [['2', '1']] } },
        { table: { columns: ['filter_in_on', 'filter_in_where'], rows: [['1', '2']] } },
      ],
      correctOption: 2,
      hints: ['In ON, the tag condition decides what counts as a match. Is a=2 still kept?', 'WHERE runs after the join and sees the NULL-extended row.'],
      explanation: `- **In ON:** a=1 matches (1,'x'). For a=2 the only candidate (2,'y') fails the tag condition, so a=2 is kept with NULLs. That's **2** rows.
- **In WHERE:** the join first produces (1,'x') and (2,'y'). The WHERE then keeps only tag 'x', giving **1** row. The outer join's "keep everything" was undone.`,
      commonMistakes: ['Treating ON and WHERE as equivalent for outer joins.'],
      checkConfig: { orderMatters: false },
    },
    {
      id: 't05-q15', topic: 5, relatedTopics: [1, 4], difficulty: 'interview', type: 'write-query',
      title: 'Home country versus shipping country',
      prompt: `For every order placed in **June 2025**, show the **name of the customer's home country** and the **name of the shipping country**. Either can be unknown (NULL); such orders must still appear with NULL in that column.

- **Columns:** \`order_id\`, \`home_country\`, \`ship_country\`
- **Sort:** by \`order_id\`.`,
      hints: ['You need `countries` twice, under two different aliases.', 'Both country joins must be LEFT joins.'],
      referenceSolution: `SELECT o.order_id,
       hc.name AS home_country,
       sc.name AS ship_country
FROM orders o
JOIN customers c       ON c.customer_id = o.customer_id
LEFT JOIN countries hc ON hc.country_id = c.country_id
LEFT JOIN countries sc ON sc.country_id = o.ship_country_id
WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01'
ORDER BY o.order_id;`,
      alternativeSolutions: [`SELECT o.order_id, home.name AS home_country, ship.name AS ship_country FROM orders o JOIN customers c USING (customer_id) LEFT JOIN countries home ON home.country_id = c.country_id LEFT JOIN countries ship ON ship.country_id = o.ship_country_id WHERE o.ordered_at >= '2025-06-01' ORDER BY 1;`],
      wrongAnswers: [
        `SELECT o.order_id, hc.name AS home_country, sc.name AS ship_country FROM orders o JOIN customers c ON c.customer_id = o.customer_id JOIN countries hc ON hc.country_id = c.country_id JOIN countries sc ON sc.country_id = o.ship_country_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY o.order_id;`,
        `SELECT o.order_id, hc.name AS home_country, hc.name AS ship_country FROM orders o JOIN customers c ON c.customer_id = o.customer_id LEFT JOIN countries hc ON hc.country_id = c.country_id WHERE o.ordered_at >= '2025-06-01' AND o.ordered_at < '2025-07-01' ORDER BY o.order_id;`,
      ],
      explanation: `The same table can play two roles in one query. Join \`countries\` **twice**, under two aliases: one for the customer's home and one for the shipping destination.

Both are LEFT joins, because either key may be NULL, and an inner join would silently drop those orders. The customer join can stay inner: \`orders.customer_id\` is NOT NULL with a foreign key, so every order has a customer.`,
      commonMistakes: ['Inner joins to countries, which lose orders with an unknown country.', 'Reusing one alias for both roles.'],
      checkConfig: { orderMatters: true, columnNamesMatter: true, duplicatesMatter: true },
    },
    {
      id: 't05-q16', topic: 5, relatedTopics: [1, 4], difficulty: 'interview', type: 'write-query',
      title: 'Products never bought for real',
      prompt: `Find the products that **never appear in a non-cancelled order**. That includes products that were never ordered at all, *and* products that only ever appeared in cancelled orders. Use joins (no subqueries).

- **Columns:** \`product_id\`, \`name\`
- **Sort:** by \`product_id\`.`,
      hints: ['An anti-join: LEFT JOIN the "real" order lines and keep products where nothing matched.', 'The right side is itself a join of order_items and non-cancelled orders. Put it in parentheses, or move the status condition into the ON of a second LEFT JOIN and test that table\'s key.'],
      referenceSolution: `SELECT p.product_id, p.name
FROM products p
LEFT JOIN (order_items oi
           JOIN orders o ON o.order_id = oi.order_id AND o.status <> 'cancelled')
       ON oi.product_id = p.product_id
WHERE oi.order_item_id IS NULL
ORDER BY p.product_id;`,
      alternativeSolutions: [
        `SELECT p.product_id, p.name FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items oi JOIN orders o USING (order_id) WHERE oi.product_id = p.product_id AND o.status <> 'cancelled') ORDER BY 1;`,
      ],
      wrongAnswers: [
        `SELECT p.product_id, p.name FROM products p LEFT JOIN order_items oi ON oi.product_id = p.product_id WHERE oi.order_item_id IS NULL ORDER BY p.product_id;`,
        `SELECT DISTINCT p.product_id, p.name FROM products p LEFT JOIN order_items oi ON oi.product_id = p.product_id LEFT JOIN orders o ON o.order_id = oi.order_id WHERE o.order_id IS NULL OR o.status = 'cancelled' ORDER BY p.product_id;`,
      ],
      explanation: `A product must be excluded if **any** of its lines belongs to a real order. The parenthesised join \`(order_items JOIN orders … AND status <> 'cancelled')\` is the set of real order lines, and the LEFT JOIN + \`IS NULL\` keeps the products with none of them.

The tempting second wrong answer checks rows one at a time: a product with one cancelled line *and* one real line passes the filter on its cancelled row, so it's listed even though it was bought.

The plain anti-join on \`order_items\` misses products that appear only in cancelled orders. The practice data contains one such product. \`NOT EXISTS\` (Topic 19) is usually the clearest way to write this.`,
      commonMistakes: ['Ignoring cancelled orders entirely.', 'Filtering row by row, which keeps products that were also bought in real orders.'],
      checkConfig: { orderMatters: true, columnNamesMatter: false, duplicatesMatter: true },
    },
  ],
};

export default topic;
