import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { Question, chapterName } from '../../../core/bank/question.model';
import { AnswerExplanation } from '../../../core/bank/ui/answer-explanation';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { RichText } from '../../../shared/ui/rich-text';
import { StatusBadge } from '../../../shared/ui/status-badge';

@Component({
  selector: 'app-question-card',
  imports: [AnswerExplanation, ButtonDirective, RichText, StatusBadge],
  template: `
    <article class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5" [attr.aria-label]="heading()">
      <header class="flex flex-wrap items-center gap-2 text-sm">
        <span class="font-semibold">{{ heading() }}</span>
        <span class="text-subtle">· {{ chapter() }}</span>
        <ui-status-badge [status]="question().status" />
        <span class="ml-auto flex gap-1">
          <button uiBtn="ghost" size="sm" type="button" [attr.aria-pressed]="bookmarked()" (click)="bookmark.emit()">
            {{ bookmarkLabel() }}
          </button>
          <button uiBtn="ghost" size="sm" type="button" (click)="hide.emit()">{{ hideLabel() }}</button>
        </span>
      </header>

      @if (question().scenario; as sc) {
        <details class="rounded-lg bg-inset p-3 text-sm">
          <summary class="cursor-pointer font-medium">Scenario</summary>
          <ui-rich-text class="mt-2 block leading-relaxed text-ink-2" [text]="sc" />
        </details>
      }

      <ui-rich-text class="block text-[15px] leading-relaxed font-medium" [text]="question().text" />
      @for (img of question().images; track img) {
        <img [src]="img" alt="Figure for this question" class="max-w-full rounded-lg border border-line" />
      }

      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        @for (c of choiceRows(); track c.key) {
          <li [class]="c.classes">
            <span class="w-5 font-semibold">{{ c.key }}</span>
            <span class="flex-1">{{ c.text }}</span>
            @if (c.isCorrect) {
              <span class="text-xs font-semibold text-ok-700">Correct</span>
            }
          </li>
        }
      </ul>

      <div class="flex flex-wrap items-center gap-2">
        <button [uiBtn]="revealVariant()" size="sm" type="button" (click)="revealed.set(!revealed())">
          {{ revealLabel() }}
        </button>
        @if (statLine(); as s) {
          <span class="text-xs text-subtle">{{ s }}</span>
        }
      </div>

      @if (revealed()) {
        <app-answer-explanation [question]="question()" />
      }

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-subtle">My note</span>
        <textarea rows="2" class="rounded-lg border border-line-strong p-2 font-sans text-sm" [value]="note()"
          (change)="noteChange.emit(textOf($event))" placeholder="Add a memory hook…"></textarea>
      </label>
    </article>
  `,
})
export class QuestionCard {
  readonly question = input.required<Question>();
  readonly sourceLabel = input.required<string>();
  readonly bookmarked = input(false);
  readonly hidden = input(false);
  readonly note = input('');
  readonly statLine = input<string | null>(null);
  readonly startRevealed = input(false);
  readonly bookmark = output<void>();
  readonly hide = output<void>();
  readonly noteChange = output<string>();

  protected readonly revealed = linkedSignal(() => this.startRevealed());
  protected readonly revealVariant = computed(() => (this.revealed() ? 'secondary' : 'primary'));
  protected readonly revealLabel = computed(() => (this.revealed() ? 'Hide answer' : 'Show answer'));
  protected readonly bookmarkLabel = computed(() => (this.bookmarked() ? '★ Bookmarked' : '☆ Bookmark'));
  protected readonly hideLabel = computed(() => (this.hidden() ? 'Unhide' : 'Hide'));
  protected readonly heading = computed(() => `${this.sourceLabel()} #${this.question().number}`);
  protected readonly chapter = computed(() => chapterName(this.question().chapter));
  protected readonly choiceRows = computed(() => {
    const q = this.question();
    const show = this.revealed();
    return q.choices.map((c) => {
      const isCorrect = show && q.correct.includes(c.key);
      return {
        ...c,
        isCorrect,
        classes: `flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${isCorrect ? 'border-2 border-ok-500 bg-ok-50' : 'border-line'}`,
      };
    });
  });

  protected textOf(e: Event): string {
    return e.target instanceof HTMLTextAreaElement ? e.target.value : '';
  }
}
