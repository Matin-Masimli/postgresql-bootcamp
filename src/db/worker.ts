/// <reference lib="webworker" />
// PGlite runs here, off the main thread. The main thread may terminate() this worker at any time
// (PGlite ignores statement_timeout, see docs/engine-notes.md); everything is rebuilt from snapshots.
import { PGlite } from '@electric-sql/pglite';
import { ExpectedCache, grade } from '../engine/grade.ts';
import { PracticeSession } from '../engine/session.ts';
import type { Envelope, Instance, Reply, ReplyBodies, Request } from './protocol.ts';

const sessions = new Map<Instance, PracticeSession>();
const cache = new ExpectedCache();

function session(i: Instance): PracticeSession {
  const s = sessions.get(i);
  if (!s) throw new Error(`Database "${i}" is not loaded yet`);
  return s;
}

async function handle(req: Request): Promise<ReplyBodies[keyof ReplyBodies]> {
  switch (req.type) {
    case 'open': {
      const t0 = performance.now();
      await sessions.get(req.instance)?.pg.close();
      sessions.delete(req.instance);
      const pg = await PGlite.create({ loadDataDir: req.blob });
      const s = await PracticeSession.open(pg, req.sequences);
      sessions.set(req.instance, s);
      const v = await s.query(`SELECT current_setting('server_version')`);
      return { bootMs: performance.now() - t0, serverVersion: v.result!.rows[0][0]! };
    }
    case 'run':
      return req.instance === 'playground' ? session('playground').runPersistent(req.sql) : (await session('main').runSandboxed(req.sql)).output;
    case 'grade':
      return grade({ main: session('main'), hidden: session('hidden') }, req.question, req.sql, cache);
    case 'query':
      return (await session(req.instance).query(req.sql)).result ?? null;
  }
}

// Requests run strictly one at a time: sandboxed runs rely on BEGIN … ROLLBACK not interleaving.
let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (e: MessageEvent<Envelope<Request>>) => {
  const { id, ...req } = e.data;
  queue = queue.then(async () => {
    let reply: Reply;
    try {
      reply = { id, ok: true, body: await handle(req as Request) };
    } catch (err) {
      reply = { id, ok: false, error: { message: (err as Error).message ?? String(err) } };
    }
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(reply);
  });
};
