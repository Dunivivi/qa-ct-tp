import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BankStore } from '../../../core/bank/bank.store';
import { CHAPTERS, Question } from '../../../core/bank/question.model';
import { ProgressStore } from '../../../core/progress/progress.store';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { Checkbox } from '../../../shared/ui/checkbox';
import { Select, SelectOption } from '../../../shared/ui/select';
import { QuestionCard } from '../ui/question-card';

const PAGE_SIZE = 20;

type StatusFilter = 'all' | 'official' | 'corrected' | 'flagged' | 'multiple-correct' | 'bookmarked' | 'wrong' | 'unseen' | 'hidden';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] & SelectOption[] = [
  { value: 'all', label: 'All' },
  { value: 'official', label: 'Official answers' },
  { value: 'corrected', label: 'Corrected answers' },
  { value: 'flagged', label: 'Flagged / disputed' },
  { value: 'multiple-correct', label: 'More than one correct' },
  { value: 'bookmarked', label: 'Bookmarked' },
  { value: 'wrong', label: 'I got wrong' },
  { value: 'unseen', label: 'Not seen yet' },
  { value: 'hidden', label: 'Hidden' },
];

@Component({
  selector: 'app-browse-page',
  imports: [QuestionCard, ButtonDirective, Select, Checkbox],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 sm:px-8">
      <h1 class="m-0 font-display text-3xl font-semibold">Browse questions</h1>

      <form class="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4" role="search" (submit)="$event.preventDefault()">
        <label class="flex min-w-48 flex-[2_1_220px] flex-col gap-1 text-sm">
          <span class="text-subtle">Search</span>
          <input type="search" class="min-h-10 rounded-lg border border-line-strong bg-surface px-3" [value]="query()" placeholder="Words in question or answers"
            (input)="set({ q: valueOf($event) || null })" />
        </label>
        <ui-select class="flex-[1_1_170px]" label="Source" [options]="sourceOptions()" [value]="sourceFilter()" (valueChange)="set({ source: $event || null })" />
        <ui-select class="flex-[1_1_170px]" label="Module" [options]="chapterOptions" [value]="chapterValue()" (valueChange)="set({ chapter: $event || null })" />
        <ui-select class="flex-[1_1_170px]" label="Show" [options]="statusOptions" [value]="statusFilter()" (valueChange)="set({ status: $event })" />
        <ui-checkbox class="self-center pt-5" [checked]="revealAll()" (checkedChange)="set({ reveal: $event ? '1' : null })">Show answers</ui-checkbox>
      </form>

      @if (bank.isLoading() && !bank.questions().length) {
        <p class="text-muted" role="status">Loading…</p>
      } @else {
        <p class="m-0 text-sm text-subtle" aria-live="polite">{{ resultLabel() }}</p>
        @for (r of pageRows(); track r.q.id) {
          <app-question-card
            [question]="r.q"
            [sourceLabel]="r.label"
            [bookmarked]="r.bookmarked"
            [hidden]="r.hidden"
            [note]="r.note"
            [statLine]="r.statLine"
            [startRevealed]="revealAll()"
            (bookmark)="progress.toggleBookmark(r.q.id)"
            (hide)="progress.toggleHidden(r.q.id)"
            (noteChange)="progress.setNote(r.q.id, $event)"
          />
        } @empty {
          <div class="rounded-xl border border-dashed border-line-strong p-10 text-center text-muted">No questions match these filters.</div>
        }
        @if (pageCount() > 1) {
          <nav class="flex items-center justify-center gap-3" aria-label="Pages">
            <button uiBtn size="sm" type="button" [disabled]="currentPage() <= 1" (click)="set({ page: currentPage() - 1 })">← Previous</button>
            <span class="text-sm text-muted">Page {{ currentPage() }} of {{ pageCount() }}</span>
            <button uiBtn size="sm" type="button" [disabled]="currentPage() >= pageCount()" (click)="set({ page: currentPage() + 1 })">Next →</button>
          </nav>
        }
      }
    </div>
  `,
})
export class BrowsePage {
  protected readonly bank = inject(BankStore);
  protected readonly progress = inject(ProgressStore);
  private readonly router = inject(Router);

  readonly source = input<string>();
  readonly chapter = input<string>();
  readonly status = input<string>();
  readonly q = input<string>();
  readonly page = input<string>();
  readonly reveal = input<string>();

  protected readonly chapterOptions: SelectOption[] = [{ value: '', label: 'All modules' }, ...CHAPTERS.map((c) => ({ value: String(c.id), label: `${c.id} · ${c.name}` }))];
  protected readonly sourceOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All providers' },
    ...this.bank.sources().map((s) => ({ value: s.id, label: s.label, hint: String(s.questions.length) })),
  ]);
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly sourceFilter = computed(() => this.source() ?? '');
  protected readonly chapterFilter = computed(() => {
    const n = Number(this.chapter());
    return n >= 1 && n <= 5 ? n : 0;
  });
  protected readonly statusFilter = computed<StatusFilter>(
    () => STATUS_OPTIONS.find((o) => o.value === this.status())?.value ?? 'all',
  );
  protected readonly chapterValue = computed(() => (this.chapterFilter() ? String(this.chapterFilter()) : ''));
  protected readonly query = computed(() => this.q() ?? '');
  protected readonly revealAll = computed(() => this.reveal() === '1');

  private readonly filtered = computed(() => {
    const src = this.sourceFilter();
    const ch = this.chapterFilter();
    const st = this.statusFilter();
    const words = this.query().toLowerCase().split(/\s+/).filter(Boolean);
    const { bookmarks, hidden } = { bookmarks: this.progress.bookmarks(), hidden: this.progress.hidden() };
    const stats = this.progress.stats();
    return this.bank.questions().filter((q) => {
      if (src && q.sourceId !== src) return false;
      if (ch && q.chapter !== ch) return false;
      if (st !== 'hidden' && hidden.has(q.id)) return false;
      if (st === 'hidden' && !hidden.has(q.id)) return false;
      if (st === 'bookmarked' && !bookmarks.has(q.id)) return false;
      if (st === 'wrong' && !(stats[q.id]?.wrong)) return false;
      if (st === 'unseen' && stats[q.id]) return false;
      if (['official', 'corrected', 'flagged', 'multiple-correct'].includes(st) && q.status !== st) return false;
      if (words.length) {
        const hay = `${q.text} ${q.scenario ?? ''} ${q.choices.map((c) => c.text).join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  protected readonly currentPage = computed(() => Math.min(Math.max(1, Number(this.page()) || 1), this.pageCount()));
  protected readonly pageItems = computed(() => this.filtered().slice((this.currentPage() - 1) * PAGE_SIZE, this.currentPage() * PAGE_SIZE));
  protected readonly resultLabel = computed(() => {
    const n = this.filtered().length;
    return n ? `${n} question${n === 1 ? '' : 's'} · showing ${(this.currentPage() - 1) * PAGE_SIZE + 1}–${Math.min(this.currentPage() * PAGE_SIZE, n)}` : '';
  });

  protected readonly pageRows = computed(() => {
    const sources = this.bank.sourceById();
    const { bookmarks, hidden, notes, stats } = {
      bookmarks: this.progress.bookmarks(),
      hidden: this.progress.hidden(),
      notes: this.progress.notes(),
      stats: this.progress.stats(),
    };
    return this.pageItems().map((q: Question) => {
      const s = stats[q.id];
      return {
        q,
        label: sources.get(q.sourceId)?.label ?? q.sourceId,
        bookmarked: bookmarks.has(q.id),
        hidden: hidden.has(q.id),
        note: notes[q.id] ?? '',
        statLine: s ? `Answered ${s.seen}× · ${s.right} right · last ${s.lastRight ? 'right' : 'wrong'}` : null,
      };
    });
  });

  protected valueOf(e: Event): string {
    const t = e.target;
    return t instanceof HTMLInputElement || t instanceof HTMLSelectElement ? t.value : '';
  }

  protected set(params: Record<string, string | number | null>): void {
    // Any filter change returns to page 1 unless the change *is* the page.
    const page = 'page' in params ? params['page'] : null;
    void this.router.navigate([], { queryParams: { ...params, page }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
