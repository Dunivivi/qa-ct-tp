import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BankStore } from '../../../core/bank/bank.store';
import { CHAPTERS, PASS_PERCENT } from '../../../core/bank/question.model';
import { ProgressStore } from '../../../core/progress/progress.store';
import { SettingsPanelService } from '../../../core/ui/settings-panel.service';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { download } from '../../../shared/util/download';

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@Component({
  selector: 'app-history-page',
  imports: [RouterLink, ButtonDirective],
  template: `
    <div class="mx-auto flex max-w-5xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-8">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="m-0 flex-1 font-display text-3xl font-semibold">History & progress</h1>
        <button uiBtn size="sm" type="button" [disabled]="!rows().length" (click)="exportCsv()">Export CSV</button>
        <button uiBtn size="sm" type="button" (click)="settingsPanel.show('data')">Backup &amp; reset</button>
      </div>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
        <section class="rounded-xl border border-line bg-surface p-5">
          <h2 class="mt-0 text-sm font-medium text-subtle">Readiness</h2>
          <p class="m-0 font-display text-3xl font-semibold">{{ readiness() }}</p>
          <p class="mb-0 text-sm text-muted">{{ readinessHint() }}</p>
        </section>
        <section class="rounded-xl border border-line bg-surface p-5">
          <h2 class="mt-0 text-sm font-medium text-subtle">Questions seen</h2>
          <p class="m-0 font-display text-3xl font-semibold">{{ seen() }} / {{ total() }}</p>
          <p class="mb-0 text-sm text-muted">{{ seenPct() }}% of the bank</p>
        </section>
        <section class="rounded-xl border border-line bg-surface p-5">
          <h2 class="mt-0 text-sm font-medium text-subtle">Best survival streak</h2>
          <p class="m-0 font-display text-3xl font-semibold">{{ bestSurvival() }}</p>
          <p class="mb-0 text-sm text-muted">correct in a row</p>
        </section>
        <section class="rounded-xl border border-line bg-surface p-5">
          <h2 class="mt-0 text-sm font-medium text-subtle">Best blitz</h2>
          <p class="m-0 font-display text-3xl font-semibold">{{ bestBlitz() }}</p>
          <p class="mb-0 text-sm text-muted">score</p>
        </section>
        <section class="rounded-xl border border-line bg-surface p-5">
          <h2 class="mt-0 text-sm font-medium text-subtle">Tests taken</h2>
          <p class="m-0 font-display text-3xl font-semibold">{{ rows().length }}</p>
          <p class="mb-0 text-sm text-muted">{{ passedCount() }} passed</p>
        </section>
      </div>

      <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="mods">
        <h2 id="mods" class="mt-0 font-display text-lg font-semibold">Accuracy by module (all answers)</h2>
        @for (m of modules(); track m.id) {
          <div class="mb-3">
            <div class="flex justify-between text-sm"><span>{{ m.id }} · {{ m.name }}</span><span>{{ m.label }}</span></div>
            <div class="mt-1 h-2 rounded-full bg-inset"><div [class]="m.barClass" [style.width.%]="m.pct"></div></div>
          </div>
        }
        <a uiBtn size="sm" routerLink="/browse" [queryParams]="{ status: 'wrong' }">Review questions I got wrong</a>
      </section>

      <section class="min-w-0" aria-labelledby="att">
        <h2 id="att" class="font-display text-lg font-semibold">Attempts</h2>
        @if (rows().length) {
          <div class="relative max-w-full overflow-x-auto rounded-xl border border-line bg-surface">
            <table class="w-full min-w-[640px] border-collapse text-sm">
              <thead class="bg-inset text-left">
                <tr><th class="p-3">When</th><th class="p-3">Test</th><th class="p-3">Mode</th><th class="p-3 text-right">Score</th><th class="p-3">Result</th><th class="p-3"><span class="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr class="border-t border-line">
                    <td class="p-3 whitespace-nowrap">{{ r.when }}</td>
                    <td class="p-3">{{ r.label }}</td>
                    <td class="p-3 capitalize">{{ r.kind }}</td>
                    <td class="p-3 text-right">{{ r.right }}/{{ r.total }} · {{ r.percent }}%</td>
                    <td class="p-3"><span [class]="r.badgeClass">{{ r.result }}</span></td>
                    <td class="flex justify-end gap-1 p-3">
                      <a uiBtn size="sm" [routerLink]="['/results', r.id]">Open</a>
                      <button uiBtn="ghost" size="sm" type="button" [attr.aria-label]="'Delete attempt ' + r.label" (click)="progress.removeAttempt(r.id)">Delete</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-10 text-center">
            <p class="m-0 text-muted">No tests yet.</p>
            <a uiBtn="primary" routerLink="/">Start your first test</a>
          </div>
        }
      </section>
    </div>
  `,
})
export class HistoryPage {
  protected readonly progress = inject(ProgressStore);
  private readonly bank = inject(BankStore);
  protected readonly settingsPanel = inject(SettingsPanelService);

