import { useEffect, useState } from 'react';

// Shape of public/db/manifest.json (written by scripts/db/build-snapshots.ts).
export interface ColumnMeta { name: string; type: string; nullable: boolean; default: string | null; identity: boolean; comment: string | null }
export interface ConstraintMeta { name: string; type: 'p' | 'f' | 'u' | 'c'; definition: string; columns: string[]; refTable: string | null; refColumns: string[] | null }
export interface TableMeta {
  name: string; comment: string | null; columns: ColumnMeta[]; constraints: ConstraintMeta[];
  indexes: { name: string; definition: string }[]; rowCount: Record<string, number>;
}
export interface DatasetMeta {
  file: string; seed: string; scale: number; contentHash: string; bytes: number; rowCount: Record<string, number>;
  sequences: { table: string; column: string; sequence: string; lastValue: number }[];
}
export interface Manifest {
  pgliteVersion: string; postgresVersion: string; referenceDate: string; dataStart: string; loginTrackingStart: string;
  datasets: Record<'main' | 'hidden', DatasetMeta>; tables: TableMeta[];
}

/** Resolve a file under public/ against the page (works under any GitHub Pages sub-path). */
export const publicUrl = (path: string) => new URL(path, document.baseURI).href;

let cache: Promise<Manifest> | null = null;
export function loadManifest(): Promise<Manifest> {
  cache ??= fetch(publicUrl('db/manifest.json')).then((r) => {
    if (!r.ok) throw new Error(`manifest.json: HTTP ${r.status} (did you run npm run build:db?)`);
    return r.json() as Promise<Manifest>;
  });
  return cache;
}

export function useManifest(): { manifest: Manifest | null; error: string | null } {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadManifest().then(
      (m) => live && setManifest(m),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  return { manifest, error };
}
