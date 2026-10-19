// The course content in the current interface language. English is bundled; the Azerbaijani pack is
// loaded on demand (its own chunk), and topics it doesn't translate yet fall back to English.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { TOPIC_CONTENT } from '../../content/index.ts';
import { localizeTopic, type ContentPack } from '../../content/i18n.ts';
import { TOPICS, type TopicMeta } from '../../content/topicList.ts';
import type { Question, Topic } from '../../content/types.ts';
import { useLocale, type Locale } from './index.ts';

const packs = new Map<Locale, ContentPack>();
const loading = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

const LOADERS: Partial<Record<Locale, () => Promise<{ default: ContentPack }>>> = {
  az: () => import('../../content/az/index.ts'),
};

function load(locale: Locale) {
  const loader = LOADERS[locale];
  if (!loader || packs.has(locale) || loading.has(locale)) return;
  loading.set(
    locale,
    loader()
      .then((m) => {
        packs.set(locale, m.default);
        version++;
        for (const fn of listeners) fn();
      })
      .catch(() => {
        loading.delete(locale);
      }),
  );
}

export interface Content {
  topics: TopicMeta[];
  topic: (id: number) => Topic | undefined;
  question: (id: string) => Question | undefined;
  allQuestions: Question[];
  /** False while a translation pack is still loading, or for topics that aren't translated yet. */
  isTranslated: (topicId: number) => boolean;
  /** Translated database comment for a table ("orders") or column ("orders.status"), else the original. */
  schemaComment: (key: string, original: string | null) => string | null;
}

function build(pack: ContentPack | undefined): Content {
  const topics = TOPICS.map((t) => (pack?.meta[t.id] ? { ...t, ...pack.meta[t.id] } : t));
  const content = TOPIC_CONTENT.map((t) => localizeTopic(t, pack?.topics[t.id]));
  const byId = new Map(content.map((t) => [t.id, t]));
  const allQuestions = content.flatMap((t) => t.questions);
  const qById = new Map(allQuestions.map((q) => [q.id, q]));
  return {
    topics,
    topic: (id) => byId.get(id),
    question: (id) => qById.get(id),
    allQuestions,
    isTranslated: (id) => !pack || pack.topics[id] !== undefined,
    schemaComment: (key, original) => pack?.schema[key] ?? original,
  };
}

const english = build(undefined);
const built = new Map<string, Content>();

export function useContent(): Content {
  const locale = useLocale();
  const v = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
  useEffect(() => load(locale), [locale]);
  return useMemo(() => {
    if (locale === 'en') return english;
    const pack = packs.get(locale);
    if (!pack) return { ...english, isTranslated: () => false };
    const key = `${locale}:${v}`;
    let c = built.get(key);
    if (!c) built.set(key, (c = build(pack)));
    return c;
  }, [locale, v]);
}
