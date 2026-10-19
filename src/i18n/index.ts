// Interface language: a tiny store (localStorage-backed) plus typed dictionaries.
// English (en.ts) is the source of truth; every other language must provide every key (enforced by TypeScript).
import { useSyncExternalStore } from 'react';
import type { Msg } from '../engine/types.ts';
import { az } from './az.ts';
import { en, type Dict, type Key, type Params } from './en.ts';

export type Locale = 'en' | 'az';
export const LOCALES: { id: Locale; label: string; name: string }[] = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'az', label: 'AZ', name: 'Azərbaycanca' },
];

const KEY = 'pgb.lang';
const DICTS: Record<Locale, Dict> = { en, az };
const listeners = new Set<() => void>();

function initial(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'az') return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && /^az\b/i.test(navigator.language) ? 'az' : 'en';
}

let current: Locale = typeof window === 'undefined' ? 'en' : initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function getLocale(): Locale {
  return current;
}

export function setLocale(l: Locale) {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* the choice still applies for this visit */
  }
  document.documentElement.lang = l;
  for (const fn of listeners) fn();
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

/** Formats a number the way the language writes it (1,234 vs 1 234). */
export function fmtNumber(n: number, locale: Locale = current): string {
  return n.toLocaleString(locale === 'az' ? 'az-Latn-AZ' : 'en-US');
}

function render(locale: Locale, key: string, params: Params = {}): string {
  const entry = (DICTS[locale] as Record<string, Dict[Key]>)[key] ?? (en as Record<string, Dict[Key]>)[key];
  if (entry === undefined) return key;
  const p: Params = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'number' ? fmtNumber(v, locale) : v]));
  const text = typeof entry === 'function' ? entry(params, p) : entry;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in p ? String(p[name]) : m));
}

export interface Translator {
  (key: Key, params?: Params): string;
  /** Renders an engine message, falling back to its English text when there is none. */
  msg: (m: Msg | undefined, fallback?: string) => string;
  locale: Locale;
}

export function translator(locale: Locale): Translator {
  const t = ((key: Key, params?: Params) => render(locale, key, params)) as Translator;
  t.msg = (m, fallback = '') => (m ? render(locale, m.key, m.params) : fallback);
  t.locale = locale;
  return t;
}

const cache = new Map<Locale, Translator>();
/** The translator for the current interface language (re-renders when it changes). */
export function useT(): Translator {
  const locale = useLocale();
  let t = cache.get(locale);
  if (!t) cache.set(locale, (t = translator(locale)));
  return t;
}
