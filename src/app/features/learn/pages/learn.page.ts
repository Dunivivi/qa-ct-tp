import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BankStore } from '../../../core/bank/bank.store';
import { CHAPTERS, ChapterId, chapterName } from '../../../core/bank/question.model';
import { AnswerExplanation } from '../../../core/bank/ui/answer-explanation';
import { ProgressStore } from '../../../core/progress/progress.store';
import { SettingsStore } from '../../../core/settings/settings.store';
import { isCorrect } from '../../../core/session/scoring';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { RichText } from '../../../shared/ui/rich-text';
import { Select, SelectOption } from '../../../shared/ui/select';
import { buildQueue, overview } from '../model/learn-queue';

type Style = 'flashcards' | 'choice';

const SEG = 'min-h-9 flex-1 rounded-md px-3 py-1.5 text-sm leading-tight';
const PILL = 'min-h-9 rounded-lg border px-3 py-1.5 text-sm leading-tight';

const relTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function fromNow(ts: number, now: number): string {
  const min = Math.round((ts - now) / 60000);
  if (Math.abs(min) < 60) return relTime.format(min, 'minute');
  const h = Math.round(min / 60);
  return Math.abs(h) < 48 ? relTime.format(h, 'hour') : relTime.format(Math.round(h / 24), 'day');
}

