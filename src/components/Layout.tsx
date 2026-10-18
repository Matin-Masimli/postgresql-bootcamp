import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { engine, useEngineStatus } from '../db/client.ts';

const NAV = [
  { to: '/', label: 'Topics', end: true },
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

function EngineIndicator() {
  const status = useEngineStatus();
  if (status === 'idle') return null;
  const label = { loading: 'Loading database…', ready: 'Database ready', restarting: 'Restarting database…', error: `Database error: ${engine.statusDetail}` }[status];
  const color = { loading: 'bg-amber-400 animate-pulse', ready: 'bg-emerald-500', restarting: 'bg-amber-400 animate-pulse', error: 'bg-red-500' }[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-500" title={label} role="status" aria-label={label}>
      <span className={`size-2 rounded-full ${color}`} />
      <span className="hidden md:inline">{status === 'ready' ? 'DB' : label}</span>
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
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <NavLink to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight" aria-label="PostgreSQL Bootcamp home">
            <span aria-hidden className="grid size-7 place-items-center rounded-md bg-sky-600 text-sm text-white">pg</span>
            <span className="hidden lg:inline">PostgreSQL Bootcamp</span>
          </NavLink>
          <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 text-sm [scrollbar-width:none]">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-md px-2.5 py-1.5 ${isActive ? 'bg-zinc-100 font-medium dark:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <EngineIndicator />
          <button
            type="button"
            onClick={toggleTheme}
            className="shrink-0 rounded-md px-2 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
