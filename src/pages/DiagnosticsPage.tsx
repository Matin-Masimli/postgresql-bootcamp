import { useEffect, useRef, useState } from 'react';
import { Engine } from '../db/client.ts';
import { loadManifest } from '../lib/manifest.ts';

interface Result {
  db: 'main' | 'hidden';
  timings?: { fetchMs: number; bootMs: number; firstQueryMs: number; bytes: number };
  serverVersion?: string;
  compressedBytes?: number;
  rowCheck?: { table: string; expected: number; actual: number }[];
  error?: string;
}

/** Loads both snapshots in a fresh worker and reports real in-browser timings. */
export default function DiagnosticsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [workerStartMs, setWorkerStartMs] = useState<number | null>(null);

  const run = async () => {
    setRunning(true);
    setResults([]);
    const t0 = performance.now();
    // A separate engine (own worker), so the measurement is cold and doesn't disturb the app's engine.
    const client = new Engine();
    const manifest = await loadManifest();
    try {
      for (const db of ['main', 'hidden'] as const) {
        try {
          await client.ensure(db);
          if (db === 'main') setWorkerStartMs(performance.now() - t0);
          const tq = performance.now();
          const counts = await client.query(db, manifest.tables.map((t) => `SELECT '${t.name}' AS t, count(*) AS n FROM ${t.name}`).join(' UNION ALL '));
          const firstQueryMs = performance.now() - tq;
          const rowCheck = counts!.rows.map(([table, n]) => ({ table: table!, expected: manifest.datasets[db].rowCount[table!], actual: Number(n) }));
          const t = client.timings[db]!;
          // Unpacked size isn't known after fetch; report the download size from the manifest.
          setResults((r) => [...r, { db, timings: { ...t, firstQueryMs, bytes: t.bytes }, serverVersion: client.serverVersion, rowCheck, compressedBytes: manifest.datasets[db].bytes }]);
        } catch (e) {
          setResults((r) => [...r, { db, error: (e as Error).message }]);
        }
      }
    } finally {
      client.dispose();
      setRunning(false);
    }
  };

  // Run once on mount (the ref stops StrictMode's double effect from measuring twice in parallel).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, []);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Diagnostics</h1>
        <p className="mt-1 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Boots a fresh in-browser PostgreSQL from each prebuilt snapshot and times it. The first visit also downloads and
          compiles the PostgreSQL WebAssembly runtime (about 17 MB uncompressed). Later visits use the browser cache.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="btn-primary mt-3"
        >
          {running ? 'Measuring…' : 'Measure again'}
        </button>
      </section>
      {workerStartMs != null && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Time until the main database was ready (worker start + download + boot): <strong>{fmt(workerStartMs)}</strong>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {results.map((r) => (
          <section key={r.db} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-semibold">{r.db === 'main' ? 'Main dataset' : 'Hidden dataset (used only for checking)'}</h2>
            {r.error ? (
              <p className="mt-2 text-sm text-red-700 dark:text-red-400">{r.error}</p>
            ) : (
              <>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-zinc-500">Snapshot size</dt>
                  <dd>{mb(r.compressedBytes!)} (gzipped)</dd>
                  <dt className="text-zinc-500">Download</dt><dd>{fmt(r.timings!.fetchMs)}</dd>
                  <dt className="text-zinc-500">Boot PostgreSQL</dt><dd>{fmt(r.timings!.bootMs)}</dd>
                  <dt className="text-zinc-500">Count all 16 tables</dt><dd>{fmt(r.timings!.firstQueryMs)}</dd>
                  <dt className="text-zinc-500">Server</dt><dd>PostgreSQL {r.serverVersion}</dd>
                </dl>
                <p className="mt-3 text-sm">
                  Row counts vs manifest:{' '}
                  {r.rowCheck!.every((c) => c.expected === c.actual)
                    ? <span className="text-emerald-700 dark:text-emerald-400">all {r.rowCheck!.length} tables match ✓</span>
                    : <span className="text-red-700 dark:text-red-400">mismatch: {r.rowCheck!.filter((c) => c.expected !== c.actual).map((c) => c.table).join(', ')}</span>}
                </p>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const fmt = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
