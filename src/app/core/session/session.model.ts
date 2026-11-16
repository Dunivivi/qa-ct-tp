import { ChapterId } from '../bank/question.model';
import { TestVariant } from '../progress/progress.model';

export type TestMode = 'exam' | 'practice';

/** `0` stands for questions without a chapter. */
export type ChapterFilter = ChapterId | 0;

export interface TestConfig {
  readonly label: string;
  readonly sourceIds: readonly string[];
  readonly chapters: readonly ChapterFilter[];
  readonly count: number;
  /** 0 = no time limit. */
  readonly timeLimitMin: number;
  readonly mode: TestMode;
  /** survival: ends at the first wrong answer · blitz: per-question timer, auto-advance. */
  readonly variant: TestVariant;
  /** Blitz only: seconds allowed per question. */
  readonly secondsPerQuestion: number;
  /** Spread questions across chapters like the real exam (Sample Exam A blueprint). */
  readonly weighted: boolean;
  readonly includeFlagged: boolean;
  readonly preferUnseen: boolean;
  readonly preferWrong: boolean;
  readonly shuffleChoices: boolean;
  /** Fixed question list (e.g. "retake wrong answers"); overrides the filters above. */
  readonly questionIds?: readonly string[];
}

export interface SessionItem {
  readonly qid: string;
  /** Choice keys in display order. */
  readonly order: readonly string[];
  readonly answer: readonly string[];
  readonly flagged: boolean;
  readonly struck: readonly string[];
  /** Practice mode: the answer has been checked and the explanation shown. */
  readonly checked: boolean;
  readonly timeMs: number;
}

export interface TestSession {
  readonly id: string;
  readonly config: TestConfig;
  readonly items: readonly SessionItem[];
  readonly current: number;
  readonly startedAt: number;
  /** Epoch ms when time runs out; null = untimed. Shifted forward when a practice test is resumed. */
  readonly deadline: number | null;
  readonly pausedAt: number | null;
  /** When the current question was opened, for per-question timing. */
  readonly enteredAt: number;
}

export const DEFAULT_CONFIG: TestConfig = {
  label: 'Custom test',
  sourceIds: [],
  chapters: [1, 2, 3, 4, 5, 0],
  count: 40,
  timeLimitMin: 90,
  // Answer + explanation after each question is the default; the real-exam preset switches to 'exam'.
  mode: 'practice',
  variant: 'standard',
  secondsPerQuestion: 15,
  weighted: true,
  includeFlagged: false,
  preferUnseen: true,
  preferWrong: false,
  shuffleChoices: true,
};
