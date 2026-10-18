import type { Difficulty, Question } from '../../content/types.ts';
import type { QuestionStatus } from '../progress/store.ts';

const DIFF: Record<Difficulty, string> = {
  easy: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  medium: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  hard: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  interview: 'border-fuchsia-300/70 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
};
export const TYPE_LABEL: Record<Question['type'], string> = {
  'write-query': 'Write a query',
  'fix-query': 'Fix the query',
  'predict-output': 'Predict the output',
  'concept-mc': 'Concept',
};

export function DifficultyBadge({ d }: { d: Difficulty }) {
  return <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-wide uppercase ${DIFF[d]}`}>{d}</span>;
}

export function StatusIcon({ s }: { s: QuestionStatus }) {
  if (s === 'solved') return <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-[10px] text-white shadow-sm shadow-emerald-500/40" title="Solved" aria-label="Solved">✓</span>;
  if (s === 'failed') return <span className="size-4 shrink-0 rounded-full border-2 border-amber-400 bg-amber-400/20" title="Attempted, not solved yet" aria-label="Attempted" />;
  return <span className="size-4 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-700" title="Not attempted" aria-label="Not attempted" />;
}
