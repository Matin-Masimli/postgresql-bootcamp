import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { TOPIC_CONTENT } from '../../content/index.ts';
import PageHeader from '../components/PageHeader.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import { currentStreak, localDay, progress, useProgress } from '../progress/store.ts';

export default function ProgressPage() {
  const t = useT();
  const TOPICS = useContent().topics;
  const p = useProgress();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  const total = TOPIC_CONTENT.reduce((n, t) => n + t.questions.length, 0);
  const solved = Object.entries(p.questions).filter(([, q]) => q.solved).length;
  const attempted = Object.values(p.questions).filter((q) => q.attempts > 0).length;

  const exportFile = () => {
    const blob = new Blob([progress.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `postgresql-bootcamp-progress-${localDay()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importFile = async (file: File) => {
    try {
      const r = progress.importJson(await file.text(), mode);
      setMessage({ ok: true, text: t(mode === 'merge' ? 'progress.importedMerge' : 'progress.importedReplace', { n: r.questions }) });
    } catch (e) {
      setMessage({ ok: false, text: t('progress.importFailed', { error: (e as Error).message.slice(0, 200) }) });
    }
  };

  const pct = total ? Math.round((solved / total) * 100) : 0;
  const stats: [string, string, string?][] = [
    [t('progress.solved'), `${solved}`, `/ ${total}`],
    [t('progress.attempted'), `${attempted}`],
    [t('progress.streak'), `${currentStreak(p.activeDays)}`],
  ];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('progress.eyebrow')} title={t('progress.title')}>
        <dl className="grid max-w-3xl grid-cols-3 gap-2 pt-2 sm:gap-3">
          {stats.map(([k, v, suffix]) => (
            <div key={k} className="panel p-3 sm:p-4">
              <dt className="font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">{k}</dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums sm:text-2xl">{v}{suffix && <span className="ml-1 text-sm font-normal text-zinc-500 sm:text-base">{suffix}</span>}</dd>
            </div>
          ))}
        </dl>
        <div className="flex max-w-3xl items-center gap-3 pt-1">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-linear-to-r from-sky-500 to-violet-500 transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-sm font-semibold tabular-nums">{pct}%</span>
        </div>
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-3">
          <h2 className="font-semibold">{t('progress.byTopic')}</h2>
          <ul className="panel divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800/70">
            {TOPICS.map((topic) => {
              const qs = TOPIC_CONTENT.find((c) => c.id === topic.id)?.questions ?? [];
              const s = qs.filter((q) => p.questions[q.id]?.solved).length;
              const a = qs.filter((q) => (p.questions[q.id]?.attempts ?? 0) > 0).length;
              const done = qs.length > 0 && s === qs.length;
              return (
                <li key={topic.id}>
                  <Link to={`/topic/${topic.slug}`} className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 transition hover:bg-sky-50/60 sm:grid-cols-[2rem_minmax(0,1fr)_9rem_auto] dark:hover:bg-sky-500/5">
                    <span className={`font-mono text-xs ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`}>{done ? '✓' : String(topic.id).padStart(2, '0')}</span>
                    <span className="truncate text-sm font-medium group-hover:text-sky-700 dark:group-hover:text-sky-300">{topic.title}</span>
                    <span className="col-start-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 sm:col-start-auto dark:bg-zinc-800">
                      <span className="block h-full rounded-full bg-linear-to-r from-sky-500 to-violet-500" style={{ width: `${qs.length ? (s / qs.length) * 100 : 0}%` }} />
                    </span>
                    <span className="col-start-3 row-start-1 text-right font-mono text-xs whitespace-nowrap text-zinc-500 tabular-nums sm:col-start-auto sm:row-start-auto">{qs.length ? <><span className="sm:hidden">{s}/{qs.length}</span><span className="hidden sm:inline">{t('progress.topicRow', { solved: s, total: qs.length, tried: a })}</span></> : '—'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="panel space-y-3 p-5">
            <h2 className="font-semibold">{t('progress.move')}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('progress.moveText')}</p>
            <button type="button" onClick={exportFile} className="btn-primary w-full py-2">{t('progress.export')}</button>
            <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <label htmlFor="import-mode" className="block text-xs font-medium text-zinc-500">{t('progress.importMode')}</label>
              <select id="import-mode" value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')} className="field w-full py-2">
                <option value="merge">{t('progress.importMerge')}</option>
                <option value="replace">{t('progress.importReplace')}</option>
              </select>
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary w-full py-2">{t('progress.importFile')}</button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
            </div>
            {message && <p role="status" className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{message.text}</p>}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
            <Link to="/diagnostics" className="text-zinc-500 hover:text-sky-600 dark:hover:text-sky-300">{t('progress.diagnostics')} →</Link>
            <button type="button" onClick={() => { if (window.confirm(t('progress.confirmReset'))) progress.resetAll(); }} className="text-red-600 hover:underline dark:text-red-400">
              {t('progress.resetAll')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
