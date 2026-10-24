import { useState } from 'react';
import { Link } from 'react-router';
import type { Topic } from '../../content/types.ts';
import PageHeader, { EmptyState } from '../components/PageHeader.tsx';
import QuestionRunner from '../components/QuestionRunner.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import { readSession, shuffle, writeSession } from '../lib/session.ts';
import { useProgress, type ProgressData } from '../progress/store.ts';

const KEY = 'pgb.review';
const SIZE = 10;
interface ReviewSession { ids: string[]; index: number }

/** Topics count as completed for review once at least half of their questions are solved. */
function completedTopics(p: ProgressData, all: Topic[]) {
  return all.filter((t) => t.questions.length > 0 && t.questions.filter((q) => p.questions[q.id]?.solved).length * 2 >= t.questions.length);
}

export default function ReviewPage() {
  const t = useT();
  const content = useContent();
  const prog = useProgress();
  const [session, setSession] = useState<ReviewSession | null>(() => readSession<ReviewSession>(KEY));
  const save = (s: ReviewSession | null) => {
    writeSession(KEY, s);
    setSession(s);
  };
  const topics = completedTopics(prog, content.topics.map((m) => content.topic(m.id)!).filter(Boolean));

  const start = () => {
    const pool = topics.flatMap((t) => t.questions);
    // Prefer questions not solved yet or not seen recently, then fill with the rest.
    const unsolved = shuffle(pool.filter((q) => !prog.questions[q.id]?.solved));
    const solved = shuffle(pool.filter((q) => prog.questions[q.id]?.solved));
    save({ ids: [...unsolved, ...solved].slice(0, SIZE).map((q) => q.id), index: 0 });
  };

  if (session) {
    const q = content.question(session.ids[session.index]);
    if (!q) {
      save(null);
      return null;
    }
    const go = (index: number) => save({ ...session, index });
    const topicMeta = content.topics.find((m) => m.id === q.topic);
    const nav = (
      <nav className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
        <div><button type="button" disabled={session.index === 0} onClick={() => go(session.index - 1)} className="btn-ghost">{t('review.previous')}</button></div>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">{t('review.counter', { i: session.index + 1, n: session.ids.length })}</span>
        <div className="text-right">
          {session.index + 1 < session.ids.length
            ? <button type="button" onClick={() => go(session.index + 1)} className="btn-secondary">{t('review.next')}</button>
            : <button type="button" onClick={() => save(null)} className="btn-primary">{t('review.finish')}</button>}
        </div>
      </nav>
    );
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="eyebrow">{t('review.title')}</span>
          {topicMeta && <span className="text-zinc-500">{t('runner.topicLabel', { n: String(topicMeta.id).padStart(2, '0'), title: topicMeta.title })}</span>}
          <span className="ml-auto flex items-center gap-3">
            <span className="flex gap-1" aria-hidden>
              {session.ids.map((id, k) => <span key={id} className={`h-1.5 w-4 rounded-full ${k === session.index ? 'bg-sky-500' : k < session.index ? 'bg-sky-500/40' : 'bg-zinc-200 dark:bg-zinc-800'}`} />)}
            </span>
            <button type="button" onClick={() => save(null)} className="btn-ghost text-xs">{t('review.end')}</button>
          </span>
        </div>
        <QuestionRunner key={q.id} question={q} nav={nav} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader eyebrow={t('review.eyebrow')} title={t('review.title')} intro={t('review.intro', { n: SIZE })} />
      {topics.length === 0 ? (
        <EmptyState
          icon="↻"
          title={t('review.noneTitle')}
          text={t('review.noneText')}
          action={<Link to="/" className="btn-primary px-4 py-2">{t('review.pickTopic')} <span aria-hidden>→</span></Link>}
        />
      ) : (
        <section className="panel space-y-4 p-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('review.drawing')}</p>
          <ul className="flex flex-wrap gap-2">
            {topics.map((x) => {
              const m = content.topics.find((mm) => mm.id === x.id);
              return <li key={x.id} className="chip !font-sans !text-xs">{String(x.id).padStart(2, '0')} · {m?.title}</li>;
            })}
          </ul>
          <button type="button" onClick={start} className="btn-primary px-4 py-2">{t('review.start')} <span aria-hidden>→</span></button>
        </section>
      )}
    </div>
  );
}
