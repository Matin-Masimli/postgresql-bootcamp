// Azərbaycanca məzmun paketi. Tərcümə olunmayan mövzular ingiliscə göstərilir.
import type { ContentPack } from '../i18n.ts';
import meta from './meta.ts';
import schema from './schema.ts';
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

const pack: ContentPack = {
  meta,
  topics: { 1: t01, 2: t02, 3: t03, 4: t04, 5: t05, 6: t06, 7: t07, 8: t08, 9: t09, 10: t10, 11: t11, 12: t12, 13: t13, 14: t14, 15: t15, 16: t16 },
  schema,
};

export default pack;
