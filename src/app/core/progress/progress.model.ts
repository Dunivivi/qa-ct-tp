export interface QuestionStat {
  readonly seen: number;
  readonly right: number;
  readonly wrong: number;
  readonly lastAt: number;
  readonly lastRight: boolean;
}

/** Leitner-style spaced-repetition state: a higher box means a longer gap before the next review. */
export interface SrsCard {
  readonly box: number;
  readonly due: number;
  readonly reviews: number;
}

/** Review gap per box, in minutes: 10 min, 1 day, 3 days, 1 week, 16 days, 5 weeks. */
export const SRS_INTERVALS_MIN = [10, 1440, 4320, 10080, 23040, 50400] as const;

export function nextSrs(card: SrsCard | undefined, correct: boolean, now: number): SrsCard {
  const box = correct ? Math.min((card?.box ?? 0) + 1, SRS_INTERVALS_MIN.length) : 1;
  const gap = SRS_INTERVALS_MIN[box - 1] ?? SRS_INTERVALS_MIN[0];
  return { box, due: now + gap * 60_000, reviews: (card?.reviews ?? 0) + 1 };
}

export type TestVariant = 'standard' | 'survival' | 'blitz';

export interface AttemptItem {
  readonly qid: string;
  readonly answer: readonly string[];
  readonly correct: boolean;
  readonly flagged: boolean;
  readonly timeMs: number;
}

export interface Breakdown {
  readonly key: string;
  readonly label: string;
  readonly total: number;
  readonly right: number;
}

export interface Attempt {
  readonly id: string;
  readonly label: string;
  readonly mode: 'exam' | 'practice';
  /** Absent on attempts saved before variants existed. */
  readonly variant?: TestVariant;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly timeLimitMin: number;
  readonly items: readonly AttemptItem[];
  readonly total: number;
  readonly right: number;
  readonly unanswered: number;
  readonly percent: number;
  readonly passed: boolean;
  readonly byChapter: readonly Breakdown[];
  readonly bySource: readonly Breakdown[];
}

export interface Progress {
  readonly stats: Readonly<Record<string, QuestionStat>>;
  readonly bookmarks: readonly string[];
  readonly notes: Readonly<Record<string, string>>;
  readonly hidden: readonly string[];
  readonly srs: Readonly<Record<string, SrsCard>>;
}

export const EMPTY_PROGRESS: Progress = { stats: {}, bookmarks: [], notes: {}, hidden: [], srs: {} };
