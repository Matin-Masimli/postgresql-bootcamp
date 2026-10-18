// Main-thread handle to the PGlite worker, with a watchdog: a request that runs too long gets the
// worker terminated and restarted from the snapshot Blobs kept in memory (PGlite cannot cancel queries).
import { useSyncExternalStore } from 'react';
import type { Gradable } from '../engine/grade.ts';
import type { Instance, Reply, ReplyBodies, Request } from './protocol.ts';
import { loadManifest, publicUrl } from '../lib/manifest.ts';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'restarting' | 'error';

export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
}

/** Turns a rejected engine call into an error the result views can show. */
export const runError = (e: unknown) => ({ message: (e as Error).message ?? String(e), code: (e as { code?: string }).code });

const TIMEOUT_MS = { run: 10_000, grade: 20_000, open: 120_000, query: 15_000 } as const;

export class Engine {
  status: EngineStatus = 'idle';
  statusDetail = '';
  /** Increments when the playground is reset (by the user or by a restart). */
  playgroundGeneration = 0;
  readonly timings: Partial<Record<Instance, { fetchMs: number; bootMs: number; bytes: number }>> = {};
  serverVersion = '';

  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (b: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private blobs = new Map<'main' | 'hidden', Promise<Blob>>();
  private opening = new Map<Instance, Promise<void>>();
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private setStatus(status: EngineStatus, detail = '') {
    this.status = status;
    this.statusDetail = detail;
    for (const fn of this.listeners) fn();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<Reply>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.body);
      else p.reject(new Error(e.data.error.message));
    };
    w.onerror = (e) => {
      e.preventDefault();
      void this.restart(`The database worker crashed (${e.message || 'out of memory?'}). It was restarted.`);
    };
    this.worker = w;
    return w;
  }

  private call<T extends Request['type']>(req: Extract<Request, { type: T }>, timeoutMs: number = TIMEOUT_MS[req.type]): Promise<ReplyBodies[T]> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new TimeoutError(`Stopped after ${timeoutMs / 1000} s. The query took too long (an accidental cross join or an endless recursive CTE?). The database was restarted, so you can try again.`));
        void this.restart();
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (b: unknown) => void, reject, timer });
      worker.postMessage({ id, ...req });
    });
  }

  private snapshot(db: 'main' | 'hidden'): Promise<Blob> {
    let p = this.blobs.get(db);
    if (!p) {
      p = (async () => {
        const m = await loadManifest();
        const t0 = performance.now();
        const res = await fetch(publicUrl(`db/${m.datasets[db].file}`));
        if (!res.ok) throw new Error(`Could not download the ${db} database (HTTP ${res.status}).`);
        const blob = await res.blob();
        this.timings[db] = { fetchMs: performance.now() - t0, bootMs: 0, bytes: m.datasets[db].bytes };
        return blob;
      })();
      p.catch(() => this.blobs.delete(db));
      this.blobs.set(db, p);
    }
    return p;
  }

  /** Opens an instance once; concurrent callers share the same promise. */
  ensure(instance: Instance): Promise<void> {
    let p = this.opening.get(instance);
    if (!p) {
      p = (async () => {
        const source = instance === 'hidden' ? 'hidden' : 'main';
        if (instance === 'main' && this.status === 'idle') this.setStatus('loading', 'Loading the practice database…');
        const [blob, m] = await Promise.all([this.snapshot(source), loadManifest()]);
        const r = await this.call({ type: 'open', instance, blob, sequences: m.datasets[source].sequences });
        if (instance !== 'playground') this.timings[instance] = { ...this.timings[instance]!, bootMs: r.bootMs };
        this.serverVersion = r.serverVersion;
        if (instance === 'main') this.setStatus('ready');
      })();
      p.catch((e: Error) => {
        this.opening.delete(instance);
        if (instance === 'main') this.setStatus('error', e.message);
      });
      this.opening.set(instance, p);
    }
    return p;
  }

  /** Kill the worker (stuck query or crash) and reopen what was open before, from in-memory snapshots. */
  async restart(reason?: string) {
    const reopen = [...this.opening.keys()].filter((i) => i !== 'playground');
    const hadPlayground = this.opening.has('playground');
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error(reason ?? 'The database was restarted.'));
    }
    this.pending.clear();
    this.opening.clear();
    if (hadPlayground) this.playgroundGeneration++;
    this.setStatus('restarting', 'Restarting the database…');
    try {
      await Promise.all(reopen.map((i) => this.ensure(i)));
      this.setStatus('ready');
    } catch (e) {
      this.setStatus('error', (e as Error).message);
    }
  }

  async run(sql: string, instance: 'main' | 'playground' = 'main') {
    await this.ensure(instance);
    return this.call({ type: 'run', instance, sql });
  }

  async grade(question: Gradable, sql: string) {
    await Promise.all([this.ensure('main'), this.ensure('hidden')]);
    return this.call({ type: 'grade', question, sql });
  }

  async query(instance: Instance, sql: string) {
    await this.ensure(instance);
    return this.call({ type: 'query', instance, sql });
  }

  async resetPlayground() {
    this.opening.delete('playground');
    this.playgroundGeneration++;
    await this.ensure('playground');
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}

/** The app-wide engine. Main loads on first use; hidden loads on first Check (and is prefetched once main is ready). */
export const engine = new Engine();

export function useEngineStatus() {
  return useSyncExternalStore(engine.subscribe, () => engine.status);
}
