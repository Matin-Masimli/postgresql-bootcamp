// Learning progress: localStorage-backed, versioned, exportable as JSON.
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

const KEY = 'pgb.progress.v1';

const QuestionProgress = z.object({
  attempts: z.number().int().min(0),
  solved: z.boolean(),
  firstSolvedAt: z.string().optional(),
  lastAttemptAt: z.string().optional(),
  revealed: z.boolean().optional(),
  hintsUsed: z.number().int().min(0).optional(),
  draft: z.string().optional(),
});
const ExamRecord = z.object({
  at: z.string(),
  durationSec: z.number(),
  results: z.record(z.string(), z.boolean()),
});
export const ProgressData = z.object({
  version: z.literal(1),
  questions: z.record(z.string(), QuestionProgress),
  /** Local dates (YYYY-MM-DD) with at least one Check, for the streak. */
  activeDays: z.array(z.string()),
  exams: z.array(ExamRecord),
});
export type ProgressData = z.infer<typeof ProgressData>;
export type QuestionProgress = z.infer<typeof QuestionProgress>;
export type QuestionStatus = 'unsolved' | 'solved' | 'failed';

const empty = (): ProgressData => ({ version: 1, questions: {}, activeDays: [], exams: [] });

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = ProgressData.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : empty();
  } catch {
    return empty();
  }
}

let state: ProgressData = load();
const listeners = new Set<() => void>();

function commit(next: ProgressData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable or full: progress lives for this visit only */
  }
  for (const fn of listeners) fn();
}

function update(id: string, fn: (p: QuestionProgress) => QuestionProgress) {
  const prev = state.questions[id] ?? { attempts: 0, solved: false };
  commit({ ...state, questions: { ...state.questions, [id]: fn(prev) } });
}

export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const progress = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  recordCheck(id: string, pass: boolean) {
    const now = new Date().toISOString();
    update(id, (p) => ({ ...p, attempts: p.attempts + 1, solved: p.solved || pass, firstSolvedAt: p.firstSolvedAt ?? (pass ? now : undefined), lastAttemptAt: now }));
    const today = localDay();
    if (!state.activeDays.includes(today)) commit({ ...state, activeDays: [...state.activeDays, today].sort() });
  },
  recordReveal(id: string) {
    update(id, (p) => ({ ...p, revealed: true }));
  },
  recordHint(id: string, shown: number) {
    update(id, (p) => ({ ...p, hintsUsed: Math.max(p.hintsUsed ?? 0, shown) }));
  },
  saveDraft(id: string, sql: string) {
    if ((state.questions[id]?.draft ?? '') === sql) return;
    update(id, (p) => ({ ...p, draft: sql || undefined }));
  },
  recordExam(rec: z.infer<typeof ExamRecord>) {
    commit({ ...state, exams: [...state.exams, rec] });
  },
  exportJson(): string {
    return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  },
  /** Replace, or merge keeping the best of both (solved wins, attempts add up, newest draft kept). */
  importJson(text: string, mode: 'merge' | 'replace'): { questions: number } {
    const raw = JSON.parse(text);
    delete raw.exportedAt;
    const parsed = ProgressData.parse(raw);
    if (mode === 'replace') {
      commit(parsed);
    } else {
      const questions = { ...state.questions };
      for (const [id, q] of Object.entries(parsed.questions)) {
        const cur = questions[id];
        questions[id] = cur
          ? {
              attempts: Math.max(cur.attempts, q.attempts),
              solved: cur.solved || q.solved,
              firstSolvedAt: [cur.firstSolvedAt, q.firstSolvedAt].filter(Boolean).sort()[0],
              lastAttemptAt: [cur.lastAttemptAt, q.lastAttemptAt].filter(Boolean).sort().at(-1),
              revealed: cur.revealed || q.revealed,
              hintsUsed: Math.max(cur.hintsUsed ?? 0, q.hintsUsed ?? 0) || undefined,
              draft: (q.lastAttemptAt ?? '') > (cur.lastAttemptAt ?? '') ? q.draft ?? cur.draft : cur.draft ?? q.draft,
            }
          : q;
      }
      const exams = [...state.exams, ...parsed.exams.filter((e) => !state.exams.some((x) => x.at === e.at))].sort((a, b) => a.at.localeCompare(b.at));
      commit({ version: 1, questions, activeDays: [...new Set([...state.activeDays, ...parsed.activeDays])].sort(), exams });
    }
    return { questions: Object.keys(parsed.questions).length };
  },
  resetAll() {
    commit(empty());
  },
};

export function useProgress(): ProgressData {
  return useSyncExternalStore(progress.subscribe, progress.get);
}

export function statusOf(p: QuestionProgress | undefined): QuestionStatus {
  if (!p || p.attempts === 0) return 'unsolved';
  return p.solved ? 'solved' : 'failed';
}

/** Consecutive days with activity, ending today (or yesterday, if nothing yet today). */
export function currentStreak(days: string[]): number {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(localDay(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(localDay(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
