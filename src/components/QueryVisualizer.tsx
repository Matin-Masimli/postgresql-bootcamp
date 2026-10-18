import { useState } from 'react';
import { walk, type LogicalStep, type NodeKind, type PlanNode } from '../engine/plan.ts';
import type { Visualization } from '../lib/visualize.ts';
import { ErrorBox } from './RunResults.tsx';

const fmtRows = (n: number) => n.toLocaleString('en-US');
const fmtMs = (n: number) => (n >= 100 ? `${Math.round(n)} ms` : n >= 1 ? `${n.toFixed(1)} ms` : `${n.toFixed(2)} ms`);

const KIND: Record<NodeKind, { icon: string; label: string; tone: string; bar: string }> = {
  scan: { icon: '▤', label: 'read', tone: 'bg-cyan-500/15 text-cyan-600 ring-cyan-500/30 dark:text-cyan-300', bar: 'bg-cyan-500' },
  join: { icon: '⋈', label: 'join', tone: 'bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300', bar: 'bg-violet-500' },
  aggregate: { icon: 'Σ', label: 'combine', tone: 'bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300', bar: 'bg-amber-500' },
  sort: { icon: '⇅', label: 'order', tone: 'bg-sky-500/15 text-sky-600 ring-sky-500/30 dark:text-sky-300', bar: 'bg-sky-500' },
  modify: { icon: '✎', label: 'write', tone: 'bg-rose-500/15 text-rose-600 ring-rose-500/30 dark:text-rose-300', bar: 'bg-rose-500' },
  other: { icon: '◇', label: 'step', tone: 'bg-zinc-500/15 text-zinc-600 ring-zinc-500/30 dark:text-zinc-300', bar: 'bg-zinc-400' },
};