  protected readonly rows = computed(() =>
    this.progress.attempts().map((a) => ({
      ...a,
      when: dateFmt.format(a.finishedAt),
      kind: a.variant && a.variant !== 'standard' ? a.variant : a.mode,
      result: a.passed ? 'Pass' : 'Fail',
      badgeClass: `rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.passed ? 'bg-ok-50 text-ok-700' : 'bg-bad-50 text-bad-700'}`,
    })),
  );
  protected readonly bestSurvival = computed(() =>
    Math.max(0, ...this.progress.attempts().filter((a) => a.variant === 'survival').map((a) => a.right)),
  );
  protected readonly bestBlitz = computed(() => {
    const b = this.progress.attempts().filter((a) => a.variant === 'blitz');
    if (!b.length) return '—';
    const top = [...b].sort((x, y) => y.percent - x.percent)[0];
    return top ? `${top.right}/${top.total}` : '—';
  });
  protected readonly passedCount = computed(() => this.rows().filter((r) => r.passed).length);
  protected readonly total = computed(() => this.bank.questions().length);
  protected readonly seen = computed(() => {
    const ids = this.bank.byId();
    return Object.keys(this.progress.stats()).filter((id) => ids.has(id)).length;
  });
  protected readonly seenPct = computed(() => (this.total() ? Math.round((this.seen() / this.total()) * 100) : 0));

  /** Mean of the last three exam-mode scores: practice runs with instant feedback overstate readiness. */
  private readonly recentExams = computed(() => this.progress.attempts().filter((a) => a.mode === 'exam' && a.total >= 20).slice(0, 3));
  protected readonly readiness = computed(() => {
    const ex = this.recentExams();
    return ex.length ? `${Math.round(ex.reduce((s, a) => s + a.percent, 0) / ex.length)}%` : '—';
  });
  protected readonly readinessHint = computed(() => {
    const ex = this.recentExams();
    if (!ex.length) return 'Take an exam-mode test of 20+ questions to estimate it.';
    const avg = ex.reduce((s, a) => s + a.percent, 0) / ex.length;
    return `Average of your last ${ex.length} exam${ex.length > 1 ? 's' : ''} · ${avg >= PASS_PERCENT + 10 ? 'ready' : avg >= PASS_PERCENT ? 'borderline' : 'not ready yet'}`;
  });

  protected readonly modules = computed(() => {
    const stats = this.progress.stats();
    const byId = this.bank.byId();
    return CHAPTERS.map((c) => {
      let right = 0;
      let answered = 0;
      for (const [qid, s] of Object.entries(stats)) {
        if (byId.get(qid)?.chapter === c.id) {
          right += s.right;
          answered += s.seen;
        }
      }
      const pct = answered ? Math.round((right / answered) * 100) : 0;
      return {
        id: c.id,
        name: c.name,
        pct,
        label: answered ? `${pct}% of ${answered} answers` : 'No answers yet',
        barClass: `h-2 rounded-full ${pct >= PASS_PERCENT ? 'bg-ok-500' : 'bg-warn-700'}`,
      };
    });
  });

  protected exportCsv(): void {
    const header = ['finished', 'test', 'mode', 'right', 'total', 'percent', 'passed', 'minutes'];
    const lines = this.progress.attempts().map((a) =>
      [new Date(a.finishedAt).toISOString(), a.label, a.mode, a.right, a.total, a.percent, a.passed ? 'yes' : 'no', Math.round((a.finishedAt - a.startedAt) / 60000)]
        .map(csvCell)
        .join(','),
    );
    download('ctpt-attempts.csv', [header.join(','), ...lines].join('\n'), 'text/csv');
  }
}
