import { useSyncExternalStore } from 'react';

/** Tracks the `dark` class on <html> (set by the theme toggle). */
export function useDarkMode(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const obs = new MutationObserver(fn);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains('dark'),
  );
}
