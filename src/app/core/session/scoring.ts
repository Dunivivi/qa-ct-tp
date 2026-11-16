import { PASS_PERCENT, Question, QuestionSource, chapterName } from '../bank/question.model';
import { Attempt, AttemptItem, Breakdown } from '../progress/progress.model';
import { SessionItem, TestSession } from './session.model';

/**
 * 'multiple-correct' questions are single-choice items where the syllabus supports more than
 * one option, so any of them counts. Otherwise the selection must match the key exactly.
 */
export function isCorrect(answer: readonly string[], q: Question): boolean {
  if (answer.length === 0) return false;
  if (q.status === 'multiple-correct') return answer.length === 1 && q.correct.includes(answer[0] ?? '');
  return answer.length === q.correct.length && answer.every((a) => q.correct.includes(a));
}

/** How many options the user must pick. */
export function selectCount(q: Question): number {
  return q.status === 'multiple-correct' ? 1 : q.correct.length;
}

function breakdown(items: readonly { key: string; label: string; correct: boolean }[]): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const { key, label, correct } of items) {
    const b = map.get(key) ?? { key, label, total: 0, right: 0 };
    map.set(key, { ...b, total: b.total + 1, right: b.right + (correct ? 1 : 0) });
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function scoreSession(
  session: TestSession,
  byId: ReadonlyMap<string, Question>,
  sources: ReadonlyMap<string, QuestionSource>,
  finishedAt: number,
): Attempt {
  const graded = session.items
    .map((it: SessionItem) => ({ it, q: byId.get(it.qid) }))
    .filter((x): x is { it: SessionItem; q: Question } => x.q !== undefined);

  const items: AttemptItem[] = graded.map(({ it, q }) => ({
    qid: it.qid,
    answer: it.answer,
    correct: isCorrect(it.answer, q),
    flagged: it.flagged,
    timeMs: it.timeMs,
  }));
  const right = items.filter((i) => i.correct).length;
  const percent = items.length ? Math.round((right / items.length) * 100) : 0;

  return {
    id: session.id,
    label: session.config.label,
    mode: session.config.mode,
    variant: session.config.variant,
    startedAt: session.startedAt,
    finishedAt,
    timeLimitMin: session.config.timeLimitMin,
    items,
    total: items.length,
    right,
    unanswered: items.filter((i) => i.answer.length === 0).length,
    percent,
    passed: percent >= PASS_PERCENT,
    byChapter: breakdown(
      graded.map(({ q }, i) => ({ key: String(q.chapter ?? 9), label: chapterName(q.chapter), correct: items[i]?.correct ?? false })),
    ),
    bySource: breakdown(
      graded.map(({ q }, i) => ({ key: q.sourceId, label: sources.get(q.sourceId)?.label ?? q.sourceId, correct: items[i]?.correct ?? false })),
    ),
  };
}
