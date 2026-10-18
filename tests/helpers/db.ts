// Opens the built snapshots in Node with the same PracticeSession class the browser worker uses.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { PracticeSession } from '../../src/engine/session.ts';
import type { Dataset } from '../../src/engine/types.ts';

const manifest = JSON.parse(readFileSync('public/db/manifest.json', 'utf8'));

export async function openSession(db: Dataset): Promise<PracticeSession> {
  const blob = new Blob([readFileSync(`public/db/${manifest.datasets[db].file}`)]);
  const pg = await PGlite.create({ loadDataDir: blob });
  return PracticeSession.open(pg, manifest.datasets[db].sequences);
}

export async function openBoth(): Promise<Record<Dataset, PracticeSession>> {
  const [main, hidden] = await Promise.all([openSession('main'), openSession('hidden')]);
  return { main, hidden };
}
