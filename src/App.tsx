import { Route, Routes } from 'react-router';
import Layout from './components/Layout.tsx';
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
        <Route path="*" element={<p className="text-zinc-500">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
