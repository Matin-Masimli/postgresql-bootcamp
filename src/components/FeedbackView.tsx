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
      <div role="status" className="animate-materialize flex items-start gap-3 rounded-2xl bg-emerald-500/[0.1] px-4 py-3.5 text-[15px] text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">
        <span aria-hidden className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.2 2.3 2.3 4.7-5" /></svg></span>
        <p className="font-semibold">{text}</p>
      </div>
    );
  }
  const cols = f.expectedColumns ?? [];
  return (
    <div role="status" className="animate-materialize space-y-3 rounded-2xl bg-amber-500/[0.1] px-4 py-3.5 text-[14px] text-amber-950 dark:bg-amber-500/15 dark:text-amber-50">
      <p className="flex items-start gap-3 text-[15px] font-semibold"><span aria-hidden className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-amber-500 text-[13px] font-bold text-white">!</span><span>{t('feedback.notQuite')} {text}</span></p>
      {f.error && <ErrorBox error={f.error} sql={f.dataset === 'main' ? sql : undefined} />}
      {f.kind === 'columns' && f.expectedColumns && f.actualColumns && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
          <dt className="text-amber-700 dark:text-amber-300">{t('feedback.expected')}</dt><dd>{f.expectedColumns.join(', ')}</dd>
          <dt className="text-amber-700 dark:text-amber-300">{t('feedback.yours')}</dt><dd>{f.actualColumns.join(', ')}</dd>
        </dl>
      )}
      {f.notes?.map((n, i) => <p key={n} className="text-[13px] opacity-90">{t.msg(f.noteMsgs?.[i], n)}</p>)}
      {f.firstMismatch && (f.firstMismatch.expected || f.firstMismatch.actual) && (
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">{t('feedback.firstDifference', { n: f.firstMismatch.index + 1 })}</p>
          <ResultTable
            columns={['', ...cols]}
            rows={[
              [t('feedback.expected'), ...(f.firstMismatch.expected ?? cols.map(() => t('feedback.noRow')))],
              [t('feedback.yours'), ...(f.firstMismatch.actual ?? cols.map(() => t('feedback.noRow')))],
            ]}
            highlight={new Map([[1, f.firstMismatch.cells.map((c) => c + 1)]])}
            numbered={false}
            maxHeight="260px"
          />
        </div>
      )}
      {f.missing && f.missing.length > 0 && (
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">{t('feedback.missing', { first5: f.missing.length === 5 ? 1 : 0 })}</p>
          <ResultTable columns={cols} rows={f.missing} numbered={false} maxHeight="260px" />
        </div>
      )}
      {f.extra && f.extra.length > 0 && (
        <div className="space-y-1">
          <p className="text-[13px] font-semibold">{t('feedback.extra', { first5: f.extra.length === 5 ? 1 : 0 })}</p>
          <ResultTable columns={f.actualColumns ?? cols} rows={f.extra} numbered={false} maxHeight="260px" />
        </div>
      )}
    </div>
  );
}
