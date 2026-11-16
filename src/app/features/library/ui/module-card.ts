import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { ModuleSummary } from '../model/library.model';

@Component({
  selector: 'app-module-card',
  imports: [RouterLink, ButtonDirective],
  template: `
    <article class="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div class="text-xs text-subtle">{{ eyebrow() }}</div>
      <h3 class="m-0 font-display text-lg font-semibold">{{ module().name }}</h3>
      <div class="h-1.5 rounded-full bg-inset" role="progressbar" [attr.aria-valuenow]="seenPct()" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="progressLabel()">
        <div class="h-1.5 rounded-full bg-brand-500" [style.width.%]="seenPct()"></div>
      </div>
      <div class="flex flex-wrap justify-between gap-2 text-sm text-muted">
        <span>{{ module().count }} questions</span>
        <span>{{ stat() }}</span>
      </div>
      <div class="mt-auto flex gap-2 pt-1">
        <a uiBtn class="flex-1" routerLink="/browse" [queryParams]="browseParams()">Browse</a>
        <button uiBtn="primary" class="flex-1" type="button" (click)="quiz.emit(module().chapter)">Quiz {{ quizSize() }}</button>
      </div>
    </article>
  `,
})
export class ModuleCard {
  readonly module = input.required<ModuleSummary>();
  readonly sourceId = input.required<string>();
  readonly quiz = output<ModuleSummary['chapter']>();

  protected readonly eyebrow = computed(() => (this.module().chapter ? `Chapter ${this.module().chapter}` : 'No chapter'));
  protected readonly seenPct = computed(() => {
    const m = this.module();
    return m.count ? Math.round((m.seen / m.count) * 100) : 0;
  });
  protected readonly progressLabel = computed(() => `${this.seenPct()}% of ${this.module().name} seen`);
  protected readonly stat = computed(() => {
    const m = this.module();
    // A count reads better than a percentage that rounds to 0% after the first few answers.
    return m.accuracy === null ? 'Not started' : `${m.seen}/${m.count} seen · ${m.accuracy}% right`;
  });
  protected readonly quizSize = computed(() => Math.min(20, this.module().count));
  protected readonly browseParams = computed(() => ({ source: this.sourceId(), chapter: this.module().chapter }));
}
