import { Fragment, type ReactNode } from 'react';

type Renderers = Record<string, (children: string) => ReactNode>;

/**
 * Renders a translated string that marks rich parts with simple tags: "Click <b>Run</b> or <a>open it</a>".
 * Each tag name maps to a renderer; tags are not nested. Unknown tags render as plain text.
 */
export default function Rich({ text, tags = {} }: { text: string; tags?: Renderers }) {
  const all: Renderers = {
    b: (c) => <strong>{c}</strong>,
    code: (c) => <code>{c}</code>,
    ...tags,
  };
  const out: ReactNode[] = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let k = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = all[m[1]];
    out.push(<Fragment key={k++}>{render ? render(m[2]) : m[2]}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
