import { Route, Routes } from 'react-router';
import Layout from './components/Layout.tsx';
import HomePage from './pages/HomePage.tsx';
import SchemaPage from './pages/SchemaPage.tsx';
import DiagnosticsPage from './pages/DiagnosticsPage.tsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="schema" element={<SchemaPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        <Route path="*" element={<p className="text-zinc-500">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
