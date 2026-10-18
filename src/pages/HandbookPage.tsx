import { Link, useParams } from 'react-router';
import { topicContent } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import { isQueryQuestion } from '../../content/types.ts';
import { DifficultyBadge, TYPE_LABEL } from '../components/Badges.tsx';
import Markdown from '../components/Markdown.tsx';
import ResultTable from '../components/ResultTable.tsx';
import SqlCode from '../components/SqlCode.tsx';

/** Every question of a topic with its solution, explanation, alternatives and common mistakes. */
export default function HandbookPage() {
  const { slug } = useParams();
  const meta = TOPICS.find((t) => t.slug === slug);
  const content = meta ? topicContent(meta.id) : undefined;
  if (!meta || !content) return <p>No handbook for this topic yet.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm text-zinc-500"><Link to="/" className="hover:underline">Topics</Link> / <Link to={`/topic/${slug}`} className="hover:underline">{meta.title}</Link></p>
        <h1 className="text-2xl font-semibold tracking-tight">Solution handbook: {meta.title}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Spoiler warning: this page contains every answer. Try the questions first.</p>
        <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm">
          {content.questions.map((q) => <li key={q.id}><a href={`#${q.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:underline">{q.title}</a></li>)}
        </ol>
      </header>
      {content.questions.map((q, i) => (
        <section key={q.id} id={q.id} className="scroll-mt-20 space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="font-mono">{q.id}</span><DifficultyBadge d={q.difficulty} /><span>{TYPE_LABEL[q.type]}</span>
          </div>
          <h2 className="text-lg font-semibold">{i + 1}. {q.title}</h2>
          <Markdown>{q.prompt}</Markdown>
          {isQueryQuestion(q) ? (
            <>
              {q.starterSql && (<><h3 className="text-sm font-medium">Broken query</h3><SqlCode code={q.starterSql} /></>)}
              <h3 className="text-sm font-medium">Reference solution</h3>
              <SqlCode code={q.referenceSolution} />
              <Markdown>{q.explanation}</Markdown>
              {q.alternativeSolutions.length > 0 && (
                <>
                  <h3 className="text-sm font-medium">Alternative approaches</h3>
                  {q.alternativeSolutions.map((s, k) => <SqlCode key={k} code={s} />)}
                </>
              )}
            </>
          ) : (
            <>
              {q.type === 'predict-output' && <SqlCode code={q.referenceSolution} />}
              <h3 className="text-sm font-medium">Answer: {String.fromCharCode(65 + q.correctOption)}</h3>
              {q.type === 'predict-output'
                ? <ResultTable columns={q.options[q.correctOption].table.columns} rows={q.options[q.correctOption].table.rows} numbered={false} />
                : <Markdown>{q.options[q.correctOption].text}</Markdown>}
              <Markdown>{q.explanation}</Markdown>
            </>
          )}
          <h3 className="text-sm font-medium">Common mistakes</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, k) => <li key={k}><Markdown>{m}</Markdown></li>)}</ul>
          <Link to={`/topic/${slug}/q/${q.id}`} className="inline-block text-sm text-sky-700 underline dark:text-sky-400">Practise this question →</Link>
        </section>
      ))}
    </div>
  );
}
