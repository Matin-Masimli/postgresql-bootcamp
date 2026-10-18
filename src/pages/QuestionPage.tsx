import { Link, useParams } from 'react-router';
import { topicContent } from '../../content/index.ts';
import { TOPICS } from '../../content/topicList.ts';
import QuestionRunner from '../components/QuestionRunner.tsx';

export default function QuestionPage() {
  const { slug, qid } = useParams();
  const meta = TOPICS.find((t) => t.slug === slug);
  const questions = meta ? topicContent(meta.id)?.questions ?? [] : [];
  const i = questions.findIndex((q) => q.id === qid);
  if (!meta || i < 0) return <p>Question not found. <Link to="/" className="underline">Back to topics</Link></p>;
  const prev = questions[i - 1];
  const next = questions[i + 1];

  const nav = (
    <nav className="flex items-center justify-between border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
      {prev ? <Link to={`/topic/${slug}/q/${prev.id}`} className="hover:underline">← {prev.title}</Link> : <span />}
      <span className="text-zinc-500">{i + 1} / {questions.length}</span>
      {next ? <Link to={`/topic/${slug}/q/${next.id}`} className="text-right hover:underline">{next.title} →</Link> : <Link to={`/topic/${slug}`} className="hover:underline">Back to topic →</Link>}
    </nav>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-500">
        <Link to="/" className="hover:underline">Topics</Link> / <Link to={`/topic/${slug}`} className="hover:underline">{meta.title}</Link>
      </p>
      <QuestionRunner key={qid} question={questions[i]} nav={nav} />
    </div>
  );
}
