import { useMemo, useState } from 'react';
import ErDiagram from '../components/ErDiagram.tsx';
import PageHeader from '../components/PageHeader.tsx';
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
    <div className="space-y-10">
      <PageHeader
        eyebrow={t('schema.eyebrow')}
        title={t('schema.title')}
        intro={
          <Rich
            text={t('schema.intro', { tables: manifest.tables.length, rows: totalRows, version: manifest.postgresVersion, start: manifest.dataStart, end: manifest.referenceDate })}
            tags={{ b: (c) => <strong className="font-medium text-zinc-800 dark:text-zinc-200">{c}</strong> }}
          />
        }
      >
        <div className="max-w-3xl rounded-2xl bg-amber-500/[0.1] px-5 py-3.5 text-[15px] text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
          <Rich text={t('schema.refBox', { date: manifest.referenceDate })} />
        </div>
      </PageHeader>

      <section>
        <h2 className="text-xl font-semibold tracking-tight">{t('schema.relationships')}</h2>
        <p className="mt-1 mb-3 text-sm text-zinc-500">{t('schema.relHelp')}</p>
        <div className="panel overflow-x-auto">
          <ErDiagram tables={manifest.tables} onSelect={scrollTo} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('schema.tables')}</h2>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('schema.filter')}
            className="field ml-auto w-full px-3 py-2 sm:w-72"
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
    <article id={`table-${t.name}`} className="panel scroll-mt-20 overflow-hidden">
      <header className="border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.07]">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="font-mono text-[17px] font-semibold tracking-normal">{t.name}</h3>
          <span className="text-sm text-zinc-500">{tr('common.rows', { n: t.rowCount.main ?? 0 })}</span>
        </div>
        {t.comment && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{content.schemaComment(t.name, t.comment)}</p>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed text-left text-sm">
          <colgroup><col className="w-[22%]" /><col className="w-[24%]" /><col className="w-[24%]" /><col /></colgroup>
          <thead className="text-[12px] font-semibold text-zinc-500">
            <tr>
              <th className="px-5 py-2.5 font-semibold">{tr('schema.col.column')}</th>
              <th className="px-5 py-2.5 font-semibold">{tr('schema.col.type')}</th>
              <th className="px-5 py-2.5 font-semibold">{tr('schema.col.keys')}</th>
              <th className="px-5 py-2.5 font-semibold">{tr('schema.col.notes')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
            {t.columns.map((c) => (
              <tr key={c.name} className={highlight && c.name.includes(highlight) ? 'bg-sky-600/[0.06] dark:bg-sky-400/[0.08]' : undefined}>
                <td className="truncate px-5 py-2 font-mono" title={c.name}>{c.name}</td>
                <td className="px-5 py-2 font-mono text-xs whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  {c.type}
                  {c.nullable ? '' : <span className="ml-1.5 text-zinc-400">NOT NULL</span>}
                </td>
                <td className="px-5 py-2">
                  {pk.has(c.name) && <Badge tone="amber">PK</Badge>}
                  {fks.has(c.name) && <Badge tone="sky">FK → {fks.get(c.name)}</Badge>}
                  {uniqueCols.has(c.name) && <Badge tone="zinc">UNIQUE</Badge>}
                  {c.identity && <Badge tone="zinc">IDENTITY</Badge>}
                </td>
                <td className="px-5 py-2 text-zinc-600 dark:text-zinc-400">
                  {content.schemaComment(`${t.name}.${c.name}`, c.comment)}
                  {c.default && !c.identity && <span className="ml-1 font-mono text-xs text-zinc-400">{tr('schema.default', { value: c.default })}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(checks.length > 0 || compositePk || uniques.some((u) => u.columns.length > 1)) && (
        <details className="border-t border-black/[0.06] px-5 py-3 text-sm dark:border-white/[0.07]">
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
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-500',
    sky: 'bg-sky-600/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400',
    zinc: 'bg-black/[0.05] text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300',
  }[tone];
  return <span className={`mr-1 mb-0.5 inline-block rounded-full px-2 py-0.5 font-mono text-[11px] ${cls}`}>{children}</span>;
}

function ErrorBox({ message }: { message: string }) {
  return <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{message}</p>;
}
