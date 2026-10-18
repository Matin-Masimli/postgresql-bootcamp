import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { topicContent } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import type { Difficulty, Question } from '../../content/types.ts';
import { DifficultyBadge, StatusIcon, TYPE_LABEL } from '../components/Badges.tsx';
import Markdown from '../components/Markdown.tsx';
import { statusOf, useProgress, type QuestionStatus } from '../progress/store.ts';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard', 'interview'];
const LEVEL_BAR: Record<Difficulty, string> = { easy: 'bg-emerald-500', medium: 'bg-sky-500', hard: 'bg-amber-500', interview: 'bg-fuchsia-500' };

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
  const prev = TOPICS.find((t) => t.id === meta.id - 1);
  const next = TOPICS.find((t) => t.id === meta.id + 1);
  const pct = all.length ? Math.round((solved / all.length) * 100) : 0;

  return (
    <div className="space-y-10">
      <header className="animate-fade-up relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/70 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        <span aria-hidden className="pointer-events-none absolute -top-10 right-2 font-mono text-[10rem] leading-none font-bold text-zinc-900/[0.04] dark:text-white/[0.04]">
          {String(meta.id).padStart(2, '0')}
        </span>
        <div aria-hidden className="absolute -top-24 -left-24 size-72 rounded-full bg-sky-500/15 blur-3xl" />
        <nav className="relative font-mono text-xs text-zinc-500">
          <Link to="/" className="hover:text-sky-500">learn</Link> / topic {String(meta.id).padStart(2, '0')}
        </nav>
        <h1 className="relative mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{meta.title}</h1>
        <p className="relative mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">{meta.summary}</p>
        {all.length > 0 && (
          <div className="relative mt-6 flex flex-wrap items-center gap-3">
            <Link to={`/topic/${meta.slug}/q/${firstOpen.id}`} className="btn-primary px-4 py-2">
              {solved === 0 ? 'Start the questions' : solved === all.length ? 'Review the questions' : 'Continue the questions'} <span aria-hidden>→</span>
            </Link>
            <Link to={`/topic/${meta.slug}/handbook`} className="btn-secondary px-4 py-2">Solution handbook</Link>
            <div className="ml-1 flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-linear-to-r from-sky-500 to-violet-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-xs text-zinc-500">{solved}/{all.length} solved</span>
            </div>
          </div>
        )}
      </header>

      {content ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-12">
            <section className="max-w-3xl">
              <p className="eyebrow mb-3">Lesson</p>
              <Markdown runnable>{content.explanation}</Markdown>
            </section>

            <section className="space-y-4" id="questions">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto">
                  <p className="eyebrow">Practice</p>
                  <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
                </div>
                <select aria-label="Difficulty" className="field" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | 'all')}>
                  <option value="all">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="interview">Interview</option>
                </select>
                <select aria-label="Status" className="field" value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus | 'all')}>
                  <option value="all">Any status</option><option value="unsolved">Not attempted</option><option value="failed">Attempted, unsolved</option><option value="solved">Solved</option>
                </select>
                <select aria-label="Type" className="field" value={type} onChange={(e) => setType(e.target.value as Question['type'] | 'all')}>
                  <option value="all">All types</option>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <ul className="panel divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800/70">
                {questions.map((q) => (
                  <li key={q.id}>
                    <Link to={`/topic/${meta.slug}/q/${q.id}`} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-sky-50/60 dark:hover:bg-sky-500/5">
                      <StatusIcon s={statusOf(prog.questions[q.id])} />
                      <span className="hidden w-14 shrink-0 font-mono text-[11px] text-zinc-400 sm:inline">{q.id.split('-')[1]}</span>
                      <span className="min-w-0 flex-1 font-medium">{q.title}</span>
                      <span className="hidden text-xs text-zinc-500 md:inline">{TYPE_LABEL[q.type]}</span>
                      <DifficultyBadge d={q.difficulty} />
                      <span aria-hidden className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500 dark:text-zinc-700">→</span>
                    </Link>
                  </li>
                ))}
                {questions.length === 0 && <li className="px-4 py-3 text-sm text-zinc-500">No questions match these filters.</li>}
              </ul>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="panel space-y-3 p-4">
              <p className="eyebrow">Question mix</p>
              {LEVELS.map((d) => {
                const qs = all.filter((q) => q.difficulty === d);
                const done = qs.filter((q) => prog.questions[q.id]?.solved).length;
                if (!qs.length) return null;
                return (
                  <button key={d} type="button" onClick={() => { setDifficulty(difficulty === d ? 'all' : d); document.getElementById('questions')?.scrollIntoView({ behavior: 'smooth' }); }} className="block w-full text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`capitalize ${difficulty === d ? 'font-semibold text-sky-600 dark:text-sky-300' : 'text-zinc-600 dark:text-zinc-400'}`}>{d}</span>
                      <span className="font-mono text-zinc-500">{done}/{qs.length}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className={`h-full rounded-full ${LEVEL_BAR[d]}`} style={{ width: `${(done / qs.length) * 100}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {content.sources.length > 0 && (
              <div className="panel p-4">
                <p className="eyebrow mb-2">Further reading</p>
                <ul className="space-y-2 text-sm">
                  {content.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="group flex gap-1.5 text-zinc-700 hover:text-sky-600 dark:text-zinc-300 dark:hover:text-sky-300">
                        <span aria-hidden className="text-sky-500">↗</span><span className="group-hover:underline">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {prev ? <Link to={`/topic/${prev.slug}`} className="panel px-3 py-2 hover:border-sky-400/60"><span className="block text-zinc-500">← previous</span><span className="font-medium">{prev.title}</span></Link> : <span />}
              {next && <Link to={`/topic/${next.slug}`} className="panel px-3 py-2 text-right hover:border-sky-400/60"><span className="block text-zinc-500">next →</span><span className="font-medium">{next.title}</span></Link>}
            </div>
          </aside>
        </div>
      ) : (
        <p className="text-zinc-500">This topic's explanation and questions arrive in a later phase.</p>
      )}
    </div>
  );
}
