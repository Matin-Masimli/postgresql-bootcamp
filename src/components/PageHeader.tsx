import type { ReactNode } from 'react';

/** The standard page heading: eyebrow, title, optional intro and actions. Used by every secondary page. */
export default function PageHeader({ eyebrow, title, intro, actions, children }: { eyebrow?: ReactNode; title: ReactNode; intro?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="animate-fade-up space-y-3">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <h1 className="mr-auto text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {intro && <p className="max-w-3xl text-zinc-600 dark:text-zinc-400">{intro}</p>}
      {children}
    </header>
  );
}

/** A centred empty state with an icon, a title, a line of text and an optional action. */
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span aria-hidden className="grid size-12 place-items-center rounded-xl bg-linear-to-br from-sky-500/15 to-violet-500/15 text-xl text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-300">{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{text}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
