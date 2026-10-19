import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { TopicMeta } from '../../content/topicList.ts';
import SqlCode from '../components/SqlCode.tsx';
import { useContent, type Content } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Rich from '../i18n/Rich.tsx';
import { currentStreak, useProgress, type ProgressData } from '../progress/store.ts';

/** The course in five stages; topic ids are inclusive ranges in learning order. */
const STAGES = [
  { n: 1, from: 1, to: 4 },
  { n: 2, from: 5, to: 7 },
  { n: 3, from: 8, to: 13 },
  { n: 4, from: 14, to: 18 },
  { n: 5, from: 19, to: 21 },
] as const;

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
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 rounded-[2rem] bg-linear-to-br from-sky-500/25 via-violet-500/20 to-cyan-400/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/90 shadow-2xl shadow-sky-900/10 dark:border-zinc-700/70 dark:bg-zinc-900/80 dark:shadow-black/50">
        <div className="flex items-center gap-1.5 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 font-mono text-[11px] text-zinc-500">practice_db — psql</span>
        </div>
        <div className="space-y-3 p-4" aria-label={t('home.terminal.aria')} role="img">
          <div className="relative min-h-[9.5rem]">
            <SqlCode code={text || ' '} className="!border-0 !bg-transparent !p-0" />
          </div>
          <div className={`transition-opacity duration-500 ${done ? 'opacity-100' : 'opacity-0'}`}>
            <table className="w-full font-mono text-[12px]">
              <thead>
                <tr className="text-left text-zinc-500">
                  {demo.columns.map((c) => <th key={c} className="border-b border-zinc-200 py-1 pr-3 font-medium dark:border-zinc-800">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {demo.rows.map((r, i) => (
                  <tr key={i}>{r.map((v, j) => <td key={j} className="py-0.5 pr-3 text-zinc-700 dark:text-zinc-300">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{t('home.terminal.rows', { n: demo.rows.length })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function topicStats(t: TopicMeta, p: ProgressData, content: Content) {
  const qs = content.topic(t.id)?.questions ?? [];
  const solved = qs.filter((q) => p.questions[q.id]?.solved).length;
  const attempted = qs.filter((q) => (p.questions[q.id]?.attempts ?? 0) > 0).length;
  return { total: qs.length, solved, attempted };
}

function Ring({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <defs>
        <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#3b7dff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className="stroke-zinc-200 dark:stroke-zinc-800" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" stroke="url(#ring)" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700" />
    </svg>
  );
}

export default function HomePage() {
  const t = useT();
  const content = useContent();
  const TOPICS = content.topics;
  const p = useProgress();
  const streak = currentStreak(p.activeDays);
  const stats = new Map(TOPICS.map((x) => [x.id, topicStats(x, p, content)]));
  const total = [...stats.values()].reduce((s, x) => s + x.total, 0);
  const solved = [...stats.values()].reduce((s, x) => s + x.solved, 0);
  const pct = total ? Math.round((solved / total) * 100) : 0;
  // "Continue" = the first topic that has been started but not finished, else the first unfinished one.
  const current = TOPICS.find((x) => { const s = stats.get(x.id)!; return s.attempted > 0 && s.solved < s.total; })
    ?? TOPICS.find((x) => { const s = stats.get(x.id)!; return s.solved < s.total; });
  const started = solved > 0 || p.activeDays.length > 0;

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="animate-fade-up space-y-6">
          <p className="eyebrow">{t('home.eyebrow')}</p>
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {t('home.title1')}<br />
            <span className="text-gradient">{t('home.title2')}</span>
          </h1>
          <p className="max-w-xl text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
            <Rich
              text={t('home.intro', { n: TOPICS.length })}
              tags={{
                code: (c) => <code className="font-mono text-sky-600 dark:text-sky-300">{c}</code>,
                hl: (c) => <span className="text-violet-600 dark:text-violet-300">{c}</span>,
              }}
            />
          </p>
          <div className="flex flex-wrap gap-3">
            {current && (
              <Link to={`/topic/${current.slug}`} className="btn-primary px-5 py-2.5 text-base">
                {started ? t('home.continue', { title: current.title }) : t('home.start')} <span aria-hidden>→</span>
              </Link>
            )}
            <Link to="/playground" className="btn-secondary px-5 py-2.5 text-base">{t('home.openPlayground')}</Link>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
            {[
              [t('home.stat.topics'), String(TOPICS.length)],
              [t('home.stat.questions'), String(total)],
              [t('home.stat.solved'), `${solved}`],
              [t('home.stat.streak'), streak ? `${t('home.streakDays', { n: streak })} 🔥` : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-mono text-[10px] tracking-[0.14em] text-zinc-500 uppercase">{k}</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Terminal />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {([
          { icon: '⌘', title: t('home.feature1.title'), text: t('home.feature1.text') },
          { icon: '✓', title: t('home.feature2.title'), text: t('home.feature2.text') },
          { icon: '◈', title: t('home.feature3.title'), text: t('home.feature3.text') },
        ]).map((f) => (
          <div key={f.title} className="panel p-5">
            <span className="grid size-9 place-items-center rounded-lg bg-linear-to-br from-sky-500/20 to-violet-500/20 font-mono text-lg text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-300">{f.icon}</span>
            <h2 className="mt-3 font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="space-y-10">
        <div className="flex flex-wrap items-end gap-6">
          <div className="mr-auto space-y-1">
            <p className="eyebrow">{t('home.path.eyebrow')}</p>
            <h2 className="text-3xl font-semibold tracking-tight">{t('home.path.title')}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Ring pct={pct} />
              <span className="absolute inset-0 grid place-items-center font-mono text-sm font-semibold">{pct}%</span>
            </div>
            <div className="text-sm">
              <div className="font-medium">{t('common.solvedOf', { solved, total })}</div>
              <div className="flex gap-2 text-zinc-500">
                <Link to="/review" className="hover:text-sky-500">{t('nav.review')}</Link>·<Link to="/exam" className="hover:text-sky-500">{t('exam.title')}</Link>
              </div>
            </div>
          </div>
        </div>

        {STAGES.map((stage) => {
          const topics = TOPICS.filter((x) => x.id >= stage.from && x.id <= stage.to);
          const st = topics.map((x) => stats.get(x.id)!);
          const sTotal = st.reduce((s, x) => s + x.total, 0);
          const sSolved = st.reduce((s, x) => s + x.solved, 0);
          return (
            <div key={stage.n} className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
              <div className="lg:pt-2">
                <div className="flex items-center gap-3 lg:block">
                  <span className="font-mono text-xs text-zinc-400 uppercase">{t('home.stage', { n: stage.n })}</span>
                  <h3 className="text-lg font-semibold lg:mt-1">{t(`home.stage${stage.n}.name`)}</h3>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{t(`home.stage${stage.n}.tagline`)}</p>
                <p className="mt-2 font-mono text-xs text-zinc-500">{t('common.solvedOf', { solved: sSolved, total: sTotal })}</p>
              </div>
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {topics.map((topic) => {
                  const s = stats.get(topic.id)!;
                  const done = s.total > 0 && s.solved === s.total;
                  const isCurrent = current?.id === topic.id;
                  return (
                    <li key={topic.id}>
                      <Link
                        to={`/topic/${topic.slug}`}
                        className={`panel panel-hover group relative block h-full overflow-hidden p-4 ${isCurrent ? 'border-sky-400/70 ring-1 ring-sky-500/30 dark:border-sky-500/50' : ''}`}
                      >
                        <span aria-hidden className="pointer-events-none absolute -top-3 -right-1 font-mono text-6xl font-bold text-zinc-900/[0.04] transition group-hover:text-sky-500/10 dark:text-white/[0.04]">
                          {String(topic.id).padStart(2, '0')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-sky-600 dark:text-sky-400">{String(topic.id).padStart(2, '0')}</span>
                          {done && <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-600 uppercase dark:text-emerald-400">{t('home.badge.done')}</span>}
                          {isCurrent && !done && <span className="rounded-full bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-600 uppercase dark:text-sky-300">{started ? t('home.badge.continue') : t('home.badge.startHere')}</span>}
                        </div>
                        <h4 className="mt-1 font-semibold">{topic.title}</h4>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{topic.summary}</p>
                        <div className="mt-4 flex items-center gap-2">
                          <div className="flex flex-1 gap-0.5" role="progressbar" aria-valuenow={s.solved} aria-valuemin={0} aria-valuemax={s.total} aria-label={t('home.progressAria', { title: topic.title })}>
                            {Array.from({ length: s.total }, (_, i) => (
                              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s.solved ? 'bg-linear-to-r from-sky-500 to-violet-500' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                            ))}
                          </div>
                          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{s.solved}/{s.total}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </section>
    </div>
  );
}
