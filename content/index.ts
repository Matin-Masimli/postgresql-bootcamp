// Registry of topic content. Add each topic file here when it is written.
import type { Question, Topic } from './types.ts';
import t03 from './topics/03-dml.ts';
import t04 from './topics/04-filtering.ts';
import t12 from './topics/12-null-functions.ts';

export const TOPIC_CONTENT: Topic[] = [t03, t04, t12];

const byId = new Map(TOPIC_CONTENT.map((t) => [t.id, t]));
export const topicContent = (id: number): Topic | undefined => byId.get(id);

export const ALL_QUESTIONS: Question[] = TOPIC_CONTENT.flatMap((t) => t.questions);
const questionById = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
export const getQuestion = (id: string): Question | undefined => questionById.get(id);
