import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BankStore } from '../../../core/bank/bank.store';
import { AnswerExplanation } from '../../../core/bank/ui/answer-explanation';
import { chapterName } from '../../../core/bank/question.model';
import { isCorrect, selectCount } from '../../../core/session/scoring';
import { SessionStore } from '../../../core/session/session.store';
import { ProgressStore } from '../../../core/progress/progress.store';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { RichText } from '../../../shared/ui/rich-text';
import { NavCell, Navigator } from '../ui/navigator';

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
const CELL = 'h-10 rounded-md text-sm font-medium';

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

@Component({
  selector: 'app-test-runner-page',
  imports: [RouterLink, ButtonDirective, RichText, AnswerExplanation, Navigator],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    @if (!session()) {
      <div class="mx-auto my-16 flex max-w-lg flex-col items-center gap-4 text-center">
        <h1 class="m-0 font-display text-2xl font-semibold">No test in progress</h1>
        <p class="m-0 text-muted">Build one from the library.</p>
        <a uiBtn="primary" routerLink="/">Go to library</a>
      </div>
    } @else if (bank.isLoading() && !question()) {
      <p class="p-8 text-muted" role="status">Loading questions…</p>
    } @else if (!question()) {
      <div class="m-8 rounded-xl bg-bad-50 p-6 text-bad-700" role="alert">
        <p class="mt-0">This question is no longer in the bank (its file may have been removed).</p>
        <button uiBtn type="button" (click)="next()">Skip</button>
      </div>
    } @else {
      <div class="flex flex-col">
        <div class="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:px-8">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-subtle">{{ label() }}</div>
            <div class="font-semibold">Question {{ position() }} of {{ total() }}</div>
          </div>
          <div class="text-sm text-muted">{{ answeredLabel() }}</div>
          @if (hasTimer()) {
            <div [class]="timerClass()" role="timer" [attr.aria-label]="'Time left ' + timeLeft()">{{ timeLeft() }}</div>
          }
          <button uiBtn="ghost" size="sm" type="button" [attr.aria-pressed]="fullscreen()" (click)="toggleFullscreen()">{{ fullscreenLabel() }}</button>
          @if (canPause()) {
            <button uiBtn size="sm" type="button" (click)="store.pause()">Pause</button>
          }
          <button uiBtn="primary" size="sm" type="button" (click)="reviewing.set(true)">Review & submit</button>
        </div>

        @if (paused()) {
          <div class="mx-auto my-16 flex max-w-md flex-col items-center gap-4 text-center">
            <h2 class="m-0 font-display text-2xl">Paused</h2>
            <p class="m-0 text-muted">The clock is stopped.</p>
            <button uiBtn="primary" type="button" (click)="store.resume()">Resume</button>
          </div>
        } @else if (reviewing()) {
          <section class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8" aria-labelledby="rv-title">
            <h2 id="rv-title" class="m-0 font-display text-2xl font-semibold">Review before submitting</h2>
            <p class="m-0 text-muted">{{ reviewSummary() }}</p>
            <app-navigator [cells]="cells()" (go)="jump($event)" />
            <div class="flex flex-wrap gap-2 pt-2">
              <button uiBtn type="button" (click)="reviewing.set(false)">Back to questions</button>
              <button uiBtn="primary" type="button" (click)="confirmSubmit()">Submit test</button>
              <button uiBtn="danger" type="button" class="ml-auto" (click)="abandon()">Abandon test</button>
            </div>
          </section>
        } @else {
          <div class="flex flex-wrap items-start gap-6 px-4 py-6 sm:px-8">
            <main class="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
              <div class="flex flex-wrap gap-2 text-xs text-subtle">
                <span>{{ chapter() }}</span>
                @if (flagged()) {
                  <span class="font-semibold text-warn-700">· Flagged for review</span>
                }
              </div>

              @if (question()?.scenario; as sc) {
                <details class="rounded-xl bg-inset p-4 text-sm" open>
                  <summary class="cursor-pointer font-medium">Scenario</summary>
                  <ui-rich-text class="mt-2 block leading-relaxed text-ink-2" [text]="sc" />
                </details>
              }
              <ui-rich-text class="block font-display text-xl leading-snug font-medium" [text]="questionText()" />
              @for (img of images(); track img) {
                <img [src]="img" alt="Figure for this question" class="max-w-full rounded-lg border border-line" />
              }
              <p class="m-0 text-sm text-subtle">{{ instruction() }}</p>

              <ul class="m-0 flex list-none flex-col gap-2 p-0" [attr.aria-label]="instruction()">
                @for (c of choiceRows(); track c.key) {
                  <li class="flex items-stretch gap-2">
                    <button type="button" [class]="c.classes" [attr.aria-pressed]="c.selected" [disabled]="checked()" (click)="pick(c.key)">
                      <span class="w-5 shrink-0 font-semibold">{{ c.key }}</span>
                      <span [class]="c.textClass">{{ c.text }}</span>
                      @if (c.mark) {
                        <span class="ml-auto shrink-0 text-xs font-semibold">{{ c.mark }}</span>
                      }
                    </button>
                    <button uiBtn="ghost" size="sm" type="button" class="self-center" [disabled]="checked()" [attr.aria-label]="c.strikeLabel" [attr.aria-pressed]="c.struck" (click)="store.toggleStrike(c.key)">✕</button>
                  </li>
                }
              </ul>

              @if (isPractice() && !checked()) {
                <div>
                  <button uiBtn="primary" type="button" [disabled]="!hasAnswer()" (click)="store.check()">Check answer</button>
                </div>
              }
              @if (checked()) {
                <p [class]="verdictClass()" role="status">{{ verdict() }}</p>
                @if (survivalOver()) {
                  <p class="m-0 rounded-lg bg-inverse p-3 font-semibold text-on-inverse" role="status">Run over — streak {{ streak() }}. {{ bestLine() }}</p>
                }
                @if (question(); as q) {
                  <app-answer-explanation [question]="q" />
                }
              }

              <div class="flex flex-wrap gap-2 border-t border-line pt-4">
                <button uiBtn type="button" [disabled]="position() === 1 || !freeNavigation()" (click)="prev()">← Previous</button>
                <button uiBtn type="button" [attr.aria-pressed]="flagged()" (click)="store.toggleFlag()">{{ flagLabel() }}</button>
                @if (survivalOver()) {
                  <button uiBtn="primary" type="button" class="ml-auto" (click)="submit()">See results →</button>
                } @else if (position() < total()) {
                  <button uiBtn="primary" type="button" class="ml-auto" (click)="next()">Next →</button>
                } @else {
                  <button uiBtn="primary" type="button" class="ml-auto" (click)="reviewing.set(true)">Finish →</button>
                }
              </div>
              <p class="m-0 text-xs text-subtle">Keys: 1–4 or A–D answer · X then a letter crosses out · ←/→ move · F flag · Enter {{ enterHint() }}</p>
            </main>

            <aside class="w-full max-w-xs flex-[1_1_240px] rounded-xl border border-line bg-surface p-4">
              <app-navigator [cells]="cells()" (go)="jumpTo($event)" />
            </aside>
          </div>
        }
      </div>
    }
  `,
})
export class TestRunnerPage {
  protected readonly store = inject(SessionStore);
  protected readonly bank = inject(BankStore);
  private readonly router = inject(Router);

  protected readonly session = this.store.session;
  protected readonly question = this.store.currentQuestion;
  protected readonly reviewing = signal(false);
  protected readonly fullscreen = signal(!!document.fullscreenElement);
  protected readonly fullscreenLabel = computed(() => (this.fullscreen() ? 'Exit full screen' : 'Full screen'));
  private readonly confirm = inject(ConfirmService);
  private readonly now = signal(Date.now());
  /** Set after pressing X: the next letter crosses out instead of answering. */
  private readonly strikeMode = signal(false);

  constructor() {
    // A wall-clock tick is an external source; when time runs out the test is submitted.
    const id = setInterval(() => {
      this.now.set(Date.now());
      const s = this.session();
      if (!s || s.pausedAt) return;
      if (s.deadline && Date.now() >= s.deadline) this.submit();
      else if (s.config.variant === 'blitz' && this.remainingMs() <= 0) this.advanceBlitz();
    }, 500);
    // The browser can leave full screen on its own (Esc), so mirror its state.
    const onFs = () => this.fullscreen.set(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(id);
      document.removeEventListener('fullscreenchange', onFs);
    });
  }

  protected readonly label = computed(() => this.session()?.config.label ?? '');
  protected readonly total = computed(() => this.session()?.items.length ?? 0);
  protected readonly position = computed(() => (this.session()?.current ?? 0) + 1);
  protected readonly isPractice = computed(() => this.session()?.config.mode === 'practice');
  private readonly variant = this.store.variant;
  protected readonly survivalOver = this.store.survivalOver;
  protected readonly canPause = computed(() => this.isPractice() && this.variant() === 'standard');
  /** Correct answers in a row so far in a survival run. */
  protected readonly streak = computed(() => {
    const s = this.session();
    const byId = this.bank.byId();
    if (!s) return 0;
    let n = 0;
    for (const it of s.items) {
      const q = byId.get(it.qid);
      if (!it.checked || !q || !isCorrect(it.answer, q)) break;
      n++;
    }
    return n;
  });
  private readonly progress = inject(ProgressStore);
  protected readonly bestLine = computed(() => {
    const best = Math.max(0, ...this.progress.attempts().filter((a) => a.variant === 'survival').map((a) => a.right));
    return this.streak() > best ? 'New personal best!' : `Best: ${best}.`;
  });
  protected readonly paused = computed(() => !!this.session()?.pausedAt);
  protected readonly item = this.store.currentItem;
  protected readonly checked = computed(() => !!this.item()?.checked);
  protected readonly flagged = computed(() => !!this.item()?.flagged);
  protected readonly hasAnswer = computed(() => (this.item()?.answer.length ?? 0) > 0);
  protected readonly flagLabel = computed(() => (this.flagged() ? '⚑ Unflag' : '⚐ Flag'));
  protected readonly enterHint = computed(() => (this.isPractice() && !this.checked() ? 'check' : 'next'));
  protected readonly questionText = computed(() => this.question()?.text ?? '');
  protected readonly images = computed(() => this.question()?.images ?? []);
  protected readonly chapter = computed(() => chapterName(this.question()?.chapter ?? null));
  protected readonly instruction = computed(() => {
    const q = this.question();
    const n = q ? selectCount(q) : 1;
    return n > 1 ? `Select ${n} options.` : 'Select one option.';
  });

  protected readonly hasTimer = computed(() => this.session()?.deadline != null || this.variant() === 'blitz');
  private readonly remainingMs = computed(() => {
    const s = this.session();
    if (!s) return 0;
    if (s.config.variant === 'blitz') return s.enteredAt + s.config.secondsPerQuestion * 1000 - this.now();
    if (!s.deadline) return 0;
    return s.deadline - (s.pausedAt ?? this.now());
  });
  protected readonly timeLeft = computed(() => clock(this.remainingMs()));
  protected readonly timerClass = computed(
    () =>
      `rounded-lg px-3 py-1.5 font-mono text-base ${this.remainingMs() < (this.variant() === 'blitz' ? 5_000 : 5 * 60_000) ? 'bg-bad-50 text-bad-700' : 'bg-inset text-ink'}`,
  );

  protected readonly answeredLabel = computed(() => {
    const items = this.session()?.items ?? [];
    return `${items.filter((i) => i.answer.length).length}/${items.length} answered`;
  });

  protected readonly choiceRows = computed(() => {
    const q = this.question();
    const it = this.item();
    if (!q || !it) return [];
    const checked = it.checked;
    return it.order.map((key) => {
      const text = q.choices.find((c) => c.key === key)?.text ?? '';
      const selected = it.answer.includes(key);
      const struck = it.struck.includes(key);
      const right = q.correct.includes(key);
      let tone = selected ? 'border-2 border-brand-500 bg-brand-50' : 'border border-line bg-surface hover:border-line-strong';
      let mark = '';
      if (checked && right) {
        tone = 'border-2 border-ok-500 bg-ok-50';
        mark = 'Correct';
      } else if (checked && selected) {
        tone = 'border-2 border-bad-500 bg-bad-50';
        mark = 'Your answer';
      }
      return {
        key,
        text,
        selected,
        struck,
        mark,
        classes: `flex flex-1 items-start gap-3 rounded-xl px-4 py-3 text-left text-[15px] disabled:cursor-default ${tone}`,
        textClass: struck ? 'text-subtle line-through' : 'text-ink',
        strikeLabel: `${struck ? 'Restore' : 'Cross out'} option ${key}`,
      };
    });
  });

  protected readonly verdict = computed(() => {
    const q = this.question();
    const it = this.item();
    return q && it && isCorrect(it.answer, q) ? 'Correct.' : `Not quite — the answer is ${q?.correct.join(' / ')}.`;
  });
  protected readonly verdictClass = computed(() => {
    const q = this.question();
    const it = this.item();
    const ok = !!q && !!it && isCorrect(it.answer, q);
    return `m-0 rounded-lg p-3 font-semibold ${ok ? 'bg-ok-50 text-ok-700' : 'bg-bad-50 text-bad-700'}`;
  });

  protected readonly cells = computed<NavCell[]>(() => {
    const s = this.session();
    if (!s) return [];
    const byId = this.bank.byId();
    return s.items.map((it, index) => {
      const q = byId.get(it.qid);
      const answered = it.answer.length > 0;
      const graded = it.checked && q ? (isCorrect(it.answer, q) ? 'bg-ok-500 text-on-solid' : 'bg-bad-500 text-on-solid') : null;
      const fill = graded ?? (answered ? 'bg-brand-500 text-on-brand' : 'bg-surface text-ink border border-line-strong');
      const ring = it.flagged ? ' ring-2 ring-warn-700 ring-offset-1' : '';
      const current = index === s.current ? ' outline-2 outline-offset-2 outline-ink' : '';
      const state = [answered ? 'answered' : 'not answered', it.flagged ? 'flagged' : ''].filter(Boolean).join(', ');
      return { index, label: String(index + 1), classes: `${CELL} ${fill}${ring}${current}`, ariaLabel: `Question ${index + 1}, ${state}` };
    });
  });

  protected readonly reviewSummary = computed(() => {
    const items = this.session()?.items ?? [];
    const open = items.filter((i) => !i.answer.length).length;
    const flags = items.filter((i) => i.flagged).length;
    const parts = [`${items.length - open} of ${items.length} answered`];
    if (open) parts.push(`${open} unanswered — they count as wrong`);
    if (flags) parts.push(`${flags} flagged`);
    return parts.join(' · ') + '.';
  });

  /** Blitz moves on as soon as an answer is picked; the last answer ends the run. */
  protected pick(key: string): void {
    const last = this.position() === this.total();
    this.store.choose(key);
    if (this.variant() === 'blitz' && last) this.submit();
  }

  private advanceBlitz(): void {
    if (this.position() === this.total()) this.submit();
    else this.next();
  }

  /** Survival and blitz are strictly forward: no skipping ahead or going back. */
  protected readonly freeNavigation = computed(() => this.variant() === 'standard');

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  protected next(): void {
    if (this.survivalOver()) return;
    if (this.variant() === 'survival' && !this.checked()) return;
    this.store.goTo((this.session()?.current ?? 0) + 1);
  }

  protected prev(): void {
    if (!this.freeNavigation()) return;
    this.store.goTo((this.session()?.current ?? 0) - 1);
  }

  protected jump(index: number): void {
    this.reviewing.set(false);
    this.jumpTo(index);
  }

  protected jumpTo(index: number): void {
    if (this.freeNavigation()) this.store.goTo(index);
  }

  protected submit(): void {
    const attempt = this.store.submit();
    if (attempt) void this.router.navigate(['/results', attempt.id]);
  }

  protected async confirmSubmit(): Promise<void> {
    const open = (this.session()?.items ?? []).filter((i) => !i.answer.length).length;
    if (open) {
      const ok = await this.confirm.ask({
        title: 'Submit with unanswered questions?',
        message: `${open} question${open === 1 ? ' is' : 's are'} unanswered and will count as wrong.`,
        confirmLabel: 'Submit anyway',
        cancelLabel: 'Keep answering',
      });
      if (!ok) return;
    }
    this.submit();
  }

  protected async abandon(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Abandon this test?',
      message: 'Your answers will not be saved and nothing is added to your history.',
      confirmLabel: 'Abandon test',
      danger: true,
    });
    if (ok) {
      this.store.abandon();
      void this.router.navigate(['/']);
    }
  }

  protected onKey(e: KeyboardEvent): void {
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    if (e.metaKey || e.ctrlKey || e.altKey || !this.session() || this.paused() || this.reviewing()) return;
    const key = e.key.toLowerCase();
    const order = this.item()?.order ?? [];
    const byNumber = /^[1-6]$/.test(key) ? order[Number(key) - 1] : undefined;
    const byLetter = KEYS.includes(key) && order.includes(key.toUpperCase()) ? key.toUpperCase() : undefined;
    const choice = byNumber ?? byLetter;

    if (key === 'x') {
      this.strikeMode.set(true);
    } else if (choice) {
      if (this.strikeMode()) this.store.toggleStrike(choice);
      else this.pick(choice);
      this.strikeMode.set(false);
    } else if (key === 'arrowright') this.next();
    else if (key === 'arrowleft') this.prev();
    else if (key === 'f') this.store.toggleFlag();
    else if (key === 'enter') {
      if (this.isPractice() && !this.checked() && this.hasAnswer()) this.store.check();
      else if (this.survivalOver()) this.submit();
      else this.next();
    } else return;
    e.preventDefault();
  }
}
