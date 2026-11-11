import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { isQueryQuestion, type ConceptQuestion, type PredictQuestion, type Question, type QueryQuestion } from '../../content/types.ts';
import { engine, runError } from '../db/client.ts';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Rich from '../i18n/Rich.tsx';
import type { Feedback, RunOutput } from '../engine/types.ts';
import { visualize, type Visualization } from '../lib/visualize.ts';
import { progress, statusOf, useProgress } from '../progress/store.ts';
import { DifficultyBadge, StatusIcon } from './Badges.tsx';
import FeedbackView from './FeedbackView.tsx';
import Markdown from './Markdown.tsx';
import QueryVisualizer from './QueryVisualizer.tsx';
import ResultTable from './ResultTable.tsx';
import RunResults from './RunResults.tsx';
import SchemaQuickRef from './SchemaQuickRef.tsx';
import SqlCode from './SqlCode.tsx';
import SqlEditor from './SqlEditor.tsx';

export type RunnerMode = 'practice' | 'exam';
interface Props {
  question: Question;
  mode?: RunnerMode;
  /** Exam mode: called with the grading result of each submission. */
  onExamSubmit?: (pass: boolean) => void;
  examAnswered?: boolean;
  nav?: ReactNode;
}

const btnPrimary = 'btn-primary';
const btnSecondary = 'btn-secondary';
const btnGhost = 'btn-ghost';

export default function QuestionRunner({ question, mode = 'practice', onExamSubmit, examAnswered, nav }: Props) {
  const t = useT();
  const TOPICS = useContent().topics;
  const p = useProgress().questions[question.id];
  useEffect(() => {
    // Warm up: main first, then the hidden dataset so the first Check is fast.
    void engine.ensure('main').then(() => engine.ensure('hidden')).catch(() => undefined);
  }, []);

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-500">
          {mode === 'practice' && <StatusIcon s={statusOf(p)} />}
          <span className="chip">{question.id}</span>
          <DifficultyBadge d={question.difficulty} />
          <span>{t(`type.${question.type}`)}</span>
          {question.relatedTopics.length > 0 && (
            <span>{t('runner.alsoUses', { list: question.relatedTopics.map((id) => TOPICS.find((x) => x.id === id)?.title ?? id).join(', ') })}</span>
          )}
          {question.previewTopics?.length ? (
            <span title={t('runner.previewsTitle')}>
              {t('runner.previews', { list: question.previewTopics.map((id) => TOPICS.find((x) => x.id === id)?.title ?? id).join(', ') })}
            </span>
          ) : null}
        </div>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-balance sm:text-4xl">{question.title}</h1>
      </header>
      {isQueryQuestion(question) ? (
        <QueryRunner key={question.id} q={question} mode={mode} onExamSubmit={onExamSubmit} examAnswered={examAnswered} />
      ) : (
        <ChoiceRunner key={question.id} q={question} mode={mode} onExamSubmit={onExamSubmit} examAnswered={examAnswered} />
      )}
      {nav}
    </article>
  );
}

// ───────────────────────── write / fix a query ─────────────────────────

