import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgressStore } from '../core/progress/progress.store';
import {
  BLITZ_SECONDS,
  DEFAULT_SETTINGS,
  LEARN_NEW_CARDS,
  PRESETS,
  PRIMARY_SWATCHES,
  PresetId,
  Settings,
  SettingsStore,
  onPrimary,
} from '../core/settings/settings.store';
import { ConfirmService } from '../core/ui/confirm.service';
import { SettingsPanelService, SettingsTab } from '../core/ui/settings-panel.service';
import { SHORTCUTS } from '../core/ui/shortcuts';
import { ButtonDirective } from '../shared/ui/button.directive';
import { download } from '../shared/util/download';

const SEG = 'min-h-9 flex-1 rounded-md px-2 py-1.5 text-sm leading-tight';
const segClass = (on: boolean) => `${SEG} ${on ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted hover:text-ink'}`;
type LookKey = 'skin' | 'font' | 'fontScale' | 'radius' | 'width' | 'motion';

const TAB = 'min-h-10 flex-1 border-b-2 px-2 text-sm whitespace-nowrap';

function rows<T>(options: readonly { value: T; label: string }[], current: T) {
  return options.map((o) => ({ ...o, on: o.value === current, classes: segClass(o.value === current) }));
}

const TABS: readonly { id: SettingsTab; label: string }[] = [
  { id: 'look', label: 'Appearance' },
  { id: 'study', label: 'Study' },
  { id: 'data', label: 'Data' },
  { id: 'keys', label: 'Shortcuts' },
];

/**
 * Settings as a right-hand drawer opened by an edge tab, after the MirrorGuard admin customizer:
 * the tab sits fixed at the vertical centre of the right edge; the panel is full height, 360px wide
 * (full width on phones), with tabs, a scrolling body and a reset footer.
 */
