/** Single source for the shortcut sheet (palette `?`) and the Settings page. */
export const SHORTCUTS: readonly (readonly [keys: string, action: string])[] = [
  ['⌘K / Ctrl+K or /', 'Open search & commands'],
  ['?', 'Show keyboard shortcuts'],
  ['1–4 or A–D', 'Answer (test, learn)'],
  ['X then a letter', 'Cross out an option (test)'],
  ['← / →', 'Previous / next question'],
  ['F', 'Flag for review'],
  ['Enter', 'Check answer / next'],
  ['Space · 1 · 2', 'Flashcards: reveal · again · got it'],
  ['Esc', 'Close dialogs and menus'],
];

export const SEARCH_HINT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
