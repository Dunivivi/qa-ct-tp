import { Injectable, computed, effect, signal } from '@angular/core';
import { Attempt, EMPTY_PROGRESS, Progress, QuestionStat, nextSrs } from './progress.model';

const PROGRESS_KEY = 'ctpt.progress.v1';
const ATTEMPTS_KEY = 'ctpt.attempts.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Private mode, cleared storage or a corrupt value: start fresh rather than break the app.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode: progress just won't persist this session.
  }
}

@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly progress = signal<Progress>({ ...EMPTY_PROGRESS, ...read<Partial<Progress>>(PROGRESS_KEY, {}) });
  readonly attempts = signal<readonly Attempt[]>(read<Attempt[]>(ATTEMPTS_KEY, []));

  readonly stats = computed(() => this.progress().stats);
  readonly bookmarks = computed(() => new Set(this.progress().bookmarks));
  readonly hidden = computed(() => new Set(this.progress().hidden));
  readonly notes = computed(() => this.progress().notes);
  readonly srs = computed(() => this.progress().srs);

  constructor() {
    // Persisting is a side effect on browser storage, not derived state, hence an effect.
    effect(() => write(PROGRESS_KEY, this.progress()));
    effect(() => write(ATTEMPTS_KEY, this.attempts()));
  }

  record(results: readonly { qid: string; correct: boolean }[]): void {
    const now = Date.now();
    this.progress.update((p) => {
      const stats: Record<string, QuestionStat> = { ...p.stats };
      for (const { qid, correct } of results) {
        const s = stats[qid] ?? { seen: 0, right: 0, wrong: 0, lastAt: 0, lastRight: false };
        stats[qid] = {
          seen: s.seen + 1,
          right: s.right + (correct ? 1 : 0),
          wrong: s.wrong + (correct ? 0 : 1),
          lastAt: now,
          lastRight: correct,
        };
      }
      return { ...p, stats };
    });
  }

  /** One spaced-repetition review: also counts as an answer in the per-question stats. */
  review(qid: string, correct: boolean): void {
    const now = Date.now();
    this.progress.update((p) => ({ ...p, srs: { ...p.srs, [qid]: nextSrs(p.srs[qid], correct, now) } }));
    this.record([{ qid, correct }]);
  }

  addAttempt(a: Attempt): void {
    this.attempts.update((list) => [a, ...list]);
  }

  removeAttempt(id: string): void {
    this.attempts.update((list) => list.filter((a) => a.id !== id));
  }

  toggleBookmark(qid: string): void {
    this.progress.update((p) => ({ ...p, bookmarks: toggle(p.bookmarks, qid) }));
  }

  toggleHidden(qid: string): void {
    this.progress.update((p) => ({ ...p, hidden: toggle(p.hidden, qid) }));
  }

  setNote(qid: string, text: string): void {
    this.progress.update((p) => {
      const notes = { ...p.notes };
      if (text.trim()) notes[qid] = text;
      else delete notes[qid];
      return { ...p, notes };
    });
  }

  /** Everything this browser knows about the user's study, for backup or moving browsers. */
  exportBackup(): ProgressBackup {
    return { app: 'ctpt-practice', version: 1, exportedAt: new Date().toISOString(), progress: this.progress(), attempts: this.attempts() };
  }

  /** Replaces local progress with a backup; throws (changing nothing) if the file isn't one. */
  restoreBackup(raw: unknown): { attempts: number; answered: number } {
    if (!isBackup(raw)) throw new Error('This file is not a CT-PT Practice backup.');
    this.progress.set({ ...EMPTY_PROGRESS, ...raw.progress });
    this.attempts.set(raw.attempts);
    return { attempts: raw.attempts.length, answered: Object.keys(raw.progress.stats).length };
  }

  resetAll(): void {
    this.progress.set(EMPTY_PROGRESS);
    this.attempts.set([]);
  }
}

export interface ProgressBackup {
  readonly app: 'ctpt-practice';
  readonly version: 1;
  readonly exportedAt: string;
  readonly progress: Progress;
  readonly attempts: readonly Attempt[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isBackup(v: unknown): v is ProgressBackup {
  if (!isObj(v) || v['app'] !== 'ctpt-practice' || v['version'] !== 1) return false;
  const p = v['progress'];
  return (
    isObj(p) &&
    isObj(p['stats']) &&
    Array.isArray(p['bookmarks']) &&
    isObj(p['notes']) &&
    Array.isArray(p['hidden']) &&
    (p['srs'] === undefined || isObj(p['srs'])) &&
    Array.isArray(v['attempts']) &&
    v['attempts'].every((a) => isObj(a) && typeof a['id'] === 'string' && Array.isArray(a['items']))
  );
}

function toggle(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
