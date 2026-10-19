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

const pack: ContentPack = {
  meta,
  topics: { 1: t01, 2: t02, 3: t03, 4: t04, 5: t05, 6: t06, 7: t07, 8: t08, 9: t09, 10: t10 },
  schema,
};

export default pack;
