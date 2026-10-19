import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { TOPIC_CONTENT } from '../../content/index.ts';
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

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('progress.title')}</h1>
      <dl className="grid grid-cols-3 gap-3">
        {[[t('progress.solved'), `${solved}/${total}`], [t('progress.attempted'), attempted], [t('progress.streak'), currentStreak(p.activeDays)]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="text-xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-2 font-semibold">{t('progress.byTopic')}</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {TOPICS.map((topic) => {
              const qs = TOPIC_CONTENT.find((c) => c.id === topic.id)?.questions ?? [];
              const s = qs.filter((q) => p.questions[q.id]?.solved).length;
              const a = qs.filter((q) => (p.questions[q.id]?.attempts ?? 0) > 0).length;
              return (
                <tr key={topic.id}>
                  <td className="py-1.5 pr-2"><Link to={`/topic/${topic.slug}`} className="hover:underline">{topic.id}. {topic.title}</Link></td>
                  <td className="py-1.5 text-right whitespace-nowrap text-zinc-500">{qs.length ? t('progress.topicRow', { solved: s, total: qs.length, tried: a }) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">{t('progress.move')}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('progress.moveText')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportFile} className="btn-primary">{t('progress.export')}</button>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')} aria-label={t('progress.importMode')} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="merge">{t('progress.importMerge')}</option>
            <option value="replace">{t('progress.importReplace')}</option>
          </select>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary">{t('progress.importFile')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
        </div>
        {message && <p className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{message.text}</p>}
      </section>

      <section className="flex flex-wrap items-center gap-4 text-sm">
        <button type="button" onClick={() => { if (window.confirm(t('progress.confirmReset'))) progress.resetAll(); }} className="text-red-700 hover:underline dark:text-red-400">
          {t('progress.resetAll')}
        </button>
        <Link to="/diagnostics" className="text-zinc-500 hover:underline">{t('progress.diagnostics')}</Link>
      </section>
    </div>
  );
}
