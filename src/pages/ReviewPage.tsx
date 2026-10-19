import { useState } from 'react';
import { Link } from 'react-router';
import type { Topic } from '../../content/types.ts';
import QuestionRunner from '../components/QuestionRunner.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Rich from '../i18n/Rich.tsx';
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
    const nav = (
      <nav className="flex items-center justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <button type="button" disabled={session.index === 0} onClick={() => go(session.index - 1)} className="hover:underline disabled:opacity-40">{t('review.previous')}</button>
        <span className="text-zinc-500">{t('review.counter', { i: session.index + 1, n: session.ids.length })}</span>
        {session.index + 1 < session.ids.length
          ? <button type="button" onClick={() => go(session.index + 1)} className="hover:underline">{t('review.next')}</button>
          : <button type="button" onClick={() => save(null)} className="hover:underline">{t('review.finish')}</button>}
      </nav>
    );
    return (
      <div className="space-y-2">
        <p className="flex items-center text-sm text-zinc-500">
          {t('review.title')}
          <button type="button" onClick={() => save(null)} className="ml-auto text-xs hover:underline">{t('review.end')}</button>
        </p>
        <QuestionRunner key={q.id} question={q} nav={nav} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t('review.title')}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t('review.intro', { n: SIZE })}</p>
      {topics.length === 0 ? (
        <p className="rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Rich text={t('review.none')} tags={{ a: (c) => <Link to="/" className="text-sky-700 underline dark:text-sky-400">{c}</Link> }} />
        </p>
      ) : (
        <>
          <p className="text-sm">{t('review.drawing', { list: topics.map((x) => content.topics.find((m) => m.id === x.id)?.title).join(', ') })}</p>
          <button type="button" onClick={start} className="btn-primary px-4 py-2">{t('review.start')}</button>
        </>
      )}
    </div>
  );
}
