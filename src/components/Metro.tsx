import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { useT } from '../i18n/index.ts';
import {
  DRAW_DUR, DRAW_START, DRAW_STEP, LINE_PATHS, LINES, MAP_H, MAP_W, TRANSFERS,
  lineVars, stationDelay, stationPoint, type Line, type Station,
} from '../lib/metro.ts';

const WORD_JOINER = String.fromCharCode(0x2060);
const vars = (o: Record<string, string>) => o as CSSProperties;

/** The line's number on a tile in the line's colour. Size comes from the className (size-* and text-*). */
export function LineBadge({ n, className = 'size-7 text-[15px]' }: { n: number; className?: string }) {
  return <span aria-hidden className={`line-badge ${className}`} style={lineVars(n)}>{n}</span>;
}

function Check({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

/**
 * A station: white with a ring in the line colour when not started, tinted while in progress,
 * filled with a check once every question is solved. "Here" adds a ring that keeps pulsing outward.
 * Needs `--lc` / `--lc-ink` from an ancestor (lineVars).
 */
export function StationDot({ s, here = false, size = 28, numbered = true, className = '', style }: {
  s: Station; here?: boolean; size?: number; numbered?: boolean; className?: string; style?: CSSProperties;
}) {
  const ring = Math.max(2.5, Math.round(size / 9));
  const look = s.state === 'done'
    ? 'bg-(--lc) text-(--lc-ink)'
    : s.state === 'progress'
      ? 'bg-[color-mix(in_srgb,var(--lc)_24%,var(--station))] text-zinc-900 dark:text-white'
      : 'bg-(--station) text-zinc-700 dark:text-zinc-200';
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full font-display leading-none font-extrabold tabular-nums ${look} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), boxShadow: s.state === 'done' ? undefined : `inset 0 0 0 ${ring}px var(--lc)`, paddingTop: size * 0.06, ...style }}
    >
      {here && <span aria-hidden className="here-ring pointer-events-none absolute inset-0 rounded-full border-2 border-(--lc)" />}
      {s.state === 'done' ? <Check size={Math.round(size * 0.55)} /> : numbered ? s.topic.id : null}
    </span>
  );
}

/** Words for a station's state, for screen readers and tooltips. */
function useStateText() {
  const t = useT();
  return (s: Station, here: boolean) =>
    [here ? t('home.legend.here') : null, t(`home.legend.${s.state}`), s.total ? t('common.solvedOf', { solved: s.solved, total: s.total }) : null]
      .filter(Boolean)
      .join(' · ');
}

/** Where each line's name sign sits: above its first station, pointing the way the line runs. */
const SIGNS: Record<number, { at: number; align: 'start' | 'end' }> = {
  1: { at: 1, align: 'start' },
  2: { at: 5, align: 'start' },
  3: { at: 8, align: 'end' },
  4: { at: 14, align: 'start' },
  5: { at: 19, align: 'start' },
};

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * The course map. Lines are SVG paths that draw themselves in (once per visit, when `animate`);
 * stations, labels and signs are HTML laid over the drawing so they stay crisp, focusable and
 * readable at any width. Shown from lg up; narrower screens get the line boards instead.
 */