function QueryRunner({ q, mode, onExamSubmit, examAnswered }: { q: QueryQuestion; mode: RunnerMode; onExamSubmit?: (pass: boolean) => void; examAnswered?: boolean }) {
  const t = useT();
  const saved = progress.get().questions[q.id];
  const initial = q.starterSql ?? `${t('runner.placeholder')}\n`;
  const [sql, setSql] = useState(mode === 'practice' && saved?.draft ? saved.draft : initial);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<'run' | 'check' | 'visualize' | null>(null);
  const [viz, setViz] = useState<Visualization | null>(null);
  const [view, setView] = useState<'result' | 'plan'>('result');
  const [hints, setHints] = useState(mode === 'practice' ? saved?.hintsUsed ?? 0 : 0);
  const [showSolution, setShowSolution] = useState(false);
  const [tab, setTab] = useState<'task' | 'sql' | 'result'>('task');
  const [schemaOpen, setSchemaOpen] = useState(false);
  const editorApi = useRef<{ insert: (t: string) => void } | null>(null);
  const attempted = (progress.get().questions[q.id]?.attempts ?? 0) > 0 || feedback !== null;

  // Persist the draft (debounced) so work survives reloads and moves with export/import.
  useEffect(() => {
    if (mode !== 'practice') return;
    const t = setTimeout(() => progress.saveDraft(q.id, sql === initial ? '' : sql), 500);
    return () => clearTimeout(t);
  }, [sql, q.id, mode, initial]);

  const run = async () => {
    if (busy) return;
    setBusy('run');
    setFeedback(null);
    try {
      setOutput(await engine.run(sql));
    } catch (e) {
      setOutput({ statements: [], totalMs: 0, error: runError(e) });
    } finally {
      setBusy(null);
      setView('result');
      setTab('result');
    }
  };

  const explain = async () => {
    if (busy) return;
    setBusy('visualize');
    try {
      setViz(await visualize(sql, 'main'));
    } finally {
      setBusy(null);
      setView('plan');
      setTab('result');
    }
  };

  const check = async () => {
    if (busy) return;
    setBusy('check');
    try {
      const r = await engine.grade({ id: q.id, referenceSolution: q.referenceSolution, verificationQuery: q.verificationQuery, checkConfig: q.checkConfig }, sql);
      setOutput(r.output);
      setFeedback(r.feedback);
      if (mode === 'practice') progress.recordCheck(q.id, r.feedback.pass);
      else onExamSubmit?.(r.feedback.pass);
    } catch (e) {
      setFeedback({ pass: false, summary: '', kind: 'error', error: runError(e) });
    } finally {
      setBusy(null);
      setView('result');
      setTab('result');
    }
  };

  const errorForEditor = feedback?.error && feedback.dataset === 'main' ? feedback.error : output?.error;
  const editorError = errorForEditor?.offset !== undefined ? { offset: errorForEditor.offset, message: errorForEditor.message } : null;

  const taskPanel = (
    <div className="space-y-4">
      <div className="panel p-5 sm:p-6"><Markdown>{q.prompt}</Markdown></div>
      {mode === 'practice' && (
        <>
          {hints > 0 && (
            <ol className="space-y-2">
              {q.hints.slice(0, hints).map((h, i) => (
                <li key={i} className="animate-materialize rounded-2xl bg-sky-600/[0.07] px-4 py-3 text-[15px] dark:bg-sky-400/[0.1]">
                  <span className="mb-1 block text-[13px] font-semibold text-sky-700 dark:text-sky-400">{t('runner.hint', { n: i + 1 })}</span>
                  <Markdown>{h}</Markdown>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            {hints < q.hints.length && (
              <button type="button" className={btnSecondary} onClick={() => { setHints(hints + 1); progress.recordHint(q.id, hints + 1); }}>
                {t('runner.hintButton', { n: hints + 1, total: q.hints.length })}
              </button>
            )}
            {!showSolution && (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  if (attempted || window.confirm(t('runner.confirmGiveUp'))) {
                    setShowSolution(true);
                    progress.recordReveal(q.id);
                  }
                }}
              >
                {attempted ? t('runner.showSolution') : t('runner.giveUp')}
              </button>
            )}
          </div>
          {showSolution && <SolutionPanel q={q} onLoad={(s) => { setSql(s); setTab('sql'); }} />}
        </>
      )}
    </div>
  );

  const sqlPanel = (
    <div className="space-y-2">
      <SqlEditor value={sql} onChange={setSql} onRun={run} error={editorError} onReady={(api) => (editorApi.current = api)} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnSecondary} onClick={run} disabled={!!busy} aria-label={t('runner.run')} title={t('runner.runTitle')}>
          {busy === 'run' ? t('runner.running') : t('runner.run')}
        </button>
        <button type="button" className="btn-visualize" onClick={explain} disabled={!!busy} title={t('runner.visualizeTitle')}>
          {busy === 'visualize' ? t('runner.analyzing') : t('runner.visualize')}
        </button>
        <button type="button" className={btnPrimary} onClick={check} disabled={!!busy}>
          {busy === 'check' ? t('runner.checking') : mode === 'exam' ? t('runner.submit') : t('runner.check')}
        </button>
        <button type="button" className={btnGhost} onClick={() => { if (sql === initial || window.confirm(t('runner.confirmReset'))) { setSql(initial); setOutput(null); setFeedback(null); setViz(null); } }}>
          {t('runner.reset')}
        </button>
        <span className="ml-auto hidden text-[12px] text-zinc-500 xl:inline"><span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> {t('runner.kbdRuns')}</span>
        <button type="button" className={btnGhost} onClick={() => setSchemaOpen(!schemaOpen)} aria-expanded={schemaOpen}>
          {schemaOpen ? t('runner.hideSchema') : t('runner.schema')}
        </button>
      </div>
      {schemaOpen && <SchemaQuickRef onInsert={(t) => editorApi.current?.insert(t)} />}
    </div>
  );

  const resultPanel = (
    <div className="space-y-3">
      {viz && (
        <div className="segmented" role="tablist" aria-label={t('runner.view.aria')}>
          {(['result', 'plan'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className="segment px-4">
              {v === 'result' ? t('runner.view.result') : t('runner.view.plan')}
            </button>
          ))}
        </div>
      )}
      {busy && <p className="flex items-center gap-2.5 text-[14px] text-zinc-500"><span className="size-4 animate-spin rounded-full border-2 border-sky-600/25 border-t-sky-600 dark:border-sky-400/25 dark:border-t-sky-400" />{busy === 'check' ? t('runner.busy.check') : busy === 'visualize' ? t('runner.busy.visualize') : t('runner.busy.run')}</p>}
      {view === 'plan' && viz && !busy && <QueryVisualizer viz={viz} />}
      {(view === 'result' || !viz) && <>
      {feedback && mode === 'practice' && <FeedbackView feedback={feedback} sql={sql} />}
      {feedback && mode === 'exam' && (
        feedback.kind === 'error' && feedback.error
          ? <FeedbackView feedback={feedback} summary={t('runner.exam.error')} sql={sql} />
          : <p className="rounded-2xl bg-sky-600/[0.07] px-4 py-3 text-[15px] dark:bg-sky-400/[0.1]">{t('runner.exam.submitted')}</p>
      )}
      {mode === 'exam' && !feedback && examAnswered && <p className="text-sm text-zinc-500">{t('runner.exam.already')}</p>}
      {output && <RunResults output={output} sql={sql} />}
      {!output && !feedback && !busy && (
        <div className="well px-6 py-10 text-center text-[15px] leading-relaxed text-zinc-500">
          <Rich
            text={t('runner.emptyResult')}
            tags={{
              b: (c) => <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{c}</strong>,
              v: (c) => <strong className="font-semibold text-violet-700 dark:text-[#d99cf5]">{c}</strong>,
              c: (c) => <strong className="font-semibold text-sky-700 dark:text-sky-400">{c}</strong>,
            }}
          />
        </div>
      )}
      </>}
    </div>
  );

  return (
    <>
      <div className={`${mode === 'practice' ? 'material sticky top-14 z-20' : ''} -mx-4 px-4 py-2 sm:-mx-6 sm:px-6 lg:hidden`}>
        <div className="segmented flex w-full" role="tablist">
        {(['task', 'sql', 'result'] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className="segment flex-1 py-1.5">
            {x === 'task' ? t('runner.tab.task') : x === 'sql' ? t('runner.tab.sql') : feedback ? (feedback.pass ? t('runner.tab.resultOk') : t('runner.tab.resultBad')) : t('runner.tab.result')}
          </button>
        ))}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* On wide screens the task stays in view while results scroll; it scrolls on its own if taller than the screen. */}
        <section className={`${tab === 'task' ? '' : 'hidden lg:block'} lg:sticky lg:top-20 lg:-m-1.5 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:p-1.5 lg:[scrollbar-width:thin]`}>{taskPanel}</section>
        <div className="space-y-4">
          <section className={tab === 'sql' ? '' : 'hidden lg:block'}>{sqlPanel}</section>
          <section className={tab === 'result' ? '' : 'hidden lg:block'}>{resultPanel}</section>
        </div>
      </div>
    </>
  );
}

