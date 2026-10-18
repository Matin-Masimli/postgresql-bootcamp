import { useState } from 'react';
import { Link } from 'react-router';
import { getQuestion, TOPIC_CONTENT } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import QuestionRunner from '../components/QuestionRunner.tsx';
import { readSession, shuffle, writeSession } from '../lib/session.ts';
import { useProgress, type ProgressData } from '../progress/store.ts';

const KEY = 'pgb.review';
const SIZE = 10;
interface ReviewSession { ids: string[]; index: number }

/** Topics count as completed for review once at least half of their questions are solved. */
function completedTopics(p: ProgressData) {
  return TOPIC_CONTENT.filter((t) => t.questions.length > 0 && t.questions.filter((q) => p.questions[q.id]?.solved).length * 2 >= t.questions.length);
}

export default function ReviewPage() {
  const prog = useProgress();
  const [session, setSession] = useState<ReviewSession | null>(() => readSession<ReviewSession>(KEY));
  const save = (s: ReviewSession | null) => {
    writeSession(KEY, s);
    setSession(s);
  };
  const topics = completedTopics(prog);

  const start = () => {
    const pool = topics.flatMap((t) => t.questions);
    // Prefer questions not solved yet or not seen recently, then fill with the rest.
    const unsolved = shuffle(pool.filter((q) => !prog.questions[q.id]?.solved));
    const solved = shuffle(pool.filter((q) => prog.questions[q.id]?.solved));
    save({ ids: [...unsolved, ...solved].slice(0, SIZE).map((q) => q.id), index: 0 });
  };

  if (session) {
    const q = getQuestion(session.ids[session.index]);
    if (!q) {
      save(null);
      return null;
    }
    const go = (index: number) => save({ ...session, index });
    const nav = (
      <nav className="flex items-center justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <button type="button" disabled={session.index === 0} onClick={() => go(session.index - 1)} className="hover:underline disabled:opacity-40">← Previous</button>
        <span className="text-zinc-500">Review {session.index + 1} / {session.ids.length}</span>
        {session.index + 1 < session.ids.length
          ? <button type="button" onClick={() => go(session.index + 1)} className="hover:underline">Next →</button>
          : <button type="button" onClick={() => save(null)} className="hover:underline">Finish ✓</button>}
      </nav>
    );
    return (
      <div className="space-y-2">
        <p className="flex items-center text-sm text-zinc-500">
          Mixed review
          <button type="button" onClick={() => save(null)} className="ml-auto text-xs hover:underline">End session</button>
        </p>
        <QuestionRunner key={q.id} question={q} nav={nav} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mixed review</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Up to {SIZE} random questions from the topics you've completed (at least half of their questions solved). Questions you haven't solved yet come first.
      </p>
      {topics.length === 0 ? (
        <p className="rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          No completed topics yet. Solve at least half of a topic's questions and it will show up here. <Link to="/" className="text-sky-700 underline dark:text-sky-400">Pick a topic</Link>.
        </p>
      ) : (
        <>
          <p className="text-sm">Drawing from: {topics.map((t) => TOPICS.find((x) => x.id === t.id)?.title).join(', ')}.</p>
          <button type="button" onClick={start} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">Start review</button>
        </>
      )}
    </div>
  );
}
