import { Component, input, output } from '@angular/core';

export interface NavCell {
  readonly index: number;
  readonly label: string;
  readonly classes: string;
  readonly ariaLabel: string;
}

@Component({
  selector: 'app-navigator',
  template: `
    <nav aria-label="Questions" class="flex flex-col gap-3">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5">
        @for (c of cells(); track c.index) {
          <button type="button" [class]="c.classes" [attr.aria-label]="c.ariaLabel" (click)="go.emit(c.index)">{{ c.label }}</button>
        }
      </div>
      <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-subtle">
        <li class="flex items-center gap-1.5"><span class="size-3 rounded bg-brand-500" aria-hidden="true"></span>Answered</li>
        <li class="flex items-center gap-1.5"><span class="size-3 rounded border-2 border-warn-700" aria-hidden="true"></span>Flagged</li>
        <li class="flex items-center gap-1.5"><span class="size-3 rounded border border-line-strong" aria-hidden="true"></span>Open</li>
      </ul>
    </nav>
  `,
})
export class Navigator {
  readonly cells = input.required<readonly NavCell[]>();
  readonly go = output<number>();
}
