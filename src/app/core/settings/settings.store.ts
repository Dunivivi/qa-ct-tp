import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export const SKINS = ['default', 'bordered', 'semi-dark'] as const;
export const FONTS = ['inter', 'space-grotesk', 'system'] as const;
export const SCALES = ['sm', 'md', 'lg'] as const;
export const WIDTHS = ['full', 'boxed'] as const;
export const MOTIONS = ['on', 'reduced'] as const;
export const BLITZ_SECONDS = [10, 15, 20, 30] as const;
export const LEARN_NEW_CARDS = [0, 5, 10, 20] as const;

/** Swatches chosen so the darker text shade derived from each stays readable on white. */
export const PRIMARY_SWATCHES = [
  { name: 'Indigo', hex: '#3b5bdb' },
  { name: 'Violet', hex: '#6741d9' },
  { name: 'Teal', hex: '#0c8599' },
  { name: 'Green', hex: '#2b8a3e' },
  { name: 'Orange', hex: '#e8590c' },
  { name: 'Rose', hex: '#c2255c' },
  { name: 'Blue', hex: '#1971c2' },
  { name: 'Slate', hex: '#495057' },
] as const;

export type ThemePref = (typeof THEME_MODES)[number];
export type Skin = (typeof SKINS)[number];
export type FontFamily = (typeof FONTS)[number];
export type Scale = (typeof SCALES)[number];
export type ContentWidth = (typeof WIDTHS)[number];
export type Motion = (typeof MOTIONS)[number];
export type PresetId = 'classic' | 'modern' | 'midnight';

export interface Settings {
  readonly preset: PresetId | 'custom';
  readonly theme: ThemePref;
  readonly primary: string;
  readonly skin: Skin;
  readonly font: FontFamily;
  readonly fontScale: Scale;
  readonly radius: Scale;
  readonly width: ContentWidth;
  readonly motion: Motion;
  /** Seconds per question in blitz runs. */
  readonly blitzSeconds: (typeof BLITZ_SECONDS)[number];
  /** New spaced-repetition cards offered per Learn session. */
  readonly learnNewCards: (typeof LEARN_NEW_CARDS)[number];
}

type PresetLook = Pick<Settings, 'theme' | 'primary' | 'skin' | 'font' | 'radius'>;

export const PRESETS: Readonly<Record<PresetId, { label: string; hint: string; look: PresetLook }>> = {
  classic: { label: 'Classic', hint: 'Indigo · Inter', look: { theme: 'system', primary: '#3b5bdb', skin: 'default', font: 'inter', radius: 'md' } },
  modern: { label: 'Modern', hint: 'Violet · bordered · round', look: { theme: 'light', primary: '#6741d9', skin: 'bordered', font: 'space-grotesk', radius: 'lg' } },
  midnight: { label: 'Midnight', hint: 'Teal · dark', look: { theme: 'dark', primary: '#0c8599', skin: 'semi-dark', font: 'inter', radius: 'sm' } },
};

const KEY = 'ctpt.settings.v1';
export const DEFAULT_SETTINGS: Settings = {
  preset: 'classic',
  ...PRESETS.classic.look,
  fontScale: 'md',
  width: 'full',
  motion: 'on',
  blitzSeconds: 15,
  learnNewCards: 10,
};

function oneOf<T>(allowed: readonly T[], v: unknown, fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** Accepts only known values so a hand-edited or stale entry can't break the UI. */
export function parseSettings(raw: unknown): Settings {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  // v1 stored text size as normal/large before the three-step scale existed.
  const legacyScale = r['textSize'] === 'large' ? 'lg' : r['textSize'] === 'normal' ? 'md' : undefined;
  return {
    preset: oneOf(['classic', 'modern', 'midnight', 'custom'] as const, r['preset'], d.preset),
    theme: oneOf(THEME_MODES, r['theme'], d.theme),
    primary: isHex(r['primary']) ? r['primary'].toLowerCase() : d.primary,
    skin: oneOf(SKINS, r['skin'], d.skin),
    font: oneOf(FONTS, r['font'], d.font),
    fontScale: oneOf(SCALES, r['fontScale'] ?? legacyScale, d.fontScale),
    radius: oneOf(SCALES, r['radius'], d.radius),
    width: oneOf(WIDTHS, r['width'], d.width),
    motion: oneOf(MOTIONS, r['motion'], d.motion),
    blitzSeconds: oneOf(BLITZ_SECONDS, r['blitzSeconds'], d.blitzSeconds),
    learnNewCards: oneOf(LEARN_NEW_CARDS, r['learnNewCards'], d.learnNewCards),
  };
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White text on the primary colour when it reaches 4.5:1, otherwise near-black. */
export function onPrimary(hex: string): string {
  return (1.05 / (luminance(hex) + 0.05)) >= 4.5 ? '#ffffff' : '#16181d';
}

/** The look fields that define a preset, compared to tell whether the user has customised it. */
export function matchingPreset(s: Settings): PresetId | 'custom' {
  const found = (Object.keys(PRESETS) as PresetId[]).find((id) => {
    const p = PRESETS[id].look;
    return p.theme === s.theme && p.primary === s.primary && p.skin === s.skin && p.font === s.font && p.radius === s.radius;
  });
  return found ?? 'custom';
}

function load(): Settings {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly doc = inject(DOCUMENT);
  private readonly media = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)') ?? null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly settings = signal<Settings>(load());
  readonly resolvedTheme = computed(() => {
    const t = this.settings().theme;
    return t === 'system' ? (this.systemDark() ? 'dark' : 'light') : t;
  });

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    // Applying the look to <html> (data attributes + the primary colour variable) and persisting
    // are DOM/storage side effects, not derived state.
    effect(() => {
      const s = this.settings();
      const root = this.doc.documentElement;
      const dark = this.resolvedTheme() === 'dark';
      Object.assign(root.dataset, { theme: this.resolvedTheme(), skin: s.skin, font: s.font, text: s.fontScale, radius: s.radius, width: s.width, motion: s.motion });
      root.style.setProperty('--primary', s.primary);
      // In dark mode the brand fill is lightened (see styles.css), so dark text always reads on it.
      root.style.setProperty('--color-on-brand', dark ? '#0f1115' : onPrimary(s.primary));
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* storage unavailable */
      }
    });
  }

  /** Changes settings; editing a look field turns the preset into "custom" unless it still matches one. */
  set(patch: Partial<Settings>): void {
    this.settings.update((s) => {
      const next = { ...s, ...patch };
      return { ...next, preset: matchingPreset(next) };
    });
  }

  applyPreset(id: PresetId): void {
    this.settings.update((s) => ({ ...s, ...PRESETS[id].look, preset: id }));
  }
}