@Component({
  selector: 'app-learn-page',
  imports: [RouterLink, ButtonDirective, RichText, AnswerExplanation, Select],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-8">
      @if (!running()) {
        <div>
          <h1 class="m-0 font-display text-3xl font-semibold">Learn</h1>
          <p class="m-0 mt-1 text-muted">Spaced repetition: missed questions come back in 10 minutes, known ones after 1, 3, 7, 16 and 35 days.</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-4">
          @for (s of statCards(); track s.label) {
            <div class="rounded-xl border border-line bg-surface p-4">
              <div class="text-sm text-subtle">{{ s.label }}</div>
              <div class="font-display text-3xl font-semibold">{{ s.value }}</div>
            </div>
          }
        </div>

        <section class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5" aria-label="Session settings">
          <ui-select class="max-w-sm" label="Source" [options]="sourceOptions()" [value]="sourceId() ?? ''" (valueChange)="sourceId.set($event || null)" />
          <div class="flex flex-col gap-2">
            <span class="text-sm font-medium" id="ln-mod">Modules</span>
            <div class="flex flex-wrap gap-2" role="group" aria-labelledby="ln-mod">
              @for (c of chapterRows(); track c.id) {
                <button type="button" [class]="c.classes" [attr.aria-pressed]="c.on" (click)="toggleChapter(c.id)">{{ c.label }}</button>
              }
            </div>
          </div>
          <div class="flex flex-wrap gap-6">
            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium" id="ln-new">New cards this session</span>
              <div class="flex gap-2" role="group" aria-labelledby="ln-new">
                @for (n of newRows(); track n.value) {
                  <button type="button" [class]="n.classes" [attr.aria-pressed]="n.on" (click)="newLimit.set(n.value)">{{ n.value }}</button>
                }
              </div>
            </div>
            <div class="flex min-w-64 flex-1 flex-col gap-2">
              <span class="text-sm font-medium" id="ln-style">Style</span>
              <div class="flex rounded-lg bg-inset p-1" role="group" aria-labelledby="ln-style">
                @for (s of styleRows(); track s.value) {
                  <button type="button" [class]="s.classes" [attr.aria-pressed]="s.on" (click)="style.set(s.value)">{{ s.label }}</button>
                }
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button uiBtn="primary" size="lg" type="button" [disabled]="!plannedCount()" (click)="startSession()">{{ startLabel() }}</button>
            <span class="text-sm text-subtle">{{ nextDueLabel() }}</span>
          </div>
        </section>

        @if (summary(); as s) {
          <p class="m-0 rounded-lg bg-ok-50 p-3 text-ok-700" role="status">{{ s }}</p>
        }
      } @else if (card(); as q) {
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex-1">
            <div class="text-sm text-subtle">{{ cardMeta() }}</div>
            <div class="font-semibold">Card {{ position() }} of {{ queue().length }}</div>
          </div>
          <div class="h-2 w-40 rounded-full bg-inset" role="progressbar" [attr.aria-valuenow]="pct()" aria-valuemin="0" aria-valuemax="100" aria-label="Session progress">
            <div class="h-2 rounded-full bg-brand-500" [style.width.%]="pct()"></div>
          </div>
          <button uiBtn="ghost" size="sm" type="button" (click)="endSession()">End session</button>
        </div>

        <article class="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
          @if (q.scenario; as sc) {
            <details class="rounded-lg bg-inset p-3 text-sm" open>
              <summary class="cursor-pointer font-medium">Scenario</summary>
              <ui-rich-text class="mt-2 block leading-relaxed" [text]="sc" />
            </details>
          }
          <ui-rich-text class="block font-display text-xl leading-snug font-medium" [text]="q.text" />
          @for (img of q.images; track img) {
            <img [src]="img" alt="Figure for this question" class="max-w-full rounded-lg border border-line" />
          }
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            @for (c of choiceRows(); track c.key) {
              <li>
                <button type="button" [class]="c.classes" [disabled]="!c.clickable" (click)="pick(c.key)">
                  <span class="w-5 shrink-0 font-semibold">{{ c.key }}</span>
                  <span class="flex-1">{{ c.text }}</span>
                  @if (c.mark) {
                    <span class="text-xs font-semibold">{{ c.mark }}</span>
                  }
                </button>
              </li>
            }
          </ul>

          @if (!revealed()) {
            @if (style() === 'flashcards') {
              <div><button uiBtn="primary" type="button" (click)="reveal()">Show answer <span class="text-xs opacity-80">(Space)</span></button></div>
            } @else {
              <p class="m-0 text-sm text-subtle">Pick an answer (1–4).</p>
            }
          } @else {
            <app-answer-explanation [question]="q" />
            @if (style() === 'flashcards') {
              <div class="flex flex-wrap gap-2">
                <button uiBtn="danger" type="button" (click)="grade(false)">Again — I didn't know <span class="text-xs">(1)</span></button>
                <button uiBtn="primary" type="button" (click)="grade(true)">Got it <span class="text-xs opacity-80">(2)</span></button>
              </div>
            } @else {
              <p [class]="choiceVerdictClass()" role="status">{{ choiceVerdict() }}</p>
              <div><button uiBtn="primary" type="button" (click)="grade(choiceRight())">Next <span class="text-xs opacity-80">(Enter)</span></button></div>
            }
          }
        </article>
      } @else {
        <div class="flex flex-col items-center gap-4 py-16 text-center">
          <p class="m-0 text-muted">This card is no longer in the bank.</p>
          <button uiBtn type="button" (click)="skip()">Skip</button>
        </div>
      }

      @if (!bank.questions().length && !bank.isLoading()) {
        <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-10 text-center">
          <p class="m-0 text-muted">No questions loaded.</p>
          <a uiBtn="primary" routerLink="/import">Import questions</a>
        </div>
      }
    </div>
  `,
})
export class LearnPage {
  protected readonly bank = inject(BankStore);
  private readonly progress = inject(ProgressStore);

  protected readonly sourceId = signal<string | null>(null);
  protected readonly chapters = signal<readonly ChapterId[]>([1, 2, 3, 4, 5]);
  private readonly settings = inject(SettingsStore);
  /** Starts at the Settings default; changing it here only affects this visit. */
  protected readonly newLimit = linkedSignal<number>(() => this.settings.settings().learnNewCards);
  protected readonly style = signal<Style>('choice');

  /** Fixed when a session starts so grading doesn't reshuffle the cards under the user. */
  protected readonly queue = signal<readonly string[]>([]);
  private readonly index = signal(0);
  protected readonly revealed = signal(false);
  private readonly picked = signal<string | null>(null);
  private readonly tally = signal({ right: 0, again: 0 });
  protected readonly summary = signal<string | null>(null);
  /** Snapshot taken on demand: the overview doesn't need a live clock. */
  private readonly now = signal(Date.now());

  private readonly view = computed(() =>
    overview(
      this.bank.questions(),
      this.progress.srs(),
      { sourceId: this.sourceId(), chapters: this.chapters(), includeFlagged: false },
      this.progress.hidden(),
      this.now(),
    ),
  );
  protected readonly sourceOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All providers' },
    ...this.bank.sources().map((s) => ({ value: s.id, label: s.label, hint: String(s.questions.length) })),
  ]);
  protected readonly plannedCount = computed(() => this.view().due.length + Math.min(this.newLimit(), this.view().fresh.length));
  protected readonly statCards = computed(() => {
    const v = this.view();
    return [
      { label: 'Due now', value: v.due.length },
      { label: 'New', value: v.fresh.length },
      { label: 'Learning', value: v.learning },
      { label: 'Mastered', value: v.mastered },
    ];
  });
  protected readonly startLabel = computed(() => {
    const v = this.view();
    const fresh = Math.min(this.newLimit(), v.fresh.length);
    return this.plannedCount() ? `Start: ${v.due.length} due + ${fresh} new` : 'Nothing due';
  });
  protected readonly nextDueLabel = computed(() => {
    const v = this.view();
    return v.nextDueAt && !v.due.length ? `Next review ${fromNow(v.nextDueAt, this.now())}` : '';
  });

  protected readonly chapterRows = computed(() =>
    CHAPTERS.map((c) => {
      const on = this.chapters().includes(c.id);
      return {
        id: c.id,
        on,
        label: `${c.id} · ${c.name.split(' ').slice(-1)[0]}`,
        classes: `${PILL} ${on ? 'border-brand-500 bg-brand-50 font-semibold text-brand-600' : 'border-line-strong bg-surface'}`,
      };
    }),
  );
  protected readonly newRows = computed(() =>
    [0, 5, 10, 20].map((value) => {
      const on = this.newLimit() === value;
      return { value, on, classes: `${PILL} ${on ? 'border-brand-500 bg-brand-50 font-semibold text-brand-600' : 'border-line-strong bg-surface'}` };
    }),
  );
  protected readonly styleRows = computed(() =>
    ([
      { value: 'choice', label: 'Multiple choice' },
      { value: 'flashcards', label: 'Flashcards (self-grade)' },
    ] as const).map((s) => {
      const on = this.style() === s.value;
      return { ...s, on, classes: `${SEG} ${on ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}` };
    }),
  );

  protected readonly running = computed(() => this.queue().length > 0);
  protected readonly position = computed(() => this.index() + 1);
  protected readonly pct = computed(() => Math.round((this.index() / Math.max(1, this.queue().length)) * 100));
  protected readonly card = computed(() => {
    const id = this.queue()[this.index()];
    return id ? (this.bank.byId().get(id) ?? null) : null;
  });
  protected readonly cardMeta = computed(() => {
    const q = this.card();
    if (!q) return '';
    const card = this.progress.srs()[q.id];
    const src = this.bank.sourceById().get(q.sourceId)?.label ?? q.sourceId;
    return `${src} #${q.number} · ${chapterName(q.chapter)} · ${card ? `box ${card.box}` : 'new card'}`;
  });
  protected readonly choiceRight = computed(() => {
    const q = this.card();
    const p = this.picked();
    return !!q && !!p && isCorrect([p], q);
  });
  protected readonly choiceVerdict = computed(() =>
    this.choiceRight() ? 'Correct.' : `Not quite — the answer is ${this.card()?.correct.join(' / ')}.`,
  );
  protected readonly choiceVerdictClass = computed(
    () => `m-0 rounded-lg p-3 font-semibold ${this.choiceRight() ? 'bg-ok-50 text-ok-700' : 'bg-bad-50 text-bad-700'}`,
  );
  protected readonly choiceRows = computed(() => {
    const q = this.card();
    if (!q) return [];
    const shown = this.revealed();
    const picked = this.picked();
    const pickable = this.style() === 'choice' && !shown;
    return q.choices.map((c) => {
      const right = shown && q.correct.includes(c.key);
      const wrongPick = shown && picked === c.key && !q.correct.includes(c.key);
      const tone = right ? 'border-2 border-ok-500 bg-ok-50' : wrongPick ? 'border-2 border-bad-500 bg-bad-50' : 'border border-line';
      return {
        ...c,
        clickable: pickable,
        mark: right ? 'Correct' : wrongPick ? 'Your answer' : '',
        classes: `flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left text-[15px] disabled:cursor-default ${tone} ${pickable ? 'hover:border-line-strong' : ''}`,
      };
    });
  });

  protected toggleChapter(id: ChapterId): void {
    this.chapters.update((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  protected startSession(): void {
    this.now.set(Date.now());
    this.queue.set(buildQueue(this.view(), this.newLimit(), Math.random));
    this.index.set(0);
    this.tally.set({ right: 0, again: 0 });
    this.summary.set(null);
    this.resetCard();
  }

  protected reveal(): void {
    this.revealed.set(true);
  }

  protected pick(key: string): void {
    if (this.style() !== 'choice' || this.revealed()) return;
    this.picked.set(key);
    this.revealed.set(true);
  }

  protected grade(right: boolean): void {
    const q = this.card();
    if (!q) return;
    this.progress.review(q.id, right);
    this.tally.update((t) => (right ? { ...t, right: t.right + 1 } : { ...t, again: t.again + 1 }));
    // A miss is due again in 10 minutes, so it comes back at the end of this session.
    if (!right) this.queue.update((list) => [...list, q.id]);
    this.advance();
  }

  protected skip(): void {
    this.advance();
  }

  protected endSession(): void {
    this.finish();
  }

  private advance(): void {
    if (this.index() + 1 >= this.queue().length) this.finish();
    else {
      this.index.update((i) => i + 1);
      this.resetCard();
    }
  }

  private finish(): void {
    const t = this.tally();
    this.summary.set(t.right + t.again ? `Session done: ${t.right} known, ${t.again} to repeat. Progress is saved.` : null);
    this.queue.set([]);
    this.now.set(Date.now());
  }

  private resetCard(): void {
    this.revealed.set(false);
    this.picked.set(null);
  }

  protected onKey(e: KeyboardEvent): void {
    const t = e.target;
    if (!this.running() || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const q = this.card();
    const key = e.key.toLowerCase();
    if (this.style() === 'flashcards') {
      if (key === ' ' && !this.revealed()) this.reveal();
      else if (key === '1' && this.revealed()) this.grade(false);
      else if (key === '2' && this.revealed()) this.grade(true);
      else return;
    } else if (!this.revealed() && q && /^[1-6]$/.test(key)) {
      const c = q.choices[Number(key) - 1];
      if (c) this.pick(c.key);
    } else if (key === 'enter' && this.revealed()) this.grade(this.choiceRight());
    else return;
    e.preventDefault();
  }
}
