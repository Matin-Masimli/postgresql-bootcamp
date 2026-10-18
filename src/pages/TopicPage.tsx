import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { topicContent } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import type { Difficulty, Question } from '../../content/types.ts';
import { DifficultyBadge, StatusIcon, TYPE_LABEL } from '../components/Badges.tsx';
import Markdown from '../components/Markdown.tsx';
import { statusOf, useProgress, type QuestionStatus } from '../progress/store.ts';

const select = 'rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export default function TopicPage() {
  const { slug } = useParams();
  const meta = TOPICS.find((t) => t.slug === slug);
  const content = meta ? topicContent(meta.id) : undefined;
  const prog = useProgress();
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [status, setStatus] = useState<QuestionStatus | 'all'>('all');
  const [type, setType] = useState<Question['type'] | 'all'>('all');

  const questions = useMemo(
    () => (content?.questions ?? []).filter((q) =>
      (difficulty === 'all' || q.difficulty === difficulty) &&
      (type === 'all' || q.type === type) &&
      (status === 'all' || statusOf(prog.questions[q.id]) === status)),
    [content, difficulty, status, type, prog],
  );

  if (!meta) return <p>Unknown topic.</p>;
  const all = content?.questions ?? [];
  const solved = all.filter((q) => prog.questions[q.id]?.solved).length;
  const firstOpen = all.find((q) => !prog.questions[q.id]?.solved) ?? all[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-zinc-500"><Link to="/" className="hover:underline">Topics</Link> / {meta.id}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{meta.summary}</p>
        {all.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link to={`/topic/${meta.slug}/q/${firstOpen.id}`} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
              {solved === 0 ? 'Start quiz' : solved === all.length ? 'Review quiz' : 'Continue quiz'}
            </Link>
            <Link to={`/topic/${meta.slug}/handbook`} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Solution handbook
            </Link>
            <span className="text-sm text-zinc-500">{solved}/{all.length} solved</span>
          </div>
        )}
      </header>

      {content ? (
        <>
          <section className="max-w-3xl">
            <Markdown runnable>{content.explanation}</Markdown>
          </section>
          {content.sources.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Further reading</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {content.sources.map((s) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-sky-700 underline dark:text-sky-400">{s.title}</a></li>
                ))}
              </ul>
            </section>
          )}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-lg font-semibold">Questions</h2>
              <select aria-label="Difficulty" className={select} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | 'all')}>
                <option value="all">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="interview">Interview</option>
              </select>
              <select aria-label="Status" className={select} value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus | 'all')}>
                <option value="all">Any status</option><option value="unsolved">Not attempted</option><option value="failed">Attempted, unsolved</option><option value="solved">Solved</option>
              </select>
              <select aria-label="Type" className={select} value={type} onChange={(e) => setType(e.target.value as Question['type'] | 'all')}>
                <option value="all">All types</option>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {questions.map((q) => (
                <li key={q.id}>
                  <Link to={`/topic/${meta.slug}/q/${q.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <StatusIcon s={statusOf(prog.questions[q.id])} />
                    <span className="flex-1">{q.title}</span>
                    <span className="hidden text-xs text-zinc-500 sm:inline">{TYPE_LABEL[q.type]}</span>
                    <DifficultyBadge d={q.difficulty} />
                  </Link>
                </li>
              ))}
              {questions.length === 0 && <li className="px-4 py-3 text-sm text-zinc-500">No questions match these filters.</li>}
            </ul>
          </section>
        </>
      ) : (
        <p className="text-zinc-500">This topic's explanation and questions arrive in a later phase.</p>
      )}
    </div>
  );
}
