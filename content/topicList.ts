// The 21 topics, in learning order. Full topic content (explanations, questions) lives in content/topics/.
export interface TopicMeta { id: number; slug: string; title: string; summary: string }

export const TOPICS: TopicMeta[] = [
  { id: 1, slug: 'query-data', title: 'Query Data (SELECT)', summary: 'SELECT, column aliases, expressions, DISTINCT, ORDER BY, LIMIT/OFFSET.' },
  { id: 2, slug: 'ddl', title: 'DDL Commands', summary: 'CREATE / ALTER / DROP tables, data types, constraints, keys.' },
  { id: 3, slug: 'dml', title: 'DML Commands', summary: 'INSERT, UPDATE, DELETE, RETURNING, upserts with ON CONFLICT.' },
  { id: 4, slug: 'filtering', title: 'Filtering Data', summary: 'WHERE, comparison & logical operators, IN, BETWEEN, LIKE/ILIKE, IS NULL.' },
  { id: 5, slug: 'joins-basics', title: 'SQL Joins (Basics)', summary: 'INNER, LEFT, RIGHT and FULL joins; join conditions; USING.' },
  { id: 6, slug: 'joins-advanced', title: 'SQL Joins (Advanced)', summary: 'Self-joins, anti/semi joins, CROSS JOIN, LATERAL, multi-table joins.' },
  { id: 7, slug: 'set-operators', title: 'Set Operators', summary: 'UNION, UNION ALL, INTERSECT, EXCEPT and their rules.' },
  { id: 8, slug: 'sql-functions', title: 'SQL Functions', summary: 'Scalar vs aggregate functions, casting (::, CAST), conversion & formatting.' },
  { id: 9, slug: 'string-functions', title: 'String Functions', summary: 'Concatenation, trimming, case, substrings, splitting, regular expressions.' },
  { id: 10, slug: 'numeric-functions', title: 'Numeric Functions', summary: 'ROUND, TRUNC, CEIL/FLOOR, integer division, modulo, numeric vs float.' },
  { id: 11, slug: 'date-time-functions', title: 'Date and Time Functions', summary: 'date_trunc, extract, intervals, AT TIME ZONE, generate_series of dates.' },
  { id: 12, slug: 'null-functions', title: 'NULL Functions', summary: 'COALESCE, NULLIF, three-valued logic, IS DISTINCT FROM.' },
  { id: 13, slug: 'case', title: 'Case Statement', summary: 'Simple and searched CASE, bucketing, conditional aggregation.' },
  { id: 14, slug: 'aggregate-functions', title: 'Aggregate Functions', summary: 'COUNT/SUM/AVG/MIN/MAX, GROUP BY, HAVING, FILTER, string_agg, percentiles.' },
  { id: 15, slug: 'window-basics', title: 'Window Functions Basics', summary: 'OVER, PARTITION BY, ORDER BY inside windows, window vs GROUP BY.' },
  { id: 16, slug: 'window-aggregate', title: 'Window Aggregate', summary: 'Running totals, moving averages, frames (ROWS/RANGE), share of total.' },
  { id: 17, slug: 'window-ranking', title: 'Window Ranking', summary: 'ROW_NUMBER, RANK, DENSE_RANK, NTILE, PERCENT_RANK, top-N per group.' },
  { id: 18, slug: 'window-value', title: 'Window Value', summary: 'LAG, LEAD, FIRST_VALUE, LAST_VALUE, NTH_VALUE, period-over-period.' },
  { id: 19, slug: 'subqueries', title: 'Subqueries', summary: 'Scalar, row and table subqueries, correlated subqueries, EXISTS, ANY/ALL.' },
  { id: 20, slug: 'cte', title: 'Common Table Expressions (CTE)', summary: 'WITH, chaining CTEs, recursive CTEs for hierarchies and series.' },
  { id: 21, slug: 'views', title: 'Views', summary: 'CREATE VIEW, updatable views, WITH CHECK OPTION, materialized views.' },
];
