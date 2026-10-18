// SQL assertions run against every built dataset (main and hidden). The build fails if any is false.
// They guarantee the deliberate edge cases exist and the data is internally consistent,
// so questions can rely on them on both datasets.

export interface Assertion { name: string; sql: string }

const ORDER_TOTALS = `
  SELECT o.order_id, o.status,
         ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) + o.shipping_fee, 2) AS total
  FROM orders o JOIN order_items oi USING (order_id)
  GROUP BY o.order_id`;

export const ASSERTIONS: Assertion[] = [
  // ── dates & time zones
  { name: 'at least 3 orders on leap day 2024-02-29', sql: `SELECT count(*) >= 3 FROM orders WHERE ordered_at >= '2024-02-29' AND ordered_at < '2024-03-01'` },
  { name: 'order at month end 2024-01-31 23:59:59', sql: `SELECT EXISTS (SELECT 1 FROM orders WHERE ordered_at = '2024-01-31 23:59:59+00')` },
  { name: 'orders just outside the Berlin day 2024-03-31', sql: `SELECT count(*) = 2 FROM orders WHERE ordered_at IN ('2024-03-30 22:30:00+00', '2024-03-31 22:30:00+00')` },
  { name: 'order at year end 2023-12-31 23:30', sql: `SELECT EXISTS (SELECT 1 FROM orders WHERE ordered_at = '2023-12-31 23:30:00+00')` },
  { name: 'orders whose local date differs from the UTC date', sql: `SELECT count(*) >= 50 FROM orders o JOIN customers c USING (customer_id) WHERE c.timezone IS NOT NULL AND (o.ordered_at AT TIME ZONE c.timezone)::date <> o.ordered_at::date` },
  { name: 'nothing happens after the reference date', sql: `SELECT max(ts) < '2025-07-01' FROM (SELECT max(ordered_at) ts FROM orders UNION ALL SELECT max(paid_at) FROM payments UNION ALL SELECT max(delivered_at) FROM shipments UNION ALL SELECT max(created_at) FROM reviews UNION ALL SELECT max(logged_in_at) FROM user_logins UNION ALL SELECT max(requested_at) FROM returns) x` },
  { name: 'data starts in 2021', sql: `SELECT min(ordered_at) >= '2021-01-01' AND min(ordered_at) < '2021-03-01' FROM orders` },
  { name: 'customer born on 2000-02-29', sql: `SELECT EXISTS (SELECT 1 FROM customers WHERE birth_date = '2000-02-29')` },
  { name: 'employee hired on 2020-02-29', sql: `SELECT EXISTS (SELECT 1 FROM employees WHERE hire_date = '2020-02-29')` },
  { name: 'logins on leap day', sql: `SELECT EXISTS (SELECT 1 FROM user_logins WHERE logged_in_at::date = '2024-02-29')` },

  // ── orphans for outer/anti joins
  { name: 'exactly 3 countries without customers', sql: `SELECT count(*) = 3 FROM countries c WHERE NOT EXISTS (SELECT 1 FROM customers cu WHERE cu.country_id = c.country_id)` },
  { name: 'a country with suppliers but no customers', sql: `SELECT EXISTS (SELECT 1 FROM suppliers s WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.country_id = s.country_id))` },
  { name: 'at least 3 suppliers without products', sql: `SELECT count(*) >= 3 FROM suppliers s WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.supplier_id = s.supplier_id)` },
  { name: 'exactly 2 leaf categories without products', sql: `SELECT count(*) = 2 FROM categories c WHERE NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = c.category_id) AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.category_id)` },
  { name: 'products only in leaf categories', sql: `SELECT NOT EXISTS (SELECT 1 FROM products p WHERE EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = p.category_id))` },
  { name: 'category tree is 4 levels deep', sql: `WITH RECURSIVE t AS (SELECT category_id, 1 AS lvl FROM categories WHERE parent_id IS NULL UNION ALL SELECT c.category_id, t.lvl + 1 FROM categories c JOIN t ON c.parent_id = t.category_id) SELECT max(lvl) = 4 FROM t` },
  { name: 'Legal department has no employees', sql: `SELECT NOT EXISTS (SELECT 1 FROM employees e JOIN departments d USING (department_id) WHERE d.name = 'Legal')` },
  { name: '5-20% of customers never ordered', sql: `SELECT avg((NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id))::int) BETWEEN 0.05 AND 0.20 FROM customers c` },
  { name: 'at least 10 products never sold', sql: `SELECT count(*) >= 10 FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id)` },
  { name: 'a never-sold product has a review', sql: `SELECT EXISTS (SELECT 1 FROM reviews r WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = r.product_id))` },
  { name: 'customers who ordered but never logged in, and vice versa', sql: `SELECT EXISTS (SELECT 1 FROM orders o WHERE NOT EXISTS (SELECT 1 FROM user_logins l WHERE l.customer_id = o.customer_id)) AND EXISTS (SELECT 1 FROM user_logins l WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = l.customer_id))` },
  { name: 'orders with NULL ship country', sql: `SELECT EXISTS (SELECT 1 FROM orders WHERE ship_country_id IS NULL)` },

  // ── ties
  { name: 'top laptop price is tied', sql: `SELECT count(*) >= 2 FROM products p JOIN categories c USING (category_id) WHERE c.slug = 'laptops' AND p.price = (SELECT max(p2.price) FROM products p2 JOIN categories c2 USING (category_id) WHERE c2.slug = 'laptops')` },
  { name: 'Sales directors share a salary', sql: `SELECT count(DISTINCT salary) = 1 FROM employees WHERE job_title = 'Director of Sales'` },
  { name: 'top Engineering staff salary is tied', sql: `WITH s AS (SELECT salary FROM employees WHERE department_id = 5 AND job_title IN ('Software Engineer','Senior Software Engineer','Data Engineer','QA Engineer')) SELECT count(*) >= 2 FROM s WHERE salary = (SELECT max(salary) FROM s)` },
  { name: 'many duplicate product prices', sql: `SELECT count(*) >= 20 FROM (SELECT price FROM products GROUP BY price HAVING count(*) > 1) x` },
  { name: 'customers tied on lifetime spend', sql: `WITH t AS (${ORDER_TOTALS}), s AS (SELECT o.customer_id, sum(t.total) spend FROM t JOIN orders o USING (order_id) GROUP BY o.customer_id) SELECT EXISTS (SELECT spend FROM s GROUP BY spend HAVING count(*) > 1)` },
  { name: 'duplicate review ratings per product', sql: `SELECT EXISTS (SELECT 1 FROM reviews GROUP BY product_id, rating HAVING count(*) > 1)` },

  // ── people & hierarchy
  { name: 'exactly one CEO (manager_id NULL)', sql: `SELECT count(*) = 1 FROM employees WHERE manager_id IS NULL` },
  { name: 'org hierarchy is 5 levels deep', sql: `WITH RECURSIVE t AS (SELECT employee_id, 1 AS lvl FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.employee_id, t.lvl + 1 FROM employees e JOIN t ON e.manager_id = t.employee_id) SELECT max(lvl) = 5 AND count(*) = (SELECT count(*) FROM employees) FROM t` },
  { name: 'two employees without department', sql: `SELECT count(*) = 2 FROM employees WHERE department_id IS NULL` },
  { name: 'terminated manager with active reports', sql: `SELECT EXISTS (SELECT 1 FROM employees m JOIN employees e ON e.manager_id = m.employee_id WHERE m.termination_date IS NOT NULL AND e.termination_date IS NULL)` },
  { name: 'duplicate employee full names', sql: `SELECT EXISTS (SELECT 1 FROM employees GROUP BY first_name, last_name HAVING count(*) > 1)` },
  { name: 'commission NULL for some sales staff', sql: `SELECT EXISTS (SELECT 1 FROM employees WHERE department_id = 2 AND commission_pct IS NULL AND job_title NOT LIKE 'VP%')` },
  { name: 'salary_history current period matches employees.salary', sql: `SELECT NOT EXISTS (SELECT 1 FROM employees e JOIN LATERAL (SELECT salary FROM salary_history h WHERE h.employee_id = e.employee_id ORDER BY effective_from DESC LIMIT 1) h ON true WHERE h.salary <> e.salary)` },
  { name: 'salary periods are contiguous', sql: `SELECT NOT EXISTS (SELECT 1 FROM (SELECT effective_to, lead(effective_from) OVER (PARTITION BY employee_id ORDER BY effective_from) nxt FROM salary_history) x WHERE nxt IS NOT NULL AND effective_to <> nxt - 1)` },
  { name: 'open-ended salary period only for active employees', sql: `SELECT NOT EXISTS (SELECT 1 FROM salary_history h JOIN employees e USING (employee_id) WHERE (h.effective_to IS NULL) <> (e.termination_date IS NULL) AND h.effective_from = (SELECT max(effective_from) FROM salary_history h2 WHERE h2.employee_id = e.employee_id))` },
  { name: 'one salary decrease', sql: `SELECT EXISTS (SELECT 1 FROM (SELECT salary, lag(salary) OVER (PARTITION BY employee_id ORDER BY effective_from) prev FROM salary_history) x WHERE salary < prev)` },
  { name: 'referral chain at least 5 deep', sql: `WITH RECURSIVE r AS (SELECT customer_id, 1 AS depth FROM customers WHERE referred_by IS NULL UNION ALL SELECT c.customer_id, r.depth + 1 FROM customers c JOIN r ON c.referred_by = r.customer_id) SELECT max(depth) >= 5 FROM r` },
  { name: 'duplicate customer full names', sql: `SELECT count(*) >= 2 FROM (SELECT 1 FROM customers GROUP BY lower(trim(first_name)), lower(trim(last_name)) HAVING count(*) > 1) x` },
  { name: 'e-mails equal ignoring case/space but not raw', sql: `SELECT count(*) >= 2 FROM (SELECT lower(trim(email)) FROM customers WHERE email IS NOT NULL GROUP BY 1 HAVING count(DISTINCT email) > 1) x` },
  { name: 'messy names exist', sql: `SELECT count(*) FILTER (WHERE first_name <> trim(first_name)) > 0 AND count(*) FILTER (WHERE first_name = upper(first_name)) > 0 AND count(*) FILTER (WHERE last_name = lower(last_name)) > 0 FROM customers` },
  { name: 'NULLs in optional customer fields', sql: `SELECT bool_and(n > 0) FROM (SELECT count(*) FILTER (WHERE email IS NULL) n FROM customers UNION ALL SELECT count(*) FILTER (WHERE phone IS NULL) FROM customers UNION ALL SELECT count(*) FILTER (WHERE city IS NULL) FROM customers UNION ALL SELECT count(*) FILTER (WHERE birth_date IS NULL) FROM customers UNION ALL SELECT count(*) FILTER (WHERE country_id IS NULL) FROM customers) x` },

  // ── orders lifecycle consistency
  { name: 'all six order statuses present', sql: `SELECT count(DISTINCT status) = 6 FROM orders` },
  { name: 'all four channels present', sql: `SELECT count(DISTINCT channel) = 4 FROM orders` },
  { name: 'no order before signup', sql: `SELECT NOT EXISTS (SELECT 1 FROM orders o JOIN customers c USING (customer_id) WHERE o.ordered_at <= c.signup_at)` },
  { name: 'no product sold before launch or after discontinuation', sql: `SELECT NOT EXISTS (SELECT 1 FROM order_items oi JOIN orders o USING (order_id) JOIN products p USING (product_id) WHERE o.ordered_at::date < p.launched_at OR o.ordered_at::date > p.discontinued_at)` },
  { name: 'sales reps employed at order time', sql: `SELECT NOT EXISTS (SELECT 1 FROM orders o JOIN employees e ON e.employee_id = o.sales_rep_id WHERE o.ordered_at::date < e.hire_date OR o.ordered_at::date > e.termination_date)` },
  { name: 'every order has at least one line', sql: `SELECT NOT EXISTS (SELECT 1 FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.order_id))` },
  { name: 'status matches shipped/delivered timestamps', sql: `SELECT NOT EXISTS (SELECT 1 FROM orders WHERE (status IN ('pending','processing','cancelled') AND (shipped_at IS NOT NULL OR delivered_at IS NOT NULL)) OR (status = 'shipped' AND (shipped_at IS NULL OR delivered_at IS NOT NULL)) OR (status IN ('delivered','returned') AND (shipped_at IS NULL OR delivered_at IS NULL OR delivered_at < shipped_at)))` },
  { name: 'shipments consistent with orders', sql: `SELECT NOT EXISTS (SELECT 1 FROM orders o LEFT JOIN (SELECT order_id, min(shipped_at) s, max(delivered_at) d, bool_and(delivered_at IS NOT NULL) all_d FROM shipments GROUP BY order_id) sh USING (order_id) WHERE o.shipped_at IS DISTINCT FROM sh.s OR (o.delivered_at IS NOT NULL AND (NOT sh.all_d OR o.delivered_at <> sh.d)))` },
  { name: 'some orders split into two shipments', sql: `SELECT EXISTS (SELECT 1 FROM shipments GROUP BY order_id HAVING count(*) = 2)` },
  { name: 'returned orders have refunded returns', sql: `SELECT NOT EXISTS (SELECT 1 FROM orders o WHERE status = 'returned' AND NOT EXISTS (SELECT 1 FROM returns r JOIN order_items oi USING (order_item_id) WHERE oi.order_id = o.order_id AND r.status = 'refunded'))` },
  { name: 'returns only on delivered/returned orders, after delivery', sql: `SELECT NOT EXISTS (SELECT 1 FROM returns r JOIN order_items oi USING (order_item_id) JOIN orders o USING (order_id) WHERE o.status NOT IN ('delivered','returned') OR r.requested_at <= o.delivered_at OR r.quantity > oi.quantity)` },
  { name: 'captured payments match order value except a few deliberate mismatches', sql: `WITH t AS (${ORDER_TOTALS}), p AS (SELECT order_id, sum(amount) FILTER (WHERE status = 'captured') cap FROM payments GROUP BY order_id) SELECT count(*) BETWEEN 3 AND 40 FROM t JOIN p USING (order_id) WHERE t.status IN ('delivered','shipped','processing','returned') AND p.cap <> t.total` },
  { name: 'unpaid orders are pending or cancelled', sql: `SELECT NOT EXISTS (SELECT 1 FROM orders o WHERE status NOT IN ('pending','cancelled') AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.order_id AND p.status = 'captured'))` },
  { name: 'failed and refunded payments present, split payments present', sql: `SELECT count(*) FILTER (WHERE status = 'failed') > 0 AND count(*) FILTER (WHERE status = 'refunded') > 0 AND (SELECT count(*) FROM (SELECT order_id FROM payments WHERE status = 'captured' GROUP BY order_id HAVING count(*) > 1) x) > 0 FROM payments` },
  { name: 'May 2024: the most valuable order is cancelled', sql: `WITH t AS (${ORDER_TOTALS}) SELECT (SELECT t.status FROM t JOIN orders o USING (order_id) WHERE o.ordered_at >= '2024-05-01' AND o.ordered_at < '2024-06-01' ORDER BY t.total DESC LIMIT 1) = 'cancelled'` },
  { name: 'an old pending marketplace order', sql: `SELECT EXISTS (SELECT 1 FROM orders WHERE status = 'pending' AND channel = 'marketplace' AND ordered_at < '2025-06-01')` },
  { name: 'customer with 3+ orders all cancelled', sql: `SELECT EXISTS (SELECT customer_id FROM orders GROUP BY customer_id HAVING count(*) >= 3 AND bool_and(status = 'cancelled'))` },
  { name: 'a discontinued premium product (price >= 1000)', sql: `SELECT EXISTS (SELECT 1 FROM products WHERE discontinued_at IS NOT NULL AND price >= 1000)` },
  { name: 'pending orders both before and after 2025-06-01', sql: `SELECT count(*) FILTER (WHERE ordered_at < '2025-06-01') > 0 AND count(*) FILTER (WHERE ordered_at >= '2025-06-01') > 0 FROM orders WHERE status = 'pending'` },
  { name: 'product prices are plausible for their type', sql: `SELECT NOT EXISTS (SELECT 1 FROM products WHERE (name LIKE '%Chromebook%' AND price > 500) OR (name LIKE '%Webcam%' AND price > 200) OR (name LIKE '%Workstation%' AND price < 1000))` },
  { name: 'some lines sold below the current list price', sql: `SELECT EXISTS (SELECT 1 FROM order_items oi JOIN products p USING (product_id) WHERE oi.unit_price < p.price)` },
  { name: 'coupon codes typed inconsistently', sql: `SELECT count(DISTINCT coupon_code) > count(DISTINCT upper(trim(coupon_code))) FROM orders` },

  // ── reviews & logins & staging
  { name: 'anonymised, duplicate and unverified reviews', sql: `SELECT EXISTS (SELECT 1 FROM reviews WHERE customer_id IS NULL) AND EXISTS (SELECT 1 FROM reviews WHERE customer_id IS NOT NULL GROUP BY customer_id, product_id HAVING count(*) > 1) AND EXISTS (SELECT 1 FROM reviews r WHERE r.customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders o JOIN order_items oi USING (order_id) WHERE o.customer_id = r.customer_id AND oi.product_id = r.product_id))` },
  { name: 'all ratings 1-5 used, NULL titles and bodies', sql: `SELECT count(DISTINCT rating) = 5 AND count(*) FILTER (WHERE title IS NULL) > 0 AND count(*) FILTER (WHERE body IS NULL) > 0 FROM reviews` },
  { name: 'longest login streak is 21 days, shared by two customers', sql: `WITH d AS (SELECT DISTINCT customer_id, logged_in_at::date AS day FROM user_logins WHERE success), g AS (SELECT customer_id, day - (row_number() OVER (PARTITION BY customer_id ORDER BY day))::int AS grp FROM d), s AS (SELECT customer_id, count(*) AS len FROM g GROUP BY customer_id, grp) SELECT max(len) = 21 AND count(*) FILTER (WHERE len = 21) = 2 FROM s` },
  { name: 'multiple logins per day and failed logins', sql: `SELECT EXISTS (SELECT 1 FROM user_logins GROUP BY customer_id, logged_in_at::date HAVING count(*) > 1) AND EXISTS (SELECT 1 FROM user_logins WHERE NOT success)` },
  { name: 'no login before tracking start or signup', sql: `SELECT NOT EXISTS (SELECT 1 FROM user_logins l JOIN customers c USING (customer_id) WHERE l.logged_in_at < '2023-01-01' OR l.logged_in_at <= c.signup_at)` },
  { name: 'staging has exact duplicates', sql: `SELECT EXISTS (SELECT 1 FROM staging_customer_import GROUP BY source_file, full_name, email, phone, signup_date_raw, country_raw, lifetime_value_raw HAVING count(*) > 1)` },
  { name: 'staging has near duplicates', sql: `SELECT EXISTS (SELECT 1 FROM staging_customer_import WHERE email IS NOT NULL GROUP BY lower(trim(email)) HAVING count(DISTINCT email) > 1)` },
  { name: 'staging dates parse with each file format', sql: `SELECT bool_and(CASE source_file WHEN 'crm_export_2024_01.csv' THEN to_date(signup_date_raw, 'YYYY-MM-DD') WHEN 'crm_export_2024_02.csv' THEN to_date(signup_date_raw, 'DD/MM/YYYY') ELSE to_date(signup_date_raw, 'Mon DD, YYYY') END BETWEEN '2018-01-01' AND '2024-03-01') FROM staging_customer_import WHERE signup_date_raw ~ '\\d'` },
];
