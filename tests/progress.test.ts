import { beforeEach, describe, expect, it } from 'vitest';
import { currentStreak, localDay, progress, statusOf } from '../src/progress/store.ts';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localDay(d);
};

describe('progress store', () => {
  beforeEach(() => progress.resetAll());

  it('tracks attempts, solved state and status', () => {
    progress.recordCheck('t04-q01', false);
    expect(statusOf(progress.get().questions['t04-q01'])).toBe('failed');
    progress.recordCheck('t04-q01', true);
    progress.recordCheck('t04-q01', false); // a later failure never un-solves
    const p = progress.get().questions['t04-q01'];
    expect(p.attempts).toBe(3);
    expect(statusOf(p)).toBe('solved');
    expect(p.firstSolvedAt).toBeTruthy();
    expect(statusOf(progress.get().questions['nope'])).toBe('unsolved');
  });

  it('round-trips through export and replace-import', () => {
    progress.recordCheck('a', true);
    progress.saveDraft('a', 'SELECT 1');
    const json = progress.exportJson();
    progress.resetAll();
    progress.importJson(json, 'replace');
    expect(progress.get().questions.a).toMatchObject({ solved: true, draft: 'SELECT 1', attempts: 1 });
  });

  it('merges keeping the best of both devices', () => {
    progress.recordCheck('a', false);
    progress.recordCheck('b', true);
    const other = {
      version: 1,
      questions: {
        a: { attempts: 4, solved: true, firstSolvedAt: '2026-01-01T00:00:00.000Z', lastAttemptAt: '2026-01-01T00:00:00.000Z' },
        c: { attempts: 1, solved: false },
      },
      activeDays: ['2026-01-01'],
      exams: [{ at: '2026-01-02T10:00:00.000Z', durationSec: 600, results: { a: true } }],
    };
    const r = progress.importJson(JSON.stringify(other), 'merge');
    const s = progress.get();
    expect(r.questions).toBe(2);
    expect(s.questions.a.solved).toBe(true);
    expect(s.questions.a.attempts).toBe(4);
    expect(s.questions.b.solved).toBe(true);
    expect(s.questions.c.attempts).toBe(1);
    expect(s.activeDays).toContain('2026-01-01');
    expect(s.exams).toHaveLength(1);
    // Importing the same file again doesn't duplicate exams.
    progress.importJson(JSON.stringify(other), 'merge');
    expect(progress.get().exams).toHaveLength(1);
  });

  it('rejects files that are not progress exports', () => {
    expect(() => progress.importJson('{"hello": 1}', 'merge')).toThrow();
    expect(() => progress.importJson('not json', 'merge')).toThrow();
  });

  it('computes streaks ending today or yesterday', () => {
    expect(currentStreak([day(0), day(-1), day(-2), day(-4)])).toBe(3);
    expect(currentStreak([day(-1), day(-2)])).toBe(2);
    expect(currentStreak([day(-2), day(-3)])).toBe(0);
    expect(currentStreak([])).toBe(0);
  });
});
