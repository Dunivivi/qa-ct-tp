import { Component, computed, input, model, output } from '@angular/core';
import { CHAPTERS, EXAM_MINUTES, EXAM_SIZE } from '../../../core/bank/question.model';
import { ChapterFilter, TestConfig, TestMode } from '../../../core/session/session.model';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { Checkbox } from '../../../shared/ui/checkbox';
import { SourceSummary } from '../model/library.model';

type Flag = 'weighted' | 'includeFlagged' | 'preferUnseen' | 'preferWrong' | 'shuffleChoices';

const PILL = 'min-h-9 min-w-12 rounded-lg border px-3 py-1.5 text-sm leading-tight';
const PILL_ON = `${PILL} border-brand-500 bg-brand-50 font-semibold text-brand-600`;
const PILL_OFF = `${PILL} border-line-strong bg-surface text-ink hover:bg-inset`;
const SEG = 'min-h-9 flex-1 rounded-md px-2 py-1.5 text-sm leading-tight';
const SEG_ON = `${SEG} bg-surface font-semibold text-ink shadow-sm`;
const SEG_OFF = `${SEG} text-muted`;

@Component({
  selector: 'app-test-builder',
  imports: [ButtonDirective, Checkbox],
  template: `
    <section class="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5" aria-labelledby="tb-title">
      <h2 id="tb-title" class="m-0 font-display text-xl font-semibold">Start a test</h2>

      <div class="flex flex-wrap gap-2" role="group" aria-label="Presets">
        <button uiBtn size="sm" type="button" (click)="preset('exam')">Real exam 40·90</button>
        <button uiBtn size="sm" type="button" (click)="preset('quick')">Quick 10</button>
        <button uiBtn size="sm" type="button" (click)="preset('practice')">Practice 20</button>
        <button uiBtn size="sm" type="button" (click)="preset('survival')" title="Ends at your first wrong answer">Survival</button>
        <button uiBtn size="sm" type="button" (click)="preset('blitz')" [title]="blitzTitle()">{{ blitzLabel() }}</button>
      </div>

      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend class="mb-2 font-medium">Providers</legend>
        <ui-checkbox [checked]="allSources()" (checkedChange)="toggleAllSources()"><span class="font-medium">All providers</span></ui-checkbox>
        @for (s of sourceRows(); track s.id) {
          <ui-checkbox class="pl-1" [checked]="s.on" (checkedChange)="toggleSource(s.id)">
            <span class="flex gap-2"><span class="flex-1">{{ s.label }}</span><span class="text-subtle">{{ s.count }}</span></span>
          </ui-checkbox>
        }
      </fieldset>

      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend class="mb-2 font-medium">Modules</legend>
        <div class="flex flex-wrap gap-2">
          @for (c of chapterRows(); track c.id) {
            <button type="button" [class]="c.classes" [attr.aria-pressed]="c.on" (click)="toggleChapter(c.id)" [title]="c.name">
              {{ c.short }}
            </button>
          }
        </div>
      </fieldset>

      <div class="flex flex-col gap-2">
        <span class="font-medium" id="tb-count">Questions</span>
        <div class="flex flex-wrap items-center gap-2" role="group" aria-labelledby="tb-count">
          @for (n of countRows(); track n.value) {
            <button type="button" [class]="n.classes" [attr.aria-pressed]="n.on" (click)="setCount(n.value)">{{ n.value }}</button>
          }
          <label class="sr-only" for="tb-custom">Custom number of questions</label>
          <input id="tb-custom" type="number" min="1" [max]="poolSize()" [value]="config().count"
            (change)="setCount(numberOf($event))"
            class="min-h-9 w-20 rounded-lg border border-line-strong bg-surface px-2 text-sm" />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="font-medium" id="tb-time">Time limit</span>
        <div class="flex flex-wrap items-center gap-2" role="group" aria-labelledby="tb-time">
          @for (t of timeRows(); track t.value) {
            <button type="button" [class]="t.classes" [attr.aria-pressed]="t.on" (click)="patch({ timeLimitMin: t.value })">{{ t.label }}</button>
          }
          <label class="sr-only" for="tb-minutes">Custom time limit in minutes</label>
          <input id="tb-minutes" type="number" min="0" max="600" [value]="config().timeLimitMin"
            (change)="setMinutes(numberOf($event))"
            class="min-h-9 w-20 rounded-lg border border-line-strong bg-surface px-2 text-sm" />
          <span class="text-sm text-subtle">min</span>
        </div>
        <p class="m-0 text-xs text-subtle">Real exam: {{ examSize }} questions · {{ examMinutes }} min · pass 65%</p>
      </div>

      @if (variantNote(); as note) {
        <p class="m-0 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{{ note }}</p>
      }

      <div class="flex flex-col gap-2">
        <span class="font-medium" id="tb-mode">Answers shown</span>
        <div class="flex rounded-lg bg-inset p-1" role="group" aria-labelledby="tb-mode">
          @for (m of modeRows(); track m.value) {
            <button type="button" [class]="m.classes" [attr.aria-pressed]="m.on" (click)="patch({ mode: m.value })">{{ m.label }}</button>
          }
        </div>
      </div>

      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0 text-sm">
        <legend class="mb-2 font-medium">Options</legend>
        @for (o of optionRows(); track o.key) {
          <ui-checkbox [checked]="o.on" (checkedChange)="toggleFlag(o.key)">{{ o.label }}</ui-checkbox>
        }
      </fieldset>

      <div class="flex flex-col gap-2 border-t border-line pt-4">
        <button uiBtn="primary" size="lg" type="button" [disabled]="!canStart()" (click)="start.emit()">{{ startLabel() }}</button>
        <p class="m-0 text-xs text-subtle" aria-live="polite">{{ poolLabel() }}</p>
      </div>
    </section>
  `,
})
export class TestBuilder {
  readonly sources = input.required<readonly SourceSummary[]>();
  readonly poolSize = input.required<number>();
  readonly blitzSeconds = input(15);
  readonly config = model.required<TestConfig>();
  readonly start = output<void>();

