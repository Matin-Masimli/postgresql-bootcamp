import type { Difficulty } from '../../content/types.ts';
import { useT } from '../i18n/index.ts';
import type { QuestionStatus } from '../progress/store.ts';

/** Tinted pills in Apple's system colours: green, blue, orange, purple. */
const DIFF: Record<Difficulty, string> = {
  easy: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-500',
  medium: 'bg-sky-600/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-400',
  hard: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/15 dark:text-amber-500',
  interview: 'bg-teal-500/12 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400',
};

export const QUESTION_TYPES = ['write-query', 'fix-query', 'predict-output', 'concept-mc'] as const;

export function DifficultyBadge({ d }: { d: Difficulty }) {
  const t = useT();
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-semibold capitalize ${DIFF[d]}`}>{t(`difficulty.${d}`)}</span>;
}

export function StatusIcon({ s }: { s: QuestionStatus }) {
  const t = useT();
  const label = t(`status.${s}`);
  if (s === 'solved') {
    return (
      <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-emerald-500 text-white" title={label} aria-label={label}>
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.2 2.3 2.3 4.7-5" /></svg>
      </span>
    );
  }
  if (s === 'failed') return <span className="size-[18px] shrink-0 rounded-full border-[1.5px] border-amber-500 bg-amber-500/15" title={label} aria-label={label} />;
  return <span className="size-[18px] shrink-0 rounded-full border-[1.5px] border-zinc-300 dark:border-zinc-600" title={label} aria-label={label} />;
}
