import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { engine, useEngineStatus } from '../db/client.ts';
import { LOCALES, setLocale, useLocale, useT } from '../i18n/index.ts';

const NAV = [
  { to: '/', label: 'nav.learn', end: true },
  { to: '/review', label: 'nav.review', end: false },
  { to: '/exam', label: 'nav.exam', end: false },
  { to: '/playground', label: 'nav.playground', end: false },
  { to: '/schema', label: 'nav.schema', end: false },
  { to: '/progress', label: 'nav.progress', end: false },
] as const;

/** EN / AZ segmented switch. */
function LanguageSwitch() {
  const t = useT();
  const locale = useLocale();
  return (
    <div role="radiogroup" aria-label={t('nav.language')} className="flex shrink-0 rounded-lg border border-zinc-200 bg-white/60 p-0.5 font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-900/60">
      {LOCALES.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={locale === l.id}
          title={l.name}
          onClick={() => setLocale(l.id)}
          className={`rounded-md px-1.5 py-0.5 transition ${locale === l.id ? 'bg-sky-600 font-semibold text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

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
  const t = useT();
  const status = useEngineStatus();
  if (status === 'idle') return null;
  const label = { loading: t('engine.loading'), ready: t('engine.ready'), restarting: t('engine.restarting'), error: t('engine.error', { detail: engine.statusDetail }) }[status];
  const color = { loading: 'bg-amber-400 animate-pulse', ready: 'bg-emerald-400 shadow-[0_0_8px_2px] shadow-emerald-400/50', restarting: 'bg-amber-400 animate-pulse', error: 'bg-red-500' }[status];
  return (
    <span className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-white/60 px-2.5 py-1 font-mono text-[11px] text-zinc-500 sm:flex dark:border-zinc-800 dark:bg-zinc-900/60" title={label} role="status" aria-label={label}>
      <span className={`size-1.5 rounded-full ${color}`} />
      <span className="hidden md:inline">{status === 'ready' ? `pg ${engine.serverVersion.split(' ')[0] || '18'}` : label}</span>
    </span>
  );
}

export default function Layout() {
  const t = useT();
  const [dark, toggleTheme] = useTheme();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which must not become the effect cleanup.
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/70 backdrop-blur-xl print:hidden dark:border-zinc-800/80 dark:bg-zinc-950/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t('nav.homeAria')}>
            <Logo />
            <span className="font-mono text-sm font-semibold tracking-tight lg:max-xl:hidden">
              pg<span className="text-sky-500">/</span>bootcamp
            </span>
          </NavLink>
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 text-sm lg:ml-4 lg:flex">
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
                    {t(n.label)}
                    {isActive && <span aria-hidden className="absolute inset-x-3 -bottom-[12px] h-0.5 rounded-full bg-linear-to-r from-sky-500 to-violet-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <span className="flex-1 lg:hidden" />
          <EngineIndicator />
          <LanguageSwitch />
          <button
            type="button"
            onClick={toggleTheme}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label={dark ? t('theme.toLight') : t('theme.toDark')}
            title={dark ? t('theme.light') : t('theme.dark')}
          >
            {dark ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-600 transition hover:bg-zinc-900/5 hover:text-zinc-900 lg:hidden dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.menu')}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <nav id="mobile-menu" className="animate-fade-up border-t border-zinc-200/80 px-4 pt-2 pb-4 lg:hidden dark:border-zinc-800/80" aria-label={t('nav.menu')}>
            <ul className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] transition ${isActive ? 'bg-sky-500/10 font-medium text-sky-700 dark:text-sky-300' : 'text-zinc-700 hover:bg-zinc-900/5 dark:text-zinc-300 dark:hover:bg-white/5'}`
                    }
                  >
                    {t(n.label)}
                    <span aria-hidden className="text-zinc-400">→</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>
      <footer className="border-t border-zinc-200/80 px-4 py-6 text-center font-mono text-[11px] text-zinc-500 print:hidden dark:border-zinc-800/80">
        {t('footer.text')}
      </footer>
    </div>
  );
}
