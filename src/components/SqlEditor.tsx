import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { setDiagnostics } from '@codemirror/lint';
import { useManifest } from '../lib/manifest.ts';
import { useT } from '../i18n/index.ts';
import { darkEditorTheme, lightEditorTheme } from '../lib/editorTheme.ts';
import { useDarkMode } from '../lib/useDarkMode.ts';

export interface EditorError { offset: number; message: string }

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun?: () => void;
  error?: EditorError | null;
  readOnly?: boolean;
  minHeight?: string;
  /** Receives an insert(text) function so other components (schema panel) can type into the editor. */
  onReady?: (api: { insert: (text: string) => void; focus: () => void }) => void;
}

export default function SqlEditor({ value, onChange, onRun, error, readOnly, minHeight = '160px', onReady }: Props) {
  const t = useT();
  const dark = useDarkMode();
  const { manifest } = useManifest();
  const viewRef = useRef<EditorView | null>(null);
  const runRef = useRef(onRun);
  runRef.current = onRun;

  const extensions = useMemo(() => {
    const schema = Object.fromEntries((manifest?.tables ?? []).map((t) => [t.name, t.columns.map((c) => c.name)]));
    return [
      sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true }),
      EditorView.lineWrapping,
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              runRef.current?.();
              return true;
            },
          },
        ]),
      ),
    ];
  }, [manifest]);

  // Show the PostgreSQL error position as an inline diagnostic.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const len = view.state.doc.length;
    if (!error || error.offset > len) {
      view.dispatch(setDiagnostics(view.state, []));
      return;
    }
    const word = /^[\w$."]+/.exec(view.state.doc.sliceString(error.offset, Math.min(len, error.offset + 64)));
    const to = Math.min(len, error.offset + Math.max(1, word?.[0].length ?? 1));
    view.dispatch(setDiagnostics(view.state, [{ from: error.offset, to, severity: 'error', message: error.message }]));
  }, [error]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm transition focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-500/15 dark:border-zinc-700/80 dark:bg-zinc-950/70 dark:shadow-inner dark:shadow-black/30">
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        theme={dark ? darkEditorTheme : lightEditorTheme}
        extensions={extensions}
        minHeight={minHeight}
        maxHeight="60vh"
        basicSetup={{ foldGutter: false, highlightActiveLineGutter: false, autocompletion: true, searchKeymap: true }}
        onCreateEditor={(view) => {
          viewRef.current = view;
          onReady?.({
            insert: (text) => {
              const { from, to } = view.state.selection.main;
              view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
              view.focus();
            },
            focus: () => view.focus(),
          });
        }}
        aria-label={t('runner.editorAria')}
      />
    </div>
  );
}
