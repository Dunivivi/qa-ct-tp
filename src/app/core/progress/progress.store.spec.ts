import { TestBed } from '@angular/core/testing';
import { ProgressStore } from './progress.store';

describe('ProgressStore backup', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips progress and attempts through a backup', () => {
    const a = TestBed.runInInjectionContext(() => new ProgressStore());
    a.review('mxn#1', true);
    a.toggleBookmark('mxn#2');
    a.setNote('mxn#2', 'hook');
    const backup = JSON.parse(JSON.stringify(a.exportBackup())) as unknown;

    const b = TestBed.runInInjectionContext(() => new ProgressStore());
    b.resetAll();
    const r = b.restoreBackup(backup);
    expect(r.answered).toBe(1);
    expect(b.stats()['mxn#1']?.right).toBe(1);
    expect(b.srs()['mxn#1']?.box).toBe(1);
    expect(b.bookmarks().has('mxn#2')).toBe(true);
    expect(b.notes()['mxn#2']).toBe('hook');
  });

  it('rejects files that are not backups and leaves data untouched', () => {
    const s = TestBed.runInInjectionContext(() => new ProgressStore());
    s.toggleBookmark('keep');
    expect(() => s.restoreBackup({ app: 'other' })).toThrow();
    expect(() => s.restoreBackup({ app: 'ctpt-practice', version: 1, progress: {}, attempts: [] })).toThrow();
    expect(s.bookmarks().has('keep')).toBe(true);
  });
});
