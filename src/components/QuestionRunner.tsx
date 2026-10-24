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
    <article className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
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
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{question.title}</h1>
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
      <div className="panel p-4 sm:p-5"><Markdown>{q.prompt}</Markdown></div>
      {mode === 'practice' && (
        <>
          {hints > 0 && (
            <ol className="space-y-2">
              {q.hints.slice(0, hints).map((h, i) => (
                <li key={i} className="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm dark:border-sky-500/20 dark:bg-sky-500/5">
                  <span className="mr-1 font-medium">{t('runner.hint', { n: i + 1 })}</span>
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
        <span className="ml-auto hidden text-[11px] text-zinc-500 xl:inline"><span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> {t('runner.kbdRuns')}</span>
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
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100/70 p-0.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/70" role="tablist" aria-label={t('runner.view.aria')}>
          {(['result', 'plan'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 transition ${view === v ? 'bg-white font-medium shadow-sm dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              {v === 'result' ? t('runner.view.result') : t('runner.view.plan')}
            </button>
          ))}
        </div>
      )}
      {busy && <p className="flex items-center gap-2 text-sm text-zinc-500"><span className="size-2 animate-pulse rounded-full bg-sky-500" />{busy === 'check' ? t('runner.busy.check') : busy === 'visualize' ? t('runner.busy.visualize') : t('runner.busy.run')}</p>}
      {view === 'plan' && viz && !busy && <QueryVisualizer viz={viz} />}
      {(view === 'result' || !viz) && <>
      {feedback && mode === 'practice' && <FeedbackView feedback={feedback} sql={sql} />}
      {feedback && mode === 'exam' && (
        feedback.kind === 'error' && feedback.error
          ? <FeedbackView feedback={feedback} summary={t('runner.exam.error')} sql={sql} />
          : <p className="rounded-xl border border-sky-300/60 bg-sky-50/70 px-3 py-2 text-sm dark:border-sky-500/30 dark:bg-sky-500/10">{t('runner.exam.submitted')}</p>
      )}
      {mode === 'exam' && !feedback && examAnswered && <p className="text-sm text-zinc-500">{t('runner.exam.already')}</p>}
      {output && <RunResults output={output} sql={sql} />}
      {!output && !feedback && !busy && (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          <Rich
            text={t('runner.emptyResult')}
            tags={{
              b: (c) => <strong className="text-zinc-700 dark:text-zinc-300">{c}</strong>,
              v: (c) => <strong className="text-violet-600 dark:text-violet-300">{c}</strong>,
              c: (c) => <strong className="text-sky-600 dark:text-sky-400">{c}</strong>,
            }}
          />
        </div>
      )}
      </>}
    </div>
  );

  return (
    <>
      <div className={`${mode === 'practice' ? 'sticky top-14 z-20' : ''} -mx-4 flex gap-1 border-b border-zinc-200 bg-zinc-50/90 px-4 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/90`} role="tablist">
        {(['task', 'sql', 'result'] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === x ? 'border-sky-500 font-medium text-sky-700 dark:text-sky-300' : 'border-transparent text-zinc-500'}`}>
            {x === 'task' ? t('runner.tab.task') : x === 'sql' ? t('runner.tab.sql') : feedback ? (feedback.pass ? t('runner.tab.resultOk') : t('runner.tab.resultBad')) : t('runner.tab.result')}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* On wide screens the task stays in view while results scroll; it scrolls on its own if taller than the screen. */}
        <section className={`${tab === 'task' ? '' : 'hidden lg:block'} lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:self-start lg:overflow-y-auto lg:pb-1 lg:[scrollbar-width:thin]`}>{taskPanel}</section>
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
    <section className="panel space-y-3 p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{t('runner.solution')}</h2>
        <button type="button" onClick={() => onLoad(q.referenceSolution)} className="ml-auto text-xs text-sky-700 hover:underline dark:text-sky-400">
          {t('runner.loadIntoEditor')}
        </button>
      </div>
      <SqlCode code={q.referenceSolution} />
      <Markdown>{q.explanation}</Markdown>
      {q.alternativeSolutions.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t('runner.alternatives', { n: q.alternativeSolutions.length })}</summary>
          <div className="mt-2 space-y-2">{q.alternativeSolutions.map((s, i) => <SqlCode key={i} code={s} />)}</div>
        </details>
      )}
      <div>
        <h3 className="text-sm font-medium">{t('common.commonMistakes')}</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, i) => <li key={i}><Markdown>{m}</Markdown></li>)}</ul>
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
      <div className="text-[15px]"><Markdown>{q.prompt}</Markdown></div>
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
              className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500 ${reveal ? 'cursor-default' : ''} ${state === 'correct' ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10' : state === 'wrong' ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10' : selected ? 'border-sky-500 bg-sky-50 shadow-sm shadow-sky-500/10 dark:bg-sky-500/10' : 'border-zinc-200 bg-white/70 hover:border-sky-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-900'}`}
            >
              <input type="radio" name={`opt-${q.id}`} aria-label={t('runner.optionAria', { letter })} checked={selected} onChange={() => setChoice(i)} className="sr-only" disabled={reveal} />
              <span
                aria-hidden
                className={`grid size-7 shrink-0 place-items-center rounded-lg border font-mono text-xs font-semibold transition ${state === 'correct' ? 'border-emerald-500 bg-emerald-500 text-white' : state === 'wrong' ? 'border-red-500 bg-red-500 text-white' : selected ? 'border-sky-500 bg-sky-500 text-white' : 'border-zinc-300 text-zinc-500 group-hover:border-sky-400 group-hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400 dark:group-hover:text-sky-300'}`}
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
          <p className={`rounded-md border px-3 py-2 text-sm font-semibold ${correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'}`}>
            {correct ? t('runner.correct') : t('runner.wrong', { letter: String.fromCharCode(65 + q.correctOption) })}
          </p>
          {output && <RunResults output={output} sql={q.type === 'predict-output' ? q.referenceSolution : ''} />}
          <Markdown>{q.explanation}</Markdown>
          <div>
            <h3 className="text-sm font-medium">{t('common.commonMistakes')}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, i) => <li key={i}><Markdown>{m}</Markdown></li>)}</ul>
          </div>
        </div>
      )}
      {mode === 'practice' && !reveal && q.hints.length > 0 && <ChoiceHints q={q} />}
      {mode === 'practice' && (
        <p className="text-xs text-zinc-500">
          <Rich text={t('runner.experiment')} tags={{ a: (c) => <Link to="/playground" className="underline">{c}</Link> }} />
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
        <div key={i} className="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm dark:border-sky-500/20 dark:bg-sky-500/5">
          <span className="mr-1 font-medium">{t('runner.hint', { n: i + 1 })}</span>
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
