import {
  CHAPTERS,
  ChapterId,
  Choice,
  Question,
  QuestionSource,
  SourceKind,
  SourceOrigin,
  VerificationStatus,
} from './question.model';

interface KnownSource {
  readonly prefix: string;
  readonly id: string;
  readonly label: string;
  readonly kind: SourceKind;
  readonly order: number;
}

/** Display order mirrors trust: official boards first, then the verified practice banks. */
const KNOWN_SOURCES: readonly KnownSource[] = [
  { prefix: 'istqb-official', id: 'istqb', label: 'ISTQB · Sample Exam A', kind: 'official', order: 1 },
  { prefix: 'astqb-official', id: 'astqb', label: 'ASTQB · Sample 2019', kind: 'official', order: 2 },
  { prefix: 'mockexamnetwork', id: 'mockexamnetwork', label: 'Mock Exam Network', kind: 'verified', order: 10 },
  { prefix: 'examcademy', id: 'examcademy', label: 'ExamCademy', kind: 'verified', order: 11 },
  { prefix: 'openexamprep', id: 'openexamprep', label: 'OpenExamPrep', kind: 'verified', order: 12 },
  { prefix: 'unofficial-sites', id: 'other-sites', label: 'Other sites', kind: 'verified', order: 13 },
  { prefix: 'certempire', id: 'certempire', label: 'CertEmpire', kind: 'verified', order: 14 },
];

export class SourceFormatError extends Error {}

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'source';
}

function chapterFrom(q: Raw): ChapterId | null {
  const lo = str(q['learningObjective']);
  const fromLo = lo?.match(/PTFL-(\d)/)?.[1];
  if (fromLo) {
    const n = Number(fromLo);
    if (n >= 1 && n <= 5) return n as ChapterId;
  }
  const name = (str(q['chapter']) ?? str(q['topic']) ?? '').toLowerCase();
  return CHAPTERS.find((c) => c.name.toLowerCase() === name)?.id ?? null;
}

function statusFrom(q: Raw, kind: SourceKind): { status: VerificationStatus; note: string | null } {
  const v = q['verification'];
  if (isRecord(v)) {
    const s = str(v['status']);
    const note = str(v['note']);
    // 'corrected-earlier' = fixed in a first review, re-confirmed in the second.
    if (s === 'corrected' || s === 'corrected-earlier') return { status: 'corrected', note: note ?? str(q['correctionReason']) };
    if (s === 'confirmed' || s === 'multiple-correct' || s === 'flagged') return { status: s, note };
  }
  return { status: kind === 'official' ? 'official' : 'unverified', note: null };
}

function choicesFrom(v: unknown): Choice[] {
  if (!isRecord(v)) return [];
  return Object.entries(v)
    .filter((e): e is [string, string] => typeof e[1] === 'string')
    .map(([key, text]) => ({ key, text }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function joinUrl(base: string, path: string): string {
  if (/^(https?:|data:|\/)/.test(path)) return path;
  return base.replace(/\/?$/, '/') + path;
}

function normalizeQuestion(q: Raw, source: { id: string; kind: SourceKind }, baseUrl: string): Question | null {
  const number = typeof q['number'] === 'number' ? q['number'] : null;
  const text = str(q['question']);
  const choices = choicesFrom(q['choices']);
  const correct = strList(q['correctAnswers']).filter((k) => choices.some((c) => c.key === k));
  if (number === null || text === null || choices.length < 2 || correct.length === 0) return null;

  const { status, note } = statusFrom(q, source.kind);
  const explanation = str(q['explanation']);
  const sourceAnswer = strList(q['sourceAnswer']);
  // A corrected answer's original explanation argues for the old answer, so the reviewer's note becomes the reason.
  const corrected = status === 'corrected' && note !== null;
  const why = corrected ? note : (explanation ?? note);
  const outdated = corrected && explanation !== null && explanation !== note ? explanation : null;

  const extras = [str(q['whyOthersAreIncorrect']), str(q['references'])].filter((x): x is string => x !== null);

  return {
    id: `${source.id}#${number}`,
    sourceId: source.id,
    number,
    chapter: chapterFrom(q),
    learningObjective: str(q['learningObjective']),
    scenario: str(q['scenario']),
    text,
    images: strList(q['images']).map((p) => joinUrl(baseUrl, p)),
    choices,
    correct,
    why,
    outdatedSourceExplanation: outdated,
    extraNotes: extras.length ? extras.join('\n\n') : null,
    status,
    statusNote: corrected ? null : note,
    sourceAnswer: sourceAnswer.length ? sourceAnswer : null,
    alsoAppearsIn: strList(q['alsoAppearsIn']),
    url: str(q['url']),
  };
}

/**
 * Turns one question-bank JSON file (any of the formats collected so far) into a source.
 * Invalid questions are dropped rather than failing the whole file; a file with none left is an error.
 */
export function normalizeSourceFile(fileName: string, raw: unknown, baseUrl: string, origin: SourceOrigin): QuestionSource {
  if (!isRecord(raw) || !Array.isArray(raw['questions'])) {
    throw new SourceFormatError(`${fileName}: expected an object with a "questions" array`);
  }
  const known = KNOWN_SOURCES.find((k) => fileName.startsWith(k.prefix));
  const id = known?.id ?? slug(str(raw['site']) ?? fileName.replace(/\.json$/i, ''));
  const kind: SourceKind = known?.kind ?? 'other';
  const questions = raw['questions']
    .filter(isRecord)
    .map((q) => normalizeQuestion(q, { id, kind }, baseUrl))
    .filter((q): q is Question => q !== null);
  if (questions.length === 0) throw new SourceFormatError(`${fileName}: no valid questions found`);

  return {
    id,
    label: known?.label ?? str(raw['site']) ?? fileName,
    kind,
    order: known?.order ?? 100,
    origin,
    fileName,
    questions,
  };
}
