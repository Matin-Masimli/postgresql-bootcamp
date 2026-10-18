import type { TableMeta } from '../lib/manifest.ts';

// Hand-tuned grid placement: [column, row]. Related tables sit next to each other.
const LAYOUT: Record<string, [number, number]> = {
  salary_history: [0, 0], employees: [1, 0], departments: [2, 0], user_logins: [3, 0],
  countries: [0, 1], customers: [1, 1], orders: [2, 1], payments: [3, 1],
  suppliers: [0, 2], products: [1, 2], order_items: [2, 2], shipments: [3, 2],
  categories: [0, 3], reviews: [1, 3], returns: [2, 3], staging_customer_import: [3, 3],
};
const BOX_W = 184;
const COL_GAP = 76;
const ROW_GAP = 34;
const HEAD_H = 34;
const LINE_H = 17;
const PAD = 16;

interface Box { t: TableMeta; x: number; y: number; h: number; keys: { name: string; pk: boolean; fk: string | null }[] }

export default function ErDiagram({ tables, onSelect }: { tables: TableMeta[]; onSelect: (name: string) => void }) {
  const boxes = new Map<string, Box>();
  for (const t of tables) {
    const pk = new Set(t.constraints.filter((c) => c.type === 'p').flatMap((c) => c.columns));
    const fk = new Map(t.constraints.filter((c) => c.type === 'f').map((c) => [c.columns[0], c.refTable!]));
    const keys = t.columns.filter((c) => pk.has(c.name) || fk.has(c.name)).map((c) => ({ name: c.name, pk: pk.has(c.name), fk: fk.get(c.name) ?? null }));
    boxes.set(t.name, { t, x: 0, y: 0, h: HEAD_H + keys.length * LINE_H + 8, keys });
  }
  const rows = [0, 1, 2, 3];
  const rowHeight = rows.map((r) => Math.max(...[...boxes.values()].filter((b) => LAYOUT[b.t.name]?.[1] === r).map((b) => b.h)));
  for (const b of boxes.values()) {
    const [col, row] = LAYOUT[b.t.name] ?? [4, 0];
    b.x = PAD + col * (BOX_W + COL_GAP);
    b.y = PAD + rows.slice(0, row).reduce((s, r) => s + rowHeight[r] + ROW_GAP, 0);
  }
  const width = PAD * 2 + 4 * BOX_W + 3 * COL_GAP;
  const height = PAD * 2 + rowHeight.reduce((s, h) => s + h, 0) + ROW_GAP * 3;
  const keyY = (b: Box, col: string) => b.y + HEAD_H + b.keys.findIndex((k) => k.name === col) * LINE_H + LINE_H / 2 + 2;

  const edges: { d: string; key: string }[] = [];
  for (const b of boxes.values()) {
    for (const k of b.keys) {
      if (!k.fk) continue;
      const p = boxes.get(k.fk);
      if (!p) continue;
      const pkCol = p.keys.find((x) => x.pk)?.name ?? p.keys[0].name;
      const y1 = keyY(b, k.name);
      const y2 = keyY(p, pkCol);
      let d: string;
      if (p === b) {
        const x = b.x + BOX_W;
        d = `M${x},${y1} C${x + 34},${y1} ${x + 34},${y2} ${x},${y2}`;
      } else if (p.x === b.x) {
        const x = b.x;
        d = `M${x},${y1} C${x - 40},${y1} ${x - 40},${y2} ${x},${y2}`;
      } else {
        const right = p.x > b.x;
        const x1 = right ? b.x + BOX_W : b.x;
        const x2 = right ? p.x : p.x + BOX_W;
        const dx = Math.max(40, Math.abs(x2 - x1) / 2);
        d = `M${x1},${y1} C${x1 + (right ? dx : -dx)},${y1} ${x2 + (right ? -dx : dx)},${y2} ${x2},${y2}`;
      }
      edges.push({ d, key: `${b.t.name}.${k.name}` });
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block max-w-none" role="img" aria-label="Entity-relationship diagram of the practice database">
      <defs>
        <marker id="er-dot" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6">
          <circle cx="4" cy="4" r="3" className="fill-sky-600 dark:fill-sky-400" />
        </marker>
      </defs>
      <g fill="none" strokeWidth={1.4} className="stroke-sky-600/45 dark:stroke-sky-400/45">
        {edges.map((e) => (
          <path key={e.key} d={e.d} markerEnd="url(#er-dot)" />
        ))}
      </g>
      {[...boxes.values()].map((b) => (
        <g key={b.t.name} transform={`translate(${b.x},${b.y})`} className="cursor-pointer" onClick={() => onSelect(b.t.name)}>
          <title>{b.t.comment ?? b.t.name}</title>
          <rect width={BOX_W} height={b.h} rx={7} className="fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700" />
          <path d={`M0,7 a7,7 0 0 1 7,-7 h${BOX_W - 14} a7,7 0 0 1 7,7 v${HEAD_H - 9} h-${BOX_W} z`} className="fill-zinc-100 dark:fill-zinc-800" />
          <text x={10} y={15} className="fill-zinc-900 text-[12px] font-semibold dark:fill-zinc-100">{b.t.name}</text>
          <text x={10} y={28} className="fill-zinc-500 text-[10px]">{(b.t.rowCount.main ?? 0).toLocaleString()} rows</text>
          {b.keys.map((k, i) => (
            <text key={k.name} x={10} y={HEAD_H + i * LINE_H + 14} className="fill-zinc-700 font-mono text-[11px] dark:fill-zinc-300">
              <tspan className={k.pk ? 'fill-amber-600 dark:fill-amber-400' : 'fill-sky-700 dark:fill-sky-400'}>{k.pk ? 'PK ' : 'FK '}</tspan>
              {k.name}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}
