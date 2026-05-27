// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { supabaseBackupServiceV2 } from '../supabaseBackupServiceV2';

beforeEach(() => {
  localStorage.clear();
});

describe('supabaseBackupServiceV2 — last backup tracking', () => {
  it('getLastBackupAt devuelve null si nunca se hizo', () => {
    expect(supabaseBackupServiceV2.getLastBackupAt()).toBeNull();
  });

  it('markBackupDone persiste la marca', () => {
    supabaseBackupServiceV2.markBackupDone();
    const got = supabaseBackupServiceV2.getLastBackupAt();
    expect(got).toBeTruthy();
    // Es un ISO timestamp parseable
    expect(Number.isFinite(new Date(got!).getTime())).toBe(true);
  });

  it('isBackupStale devuelve true si nunca se hizo', () => {
    expect(supabaseBackupServiceV2.isBackupStale()).toBe(true);
  });

  it('isBackupStale devuelve false inmediatamente después de markBackupDone', () => {
    supabaseBackupServiceV2.markBackupDone();
    expect(supabaseBackupServiceV2.isBackupStale()).toBe(false);
  });

  it('isBackupStale devuelve true si la marca es vieja (8 días)', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(supabaseBackupServiceV2.LAST_BACKUP_KEY, eightDaysAgo);
    expect(supabaseBackupServiceV2.isBackupStale()).toBe(true);
  });

  it('isBackupStale devuelve false si la marca es de hace 6 días', () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(supabaseBackupServiceV2.LAST_BACKUP_KEY, sixDaysAgo);
    expect(supabaseBackupServiceV2.isBackupStale()).toBe(false);
  });

  it('isBackupStale devuelve true si la marca está corrupta', () => {
    localStorage.setItem(supabaseBackupServiceV2.LAST_BACKUP_KEY, 'NOT-A-DATE');
    expect(supabaseBackupServiceV2.isBackupStale()).toBe(true);
  });
});
