import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';

const NAV = [
  { to: '/', label: 'Topics', end: true },
  { to: '/schema', label: 'Schema' },
  { to: '/diagnostics', label: 'Diagnostics' },
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

export default function Layout() {
  const [dark, toggleTheme] = useTheme();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span aria-hidden className="grid size-7 place-items-center rounded-md bg-sky-600 text-sm text-white">pg</span>
            <span className="hidden sm:inline">PostgreSQL Bootcamp</span>
          </NavLink>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1.5 ${isActive ? 'bg-zinc-100 font-medium dark:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={toggleTheme}
              className="ml-1 rounded-md px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? '☀' : '☾'}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
