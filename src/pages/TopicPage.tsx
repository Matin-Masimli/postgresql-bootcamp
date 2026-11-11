import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Difficulty, Question } from '../../content/types.ts';
import { DifficultyBadge, QUESTION_TYPES, StatusIcon } from '../components/Badges.tsx';
import Markdown from '../components/Markdown.tsx';
import { LineBadge, LineStrip } from '../components/Metro.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import { lineOf, lineVars, stationsFor } from '../lib/metro.ts';
import { statusOf, useProgress, type QuestionStatus } from '../progress/store.ts';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard', 'interview'];
const LEVEL_BAR: Record<Difficulty, string> = { easy: 'bg-emerald-500', medium: 'bg-sky-600 dark:bg-sky-500', hard: 'bg-amber-500', interview: 'bg-teal-500' };

export default function TopicPage() {
  const t = useT();
  const c = useContent();
  const TOPICS = c.topics;
  const { slug } = useParams();
  const meta = TOPICS.find((x) => x.slug === slug);
  const content = meta ? c.topic(meta.id) : undefined;
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

  if (!meta) return <p>{t('topic.unknown')}</p>;
  const all = content?.questions ?? [];
  const solved = all.filter((q) => prog.questions[q.id]?.solved).length;
  const firstOpen = all.find((q) => !prog.questions[q.id]?.solved) ?? all[0];
  const prev = TOPICS.find((x) => x.id === meta.id - 1);
  const next = TOPICS.find((x) => x.id === meta.id + 1);
  const pct = all.length ? Math.round((solved / all.length) * 100) : 0;
  const stations = stationsFor(TOPICS, prog, c);
  const station = stations.find((s) => s.topic.id === meta.id)!;

  return (
    <div className="space-y-14">
      <header className="space-y-5 border-b border-black/[0.08] pb-10 dark:border-white/[0.08]" style={lineVars(station.line.n)}>
        <LineStrip station={station} stations={stations} />
        <h1 className="animate-fade-up pt-3 text-4xl leading-[1.04] font-extrabold tracking-[-0.03em] text-balance sm:text-6xl">{meta.title}</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-zinc-600 sm:text-[21px] dark:text-zinc-400">{meta.summary}</p>
        {t.locale !== 'en' && !c.isTranslated(meta.id) && (
          <p className="inline-block rounded-xl bg-amber-500/12 px-3 py-1.5 text-sm text-amber-800 dark:text-amber-200">{t('topic.notTranslated')}</p>
        )}
        {all.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-3">
            <Link to={`/topic/${meta.slug}/q/${firstOpen.id}`} className="btn-primary px-5 py-2.5 text-[16px]">
              {solved === 0 ? t('topic.startQuestions') : solved === all.length ? t('topic.reviewQuestions') : t('topic.continueQuestions')}
            </Link>
            <Link to={`/topic/${meta.slug}/handbook`} className="link text-[16px]">{t('topic.handbook')} <span aria-hidden>›</span></Link>
            <div className="flex items-center gap-2.5 sm:ml-auto">
              <div className="h-1 w-36 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.1]">
                <div className="h-full rounded-full bg-(--lc)" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[13px] text-zinc-500 tabular-nums">{t('common.solvedOf', { solved, total: all.length })}</span>
            </div>
          </div>
        )}
      </header>

      {content ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-12">
            <section className="max-w-3xl">
              <Markdown runnable>{content.explanation}</Markdown>
            </section>

            <section className="space-y-4" id="questions">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-3xl font-extrabold tracking-[-0.03em]">{t('topic.questions')}</h2>
                <select aria-label={t('topic.filter.difficulty')} className="field" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | 'all')}>
                  <option value="all">{t('topic.filter.allLevels')}</option>
                  {LEVELS.map((d) => <option key={d} value={d} className="capitalize">{t(`difficulty.${d}`)}</option>)}
                </select>
                <select aria-label={t('topic.filter.status')} className="field" value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus | 'all')}>
                  <option value="all">{t('topic.filter.anyStatus')}</option><option value="unsolved">{t('topic.filter.unsolved')}</option><option value="failed">{t('topic.filter.failed')}</option><option value="solved">{t('topic.filter.solved')}</option>
                </select>
                <select aria-label={t('topic.filter.type')} className="field" value={type} onChange={(e) => setType(e.target.value as Question['type'] | 'all')}>
                  <option value="all">{t('topic.filter.allTypes')}</option>
                  {QUESTION_TYPES.map((k) => <option key={k} value={k}>{t(`type.${k}`)}</option>)}
                </select>
              </div>
              <ul className="panel divide-y divide-black/[0.06] overflow-hidden dark:divide-white/[0.07]">
                {questions.map((q) => (
                  <li key={q.id}>
                    <Link to={`/topic/${meta.slug}/q/${q.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-black/[0.025] active:bg-black/[0.05] dark:hover:bg-white/[0.04]">
                      <StatusIcon s={statusOf(prog.questions[q.id])} />
                      <span className="hidden w-10 shrink-0 text-[13px] text-zinc-400 tabular-nums sm:inline">{q.id.split('-')[1]}</span>
                      <span className="min-w-0 flex-1 text-[16px] font-medium">{q.title}</span>
                      <span className="hidden text-[13px] text-zinc-500 md:inline">{t(`type.${q.type}`)}</span>
                      <DifficultyBadge d={q.difficulty} />
                      <span aria-hidden className="text-lg leading-none text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600">›</span>
                    </Link>
                  </li>
                ))}
                {questions.length === 0 && <li className="px-4 py-3 text-sm text-zinc-500">{t('topic.noMatch')}</li>}
              </ul>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="panel space-y-3.5 p-5">
              <p className="label">{t('topic.mix')}</p>
              {LEVELS.map((d) => {
                const qs = all.filter((q) => q.difficulty === d);
                const done = qs.filter((q) => prog.questions[q.id]?.solved).length;
                if (!qs.length) return null;
                return (
                  <button key={d} type="button" onClick={() => { setDifficulty(difficulty === d ? 'all' : d); document.getElementById('questions')?.scrollIntoView({ behavior: 'smooth' }); }} className="block w-full text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`capitalize ${difficulty === d ? 'font-semibold text-sky-600 dark:text-sky-300' : 'text-zinc-600 dark:text-zinc-400'}`}>{t(`difficulty.${d}`)}</span>
                      <span className="font-mono text-zinc-500">{done}/{qs.length}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.1]">
                      <div className={`h-full rounded-full ${LEVEL_BAR[d]}`} style={{ width: `${(done / qs.length) * 100}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {content.sources.length > 0 && (
              <div className="panel p-5">
                <p className="label mb-2">{t('topic.reading')}</p>
                <ul className="space-y-2 text-sm">
                  {content.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="group flex gap-1.5 text-[14px] leading-snug text-zinc-700 hover:text-sky-700 dark:text-zinc-300 dark:hover:text-sky-400">
                        <span aria-hidden className="text-zinc-400">↗</span><span className="group-hover:underline">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {prev ? (
                <Link to={`/topic/${prev.slug}`} className="panel panel-hover flex flex-col gap-1.5 px-4 py-3">
                  <span className="text-zinc-500">{t('topic.previous')}</span>
                  <span className="flex items-start gap-2 font-medium"><LineBadge n={lineOf(prev.id).n} className="mt-px size-[18px] text-[11px]" />{prev.title}</span>
                </Link>
              ) : <span />}
              {next && (
                <Link to={`/topic/${next.slug}`} className="panel panel-hover flex flex-col items-end gap-1.5 px-4 py-3 text-right">
                  <span className="text-zinc-500">{t('topic.next')}</span>
                  <span className="flex items-start gap-2 font-medium">{next.title}<LineBadge n={lineOf(next.id).n} className="mt-px size-[18px] text-[11px]" /></span>
                </Link>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <p className="text-zinc-500">{t('topic.noContent')}</p>
      )}
    </div>
  );
}
