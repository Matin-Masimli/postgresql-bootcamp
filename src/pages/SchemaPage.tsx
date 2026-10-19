import { useMemo, useState } from 'react';
import ErDiagram from '../components/ErDiagram.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Rich from '../i18n/Rich.tsx';
import { useManifest, type TableMeta } from '../lib/manifest.ts';

export default function SchemaPage() {
  const t = useT();
  const { manifest, error } = useManifest();
  const [filter, setFilter] = useState('');

  const tables = useMemo(() => {
    if (!manifest) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return manifest.tables;
    return manifest.tables.filter((t) => t.name.includes(q) || t.columns.some((c) => c.name.includes(q)));
  }, [manifest, filter]);

  if (error) return <ErrorBox message={error} />;
  if (!manifest) return <p className="text-zinc-500">{t('common.loadingSchema')}</p>;

  const totalRows = Object.values(manifest.datasets.main.rowCount).reduce((a, b) => a + b, 0);
  const scrollTo = (name: string) => document.getElementById(`table-${name}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">{t('schema.title')}</h1>
        <p className="mt-1 max-w-3xl text-zinc-600 dark:text-zinc-400">
          <Rich
            text={t('schema.intro', { tables: manifest.tables.length, rows: totalRows, version: manifest.postgresVersion, start: manifest.dataStart, end: manifest.referenceDate })}
            tags={{ b: (c) => <strong className="font-medium text-zinc-800 dark:text-zinc-200">{c}</strong> }}
          />
        </p>
        <div className="mt-3 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-500/10 dark:text-amber-200">
          <Rich text={t('schema.refBox', { date: manifest.referenceDate })} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('schema.relationships')}</h2>
        <p className="mb-2 text-sm text-zinc-500">{t('schema.relHelp')}</p>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <ErDiagram tables={manifest.tables} onSelect={scrollTo} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{t('schema.tables')}</h2>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('schema.filter')}
            className="ml-auto w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm sm:w-64 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        {tables.length === 0 && <p className="text-sm text-zinc-500">{t('schema.noMatch', { q: filter })}</p>}
        {tables.map((t) => (
          <TableCard key={t.name} table={t} highlight={filter.trim().toLowerCase()} />
        ))}
      </section>
    </div>
  );
}

function TableCard({ table: t, highlight }: { table: TableMeta; highlight: string }) {
  const tr = useT();
  const content = useContent();
  const pk = new Set(t.constraints.filter((c) => c.type === 'p').flatMap((c) => c.columns));
  const fks = new Map(t.constraints.filter((c) => c.type === 'f').map((c) => [c.columns[0], `${c.refTable}.${c.refColumns![0]}`]));
  const uniques = t.constraints.filter((c) => c.type === 'u');
  const uniqueCols = new Set(uniques.filter((u) => u.columns.length === 1).map((u) => u.columns[0]));
  const checks = t.constraints.filter((c) => c.type === 'c');
  const compositePk = t.constraints.find((c) => c.type === 'p' && c.columns.length > 1);

  return (
    <article id={`table-${t.name}`} className="scroll-mt-20 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="font-mono text-base font-semibold">{t.name}</h3>
          <span className="text-sm text-zinc-500">{tr('common.rows', { n: t.rowCount.main ?? 0 })}</span>
        </div>
        {t.comment && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{content.schemaComment(t.name, t.comment)}</p>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">{tr('schema.col.column')}</th>
              <th className="px-4 py-2 font-medium">{tr('schema.col.type')}</th>
              <th className="px-4 py-2 font-medium">{tr('schema.col.keys')}</th>
              <th className="px-4 py-2 font-medium">{tr('schema.col.notes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {t.columns.map((c) => (
              <tr key={c.name} className={highlight && c.name.includes(highlight) ? 'bg-sky-50 dark:bg-sky-950/40' : undefined}>
                <td className="px-4 py-1.5 font-mono whitespace-nowrap">{c.name}</td>
                <td className="px-4 py-1.5 font-mono text-xs whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  {c.type}
                  {c.nullable ? '' : <span className="ml-1.5 text-zinc-400">NOT NULL</span>}
                </td>
                <td className="px-4 py-1.5 whitespace-nowrap">
                  {pk.has(c.name) && <Badge tone="amber">PK</Badge>}
                  {fks.has(c.name) && <Badge tone="sky">FK → {fks.get(c.name)}</Badge>}
                  {uniqueCols.has(c.name) && <Badge tone="zinc">UNIQUE</Badge>}
                  {c.identity && <Badge tone="zinc">IDENTITY</Badge>}
                </td>
                <td className="px-4 py-1.5 text-zinc-600 dark:text-zinc-400">
                  {content.schemaComment(`${t.name}.${c.name}`, c.comment)}
                  {c.default && !c.identity && <span className="ml-1 font-mono text-xs text-zinc-400">{tr('schema.default', { value: c.default })}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(checks.length > 0 || compositePk || uniques.some((u) => u.columns.length > 1)) && (
        <details className="border-t border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
          <summary className="cursor-pointer text-zinc-500">{tr('schema.constraints')}</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            {t.constraints.filter((c) => c.type !== 'f').map((c) => (
              <li key={c.name}>
                <span className="text-zinc-400">{c.name}:</span> {c.definition}
              </li>
            ))}
            {t.indexes.map((i) => (
              <li key={i.name} className="text-zinc-400">{i.definition}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Badge({ tone, children }: { tone: 'amber' | 'sky' | 'zinc'; children: React.ReactNode }) {
  const cls = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
    zinc: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  }[tone];
  return <span className={`mr-1 inline-block rounded px-1.5 py-0.5 font-mono text-[11px] ${cls}`}>{children}</span>;
}

function ErrorBox({ message }: { message: string }) {
  return <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{message}</p>;
}
