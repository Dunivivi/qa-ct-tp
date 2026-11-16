import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../core/ui/confirm.service';
import { ButtonDirective } from '../shared/ui/button.directive';

@Component({
  selector: 'app-confirm-host',
  imports: [ButtonDirective],
  template: `
    <dialog #dlg class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
      aria-labelledby="cf-title" aria-describedby="cf-msg" (close)="onClose()">
      @if (pending(); as p) {
        <form method="dialog" class="flex flex-col gap-4 p-6">
          <h2 id="cf-title" class="m-0 font-display text-xl font-semibold">{{ p.title }}</h2>
          <p id="cf-msg" class="m-0 text-muted">{{ p.message }}</p>
          <div class="flex flex-wrap justify-end gap-2 pt-2">
            <button uiBtn type="button" (click)="svc.answer(false)">{{ cancelLabel() }}</button>
            <button [uiBtn]="confirmVariant()" type="button" (click)="svc.answer(true)" autofocus>{{ confirmLabel() }}</button>
          </div>
        </form>
      }
    </dialog>
  `,
})
export class ConfirmHost {
  protected readonly svc = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly pending = this.svc.pending;
  protected readonly confirmLabel = computed(() => this.pending()?.confirmLabel ?? 'Confirm');
  protected readonly cancelLabel = computed(() => this.pending()?.cancelLabel ?? 'Cancel');
  protected readonly confirmVariant = computed(() => (this.pending()?.danger ? 'danger' : 'primary'));

  constructor() {
    // <dialog> open/close is imperative DOM API, so it's synced from state in an effect.
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.pending() && !el.open) el.showModal();
      else if (!this.pending() && el.open) el.close();
    });
  }

  /** Escape closes the native dialog: treat it as cancel. */
  protected onClose(): void {
    if (this.pending()) this.svc.answer(false);
  }
}
