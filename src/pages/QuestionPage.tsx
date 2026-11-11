import { Link, useParams } from 'react-router';
import { StationCrumb } from '../components/Metro.tsx';
import QuestionRunner from '../components/QuestionRunner.tsx';
import { useContent } from '../i18n/content.ts';
import { useT } from '../i18n/index.ts';
import { lineVars, stationsFor } from '../lib/metro.ts';
import { useProgress } from '../progress/store.ts';

export default function QuestionPage() {
  const t = useT();
  const content = useContent();
  const { slug, qid } = useParams();
  const prog = useProgress();
  const meta = content.topics.find((x) => x.slug === slug);
  const questions = meta ? content.topic(meta.id)?.questions ?? [] : [];
  const i = questions.findIndex((q) => q.id === qid);
  if (!meta || i < 0) return <p>{t('question.notFound')} <Link to="/" className="underline">{t('question.backToTopics')}</Link></p>;
  const prev = questions[i - 1];
  const next = questions[i + 1];

  const pct = ((i + 1) / questions.length) * 100;
  const station = stationsFor([meta], prog, content)[0];
  const nav = (
    <nav className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-black/[0.08] pt-5 text-sm dark:border-white/[0.08]">
      <div className="min-w-0">
        {prev && (
          <Link to={`/topic/${slug}/q/${prev.id}`} className="group inline-flex max-w-full items-center gap-2 text-zinc-600 hover:text-sky-600 dark:text-zinc-400 dark:hover:text-sky-300">
            <span aria-hidden className="transition group-hover:-translate-x-0.5">←</span><span className="truncate">{prev.title}</span>
          </Link>
        )}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[13px] text-zinc-500 tabular-nums">{i + 1} / {questions.length}</span>
        <span className="h-1 w-20 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.1]"><span className="block h-full rounded-full bg-(--lc)" style={{ width: `${pct}%` }} /></span>
      </div>
      <div className="min-w-0 text-right">
        {next
          ? <Link to={`/topic/${slug}/q/${next.id}`} className="group inline-flex max-w-full items-center gap-2 font-medium hover:text-sky-600 dark:hover:text-sky-300"><span className="truncate">{next.title}</span><span aria-hidden className="transition group-hover:translate-x-0.5">→</span></Link>
          : <Link to={`/topic/${slug}`} className="font-medium hover:text-sky-600 dark:hover:text-sky-300">{t('question.backToTopic')}</Link>}
      </div>
    </nav>
  );

  return (
    <div className="space-y-3" style={lineVars(station.line.n)}>
      <StationCrumb station={station} />
      <QuestionRunner key={qid} question={questions[i]} nav={nav} />
    </div>
  );
}
