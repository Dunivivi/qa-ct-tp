import { Component, computed, input } from '@angular/core';
import { Question } from '../question.model';
import { RichText } from '../../../shared/ui/rich-text';

/** "Why this is correct" — shared by browse, practice feedback and the results review. */
@Component({
  selector: 'app-answer-explanation',
  imports: [RichText],
  template: `
    <section class="flex flex-col gap-3 rounded-xl bg-inset p-4" aria-label="Why this is correct">
      <div class="flex flex-wrap items-baseline gap-2">
        <h3 class="font-display text-base font-semibold">Why {{ correctLabel() }} is correct</h3>
        @if (question().learningObjective; as lo) {
          <span class="text-xs text-subtle">Syllabus {{ lo }}</span>
        }
      </div>

      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        @for (c of correctChoices(); track c.key) {
          <li class="font-medium text-ok-700">{{ c.key }}) {{ c.text }}</li>
        }
      </ul>

      @if (question().why; as why) {
        <ui-rich-text class="leading-relaxed text-ink-2" [text]="why" />
      } @else {
        <p class="m-0 text-subtle">No explanation was provided for this question.</p>
      }

      @if (question().statusNote; as note) {
        <div [class]="noteClass()">
          <strong>{{ noteTitle() }}:</strong> {{ note }}
        </div>
      }

      @if (question().extraNotes; as extra) {
        <details class="text-sm text-muted">
          <summary class="cursor-pointer font-medium text-ink">Why the other options are wrong</summary>
          <ui-rich-text class="mt-2 block leading-relaxed" [text]="extra" />
        </details>
      }

      @if (question().outdatedSourceExplanation; as old) {
        <details class="text-sm text-muted">
          <summary class="cursor-pointer font-medium text-warn-700">
            Source's original key was {{ sourceKey() }} — its explanation (outdated)
          </summary>
          <ui-rich-text class="mt-2 block leading-relaxed" [text]="old" />
        </details>
      }

      @if (question().alsoAppearsIn.length) {
        <p class="m-0 text-xs text-subtle">Also appears in: {{ alsoIn() }}</p>
      }
    </section>
  `,
})
export class AnswerExplanation {
  readonly question = input.required<Question>();

  protected readonly correctChoices = computed(() => {
    const q = this.question();
    return q.choices.filter((c) => q.correct.includes(c.key));
  });
  protected readonly correctLabel = computed(() => this.question().correct.join(' / '));
  protected readonly sourceKey = computed(() => this.question().sourceAnswer?.join(', ') ?? '?');
  protected readonly alsoIn = computed(() => this.question().alsoAppearsIn.join(' · '));
  protected readonly noteTitle = computed(() =>
    this.question().status === 'multiple-correct' ? 'More than one option is correct' : 'Reviewer note',
  );
  protected readonly noteClass = computed(() =>
    this.question().status === 'flagged'
      ? 'rounded-lg border border-bad-500/30 bg-bad-50 p-3 text-sm text-bad-700'
      : 'rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800',
  );
}
