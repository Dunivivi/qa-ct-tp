import { ChapterId, Question } from '../bank/question.model';
import { DEFAULT_CONFIG, TestConfig } from './session.model';
import { allocate, buildPool, pickQuestions, seededRng } from './select';

function mk(id: string, sourceId: string, chapter: ChapterId | null, status: Question['status'] = 'confirmed'): Question {
  return {
    id, sourceId, number: 1, chapter, learningObjective: null, scenario: null, text: id, images: [],
    choices: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correct: ['A'], why: null,
    outdatedSourceExplanation: null, extraNotes: null, status, statusNote: null, sourceAnswer: null, alsoAppearsIn: [], url: null,
  };
}

const cfg = (over: Partial<TestConfig> = {}): TestConfig => ({ ...DEFAULT_CONFIG, sourceIds: ['a', 'b'], ...over });

describe('buildPool', () => {
  const qs = [mk('1', 'a', 1), mk('2', 'b', 4), mk('3', 'c', 4), mk('4', 'a', null), mk('5', 'b', 2, 'flagged')];

  it('pools every selected provider and filters by chapter', () => {
    expect(buildPool(qs, cfg({ chapters: [4] }), new Set()).map((q) => q.id)).toEqual(['2']);
    expect(buildPool(qs, cfg({ chapters: [1, 2, 3, 4, 5, 0], includeFlagged: true }), new Set()).map((q) => q.id)).toEqual(['1', '2', '4', '5']);
  });

  it('excludes flagged questions unless asked, and hidden ones always', () => {
    expect(buildPool(qs, cfg({ chapters: [2] }), new Set()).length).toBe(0);
    expect(buildPool(qs, cfg({ includeFlagged: true }), new Set(['1'])).map((q) => q.id)).not.toContain('1');
  });
});

describe('allocate', () => {
  it('follows the exam blueprint 6/4/7/20/3 for 40 questions', () => {
    const full = new Map<ChapterId, number>([[1, 100], [2, 100], [3, 100], [4, 100], [5, 100]]);
    expect(Object.fromEntries(allocate(40, full))).toEqual({ 1: 6, 2: 4, 3: 7, 4: 20, 5: 3 });
  });

  it('redistributes when a chapter runs short and never exceeds availability', () => {
    const plan = allocate(40, new Map<ChapterId, number>([[1, 100], [2, 100], [3, 100], [4, 5], [5, 100]]));
    expect(plan.get(4)).toBe(5);
    expect([...plan.values()].reduce((s, n) => s + n, 0)).toBe(40);
  });
});

describe('pickQuestions', () => {
  const pool = Array.from({ length: 50 }, (_, i) => mk(`q${i}`, 'a', ((i % 5) + 1) as ChapterId));

  it('returns the requested count without duplicates', () => {
    const out = pickQuestions(pool, cfg({ count: 20 }), {}, seededRng(1));
    expect(out.length).toBe(20);
    expect(new Set(out.map((q) => q.id)).size).toBe(20);
  });

  it('caps at the pool size', () => {
    expect(pickQuestions(pool.slice(0, 7), cfg({ count: 40 }), {}, seededRng(2)).length).toBe(7);
  });

  it('prefers unseen questions', () => {
    const stats = Object.fromEntries(pool.slice(0, 45).map((q) => [q.id, { seen: 1, right: 1, wrong: 0, lastAt: 1, lastRight: true }]));
    const out = pickQuestions(pool, cfg({ count: 5, weighted: false, preferUnseen: true }), stats, seededRng(3));
    expect(out.every((q) => !stats[q.id])).toBe(true);
  });
});
