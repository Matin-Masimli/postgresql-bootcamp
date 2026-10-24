import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ALL_QUESTIONS } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import { DifficultyBadge } from '../components/Badges.tsx';
import PageHeader from '../components/PageHeader.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Rich from '../i18n/Rich.tsx';
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
  const t = useT();
  const content = useContent();
  const getQuestion = content.question;
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
      <div className="max-w-3xl space-y-8">
        <PageHeader eyebrow={t('exam.eyebrow')} title={t('exam.title')} intro={t('exam.intro')} />
        <section className="panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t('exam.setup')}</h2>
            <p className="text-sm text-zinc-500">{t('exam.available', { n: available, hard })}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-end">
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">{t('exam.questions')}</span>
              <input type="number" min={1} max={Math.max(1, available)} value={Math.min(count, available)} onChange={(e) => setCount(Number(e.target.value))} className="field w-full px-3 py-2 font-mono sm:w-28" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">{t('exam.minutes')}</span>
              <input type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="field w-full px-3 py-2 font-mono sm:w-28" />
            </label>
            <div className="sm:text-right">
              <button type="button" disabled={available === 0} onClick={() => save({ ids: pickQuestions(Math.min(count, available)), index: 0, startedAt: Date.now(), minutes, answers: {} })} className="btn-primary w-full px-5 py-2.5 sm:w-auto">
                {t('exam.start')} <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </section>
        {prog.exams.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold">{t('exam.previous')}</h2>
            <ul className="panel divide-y divide-zinc-100 text-sm dark:divide-zinc-800/70">
              {[...prog.exams].reverse().map((x) => {
                const n = Object.keys(x.results).length;
                const ok = Object.values(x.results).filter(Boolean).length;
                return <li key={x.at} className="px-4 py-2.5"><Rich text={t('exam.previousItem', { date: new Date(x.at).toLocaleString(t.locale === 'az' ? 'az-Latn-AZ' : 'en-US'), ok, n, pct: Math.round((ok / n) * 100), min: Math.round(x.durationSec / 60) })} /></li>;
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
    const pct = Math.round((ok / exam.ids.length) * 100);
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader eyebrow={t('exam.title')} title={t('exam.result', { ok, n: exam.ids.length, pct })}>
          <div className="h-2 max-w-md overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </PageHeader>
        <ul className="panel divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {exam.ids.map((id, i) => {
            const q = getQuestion(id)!;
            const slug = TOPICS.find((t) => t.id === q.topic)!.slug;
            const passed = exam.answers[id];
            return (
              <li key={id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${passed ? 'bg-emerald-500' : 'bg-red-500'}`} aria-label={passed ? t('status.solved') : t('status.failed')}>{passed ? '✓' : '✗'}</span>
                <span className="min-w-0 flex-1"><span className="mr-1 font-mono text-xs text-zinc-400">{i + 1}.</span>{q.title}</span>
                <DifficultyBadge d={q.difficulty} />
                <Link to={`/topic/${slug}/q/${id}`} className="font-medium text-sky-600 hover:underline dark:text-sky-400">{t('exam.reviewLink')} →</Link>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => save(null)} className="btn-primary px-4 py-2">{t('exam.new')}</button>
      </div>
    );
  }

  // ── running
  const q = getQuestion(exam.ids[exam.index])!;
  const answered = Object.keys(exam.answers).length;
  const nav = (
    <nav className="flex flex-wrap items-center gap-1 border-t border-zinc-200 pt-4 dark:border-zinc-800" aria-label={t('exam.navAria')}>
      {exam.ids.map((id, i) => (
        <button key={id} type="button" onClick={() => save({ ...exam, index: i })} aria-current={i === exam.index}
          className={`size-8 rounded-lg font-mono text-xs transition ${i === exam.index ? 'bg-sky-600 font-semibold text-white shadow-sm shadow-sky-600/30' : id in exam.answers ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'border border-zinc-300 text-zinc-500 hover:border-sky-400 dark:border-zinc-700'}`}>
          {i + 1}
        </button>
      ))}
    </nav>
  );
  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-20 -mx-4 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 py-2.5 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <span className={`rounded-lg px-2 py-0.5 font-mono text-base font-semibold tabular-nums ${remaining < 300 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-zinc-900/5 dark:bg-white/5'}`}>⏱ {fmtClock(remaining)}</span>
        <span className="text-zinc-500">{t('exam.status', { i: exam.index + 1, n: exam.ids.length, answered })}</span>
        <button type="button" onClick={() => { if (window.confirm(t('exam.confirmFinish'))) finish(exam); }} className="btn-secondary ml-auto">{t('exam.finish')}</button>
      </div>
      <QuestionRunner key={q.id} question={q} mode="exam" examAnswered={q.id in exam.answers} onExamSubmit={(pass) => save({ ...exam, answers: { ...exam.answers, [q.id]: pass } })} nav={nav} />
    </div>
  );
}
