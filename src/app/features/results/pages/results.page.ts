import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BankStore } from '../../../core/bank/bank.store';
import { AnswerExplanation } from '../../../core/bank/ui/answer-explanation';
import { PASS_PERCENT, chapterName } from '../../../core/bank/question.model';
import { Breakdown } from '../../../core/progress/progress.model';
import { ProgressStore } from '../../../core/progress/progress.store';
import { DEFAULT_CONFIG } from '../../../core/session/session.model';
import { SessionStore } from '../../../core/session/session.store';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { RichText } from '../../../shared/ui/rich-text';

type Filter = 'wrong' | 'flagged' | 'all';

function duration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return m ? `${m} min ${s}s` : `${s}s`;
}

function bars(rows: readonly Breakdown[]) {
  return rows.map((r) => {
    const pct = r.total ? Math.round((r.right / r.total) * 100) : 0;
    return { ...r, pct, barClass: `h-2 rounded-full ${pct >= PASS_PERCENT ? 'bg-ok-500' : 'bg-warn-700'}` };
  });
}

@Component({
  selector: 'app-results-page',
  imports: [RouterLink, ButtonDirective, AnswerExplanation, RichText],
  template: `
    @if (!attempt()) {
      <div class="mx-auto my-16 flex max-w-lg flex-col items-center gap-4 text-center">
        <h1 class="m-0 font-display text-2xl font-semibold">Result not found</h1>
        <p class="m-0 text-muted">It may have been deleted from your history.</p>
        <a uiBtn="primary" routerLink="/history">Open history</a>
      </div>
    } @else {
      <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8">
        <section [class]="heroClass()">
          <div class="flex flex-col gap-1">
            <span class="text-sm opacity-80">{{ attempt()?.label }}</span>
            <h1 class="m-0 font-display text-4xl font-bold">{{ headline() }}</h1>
            <span>{{ summary() }}</span>
          </div>
          <div class="ml-auto flex flex-wrap gap-2">
            <button uiBtn type="button" [disabled]="!wrongIds().length" (click)="retake(wrongIds(), 'Retake wrong answers')">Retake {{ wrongIds().length }} wrong</button>
            <button uiBtn type="button" (click)="retake(allIds(), 'Retake: ' + (attempt()?.label ?? ''))">Retake all</button>
            <a uiBtn routerLink="/">New test</a>
          </div>
        </section>

        <div class="grid gap-4 md:grid-cols-2">
          <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="by-ch">
            <h2 id="by-ch" class="mt-0 font-display text-lg font-semibold">By module</h2>
            @for (r of byChapter(); track r.key) {
              <div class="mb-3">
                <div class="flex justify-between text-sm"><span>{{ r.label }}</span><span>{{ r.right }}/{{ r.total }} · {{ r.pct }}%</span></div>
                <div class="mt-1 h-2 rounded-full bg-inset"><div [class]="r.barClass" [style.width.%]="r.pct"></div></div>
              </div>
            }
            @if (weakest(); as w) {
              <p class="mb-0 text-sm text-warn-700">Weakest: {{ w }}</p>
            }
          </section>
          <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="by-src">
            <h2 id="by-src" class="mt-0 font-display text-lg font-semibold">By source</h2>
            @for (r of bySource(); track r.key) {
              <div class="mb-3">
                <div class="flex justify-between text-sm"><span>{{ r.label }}</span><span>{{ r.right }}/{{ r.total }} · {{ r.pct }}%</span></div>
                <div class="mt-1 h-2 rounded-full bg-inset"><div [class]="r.barClass" [style.width.%]="r.pct"></div></div>
              </div>
            }
            <p class="mb-0 text-sm text-subtle">Time: {{ timeSpent() }} · avg {{ avgPerQuestion() }} per question</p>
          </section>
        </div>

        <section class="flex flex-col gap-4" aria-labelledby="rv">
          <div class="flex flex-wrap items-center gap-3">
            <h2 id="rv" class="m-0 font-display text-xl font-semibold">Review</h2>
            <div class="flex rounded-lg bg-inset p-1" role="group" aria-label="Filter review">
              @for (f of filterRows(); track f.value) {
                <button type="button" [class]="f.classes" [attr.aria-pressed]="f.on" (click)="filter.set(f.value)">{{ f.label }}</button>
              }
            </div>
          </div>
          @for (r of reviewRows(); track r.qid) {
            <article class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
              <header class="flex flex-wrap items-center gap-2 text-sm">
                <span class="font-semibold">Q{{ r.index }}</span>
                <span class="text-subtle">{{ r.meta }}</span>
                <span [class]="r.badgeClass">{{ r.badge }}</span>
                @if (r.flagged) {
                  <span class="text-xs font-semibold text-warn-700">Flagged</span>
                }
                <span class="ml-auto text-xs text-subtle">{{ r.time }}</span>
              </header>
              <ui-rich-text class="block font-medium leading-relaxed" [text]="r.text" />
              <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
                @for (c of r.choices; track c.key) {
                  <li [class]="c.classes"><span class="w-5 font-semibold">{{ c.key }}</span><span class="flex-1">{{ c.text }}</span><span class="text-xs font-semibold">{{ c.mark }}</span></li>
                }
              </ul>
              @if (r.question; as q) {
                <app-answer-explanation [question]="q" />
              }
            </article>
          } @empty {
            <p class="rounded-xl border border-dashed border-line-strong p-8 text-center text-muted">Nothing to show for this filter.</p>
          }
        </section>
      </div>
    }
  `,
})
export class ResultsPage {
  private readonly progress = inject(ProgressStore);
  private readonly bank = inject(BankStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** Route param `:id`. */
  readonly id = input<string>();

  protected readonly filter = signal<Filter>('wrong');
  protected readonly attempt = computed(() => this.progress.attempts().find((a) => a.id === this.id()) ?? null);

  private readonly isSurvival = computed(() => this.attempt()?.variant === 'survival');
  /** A survival run is judged by its streak; pass/fail only makes sense for fixed-length tests. */
  protected readonly headline = computed(() => {
    const a = this.attempt();
    if (!a) return '';
    return this.isSurvival() ? `Streak ${a.right}` : `${a.percent}% · ${a.passed ? 'Pass' : 'Below pass mark'}`;
  });
  protected readonly heroClass = computed(
    () =>
      `flex flex-wrap items-center gap-4 rounded-2xl p-6 ${this.attempt()?.passed && !this.isSurvival() ? 'bg-ok-700 text-on-solid' : 'bg-inverse text-on-solid'}`,
  );
  protected readonly summary = computed(() => {
    const a = this.attempt();
    if (!a) return '';
    if (this.isSurvival()) return `${a.right} correct in a row before the first miss`;
    return `${a.right} of ${a.total} correct · pass mark ${PASS_PERCENT}%${a.unanswered ? ` · ${a.unanswered} unanswered` : ''}`;
  });
  protected readonly byChapter = computed(() => bars(this.attempt()?.byChapter ?? []));
  protected readonly bySource = computed(() => bars(this.attempt()?.bySource ?? []));
  protected readonly weakest = computed(() => {
    const rows = this.byChapter().filter((r) => r.total >= 2);
    const w = [...rows].sort((a, b) => a.pct - b.pct)[0];
    return w && w.pct < PASS_PERCENT ? `${w.label} (${w.pct}%)` : null;
  });
  protected readonly timeSpent = computed(() => {
    const a = this.attempt();
    return a ? duration(a.finishedAt - a.startedAt) : '';
  });
  protected readonly avgPerQuestion = computed(() => {
    const a = this.attempt();
    return a && a.total ? duration((a.finishedAt - a.startedAt) / a.total) : '';
  });
  protected readonly wrongIds = computed(() => (this.attempt()?.items ?? []).filter((i) => !i.correct).map((i) => i.qid));
  protected readonly allIds = computed(() => (this.attempt()?.items ?? []).map((i) => i.qid));

  protected readonly filterRows = computed(() =>
    ([
      { value: 'wrong', label: 'Wrong' },
      { value: 'flagged', label: 'Flagged' },
      { value: 'all', label: 'All' },
    ] as const).map((f) => {
      const on = this.filter() === f.value;
      return { ...f, on, classes: `min-h-8 rounded-md px-3 py-1 text-sm leading-tight ${on ? 'bg-surface font-semibold shadow-sm' : 'text-muted'}` };
    }),
  );

  protected readonly reviewRows = computed(() => {
    const a = this.attempt();
    if (!a) return [];
    const byId = this.bank.byId();
    const sources = this.bank.sourceById();
    const f = this.filter();
    return a.items
      .map((it, i) => ({ it, i, q: byId.get(it.qid) ?? null }))
      .filter(({ it }) => f === 'all' || (f === 'wrong' ? !it.correct : it.flagged))
      .map(({ it, i, q }) => ({
        qid: it.qid,
        index: i + 1,
        question: q,
        text: q?.text ?? '(question no longer in the bank)',
        meta: q ? `${sources.get(q.sourceId)?.label ?? q.sourceId} #${q.number} · ${chapterName(q.chapter)}` : '',
        flagged: it.flagged,
        time: duration(it.timeMs),
        badge: it.answer.length === 0 ? 'Unanswered' : it.correct ? 'Correct' : 'Wrong',
        badgeClass: `rounded-full px-2.5 py-0.5 text-xs font-semibold ${it.correct ? 'bg-ok-50 text-ok-700' : 'bg-bad-50 text-bad-700'}`,
        choices: (q?.choices ?? []).map((c) => {
          const right = q?.correct.includes(c.key) ?? false;
          const mine = it.answer.includes(c.key);
          const tone = right ? 'border-ok-500 bg-ok-50' : mine ? 'border-bad-500 bg-bad-50' : 'border-line';
          return { ...c, mark: right ? 'Correct' : mine ? 'Your answer' : '', classes: `flex gap-3 rounded-lg border px-3 py-2 ${tone}` };
        }),
      }));
  });

  protected retake(ids: readonly string[], label: string): void {
    if (!ids.length) return;
    const prev = this.attempt();
    this.session.start({
      ...DEFAULT_CONFIG,
      label,
      questionIds: ids,
      count: ids.length,
      mode: prev?.mode ?? 'practice',
      timeLimitMin: 0,
    });
    void this.router.navigate(['/test']);
  }
}
