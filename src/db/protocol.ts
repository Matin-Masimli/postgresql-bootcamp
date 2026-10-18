// Messages between the main thread (client.ts) and the PGlite worker (worker.ts).
export type DbName = 'main' | 'hidden';

export interface LoadTimings { fetchMs: number; bootMs: number; firstQueryMs: number; bytes: number }

export type Request =
  | { type: 'load'; db: DbName; url: string }
  | { type: 'query'; db: DbName; sql: string };

export type ResponseBody =
  | { type: 'load'; timings: LoadTimings; serverVersion: string }
  | { type: 'query'; columns: { name: string; dataTypeID: number }[]; rows: (string | null)[][] };

export type Envelope<T> = { id: number } & T;
export type Reply = Envelope<{ ok: true; body: ResponseBody } | { ok: false; error: { message: string; code?: string; position?: number } }>;
