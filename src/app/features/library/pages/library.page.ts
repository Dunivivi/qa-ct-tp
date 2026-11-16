import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BankStore } from '../../../core/bank/bank.store';
import { ProgressStore } from '../../../core/progress/progress.store';
import { SettingsStore } from '../../../core/settings/settings.store';
import { DEFAULT_CONFIG, TestConfig } from '../../../core/session/session.model';
import { EmptyPoolError, SessionStore } from '../../../core/session/session.store';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { Select, SelectOption } from '../../../shared/ui/select';
import { ALL_SOURCES, ModuleSummary, summarizeModules, summarizeSources } from '../model/library.model';
import { ModuleCard } from '../ui/module-card';
import { SourceList } from '../ui/source-list';
import { TestBuilder } from '../ui/test-builder';

// v2: the default answer mode became 'after each'; older saved options would override it.
const BUILDER_KEY = 'ctpt.builder.v2';

function readSavedOptions(): Partial<TestConfig> {
  try {
    const raw = localStorage.getItem(BUILDER_KEY);
    return raw ? (JSON.parse(raw) as Partial<TestConfig>) : {};
  } catch {
    return {};
  }
}

@Component({
  selector: 'app-library-page',
  imports: [SourceList, ModuleCard, TestBuilder, ButtonDirective, RouterLink, Select],
  template: `
    @if (bank.isLoading() && !sources().length) {
      <p class="p-8 text-muted" role="status">Loading question banks…</p>
    } @else if (bank.error(); as err) {
      <div class="m-8 rounded-xl border border-bad-500/40 bg-bad-50 p-6 text-bad-700" role="alert">
        <h1 class="m-0 font-display text-xl">Could not load the question banks</h1>
        <p class="mb-4">{{ err }}</p>
        <button uiBtn type="button" (click)="bank.reload()">Try again</button>
      </div>
    } @else if (!sources().length) {
      <div class="mx-auto my-16 flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 class="m-0 font-display text-2xl font-semibold">No questions yet</h1>
        <p class="m-0 text-muted">Import your question JSON files. They stay in this browser and are never uploaded.</p>
        <a uiBtn="primary" routerLink="/import">Import questions</a>
      </div>
    } @else {
      <div class="flex flex-wrap items-start gap-6 px-4 py-6 sm:px-8">
        <ui-select class="w-full md:hidden" label="Source" [options]="sourceOptions()" [value]="selectedId()" (valueChange)="pickSource($event)" />
        <aside class="hidden w-full max-w-xs flex-[1_1_240px] md:block">
          <app-source-list [sources]="sourceSummaries()" [selected]="selectedId()" />
        </aside>

        <main class="flex min-w-0 flex-[999_1_480px] flex-col gap-5">
          <div class="flex flex-wrap items-end gap-4">
            <div class="min-w-0 flex-[1_1_280px]">
              <div class="text-sm text-subtle">{{ eyebrow() }}</div>
              <h1 class="m-0 mt-0.5 font-display text-3xl font-semibold">{{ title() }}</h1>
              <p class="m-0 mt-1.5 text-muted">{{ subtitle() }}</p>
            </div>
            <div class="flex rounded-lg bg-inset p-1" role="group" aria-label="Show">
              <button type="button" class="min-h-9 rounded-md bg-surface px-3 py-1.5 text-sm font-semibold whitespace-nowrap shadow-sm" aria-pressed="true">By module</button>
              <a routerLink="/browse" [queryParams]="browseAll()" class="flex min-h-9 items-center rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted no-underline hover:text-ink">All questions</a>
            </div>
          </div>

          @if (startError(); as e) {
            <p class="m-0 rounded-lg bg-bad-50 p-3 text-sm text-bad-700" role="alert">{{ e }}</p>
          }

          <div class="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
            @for (m of modules(); track m.chapter) {
              <app-module-card [module]="m" [sourceId]="selectedId()" (quiz)="quickQuiz($event)" />
            } @empty {
              <p class="text-muted">This source has no questions.</p>
            }
          </div>
        </main>

        <aside class="w-full max-w-sm flex-[1_1_300px]">
          <app-test-builder [sources]="sourceSummaries()" [poolSize]="poolSize()" [blitzSeconds]="blitzSeconds()" [(config)]="config" (start)="startTest(config())" />
        </aside>
      </div>
    }
  `,
})
export class LibraryPage {
  protected readonly bank = inject(BankStore);
  private readonly progress = inject(ProgressStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsStore);
  protected readonly blitzSeconds = computed(() => this.settings.settings().blitzSeconds);