export default function QueryVisualizer({ viz }: { viz: Visualization }) {
  if (viz.error) {
    return (
      <div className="space-y-2">
        <ErrorBox error={viz.error} title={viz.error.code === 'VISUALIZE' ? 'Nothing to visualize' : undefined} />
        {viz.error.code !== 'VISUALIZE' && <p className="text-xs text-zinc-500">Fix the error first: the visualizer needs a query that runs.</p>}
      </div>
    );
  }
  if (!viz.plan || !viz.steps) return null;
  const { plan, steps } = viz;
  const nodes = walk(plan.root);
  const hottest = plan.analyzed ? nodes.reduce((a, b) => ((b.selfMs ?? 0) > (a.selfMs ?? 0) ? b : a)) : undefined;
  const totalMs = plan.executionMs ?? plan.root.totalMs ?? 0;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Metric label="output" value={`${fmtRows(plan.root.rows)} row${plan.root.rows === 1 ? '' : 's'}`} />
        {plan.analyzed && plan.executionMs !== undefined && <Metric label="execution" value={fmtMs(plan.executionMs)} />}
        {plan.planningMs !== undefined && <Metric label="planning" value={fmtMs(plan.planningMs)} />}
        <Metric label="plan steps" value={String(nodes.length)} />
        {!plan.analyzed && (
          <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300" title="This statement changes data, and Playground changes are kept, so it was planned but not run.">
            estimated only, not executed
          </span>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="eyebrow">1 · How SQL reads your query</h3>
        <p className="text-xs text-zinc-500">
          SQL is written SELECT-first but evaluated in this order. Bars show the rows coming out of each step{plan.analyzed ? '' : ' (estimated)'}.
        </p>
        <LogicalFlow steps={steps} />
      </section>

      <section className="space-y-2">
        <h3 className="eyebrow">2 · How PostgreSQL executes it</h3>
        <p className="text-xs text-zinc-500">
          The execution plan. Data flows <strong>upwards</strong>: the innermost steps read tables, and each step feeds the one above it.
        </p>
        <div className="panel overflow-x-auto p-2 sm:p-3">
          <PlanTree node={plan.root} depth={0} totalMs={totalMs} hottest={hottest} analyzed={plan.analyzed} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <div className="font-mono text-[10px] tracking-[0.12em] text-zinc-500 uppercase">{label}</div>
      <div className="font-mono text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function LogicalFlow({ steps }: { steps: LogicalStep[] }) {
  const max = Math.max(1, ...steps.filter((s) => s.present).map((s) => s.rows ?? 0));
  let n = 0;
  return (
    <ol className="panel divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800/70">
      {steps.map((s) => {
        if (!s.present) {
          return (
            <li key={s.id} className="flex items-center gap-3 px-3 py-1 text-zinc-400 dark:text-zinc-600" title={`${s.label}: not used in this query`}>
              <span className="w-6 text-center font-mono text-[10px]">·</span>
              <span className="font-mono text-[11px] line-through decoration-zinc-400/50">{s.label}</span>
            </li>
          );
        }
        n++;
        const pct = s.rows !== undefined ? Math.max(1.5, (Math.log10(s.rows + 1) / Math.log10(max + 1)) * 100) : 0;
        return (
          <li key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-3 py-2.5 sm:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)] sm:items-center">
            <span className="grid size-6 place-items-center rounded-full bg-linear-to-br from-sky-500 to-violet-500 font-mono text-[11px] font-semibold text-white shadow-md shadow-sky-500/30">{n}</span>
            <div className="min-w-0">
              <div className="font-mono text-[13px] font-semibold text-sky-700 dark:text-sky-300">{s.label}</div>
              <div className="text-xs text-zinc-500">{s.explain}</div>
            </div>
            <div className="col-start-2 mt-1.5 min-w-0 sm:col-start-3 sm:mt-0">
              {s.rows !== undefined ? (
                <div className="flex items-center gap-2">
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-linear-to-r from-sky-500 via-violet-500 to-cyan-400 bg-[length:200%_100%] animate-flow" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums">{fmtRows(s.rows)} rows</span>
                </div>
              ) : (
                <span className="text-xs text-zinc-400">{s.note ?? 'done inside the plan'}</span>
              )}
              {s.note && s.rows !== undefined && <div className="mt-0.5 text-right font-mono text-[11px] text-amber-600 dark:text-amber-400">{s.note}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PlanTree({ node, depth, totalMs, hottest, analyzed }: { node: PlanNode; depth: number; totalMs: number; hottest?: PlanNode; analyzed: boolean }) {
  const [open, setOpen] = useState(true);
  const k = KIND[node.kind];
  const share = analyzed && totalMs > 0 && node.selfMs !== undefined ? Math.min(100, (node.selfMs / totalMs) * 100) : undefined;
  const hot = hottest === node && (node.selfMs ?? 0) > 0;
  const off = analyzed && node.estimatedRows > 0 && node.rows > 0 ? Math.max(node.rows / node.estimatedRows, node.estimatedRows / node.rows) : 1;
  return (
    <div className={depth > 0 ? 'relative ml-4 border-l border-zinc-200 pl-3 sm:ml-5 sm:pl-4 dark:border-zinc-800' : ''}>
      {depth > 0 && <span aria-hidden className="absolute top-6 -left-px h-px w-3 bg-zinc-200 sm:w-4 dark:bg-zinc-800" />}
      <div className={`my-1.5 rounded-lg border p-2.5 transition ${hot ? 'border-rose-400/60 bg-rose-500/5 shadow-lg shadow-rose-500/10' : 'border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/40'}`}>
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            disabled={node.children.length === 0}
            aria-expanded={node.children.length ? open : undefined}
            aria-label={node.children.length ? (open ? 'Collapse inputs' : 'Expand inputs') : undefined}
            className={`grid size-7 shrink-0 place-items-center rounded-md text-sm ring-1 ${k.tone}`}
            title={k.label}
          >
            {k.icon}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold">{node.type}</span>
              {node.target && <span className="chip">{node.target}</span>}
              {node.role && <span className="chip border-violet-400/40 text-violet-600 dark:text-violet-300">{node.role}</span>}
              {hot && <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">slowest step</span>}
              {!open && node.children.length > 0 && <span className="text-[11px] text-zinc-500">+{walk(node).length - 1} hidden</span>}
            </div>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{node.description}</p>
            {node.details.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {node.details.map((d, i) => (
                  <span key={i} className="chip max-w-full" title={`${d.label}: ${d.value}`}>
                    <span className="text-zinc-400 dark:text-zinc-500">{d.label}</span>
                    <span className="truncate">{d.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right font-mono text-[11px] leading-5 tabular-nums">
            <div className="text-sm font-semibold">{fmtRows(node.rows)}<span className="ml-1 text-[10px] font-normal text-zinc-500">rows</span></div>
            {node.loops > 1 && <div className="text-zinc-500" title="This step ran once per row of its outer input.">×{fmtRows(node.loops)} loops</div>}
            {node.rowsRemoved !== undefined && <div className="text-amber-600 dark:text-amber-400">−{fmtRows(node.rowsRemoved)} filtered</div>}
            {off >= 10 && <div className="text-zinc-500" title={`The planner estimated ${fmtRows(node.estimatedRows)} rows. Big misestimates can lead to slow plans.`}>est. {fmtRows(node.estimatedRows)}</div>}
            {node.selfMs !== undefined && <div className="text-zinc-500">{fmtMs(node.selfMs)}</div>}
          </div>
        </div>
        {share !== undefined && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" title={`${share.toFixed(0)}% of the execution time`}>
            <div className={`h-full rounded-full ${hot ? 'bg-rose-500' : k.bar}`} style={{ width: `${Math.max(share, 0.5)}%` }} />
          </div>
        )}
      </div>
      {open && node.children.map((c, i) => <PlanTree key={i} node={c} depth={depth + 1} totalMs={totalMs} hottest={hottest} analyzed={analyzed} />)}
    </div>
  );
}
