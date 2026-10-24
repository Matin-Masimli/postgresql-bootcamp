import { Link, useParams } from 'react-router';
import QuestionRunner from '../components/QuestionRunner.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';

export default function QuestionPage() {
  const t = useT();
  const content = useContent();
  const { slug, qid } = useParams();
  const meta = content.topics.find((x) => x.slug === slug);
  const questions = meta ? content.topic(meta.id)?.questions ?? [] : [];
  const i = questions.findIndex((q) => q.id === qid);
  if (!meta || i < 0) return <p>{t('question.notFound')} <Link to="/" className="underline">{t('question.backToTopics')}</Link></p>;
  const prev = questions[i - 1];
  const next = questions[i + 1];

  const pct = ((i + 1) / questions.length) * 100;
  const nav = (
    <nav className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-zinc-200 pt-5 text-sm dark:border-zinc-800">
      <div className="min-w-0">
        {prev && (
          <Link to={`/topic/${slug}/q/${prev.id}`} className="group inline-flex max-w-full items-center gap-2 text-zinc-600 hover:text-sky-600 dark:text-zinc-400 dark:hover:text-sky-300">
            <span aria-hidden className="transition group-hover:-translate-x-0.5">←</span><span className="truncate">{prev.title}</span>
          </Link>
        )}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-mono text-xs text-zinc-500 tabular-nums">{i + 1} / {questions.length}</span>
        <span className="h-1 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><span className="block h-full rounded-full bg-linear-to-r from-sky-500 to-violet-500" style={{ width: `${pct}%` }} /></span>
      </div>
      <div className="min-w-0 text-right">
        {next
          ? <Link to={`/topic/${slug}/q/${next.id}`} className="group inline-flex max-w-full items-center gap-2 font-medium hover:text-sky-600 dark:hover:text-sky-300"><span className="truncate">{next.title}</span><span aria-hidden className="transition group-hover:translate-x-0.5">→</span></Link>
          : <Link to={`/topic/${slug}`} className="font-medium hover:text-sky-600 dark:hover:text-sky-300">{t('question.backToTopic')}</Link>}
      </div>
    </nav>
  );

  return (
    <div className="space-y-3">
      <nav aria-label={t('nav.breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-500">
        <Link to="/" className="shrink-0 hover:text-sky-600 dark:hover:text-sky-300">{t('common.topics')}</Link>
        <span aria-hidden className="text-zinc-400">/</span>
        <Link to={`/topic/${slug}`} className="truncate hover:text-sky-600 dark:hover:text-sky-300">
          <span className="font-mono text-xs text-sky-600 dark:text-sky-400">{String(meta.id).padStart(2, '0')}</span> {meta.title}
        </Link>
      </nav>
      <QuestionRunner key={qid} question={questions[i]} nav={nav} />
    </div>
  );
}