function SolutionPanel({ q, onLoad }: { q: QueryQuestion; onLoad: (sql: string) => void }) {
  const t = useT();
  return (
    <section className="panel animate-materialize space-y-4 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('runner.solution')}</h2>
        <button type="button" onClick={() => onLoad(q.referenceSolution)} className="link ml-auto text-[14px]">
          {t('runner.loadIntoEditor')}
        </button>
      </div>
      <SqlCode code={q.referenceSolution} />
      <Markdown>{q.explanation}</Markdown>
      {q.alternativeSolutions.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[15px] font-medium text-sky-700 dark:text-sky-400">{t('runner.alternatives', { n: q.alternativeSolutions.length })}</summary>
          <div className="mt-2 space-y-2">{q.alternativeSolutions.map((s, i) => <SqlCode key={i} code={s} />)}</div>
        </details>
      )}
      <div>
        <h3 className="text-[13px] font-semibold text-zinc-500">{t('common.commonMistakes')}</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px] marker:text-zinc-400">{q.commonMistakes.map((m, i) => <li key={i}><Markdown>{m}</Markdown></li>)}</ul>
      </div>
    </section>
  );
}

// ───────────────────────── multiple choice (predict / concept) ─────────────────────────

function ChoiceRunner({ q, mode, onExamSubmit, examAnswered }: { q: PredictQuestion | ConceptQuestion; mode: RunnerMode; onExamSubmit?: (pass: boolean) => void; examAnswered?: boolean }) {
  const t = useT();
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const correct = submitted !== null && submitted === q.correctOption;
  const reveal = mode === 'practice' && submitted !== null;

  const submit = () => {
    if (choice === null) return;
    setSubmitted(choice);
    if (mode === 'practice') progress.recordCheck(q.id, choice === q.correctOption);
    else onExamSubmit?.(choice === q.correctOption);
  };

  // Short text answers sit in two columns; tables and long answers take the full width.
  const compact = q.type === 'concept-mc' && q.options.every((o) => 'text' in o && o.text.length <= 48);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="text-[17px]"><Markdown>{q.prompt}</Markdown></div>
      {q.type === 'predict-output' && <SqlCode code={q.referenceSolution} />}
      <fieldset className={`grid gap-2.5 ${compact ? 'sm:grid-cols-2' : ''}`}>
        <legend className="sr-only">{t('runner.options')}</legend>
        {q.options.map((o, i) => {
          const state = reveal ? (i === q.correctOption ? 'correct' : i === submitted ? 'wrong' : '') : '';
          const letter = String.fromCharCode(65 + i);
          const selected = choice === i;
          return (
            <label
              key={i}
              className={`group flex cursor-pointer items-start gap-3.5 rounded-2xl p-4 transition-[box-shadow,background-color,transform] duration-200 active:scale-[0.99] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sky-600/30 ${reveal ? 'cursor-default active:scale-100' : ''} ${state === 'correct' ? 'bg-emerald-500/[0.08] ring-2 ring-emerald-500' : state === 'wrong' ? 'bg-red-500/[0.06] ring-2 ring-red-500' : selected ? 'bg-sky-600/[0.05] ring-2 ring-sky-600 dark:bg-sky-400/[0.08] dark:ring-sky-500' : 'bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.08] hover:ring-black/[0.16] dark:bg-zinc-900 dark:ring-white/[0.08] dark:hover:ring-white/[0.16]'}`}
            >
              <input type="radio" name={`opt-${q.id}`} aria-label={t('runner.optionAria', { letter })} checked={selected} onChange={() => setChoice(i)} className="sr-only" disabled={reveal} />
              <span
                aria-hidden
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold transition-colors ${state === 'correct' ? 'bg-emerald-500 text-white' : state === 'wrong' ? 'bg-red-500 text-white' : selected ? 'bg-sky-600 text-white dark:bg-sky-500' : 'bg-black/[0.06] text-zinc-600 dark:bg-white/[0.1] dark:text-zinc-300'}`}
              >
                {state === 'correct' ? '✓' : state === 'wrong' ? '✗' : letter}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                {'text' in o ? <Markdown>{o.text}</Markdown> : <ResultTable columns={o.table.columns} rows={o.table.rows} numbered={false} maxHeight="220px" fixed />}
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        {!reveal && (
          <button type="button" className={btnPrimary} onClick={submit} disabled={choice === null}>
            {mode === 'exam' ? t('runner.submit') : t('runner.checkAnswer')}
          </button>
        )}
        {mode === 'exam' && (submitted !== null || examAnswered) && <span className="text-sm text-zinc-500">{t('runner.recorded')}</span>}
        {reveal && (
          <button type="button" className={btnSecondary} onClick={() => { setSubmitted(null); setChoice(null); setOutput(null); }}>
            {t('runner.tryAgain')}
          </button>
        )}
        {reveal && q.type === 'predict-output' && (
          <button type="button" className={btnSecondary} onClick={async () => setOutput(await engine.run(q.referenceSolution).catch((e: unknown) => ({ statements: [], totalMs: 0, error: runError(e) })))}>
            {t('runner.runQuery')}
          </button>
        )}
      </div>
      {reveal && (
        <div className="space-y-3">
          <p className={`animate-materialize rounded-2xl px-4 py-3.5 text-[15px] font-semibold ${correct ? 'bg-emerald-500/[0.1] text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100' : 'bg-amber-500/[0.1] text-amber-950 dark:bg-amber-500/15 dark:text-amber-50'}`}>
            {correct ? t('runner.correct') : t('runner.wrong', { letter: String.fromCharCode(65 + q.correctOption) })}
          </p>
          {output && <RunResults output={output} sql={q.type === 'predict-output' ? q.referenceSolution : ''} />}
          <Markdown>{q.explanation}</Markdown>
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-500">{t('common.commonMistakes')}</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px] marker:text-zinc-400">{q.commonMistakes.map((m, i) => <li key={i}><Markdown>{m}</Markdown></li>)}</ul>
          </div>
        </div>
      )}
      {mode === 'practice' && !reveal && q.hints.length > 0 && <ChoiceHints q={q} />}
      {mode === 'practice' && (
        <p className="text-[13px] text-zinc-500">
          <Rich text={t('runner.experiment')} tags={{ a: (c) => <Link to="/playground" className="link">{c}</Link> }} />
        </p>
      )}
    </div>
  );
}

function ChoiceHints({ q }: { q: PredictQuestion | ConceptQuestion }) {
  const t = useT();
  const [n, setN] = useState(0);
  return (
    <div className="space-y-2">
      {q.hints.slice(0, n).map((h, i) => (
        <div key={i} className="animate-materialize rounded-2xl bg-sky-600/[0.07] px-4 py-3 text-[15px] dark:bg-sky-400/[0.1]">
          <span className="mb-1 block text-[13px] font-semibold text-sky-700 dark:text-sky-400">{t('runner.hint', { n: i + 1 })}</span>
          <Markdown>{h}</Markdown>
        </div>
      ))}
      {n < q.hints.length && (
        <button type="button" className={btnSecondary} onClick={() => { setN(n + 1); progress.recordHint(q.id, n + 1); }}>
          {t('runner.hintButton', { n: n + 1, total: q.hints.length })}
        </button>
      )}
    </div>
  );
}
