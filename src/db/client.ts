// Main-thread handle to the PGlite worker: request/response over postMessage.
// Phase 3 adds the watchdog (terminate + restart from snapshot) and the run/check API.
import type { DbName, Envelope, LoadTimings, Reply, Request, ResponseBody } from './protocol.ts';
import { loadManifest, publicUrl } from '../lib/manifest.ts';

export class DbError extends Error {
  constructor(message: string, readonly code?: string, readonly position?: number) {
    super(message);
  }
}

export class DbClient {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, { resolve: (b: ResponseBody) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<Reply>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.body);
      else p.reject(new DbError(e.data.error.message, e.data.error.code, e.data.error.position));
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'Database worker crashed'));
      this.pending.clear();
    };
  }

  private call(req: Request): Promise<ResponseBody> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, ...req } satisfies Envelope<Request>);
    });
  }

  async load(db: DbName): Promise<{ timings: LoadTimings; serverVersion: string }> {
    const manifest = await loadManifest();
    const body = await this.call({ type: 'load', db, url: publicUrl(`db/${manifest.datasets[db].file}`) });
    if (body.type !== 'load') throw new Error('unexpected reply');
    return body;
  }

  async query(db: DbName, sql: string) {
    const body = await this.call({ type: 'query', db, sql });
    if (body.type !== 'query') throw new Error('unexpected reply');
    return body;
  }

  terminate() {
    this.worker.terminate();
  }
}