@Component({
  selector: 'app-settings-drawer',
  imports: [RouterLink, ButtonDirective],
  template: `
    @if (!panel.open()) {
      <button type="button" aria-label="Open settings" title="Settings" (click)="panel.show()"
        class="fixed top-1/2 right-0 z-30 -translate-y-1/2 rounded-s-lg border-2 border-e-0 border-inverse bg-brand-500 p-2 text-on-brand shadow-lg hover:bg-brand-600">
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    }

    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- backdrop click; the keyboard equivalent is Esc, handled natively by <dialog> -->
    <dialog #dlg aria-labelledby="sd-title" aria-describedby="sd-sub" (close)="panel.close()" (click)="onBackdrop($event)"
      class="drawer fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none border-0 border-s-2 border-inverse bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 md:w-[360px]">
      @if (panel.open()) {
        <div class="flex h-full flex-col">
          <div class="flex items-start gap-3 px-5 pt-5 pb-3">
            <div class="min-w-0 flex-1">
              <h2 id="sd-title" class="m-0 font-display text-xl font-bold">Settings</h2>
              <p id="sd-sub" class="m-0 text-sm text-muted">Customise the look, study defaults and your data</p>
            </div>
            <button type="button" class="grid size-9 place-items-center rounded-lg text-muted hover:bg-inset hover:text-ink" aria-label="Close settings" (click)="panel.close()">
              <svg viewBox="0 0 20 20" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </div>

          <div class="flex border-b border-line px-3" role="tablist" aria-label="Settings sections">
            @for (t of tabRows(); track t.id) {
              <button type="button" role="tab" [id]="'sd-tab-' + t.id" [attr.aria-selected]="t.on" [attr.aria-controls]="'sd-panel-' + t.id"
                [attr.tabindex]="t.on ? 0 : -1" [class]="t.classes" (click)="panel.tab.set(t.id)" (keydown)="onTabKey($event)">{{ t.label }}</button>
            }
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
            @switch (panel.tab()) {
              @case ('look') {
                <div role="tabpanel" id="sd-panel-look" aria-labelledby="sd-tab-look" class="flex flex-col gap-6">
                  <section class="flex flex-col gap-2" aria-labelledby="sd-preset">
                    <div class="flex items-center gap-2">
                      <h3 id="sd-preset" class="m-0 text-sm font-semibold">Preset</h3>
                      @if (isCustom()) {
                        <span class="rounded-full bg-inset px-2 py-0.5 text-xs text-subtle">Custom</span>
                      }
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                      @for (p of presetRows(); track p.id) {
                        <button type="button" [class]="p.classes" [attr.aria-pressed]="p.on" (click)="store.applyPreset(p.id)">
                          <span aria-hidden="true" [class]="p.previewClass" [style.--preview]="p.primary">
                            <span class="h-2 rounded-sm" [class]="p.barClass"></span>
                            <span class="h-1.5 w-2/3 rounded-sm bg-[var(--preview)]"></span>
                          </span>
                          <span class="text-sm font-semibold">{{ p.label }}</span>
                          <span class="text-[11px] leading-tight text-subtle">{{ p.hint }}</span>
                        </button>
                      }
                    </div>
                  </section>

                  <section class="flex flex-col gap-2" aria-labelledby="sd-mode">
                    <h3 id="sd-mode" class="m-0 text-sm font-semibold">Mode</h3>
                    <div class="flex rounded-lg bg-inset p-1" role="group" aria-labelledby="sd-mode">
                      @for (r of themeRows(); track r.value) {
                        <button type="button" [class]="r.classes" [attr.aria-pressed]="r.on" (click)="set({ theme: r.value })">{{ r.label }}</button>
                      }
                    </div>
                  </section>

                  <section class="flex flex-col gap-2" aria-labelledby="sd-color">
                    <h3 id="sd-color" class="m-0 text-sm font-semibold">Primary colour</h3>
                    <div class="flex flex-wrap items-center gap-2" role="group" aria-labelledby="sd-color">
                      @for (c of swatchRows(); track c.hex) {
                        <button type="button" [class]="c.classes" [style.background-color]="c.hex" [attr.aria-label]="c.name" [attr.aria-pressed]="c.on" [title]="c.name" (click)="set({ primary: c.hex })">
                          @if (c.on) {
                            <svg viewBox="0 0 16 16" class="size-4" [style.color]="c.ink" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
                          }
                        </button>
                      }
                      <label class="relative grid size-8 cursor-pointer place-items-center rounded-full border-2 border-dashed border-line-strong text-subtle hover:border-brand-500" title="Custom colour">
                        <span class="sr-only">Custom colour</span>
                        <svg viewBox="0 0 16 16" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
                        <input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" [value]="s().primary" (input)="pickColor($event)" />
                      </label>
                    </div>
                  </section>

                  @for (g of optionGroups(); track g.key) {
                    <section class="flex flex-col gap-2" [attr.aria-labelledby]="'sd-' + g.key">
                      <h3 [id]="'sd-' + g.key" class="m-0 text-sm font-semibold">{{ g.title }}</h3>
                      <div class="flex rounded-lg bg-inset p-1" role="group" [attr.aria-labelledby]="'sd-' + g.key">
                        @for (o of g.options; track o.value) {
                          <button type="button" [class]="o.classes" [attr.aria-pressed]="o.on" (click)="setOption(g.key, o.value)">{{ o.label }}</button>
                        }
                      </div>
                      @if (g.hint) {
                        <p class="m-0 text-xs text-subtle">{{ g.hint }}</p>
                      }
                    </section>
                  }
                </div>
              }
              @case ('study') {
                <div role="tabpanel" id="sd-panel-study" aria-labelledby="sd-tab-study" class="flex flex-col gap-5">
                  <div class="flex flex-col gap-2">
                    <span class="text-sm font-medium" id="sd-blitz">Blitz: seconds per question</span>
                    <div class="flex rounded-lg bg-inset p-1" role="group" aria-labelledby="sd-blitz">
                      @for (r of blitzRows(); track r.value) {
                        <button type="button" [class]="r.classes" [attr.aria-pressed]="r.on" (click)="set({ blitzSeconds: r.value })">{{ r.label }}</button>
                      }
                    </div>
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-sm font-medium" id="sd-new">Learn: new cards per session</span>
                    <div class="flex rounded-lg bg-inset p-1" role="group" aria-labelledby="sd-new">
                      @for (r of newRows(); track r.value) {
                        <button type="button" [class]="r.classes" [attr.aria-pressed]="r.on" (click)="set({ learnNewCards: r.value })">{{ r.label }}</button>
                      }
                    </div>
                  </div>
                  <p class="m-0 text-sm text-subtle">Test length, time limit, answer mode and filters are remembered from the test builder in the Library.</p>
                </div>
              }
              @case ('data') {
                <div role="tabpanel" id="sd-panel-data" aria-labelledby="sd-tab-data" class="flex flex-col gap-3">
                  <p class="m-0 text-sm text-muted">Progress lives only in this browser. Back it up to keep it safe or to continue on another device.</p>
                  <button uiBtn type="button" (click)="exportBackup()">Back up progress</button>
                  <label uiBtn class="cursor-pointer">
                    Restore backup
                    <input type="file" accept="application/json,.json" class="sr-only" (change)="restore($event)" />
                  </label>
                  <a uiBtn routerLink="/import" (click)="panel.close()">Manage question files</a>
                  <button uiBtn="danger" type="button" (click)="resetProgress()">Reset all progress</button>
                  @if (message(); as m) {
                    <p [class]="messageClass()" role="status">{{ m }}</p>
                  }
                </div>
              }
              @case ('keys') {
                <div role="tabpanel" id="sd-panel-keys" aria-labelledby="sd-tab-keys">
                  <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                    @for (s of shortcuts; track s[0]) {
                      <dt><kbd class="rounded border border-line-strong bg-inset px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-ink">{{ s[0] }}</kbd></dt>
                      <dd class="m-0 text-muted">{{ s[1] }}</dd>
                    }
                  </dl>
                </div>
              }
            }
          </div>

          <div class="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
            <button uiBtn size="sm" type="button" (click)="resetSettings()">Reset settings</button>
            @if (resetDone()) {
              <span class="text-sm font-semibold text-ok-700" role="status">Defaults restored</span>
            }
          </div>
        </div>
      }
    </dialog>
  `,
})
export class SettingsDrawer {
  protected readonly panel = inject(SettingsPanelService);
  protected readonly store = inject(SettingsStore);
  private readonly progress = inject(ProgressStore);
  private readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly shortcuts = SHORTCUTS;
  protected readonly s = this.store.settings;

