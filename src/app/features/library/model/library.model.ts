import { CHAPTERS, ChapterId, Question, QuestionSource, SourceKind } from '../../../core/bank/question.model';
import { QuestionStat } from '../../../core/progress/progress.model';

export const ALL_SOURCES = 'all';

export interface SourceSummary {
  readonly id: string;
  readonly label: string;
  readonly kind: SourceKind;
  readonly count: number;
  readonly corrected: number;
  readonly flagged: number;
}

export interface ModuleSummary {
  readonly chapter: ChapterId | 0;
  readonly name: string;
  readonly count: number;
  readonly seen: number;
  /** null until at least one question in the module has been answered. */
  readonly accuracy: number | null;
}

export function summarizeSources(sources: readonly QuestionSource[]): SourceSummary[] {
  return sources.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    count: s.questions.length,
    corrected: s.questions.filter((q) => q.status === 'corrected').length,
    flagged: s.questions.filter((q) => q.status === 'flagged').length,
  }));
}

export function summarizeModules(questions: readonly Question[], stats: Readonly<Record<string, QuestionStat>>): ModuleSummary[] {
  const groups: { chapter: ChapterId | 0; name: string }[] = [
    ...CHAPTERS.map((c) => ({ chapter: c.id, name: c.name })),
    { chapter: 0, name: 'Unmapped' },
  ];
  return groups
    .map(({ chapter, name }) => {
      const qs = questions.filter((q) => (q.chapter ?? 0) === chapter);
      const seen = qs.filter((q) => stats[q.id]);
      const right = seen.reduce((n, q) => n + (stats[q.id]?.right ?? 0), 0);
      const answered = seen.reduce((n, q) => n + (stats[q.id]?.seen ?? 0), 0);
      return { chapter, name, count: qs.length, seen: seen.length, accuracy: answered ? Math.round((right / answered) * 100) : null };
    })
    .filter((m) => m.count > 0);
}
