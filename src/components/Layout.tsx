import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { engine, useEngineStatus } from '../db/client.ts';

const NAV = [
  { to: '/', label: 'Learn', end: true },
  { to: '/review', label: 'Review' },
  { to: '/exam', label: 'Exam' },
  { to: '/playground', label: 'Playground' },
  { to: '/schema', label: 'Schema' },
  { to: '/progress', label: 'Progress' },
];

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('pgb.theme', next ? 'dark' : 'light');
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
    setDark(next);
  };
  return [dark, toggle];
}

/** The app mark: a database cylinder in a gradient tile. */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-lg bg-linear-to-br from-sky-500 via-sky-600 to-violet-600 shadow-lg shadow-sky-600/30 ring-1 ring-white/20 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </svg>
    </span>
  );
}

function EngineIndicator() {
  const status = useEngineStatus();
  if (status === 'idle') return null;
  const label = { loading: 'Loading database…', ready: 'PostgreSQL ready', restarting: 'Restarting database…', error: `Database error: ${engine.statusDetail}` }[status];
  const color = { loading: 'bg-amber-400 animate-pulse', ready: 'bg-emerald-400 shadow-[0_0_8px_2px] shadow-emerald-400/50', restarting: 'bg-amber-400 animate-pulse', error: 'bg-red-500' }[status];
  return (
    <span className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white/60 px-2.5 py-1 font-mono text-[11px] text-zinc-500 sm:flex dark:border-zinc-800 dark:bg-zinc-900/60" title={label} role="status" aria-label={label}>
      <span className={`size-1.5 rounded-full ${color}`} />
      <span className="hidden md:inline">{status === 'ready' ? `pg ${engine.serverVersion.split(' ')[0] || '18'}` : label}</span>
    </span>
  );
}

export default function Layout() {
  const [dark, toggleTheme] = useTheme();
  const { pathname } = useLocation();
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which must not become the effect cleanup.
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/70 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/70">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="PostgreSQL Bootcamp home">
            <Logo />
            <span className="hidden font-mono text-sm font-semibold tracking-tight lg:inline">
              pg<span className="text-sky-500">/</span>bootcamp
            </span>
          </NavLink>
          <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 text-sm [scrollbar-width:none] lg:ml-4">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `relative shrink-0 rounded-lg px-3 py-1.5 transition ${isActive ? 'bg-zinc-900/5 font-medium text-zinc-900 dark:bg-white/5 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {n.label}
                    {isActive && <span aria-hidden className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-linear-to-r from-sky-500 to-violet-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <EngineIndicator />
          <button
            type="button"
            onClick={toggleTheme}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            )}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-zinc-200/80 py-6 text-center font-mono text-[11px] text-zinc-500 dark:border-zinc-800/80">
        Real PostgreSQL 18, compiled to WebAssembly, running in this tab · progress stays in your browser
      </footer>
    </div>
  );
}
