import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { BankStore } from '../core/bank/bank.store';
import { CHAPTERS, EXAM_MINUTES, EXAM_SIZE } from '../core/bank/question.model';
import { DEFAULT_CONFIG, TestConfig } from '../core/session/session.model';
import { EmptyPoolError, SessionStore } from '../core/session/session.store';
import { SettingsStore } from '../core/settings/settings.store';
import { SettingsPanelService } from '../core/ui/settings-panel.service';
import { SHORTCUTS } from '../core/ui/shortcuts';

interface Command {
  readonly id: string;
  readonly group: 'Go to' | 'Start' | 'Practice a module' | 'Appearance' | 'Search';
  readonly label: string;
  readonly hint?: string;
  readonly run: () => void;
}

const KEYCAP = 'rounded border border-line-strong px-1.5 py-0.5 font-sans text-[11px] text-subtle';

@Component({
  selector: 'app-command-palette',
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  template: `
    <!-- Fixed 580px pane, centred horizontally and 14vh from the top, as in the MirrorGuard admin. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- backdrop click; the keyboard equivalent is Esc, handled natively by <dialog> -->
    <dialog #dlg class="fixed inset-x-0 top-[14vh] m-0 mx-auto w-[min(580px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-[0_16px_48px_rgb(0_0_0/0.28)] backdrop:bg-black/50"
      [attr.aria-label]="showShortcuts() ? 'Keyboard shortcuts' : 'Search and commands'" (close)="open.set(false)" (click)="onBackdrop($event)">
      @if (open()) {
        @if (showShortcuts()) {
          <div class="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
            <h2 class="m-0 flex-1 font-display text-base font-semibold">Keyboard shortcuts</h2>
            <button type="button" class="rounded-sm text-subtle" aria-label="Close" (click)="open.set(false)"><kbd [class]="keycap">esc</kbd></button>
          </div>
          <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 p-4 text-sm">
            @for (s of shortcuts; track s[0]) {
              <dt><kbd class="rounded border border-line-strong bg-inset px-1.5 py-0.5 font-mono text-xs text-ink">{{ s[0] }}</kbd></dt>
              <dd class="m-0 text-muted">{{ s[1] }}</dd>
            }
          </dl>
        } @else {
          <div class="flex items-center gap-2.5 border-b border-line px-4 py-3.5 has-[input:focus-visible]:border-brand-500 has-[input:focus-visible]:shadow-[inset_0_-1px_0_0_var(--color-brand-500)]">
            <svg viewBox="0 0 20 20" class="size-[18px] shrink-0 text-subtle" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="9" cy="9" r="6" /><path d="M14 14l4 4" />
            </svg>
            <label for="cp-q" class="sr-only">Search questions and commands</label>
            <input #inp id="cp-q" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list"
              [attr.aria-expanded]="rows().length > 0" aria-controls="cp-list" [attr.aria-activedescendant]="activeId()"
              placeholder="Search questions, pages and commands…"
              class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
              [value]="query()" (input)="onInput($event)" (keydown)="onListKey($event)" />
            <button type="button" class="shrink-0 rounded-sm" aria-label="Close" (click)="open.set(false)"><kbd [class]="keycap">esc</kbd></button>
          </div>
          @if (rows().length) {
            <ul id="cp-list" role="listbox" aria-label="Results" class="m-0 max-h-[46vh] list-none overflow-y-auto p-1.5">
              @for (row of rows(); track row.cmd.id) {
                @if (row.header) {
                  <li role="presentation" class="px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-[0.04em] text-subtle uppercase">{{ row.cmd.group }}</li>
                }
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- activedescendant listbox: focus stays on the search box, which handles the keys -->
                <li role="option" [id]="'cp-' + row.cmd.id" [attr.aria-selected]="row.active" [class]="row.classes"
                  (click)="run(row.cmd)" (mousemove)="selected.set(row.index)">
                  <span class="flex-1 truncate">{{ row.cmd.label }}</span>
                  @if (row.cmd.hint) {
                    <span class="shrink-0 text-[11px] text-subtle">{{ row.cmd.hint }}</span>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="m-0 p-6 text-center text-sm text-muted">No matches.</p>
          }
          @if (error(); as e) {
            <p class="m-0 border-t border-line px-4 py-3 text-sm text-bad-700" role="alert">{{ e }}</p>
          }
          <div class="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-subtle">
            <span><kbd [class]="keycap">↑</kbd> <kbd [class]="keycap">↓</kbd> move</span>
            <span><kbd [class]="keycap">↵</kbd> open</span>
            <span><kbd [class]="keycap">?</kbd> shortcuts</span>
          </div>
        }
      }
    </dialog>
  `,
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly bank = inject(BankStore);
  private readonly session = inject(SessionStore);
  private readonly settings = inject(SettingsStore);
  private readonly settingsPanel = inject(SettingsPanelService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly inp = viewChild<ElementRef<HTMLInputElement>>('inp');

  protected readonly shortcuts = SHORTCUTS;
  protected readonly keycap = KEYCAP;
  protected readonly open = signal(false);
  protected readonly showShortcuts = signal(false);
  protected readonly query = signal('');
  protected readonly selected = signal(0);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // <dialog> visibility and input focus are imperative DOM calls, synced from state.
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open() && !el.open) el.showModal();
      if (!this.open() && el.open) el.close();
      this.inp()?.nativeElement.focus();
    });
  }

  private readonly commands = computed<Command[]>(() => {
    const go = (id: string, label: string, path: string, hint?: string): Command => ({
      id, group: 'Go to', label, hint, run: () => void this.router.navigateByUrl(path),
    });
    const start = (id: string, label: string, cfg: Partial<TestConfig>, hint?: string): Command => ({
      id, group: 'Start', label, hint, run: () => this.startTest({ ...DEFAULT_CONFIG, label, ...cfg }),
    });
    const blitz = this.settings.settings().blitzSeconds;
    const list: Command[] = [
      go('go-library', 'Library', '/'),
      go('go-learn', 'Learn (spaced repetition)', '/learn'),
      go('go-browse', 'Browse questions', '/browse'),
      go('go-wrong', 'Questions I got wrong', '/browse?status=wrong'),
      go('go-bookmarks', 'Bookmarked questions', '/browse?status=bookmarked'),
      go('go-history', 'History & progress', '/history'),
      go('go-import', 'Import questions', '/import'),
      { id: 'go-settings', group: 'Go to', label: 'Settings', hint: 'theme, defaults, backup', run: () => this.settingsPanel.show() },
    ];
    if (this.session.active()) list.unshift(go('go-resume', 'Resume current test', '/test', this.session.session()?.config.label));
    list.push(
      start('st-exam', 'Real exam simulation', { count: EXAM_SIZE, timeLimitMin: EXAM_MINUTES, mode: 'exam', weighted: true }, '40 q · 90 min · all providers'),
      start('st-official', 'Official sample questions only', { sourceIds: ['istqb', 'astqb'], count: EXAM_SIZE, timeLimitMin: EXAM_MINUTES, mode: 'exam' }, 'ISTQB + ASTQB'),
      start('st-quick', 'Quick 10', { count: 10, timeLimitMin: 10, mode: 'practice', weighted: false }, 'answers after each'),
      start('st-survival', 'Survival', { count: 200, timeLimitMin: 0, variant: 'survival', mode: 'practice', weighted: false }, 'ends at first miss'),
      start('st-blitz', 'Blitz', { count: 20, timeLimitMin: 0, variant: 'blitz', mode: 'exam', secondsPerQuestion: blitz, weighted: false }, `20 × ${blitz} s`),
      start('st-wrong', 'Practice my mistakes', { count: 20, timeLimitMin: 0, mode: 'practice', weighted: false, preferWrong: true }, '20 q, wrong first'),
      ...CHAPTERS.map<Command>((c) => ({
        id: `ch-${c.id}`,
        group: 'Practice a module',
        label: `${c.id} · ${c.name}`,
        hint: '20 q practice',
        run: () => this.startTest({ ...DEFAULT_CONFIG, label: `Module ${c.id} · ${c.name}`, chapters: [c.id], count: 20, timeLimitMin: 0, mode: 'practice', weighted: false }),
      })),
      { id: 'th-dark', group: 'Appearance', label: 'Theme: dark', run: () => this.settings.set({ theme: 'dark' }) },
      { id: 'th-light', group: 'Appearance', label: 'Theme: light', run: () => this.settings.set({ theme: 'light' }) },
      { id: 'th-system', group: 'Appearance', label: 'Theme: match system', run: () => this.settings.set({ theme: 'system' }) },
      { id: 'tx-size', group: 'Appearance', label: 'Cycle text size (S · M · L)', run: () => this.settings.set({ fontScale: ({ sm: 'md', md: 'lg', lg: 'sm' } as const)[this.settings.settings().fontScale] }) },
    );
    return list;
  });

  private readonly filtered = computed<Command[]>(() => {
    const q = this.query().trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const matches = this.commands().filter((c) => words.every((w) => `${c.label} ${c.hint ?? ''} ${c.group}`.toLowerCase().includes(w)));
    if (q.length >= 2) {
      const text = this.query().trim();
      matches.push({ id: 'search', group: 'Search', label: `Search questions for “${text}”`, run: () => void this.router.navigate(['/browse'], { queryParams: { q: text } }) });
    }
    return matches;
  });

  protected readonly rows = computed(() => {
    const sel = Math.min(this.selected(), Math.max(0, this.filtered().length - 1));
    return this.filtered().map((cmd, index, all) => ({
      cmd,
      index,
      header: index === 0 || all[index - 1]?.group !== cmd.group,
      active: index === sel,
      classes: `flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${index === sel ? 'bg-brand-50 text-brand-600' : 'text-ink hover:bg-inset'}`,
    }));
  });
  protected readonly activeId = computed(() => {
    const row = this.rows().find((r) => r.active);
    return row ? `cp-${row.cmd.id}` : null;
  });

  protected onInput(e: Event): void {
    this.query.set(e.target instanceof HTMLInputElement ? e.target.value : '');
    this.selected.set(0);
  }

  protected onListKey(e: KeyboardEvent): void {
    const n = this.filtered().length;
    if (e.key === 'ArrowDown') this.selected.update((i) => (n ? (i + 1) % n : 0));
    else if (e.key === 'ArrowUp') this.selected.update((i) => (n ? (i - 1 + n) % n : 0));
    else if (e.key === 'Enter') {
      const row = this.rows().find((r) => r.active);
      if (row) this.run(row.cmd);
    } else return;
    e.preventDefault();
  }

  /** A click on the dialog element itself (not its content) is a click on the backdrop. */
  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.open.set(false);
  }

  protected onGlobalKey(e: KeyboardEvent): void {
    const t = e.target;
    const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.show(false);
    } else if (!typing && !this.open() && e.key === '/') {
      e.preventDefault();
      this.show(false);
    } else if (!typing && e.key === '?') {
      e.preventDefault();
      this.show(true);
    }
  }

  show(shortcuts: boolean): void {
    this.query.set('');
    this.selected.set(0);
    this.error.set(null);
    this.showShortcuts.set(shortcuts);
    this.open.set(true);
  }

  protected run(cmd: Command): void {
    this.error.set(null);
    cmd.run();
    if (!this.error()) this.open.set(false);
  }

  private startTest(cfg: TestConfig): void {
    const sourceIds = cfg.sourceIds.length ? cfg.sourceIds : this.bank.sources().map((s) => s.id);
    try {
      this.session.start({ ...cfg, sourceIds });
      void this.router.navigate(['/test']);
    } catch (e) {
      this.error.set(e instanceof EmptyPoolError ? e.message : 'Could not start the test.');
    }
  }
}
