import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
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

/** EN / AZ as an iOS-style segmented control. */
function LanguageSwitch() {
  const t = useT();
  const locale = useLocale();
  return (
    <div role="radiogroup" aria-label={t('nav.language')} className="segmented shrink-0">
      {LOCALES.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={locale === l.id} title={l.name} onClick={() => setLocale(l.id)} className="segment px-2.5 py-0.5 text-[12px]">
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** Light/dark follows the system until the reader picks one; the choice is then remembered. */
function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('pgb.theme');
      } catch {
        /* storage unavailable */
      }
      if (saved === 'light' || saved === 'dark') return;
      document.documentElement.classList.toggle('dark', mq.matches);
      setDark(mq.matches);
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);
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

/** The app mark: a database cylinder on an Apple-blue tile. */
export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-[0.55rem] bg-sky-600 dark:bg-sky-500 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
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
  const color = { loading: 'bg-amber-500 animate-pulse', ready: 'bg-emerald-500', restarting: 'bg-amber-500 animate-pulse', error: 'bg-red-500' }[status];
  return (
    <span className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-[12px] text-zinc-500 sm:flex" title={label} role="status" aria-label={label}>
      <span className={`size-1.5 rounded-full ${color}`} />
      <span className="hidden xl:inline">{status === 'ready' ? `PostgreSQL ${engine.serverVersion.split(' ')[0] || '18'}` : label}</span>
    </span>
  );
}

const iconBtn = 'grid size-9 shrink-0 place-items-center rounded-full text-zinc-600 transition-[background-color,color,transform] duration-200 hover:bg-black/[0.05] hover:text-zinc-900 active:scale-95 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-white';

export default function Layout() {
  const t = useT();
  const [dark, toggleTheme] = useTheme();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, which must not become the effect cleanup.
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname]);

  // Scroll edge effect: the bar only gains a hairline once content actually slides underneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', close);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className={`material sticky top-0 z-40 transition-shadow duration-300 print:hidden ${scrolled || menuOpen ? 'shadow-[0_1px_0_rgb(0_0_0/0.08)] dark:shadow-[0_1px_0_rgb(255_255_255/0.08)]' : ''}`}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <NavLink to="/" className="mr-2 flex shrink-0 items-center gap-2.5" aria-label={t('nav.homeAria')}>
            <Logo />
            <span className="font-display text-[15px] font-semibold tracking-[-0.015em] lg:max-xl:hidden">PostgreSQL Bootcamp</span>
          </NavLink>
          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-[14px] transition-colors duration-200 ${isActive ? 'font-medium text-zinc-900 dark:text-white' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'}`
                }
              >
                {t(n.label)}
              </NavLink>
            ))}
          </nav>
          <span className="flex-1 lg:hidden" />
          <EngineIndicator />
          <LanguageSwitch />
          <button type="button" onClick={toggleTheme} className={iconBtn} aria-label={dark ? t('theme.toLight') : t('theme.toDark')} title={dark ? t('theme.light') : t('theme.dark')}>
            {dark ? (
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`${iconBtn} lg:hidden`}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.menu')}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8.5h16M4 15.5h16" />}
            </svg>
          </button>
        </div>
      </header>

      {/* Phone/tablet menu: a full-height sheet below the bar, large type, items arriving in sequence. */}
      {menuOpen && (
        <nav id="mobile-menu" aria-label={t('nav.menu')} className="material animate-materialize fixed inset-x-0 top-14 bottom-0 z-30 overflow-y-auto px-6 pt-6 pb-10 lg:hidden">
          <ul className="mx-auto max-w-2xl space-y-1">
            {NAV.map((n, i) => (
              <li key={n.to} className="animate-fade-up" style={{ animationDelay: `${40 + i * 35}ms` }}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => `block py-2 font-display text-[28px] font-semibold tracking-[-0.02em] transition-colors ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  {t(n.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>
      <footer className="border-t border-black/[0.08] text-[12px] text-zinc-500 print:hidden dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t('footer.text')}</p>
          <nav className="flex gap-4">
            <Link to="/schema" className="hover:text-zinc-900 dark:hover:text-white">{t('nav.schema')}</Link>
            <Link to="/progress" className="hover:text-zinc-900 dark:hover:text-white">{t('nav.progress')}</Link>
            <Link to="/diagnostics" className="hover:text-zinc-900 dark:hover:text-white">{t('progress.diagnostics')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
