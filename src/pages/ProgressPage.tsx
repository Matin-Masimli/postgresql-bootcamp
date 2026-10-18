import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { TOPIC_CONTENT } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import { currentStreak, localDay, progress, useProgress } from '../progress/store.ts';

export default function ProgressPage() {
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
      setMessage({ ok: true, text: `Imported progress for ${r.questions} questions (${mode === 'merge' ? 'merged with' : 'replacing'} this device's progress).` });
    } catch (e) {
      setMessage({ ok: false, text: `That file couldn't be imported: ${(e as Error).message.slice(0, 200)}` });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <dl className="grid grid-cols-3 gap-3">
        {[['Solved', `${solved}/${total}`], ['Attempted', attempted], ['Day streak', currentStreak(p.activeDays)]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs text-zinc-500">{k}</dt>
            <dd className="text-xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-2 font-semibold">By topic</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {TOPICS.map((t) => {
              const qs = TOPIC_CONTENT.find((c) => c.id === t.id)?.questions ?? [];
              const s = qs.filter((q) => p.questions[q.id]?.solved).length;
              const a = qs.filter((q) => (p.questions[q.id]?.attempts ?? 0) > 0).length;
              return (
                <tr key={t.id}>
                  <td className="py-1.5 pr-2"><Link to={`/topic/${t.slug}`} className="hover:underline">{t.id}. {t.title}</Link></td>
                  <td className="py-1.5 text-right whitespace-nowrap text-zinc-500">{qs.length ? `${s}/${qs.length} solved · ${a} tried` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Move progress between devices</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Progress is stored in this browser only. Export it as a JSON file, then import that file on your other device. Drafts of your SQL are included.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportFile} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">Export progress</button>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')} aria-label="Import mode" className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <option value="merge">Import: merge (keep the best of both)</option>
            <option value="replace">Import: replace this device's progress</option>
          </select>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Import file…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
        </div>
        {message && <p className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{message.text}</p>}
      </section>

      <section className="flex flex-wrap items-center gap-4 text-sm">
        <button type="button" onClick={() => { if (window.confirm('Delete all progress on this device? Export first if you want a backup.')) progress.resetAll(); }} className="text-red-700 hover:underline dark:text-red-400">
          Reset all progress
        </button>
        <Link to="/diagnostics" className="text-zinc-500 hover:underline">Database diagnostics</Link>
      </section>
    </div>
  );
}
