import { ChapterId, Question } from '../../../core/bank/question.model';
import { SrsCard } from '../../../core/progress/progress.model';
import { Rng, shuffle } from '../../../core/session/select';

export interface LearnFilter {
  readonly sourceId: string | null;
  readonly chapters: readonly ChapterId[];
  readonly includeFlagged: boolean;
}

export interface LearnOverview {
  readonly due: readonly Question[];
  readonly fresh: readonly Question[];
  /** Box 4+ = reviewed successfully across at least a week of gaps. */
  readonly mastered: number;
  readonly learning: number;
  readonly nextDueAt: number | null;
}

export function overview(
  questions: readonly Question[],
  srs: Readonly<Record<string, SrsCard>>,
  filter: LearnFilter,
  hidden: ReadonlySet<string>,
  now: number,
): LearnOverview {
  const chapters = new Set(filter.chapters);
  const inScope = questions.filter(
    (q) =>
      (!filter.sourceId || q.sourceId === filter.sourceId) &&
      q.chapter !== null &&
      chapters.has(q.chapter) &&
      !hidden.has(q.id) &&
      (filter.includeFlagged || q.status !== 'flagged'),
  );
  const due: Question[] = [];
  const fresh: Question[] = [];
  let mastered = 0;
  let learning = 0;
  let nextDueAt: number | null = null;
  for (const q of inScope) {
    const card = srs[q.id];
    if (!card) {
      fresh.push(q);
      continue;
    }
    if (card.box >= 4) mastered++;
    else learning++;
    if (card.due <= now) due.push(q);
    else nextDueAt = nextDueAt === null ? card.due : Math.min(nextDueAt, card.due);
  }
  // Most overdue first.
  due.sort((a, b) => (srs[a.id]?.due ?? 0) - (srs[b.id]?.due ?? 0));
  return { due, fresh, mastered, learning, nextDueAt };
}

/** Reviews come before new cards so a backlog is cleared first; new cards are drawn at random. */
export function buildQueue(view: LearnOverview, newLimit: number, rng: Rng): string[] {
  return [...view.due.map((q) => q.id), ...shuffle(view.fresh, rng).slice(0, newLimit).map((q) => q.id)];
}
