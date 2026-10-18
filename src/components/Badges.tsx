import type { Difficulty, Question } from '../../content/types.ts';
import type { QuestionStatus } from '../progress/store.ts';

const DIFF: Record<Difficulty, string> = {
  easy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  medium: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
  hard: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  interview: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300',
};
export const TYPE_LABEL: Record<Question['type'], string> = {
  'write-query': 'Write a query',
  'fix-query': 'Fix the query',
  'predict-output': 'Predict the output',
  'concept-mc': 'Concept',
};

export function DifficultyBadge({ d }: { d: Difficulty }) {
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${DIFF[d]}`}>{d}</span>;
}

export function StatusIcon({ s }: { s: QuestionStatus }) {
  if (s === 'solved') return <span className="text-emerald-600 dark:text-emerald-400" title="Solved" aria-label="Solved">●</span>;
  if (s === 'failed') return <span className="text-amber-500" title="Attempted, not solved yet" aria-label="Attempted">◐</span>;
  return <span className="text-zinc-300 dark:text-zinc-600" title="Not attempted" aria-label="Not attempted">○</span>;
}
