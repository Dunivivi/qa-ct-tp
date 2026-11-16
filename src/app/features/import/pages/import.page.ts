import { Component, computed, inject, signal } from '@angular/core';
import { BankStore } from '../../../core/bank/bank.store';
import { ButtonDirective } from '../../../shared/ui/button.directive';

const ORIGIN_LABEL = { bundled: 'Built in (official sample)', local: 'Local folder (dev only)', imported: 'Imported in this browser' } as const;

@Component({
  selector: 'app-import-page',
  imports: [ButtonDirective],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <h1 class="m-0 font-display text-3xl font-semibold">Import questions</h1>
      <p class="m-0 text-muted">
        Add the question JSON files (e.g. <code>mockexamnetwork-istqb-ct-pt-questions.json</code>). They are stored only in this
        browser (IndexedDB) and are never uploaded — the deployed site contains just the official sample exams.
      </p>

      <label class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-surface p-8 text-center hover:border-brand-500">
        <span class="font-semibold">Choose JSON files</span>
        <span class="text-sm text-subtle">You can select several at once. Importing a file with the same name replaces it.</span>
        <input type="file" accept="application/json,.json" multiple class="sr-only" (change)="onFiles($event)" />
      </label>

      @if (busy()) {
        <p class="m-0 text-muted" role="status">Importing…</p>
      }
      @if (message(); as m) {
        <p [class]="messageClass()" role="status">{{ m }}</p>
      }

      <section aria-labelledby="loaded">
        <h2 id="loaded" class="font-display text-lg font-semibold">Loaded sources</h2>
        @if (bank.isLoading()) {
          <p class="text-muted" role="status">Loading…</p>
        } @else {
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            @for (s of rows(); track s.id) {
              <li class="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
                <div class="min-w-0 flex-1">
                  <div class="font-semibold">{{ s.label }}</div>
                  <div class="truncate text-sm text-subtle">{{ s.count }} questions · {{ s.origin }} · {{ s.fileName }}</div>
                </div>
                @if (s.removable) {
                  <button uiBtn="danger" size="sm" type="button" (click)="remove(s.fileName)">Remove</button>
                }
              </li>
            } @empty {
              <li class="rounded-xl border border-dashed border-line-strong p-6 text-center text-muted">Nothing loaded yet.</li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class ImportPage {
  protected readonly bank = inject(BankStore);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  private readonly failed = signal(false);

  protected readonly messageClass = computed(
    () => `m-0 rounded-lg p-3 text-sm ${this.failed() ? 'bg-bad-50 text-bad-700' : 'bg-ok-50 text-ok-700'}`,
  );
  protected readonly rows = computed(() =>
    this.bank.sources().map((s) => ({
      id: s.id,
      label: s.label,
      count: s.questions.length,
      origin: ORIGIN_LABEL[s.origin],
      fileName: s.fileName,
      removable: s.origin === 'imported',
    })),
  );

  protected async onFiles(e: Event): Promise<void> {
    const input = e.target instanceof HTMLInputElement ? e.target : null;
    const files = [...(input?.files ?? [])];
    if (!files.length) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const names = await this.bank.importFiles(files);
      this.failed.set(false);
      this.message.set(`Imported ${names.length} file${names.length === 1 ? '' : 's'}: ${names.join(', ')}`);
    } catch (err) {
      this.failed.set(true);
      this.message.set(`Nothing was imported. ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.busy.set(false);
      if (input) input.value = '';
    }
  }

  protected async remove(fileName: string): Promise<void> {
    await this.bank.removeImport(fileName);
    this.failed.set(false);
    this.message.set(`Removed ${fileName}.`);
  }
}
