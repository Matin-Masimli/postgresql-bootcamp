import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App.tsx';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

// Print in the light theme: dark backgrounds waste ink and print poorly.
let wasDark = false;
window.addEventListener('beforeprint', () => {
  wasDark = document.documentElement.classList.contains('dark');
  document.documentElement.classList.remove('dark');
});
window.addEventListener('afterprint', () => {
  if (wasDark) document.documentElement.classList.add('dark');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
