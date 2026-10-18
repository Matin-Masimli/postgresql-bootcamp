// Shared engine types (used in the worker, the UI and the Node quality gate).

export interface Column { name: string; dataTypeID: number }
/** A result set with every value in PostgreSQL's canonical text form (NULL = null). */
export interface ResultSet { columns: Column[]; rows: (string | null)[][] }

export interface SqlError {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  /** 0-based offset into the whole submission, when PostgreSQL reported a position. */
  offset?: number;
  statementIndex?: number;
}

export interface StatementResult {
  /** Leading keywords, e.g. "SELECT", "UPDATE". */
  command: string;
  /** Rows returned (for row-returning statements) or affected (DML). */
  rowCount: number;
  /** The statement returned more rows than were fetched; rowCount is a lower bound. */
  rowCountCapped?: boolean;
  /** Present when the statement returned a result set. Rows may be truncated for display. */
  result?: ResultSet;
  truncated?: boolean;
  elapsedMs: number;
}

export interface RunOutput {
  statements: StatementResult[];
  error?: SqlError;
  totalMs: number;
}

export type Dataset = 'main' | 'hidden';

export interface Feedback {
  pass: boolean;
  /** One-line verdict shown prominently. */
  summary: string;
  /** Which dataset the verdict refers to. Hidden-data failures never include hidden rows. */
  dataset?: Dataset;
  kind?: 'error' | 'columns' | 'rows' | 'order' | 'values' | 'too-many-rows' | 'no-result' | 'hidden';
  expectedColumns?: string[];
  actualColumns?: string[];
  expectedRowCount?: number;
  actualRowCount?: number;
  /** Up to 5 rows the reference has that the submission lacks (and vice versa). */
  missing?: (string | null)[][];
  extra?: (string | null)[][];
  /** For ordered comparisons: first differing row. */
  firstMismatch?: { index: number; expected: (string | null)[] | null; actual: (string | null)[] | null; cells: number[] };
  notes?: string[];
  error?: SqlError;
}
