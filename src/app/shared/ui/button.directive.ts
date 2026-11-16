import { Directive, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg text-center font-medium leading-tight no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-on-brand hover:bg-brand-600',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-inset',
  ghost: 'text-muted hover:bg-brand-50 hover:text-brand-600',
  danger: 'border border-bad-500 bg-surface text-bad-700 hover:bg-bad-50',
};
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-12 px-5 py-2.5 text-[15px] font-semibold',
};

/** One place for button styling, used on both <button> and <a>. */
@Directive({
  selector: '[uiBtn]',
  host: { '[class]': 'classes()' },
})
export class ButtonDirective {
  readonly uiBtn = input<ButtonVariant | ''>('');
  readonly size = input<ButtonSize>('md');
  protected readonly classes = computed(() => `${BASE} ${VARIANTS[this.uiBtn() || 'secondary']} ${SIZES[this.size()]}`);
}
