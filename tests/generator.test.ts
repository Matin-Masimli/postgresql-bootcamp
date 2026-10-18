import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { buildDataset } from '../scripts/db/datasets.ts';
import { TABLE_ORDER } from '../scripts/db/generate.ts';

describe('data generator', () => {
  const main1 = buildDataset('main');
  const main2 = buildDataset('main');
  const hidden = buildDataset('hidden');

  it('is deterministic: same seed → identical content', () => {
    expect(main2.contentHash).toBe(main1.contentHash);
    expect(buildDataset('hidden').contentHash).toBe(hidden.contentHash);
  });

  it('produces different main and hidden data', () => {
    expect(hidden.contentHash).not.toBe(main1.contentHash);
    for (const t of ['customers', 'orders', 'order_items', 'user_logins'] as const) {
      expect(hidden.csv[t]).not.toBe(main1.csv[t]);
    }
  });

  it('keeps reference tables identical across datasets (as sets of rows)', () => {
    for (const t of ['countries', 'categories', 'departments'] as const) {
      const a = main1.csv[t].trim().split('\n').sort();
      const b = hidden.csv[t].trim().split('\n').sort();
      expect(b).toEqual(a);
    }
  });

  it('has every table populated and within the planned volume', () => {
    const total = TABLE_ORDER.reduce((s, t) => s + main1.data[t].rows.length, 0);
    for (const t of TABLE_ORDER) expect(main1.data[t].rows.length, t).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(20_000);
    expect(total).toBeLessThan(60_000);
  });

  it('matches the built snapshots (run `npm run build:db` if this fails)', () => {
    const path = 'public/db/manifest.json';
    expect(existsSync(path), 'manifest missing — run npm run build:db').toBe(true);
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    expect(manifest.datasets.main.contentHash).toBe(main1.contentHash);
    expect(manifest.datasets.hidden.contentHash).toBe(hidden.contentHash);
  });
});
