// CodeMirror themes matching the app's Apple-style design system (Xcode source colours).
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

function build(dark: boolean): Extension {
  // Xcode's default light and dark source-editor colours.
  const c = dark
    ? { fg: '#e5e5ea', muted: '#7f8c98', gutter: '#636366', line: 'rgb(255 255 255 / 0.04)', sel: 'rgb(10 132 255 / 0.32)', caret: '#0a84ff', panel: '#2c2c2e', border: 'rgb(255 255 255 / 0.1)', keyword: '#fc5fa3', string: '#fc6a5d', number: '#d0bf69', type: '#5dd8ff', op: '#a1a1a6', fn: '#67b7a4' }
    : { fg: '#1d1d1f', muted: '#5d6c79', gutter: '#a1a1a6', line: 'rgb(0 113 227 / 0.05)', sel: 'rgb(0 113 227 / 0.18)', caret: '#0071e3', panel: '#ffffff', border: 'rgb(0 0 0 / 0.1)', keyword: '#9b2393', string: '#c41a16', number: '#1c00cf', type: '#0b4f79', op: '#3c3c43', fn: '#326d74' };

  const theme = EditorView.theme(
    {
      '&': { color: c.fg, backgroundColor: 'transparent', fontSize: '14.5px' },
      '.cm-content': { caretColor: c.caret, fontFamily: 'var(--font-mono)', padding: '14px 0' },
      '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: c.caret, borderLeftWidth: '2px' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: `${c.sel} !important` },
      '.cm-activeLine': { backgroundColor: c.line },
      '.cm-gutters': { backgroundColor: 'transparent', color: c.gutter, border: 'none', paddingLeft: '4px' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: c.caret },
      '.cm-tooltip': { backgroundColor: c.panel, border: `1px solid ${c.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 12px 32px -8px rgb(0 0 0 / 0.25)' },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: c.sel, color: c.fg },
      '.cm-tooltip.cm-tooltip-lint': { fontFamily: 'var(--font-mono)', fontSize: '12px' },
      '.cm-matchingBracket': { backgroundColor: c.sel, outline: 'none' },
      '.cm-placeholder': { color: c.muted },
    },
    { dark },
  );

  const highlight = HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: c.keyword, fontWeight: '600' },
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
