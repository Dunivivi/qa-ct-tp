import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { BankStore } from '../bank/bank.store';
import { ProgressStore } from '../progress/progress.store';
import { buildPool, pickQuestions, shuffle } from './select';
import { isCorrect, scoreSession, selectCount } from './scoring';
import { SessionItem, TestConfig, TestSession } from './session.model';
import { Attempt } from '../progress/progress.model';

const SESSION_KEY = 'ctpt.session.v1';

function readSession(): TestSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TestSession) : null;
  } catch {
    return null;
  }
}

export class EmptyPoolError extends Error {}

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly bank = inject(BankStore);
  private readonly progress = inject(ProgressStore);

  readonly session = signal<TestSession | null>(readSession());
  readonly active = computed(() => this.session() !== null);
  readonly currentItem = computed(() => {
    const s = this.session();
    return s ? (s.items[s.current] ?? null) : null;
  });
  readonly currentQuestion = computed(() => {
    const it = this.currentItem();
    return it ? (this.bank.byId().get(it.qid) ?? null) : null;
  });
  readonly variant = computed(() => this.session()?.config.variant ?? 'standard');
  /** Survival: the current question was checked and answered wrong, so the run is over. */
  readonly survivalOver = computed(() => {
    const it = this.currentItem();
    const q = this.currentQuestion();
    return this.variant() === 'survival' && !!it?.checked && !!q && !isCorrect(it.answer, q);
  });

  constructor() {
    // Mirrors the running test to storage so a refresh or closed tab can resume it.
    effect(() => {
      const s = this.session();
      try {
        if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        else localStorage.removeItem(SESSION_KEY);
      } catch {
        /* storage unavailable: the test still works, it just can't be resumed */
      }
    });
  }

  /** Size of the pool a config would draw from — drives the builder's live count. */
  poolSize(cfg: TestConfig): number {
    return buildPool(this.bank.questions(), cfg, this.progress.hidden()).length;
  }

  start(cfg: TestConfig): void {
    const byId = this.bank.byId();
    const questions = cfg.questionIds
      ? cfg.questionIds.map((id) => byId.get(id)).filter((q) => q !== undefined)
      : pickQuestions(buildPool(this.bank.questions(), cfg, this.progress.hidden()), cfg, this.progress.stats(), Math.random);
    if (questions.length === 0) throw new EmptyPoolError('No questions match these filters.');

    const now = Date.now();
    const variant = cfg.variant ?? 'standard';
    const mode = variant === 'survival' ? 'practice' : variant === 'blitz' ? 'exam' : cfg.mode;
    const items: SessionItem[] = questions.map((q) => {
      const keys = q.choices.map((c) => c.key);
      return {
        qid: q.id,
        order: cfg.shuffleChoices ? shuffle(keys, Math.random) : keys,
        answer: [],
        flagged: false,
        struck: [],
        checked: false,
        timeMs: 0,
      };
    });
    this.session.set({
      id: `t${now.toString(36)}`,
      config: { ...cfg, variant, mode, count: items.length },
      items,
      current: 0,
      startedAt: now,
      // Blitz times each question instead of the whole test.
      deadline: variant !== 'blitz' && cfg.timeLimitMin > 0 ? now + cfg.timeLimitMin * 60_000 : null,
      pausedAt: null,
      enteredAt: now,
    });
  }

  private patchItem(index: number, fn: (it: SessionItem) => SessionItem): void {
    this.session.update((s) => {
      const it = s?.items[index];
      if (!s || !it) return s;
      const items = [...s.items];
      items[index] = fn(it);
      return { ...s, items };
    });
  }

  choose(key: string): void {
    const s = this.session();
    const q = this.currentQuestion();
    if (!s || !q || this.currentItem()?.checked) return;
    const many = selectCount(q) > 1;
    this.patchItem(s.current, (it) => ({
      ...it,
      answer: many ? (it.answer.includes(key) ? it.answer.filter((k) => k !== key) : [...it.answer, key]) : [key],
      struck: it.struck.filter((k) => k !== key),
    }));
    if (s.config.variant === 'blitz' && !many) this.goTo(s.current + 1);
  }

  toggleStrike(key: string): void {
    const s = this.session();
    if (!s || this.currentItem()?.checked) return;
    this.patchItem(s.current, (it) => ({
      ...it,
      struck: it.struck.includes(key) ? it.struck.filter((k) => k !== key) : [...it.struck, key],
      answer: it.answer.filter((k) => k !== key),
    }));
  }

  toggleFlag(index?: number): void {
    const s = this.session();
    if (s) this.patchItem(index ?? s.current, (it) => ({ ...it, flagged: !it.flagged }));
  }

  check(): void {
    const s = this.session();
    if (s?.config.mode === 'practice') this.patchItem(s.current, (it) => ({ ...it, checked: true }));
  }

  goTo(index: number): void {
    const now = Date.now();
    this.session.update((s) => {
      if (!s || index < 0 || index >= s.items.length || index === s.current) return s;
      const items = [...s.items];
      const cur = items[s.current];
      if (cur) items[s.current] = { ...cur, timeMs: cur.timeMs + (now - s.enteredAt) };
      return { ...s, items, current: index, enteredAt: now };
    });
  }

  pause(): void {
    this.session.update((s) => (s && s.config.mode === 'practice' && !s.pausedAt ? { ...s, pausedAt: Date.now() } : s));
  }

  resume(): void {
    this.session.update((s) => {
      if (!s?.pausedAt) return s;
      const gap = Date.now() - s.pausedAt;
      return { ...s, pausedAt: null, enteredAt: s.enteredAt + gap, deadline: s.deadline === null ? null : s.deadline + gap };
    });
  }

  /** Grades the test, records progress and returns the saved attempt. */
  submit(): Attempt | null {
    const s = this.session();
    if (!s) return null;
    const now = Date.now();
    const timed = s.items.map((it, i) => (i === s.current ? { ...it, timeMs: it.timeMs + (now - s.enteredAt) } : it));
    // A survival run is scored on the questions reached, not the untouched remainder of the pool.
    const items = s.config.variant === 'survival' ? timed.filter((it) => it.checked) : timed;
    const attempt = scoreSession({ ...s, items }, this.bank.byId(), this.bank.sourceById(), now);
    // Unanswered questions aren't evidence of knowledge, so they don't touch per-question stats.
    this.progress.record(attempt.items.filter((i) => i.answer.length > 0).map((i) => ({ qid: i.qid, correct: i.correct })));
    this.progress.addAttempt(attempt);
    this.session.set(null);
    return attempt;
  }

  abandon(): void {
    this.session.set(null);
  }
}
