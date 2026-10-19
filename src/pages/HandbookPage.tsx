import { Link, useParams } from 'react-router';
import { isQueryQuestion } from '../../content/types.ts';
import { DifficultyBadge } from '../components/Badges.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Markdown from '../components/Markdown.tsx';
import ResultTable from '../components/ResultTable.tsx';
import SqlCode from '../components/SqlCode.tsx';

/** Every question of a topic with its solution, explanation, alternatives and common mistakes. */
export default function HandbookPage() {
  const t = useT();
  const c = useContent();
  const { slug } = useParams();
  const meta = c.topics.find((x) => x.slug === slug);
  const content = meta ? c.topic(meta.id) : undefined;
  if (!meta || !content) return <p>{t('handbook.none')}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm text-zinc-500"><Link to="/" className="hover:underline">{t('common.topics')}</Link> / <Link to={`/topic/${slug}`} className="hover:underline">{meta.title}</Link></p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('handbook.title', { title: meta.title })}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('handbook.spoiler')}</p>
        <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm">
          {content.questions.map((q) => <li key={q.id}><a href={`#${q.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:underline">{q.title}</a></li>)}
        </ol>
      </header>
      {content.questions.map((q, i) => (
        <section key={q.id} id={q.id} className="scroll-mt-20 space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="font-mono">{q.id}</span><DifficultyBadge d={q.difficulty} /><span>{t(`type.${q.type}`)}</span>
          </div>
          <h2 className="text-lg font-semibold">{i + 1}. {q.title}</h2>
          <Markdown>{q.prompt}</Markdown>
          {isQueryQuestion(q) ? (
            <>
              {q.starterSql && (<><h3 className="text-sm font-medium">{t('handbook.broken')}</h3><SqlCode code={q.starterSql} /></>)}
              <h3 className="text-sm font-medium">{t('handbook.reference')}</h3>
              <SqlCode code={q.referenceSolution} />
              <Markdown>{q.explanation}</Markdown>
              {q.alternativeSolutions.length > 0 && (
                <>
                  <h3 className="text-sm font-medium">{t('handbook.alternatives')}</h3>
                  {q.alternativeSolutions.map((s, k) => <SqlCode key={k} code={s} />)}
                </>
              )}
            </>
          ) : (
            <>
              {q.type === 'predict-output' && <SqlCode code={q.referenceSolution} />}
              <h3 className="text-sm font-medium">{t('handbook.answer', { letter: String.fromCharCode(65 + q.correctOption) })}</h3>
              {q.type === 'predict-output'
                ? <ResultTable columns={q.options[q.correctOption].table.columns} rows={q.options[q.correctOption].table.rows} numbered={false} />
                : <Markdown>{q.options[q.correctOption].text}</Markdown>}
              <Markdown>{q.explanation}</Markdown>
            </>
          )}
          <h3 className="text-sm font-medium">{t('common.commonMistakes')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, k) => <li key={k}><Markdown>{m}</Markdown></li>)}</ul>
          <Link to={`/topic/${slug}/q/${q.id}`} className="inline-block text-sm text-sky-700 underline dark:text-sky-400">{t('handbook.practise')}</Link>
        </section>
      ))}
    </div>
  );
}
