import { Question, QuestionSource } from '../bank/question.model';
import { isCorrect, scoreSession, selectCount } from './scoring';
import { DEFAULT_CONFIG, TestSession } from './session.model';

function mk(id: string, correct: string[], status: Question['status'] = 'confirmed', chapter: Question['chapter'] = 1): Question {
  return {
    id, sourceId: 's', number: 1, chapter, learningObjective: null, scenario: null, text: id, images: [],
    choices: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key })), correct, why: null,
    outdatedSourceExplanation: null, extraNotes: null, status, statusNote: null, sourceAnswer: null, alsoAppearsIn: [], url: null,
  };
}

describe('isCorrect', () => {
  it('requires the exact key for single answers', () => {
    expect(isCorrect(['A'], mk('q', ['A']))).toBe(true);
    expect(isCorrect(['B'], mk('q', ['A']))).toBe(false);
    expect(isCorrect([], mk('q', ['A']))).toBe(false);
  });

  it('accepts any listed option for multiple-correct questions, one pick only', () => {
    const q = mk('q', ['B', 'D'], 'multiple-correct');
    expect(selectCount(q)).toBe(1);
    expect(isCorrect(['D'], q)).toBe(true);
    expect(isCorrect(['B', 'D'], q)).toBe(false);
  });

  it('requires the full set for genuine multi-select questions', () => {
    const q = mk('q', ['A', 'C']);
    expect(selectCount(q)).toBe(2);
    expect(isCorrect(['C', 'A'], q)).toBe(true);
    expect(isCorrect(['A'], q)).toBe(false);
  });
});

describe('scoreSession', () => {
  it('scores, applies the 65% pass mark and breaks down by chapter and source', () => {
    const qs = [mk('a', ['A'], 'confirmed', 1), mk('b', ['B'], 'confirmed', 1), mk('c', ['C'], 'confirmed', 4)];
    const byId = new Map(qs.map((q) => [q.id, q]));
    const sources = new Map<string, QuestionSource>([['s', { id: 's', label: 'Src', kind: 'verified', order: 1, origin: 'local', fileName: 'f', questions: qs }]]);
    const item = (qid: string, answer: string[]) => ({ qid, order: ['A', 'B', 'C', 'D'], answer, flagged: false, struck: [], checked: false, timeMs: 1000 });
    const session: TestSession = {
      id: 't1', config: DEFAULT_CONFIG, current: 0, startedAt: 0, deadline: null, pausedAt: null, enteredAt: 0,
      items: [item('a', ['A']), item('b', ['A']), item('c', ['C'])],
    };
    const r = scoreSession(session, byId, sources, 60_000);
    expect(r.right).toBe(2);
    expect(r.percent).toBe(67);
    expect(r.passed).toBe(true);
    expect(r.byChapter).toEqual([
      { key: '1', label: 'Basic Concepts', total: 2, right: 1 },
      { key: '4', label: 'Performance Testing Tasks', total: 1, right: 1 },
    ]);
    expect(r.bySource).toEqual([{ key: 's', label: 'Src', total: 3, right: 2 }]);
  });
});
