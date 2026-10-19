import type { RunOutput, SqlError } from '../engine/types.ts';
import { useT } from '../i18n/index.ts';
import ResultTable from './ResultTable.tsx';

const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.max(1, Math.round(n))} ms`);

/** Line/column of an offset in the submitted SQL (1-based). */
function lineCol(sql: string, offset: number) {
  const before = sql.slice(0, offset).split('\n');
  return { line: before.length, col: before[before.length - 1].length + 1 };
}

export function ErrorBox({ error, sql, title }: { error: SqlError; sql?: string; title?: string }) {
  const t = useT();
  const pos = sql !== undefined && error.offset !== undefined ? lineCol(sql, error.offset) : null;
  // SQLSTATE codes are 5 characters; anything else (timeouts, sandbox rules) didn't come from PostgreSQL.
  const isPg = !!error.code && /^[0-9A-Z]{5}$/.test(error.code);
  title ??= isPg ? t('results.pgError') : error.code === 'TIMEOUT' ? t('results.stopped') : t('results.cannotRun');
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <p className="font-medium">
        {title}
        {isPg && <span className="ml-2 font-mono text-xs opacity-70">SQLSTATE {error.code}</span>}
      </p>
      <p className="mt-1 font-mono text-[13px] whitespace-pre-wrap">{isPg ? 'ERROR: ' : ''}{t.msg(error.msg, error.message)}</p>
      {error.detail && <p className="mt-1 font-mono text-[13px] whitespace-pre-wrap">DETAIL: {error.detail}</p>}
      {error.hint && <p className="mt-1 font-mono text-[13px] whitespace-pre-wrap">HINT: {error.hint}</p>}
      {pos && <p className="mt-1 text-xs opacity-80">{error.statementIndex !== undefined ? t('results.atLineStatement', { line: pos.line, col: pos.col, n: error.statementIndex + 1 }) : t('results.atLine', { line: pos.line, col: pos.col })}</p>}
    </div>
  );
}

export default function RunResults({ output, sql }: { output: RunOutput; sql: string }) {
  const t = useT();
  const withResult = [...output.statements].reverse().find((s) => s.result);
  return (
    <div className="space-y-3">
      {output.statements.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {output.statements.map((s, i) => (
            <li key={i}>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{s.command}</span>{' '}
              {s.result
                ? t('results.returned', { n: s.rowCount, capped: s.rowCountCapped ? 1 : 0 })
                : t('results.affected', { n: s.rowCount })}{' '}
              · {ms(s.elapsedMs)}
            </li>
          ))}
        </ul>
      )}
      {output.error && <ErrorBox error={output.error} sql={sql} />}
      {withResult?.result && (
        <>
          {withResult.result.rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
              {t('results.noRows', { cols: withResult.result.columns.map((c) => c.name).join(', ') })}
            </p>
          ) : (
            <ResultTable columns={withResult.result.columns} rows={withResult.result.rows} />
          )}
          {withResult.truncated && (
            <p className="text-xs text-zinc-500">
              {t('results.showing', { shown: withResult.result.rows.length, total: withResult.rowCount, capped: withResult.rowCountCapped ? 1 : 0 })}
            </p>
          )}
        </>
      )}
      {!output.error && !withResult && output.statements.length > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('results.done')}</p>
      )}
    </div>
  );
}
