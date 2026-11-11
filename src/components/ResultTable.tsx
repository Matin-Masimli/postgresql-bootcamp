import type { Column } from '../engine/types.ts';
import { typeName } from '../engine/compare.ts';
import { useT } from '../i18n/index.ts';

const NUMERIC = new Set([20, 21, 23, 26, 700, 701, 1700, 790]);

export function Cell({ value, type, highlight }: { value: string | null; type?: number; highlight?: boolean }) {
  const t = useT();
  const hl = highlight ? 'bg-red-500/[0.12] text-red-800 dark:bg-red-500/25 dark:text-red-100' : '';
  if (value === null) return <td className={`px-3.5 py-2 ${hl}`}><span className="rounded-md bg-black/[0.05] px-1.5 py-px font-mono text-[10.5px] text-zinc-400 dark:bg-white/[0.08] dark:text-zinc-500">NULL</span></td>;
  let shown = value;
  if (type === 16) shown = value === 't' ? 'true' : value === 'f' ? 'false' : value;
  const long = shown.length > 80;
  return (
    <td className={`px-3.5 py-2 font-mono text-[13px] whitespace-pre ${type !== undefined && NUMERIC.has(type) ? 'text-right' : ''} ${hl}`} title={long ? shown : undefined}>
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
    <div className="overflow-auto rounded-2xl bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.07] dark:bg-zinc-900 dark:shadow-none dark:ring-white/[0.08]" style={{ maxHeight }}>
      <table className={`min-w-full text-left text-[13px] ${fixed ? 'w-full table-fixed' : ''}`}>
        <thead className="material sticky top-0 z-10 text-zinc-500 dark:text-zinc-400">
          <tr>
            {numbered && <th className="w-10 border-b border-black/[0.08] px-3 py-2.5 text-right text-[11px] font-normal text-zinc-400 dark:border-white/[0.08] dark:text-zinc-600">#</th>}
            {cols.map((c, i) => (
              <th key={i} className={`border-b border-black/[0.08] px-3.5 py-2.5 text-[12px] font-semibold whitespace-nowrap dark:border-white/[0.08] ${c.dataTypeID !== undefined && NUMERIC.has(c.dataTypeID) ? 'text-right' : ''}`} title={c.dataTypeID !== undefined ? typeName(c.dataTypeID) : undefined}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
              {numbered && <td className="px-3 py-2 text-right text-[11px] text-zinc-400 tabular-nums dark:text-zinc-600">{i + 1}</td>}
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
