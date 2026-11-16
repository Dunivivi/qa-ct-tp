import { ChapterId, EXAM_BLUEPRINT, Question } from '../bank/question.model';
import { QuestionStat } from '../progress/progress.model';
import { ChapterFilter, TestConfig } from './session.model';

export type Rng = () => number;

/** Small seeded PRNG so selection is reproducible in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Questions matching the config's sources, chapters and filters (no count limit). */
export function buildPool(
  questions: readonly Question[],
  cfg: Pick<TestConfig, 'sourceIds' | 'chapters' | 'includeFlagged'>,
  hidden: ReadonlySet<string>,
): Question[] {
  const sources = new Set(cfg.sourceIds);
  const chapters = new Set<ChapterFilter>(cfg.chapters);
  return questions.filter(
    (q) =>
      sources.has(q.sourceId) &&
      chapters.has(q.chapter ?? 0) &&
      !hidden.has(q.id) &&
      (cfg.includeFlagged || q.status !== 'flagged'),
  );
}

/** Splits `total` across chapters in blueprint proportion (largest remainder), only over chapters that have questions. */
export function allocate(total: number, available: ReadonlyMap<ChapterId, number>): Map<ChapterId, number> {
  const chapters = [...available.keys()];
  const weight = chapters.reduce((s, c) => s + EXAM_BLUEPRINT[c], 0);
  const out = new Map<ChapterId, number>();
  if (weight === 0) return out;
  const exact = chapters.map((c) => ({ c, v: (total * EXAM_BLUEPRINT[c]) / weight }));
  for (const { c, v } of exact) out.set(c, Math.min(Math.floor(v), available.get(c) ?? 0));
  let left = total - [...out.values()].reduce((s, n) => s + n, 0);
  // Hand out the remainder by largest fraction, then fill any chapter that still has spare questions.
  const byFraction = [...exact].sort((a, b) => (b.v % 1) - (a.v % 1));
  for (const pass of [byFraction, byFraction]) {
    for (const { c } of pass) {
      if (left === 0) break;
      if ((out.get(c) ?? 0) < (available.get(c) ?? 0)) {
        out.set(c, (out.get(c) ?? 0) + 1);
        left--;
      }
    }
  }
  while (left > 0) {
    const c = chapters.find((ch) => (out.get(ch) ?? 0) < (available.get(ch) ?? 0));
    if (c === undefined) break;
    out.set(c, (out.get(c) ?? 0) + 1);
    left--;
  }
  return out;
}

/** Lower tier is picked first; ties are random. */
function tier(q: Question, cfg: TestConfig, stats: Readonly<Record<string, QuestionStat>>): number {
  const s = stats[q.id];
  if (cfg.preferWrong && s && s.wrong > 0 && !s.lastRight) return 0;
  if (cfg.preferUnseen && !s) return 1;
  return 2;
}

function prioritise(pool: readonly Question[], cfg: TestConfig, stats: Readonly<Record<string, QuestionStat>>, rng: Rng): Question[] {
  return shuffle(pool, rng)
    .map((q, i) => ({ q, t: tier(q, cfg, stats), i }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.q);
}

export function pickQuestions(
  pool: readonly Question[],
  cfg: TestConfig,
  stats: Readonly<Record<string, QuestionStat>>,
  rng: Rng,
): Question[] {
  const count = Math.min(cfg.count, pool.length);
  if (!cfg.weighted) return shuffle(prioritise(pool, cfg, stats, rng).slice(0, count), rng);

  const byChapter = new Map<ChapterId, Question[]>();
  const unmapped: Question[] = [];
  for (const q of pool) {
    if (q.chapter === null) unmapped.push(q);
    else byChapter.set(q.chapter, [...(byChapter.get(q.chapter) ?? []), q]);
  }
  const plan = allocate(count, new Map([...byChapter].map(([c, qs]) => [c, qs.length])));
  const picked = [...plan].flatMap(([c, n]) => prioritise(byChapter.get(c) ?? [], cfg, stats, rng).slice(0, n));
  // Unmapped questions only top up a test the blueprint chapters couldn't fill.
  const topUp = prioritise(unmapped, cfg, stats, rng).slice(0, count - picked.length);
  return shuffle([...picked, ...topUp], rng);
}
