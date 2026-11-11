import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { LineBadge, LineBoard, MapLegend, MetroMap, PocketMap } from '../components/Metro.tsx';
import SqlCode from '../components/SqlCode.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Rich from '../i18n/Rich.tsx';
import { DRAW_END, LINES, currentStation, lineVars, stationsFor, type Station } from '../lib/metro.ts';
import { currentStreak, useProgress } from '../progress/store.ts';

/** Queries the hero terminal cycles through, each with a tiny result. */
const DEMOS: { sql: string; columns: string[]; rows: string[][] }[] = [
  {
    sql: `SELECT channel, count(*) AS orders\nFROM orders\nGROUP BY channel\nORDER BY orders DESC;`,
    columns: ['channel', 'orders'],
    rows: [['web', '3811'], ['mobile', '2454'], ['marketplace', '920'], ['phone', '600']],
  },
  {
    sql: `SELECT job_title, salary,\n       rank() OVER (ORDER BY salary DESC)\nFROM employees\nORDER BY salary DESC, job_title\nLIMIT 4;`,
    columns: ['job_title', 'salary', 'rank'],
    rows: [['Chief Executive Officer', '259000.00', '1'], ['VP of Engineering', '184500.00', '2'], ['VP of Customer Support', '181500.00', '3'], ['VP of Marketing', '181500.00', '3']],
  },
  {
    sql: `WITH RECURSIVE n AS (\n  SELECT 1 AS i\n  UNION ALL\n  SELECT i + 1 FROM n WHERE i < 4\n)\nSELECT i, i * i AS square FROM n;`,
    columns: ['i', 'square'],
    rows: [['1', '1'], ['2', '4'], ['3', '9'], ['4', '16']],
  },
];

function useTypewriter(): { text: string; demo: (typeof DEMOS)[number]; done: boolean } {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [i, setI] = useState(0);
  const [n, setN] = useState(reduce ? DEMOS[0].sql.length : 0);
  const demo = DEMOS[i];
  useEffect(() => {
    if (reduce) return;
    if (n < demo.sql.length) {
      const t = setTimeout(() => setN(n + 1), demo.sql[n] === '\n' ? 120 : 28);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setI((i + 1) % DEMOS.length);
      setN(0);
    }, 3600);
    return () => clearTimeout(t);
  }, [n, i, demo, reduce]);
  return { text: demo.sql.slice(0, n), demo, done: n >= demo.sql.length };
}

