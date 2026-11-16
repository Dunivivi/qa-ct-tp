import { DEFAULT_SETTINGS, PRESETS, matchingPreset, onPrimary, parseSettings } from './settings.store';

describe('parseSettings', () => {
  it('keeps known values', () => {
    const s = {
      preset: 'custom', theme: 'dark', primary: '#e8590c', skin: 'bordered', font: 'system',
      fontScale: 'lg', radius: 'sm', width: 'boxed', motion: 'reduced', blitzSeconds: 20, learnNewCards: 5,
    };
    expect(parseSettings(s)).toEqual(s);
  });

  it('falls back to defaults for missing, unknown or malformed input', () => {
    expect(parseSettings({ theme: 'purple', primary: 'red', skin: 'x', fontScale: 3, blitzSeconds: 7 })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS);
  });

  it('migrates the old normal/large text size', () => {
    expect(parseSettings({ textSize: 'large' }).fontScale).toBe('lg');
    expect(parseSettings({ textSize: 'normal' }).fontScale).toBe('md');
  });
});

describe('look helpers', () => {
  it('picks readable text for the primary colour', () => {
    expect(onPrimary('#3b5bdb')).toBe('#ffffff');
    expect(onPrimary('#e8590c')).toBe('#16181d');
  });

  it('recognises a preset and reports custom once a look field changes', () => {
    const modern = { ...DEFAULT_SETTINGS, ...PRESETS.modern.look };
    expect(matchingPreset(modern)).toBe('modern');
    expect(matchingPreset({ ...modern, primary: '#2b8a3e' })).toBe('custom');
  });
});
