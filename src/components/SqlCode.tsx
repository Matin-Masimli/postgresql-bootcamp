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
    <pre className={`sql-code overflow-x-auto rounded-2xl bg-white px-5 py-4 text-[13.5px] leading-relaxed shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-black/[0.07] dark:bg-[#1e1e20] dark:shadow-none dark:ring-white/[0.08] ${className}`}>
      <code>{nodes}</code>
    </pre>
  );
}
