import type { ReactNode } from 'react';

/** The standard page heading: large title, optional intro and actions. Used by every secondary page. */
export default function PageHeader({ title, intro, actions, children }: { title: ReactNode; intro?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="animate-fade-up space-y-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <h1 className="mr-auto text-4xl leading-[1.04] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {intro && <p className="max-w-3xl pt-1 text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">{intro}</p>}
      {children && <div className="space-y-3 pt-2">{children}</div>}
    </header>
  );
}

/** A centred empty state with an icon, a title, a line of text and an optional action. */
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-sky-600/10 text-2xl text-sky-700 dark:bg-sky-400/15 dark:text-sky-400">{icon}</span>
      <h2 className="text-2xl font-semibold">{title}</h2>
      {text && <p className="max-w-md text-zinc-600 dark:text-zinc-400">{text}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
