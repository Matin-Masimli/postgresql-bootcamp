// CodeMirror themes matching the app's design system (ink-blue neutrals, electric-blue accent).
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

function build(dark: boolean): Extension {
  const c = dark
    ? { fg: '#dbe0eb', muted: '#67728a', gutter: '#4b556b', line: 'rgb(95 156 255 / 0.06)', sel: 'rgb(59 125 255 / 0.30)', caret: '#5f9cff', panel: '#131826', border: '#323a4d', keyword: '#7fb0ff', string: '#6ee7b7', number: '#fbbf24', type: '#c4b5fd', op: '#8b96ab', fn: '#67e8f9' }
    : { fg: '#131826', muted: '#67728a', gutter: '#8b96ab', line: 'rgb(37 99 240 / 0.05)', sel: 'rgb(59 125 255 / 0.22)', caret: '#2563f0', panel: '#ffffff', border: '#dbe0eb', keyword: '#2563f0', string: '#047857', number: '#c2410c', type: '#7c3aed', op: '#4b556b', fn: '#0e7490' };

  const theme = EditorView.theme(
    {
      '&': { color: c.fg, backgroundColor: 'transparent', fontSize: '14px' },
      '.cm-content': { caretColor: c.caret, fontFamily: 'var(--font-mono)', padding: '10px 0' },
      '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: c.caret, borderLeftWidth: '2px' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: `${c.sel} !important` },
      '.cm-activeLine': { backgroundColor: c.line },
      '.cm-gutters': { backgroundColor: 'transparent', color: c.gutter, border: 'none', paddingLeft: '4px' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: c.caret },
      '.cm-tooltip': { backgroundColor: c.panel, border: `1px solid ${c.border}`, borderRadius: '8px', overflow: 'hidden' },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: c.sel, color: c.fg },
      '.cm-tooltip.cm-tooltip-lint': { fontFamily: 'var(--font-mono)', fontSize: '12px' },
      '.cm-matchingBracket': { backgroundColor: c.sel, outline: 'none' },
      '.cm-placeholder': { color: c.muted },
    },
    { dark },
  );

  const highlight = HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: c.keyword, fontWeight: '500' },
    { tag: [t.string, t.special(t.string)], color: c.string },
    { tag: [t.number, t.bool, t.null, t.atom], color: c.number },
    { tag: [t.typeName, t.className], color: c.type },
    { tag: [t.function(t.variableName), t.standard(t.name)], color: c.fn },
    { tag: [t.comment, t.lineComment, t.blockComment], color: c.muted, fontStyle: 'italic' },
    { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: c.op },
    { tag: [t.special(t.name)], color: c.fg },
  ]);

  return [theme, syntaxHighlighting(highlight)];
}

export const darkEditorTheme = build(true);
export const lightEditorTheme = build(false);