export function MetroMap({ stations, current, animate }: { stations: Station[]; current?: Station; animate: boolean }) {
  const t = useT();
  const stateText = useStateText();
  return (
    <div className={`relative ${animate ? 'metro-animate' : ''}`}>
      <div aria-hidden className="map-paper pointer-events-none absolute -inset-y-12 inset-x-0" />
      <nav aria-label={t('home.mapAria')} className="relative" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
          {LINES.map((l, i) => (
            <path
              key={l.n}
              d={LINE_PATHS[l.n]}
              pathLength={1}
              className="metro-line"
              fill="none"
              stroke={`var(--line-${l.n})`}
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={vars({ '--d': `${DRAW_START + i * DRAW_STEP}ms`, '--dur': `${DRAW_DUR}ms` })}
            />
          ))}
          {/* Transfers: the white interchange rings where one line hands over to the next. */}
          {TRANSFERS.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={10}
              strokeWidth={4}
              className="metro-fade fill-(--station) stroke-zinc-900 dark:stroke-white"
              style={vars({ '--d': `${DRAW_START + (i + 1) * DRAW_STEP}ms` })}
            />
          ))}
        </svg>

        {LINES.map((l) => {
          const sign = SIGNS[l.n];
          const p = stationPoint(sign.at);
          return (
            <div
              key={l.n}
              aria-hidden
              className={`metro-label absolute flex items-center gap-2 whitespace-nowrap ${sign.align === 'end' ? 'flex-row-reverse' : ''}`}
              style={vars({
                left: pct(p.x, MAP_W),
                top: `calc(${pct(p.y, MAP_H)} - 3.25rem)`,
                translate: sign.align === 'end' ? 'calc(-100% + 16px) 0' : '-16px 0',
                '--d': `${DRAW_START + (l.n - 1) * DRAW_STEP}ms`,
              })}
            >
              <LineBadge n={l.n} className="size-7 text-[15px]" />
              <span className="font-display text-[15px] font-bold tracking-[-0.01em]">{t(`home.stage${l.n}.name`)}</span>
            </div>
          );
        })}

        <ol>
          {stations.map((s) => {
            const p = stationPoint(s.topic.id);
            const here = current?.topic.id === s.topic.id;
            const d = `${Math.round(stationDelay(s.topic.id))}ms`;
            const edge = p.x < 200 ? 'start' : p.x > 1000 ? 'end' : 'center';
            const tipPos = edge === 'start' ? '-left-5 origin-bottom-left' : edge === 'end' ? '-right-5 origin-bottom-right' : 'left-0 -translate-x-1/2 origin-bottom';
            return (
              <li key={s.topic.id} className="absolute" style={{ left: pct(p.x, MAP_W), top: pct(p.y, MAP_H), ...lineVars(s.line.n) }}>
                <Link to={`/topic/${s.topic.slug}`} className="group relative block outline-none" aria-label={`${s.topic.id}. ${s.topic.title} — ${stateText(s, here)}`}>
                  <span className="metro-station absolute grid -translate-1/2 place-items-center" style={vars({ '--d': d })}>
                    <StationDot
                      s={s}
                      here={here}
                      size={here ? 34 : 28}
                      className="vt-station vt-station-lg transition-[scale] duration-200 ease-(--ease-out) group-hover:scale-[1.12] group-active:scale-95 group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-sky-600/60"
                      style={vars({ '--vt': `station-${s.topic.id}` })}
                    />
                  </span>
                  <span
                    aria-hidden
                    className={`metro-label absolute left-0 w-[7.25rem] -translate-x-1/2 text-center text-[13px] leading-[1.25] font-semibold text-balance transition-colors duration-200 xl:w-[8.5rem] ${here ? 'top-[24px] text-zinc-950 dark:text-white' : 'top-[21px] text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white'}`}
                    style={vars({ '--d': d })}
                  >
                    {/* A word joiner after each hyphen keeps "JOIN-lər" whole; labels are narrow. */}
                    {s.topic.title.replace(/-/g, `-${WORD_JOINER}`)}
                    {here && <span className={`mx-auto mt-1.5 block w-fit rounded-full bg-(--lc) px-2 py-0.5 text-[11px] leading-4 font-bold text-(--lc-ink)`}>{t('home.legend.here')}</span>}
                  </span>
                  {/* Hover card: what the station holds and how far you are. Pointer only; the label carries it for everyone else. */}
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute bottom-[26px] z-30 w-64 translate-y-1 scale-[0.97] rounded-2xl bg-white p-4 text-left opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_18px_40px_-12px_rgb(0_0_0/0.3)] transition-[opacity,scale,translate] duration-200 ease-(--ease-out) group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 dark:bg-zinc-800 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_18px_40px_-12px_rgb(0_0_0/0.8)] ${tipPos}`}
                  >
                    <span className="flex items-center gap-2 text-[12px] font-semibold text-zinc-500">
                      <LineBadge n={s.line.n} className="size-5 text-[11px]" />
                      {t('home.stationOf', { n: s.topic.id, total: stations.length })}
                    </span>
                    <span className="mt-2 block font-display text-[16px] leading-snug font-bold">{s.topic.title}</span>
                    <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">{s.topic.summary}</span>
                    <span className="mt-3 flex items-center gap-2.5">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/[0.12]">
                        <span className="block h-full rounded-full bg-(--lc)" style={{ width: `${s.total ? (s.solved / s.total) * 100 : 0}%` }} />
                      </span>
                      <span className="text-[12px] text-zinc-500 tabular-nums">{s.solved}/{s.total}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

/** Phones and tablets: the network folded into five rows, one per line. A row takes you to its board. */
export function PocketMap({ stations, current }: { stations: Station[]; current?: Station }) {
  const t = useT();
  return (
    <ol aria-label={t('home.mapAria')} className="panel divide-y divide-black/[0.06] overflow-hidden dark:divide-white/[0.07]">
      {LINES.map((l) => {
        const on = stations.filter((s) => s.line.n === l.n);
        return (
          <li key={l.n} style={lineVars(l.n)}>
            <button
              type="button"
              onClick={() => document.getElementById(`line-${l.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 active:bg-black/[0.04] dark:active:bg-white/[0.06]"
            >
              <LineBadge n={l.n} className="size-6 text-[13px]" />
              <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-[-0.01em]">{t(`home.stage${l.n}.name`)}</span>
              <span aria-hidden className="flex items-center">
                {on.map((s, i) => (
                  <span key={s.topic.id} className="flex items-center">
                    {i > 0 && <span className="h-[3px] w-2.5 bg-(--lc)" />}
                    <StationDot s={s} here={current?.topic.id === s.topic.id} size={14} numbered={false} />
                  </span>
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** The key under the map: one sample station per state. */
export function MapLegend() {
  const t = useT();
  const sample = (state: Station['state']): Station => ({ topic: { id: 0, slug: '', title: '', summary: '' }, line: LINES[0], total: 1, solved: 0, attempted: 0, state });
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-zinc-600 dark:text-zinc-400" style={lineVars(1)}>
      {(['todo', 'progress', 'done'] as const).map((k) => (
        <li key={k} className="flex items-center gap-2"><StationDot s={sample(k)} size={16} numbered={false} />{t(`home.legend.${k}`)}</li>
      ))}
      <li className="flex items-center gap-2">
        <span className="relative grid size-4 place-items-center"><span className="absolute inset-0 rounded-full border-2 border-(--lc) opacity-50" /><span className="size-2 rounded-full bg-(--lc)" /></span>
        {t('home.legend.here')}
      </li>
    </ul>
  );
}

/**
 * One line as a station board: the line's colour as a sign across the top, then its stations on a
 * vertical route. This is the whole map on phones and tablets, and the detailed timetable on desktop.
 */
export function LineBoard({ line, stations, current }: { line: Line; stations: Station[]; current?: Station }) {
  const t = useT();
  const stateText = useStateText();
  const on = stations.filter((s) => s.line.n === line.n);
  const total = on.reduce((n, s) => n + s.total, 0);
  const solved = on.reduce((n, s) => n + s.solved, 0);
  return (
    <article id={`line-${line.n}`} className="panel mb-6 scroll-mt-20 break-inside-avoid overflow-hidden" style={lineVars(line.n)}>
      <header className="flex items-center gap-3 bg-(--lc) px-5 py-3.5 text-(--lc-ink)">
        <span className="grid size-8 place-items-center rounded-[0.5rem] bg-(--lc-ink) pt-[0.1em] font-display text-[17px] font-extrabold text-(--lc)">{line.n}</span>
        <h3 className="min-w-0 flex-1 truncate text-[19px] font-bold tracking-[-0.01em]">{t(`home.stage${line.n}.name`)}</h3>
        <span className="text-[13px] font-semibold tabular-nums opacity-80">{solved}/{total}</span>
      </header>
      <p className="px-5 pt-4 text-[15px] text-zinc-600 dark:text-zinc-400">{t(`home.stage${line.n}.tagline`)}</p>
      <ol className="px-3 pt-2 pb-3">
        {on.map((s, i) => {
          const here = current?.topic.id === s.topic.id;
          return (
            <li key={s.topic.id} className="relative">
              {/* The track between this station and the next. */}
              {i < on.length - 1 && <span aria-hidden className="absolute top-[30px] -bottom-[30px] left-[29px] w-[6px] -translate-x-1/2 bg-(--lc)" />}
              <Link
                to={`/topic/${s.topic.slug}`}
                className="group relative flex items-start gap-4 rounded-2xl px-3 py-3 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--lc)_7%,transparent)]"
                aria-label={`${s.topic.id}. ${s.topic.title} — ${stateText(s, here)}`}
              >
                <StationDot
                  s={s}
                  here={here}
                  size={30}
                  className="vt-station vt-station-sm mt-[0px] transition-[scale] duration-200 ease-(--ease-out) group-hover:scale-110"
                  style={vars({ '--vt': `station-${s.topic.id}` })}
                />
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display text-[17px] leading-snug font-bold tracking-[-0.01em]">{s.topic.title}</span>
                    {here && <span className="rounded-full bg-(--lc) px-2 py-px text-[11px] leading-4 font-bold text-(--lc-ink)">{t('home.legend.here')}</span>}
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-zinc-600 dark:text-zinc-400">{s.topic.summary}</span>
                  <span className="mt-2 flex items-center gap-2.5">
                    <span className="h-1 w-24 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.1]">
                      <span className="block h-full rounded-full bg-(--lc)" style={{ width: `${s.total ? (s.solved / s.total) * 100 : 0}%` }} />
                    </span>
                    <span className="text-[12px] text-zinc-500 tabular-nums">{t('common.solvedOf', { solved: s.solved, total: s.total })}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/** A compact "where am I": the line badge (back to the map) and the station (back to the topic). */
export function StationCrumb({ station, className = '' }: { station: Station; className?: string }) {
  const t = useT();
  return (
    <nav aria-label={t('nav.breadcrumb')} className={`flex min-w-0 items-center gap-2.5 text-[14px] text-zinc-500 ${className}`} style={lineVars(station.line.n)}>
      <Link to="/" className="shrink-0 rounded-[0.45em] transition-opacity hover:opacity-75" aria-label={t('common.topics')}>
        <LineBadge n={station.line.n} className="size-[22px] text-[12px]" />
      </Link>
      <Link to={`/topic/${station.topic.slug}`} className="group flex min-w-0 items-center gap-2 font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
        <StationDot s={station} size={22} className="vt-station" style={vars({ '--vt': `station-${station.topic.id}` })} />
        <span className="truncate">{station.topic.title}</span>
      </Link>
    </nav>
  );
}

/** The topic page's position marker: the line sign, then this line's stations with the current one large. */
export function LineStrip({ station, stations }: { station: Station; stations: Station[] }) {
  const t = useT();
  const line = station.line;
  const on = stations.filter((s) => s.line.n === line.n);
  const name = t(`home.stage${line.n}.name`);
  return (
    <nav aria-label={t('topic.lineAria', { name })} className="flex flex-wrap items-center gap-x-5 gap-y-3" style={lineVars(line.n)}>
      <Link to="/" className="flex items-center gap-2.5 rounded-full text-zinc-900 transition-opacity hover:opacity-75 dark:text-white">
        <LineBadge n={line.n} className="size-7 text-[15px]" />
        <span className="font-display text-[15px] font-bold tracking-[-0.01em]">{name}</span>
      </Link>
      <ol className="flex items-center">
        <li aria-hidden className="h-[5px] w-3 rounded-l-full bg-(--lc) opacity-40" />
        {on.map((s, i) => {
          const isHere = s.topic.id === station.topic.id;
          return (
            <li key={s.topic.id} className="flex items-center">
              {i > 0 && <span aria-hidden className="h-[5px] w-4 bg-(--lc) sm:w-7" />}
              {isHere ? (
                <span aria-current="step">
                  <StationDot s={s} size={34} className="vt-station" style={vars({ '--vt': `station-${s.topic.id}` })} />
                </span>
              ) : (
                <Link to={`/topic/${s.topic.slug}`} title={s.topic.title} aria-label={`${s.topic.id}. ${s.topic.title}`} className="group rounded-full">
                  <StationDot s={s} size={22} className="transition-[scale] duration-200 ease-(--ease-out) group-hover:scale-115" />
                </Link>
              )}
            </li>
          );
        })}
        <li aria-hidden className="h-[5px] w-3 rounded-r-full bg-(--lc) opacity-40" />
      </ol>
      <span className="text-[14px] text-zinc-500">{t('home.stationOf', { n: station.topic.id, total: stations.length })}</span>
    </nav>
  );
}
