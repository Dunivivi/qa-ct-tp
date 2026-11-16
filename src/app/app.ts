import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { BankStore } from './core/bank/bank.store';
import { ProgressStore } from './core/progress/progress.store';
import { SessionStore } from './core/session/session.store';
import { SettingsStore } from './core/settings/settings.store';
import { SEARCH_HINT } from './core/ui/shortcuts';
import { CommandPalette } from './layout/command-palette';
import { ConfirmHost } from './layout/confirm-host';
import { OwlLogo } from './layout/owl-logo';
import { SettingsDrawer } from './layout/settings-drawer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommandPalette, ConfirmHost, OwlLogo, SettingsDrawer],
  templateUrl: './app.html',
})
export class App {
  private readonly session = inject(SessionStore);
  private readonly bank = inject(BankStore);
  private readonly progress = inject(ProgressStore);
  // Instantiated here so the saved theme is applied before any page renders.
  private readonly settings = inject(SettingsStore);

  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: '' },
  );
  /** The pill is a shortcut back to the test, so it's noise while already on it. */
  protected readonly showResume = computed(() => this.session.session() !== null && !this.url().startsWith('/test'));
  protected readonly resumeLabel = computed(() => {
    const s = this.session.session();
    return s ? `${s.config.label} · ${s.current + 1}/${s.items.length}` : '';
  });
  protected readonly total = computed(() => this.bank.questions().length);
  /** Spaced-repetition cards due now; re-evaluated whenever reviews change or the page navigates. */
  protected readonly dueCount = computed(() => {
    this.url();
    const now = Date.now();
    const byId = this.bank.byId();
    return Object.entries(this.progress.srs()).filter(([id, c]) => c.due <= now && byId.has(id)).length;
  });
  protected readonly searchHint = SEARCH_HINT;
  protected readonly navLinks = [
    { path: '/', label: 'Library', exact: true },
    { path: '/learn', label: 'Learn', exact: false },
    { path: '/browse', label: 'Browse', exact: false },
    { path: '/history', label: 'History', exact: false },
    { path: '/import', label: 'Import', exact: false },
  ];
}
