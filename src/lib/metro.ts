import type { CSSProperties } from 'react';
import type { TopicMeta } from '../../content/topicList.ts';
import type { Content } from '../i18n/content.ts';
import type { ProgressData } from '../progress/store.ts';

/**
 * The course as a metro network. Each stage is a line; topic ids are inclusive ranges in
 * learning order, so line n runs from station `from` to station `to`.
 */
export const LINES = [
  { n: 1, from: 1, to: 4 },
  { n: 2, from: 5, to: 7 },
  { n: 3, from: 8, to: 13 },
  { n: 4, from: 14, to: 18 },
  { n: 5, from: 19, to: 21 },
] as const;
export type Line = (typeof LINES)[number];

export const lineOf = (topicId: number): Line => LINES.find((l) => topicId >= l.from && topicId <= l.to) ?? LINES[0];

/** CSS variables that colour anything inside with the line's colour (`--lc`) and its ink (`--lc-ink`). */
export const lineVars = (n: number): CSSProperties => ({ '--lc': `var(--line-${n})`, '--lc-ink': `var(--line-${n}-ink)` }) as CSSProperties;

export type StationState = 'todo' | 'progress' | 'done';
export interface Station {
  topic: TopicMeta;
  line: Line;
  total: number;
  solved: number;
  attempted: number;
  state: StationState;
}

export function stationsFor(topics: TopicMeta[], p: ProgressData, content: Content): Station[] {
  return topics.map((topic) => {
    const qs = content.topic(topic.id)?.questions ?? [];
    const solved = qs.filter((q) => p.questions[q.id]?.solved).length;
    const attempted = qs.filter((q) => (p.questions[q.id]?.attempts ?? 0) > 0).length;
    const state: StationState = qs.length > 0 && solved === qs.length ? 'done' : solved > 0 || attempted > 0 ? 'progress' : 'todo';
    return { topic, line: lineOf(topic.id), total: qs.length, solved, attempted, state };
  });
}

/** "You are here": the first station started but not finished, else the first unfinished one. */
export function currentStation(stations: Station[]): Station | undefined {
  return stations.find((s) => s.state === 'progress') ?? stations.find((s) => s.state !== 'done');
}

/* ───────────── map geometry ─────────────
 * A schematic in a 1180 × 560 box: three rows of seven stations, run as a snake
 * (left→right, right→left, left→right) joined by 45° bends, the way transit maps
 * turn corners. Lines change colour at transfer points halfway between stations.
 */
export const MAP_W = 1180;
export const MAP_H = 560;
const X0 = 150;
const STEP = 150;
const ROWS = [80, 270, 460];

export function stationPoint(id: number): { x: number; y: number; row: number } {
  const i = id - 1;
  const row = Math.floor(i / 7);
  const col = i % 7;
  const x = row === 1 ? X0 + (6 - col) * STEP : X0 + col * STEP;
  return { x, y: ROWS[row], row };
}

/** Each line's path; corners are 45° chamfers with a small rounding, transfers sit midway. */
export const LINE_PATHS: Record<number, string> = {
  1: 'M150 80 H675',
  2: 'M675 80 H1098 Q1110 80 1118.5 88.5 L1141.5 111.5 Q1150 120 1150 132 V175',
  3: 'M1150 175 V218 Q1150 230 1141.5 238.5 L1118.5 261.5 Q1110 270 1098 270 H225',
  4: 'M225 270 H92 Q80 270 71.5 278.5 L48.5 301.5 Q40 310 40 322 V408 Q40 420 48.5 428.5 L71.5 451.5 Q80 460 92 460 H675',
  5: 'M675 460 H1050',
};
/** Transfer points between consecutive lines (after line 1, 2, 3, 4). */
export const TRANSFERS = [
  { x: 675, y: 80 },
  { x: 1150, y: 175 },
  { x: 225, y: 270 },
  { x: 675, y: 460 },
];

/* Timing of the draw-in (choreograph: one orchestrated hero moment, lines in sequence,
   each starting as the previous one is half drawn; stations land as their line reaches them). */
export const DRAW_START = 150;
export const DRAW_STEP = 300;
export const DRAW_DUR = 600;
export function stationDelay(id: number): number {
  const line = lineOf(id);
  const span = line.to - line.from + 1;
  const frac = (id - line.from + 0.5) / span;
  return DRAW_START + (line.n - 1) * DRAW_STEP + frac * DRAW_DUR;
}
export const DRAW_END = DRAW_START + (LINES.length - 1) * DRAW_STEP + DRAW_DUR;
