// Translations of the course content. A translation only replaces prose (titles, prompts, hints,
// explanations, common mistakes, text options); every piece of SQL, every reference solution and
// every grading setting comes from the English topic files, so checking is identical in all languages.
import type { Question, Topic } from './types.ts';

export interface QuestionText {
  title: string;
  prompt: string;
  hints: string[];
  explanation: string;
  commonMistakes: string[];
  /** Concept questions only: the text of each option, in the same order. */
  options?: string[];
}

export interface TopicText {
  explanation: string;
  questions: Record<string, QuestionText>;
}

export interface ContentPack {
  /** Topic titles and one-line summaries, by topic id. */
  meta: Record<number, { title: string; summary: string }>;
  /** Fully translated topics. Topics missing here are shown in English. */
  topics: Partial<Record<number, TopicText>>;
  /** Database comments: "table" or "table.column" → description. Names themselves are never translated. */
  schema: Record<string, string>;
}

export function localizeQuestion<Q extends Question>(q: Q, t: QuestionText | undefined): Q {
  if (!t) return q;
  const base = { ...q, title: t.title, prompt: t.prompt, hints: t.hints, explanation: t.explanation, commonMistakes: t.commonMistakes };
  if (q.type === 'concept-mc' && t.options) {
    return { ...base, options: q.options.map((o, i) => ({ ...o, text: t.options![i] ?? o.text })) } as Q;
  }
  return base as Q;
}

export function localizeTopic(topic: Topic, t: TopicText | undefined): Topic {
  if (!t) return topic;
  return { ...topic, explanation: t.explanation, questions: topic.questions.map((q) => localizeQuestion(q, t.questions[q.id])) };
}
