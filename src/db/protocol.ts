// Messages between the main thread (client.ts) and the PGlite worker (worker.ts).
import type { Gradable } from '../engine/grade.ts';
import type { SequenceBaseline } from '../engine/session.ts';
import type { Feedback, ResultSet, RunOutput } from '../engine/types.ts';

/** main/hidden are always pristine (sandboxed runs); playground keeps changes until reset. */
export type Instance = 'main' | 'hidden' | 'playground';

export type Request =
  | { type: 'open'; instance: Instance; blob: Blob; sequences: SequenceBaseline[] }
  | { type: 'run'; instance: 'main' | 'playground'; sql: string }
  | { type: 'grade'; question: Gradable; sql: string }
  | { type: 'query'; instance: Instance; sql: string };

export interface ReplyBodies {
  open: { bootMs: number; serverVersion: string };
  run: RunOutput;
  grade: { feedback: Feedback; output: RunOutput };
  query: ResultSet | null;
}

export type Envelope<T> = { id: number } & T;
export type Reply = { id: number } & ({ ok: true; body: unknown } | { ok: false; error: { message: string } });
