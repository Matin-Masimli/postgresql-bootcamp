import { Link, useParams } from 'react-router';
import { isQueryQuestion } from '../../content/types.ts';
import { DifficultyBadge } from '../components/Badges.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import Icon from '../components/Icons.tsx';
import Markdown from '../components/Markdown.tsx';
import { StationCrumb } from '../components/Metro.tsx';
import { stationsFor } from '../lib/metro.ts';
import { useProgress } from '../progress/store.ts';
import PageHeader from '../components/PageHeader.tsx';
import ResultTable from '../components/ResultTable.tsx';
import SqlCode from '../components/SqlCode.tsx';

/** Every question of a topic with its solution, explanation, alternatives and common mistakes. */
export default function HandbookPage() {
  const t = useT();
  const c = useContent();
  const { slug } = useParams();
  const prog = useProgress();
  const meta = c.topics.find((x) => x.slug === slug);
  const content = meta ? c.topic(meta.id) : undefined;
  if (!meta || !content) return <p>{t('handbook.none')}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <StationCrumb station={stationsFor([meta], prog, c)[0]} className="print:hidden" />
      <PageHeader
        title={t('handbook.title', { title: meta.title })}
        actions={<button type="button" onClick={() => window.print()} className="btn-secondary print:hidden"><Icon name="print" />{t('handbook.print')}</button>}
      >
        <p className="rounded-2xl bg-amber-500/[0.1] px-5 py-3.5 text-[15px] text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">{t('handbook.spoiler')}</p>
      </PageHeader>
      <nav className="panel p-5 print:hidden" aria-label={t('handbook.contents')}>
        <p className="label mb-3">{t('handbook.contents')}</p>
        <ol className="gap-x-6 text-sm sm:columns-2 [&>li]:mb-1.5">
          {content.questions.map((q, i) => (
            <li key={q.id} className="flex min-w-0 break-inside-avoid gap-2">
              <span className="w-5 shrink-0 text-right text-[13px] leading-5 text-zinc-400 tabular-nums">{i + 1}</span>
              <a href={`#${q.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth' }); }} className="truncate text-zinc-700 hover:text-sky-600 dark:text-zinc-300 dark:hover:text-sky-300">{q.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {content.questions.map((q, i) => (
        <section key={q.id} id={q.id} className="scroll-mt-20 space-y-3 border-t border-black/[0.08] pt-8 break-inside-avoid-page dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="chip">{q.id}</span><DifficultyBadge d={q.difficulty} /><span>{t(`type.${q.type}`)}</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]"><span className="mr-2 text-zinc-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>{q.title}</h2>
          <Markdown>{q.prompt}</Markdown>
          {isQueryQuestion(q) ? (
            <>
              {q.starterSql && (<><h3 className="label pt-2 !text-zinc-500">{t('handbook.broken')}</h3><SqlCode code={q.starterSql} /></>)}
              <h3 className="label pt-2 !text-zinc-500">{t('handbook.reference')}</h3>
              <SqlCode code={q.referenceSolution} />
              <Markdown>{q.explanation}</Markdown>
              {q.alternativeSolutions.length > 0 && (
                <>
                  <h3 className="label pt-2 !text-zinc-500">{t('handbook.alternatives')}</h3>
                  {q.alternativeSolutions.map((s, k) => <SqlCode key={k} code={s} />)}
                </>
              )}
            </>
          ) : (
            <>
              {q.type === 'predict-output' && <SqlCode code={q.referenceSolution} />}
              <h3 className="label pt-2 !text-zinc-500">{t('handbook.answer', { letter: String.fromCharCode(65 + q.correctOption) })}</h3>
              {q.type === 'predict-output'
                ? <ResultTable columns={q.options[q.correctOption].table.columns} rows={q.options[q.correctOption].table.rows} numbered={false} />
                : <Markdown>{q.options[q.correctOption].text}</Markdown>}
              <Markdown>{q.explanation}</Markdown>
            </>
          )}
          <h3 className="label pt-2 !text-zinc-500">{t('common.commonMistakes')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{q.commonMistakes.map((m, k) => <li key={k}><Markdown>{m}</Markdown></li>)}</ul>
          <Link to={`/topic/${slug}/q/${q.id}`} className="inline-block text-sm font-medium text-sky-600 hover:underline print:hidden dark:text-sky-400">{t('handbook.practise')}</Link>
        </section>
      ))}
    </div>
  );
}
