import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { isQueryQuestion, type ConceptQuestion, type PredictQuestion, type Question, type QueryQuestion } from '../../content/types.ts';
import { TOPICS } from '../../content/topicList.ts';
import { engine, runError } from '../db/client.ts';
import type { Feedback, RunOutput } from '../engine/types.ts';
import { progress, statusOf, useProgress } from '../progress/store.ts';
import { DifficultyBadge, StatusIcon, TYPE_LABEL } from './Badges.tsx';
import FeedbackView from './FeedbackView.tsx';
import Markdown from './Markdown.tsx';
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

const btn = 'rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50';
const btnPrimary = `${btn} bg-sky-600 text-white hover:bg-sky-700`;
const btnSecondary = `${btn} border border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800`;

export default function QuestionRunner({ question, mode = 'practice', onExamSubmit, examAnswered, nav }: Props) {
  const p = useProgress().questions[question.id];
  const topicTitle = TOPICS.find((t) => t.id === question.topic)?.title;
  useEffect(() => {
    // Warm up: main first, then the hidden dataset so the first Check is fast.
    void engine.ensure('main').then(() => engine.ensure('hidden')).catch(() => undefined);
  }, []);

  return (
    <article className="space-y-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {mode === 'practice' && <StatusIcon s={statusOf(p)} />}
          <span className="font-mono">{question.id}</span>
          <DifficultyBadge d={question.difficulty} />
          <span>{TYPE_LABEL[question.type]}</span>
          {question.relatedTopics.length > 0 && (
            <span>· also uses {question.relatedTopics.map((t) => TOPICS.find((x) => x.id === t)?.title ?? t).join(', ')}</span>
          )}
          {question.previewTopics?.length ? (
            <span title="This question needs a basic pattern from a later topic. The topic explanation shows it.">
              · previews {question.previewTopics.map((t) => TOPICS.find((x) => x.id === t)?.title ?? t).join(', ')}
            </span>
          ) : null}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{question.title}</h1>
        {mode === 'practice' && topicTitle && <p className="text-xs text-zinc-500">Topic {question.topic}: {topicTitle}</p>}
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
  const saved = progress.get().questions[q.id];
  const initial = q.starterSql ?? '-- Write your SQL here, then press Run (Ctrl/Cmd + Enter) or Check\n';
  const [sql, setSql] = useState(mode === 'practice' && saved?.draft ? saved.draft : initial);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<'run' | 'check' | null>(null);
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
      setFeedback({ pass: false, summary: 'The check could not finish.', kind: 'error', error: runError(e) });
    } finally {
      setBusy(null);
      setTab('result');
    }
  };

  const errorForEditor = feedback?.error && feedback.dataset === 'main' ? feedback.error : output?.error;
  const editorError = errorForEditor?.offset !== undefined ? { offset: errorForEditor.offset, message: errorForEditor.message } : null;

  const taskPanel = (
    <div className="space-y-4">
      <Markdown>{q.prompt}</Markdown>
      {mode === 'practice' && (
        <>
          {hints > 0 && (
            <ol className="space-y-2">
              {q.hints.slice(0, hints).map((h, i) => (
                <li key={i} className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/40">
                  <span className="mr-1 font-medium">Hint {i + 1}:</span>
                  <Markdown>{h}</Markdown>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            {hints < q.hints.length && (
              <button type="button" className={btnSecondary} onClick={() => { setHints(hints + 1); progress.recordHint(q.id, hints + 1); }}>
                💡 Hint {hints + 1}/{q.hints.length}
              </button>
            )}
            {!showSolution && (
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  if (attempted || window.confirm('Give up and show the solution? Try a Check first, because the feedback often shows what is missing.')) {
                    setShowSolution(true);
                    progress.recordReveal(q.id);
                  }
                }}
              >
                {attempted ? 'Show solution' : 'Give up · show solution'}
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
        <button type="button" className={btnSecondary} onClick={run} disabled={!!busy} aria-label="Run" title="Run (Ctrl/Cmd + Enter)">
          {busy === 'run' ? 'Running…' : '▶ Run'}
        </button>
        <button type="button" className={btnPrimary} onClick={check} disabled={!!busy}>
          {busy === 'check' ? 'Checking…' : mode === 'exam' ? 'Submit answer' : '✓ Check'}
        </button>
        <button type="button" className={`${btn} text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200`} onClick={() => { if (sql === initial || window.confirm('Reset the editor? Your current SQL will be lost.')) { setSql(initial); setOutput(null); setFeedback(null); } }}>
          Reset
        </button>
        <button type="button" className={`${btn} ml-auto text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200`} onClick={() => setSchemaOpen(!schemaOpen)} aria-expanded={schemaOpen}>
          {schemaOpen ? 'Hide schema' : 'Schema'}
        </button>
      </div>
      {schemaOpen && <SchemaQuickRef onInsert={(t) => editorApi.current?.insert(t)} />}
    </div>
  );

  const resultPanel = (
    <div className="space-y-3">
      {busy && <p className="text-sm text-zinc-500">{busy === 'check' ? 'Checking against the reference on the practice data and the hidden data…' : 'Running…'}</p>}
      {feedback && mode === 'practice' && <FeedbackView feedback={feedback} sql={sql} />}
      {feedback && mode === 'exam' && (
        feedback.kind === 'error' && feedback.error
          ? <FeedbackView feedback={{ ...feedback, summary: 'Your SQL failed with an error. Fix it and submit again.' }} sql={sql} />
          : <p className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">Answer submitted. You can still change it and submit again until the exam ends.</p>
      )}
      {mode === 'exam' && !feedback && examAnswered && <p className="text-sm text-zinc-500">You've already submitted an answer to this question.</p>}
      {output && <RunResults output={output} sql={sql} />}
      {!output && !feedback && !busy && <p className="text-sm text-zinc-500">Results appear here. <strong>Run</strong> executes your SQL. <strong>Check</strong> grades it.</p>}
    </div>
  );

  return (
    <>
      <div className="flex gap-1 border-b border-zinc-200 lg:hidden dark:border-zinc-800" role="tablist">
        {(['task', 'sql', 'result'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-sky-600 font-medium' : 'border-transparent text-zinc-500'}`}>
            {t === 'task' ? 'Task' : t === 'sql' ? 'SQL' : feedback ? (feedback.pass ? 'Result ✓' : 'Result ✗') : 'Result'}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className={tab === 'task' ? '' : 'hidden lg:block'}>{taskPanel}</section>
        <div className="space-y-4">
          <section className={tab === 'sql' ? '' : 'hidden lg:block'}>{sqlPanel}</section>
          <section className={tab === 'result' ? '' : 'hidden lg:block'}>{resultPanel}</section>
        </div>
      </div>
    </>
  );
}

function SolutionPanel({ q, onLoad }: { q: QueryQuestion; onLoad: (sql: string) => void }) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Solution</h2>
        <button type="button" onClick={() => onLoad(q.referenceSolution)} className="ml-auto text-xs text-sky-700 hover:underline dark:text-sky-400">
          Load into editor
        </button>
      </div>
      <SqlCode code={q.referenceSolution} />
      <Markdown>{q.explanation}</Markdown>
      {q.alternativeSolutions.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Alternative approaches ({q.alternativeSolutions.length})</summary>
          <div className="mt-2 space-y-2">{q.alternativeSolutions.map((s, i) => <SqlCode key={i} code={s} />)}</div>
        </details>
      )}
      <div>
        <h3 className="text-sm font-medium">Common mistakes</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, i) => <li key={i}><Markdown>{m}</Markdown></li>)}</ul>
      </div>
    </section>
  );
}

// ───────────────────────── multiple choice (predict / concept) ─────────────────────────

function ChoiceRunner({ q, mode, onExamSubmit, examAnswered }: { q: PredictQuestion | ConceptQuestion; mode: RunnerMode; onExamSubmit?: (pass: boolean) => void; examAnswered?: boolean }) {
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

  return (
    <div className="space-y-4">
      <Markdown>{q.prompt}</Markdown>
      {q.type === 'predict-output' && <SqlCode code={q.referenceSolution} />}
      <fieldset className="space-y-2">
        <legend className="sr-only">Options</legend>
        {q.options.map((o, i) => {
          const state = reveal ? (i === q.correctOption ? 'correct' : i === submitted ? 'wrong' : '') : '';
          return (
            <label
              key={i}
              className={`flex cursor-pointer gap-3 rounded-md border p-3 ${state === 'correct' ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : state === 'wrong' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : choice === i ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30' : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}
            >
              <input type="radio" name={`opt-${q.id}`} aria-label={`Option ${String.fromCharCode(65 + i)}`} checked={choice === i} onChange={() => setChoice(i)} className="mt-1" disabled={reveal} />
              <span className="min-w-0 flex-1">
                <span className="mr-1 font-medium">{String.fromCharCode(65 + i)}.</span>
                {'text' in o ? <Markdown>{o.text}</Markdown> : <span className="mt-1 block"><ResultTable columns={o.table.columns} rows={o.table.rows} numbered={false} maxHeight="220px" /></span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        {!reveal && (
          <button type="button" className={btnPrimary} onClick={submit} disabled={choice === null}>
            {mode === 'exam' ? 'Submit answer' : 'Check answer'}
          </button>
        )}
        {mode === 'exam' && (submitted !== null || examAnswered) && <span className="text-sm text-zinc-500">Answer recorded. You can change it until the exam ends.</span>}
        {reveal && (
          <button type="button" className={btnSecondary} onClick={() => { setSubmitted(null); setChoice(null); setOutput(null); }}>
            Try again
          </button>
        )}
        {reveal && q.type === 'predict-output' && (
          <button type="button" className={btnSecondary} onClick={async () => setOutput(await engine.run(q.referenceSolution).catch((e: unknown) => ({ statements: [], totalMs: 0, error: runError(e) })))}>
            ▶ Run the query
          </button>
        )}
      </div>
      {reveal && (
        <div className="space-y-3">
          <p className={`rounded-md border px-3 py-2 text-sm font-semibold ${correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'}`}>
            {correct ? '✓ Correct!' : `✗ Not quite. The answer is ${String.fromCharCode(65 + q.correctOption)}.`}
          </p>
          {output && <RunResults output={output} sql={q.type === 'predict-output' ? q.referenceSolution : ''} />}
          <Markdown>{q.explanation}</Markdown>
          <div>
            <h3 className="text-sm font-medium">Common mistakes</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, i) => <li key={i}><Markdown>{m}</Markdown></li>)}</ul>
          </div>
        </div>
      )}
      {mode === 'practice' && !reveal && q.hints.length > 0 && <ChoiceHints q={q} />}
      {mode === 'practice' && (
        <p className="text-xs text-zinc-500">
          Want to experiment? Try queries in the <Link to="/playground" className="underline">Playground</Link>.
        </p>
      )}
    </div>
  );
}

function ChoiceHints({ q }: { q: PredictQuestion | ConceptQuestion }) {
  const [n, setN] = useState(0);
  return (
    <div className="space-y-2">
      {q.hints.slice(0, n).map((h, i) => (
        <div key={i} className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950/40">
          <span className="mr-1 font-medium">Hint {i + 1}:</span>
          <Markdown>{h}</Markdown>
        </div>
      ))}
      {n < q.hints.length && (
        <button type="button" className={btnSecondary} onClick={() => { setN(n + 1); progress.recordHint(q.id, n + 1); }}>
          💡 Hint {n + 1}/{q.hints.length}
        </button>
      )}
    </div>
  );
}
