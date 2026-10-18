// Building blocks for DDL/DML verification queries.
//
// DDL is checked *behaviourally* where possible: after the learner's statements run, the verification
// tries a series of test statements and records 'ok' or the SQLSTATE each one raised. This accepts every
// correct way of writing a constraint (CHECK (x > 0) and CHECK (0 < x) behave the same) while still
// catching a missing NOT NULL, a wrong FK action or a CHECK that is too loose.

/** pg_temp.attempt(sql): runs a statement, returns 'ok' or the SQLSTATE it raised (rolled back on error). */
export const ATTEMPT_FN = `CREATE FUNCTION pg_temp.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $fn$
BEGIN EXECUTE stmt; RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE;
END $fn$`;

/** One row per column: name, type, NOT NULL, default, identity, generated (in column order). */
export const columnsShape = (table: string) => `SELECT '${table} column' AS kind, a.attnum::int AS n,
       a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
         || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
         || CASE WHEN a.attgenerated = 's' THEN ' GENERATED STORED'
                 ELSE coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') END
         || CASE a.attidentity WHEN 'a' THEN ' IDENTITY ALWAYS' WHEN 'd' THEN ' IDENTITY BY DEFAULT' ELSE '' END AS detail
FROM pg_attribute a
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attrelid = '${table}'::regclass AND a.attnum > 0 AND NOT a.attisdropped`;

/** Primary key, unique and foreign key constraints by their columns (names don't matter). */
export const keysShape = (table: string) => `SELECT '${table} key' AS kind, 0 AS n,
       CASE c.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' ELSE 'FOREIGN KEY' END
         || ' (' || (SELECT string_agg(attname, ', ' ORDER BY array_position(c.conkey, attnum)) FROM pg_attribute WHERE attrelid = c.conrelid AND attnum = ANY (c.conkey)) || ')'
         || CASE WHEN c.contype = 'f' THEN ' REFERENCES ' || c.confrelid::regclass::text
              || ' ON DELETE ' || CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' ELSE 'SET DEFAULT' END
            ELSE '' END AS detail
FROM pg_constraint c
WHERE c.conrelid = '${table}'::regclass AND c.contype IN ('p', 'u', 'f')`;

/** Runs each test statement in order and reports 'label: ok' or 'label: <SQLSTATE>'. */
export const attemptsShape = (tests: [label: string, sql: string][]) => `SELECT 'test' AS kind, v.n, v.label || ': ' || pg_temp.attempt(v.stmt) AS detail
FROM (VALUES
${tests.map(([label, sql], i) => `  (${i + 1}, $l$${label}$l$, $s$${sql}$s$)`).join(',\n')}
) AS v(n, label, stmt)`;

/** Full behavioural verification of a table: its columns, its keys, then the test statements. */
export function verifyTable(table: string, tests: [string, string][] = [], opts: { columns?: boolean; keys?: boolean } = {}): string {
  const parts = [
    ...(opts.columns === false ? [] : [columnsShape(table)]),
    ...(opts.keys === false ? [] : [keysShape(table)]),
    ...(tests.length ? [attemptsShape(tests)] : []),
  ];
  return `${ATTEMPT_FN};\n${parts.join('\nUNION ALL\n')}`;
}
