import { useState } from 'react';
import { useManifest } from '../lib/manifest.ts';

/** Compact table/column list. Clicking a name inserts it into the editor. */
export default function SchemaQuickRef({ onInsert }: { onInsert?: (text: string) => void }) {
  const { manifest } = useManifest();
  const [open, setOpen] = useState<string | null>(null);
  if (!manifest) return <p className="text-sm text-zinc-500">Loading schema…</p>;
  return (
    <div className="text-sm">
      <p className="mb-2 text-xs text-zinc-500">
        Reference date: <strong>{manifest.referenceDate}</strong>. {onInsert ? 'Tap a name to insert it into the editor.' : ''}
      </p>
      <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {manifest.tables.map((t) => {
          const pk = new Set(t.constraints.filter((c) => c.type === 'p').flatMap((c) => c.columns));
          const fk = new Map(t.constraints.filter((c) => c.type === 'f').map((c) => [c.columns[0], c.refTable]));
          const isOpen = open === t.name;
          return (
            <li key={t.name}>
              <div className="flex items-center">
                <button type="button" onClick={() => setOpen(isOpen ? null : t.name)} className="flex-1 px-2 py-1.5 text-left font-mono text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-800/60" aria-expanded={isOpen}>
                  <span className="inline-block w-3 text-zinc-400">{isOpen ? '▾' : '▸'}</span> {t.name}
                  <span className="ml-1 text-[11px] text-zinc-400">{t.rowCount.main?.toLocaleString()}</span>
                </button>
                {onInsert && (
                  <button type="button" onClick={() => onInsert(t.name)} className="px-2 text-xs text-sky-700 hover:underline dark:text-sky-400" aria-label={`Insert ${t.name}`}>
                    insert
                  </button>
                )}
              </div>
              {isOpen && (
                <ul className="pb-2 pl-6">
                  {t.columns.map((c) => (
                    <li key={c.name} className="flex items-baseline gap-2 py-0.5 font-mono text-[12px]">
                      <button type="button" disabled={!onInsert} onClick={() => onInsert?.(c.name)} className="text-left hover:text-sky-700 disabled:cursor-default dark:hover:text-sky-400" title={c.comment ?? undefined}>
                        {c.name}
                      </button>
                      <span className="text-zinc-400">{c.type}</span>
                      {pk.has(c.name) && <span className="text-amber-600 dark:text-amber-400">PK</span>}
                      {fk.has(c.name) && <span className="text-sky-700 dark:text-sky-400">→ {fk.get(c.name)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
