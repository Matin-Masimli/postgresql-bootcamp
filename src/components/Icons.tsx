/** Small line icons drawn on a 16px grid (even 1.8px strokes, round caps), sized by className. */
const PATHS = {
  play: <path d="M5 3.5v9l7.5-4.5L5 3.5Z" fill="currentColor" stroke="none" />,
  check: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />,
  cross: <path d="M4.5 4.5l7 7m0-7-7 7" />,
  print: <path d="M4.5 6V2.5h7V6m-7 5.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" />,
  bulb: <path d="M6 12.5h4M6.5 14.5h3M5.2 10C4.1 9.1 3.5 7.8 3.5 6.5a4.5 4.5 0 0 1 9 0c0 1.3-.6 2.6-1.7 3.5-.4.4-.8.9-.8 1.5H6c0-.6-.4-1.1-.8-1.5Z" />,
  loop: <path d="M12.5 5.5A5 5 0 0 0 3.2 6.5M3.5 10.5a5 5 0 0 0 9.3-1M12.8 2.5v3h-3M3.2 13.5v-3h3" />,
  question: <path d="M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2V10m0 2.5v.01" />,
  plan: <path d="M8 2.5v3m0 0H4.5a1 1 0 0 0-1 1V9m4.5-3.5h3.5a1 1 0 0 1 1 1V9M2 9.5h3v3H2zm9 0h3v3h-3zM6.5 1h3v3h-3z" />,
} as const;

export default function Icon({ name, className = 'size-3.5' }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
