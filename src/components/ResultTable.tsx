import type { Column } from '../engine/types.ts';
import { typeName } from '../engine/compare.ts';
import { useT } from '../i18n/index.ts';

const NUMERIC = new Set([20, 21, 23, 26, 700, 701, 1700, 790]);

export function Cell({ value, type, highlight }: { value: string | null; type?: number; highlight?: boolean }) {
  const t = useT();
  const hl = highlight ? 'bg-red-100 dark:bg-red-500/20 dark:text-red-200' : '';
  if (value === null) return <td className={`px-3 py-1.5 ${hl}`}><span className="rounded bg-zinc-100 px-1 font-mono text-[10px] tracking-wide text-zinc-400 italic dark:bg-zinc-800/80 dark:text-zinc-500">NULL</span></td>;
  let shown = value;
  if (type === 16) shown = value === 't' ? 'true' : value === 'f' ? 'false' : value;
  const long = shown.length > 80;
  return (
    <td className={`px-3 py-1.5 font-mono whitespace-pre ${type !== undefined && NUMERIC.has(type) ? 'text-right' : ''} ${hl}`} title={long ? shown : undefined}>
      {long ? `${shown.slice(0, 80)}…` : shown === '' ? <span className="text-zinc-400 italic">{t('results.emptyString')}</span> : shown}
    </td>
  );
}

interface Props {
  columns: Column[] | string[];
  rows: (string | null)[][];
  /** Row indexes → cell indexes to highlight. */
  highlight?: Map<number, number[]>;
  maxHeight?: string;
  numbered?: boolean;
  /** Equal-width columns, so several small tables (answer options) line up with each other. */
  fixed?: boolean;
}

export default function ResultTable({ columns, rows, highlight, maxHeight = '420px', numbered = true, fixed = false }: Props) {
  const cols = columns.map((c) => (typeof c === 'string' ? { name: c, dataTypeID: undefined } : c));
  return (
    <div className="overflow-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50" style={{ maxHeight }}>
      <table className={`min-w-full text-left text-[13px] ${fixed ? 'w-full table-fixed' : ''}`}>
        <thead className="sticky top-0 z-10 bg-zinc-100/95 text-zinc-600 backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-300">
          <tr>
            {numbered && <th className="w-10 px-3 py-2 text-right font-normal text-zinc-400 dark:text-zinc-600">#</th>}
            {cols.map((c, i) => (
              <th key={i} className={`border-b border-zinc-200 px-3 py-2 font-mono text-[12px] font-medium whitespace-nowrap dark:border-zinc-800 ${c.dataTypeID !== undefined && NUMERIC.has(c.dataTypeID) ? 'text-right' : ''}`} title={c.dataTypeID !== undefined ? typeName(c.dataTypeID) : undefined}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors hover:bg-sky-50/60 dark:hover:bg-sky-500/5">
              {numbered && <td className="px-3 py-1.5 text-right font-mono text-[11px] text-zinc-400 dark:text-zinc-600">{i + 1}</td>}
              {r.map((v, j) => (
                <Cell key={j} value={v} type={cols[j]?.dataTypeID} highlight={highlight?.get(i)?.includes(j)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
