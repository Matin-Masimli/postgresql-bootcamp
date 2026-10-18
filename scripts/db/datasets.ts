import { createHash } from 'node:crypto';
import { generate, TABLE_ORDER, type Dataset, type TableData } from './generate.ts';

export const DATASETS = [
  { name: 'main', seed: 'atlas-main-v1', scale: 1, shufflePhysicalOrder: false },
  { name: 'hidden', seed: 'atlas-hidden-v1', scale: 0.6, shufflePhysicalOrder: true },
] as const;
export type DatasetName = (typeof DATASETS)[number]['name'];

/** RFC 4180 CSV; NULL = unquoted empty field, '' = quoted empty field (PostgreSQL COPY csv semantics). */
export function toCsv(t: TableData): string {
  const out: string[] = [];
  for (const row of t.rows) {
    out.push(row.map((v) => (v == null ? '' : `"${v.replace(/"/g, '""')}"`)).join(','));
  }
  return out.join('\n') + (out.length ? '\n' : '');
}

export function buildDataset(name: DatasetName): { data: Dataset; csv: Record<string, string>; contentHash: string } {
  const spec = DATASETS.find((d) => d.name === name)!;
  const data = generate(spec);
  const csv: Record<string, string> = {};
  const h = createHash('sha256');
  for (const t of TABLE_ORDER) {
    csv[t] = toCsv(data[t]);
    h.update(`${t}\n${data[t].columns.join(',')}\n${csv[t]}`);
  }
  return { data, csv, contentHash: h.digest('hex') };
}
