import { Component, computed, input } from '@angular/core';

/** Mirrors core's VerificationStatus; declared here because shared/ must not depend on core/. */
export type VerificationStatus = 'official' | 'confirmed' | 'corrected' | 'multiple-correct' | 'flagged' | 'unverified';

const LABELS: Record<VerificationStatus, string> = {
  official: 'Official answer',
  confirmed: 'Verified',
  corrected: 'Corrected answer',
  'multiple-correct': 'More than one correct',
  flagged: 'Flagged',
  unverified: 'Unverified',
};

const STYLES: Record<VerificationStatus, string> = {
  official: 'bg-brand-100 text-brand-800',
  confirmed: 'bg-ok-50 text-ok-700',
  corrected: 'bg-warn-50 text-warn-700',
  'multiple-correct': 'bg-brand-50 text-brand-600',
  flagged: 'bg-bad-50 text-bad-700',
  unverified: 'bg-inset text-subtle',
};

@Component({
  selector: 'ui-status-badge',
  template: `<span [class]="classes()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<VerificationStatus>();
  protected readonly label = computed(() => LABELS[this.status()]);
  protected readonly classes = computed(
    () => `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[this.status()]}`,
  );
}
