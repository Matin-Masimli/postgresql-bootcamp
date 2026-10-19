// Azərbaycanca məzmun paketi. Tərcümə olunmayan mövzular ingiliscə göstərilir.
import type { ContentPack } from '../i18n.ts';
import meta from './meta.ts';
import schema from './schema.ts';
import t01 from './topics/01-query-data.ts';

const pack: ContentPack = {
  meta,
  topics: { 1: t01 },
  schema,
};

export default pack;
