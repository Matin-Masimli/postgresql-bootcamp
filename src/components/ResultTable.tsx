import type { Column } from '../engine/types.ts';
import { typeName } from '../engine/compare.ts';

const NUMERIC = new Set([20, 21, 23, 26, 700, 701, 1700, 790]);

export function Cell({ value, type, highlight }: { value: string | null; type?: number; highlight?: boolean }) {
  const hl = highlight ? 'bg-red-100 dark:bg-red-900/50' : '';
  if (value === null) return <td className={`px-2 py-1 ${hl}`}><span className="rounded bg-zinc-100 px-1 font-mono text-[11px] text-zinc-400 dark:bg-zinc-800">NULL</span></td>;
  let shown = value;
  if (type === 16) shown = value === 't' ? 'true' : value === 'f' ? 'false' : value;
  const long = shown.length > 80;
  return (
    <td className={`px-2 py-1 font-mono whitespace-pre ${type !== undefined && NUMERIC.has(type) ? 'text-right' : ''} ${hl}`} title={long ? shown : undefined}>
      {long ? `${shown.slice(0, 80)}…` : shown === '' ? <span className="text-zinc-400 italic">(empty string)</span> : shown}
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
}

export default function ResultTable({ columns, rows, highlight, maxHeight = '420px', numbered = true }: Props) {
  const cols = columns.map((c) => (typeof c === 'string' ? { name: c, dataTypeID: undefined } : c));
  return (
    <div className="overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800" style={{ maxHeight }}>
      <table className="min-w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <tr>
            {numbered && <th className="px-2 py-1 text-right font-normal text-zinc-400">#</th>}
            {cols.map((c, i) => (
              <th key={i} className="px-2 py-1 font-medium whitespace-nowrap" title={c.dataTypeID !== undefined ? typeName(c.dataTypeID) : undefined}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
          {rows.map((r, i) => (
            <tr key={i}>
              {numbered && <td className="px-2 py-1 text-right text-xs text-zinc-400">{i + 1}</td>}
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
