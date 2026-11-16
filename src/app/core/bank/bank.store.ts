import { Injectable, computed, resource, signal } from '@angular/core';
import { normalizeSourceFile } from './normalize';
import { importDb } from './import-db';
import { Question, QuestionSource, SourceOrigin } from './question.model';

interface Manifest {
  readonly files: readonly string[];
}

async function fetchJson(url: string): Promise<unknown | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  // `ng serve` answers unknown paths with index.html, so a missing manifest arrives as HTML with status 200.
  if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
  return res.json() as Promise<unknown>;
}

async function loadFolder(base: string, origin: SourceOrigin): Promise<QuestionSource[]> {
  const manifest = (await fetchJson(`${base}index.json`)) as Manifest | null;
  if (!manifest || !Array.isArray(manifest.files)) return [];
  const sources = await Promise.all(
    manifest.files.map(async (file) => {
      const raw = await fetchJson(base + file);
      return raw === null ? null : normalizeSourceFile(file, raw, base, origin);
    }),
  );
  return sources.filter((s): s is QuestionSource => s !== null);
}

/**
 * Merges sources by id with increasing precedence: bundled official samples, then the local
 * (gitignored) bank, then files the user imported in this browser.
 */
async function loadAll(): Promise<QuestionSource[]> {
  const [bundled, local, imported] = await Promise.all([
    loadFolder('data/official/', 'bundled'),
    loadFolder('data/sources/', 'local'),
    importDb.all().then((items) => items.map((i) => normalizeSourceFile(i.fileName, i.json, '', 'imported'))),
  ]);
  const byId = new Map<string, QuestionSource>();
  for (const s of [...bundled, ...local, ...imported]) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

@Injectable({ providedIn: 'root' })
export class BankStore {
  private readonly reloadToken = signal(0);
  private readonly bank = resource({ params: () => this.reloadToken(), loader: () => loadAll() });

  readonly isLoading = this.bank.isLoading;
  readonly error = computed(() => {
    const e = this.bank.error();
    return e ? (e instanceof Error ? e.message : String(e)) : null;
  });
  readonly sources = computed<readonly QuestionSource[]>(() => (this.bank.hasValue() ? this.bank.value() : []));
  readonly questions = computed<readonly Question[]>(() => this.sources().flatMap((s) => s.questions));
  readonly byId = computed(() => new Map(this.questions().map((q) => [q.id, q])));
  readonly sourceById = computed(() => new Map(this.sources().map((s) => [s.id, s])));

  reload(): void {
    this.reloadToken.update((n) => n + 1);
  }

  /** Validates every file before storing any, so one bad file doesn't leave a half-import. */
  async importFiles(files: readonly File[]): Promise<string[]> {
    const parsed = await Promise.all(
      files.map(async (f) => {
        let json: unknown;
        try {
          json = JSON.parse(await f.text());
        } catch {
          throw new Error(`${f.name} is not valid JSON.`);
        }
        normalizeSourceFile(f.name, json, '', 'imported');
        return { fileName: f.name, json, importedAt: Date.now() };
      }),
    );
    for (const item of parsed) await importDb.put(item);
    this.reload();
    return parsed.map((p) => p.fileName);
  }

  async removeImport(fileName: string): Promise<void> {
    await importDb.remove(fileName);
    this.reload();
  }
}
