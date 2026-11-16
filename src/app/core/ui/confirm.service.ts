import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** Destructive actions get the danger button. */
  readonly danger?: boolean;
}

interface Pending extends ConfirmOptions {
  readonly resolve: (ok: boolean) => void;
}

/** App-wide confirm prompt rendered by the shell's <app-confirm-host>; one at a time. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<Pending | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    // A new prompt supersedes an unanswered one, which counts as cancelled.
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  answer(ok: boolean): void {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
  }
}