  constructor() {
    // <dialog> open/close is an imperative DOM call, synced from the service state.
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.panel.open() && !el.open) el.showModal();
      else if (!this.panel.open() && el.open) el.close();
    });
  }

  protected readonly tabRows = computed(() =>
    TABS.map((t) => {
      const on = this.panel.tab() === t.id;
      return { ...t, on, classes: `${TAB} ${on ? 'border-brand-500 font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}` };
    }),
  );
  protected readonly isCustom = computed(() => this.s().preset === 'custom');
  protected readonly presetRows = computed(() =>
    (Object.keys(PRESETS) as PresetId[]).map((id) => {
      const p = PRESETS[id];
      const on = this.s().preset === id;
      const dark = p.look.theme === 'dark';
      return {
        id,
        label: p.label,
        hint: p.hint,
        on,
        primary: p.look.primary,
        classes: `flex flex-col items-start gap-1.5 rounded-xl border-2 p-2 text-left ${on ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-line-strong'}`,
        previewClass: `flex h-10 w-full flex-col justify-end gap-1 rounded-md p-1.5 ${dark ? 'bg-[#0f1115]' : 'bg-[#eef1f6]'} ${p.look.skin === 'bordered' ? 'border border-[#c5cad3]' : ''}`,
        barClass: p.look.skin === 'semi-dark' || dark ? 'bg-[#2a2e37]' : 'bg-white',
      };
    }),
  );
  protected readonly themeRows = computed(() =>
    rows([{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }] as const, this.s().theme),
  );
  protected readonly swatchRows = computed(() =>
    PRIMARY_SWATCHES.map((c) => {
      const on = this.s().primary === c.hex;
      return {
        ...c,
        on,
        ink: onPrimary(c.hex),
        classes: `grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface ${on ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line-strong'}`,
      };
    }),
  );
  /** The single-choice look options, rendered as segmented controls. */
  protected readonly optionGroups = computed(() => {
    const s = this.s();
    const group = <K extends LookKey>(key: K, title: string, options: readonly { value: Settings[K]; label: string }[], hint?: string) => ({
      key,
      title,
      hint,
      options: options.map((o) => ({ value: o.value as string, label: o.label, on: o.value === s[key], classes: segClass(o.value === s[key]) })),
    });
    return [
      group('skin', 'Skin', [{ value: 'default', label: 'Default' }, { value: 'bordered', label: 'Bordered' }, { value: 'semi-dark', label: 'Semi-dark' }], 'Semi-dark keeps the header dark in light mode.'),
      group('font', 'Font', [{ value: 'inter', label: 'Inter' }, { value: 'space-grotesk', label: 'Grotesk' }, { value: 'system', label: 'System' }]),
      group('fontScale', 'Text size', [{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }]),
      group('radius', 'Corners', [{ value: 'sm', label: 'Sharp' }, { value: 'md', label: 'Soft' }, { value: 'lg', label: 'Round' }]),
      group('width', 'Content width', [{ value: 'full', label: 'Full' }, { value: 'boxed', label: 'Boxed' }]),
      group('motion', 'Motion', [{ value: 'on', label: 'On' }, { value: 'reduced', label: 'Reduced' }]),
    ];
  });
  protected readonly blitzRows = computed(() => rows(BLITZ_SECONDS.map((v) => ({ value: v, label: `${v} s` })), this.s().blitzSeconds));
  protected readonly newRows = computed(() => rows(LEARN_NEW_CARDS.map((v) => ({ value: v, label: String(v) })), this.s().learnNewCards));

  protected readonly message = signal<string | null>(null);
  private readonly failed = signal(false);
  protected readonly resetDone = signal(false);
  protected readonly messageClass = computed(
    () => `m-0 rounded-lg p-3 text-sm ${this.failed() ? 'bg-bad-50 text-bad-700' : 'bg-ok-50 text-ok-700'}`,
  );

  protected setOption(key: LookKey, value: string): void {
    this.set({ [key]: value } as Partial<Settings>);
  }

  protected pickColor(e: Event): void {
    if (e.target instanceof HTMLInputElement) this.set({ primary: e.target.value.toLowerCase() });
  }

  protected set(patch: Partial<Settings>): void {
    this.resetDone.set(false);
    this.store.set(patch);
  }

  protected resetSettings(): void {
    this.store.set(DEFAULT_SETTINGS);
    this.resetDone.set(true);
  }

  /** Arrow keys move between tabs (WAI-ARIA tabs pattern). */
  protected onTabKey(e: KeyboardEvent): void {
    const i = TABS.findIndex((t) => t.id === this.panel.tab());
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const tab = TABS[(next + TABS.length) % TABS.length];
    if (!tab) return;
    this.panel.tab.set(tab.id);
    queueMicrotask(() => this.dlg().nativeElement.querySelector<HTMLElement>(`#sd-tab-${tab.id}`)?.focus());
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.panel.close();
  }

  protected exportBackup(): void {
    const stamp = new Date().toISOString().slice(0, 10);
    download(`ctpt-progress-${stamp}.json`, JSON.stringify(this.progress.exportBackup(), null, 2), 'application/json');
    this.failed.set(false);
    this.message.set('Backup downloaded. Restore it here on any browser to continue where you left off.');
  }

  protected async restore(e: Event): Promise<void> {
    const input = e.target instanceof HTMLInputElement ? e.target : null;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      const raw: unknown = JSON.parse(await file.text());
      const ok = await this.confirm.ask({ title: 'Restore this backup?', message: 'It replaces the progress currently stored in this browser.', confirmLabel: 'Restore', danger: true });
      if (ok) {
        const r = this.progress.restoreBackup(raw);
        this.failed.set(false);
        this.message.set(`Restored ${r.attempts} attempts and stats for ${r.answered} questions.`);
      }
    } catch (err) {
      this.failed.set(true);
      this.message.set(err instanceof SyntaxError ? `${file.name} is not valid JSON.` : err instanceof Error ? err.message : String(err));
    } finally {
      if (input) input.value = '';
    }
  }

  protected async resetProgress(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Reset all progress?',
      message: 'Deletes every attempt, answer statistic, spaced-repetition card, bookmark and note in this browser. Back up first if you might want it back.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (ok) {
      this.progress.resetAll();
      this.failed.set(false);
      this.message.set('All progress was deleted.');
    }
  }
}
