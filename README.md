# CT-PT Practice

Personal practice site for the ISTQB Certified Tester – Performance Testing (CT-PT) exam.
Angular 22 (zoneless, signals), Tailwind 4, Vitest. No backend: progress lives in the browser.

## Run locally

```bash
nvm use                 # Node 22 (.nvmrc) — Angular 22 does not support Node 23
npx -y npm@11 install   # npm 10.9.2 has an arborist crash on this machine
npm run sync-data       # copies ../ISTQB performance testing/*.json into public/data
npm start               # http://localhost:4200
```

`sync-data` takes the question folder as an optional argument:
`npm run sync-data -- "/path/to/ISTQB performance testing"`.

## Where the questions come from

| Folder | Committed | Deployed | Contents |
|---|---|---|---|
| `public/data/official/` | yes | yes | ISTQB Sample Exam A + ASTQB 2019 (reuse allowed, non-commercial, with credit) |
| `public/data/sources/` | **no** (gitignored) | **no** (excluded from production builds) | the full verified bank, for local dev |
| Import page | — | — | any JSON file, stored in this browser's IndexedDB only |

The scraped practice banks are third-party content, so they are never committed or deployed.
On the deployed site, load them through **Import**.

## Features

- **Library**: sources (official / verified) with **All providers** pooling, module cards with progress.
- **Test builder**: providers × modules, count, time, presets (real exam 40·90 weighted 6/4/7/20/3,
  quick 10, practice 20, **survival**, **blitz**), exclude flagged, prefer unseen / wrong, shuffle.
  Remembers your last settings.
- **Runner**: exam (answers at the end) or practice ("why this is correct" after each), navigator,
  flags, cross-out, keyboard, countdown + auto-submit, pause, full screen, review screen, resume.
  Survival ends at the first miss (best streak kept); blitz = 15 s per question, auto-advance.
- **Learn**: spaced repetition (10 min → 1, 3, 7, 16, 35 days), multiple-choice or flashcards,
  due-count badge in the header.
- **Results**: score, pass/fail (or streak), by module and source, review with explanations, retake wrong.
- **Browse**: filters, search, reveal, bookmarks, notes, hide.
- **History**: attempts, readiness, accuracy by module, best survival/blitz, CSV export,
  **progress backup/restore (JSON)**, reset.
- **Shell**: ⌘K / Ctrl+K command palette, `?` shortcuts sheet, light/dark/system theme,
  large text, confirm dialogs, skip link. Custom dropdown/checkbox components (`shared/ui`).

## Deploy (Netlify)

Connect the repo; `netlify.toml` sets the build command, publish folder and SPA redirect.

## Scripts

`npm test` (Vitest) · `npm run lint` (ESLint + folder boundaries) · `npm run build` · `npm run sync-data`
