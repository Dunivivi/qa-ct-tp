import { Question } from '../../../core/bank/question.model';
import { SRS_INTERVALS_MIN, nextSrs } from '../../../core/progress/progress.model';
import { seededRng } from '../../../core/session/select';
import { buildQueue, overview } from './learn-queue';

function mk(id: string, chapter: Question['chapter'] = 1, status: Question['status'] = 'confirmed'): Question {
  return {
    id, sourceId: 's', number: 1, chapter, learningObjective: null, scenario: null, text: id, images: [],
    choices: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correct: ['A'], why: null,
    outdatedSourceExplanation: null, extraNotes: null, status, statusNote: null, sourceAnswer: null, alsoAppearsIn: [], url: null,
  };
}

const filter = { sourceId: null, chapters: [1, 2, 3, 4, 5] as const, includeFlagged: false };

describe('nextSrs', () => {
  it('promotes on a right answer and resets to box 1 on a miss', () => {
    const a = nextSrs(undefined, true, 0);
    expect(a.box).toBe(1);
    expect(a.due).toBe((SRS_INTERVALS_MIN[0] ?? 0) * 60_000);
    const b = nextSrs({ box: 3, due: 0, reviews: 3 }, true, 0);
    expect(b.box).toBe(4);
    expect(nextSrs(b, false, 0).box).toBe(1);
  });

  it('caps at the last box', () => {
    expect(nextSrs({ box: SRS_INTERVALS_MIN.length, due: 0, reviews: 9 }, true, 0).box).toBe(SRS_INTERVALS_MIN.length);
  });
});

describe('learn overview and queue', () => {
  const qs = [mk('due-old'), mk('due-new'), mk('later'), mk('fresh1'), mk('fresh2'), mk('flagged', 1, 'flagged'), mk('ch5', 5)];
  const srs = {
    'due-old': { box: 2, due: 100, reviews: 2 },
    'due-new': { box: 1, due: 500, reviews: 1 },
    later: { box: 5, due: 99_999, reviews: 5 },
  };

  it('splits due, new and mastered, skipping flagged and filtered chapters', () => {
    const v = overview(qs, srs, { ...filter, chapters: [1] }, new Set(), 1000);
    expect(v.due.map((q) => q.id)).toEqual(['due-old', 'due-new']);
    expect(v.fresh.map((q) => q.id).sort()).toEqual(['fresh1', 'fresh2']);
    expect(v.mastered).toBe(1);
    expect(v.nextDueAt).toBe(99_999);
  });

  it('queues due reviews before a limited number of new cards', () => {
    const v = overview(qs, srs, filter, new Set(), 1000);
    const q = buildQueue(v, 1, seededRng(4));
    expect(q.slice(0, 2)).toEqual(['due-old', 'due-new']);
    expect(q.length).toBe(3);
  });
});
