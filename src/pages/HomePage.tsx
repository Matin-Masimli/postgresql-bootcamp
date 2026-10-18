import { Link } from 'react-router';
import { TOPICS } from '../../content/topicList.ts';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">PostgreSQL Bootcamp</h1>
        <p className="mt-1 max-w-2xl text-zinc-600 dark:text-zinc-400">
          21 topics from SELECT to window functions and recursive CTEs. You write real SQL against a real PostgreSQL
          running in your browser. Start by exploring the <Link to="/schema" className="text-sky-700 underline dark:text-sky-400">practice database</Link>.
        </p>
      </section>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => (
          <li key={t.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-zinc-400">{String(t.id).padStart(2, '0')}</span>
              <h2 className="font-medium">{t.title}</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.summary}</p>
            <p className="mt-3 text-xs text-zinc-400">Content coming in a later phase</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
