import { Link, Route, Routes } from 'react-router';
import Layout from './components/Layout.tsx';
import { EmptyState } from './components/PageHeader.tsx';
import DiagnosticsPage from './pages/DiagnosticsPage.tsx';
import ExamPage from './pages/ExamPage.tsx';
import HandbookPage from './pages/HandbookPage.tsx';
import HomePage from './pages/HomePage.tsx';
import PlaygroundPage from './pages/PlaygroundPage.tsx';
import ProgressPage from './pages/ProgressPage.tsx';
import QuestionPage from './pages/QuestionPage.tsx';
import ReviewPage from './pages/ReviewPage.tsx';
import SchemaPage from './pages/SchemaPage.tsx';
import TopicPage from './pages/TopicPage.tsx';
import { useT } from './i18n/index.ts';

function NotFound() {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon="?"
        title={t('app.notFound')}
        text={t('app.notFoundText')}
        action={<Link to="/" className="btn-primary px-4 py-2">← {t('app.backHome')}</Link>}
      />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="topic/:slug" element={<TopicPage />} />
        <Route path="topic/:slug/q/:qid" element={<QuestionPage />} />
        <Route path="topic/:slug/handbook" element={<HandbookPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="exam" element={<ExamPage />} />
        <Route path="playground" element={<PlaygroundPage />} />
        <Route path="schema" element={<SchemaPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