  protected readonly examSize = EXAM_SIZE;
  protected readonly examMinutes = EXAM_MINUTES;

  protected readonly allSources = computed(() => this.sources().every((s) => this.config().sourceIds.includes(s.id)));
  protected readonly sourceRows = computed(() =>
    this.sources().map((s) => ({ ...s, on: this.config().sourceIds.includes(s.id) })),
  );
  protected readonly chapterRows = computed(() =>
    CHAPTERS.map((c) => {
      const on = this.config().chapters.includes(c.id);
      return { id: c.id as ChapterFilter, name: c.name, short: `${c.id} · ${c.name.split(' ').slice(-1)[0]}`, on, classes: on ? PILL_ON : PILL_OFF };
    }),
  );
  protected readonly countRows = computed(() =>
    [10, 20, 40, 60].map((value) => {
      const on = this.config().count === value;
      return { value, on, classes: on ? PILL_ON : PILL_OFF };
    }),
  );
  protected readonly modeRows = computed(() =>
    ([
      { value: 'exam', label: 'At the end' },
      { value: 'practice', label: 'After each' },
    ] as const).map((m) => {
      const on = this.config().mode === m.value;
      return { ...m, on, classes: on ? SEG_ON : SEG_OFF };
    }),
  );
  protected readonly optionRows = computed(() => {
    const c = this.config();
    const rows: { key: Flag; label: string }[] = [
      { key: 'weighted', label: 'Spread across modules like the real exam' },
      { key: 'preferUnseen', label: "Prefer questions I haven't seen" },
      { key: 'preferWrong', label: 'Prefer questions I got wrong' },
      { key: 'shuffleChoices', label: 'Shuffle answer order' },
      { key: 'includeFlagged', label: 'Include flagged / disputed questions' },
    ];
    return rows.map((r) => ({ ...r, on: c[r.key] }));
  });
  protected readonly blitzLabel = computed(() => `Blitz 20×${this.blitzSeconds()}s`);
  protected readonly blitzTitle = computed(() => `${this.blitzSeconds()} seconds per question, auto-advance`);
  protected readonly variantNote = computed(() => {
    const c = this.config();
    if (c.variant === 'survival') return 'Survival: answers checked one by one — the run ends at your first wrong answer.';
    if (c.variant === 'blitz') return `Blitz: ${c.secondsPerQuestion} seconds per question, moves on as soon as you answer. No going back.`;
    return null;
  });
  protected readonly timeRows = computed(() =>
    [0, 10, 30, 60, 90, 120].map((value) => {
      const on = this.config().timeLimitMin === value;
      return { value, on, label: value ? `${value}` : 'No limit', classes: on ? PILL_ON : PILL_OFF };
    }),
  );
  protected readonly effectiveCount = computed(() => Math.min(this.config().count, this.poolSize()));
  protected readonly canStart = computed(() => this.effectiveCount() > 0);
  protected readonly startLabel = computed(() => {
    const n = this.effectiveCount();
    if (!n) return 'No questions match';
    return `Start ${n} question${n === 1 ? '' : 's'}${this.config().timeLimitMin ? ` · ${this.config().timeLimitMin} min` : ''}`;
  });
  protected readonly poolLabel = computed(() => {
    const pool = this.poolSize();
    const short = this.config().count > pool && pool > 0 ? ` — only ${pool} available` : '';
    return `${pool} questions match these filters${short}.`;
  });

