import { Link, useParams } from 'react-router';
import { isQueryQuestion } from '../../content/types.ts';
import { DifficultyBadge } from '../components/Badges.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Markdown from '../components/Markdown.tsx';
import PageHeader from '../components/PageHeader.tsx';
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
      <nav aria-label={t('nav.breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-500 print:hidden">
        <Link to="/" className="shrink-0 hover:text-sky-600 dark:hover:text-sky-300">{t('common.topics')}</Link>
        <span aria-hidden className="text-zinc-400">/</span>
        <Link to={`/topic/${slug}`} className="truncate hover:text-sky-600 dark:hover:text-sky-300">
          <span className="font-mono text-xs text-sky-600 dark:text-sky-400">{String(meta.id).padStart(2, '0')}</span> {meta.title}
        </Link>
      </nav>
      <PageHeader
        eyebrow={t('handbook.eyebrow')}
        title={t('handbook.title', { title: meta.title })}
        actions={<button type="button" onClick={() => window.print()} className="btn-secondary print:hidden">⎙ {t('handbook.print')}</button>}
      >
        <p className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{t('handbook.spoiler')}</p>
      </PageHeader>
      <nav className="panel p-5 print:hidden" aria-label={t('handbook.contents')}>
        <p className="eyebrow mb-3">{t('handbook.contents')}</p>
        <ol className="gap-x-6 text-sm sm:columns-2 [&>li]:mb-1.5">
          {content.questions.map((q, i) => (
            <li key={q.id} className="flex min-w-0 break-inside-avoid gap-2">
              <span className="w-5 shrink-0 text-right font-mono text-xs leading-5 text-zinc-400">{i + 1}</span>
              <a href={`#${q.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth' }); }} className="truncate text-zinc-700 hover:text-sky-600 dark:text-zinc-300 dark:hover:text-sky-300">{q.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {content.questions.map((q, i) => (
        <section key={q.id} id={q.id} className="scroll-mt-20 space-y-3 border-t border-zinc-200 pt-8 break-inside-avoid-page dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="chip">{q.id}</span><DifficultyBadge d={q.difficulty} /><span>{t(`type.${q.type}`)}</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight"><span className="mr-2 font-mono text-base text-sky-600 dark:text-sky-400">{String(i + 1).padStart(2, '0')}</span>{q.title}</h2>
          <Markdown>{q.prompt}</Markdown>
          {isQueryQuestion(q) ? (
            <>
              {q.starterSql && (<><h3 className="eyebrow pt-2 !text-zinc-500">{t('handbook.broken')}</h3><SqlCode code={q.starterSql} /></>)}
              <h3 className="eyebrow pt-2 !text-zinc-500">{t('handbook.reference')}</h3>
              <SqlCode code={q.referenceSolution} />
              <Markdown>{q.explanation}</Markdown>
              {q.alternativeSolutions.length > 0 && (
                <>
                  <h3 className="eyebrow pt-2 !text-zinc-500">{t('handbook.alternatives')}</h3>
                  {q.alternativeSolutions.map((s, k) => <SqlCode key={k} code={s} />)}
                </>
              )}
            </>
          ) : (
            <>
              {q.type === 'predict-output' && <SqlCode code={q.referenceSolution} />}
              <h3 className="eyebrow pt-2 !text-zinc-500">{t('handbook.answer', { letter: String.fromCharCode(65 + q.correctOption) })}</h3>
              {q.type === 'predict-output'
                ? <ResultTable columns={q.options[q.correctOption].table.columns} rows={q.options[q.correctOption].table.rows} numbered={false} />
                : <Markdown>{q.options[q.correctOption].text}</Markdown>}
              <Markdown>{q.explanation}</Markdown>
            </>
          )}
          <h3 className="eyebrow pt-2 !text-zinc-500">{t('common.commonMistakes')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, k) => <li key={k}><Markdown>{m}</Markdown></li>)}</ul>
          <Link to={`/topic/${slug}/q/${q.id}`} className="inline-block text-sm font-medium text-sky-600 hover:underline print:hidden dark:text-sky-400">{t('handbook.practise')}</Link>
        </section>
      ))}
    </div>
  );
}