  /** Query param `?source=` (bound by withComponentInputBinding). */
  readonly source = input<string>();

  protected readonly sources = this.bank.sources;
  protected readonly sourceSummaries = computed(() => summarizeSources(this.sources()));
  protected readonly sourceOptions = computed<SelectOption[]>(() => [
    { value: ALL_SOURCES, label: 'All providers', hint: String(this.bank.questions().length) },
    ...this.sourceSummaries().map((s) => ({ value: s.id, label: s.label, hint: String(s.count) })),
  ]);
  protected readonly selectedId = computed(() => {
    const id = this.source();
    return id && this.bank.sourceById().has(id) ? id : ALL_SOURCES;
  });
  private readonly selectedQuestions = computed(() => {
    const id = this.selectedId();
    return id === ALL_SOURCES ? this.bank.questions() : (this.bank.sourceById().get(id)?.questions ?? []);
  });
  protected readonly modules = computed(() => summarizeModules(this.selectedQuestions(), this.progress.stats()));

  protected readonly title = computed(() =>
    this.selectedId() === ALL_SOURCES ? 'All providers' : (this.bank.sourceById().get(this.selectedId())?.label ?? ''),
  );
  protected readonly eyebrow = computed(() => (this.selectedId() === ALL_SOURCES ? 'Combined bank' : 'Source'));
  protected readonly subtitle = computed(() => {
    const qs = this.selectedQuestions();
    const count = (s: string) => qs.filter((q) => q.status === s).length;
    const parts = [
      `${qs.length} questions`,
      count('official') && `${count('official')} official`,
      count('confirmed') && `${count('confirmed')} verified`,
      count('corrected') && `${count('corrected')} corrected`,
      count('flagged') && `${count('flagged')} flagged`,
    ];
    return parts.filter(Boolean).join(' · ');
  });
  protected readonly browseAll = computed(() => ({ source: this.selectedId() }));

  /** Follows the sidebar selection until the user edits the builder; other options are remembered. */
  protected readonly config = linkedSignal<TestConfig>(() => {
    const id = this.selectedId();
    const ids = id === ALL_SOURCES ? this.sources().map((s) => s.id) : [id];
    return { ...DEFAULT_CONFIG, ...readSavedOptions(), label: id === ALL_SOURCES ? 'All providers' : this.title(), sourceIds: ids };
  });

  constructor() {
    // Remembering the builder between visits is a write to browser storage, hence an effect.
    effect(() => {
      const { label: _l, sourceIds: _s, questionIds: _q, ...options } = this.config();
      try {
        localStorage.setItem(BUILDER_KEY, JSON.stringify(options));
      } catch {
        /* storage unavailable: the builder just starts from defaults next time */
      }
    });
  }
  protected readonly poolSize = computed(() => this.session.poolSize(this.config()));
  protected readonly startError = signal<string | null>(null);

  protected pickSource(id: string): void {
    void this.router.navigate([], { queryParams: { source: id } });
  }

  protected quickQuiz(chapter: ModuleSummary['chapter']): void {
    const id = this.selectedId();
    this.startTest({
      ...DEFAULT_CONFIG,
      label: `${this.title()} · ${this.modules().find((m) => m.chapter === chapter)?.name ?? 'Module'}`,
      sourceIds: id === ALL_SOURCES ? this.sources().map((s) => s.id) : [id],
      chapters: [chapter],
      count: 20,
      timeLimitMin: 0,
      mode: 'practice',
      weighted: false,
    });
  }

  protected startTest(cfg: TestConfig): void {
    try {
      this.session.start(cfg);
      this.startError.set(null);
      void this.router.navigate(['/test']);
    } catch (e) {
      this.startError.set(e instanceof EmptyPoolError ? e.message : 'Could not start the test.');
    }
  }
}
