export type ChapterId = 1 | 2 | 3 | 4 | 5;

export interface Chapter {
  readonly id: ChapterId;
  readonly name: string;
}

/** ISTQB CT-PT syllabus v1.0 (2018) chapters. */
export const CHAPTERS: readonly Chapter[] = [
  { id: 1, name: 'Basic Concepts' },
  { id: 2, name: 'Performance Measurement Fundamentals' },
  { id: 3, name: 'Performance Testing in the Software Lifecycle' },
  { id: 4, name: 'Performance Testing Tasks' },
  { id: 5, name: 'Tools' },
];

/**
 * Questions per chapter in the ISTQB-authored Sample Exam A (and ASTQB 2019),
 * used as the real-exam blueprint for weighted tests.
 */
export const EXAM_BLUEPRINT: Readonly<Record<ChapterId, number>> = { 1: 6, 2: 4, 3: 7, 4: 20, 5: 3 };
export const EXAM_SIZE = 40;
export const EXAM_MINUTES = 90;
export const PASS_PERCENT = 65;

export type VerificationStatus =
  | 'official'
  | 'confirmed'
  | 'corrected'
  | 'multiple-correct'
  | 'flagged'
  | 'unverified';

export type SourceKind = 'official' | 'verified' | 'other';
export type SourceOrigin = 'bundled' | 'local' | 'imported';

export interface Choice {
  readonly key: string;
  readonly text: string;
}

export interface Question {
  /** Stable across reloads: `${sourceId}#${number}`. */
  readonly id: string;
  readonly sourceId: string;
  readonly number: number;
  readonly chapter: ChapterId | null;
  readonly learningObjective: string | null;
  readonly scenario: string | null;
  readonly text: string;
  readonly images: readonly string[];
  readonly choices: readonly Choice[];
  readonly correct: readonly string[];
  /** The reason the correct answer is right — the reviewer's note when the answer was corrected. */
  readonly why: string | null;
  /** The source's own explanation when it no longer matches the answer (corrected questions). */
  readonly outdatedSourceExplanation: string | null;
  readonly extraNotes: string | null;
  readonly status: VerificationStatus;
  readonly statusNote: string | null;
  readonly sourceAnswer: readonly string[] | null;
  readonly alsoAppearsIn: readonly string[];
  readonly url: string | null;
}

export interface QuestionSource {
  readonly id: string;
  readonly label: string;
  readonly kind: SourceKind;
  readonly order: number;
  readonly origin: SourceOrigin;
  readonly fileName: string;
  readonly questions: readonly Question[];
}

export function chapterName(id: ChapterId | null): string {
  return id === null ? 'Unmapped' : (CHAPTERS.find((c) => c.id === id)?.name ?? 'Unmapped');
}
