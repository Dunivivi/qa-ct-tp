import { Injectable, signal } from '@angular/core';

export type SettingsTab = 'look' | 'study' | 'data' | 'keys';

/** Opens the settings drawer (rendered once by the shell) from anywhere, on a given tab. */
@Injectable({ providedIn: 'root' })
export class SettingsPanelService {
  readonly open = signal(false);
  readonly tab = signal<SettingsTab>('look');

  show(tab?: SettingsTab): void {
    if (tab) this.tab.set(tab);
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }
}
