import { Component, ElementRef, computed, effect, inject, input, model, signal, viewChild } from '@angular/core';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

let nextId = 0;

/**
 * Custom dropdown following the WAI-ARIA select-only combobox pattern:
 * ↑/↓/Home/End move, Enter/Space pick, Esc closes, typing a letter jumps, outside click closes.
 */
@Component({
  selector: 'ui-select',
  host: { class: 'relative block', '(document:pointerdown)': 'onOutside($event)' },
  template: `
    @if (label()) {
      <span [id]="labelId" class="mb-1 block text-sm text-subtle">{{ label() }}</span>
    }
    <button #trigger type="button" role="combobox" [id]="triggerId"
      [attr.aria-labelledby]="label() ? labelId + ' ' + triggerId : null" [attr.aria-label]="label() ? null : ariaLabel()"
      aria-haspopup="listbox" [attr.aria-expanded]="open()" [attr.aria-controls]="listId" [attr.aria-activedescendant]="activeDescendant()"
      class="flex min-h-10 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-left text-sm text-ink hover:border-brand-500"
      (click)="toggle()" (keydown)="onKey($event)">
      <span class="min-w-0 flex-1 truncate">{{ selectedLabel() }}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true" [class]="chevronClass()" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
    @if (open()) {
      <ul [id]="listId" role="listbox" [attr.aria-labelledby]="label() ? labelId : null" tabindex="-1"
        class="absolute right-0 left-0 z-40 mt-1 max-h-72 min-w-full list-none overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
        @for (row of rows(); track row.value) {
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- activedescendant listbox: focus stays on the trigger, which handles the keys -->
          <li role="option" [id]="row.id" [attr.aria-selected]="row.selected" [class]="row.classes"
            (click)="pick(row.value)" (mousemove)="active.set(row.index)">
            <span class="flex-1">{{ row.label }}</span>
            @if (row.hint) {
              <span class="text-xs text-subtle">{{ row.hint }}</span>
            }
            @if (row.selected) {
              <svg viewBox="0 0 16 16" aria-hidden="true" class="size-4 text-brand-600" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class Select {
  readonly options = input.required<readonly SelectOption[]>();
  readonly value = model<string>('');
  readonly label = input('');
  /** Accessible name when there is no visible label. */
  readonly ariaLabel = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly uid = nextId++;
  protected readonly labelId = `ui-select-label-${this.uid}`;
  protected readonly triggerId = `ui-select-${this.uid}`;
  protected readonly listId = `ui-select-list-${this.uid}`;

  protected readonly open = signal(false);
  protected readonly active = signal(0);

  constructor() {
    // Keeping the highlighted option visible is a DOM scroll, not state.
    effect(() => {
      if (!this.open()) return;
      const id = this.activeDescendant();
      if (id) queueMicrotask(() => this.host.nativeElement.querySelector(`#${id}`)?.scrollIntoView?.({ block: 'nearest' }));
    });
  }

  private readonly selectedIndex = computed(() => Math.max(0, this.options().findIndex((o) => o.value === this.value())));
  protected readonly selectedLabel = computed(() => this.options()[this.selectedIndex()]?.label ?? '');
  protected readonly chevronClass = computed(() => `size-4 shrink-0 text-subtle transition-transform ${this.open() ? 'rotate-180' : ''}`);
  protected readonly rows = computed(() =>
    this.options().map((o, index) => {
      const selected = o.value === this.value();
      const isActive = index === this.active();
      return {
        ...o,
        index,
        selected,
        id: `${this.listId}-${index}`,
        classes: `flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-brand-50 text-brand-600' : 'text-ink'} ${selected ? 'font-semibold' : ''}`,
      };
    }),
  );
  protected readonly activeDescendant = computed(() => (this.open() ? `${this.listId}-${this.active()}` : null));

  protected toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  private show(): void {
    this.active.set(this.selectedIndex());
    this.open.set(true);
  }

  private close(): void {
    this.open.set(false);
  }

  protected pick(value: string): void {
    this.value.set(value);
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.options().length;
    if (!n) return;
    const move = (i: number) => this.active.set(Math.min(n - 1, Math.max(0, i)));
    if (!this.open()) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        this.show();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': move(this.active() + 1); break;
      case 'ArrowUp': move(this.active() - 1); break;
      case 'Home': move(0); break;
      case 'End': move(n - 1); break;
      case 'Enter':
      case ' ': {
        const o = this.options()[this.active()];
        if (o) this.pick(o.value);
        break;
      }
      case 'Escape': this.close(); break;
      case 'Tab': this.close(); return;
      default: {
        if (e.key.length !== 1) return;
        // Type-ahead: jump to the next option starting with the typed letter.
        const ch = e.key.toLowerCase();
        const opts = this.options();
        for (let k = 1; k <= n; k++) {
          const i = (this.active() + k) % n;
          if (opts[i]?.label.toLowerCase().startsWith(ch)) {
            move(i);
            break;
          }
        }
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }

  protected onOutside(e: PointerEvent): void {
    if (this.open() && e.target instanceof Node && !this.host.nativeElement.contains(e.target)) this.close();
  }
}
