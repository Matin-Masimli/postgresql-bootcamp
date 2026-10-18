import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import QueryVisualizer from '../components/QueryVisualizer.tsx';
import RunResults from '../components/RunResults.tsx';
import SchemaQuickRef from '../components/SchemaQuickRef.tsx';
import SqlEditor from '../components/SqlEditor.tsx';
import { engine, runError } from '../db/client.ts';
import type { RunOutput } from '../engine/types.ts';
import { visualize, type Visualization } from '../lib/visualize.ts';

const KEY = 'pgb.playground';
const START = `-- Playground: your own copy of the practice database.
-- Changes persist until you press "Reset database", and transactions (BEGIN/COMMIT) work here.
SELECT c.name AS country, count(*) AS customers
FROM customers cu
JOIN countries c USING (country_id)
GROUP BY c.name
ORDER BY customers DESC, country
LIMIT 10;
`;

export default function PlaygroundPage() {
  const [sql, setSql] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? START;
    } catch {
      return START;
    }
  });
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [busy, setBusy] = useState<'run' | 'reset' | 'visualize' | null>(null);
  const [viz, setViz] = useState<Visualization | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const editor = useRef<{ insert: (t: string) => void } | null>(null);
  const generation = useSyncExternalStore(engine.subscribe, () => engine.playgroundGeneration);
  const firstGen = useRef(generation);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, sql);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [sql]);

  const run = async () => {
    if (busy) return;
    setBusy('run');
    try {
      setViz(null);
      setOutput(await engine.run(sql, 'playground'));
    } catch (e) {
      setOutput({ statements: [], totalMs: 0, error: runError(e) });
    } finally {
      setBusy(null);
    }
  };

  const explain = async () => {
    if (busy) return;
    setBusy('visualize');
    try {
      setOutput(null);
      setViz(await visualize(sql, 'playground'));
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    if (!window.confirm('Reset the playground database? Every change you made here will be lost.')) return;
    setBusy('reset');
    try {
      await engine.resetPlayground();
      firstGen.current = engine.playgroundGeneration;
      setOutput(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="eyebrow">Sandbox · persistent</p>
        <h1 className="text-3xl font-semibold tracking-tight">Playground</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Free exploration on a separate copy of the practice database. Unlike question runs, changes here persist (CREATE, INSERT, transactions…) until you reset.
          <strong className="text-violet-600 dark:text-violet-300"> Visualize</strong> explains the last statement in your editor.
        </p>
      </header>
      {generation !== firstGen.current && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          The database was restarted (a query ran too long), so the playground is back to its original state.
        </p>
      )}
      <SqlEditor value={sql} onChange={setSql} onRun={run} minHeight="220px" error={output?.error?.offset !== undefined ? { offset: output.error.offset, message: output.error.message } : null} onReady={(api) => (editor.current = api)} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={!!busy} className="btn-primary" aria-label="Run" title="Run (Ctrl/Cmd + Enter)">
          {busy === 'run' ? 'Running…' : '▶ Run'}
        </button>
        <button type="button" onClick={explain} disabled={!!busy} className="btn-visualize" title="Show how PostgreSQL executes the last statement">
          {busy === 'visualize' ? 'Analyzing…' : '◈ Visualize'}
        </button>
        <button type="button" onClick={reset} disabled={!!busy} className="btn-secondary">
          {busy === 'reset' ? 'Resetting…' : 'Reset database'}
        </button>
        <button type="button" onClick={() => setSchemaOpen(!schemaOpen)} className="btn-ghost ml-auto" aria-expanded={schemaOpen}>
          {schemaOpen ? 'Hide schema' : 'Schema'}
        </button>
      </div>
      {schemaOpen && <SchemaQuickRef onInsert={(t) => editor.current?.insert(t)} />}
      {output && <RunResults output={output} sql={sql} />}
      {viz && <QueryVisualizer viz={viz} />}
    </div>
  );
}