  protected numberOf(e: Event): number {
    return e.target instanceof HTMLInputElement ? e.target.valueAsNumber : Number.NaN;
  }

  protected patch(p: Partial<TestConfig>): void {
    // Changing the mode or time limit by hand means a normal test, not survival/blitz.
    const leavesVariant = 'mode' in p || 'timeLimitMin' in p;
    this.config.update((c) => ({ ...c, ...(leavesVariant && !('variant' in p) ? { variant: 'standard' as const } : {}), ...p }));
  }

  protected setMinutes(n: number): void {
    if (Number.isFinite(n) && n >= 0) this.patch({ timeLimitMin: Math.round(n) });
  }

  protected setCount(n: number): void {
    if (Number.isFinite(n) && n > 0) this.patch({ count: Math.round(n) });
  }

  protected toggleFlag(key: Flag): void {
    this.config.update((c) => ({ ...c, [key]: !c[key] }));
  }

  protected toggleAllSources(): void {
    this.patch({ sourceIds: this.allSources() ? [] : this.sources().map((s) => s.id) });
  }

  protected toggleSource(id: string): void {
    const ids = this.config().sourceIds;
    this.patch({ sourceIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  }

  protected toggleChapter(id: ChapterFilter): void {
    const ch = this.config().chapters;
    this.patch({ chapters: ch.includes(id) ? ch.filter((x) => x !== id) : [...ch, id] });
  }

  protected preset(kind: 'exam' | 'quick' | 'practice' | 'survival' | 'blitz'): void {
    const p: Record<typeof kind, Partial<TestConfig>> = {
      exam: { label: 'Real exam simulation', count: EXAM_SIZE, timeLimitMin: EXAM_MINUTES, mode: 'exam' as TestMode, variant: 'standard', weighted: true, chapters: [1, 2, 3, 4, 5, 0] },
      quick: { label: 'Quick 10', count: 10, timeLimitMin: 10, mode: 'practice', variant: 'standard', weighted: false },
      practice: { label: 'Practice 20', count: 20, timeLimitMin: 0, mode: 'practice', variant: 'standard', weighted: false },
      // Survival draws a long queue; the run ends at the first miss.
      survival: { label: 'Survival', count: 200, timeLimitMin: 0, mode: 'practice', variant: 'survival', weighted: false },
      blitz: { label: 'Blitz', count: 20, timeLimitMin: 0, mode: 'exam', variant: 'blitz', secondsPerQuestion: this.blitzSeconds(), weighted: false },
    };
    this.patch(p[kind]);
  }
}
