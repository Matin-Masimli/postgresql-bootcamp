import { useMemo, type ReactNode } from 'react';
import { PostgreSQL } from '@codemirror/lang-sql';
import { classHighlighter, highlightCode } from '@lezer/highlight';

/** Read-only, statically highlighted SQL (no editor instance, cheap for long handbooks). */
export default function SqlCode({ code, className = '' }: { code: string; className?: string }) {
  const nodes = useMemo(() => {
    const out: ReactNode[] = [];
    const tree = PostgreSQL.language.parser.parse(code);
    let k = 0;
    highlightCode(
      code,
      tree,
      classHighlighter,
      (text, classes) => out.push(classes ? <span key={k++} className={classes}>{text}</span> : text),
      () => out.push('\n'),
    );
    return out;
  }, [code]);
  return (
    <pre className={`sql-code overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-[13px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-950/60 ${className}`}>
      <code>{nodes}</code>
    </pre>
  );
}