function Terminal() {
  const t = useT();
  const { text, demo, done } = useTypewriter();
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      {/* A soft, colourless shadow under the window, the way product shots sit on the page. */}
      <div aria-hidden className="absolute inset-x-10 -bottom-6 h-16 rounded-full bg-black/20 blur-3xl dark:bg-black/60" />
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_24px_64px_-16px_rgb(0_0_0/0.2)] dark:bg-[#1e1e20] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_24px_64px_-16px_rgb(0_0_0/0.8)]">
        <div className="relative flex items-center gap-2 border-b border-black/[0.06] bg-zinc-50/80 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <span className="absolute inset-x-0 text-center text-[13px] font-medium text-zinc-500">practice_db — psql</span>
        </div>
        <div className="space-y-4 p-5 text-left sm:p-7" aria-label={t('home.terminal.aria')} role="img">
          <div className="min-h-[8.5rem]">
            <SqlCode code={text || ' '} className="!rounded-none !bg-transparent !p-0 !shadow-none !ring-0 text-[13.5px] sm:text-[14px]" />
          </div>
          <div className={`transition-opacity duration-500 ${done ? 'opacity-100' : 'opacity-0'}`}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-zinc-500">
                  {demo.columns.map((c) => <th key={c} className="border-b border-black/[0.08] pr-4 pb-1.5 font-medium dark:border-white/[0.08]">{c}</th>)}
                </tr>
              </thead>
              <tbody className="font-mono">
                {demo.rows.map((r, i) => (
                  <tr key={i}>{r.map((v, j) => <td key={j} className="py-1 pr-4 text-zinc-800 tabular-nums dark:text-zinc-200">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] font-medium text-emerald-600 dark:text-emerald-500">{t('home.terminal.rows', { n: demo.rows.length })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" className="stroke-black/[0.08] dark:stroke-white/[0.1]" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="stroke-sky-600 transition-[stroke-dashoffset] duration-700 dark:stroke-sky-500" />
    </svg>
  );
}

/** Line icons drawn in the SF Symbols manner (even strokes, rounded caps). */
const ICONS = {
  database: <path d="M4 6.5C4 4.6 7.6 3 12 3s8 1.6 8 3.5v11c0 1.9-3.6 3.5-8 3.5s-8-1.6-8-3.5v-11ZM4 6.5C4 8.4 7.6 10 12 10s8-1.6 8-3.5M4 12c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5" />,
  shield: <path d="M12 3 5 6v5.5c0 4.4 2.9 8.2 7 9.5 4.1-1.3 7-5.1 7-9.5V6l-7-3Zm-3.2 9.2 2.3 2.3 4.2-4.6" />,
  tree: <path d="M12 5.5V9m0 0H7a2 2 0 0 0-2 2v2m7-4h5a2 2 0 0 1 2 2v2M10.5 2.5h3v3h-3zM3.5 13h3v3h-3zm14 0h3v3h-3zM5 16v2.5m14-2.5v2.5M3.5 18.5h3v3h-3zm14 0h3v3h-3z" />,
} as const;

/** Draw the map in on the first home visit of a session only; after that it is simply there. */
function useFirstVisit(key: string): boolean {
  const [first] = useState(() => {
    try {
      return sessionStorage.getItem(key) !== '1';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage unavailable: the map just draws again next time */
    }
  }, [key]);
  return first;
}

/** The passenger display: which station is next, on which line, and the way in. */
function NextStop({ station, started, count }: { station: Station; started: boolean; count: number }) {
  const t = useT();
  return (
    <Link
      to={`/topic/${station.topic.slug}`}
      style={{ ...lineVars(station.line.n), '--d': '120ms' } as CSSProperties}
      className="metro-fade group relative block overflow-hidden rounded-[1.6rem] md:max-lg:max-w-md bg-zinc-950 p-6 pb-7 text-white shadow-[0_30px_60px_-24px_rgb(0_0_0/0.5)] ring-1 ring-white/10 transition-[translate,box-shadow] duration-200 ease-(--ease-out) hover:-translate-y-0.5 hover:shadow-[0_36px_70px_-24px_rgb(0_0_0/0.55)] active:translate-y-0 dark:bg-zinc-900"
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold text-white/60">
        <LineBadge n={station.line.n} className="size-6 text-[13px]" />
        {started ? t('home.nextStop') : t('home.firstStop')}
      </span>
      <span className="mt-3 block font-display text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance">{station.topic.title}</span>
      <span className="mt-1.5 block text-[14px] text-white/60 tabular-nums">
        {t('home.stationOf', { n: station.topic.id, total: count })} · {t('common.solvedOf', { solved: station.solved, total: station.total })}
      </span>
      <span className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span className="btn bg-white px-5 py-2 text-[15px] text-zinc-950 group-hover:bg-white/90">
          {started ? t('home.continueShort') : t('home.start')}
          <svg viewBox="0 0 16 16" className="size-3.5 transition-[translate] duration-200 ease-(--ease-out) group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 3.5 10.5 8 6 12.5" /></svg>
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-white/50"><span className="size-1.5 rounded-full bg-emerald-500" />{t('home.engine')}</span>
      </span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-(--lc)" />
    </Link>
  );
}

export default function HomePage() {
  const t = useT();
  const content = useContent();
  const p = useProgress();
  const stations = stationsFor(content.topics, p, content);
  const current = currentStation(stations);
  const total = stations.reduce((n, s) => n + s.total, 0);
  const solved = stations.reduce((n, s) => n + s.solved, 0);
  const pct = total ? Math.round((solved / total) * 100) : 0;
  const started = solved > 0 || p.activeDays.length > 0;
  const streak = currentStreak(p.activeDays);
  const animate = useFirstVisit('pgb.mapDrawn');

  const features = [
    { icon: ICONS.database, n: 1, title: t('home.feature1.title'), text: t('home.feature1.text') },
    { icon: ICONS.shield, n: 2, title: t('home.feature2.title'), text: t('home.feature2.text') },
    { icon: ICONS.tree, n: 5, title: t('home.feature3.title'), text: t('home.feature3.text') },
  ];
  const stats: [string, string][] = [
    [t('home.stat.stations'), String(stations.length)],
    [t('home.stat.lines'), String(LINES.length)],
    [t('home.stat.questions'), String(total)],
    [t('home.stat.solved'), String(solved)],
    [t('home.stat.streak'), streak ? t('home.streakDays', { n: streak }) : '—'],
  ];

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* ── Hero: the network ── */}
      <section className={`space-y-10 pt-2 sm:pt-6 ${animate ? 'metro-animate' : ''}`}>
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="metro-fade space-y-6">
            <h1 className="text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl xl:text-[4.5rem]">
              {t('home.title1')}
              <span className="block text-zinc-400 dark:text-zinc-500">{t('home.title2')}</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">
              <Rich
                text={t('home.intro', { n: stations.length })}
                tags={{
                  code: (c) => <code className="font-mono text-[0.9em] text-zinc-900 dark:text-white">{c}</code>,
                  hl: (c) => <span className="font-medium text-zinc-900 dark:text-white">{c}</span>,
                }}
              />
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[16px]">
              <Link to="/playground" className="link">{t('home.openPlayground')} <span aria-hidden>›</span></Link>
              <Link to="/review" className="link">{t('nav.review')} <span aria-hidden>›</span></Link>
              <Link to="/exam" className="link">{t('exam.title')} <span aria-hidden>›</span></Link>
            </div>
          </div>
          {current && <NextStop station={current} started={started} count={stations.length} />}
        </div>

        <div className="lg:hidden"><PocketMap stations={stations} current={current} /></div>
        <div className="hidden pt-14 pb-12 lg:block">
          <MetroMap stations={stations} current={current} animate={animate} />
        </div>

        <div className="metro-fade flex flex-wrap items-center justify-between gap-x-10 gap-y-6 lg:border-t border-black/[0.08] pt-6 dark:border-white/[0.08]" style={{ '--d': `${DRAW_END - 200}ms` } as CSSProperties}>
          <div className="hidden lg:block"><MapLegend /></div>
          <dl className="grid w-full grid-cols-3 gap-x-6 gap-y-5 sm:flex sm:w-auto sm:flex-wrap sm:gap-x-9">
            {stats.map(([k, v]) => (
              <div key={k} className="flex flex-col-reverse gap-0.5">
                <dt className="text-[13px] text-zinc-500">{k}</dt>
                <dd className="font-display text-[26px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── How a station works: a dark band, whatever the theme ── */}
      <section className="dark relative mx-[calc(50%-50vw)] overflow-hidden bg-[#0c0c0e] text-zinc-100 [:root.dark_&]:bg-[#111113] [:root.dark_&]:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_-1px_0_rgb(255_255_255/0.08)]">
        {/* The five lines run along the top edge of the band, then leave. */}
        <svg aria-hidden className="absolute inset-x-0 top-0 h-[72px] w-full" preserveAspectRatio="none" viewBox="0 0 1440 72">
          {LINES.map((l, i) => (
            <path key={l.n} d={`M0 ${10 + i * 10} H1440`} fill="none" stroke={`var(--line-${l.n})`} strokeWidth="5" />
          ))}
        </svg>
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pt-32 pb-24 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pt-36 lg:pb-28">
          <div className="space-y-10">
            <div className="space-y-4">
              <h2 className="text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance text-white sm:text-5xl">{t('home.how.title')}</h2>
              <p className="max-w-xl text-lg leading-relaxed text-zinc-400">{t('home.how.text')}</p>
            </div>
            <ul className="space-y-7">
              {features.map((f) => (
                <li key={f.title} className="flex gap-4" style={lineVars(f.n)}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--lc)_18%,transparent)] text-(--lc)">
                    <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
                  </span>
                  <span>
                    <span className="block font-display text-[19px] font-bold tracking-[-0.01em] text-white">{f.title}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-zinc-400">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Terminal />
        </div>
      </section>

      {/* ── The lines, station by station ── */}
      <section className="space-y-10">
        <div className="flex flex-wrap items-end gap-6">
          <div className="mr-auto max-w-2xl space-y-3">
            <h2 className="text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">{t('home.lines.title')}</h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">{t('home.lines.text')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Ring pct={pct} />
              <span className="absolute inset-0 grid place-items-center text-[13px] font-semibold tabular-nums">{pct}%</span>
            </div>
            <span className="font-semibold">{t('common.solvedOf', { solved, total })}</span>
          </div>
        </div>
        <div className="columns-1 gap-6 md:columns-2 xl:columns-3">
          {LINES.map((l) => <LineBoard key={l.n} line={l} stations={stations} current={current} />)}
        </div>
      </section>
    </div>
  );
}
