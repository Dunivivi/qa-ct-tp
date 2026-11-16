import { Component, input, model } from '@angular/core';

/**
 * Custom-drawn checkbox. A visually hidden native input stays underneath so keyboard,
 * screen readers and label clicks behave exactly like a real checkbox.
 */
@Component({
  selector: 'ui-checkbox',
  host: { class: 'block' },
  template: `
    <label class="group flex cursor-pointer items-start gap-2.5 py-0.5 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <input type="checkbox" class="peer sr-only" [checked]="checked()" [disabled]="disabled()" (change)="toggle()" />
      <span aria-hidden="true"
        class="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 border-line-strong bg-surface transition-colors
               group-hover:border-brand-500 peer-checked:border-brand-500 peer-checked:bg-brand-500
               peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500
               [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
        <svg viewBox="0 0 16 16" class="size-3 text-on-brand" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      <span class="min-w-0 flex-1 leading-snug"><ng-content /></span>
    </label>
  `,
})
export class Checkbox {
  readonly checked = model(false);
  readonly disabled = input(false);

  protected toggle(): void {
    this.checked.set(!this.checked());
  }
}
