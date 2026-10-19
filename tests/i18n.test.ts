// Translation gate: a translation may change prose only. Every piece of code (inline `code`, fenced
// blocks), every table/column/function name and every structural element must match the English.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import azPack from '../content/az/index.ts';
import type { ContentPack, QuestionText } from '../content/i18n.ts';
import { TOPIC_CONTENT } from '../content/index.ts';
import { TOPICS } from '../content/topicList.ts';
import type { Question } from '../content/types.ts';
import { az } from '../src/i18n/az.ts';
import { en } from '../src/i18n/en.ts';

const PACKS: Record<string, ContentPack> = { az: azPack };
const DICTS: Record<string, Record<string, unknown>> = { az };

// ───────────── helpers

const FENCE = /```(\w*)\n([\s\S]*?)```/g;

/** Removes `-- comments` (outside single-quoted strings) and normalises whitespace. */
function stripComments(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      let inStr = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "'") inStr = !inStr;
        else if (!inStr && line[i] === '-' && line[i + 1] === '-') return line.slice(0, i);
      }
      return line;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function codeOf(md: string) {
  const blocks: { lang: string; code: string; error: boolean }[] = [];
  const prose = md.replace(FENCE, (_, lang: string, body: string) => {
    blocks.push({ lang, code: stripComments(body), error: /^--\s*ERROR/.test(body) });
    return ' ';
  });
  const inline = [...prose.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).sort();
  const headings = prose.split('\n').filter((l) => /^#{1,6} /.test(l)).map((l) => l.match(/^#+/)![0]);
  return { blocks, inline, headings };
}

/** The translated Markdown must contain exactly the same code as the English. */
function sameCode(where: string, enText: string, trText: string) {
  const a = codeOf(enText);
  const b = codeOf(trText);
  expect(b.blocks.length, `${where}: number of code blocks`).toBe(a.blocks.length);
  a.blocks.forEach((blk, i) => {
    expect(b.blocks[i].lang, `${where}: language of code block ${i + 1}`).toBe(blk.lang);
    expect(b.blocks[i].code, `${where}: code block ${i + 1} (only -- comments may be translated)`).toBe(blk.code);
    expect(b.blocks[i].error, `${where}: code block ${i + 1} keeps its "-- ERROR" marker`).toBe(blk.error);
  });
  expect(b.inline, `${where}: inline code spans (names and SQL must not be translated)`).toEqual(a.inline);
  expect(b.headings, `${where}: heading structure`).toEqual(a.headings);
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

// ───────────── interface dictionaries

describe.each(Object.entries(DICTS))('interface dictionary: %s', (_, dict) => {
  it('has every English key and no extra keys', () => {
    expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
  });
  it('keeps every {placeholder} and <tag> of the English strings', () => {
    for (const [key, value] of Object.entries(en)) {
      const tr = dict[key];
      if (typeof value !== 'string' || typeof tr !== 'string') continue;
      expect(placeholders(tr), `${key}: placeholders`).toEqual(placeholders(value));
      expect(tags(tr), `${key}: rich-text tags`).toEqual(tags(value));
    }
  });
  it('produces text for every function entry', () => {
    const sample = { n: 3, expected: 2, actual: 5, row: 4, missing: 1, extra: 2, max: 50000, total: 120, shown: 100, capped: 1, first5: 1, line: 2, col: 7, expectedList: 'a, b', actualList: 'a', name: 'x', pairs: '"a" → "b"' };
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value === 'function') expect((value as (r: object, f: object) => string)(sample, sample), key).toMatch(/\S/);
    }
  });
});

// ───────────── course content

const english = new Map(TOPIC_CONTENT.map((t) => [t.id, t]));

function checkQuestion(lang: string, q: Question, tr: QuestionText) {
  const where = `${lang} ${q.id}`;
  expect(tr.title.trim(), `${where}: title`).not.toBe('');
  expect(tr.hints.length, `${where}: number of hints`).toBe(q.hints.length);
  expect(tr.commonMistakes.length, `${where}: number of common mistakes`).toBe(q.commonMistakes.length);
  expect(codeOf(tr.title).inline, `${where}: title code`).toEqual(codeOf(q.title).inline);
  sameCode(`${where} prompt`, q.prompt, tr.prompt);
  sameCode(`${where} explanation`, q.explanation, tr.explanation);
  q.hints.forEach((h, i) => sameCode(`${where} hint ${i + 1}`, h, tr.hints[i]));
  q.commonMistakes.forEach((m, i) => sameCode(`${where} mistake ${i + 1}`, m, tr.commonMistakes[i]));
  if (q.type === 'concept-mc') {
    expect(tr.options?.length, `${where}: number of options`).toBe(q.options.length);
    q.options.forEach((o, i) => sameCode(`${where} option ${String.fromCharCode(65 + i)}`, o.text, tr.options![i]));
  } else {
    expect(tr.options, `${where}: only concept questions have text options`).toBeUndefined();
  }
}

describe.each(Object.entries(PACKS))('content pack: %s', (lang, pack) => {
  it('names and summarises every topic', () => {
    expect(Object.keys(pack.meta).map(Number).sort((a, b) => a - b)).toEqual(TOPICS.map((t) => t.id));
    for (const t of TOPICS) {
      expect(pack.meta[t.id].title.trim(), `topic ${t.id} title`).not.toBe('');
      expect(codeOf(pack.meta[t.id].summary).inline).toEqual(codeOf(t.summary).inline);
    }
  });

  it('describes exactly the commented database objects', () => {
    const sql = readFileSync('scripts/db/schema.sql', 'utf8');
    const targets = [...sql.matchAll(/COMMENT ON (?:TABLE|COLUMN) ([\w.]+) IS/g)].map((m) => m[1]).sort();
    expect(Object.keys(pack.schema).sort()).toEqual(targets);
  });

  for (const [id, tr] of Object.entries(pack.topics)) {
    describe(`topic ${id}`, () => {
      const topic = english.get(Number(id))!;
      it('exists in English', () => expect(topic).toBeDefined());
      it('keeps the lesson code identical', () => sameCode(`${lang} topic ${id} explanation`, topic.explanation, tr!.explanation));
      it('translates every question and nothing else', () => {
        expect(Object.keys(tr!.questions).sort()).toEqual(topic.questions.map((q) => q.id).sort());
      });
      for (const q of topic.questions) {
        it(`${q.id} keeps code, names and structure`, () => {
          const t = tr!.questions[q.id];
          expect(t, `${q.id} is translated`).toBeDefined();
          checkQuestion(lang, q, t);
        });
      }
    });
  }
});
