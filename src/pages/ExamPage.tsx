import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ALL_QUESTIONS, getQuestion } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import { DifficultyBadge } from '../components/Badges.tsx';
import QuestionRunner from '../components/QuestionRunner.tsx';
import { readSession, shuffle, writeSession } from '../lib/session.ts';
import { progress, useProgress } from '../progress/store.ts';

const KEY = 'pgb.exam';
interface ExamSession { ids: string[]; index: number; startedAt: number; minutes: number; answers: Record<string, boolean>; finishedAt?: number }

function pickQuestions(count: number): string[] {
  const tiers = [['interview', 'hard'], ['medium'], ['easy']];
  const out: string[] = [];
  for (const tier of tiers) {
    const pool = shuffle(ALL_QUESTIONS.filter((q) => tier.includes(q.difficulty) && !out.includes(q.id)));
    out.push(...pool.slice(0, count - out.length).map((q) => q.id));
    if (out.length >= count) break;
  }
  return out;
}

const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`;

export default function ExamPage() {
  const prog = useProgress();
  const [exam, setExam] = useState<ExamSession | null>(() => readSession<ExamSession>(KEY));
  const [count, setCount] = useState(20);
  const [minutes, setMinutes] = useState(45);
  const [now, setNow] = useState(Date.now());
  const save = (e: ExamSession | null) => {
    writeSession(KEY, e);
    setExam(e);
  };

  const running = exam && !exam.finishedAt;
  const remaining = exam ? Math.round((exam.startedAt + exam.minutes * 60_000 - now) / 1000) : 0;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeunload', warn);
    };
  }, [running]);

  const finish = (e: ExamSession) => {
    const done = { ...e, finishedAt: Date.now() };
    progress.recordExam({ at: new Date(done.startedAt).toISOString(), durationSec: Math.round((done.finishedAt - done.startedAt) / 1000), results: Object.fromEntries(done.ids.map((id) => [id, !!done.answers[id]])) });
    save(done);
  };

  // Time's up: grade what has been submitted (once: finishing sets finishedAt, so running turns false).
  const timeUp = !!running && remaining <= 0;
  useEffect(() => {
    if (timeUp && exam) finish(exam);
  }, [timeUp]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── setup
  if (!exam) {
    const available = ALL_QUESTIONS.length;
    const hard = ALL_QUESTIONS.filter((q) => q.difficulty === 'hard' || q.difficulty === 'interview').length;
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Final exam</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          A timed, mixed exam drawn from all topics, interview and hard questions first. No hints and no solutions during the exam.
          Answers are graded silently, and you see your score at the end. You can resubmit an answer until time runs out.
        </p>
        <p className="text-sm text-zinc-500">{available} questions available ({hard} hard or interview).</p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">Questions<br />
            <input type="number" min={1} max={Math.max(1, available)} value={Math.min(count, available)} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <label className="text-sm">Minutes<br />
            <input type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-1 w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <button type="button" disabled={available === 0} onClick={() => save({ ids: pickQuestions(Math.min(count, available)), index: 0, startedAt: Date.now(), minutes, answers: {} })} className="btn-primary px-4 py-2">
            Start exam
          </button>
        </div>
        {prog.exams.length > 0 && (
          <section>
            <h2 className="mt-6 mb-2 font-semibold">Previous exams</h2>
            <ul className="space-y-1 text-sm">
              {[...prog.exams].reverse().map((x) => {
                const n = Object.keys(x.results).length;
                const ok = Object.values(x.results).filter(Boolean).length;
                return <li key={x.at}>{new Date(x.at).toLocaleString()}: <strong>{ok}/{n}</strong> ({Math.round((ok / n) * 100)}%) in {Math.round(x.durationSec / 60)} min</li>;
              })}
            </ul>
          </section>
        )}
      </div>
    );
  }

  // ── results
  if (exam.finishedAt) {
    const ok = exam.ids.filter((id) => exam.answers[id]).length;
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Exam result: {ok}/{exam.ids.length} ({Math.round((ok / exam.ids.length) * 100)}%)</h1>
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {exam.ids.map((id, i) => {
            const q = getQuestion(id)!;
            const slug = TOPICS.find((t) => t.id === q.topic)!.slug;
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={exam.answers[id] ? 'text-emerald-600' : 'text-red-600'}>{exam.answers[id] ? '✓' : '✗'}</span>
                <span className="flex-1">{i + 1}. {q.title}</span>
                <DifficultyBadge d={q.difficulty} />
                <Link to={`/topic/${slug}/q/${id}`} className="text-sky-700 underline dark:text-sky-400">review</Link>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => save(null)} className="btn-secondary">New exam</button>
      </div>
    );
  }

  // ── running
  const q = getQuestion(exam.ids[exam.index])!;
  const answered = Object.keys(exam.answers).length;
  const nav = (
    <nav className="flex flex-wrap items-center gap-1 border-t border-zinc-200 pt-4 dark:border-zinc-800" aria-label="Exam questions">
      {exam.ids.map((id, i) => (
        <button key={id} type="button" onClick={() => save({ ...exam, index: i })} aria-current={i === exam.index}
          className={`size-8 rounded text-xs ${i === exam.index ? 'bg-sky-600 text-white' : id in exam.answers ? 'bg-zinc-300 dark:bg-zinc-700' : 'border border-zinc-300 dark:border-zinc-700'}`}>
          {i + 1}
        </button>
      ))}
    </nav>
  );
  return (
    <div className="space-y-3">
      <div className="sticky top-12 z-10 -mx-4 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span className={`font-mono text-base font-semibold ${remaining < 300 ? 'text-red-600' : ''}`}>⏱ {fmtClock(remaining)}</span>
        <span className="text-zinc-500">Question {exam.index + 1}/{exam.ids.length} · {answered} answered</span>
        <button type="button" onClick={() => { if (window.confirm('Finish the exam now?')) finish(exam); }} className="ml-auto rounded-md bg-zinc-800 px-3 py-1 text-white dark:bg-zinc-200 dark:text-zinc-900">Finish</button>
      </div>
      <QuestionRunner key={q.id} question={q} mode="exam" examAnswered={q.id in exam.answers} onExamSubmit={(pass) => save({ ...exam, answers: { ...exam.answers, [q.id]: pass } })} nav={nav} />
    </div>
  );
}
