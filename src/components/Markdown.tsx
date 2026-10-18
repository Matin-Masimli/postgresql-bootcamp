import { isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { engine, runError } from '../db/client.ts';
import type { RunOutput } from '../engine/types.ts';
import RunResults from './RunResults.tsx';
import SqlCode from './SqlCode.tsx';

/** A ```sql example with a Run button (runs sandboxed on the main dataset). */
function RunnableSql({ code }: { code: string }) {
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      setOutput(await engine.run(code));
    } catch (e) {
      setOutput({ statements: [], totalMs: 0, error: runError(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="not-prose my-3 space-y-2">
      <div className="relative">
        <SqlCode code={code} />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="btn-primary absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs"
        >
          {busy ? 'Running…' : output ? 'Run again' : '▶ Run'}
        </button>
      </div>
      {output && <RunResults output={output} sql={code} />}
    </div>
  );
}

export default function Markdown({ children, runnable = false }: { children: string; runnable?: boolean }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children: c }) => {
            const el = (Array.isArray(c) ? c[0] : c) as ReactNode;
            if (isValidElement(el)) {
              const props = (el as ReactElement<{ className?: string; children?: ReactNode }>).props;
              const lang = /language-(\w+)/.exec(props.className ?? '')?.[1];
              const code = String(props.children ?? '').replace(/\n$/, '');
              if (lang === 'sql') return runnable ? <RunnableSql code={code} /> : <SqlCode code={code} className="my-3" />;
              return <pre className="my-3 overflow-x-auto rounded-md bg-zinc-100 px-3 py-2 text-[13px] dark:bg-zinc-900"><code>{code}</code></pre>;
            }
            return <pre>{c}</pre>;
          },
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-sky-700 underline dark:text-sky-400">{c}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
