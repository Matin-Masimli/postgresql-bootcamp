import type { Feedback } from '../engine/types.ts';
import { useT } from '../i18n/index.ts';
import ResultTable from './ResultTable.tsx';
import { ErrorBox } from './RunResults.tsx';

export default function FeedbackView({ feedback, sql, summary }: { feedback: Feedback; sql: string; summary?: string }) {
  const t = useT();
  const f = feedback;
  const text = summary ?? t.msg(f.msg, f.summary);
  if (f.pass) {
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <p className="font-semibold">✓ {text}</p>
      </div>
    );
  }
  const cols = f.expectedColumns ?? [];
  return (
    <div role="status" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="font-semibold">{t('feedback.notQuite')} {text}</p>
      {f.error && <ErrorBox error={f.error} sql={f.dataset === 'main' ? sql : undefined} />}
      {f.kind === 'columns' && f.expectedColumns && f.actualColumns && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
          <dt className="text-amber-700 dark:text-amber-300">{t('feedback.expected')}</dt><dd>{f.expectedColumns.join(', ')}</dd>
          <dt className="text-amber-700 dark:text-amber-300">{t('feedback.yours')}</dt><dd>{f.actualColumns.join(', ')}</dd>
        </dl>
      )}
      {f.notes?.map((n, i) => <p key={n} className="text-xs">ℹ {t.msg(f.noteMsgs?.[i], n)}</p>)}
      {f.firstMismatch && (f.firstMismatch.expected || f.firstMismatch.actual) && (
        <div className="space-y-1">
          <p className="text-xs font-medium">{t('feedback.firstDifference', { n: f.firstMismatch.index + 1 })}</p>
          <ResultTable
            columns={['', ...cols]}
            rows={[
              [t('feedback.expected'), ...(f.firstMismatch.expected ?? cols.map(() => t('feedback.noRow')))],
              [t('feedback.yours'), ...(f.firstMismatch.actual ?? cols.map(() => t('feedback.noRow')))],
            ]}
            highlight={new Map([[1, f.firstMismatch.cells.map((c) => c + 1)]])}
            numbered={false}
            maxHeight="200px"
          />
        </div>
      )}
      {f.missing && f.missing.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">{t('feedback.missing', { first5: f.missing.length === 5 ? 1 : 0 })}</p>
          <ResultTable columns={cols} rows={f.missing} numbered={false} maxHeight="200px" />
        </div>
      )}
      {f.extra && f.extra.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">{t('feedback.extra', { first5: f.extra.length === 5 ? 1 : 0 })}</p>
          <ResultTable columns={f.actualColumns ?? cols} rows={f.extra} numbered={false} maxHeight="200px" />
        </div>
      )}
    </div>
  );
}
