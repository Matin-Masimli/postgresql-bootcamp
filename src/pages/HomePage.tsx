import { Link } from 'react-router';
import { topicContent } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import { currentStreak, useProgress } from '../progress/store.ts';

export default function HomePage() {
  const p = useProgress();
  const streak = currentStreak(p.activeDays);
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight">PostgreSQL Bootcamp</h1>
          <p className="mt-1 max-w-2xl text-zinc-600 dark:text-zinc-400">
            21 topics from SELECT to window functions and recursive CTEs. You write real SQL against a real PostgreSQL running in your
            browser. Get to know the <Link to="/schema" className="text-sky-700 underline dark:text-sky-400">practice database</Link> first.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {streak > 0 && <span className="rounded-md bg-amber-100 px-2.5 py-1.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">🔥 {streak}-day streak</span>}
          <Link to="/review" className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Mixed review</Link>
          <Link to="/exam" className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Final exam</Link>
        </div>
      </section>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => {
          const qs = topicContent(t.id)?.questions ?? [];
          const solved = qs.filter((q) => p.questions[q.id]?.solved).length;
          const pct = qs.length ? Math.round((solved / qs.length) * 100) : 0;
          return (
            <li key={t.id}>
              <Link to={`/topic/${t.slug}`} className="block h-full rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-sky-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-sky-700">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-zinc-400">{String(t.id).padStart(2, '0')}</span>
                  <h2 className="font-medium">{t.title}</h2>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.summary}</p>
                {qs.length > 0 ? (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.title} progress`}>
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{solved}/{qs.length} solved</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-400">Content coming in a later phase</p>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
