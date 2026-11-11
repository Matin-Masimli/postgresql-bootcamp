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

function topicStats(t: TopicMeta, p: ProgressData, content: Content) {
  const qs = content.topic(t.id)?.questions ?? [];
  const solved = qs.filter((q) => p.questions[q.id]?.solved).length;
  const attempted = qs.filter((q) => (p.questions[q.id]?.attempts ?? 0) > 0).length;
  return { total: qs.length, solved, attempted };
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

  const features = [
    { icon: ICONS.database, tint: 'text-sky-600 bg-sky-600/10 dark:text-sky-400 dark:bg-sky-400/15', title: t('home.feature1.title'), text: t('home.feature1.text') },
    { icon: ICONS.shield, tint: 'text-emerald-600 bg-emerald-500/12 dark:text-emerald-500 dark:bg-emerald-500/15', title: t('home.feature2.title'), text: t('home.feature2.text') },
    { icon: ICONS.tree, tint: 'text-violet-600 bg-violet-500/12 dark:text-[#d99cf5] dark:bg-violet-500/20', title: t('home.feature3.title'), text: t('home.feature3.text') },
  ];

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* ── Hero ── */}
      <section className="space-y-14 pt-4 text-center sm:pt-10">
        <div className="animate-fade-up mx-auto max-w-4xl space-y-6">
          <p className="eyebrow text-[15px]">{t('home.eyebrow')}</p>
          <h1 className="text-[2.75rem] leading-[1.04] font-bold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[5rem]">
            {t('home.title1')}
            <span className="block text-zinc-400 dark:text-zinc-500">{t('home.title2')}</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-zinc-600 sm:text-[21px] dark:text-zinc-400">
            <Rich
              text={t('home.intro', { n: TOPICS.length })}
              tags={{
                code: (c) => <code className="font-mono text-[0.9em] text-zinc-900 dark:text-white">{c}</code>,
                hl: (c) => <span className="font-medium text-zinc-900 dark:text-white">{c}</span>,
              }}
            />
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-2">
            {current && (
              <Link to={`/topic/${current.slug}`} className="btn-primary px-6 py-3 text-[17px]">
                {started ? t('home.continue', { title: current.title }) : t('home.start')}
              </Link>
            )}
            <Link to="/playground" className="link text-[17px]">{t('home.openPlayground')} <span aria-hidden>›</span></Link>
          </div>
        </div>
        <div className="animate-fade-up [animation-delay:120ms]">
          <Terminal />
        </div>
        <dl className="animate-fade-up mx-auto grid max-w-3xl grid-cols-2 gap-y-8 pt-6 [animation-delay:200ms] sm:grid-cols-4">
          {[
            [t('home.stat.topics'), String(TOPICS.length)],
            [t('home.stat.questions'), String(total)],
            [t('home.stat.solved'), `${solved}`],
            [t('home.stat.streak'), streak ? t('home.streakDays', { n: streak }) : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col-reverse items-center gap-1">
              <dt className="text-[14px] text-zinc-500">{k}</dt>
              <dd className="font-display text-4xl font-semibold tracking-[-0.03em] tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Features ── */}
      <section className="grid gap-5 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="panel space-y-4 p-7 sm:p-8">
            <span className={`grid size-12 place-items-center rounded-2xl ${f.tint}`}>
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
            </span>
            <h2 className="text-2xl font-semibold tracking-[-0.025em]">{f.title}</h2>
            <p className="text-zinc-600 dark:text-zinc-400">{f.text}</p>
          </div>
        ))}
      </section>

      {/* ── The path ── */}
      <section className="space-y-14">
        <div className="flex flex-wrap items-end gap-6">
          <div className="mr-auto space-y-2">
            <p className="eyebrow text-[15px]">{t('home.path.eyebrow')}</p>
            <h2 className="text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">{t('home.path.title')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Ring pct={pct} />
              <span className="absolute inset-0 grid place-items-center text-[13px] font-semibold tabular-nums">{pct}%</span>
            </div>
            <div>
              <div className="font-semibold">{t('common.solvedOf', { solved, total })}</div>
              <div className="flex gap-4 text-[15px]">
                <Link to="/review" className="link">{t('nav.review')} ›</Link>
                <Link to="/exam" className="link">{t('exam.title')} ›</Link>
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
            <div key={stage.n} className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <div className="space-y-1.5 lg:pt-3">
                <p className="text-[13px] font-semibold text-zinc-500">{t('home.stage', { n: stage.n })}</p>
                <h3 className="text-2xl font-semibold tracking-[-0.025em]">{t(`home.stage${stage.n}.name`)}</h3>
                <p className="text-[15px] text-zinc-600 dark:text-zinc-400">{t(`home.stage${stage.n}.tagline`)}</p>
                <p className="pt-1 text-[13px] text-zinc-500 tabular-nums">{t('common.solvedOf', { solved: sSolved, total: sTotal })}</p>
              </div>
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {topics.map((topic) => {
                  const s = stats.get(topic.id)!;
                  const done = s.total > 0 && s.solved === s.total;
                  const isCurrent = current?.id === topic.id;
                  return (
                    <li key={topic.id}>
                      <Link
                        to={`/topic/${topic.slug}`}
                        className={`panel panel-hover flex h-full flex-col p-5 ${isCurrent ? '!ring-2 !ring-sky-600 dark:!ring-sky-500' : ''}`}
                      >
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className="font-semibold text-zinc-400 tabular-nums">{String(topic.id).padStart(2, '0')}</span>
                          {done && <span className="rounded-full bg-emerald-500/15 px-2 py-px text-[12px] font-semibold text-emerald-700 dark:text-emerald-500">{t('home.badge.done')}</span>}
                          {isCurrent && !done && <span className="rounded-full bg-sky-600/10 px-2 py-px text-[12px] font-semibold text-sky-700 dark:bg-sky-400/15 dark:text-sky-400">{started ? t('home.badge.continue') : t('home.badge.startHere')}</span>}
                        </div>
                        <h4 className="mt-2 text-[19px] font-semibold tracking-[-0.02em]">{topic.title}</h4>
                        <p className="mt-1 flex-1 text-[14px] leading-snug text-zinc-600 dark:text-zinc-400">{topic.summary}</p>
                        <div className="mt-5 flex items-center gap-3">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.1]" role="progressbar" aria-valuenow={s.solved} aria-valuemin={0} aria-valuemax={s.total} aria-label={t('home.progressAria', { title: topic.title })}>
                            <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-sky-600 dark:bg-sky-500'}`} style={{ width: `${s.total ? (s.solved / s.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[12px] text-zinc-500 tabular-nums">{s.solved}/{s.total}</span>
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
