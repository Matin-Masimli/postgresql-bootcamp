import type { Feedback } from '../engine/types.ts';
import ResultTable from './ResultTable.tsx';
import { ErrorBox } from './RunResults.tsx';

export default function FeedbackView({ feedback, sql }: { feedback: Feedback; sql: string }) {
  const f = feedback;
  if (f.pass) {
    return (
      <div role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        <p className="font-semibold">✓ {f.summary}</p>
      </div>
    );
  }
  const cols = f.expectedColumns ?? [];
  return (
    <div role="status" className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-semibold">✗ Not quite. {f.summary}</p>
      {f.error && <ErrorBox error={f.error} sql={f.dataset === 'main' ? sql : undefined} />}
      {f.kind === 'columns' && f.expectedColumns && f.actualColumns && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
          <dt className="text-amber-700 dark:text-amber-300">expected</dt><dd>{f.expectedColumns.join(', ')}</dd>
          <dt className="text-amber-700 dark:text-amber-300">yours</dt><dd>{f.actualColumns.join(', ')}</dd>
        </dl>
      )}
      {f.notes?.map((n) => <p key={n} className="text-xs">ℹ {n}</p>)}
      {f.firstMismatch && (f.firstMismatch.expected || f.firstMismatch.actual) && (
        <div className="space-y-1">
          <p className="text-xs font-medium">First difference, at row {f.firstMismatch.index + 1}:</p>
          <ResultTable
            columns={['', ...cols]}
            rows={[
              ['expected', ...(f.firstMismatch.expected ?? cols.map(() => '(no row)'))],
              ['yours', ...(f.firstMismatch.actual ?? cols.map(() => '(no row)'))],
            ]}
            highlight={new Map([[1, f.firstMismatch.cells.map((c) => c + 1)]])}
            numbered={false}
            maxHeight="200px"
          />
        </div>
      )}
      {f.missing && f.missing.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Missing from your result (expected but not returned){f.missing.length === 5 ? ', first 5' : ''}:</p>
          <ResultTable columns={cols} rows={f.missing} numbered={false} maxHeight="200px" />
        </div>
      )}
      {f.extra && f.extra.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Unexpected rows in your result{f.extra.length === 5 ? ', first 5' : ''}:</p>
          <ResultTable columns={f.actualColumns ?? cols} rows={f.extra} numbered={false} maxHeight="200px" />
        </div>
      )}
    </div>
  );
}
