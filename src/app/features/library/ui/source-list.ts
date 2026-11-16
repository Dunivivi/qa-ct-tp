import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ALL_SOURCES, SourceSummary } from '../model/library.model';

interface Row {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly hint: string;
  readonly classes: string;
  readonly dot: string;
}

const ROW = 'flex items-center gap-2.5 rounded-xl border p-3 text-sm no-underline';
const ACTIVE = `${ROW} border-brand-500 bg-brand-50 font-semibold text-ink`;
const IDLE = `${ROW} border-line bg-surface text-ink hover:border-line-strong`;

@Component({
  selector: 'app-source-list',
  imports: [RouterLink],
  template: `
    <nav class="flex flex-col gap-2" aria-label="Sources">
      <h2 class="m-0 text-xs font-semibold tracking-wider text-subtle uppercase">Sources</h2>
      @for (group of groups(); track group.title) {
        @if (group.title) {
          <h3 class="m-0 mt-2 text-xs font-medium text-subtle">{{ group.title }}</h3>
        }
        @for (row of group.rows; track row.id) {
          <a [routerLink]="[]" [queryParams]="{ source: row.id }" [class]="row.classes" [attr.aria-current]="row.id === selected() ? 'page' : null">
            <span [class]="row.dot" aria-hidden="true"></span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate">{{ row.label }}</span>
              @if (row.hint) {
                <span class="text-xs font-normal text-subtle">{{ row.hint }}</span>
              }
            </span>
            <span class="text-subtle">{{ row.count }}</span>
          </a>
        }
      }
    </nav>
  `,
})
export class SourceList {
  readonly sources = input.required<readonly SourceSummary[]>();
  readonly selected = input.required<string>();

  protected readonly groups = computed(() => {
    const sel = this.selected();
    const toRow = (s: SourceSummary): Row => ({
      id: s.id,
      label: s.label,
      count: s.count,
      hint: [s.corrected ? `${s.corrected} corrected` : '', s.flagged ? `${s.flagged} flagged` : ''].filter(Boolean).join(' · '),
      classes: s.id === sel ? ACTIVE : IDLE,
      dot: `size-2.5 shrink-0 rounded-full ${s.kind === 'official' ? 'bg-brand-800' : 'bg-ok-500'}`,
    });
    const all: Row = {
      id: ALL_SOURCES,
      label: 'All providers',
      count: this.sources().reduce((n, s) => n + s.count, 0),
      hint: 'Every source, no duplicates',
      classes: sel === ALL_SOURCES ? ACTIVE : IDLE,
      dot: 'size-2.5 shrink-0 rounded-full bg-inverse',
    };
    return [
      { title: '', rows: [all] },
      { title: 'Official (board answers)', rows: this.sources().filter((s) => s.kind === 'official').map(toRow) },
      { title: 'Verified practice banks', rows: this.sources().filter((s) => s.kind !== 'official').map(toRow) },
    ].filter((g) => g.rows.length > 0);
  });
}
