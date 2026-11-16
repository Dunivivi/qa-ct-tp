import { SourceFormatError, normalizeSourceFile } from './normalize';

const q = (over: Record<string, unknown> = {}) => ({
  number: 1,
  question: 'What is X?',
  choices: { A: 'one', B: 'two', C: 'three', D: 'four' },
  correctAnswers: ['B'],
  explanation: 'Because two.',
  ...over,
});

describe('normalizeSourceFile', () => {
  it('maps a known file prefix to its source id, label and kind', () => {
    const s = normalizeSourceFile('istqb-official-ct-pt-sample-exam-a.json', { questions: [q({ learningObjective: 'PTFL-4.2.1' })] }, 'data/official/', 'bundled');
    expect(s.id).toBe('istqb');
    expect(s.kind).toBe('official');
    expect(s.questions[0]?.chapter).toBe(4);
    expect(s.questions[0]?.status).toBe('official');
    expect(s.questions[0]?.id).toBe('istqb#1');
  });

  it('derives the chapter from chapter or topic names', () => {
    const s = normalizeSourceFile(
      'mockexamnetwork-x.json',
      { questions: [q({ chapter: 'Tools' }), q({ number: 2, topic: 'Basic Concepts' }), q({ number: 3 })] },
      '',
      'local',
    );
    expect(s.questions.map((x) => x.chapter)).toEqual([5, 1, null]);
  });

  it('uses the reviewer note as the reason for a corrected answer and keeps the old explanation aside', () => {
    const s = normalizeSourceFile(
      'examcademy-x.json',
      { questions: [q({ correctAnswers: ['D'], sourceAnswer: ['C'], verification: { status: 'corrected', note: 'Syllabus 2.3 says D.' } })] },
      '',
      'local',
    );
    const item = s.questions[0];
    expect(item?.status).toBe('corrected');
    expect(item?.why).toBe('Syllabus 2.3 says D.');
    expect(item?.outdatedSourceExplanation).toBe('Because two.');
    expect(item?.sourceAnswer).toEqual(['C']);
    expect(item?.statusNote).toBeNull();
  });

  it('treats corrected-earlier as corrected', () => {
    const s = normalizeSourceFile('certempire-x.json', { questions: [q({ verification: { status: 'corrected-earlier' }, correctionReason: 'fixed' })] }, '', 'local');
    expect(s.questions[0]?.status).toBe('corrected');
    expect(s.questions[0]?.why).toBe('fixed');
  });

  it('drops invalid questions and answer keys that are not among the choices', () => {
    const s = normalizeSourceFile('x.json', { site: 'Some Site', questions: [q(), { number: 2 }, q({ number: 3, correctAnswers: ['Z'] })] }, '', 'imported');
    expect(s.questions.map((x) => x.number)).toEqual([1]);
    expect(s.id).toBe('some-site');
    expect(s.kind).toBe('other');
  });

  it('resolves relative image paths against the folder', () => {
    const s = normalizeSourceFile('astqb-official-x.json', { questions: [q({ images: ['charts/p1.png', 'https://cdn/x.png'] })] }, 'data/official/', 'bundled');
    expect(s.questions[0]?.images).toEqual(['data/official/charts/p1.png', 'https://cdn/x.png']);
  });

  it('rejects files without valid questions', () => {
    expect(() => normalizeSourceFile('bad.json', { nope: 1 }, '', 'imported')).toThrow(SourceFormatError);
    expect(() => normalizeSourceFile('bad.json', { questions: [{}] }, '', 'imported')).toThrow(SourceFormatError);
  });
});
