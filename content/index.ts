// Registry of topic content. Add each topic file here when it is written.
import type { Question, Topic } from './types.ts';
import t01 from './topics/01-query-data.ts';
import t02 from './topics/02-ddl.ts';
import t03 from './topics/03-dml.ts';
import t04 from './topics/04-filtering.ts';
import t05 from './topics/05-joins-basics.ts';
import t06 from './topics/06-joins-advanced.ts';
import t07 from './topics/07-set-operators.ts';
import t08 from './topics/08-sql-functions.ts';
import t09 from './topics/09-string-functions.ts';
import t10 from './topics/10-numeric-functions.ts';
import t11 from './topics/11-date-time-functions.ts';
import t12 from './topics/12-null-functions.ts';
import t13 from './topics/13-case.ts';
import t14 from './topics/14-aggregate-functions.ts';
import t15 from './topics/15-window-basics.ts';
import t16 from './topics/16-window-aggregate.ts';
import t17 from './topics/17-window-ranking.ts';

export const TOPIC_CONTENT: Topic[] = [t01, t02, t03, t04, t05, t06, t07, t08, t09, t10, t11, t12, t13, t14, t15, t16, t17];

const byId = new Map(TOPIC_CONTENT.map((t) => [t.id, t]));
export const topicContent = (id: number): Topic | undefined => byId.get(id);

export const ALL_QUESTIONS: Question[] = TOPIC_CONTENT.flatMap((t) => t.questions);
const questionById = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
export const getQuestion = (id: string): Question | undefined => questionById.get(id);
