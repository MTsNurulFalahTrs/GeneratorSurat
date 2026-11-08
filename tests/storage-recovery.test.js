import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../js/storage.js', import.meta.url), 'utf8');

function createStorageHarness({ initial = {}, failRecoveryWrites = false } = {}) {
  const values = new Map(Object.entries(initial));
  const eventListeners = { document: {}, window: {} };
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (failRecoveryWrites && key === 'surat-generator-recovery-v1') {
        throw new Error('QuotaExceededError');
      }
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
  };
  const context = vm.createContext({
    localStorage,
    document: {
      hidden: false,
      addEventListener(name, callback) { eventListeners.document[name] = callback; },
    },
    window: {
      addEventListener(name, callback) { eventListeners.window[name] = callback; },
    },
    Utils: { getRemainingTime: expiresAt => Math.max(0, expiresAt - Date.now()) },
    setInterval: () => 1,
    clearInterval: () => {},
    console: { info() {}, warn() {} },
    Date,
  });

  vm.runInContext(source, context, { filename: 'storage.js' });
  return {
    Storage: vm.runInContext('Storage', context),
    values,
    eventListeners,
  };
}

describe('Storage expiry recovery', () => {
  it('archives an expired quick-save instead of deleting it', () => {
    const savedAt = Date.now() - (2 * 60 * 60 * 1000) - 5_000;
    const data = { activeTemplate: 'dpu', forms: { dpu: { nomor: '123' } } };
    const { Storage, values } = createStorageHarness({
      initial: {
        'surat-generator-v1': JSON.stringify({
          version: '1.0',
          lastSavedAt: savedAt,
          expiresAt: savedAt + (2 * 60 * 60 * 1000),
          data,
        }),
      },
    });
    const onExpired = vi.fn();

    const result = Storage.init({ onExpired });
    const recovery = Storage.getRecovery();

    expect(result.expired).toBe(true);
    expect(result.recoveryAvailable).toBe(true);
    expect(onExpired).toHaveBeenCalledOnce();
    expect(recovery.data.forms.dpu.nomor).toBe('123');
    expect(recovery.source).toBe('archive');
    expect(values.has('surat-generator-v1')).toBe(false);
  });

  it('keeps the expired original record when quota prevents archiving', () => {
    const savedAt = Date.now() - (2 * 60 * 60 * 1000) - 5_000;
    const raw = JSON.stringify({
      version: '1.0',
      lastSavedAt: savedAt,
      expiresAt: savedAt + (2 * 60 * 60 * 1000),
      data: { activeTemplate: 'dpu' },
    });
    const { Storage, values } = createStorageHarness({
      initial: { 'surat-generator-v1': raw },
      failRecoveryWrites: true,
    });

    const result = Storage.init();
    const recovery = Storage.getRecovery();

    expect(result.recoveryAvailable).toBe(true);
    expect(recovery.source).toBe('expired-cache');
    expect(values.get('surat-generator-v1')).toBe(raw);

    const saveResult = Storage.save({ activeTemplate: 'siswa-baru' });
    expect(saveResult.success).toBe(false);
    expect(values.get('surat-generator-v1')).toBe(raw);
  });

  it('restores a new TTL after explicit recovery and can remove the recovery snapshot', () => {
    const savedAt = Date.now() - (2 * 60 * 60 * 1000) - 5_000;
    const { Storage } = createStorageHarness({
      initial: {
        'surat-generator-v1': JSON.stringify({
          version: '1.0',
          lastSavedAt: savedAt,
          expiresAt: savedAt + (2 * 60 * 60 * 1000),
          data: { activeTemplate: 'dpu' },
        }),
      },
    });

    Storage.init();
    const recovery = Storage.getRecovery();
    const saveResult = Storage.save(recovery.data, { replaceExpired: true });

    expect(saveResult.success).toBe(true);
    expect(Storage.load().activeTemplate).toBe('dpu');
    expect(Storage.getMeta().expiresAt).toBeGreaterThan(Date.now());
    expect(Storage.removeRecovery(recovery.id)).toBe(true);
    expect(Storage.getRecovery()).toBeNull();
  });

  it('removes an old recovery snapshot after a newer explicit quick-save', () => {
    const savedAt = Date.now() - (2 * 60 * 60 * 1000) - 5_000;
    const { Storage, values } = createStorageHarness({
      initial: {
        'surat-generator-v1': JSON.stringify({
          version: '1.0',
          lastSavedAt: savedAt,
          expiresAt: savedAt + (2 * 60 * 60 * 1000),
          data: { activeTemplate: 'dpu' },
        }),
      },
    });

    Storage.init();
    expect(Storage.getRecovery()).not.toBeNull();
    const result = Storage.save({ activeTemplate: 'siswa-baru' });
    expect(result.success).toBe(true);
    expect(Storage.clearRecovery()).toBe(true);
    expect(Storage.getRecovery()).toBeNull();
    expect(values.has('surat-generator-recovery-v1')).toBe(false);
    expect(Storage.load().activeTemplate).toBe('siswa-baru');
  });

  it('clears quick-save and recovery snapshot on explicit reset', () => {
    const { Storage, values } = createStorageHarness();
    Storage.init();
    Storage.save({ activeTemplate: 'dpu' });
    const recoveryKey = 'surat-generator-recovery-v1';
    values.set(recoveryKey, JSON.stringify({
      version: '1.0',
      items: [{
        id: 'recovery-1',
        lastSavedAt: 1,
        archivedAt: 1,
        recoveryExpiresAt: Date.now() + 1_000,
        data: { activeTemplate: 'dpu' },
      }],
    }));

    Storage.clear();
    expect(values.has('surat-generator-v1')).toBe(false);
    expect(values.has(recoveryKey)).toBe(false);
  });
});
