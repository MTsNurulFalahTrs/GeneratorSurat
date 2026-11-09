import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../js/data-io.js', import.meta.url), 'utf8');

function createHarness({ saveSuccess = true, confirm = true } = {}) {
  const events = [];
  const toasts = [];
  const state = {
    activeTemplate: 'dpu',
    serialized: { activeTemplate: 'dpu', forms: { dpu: { meta: { namaMadrasah: 'Impor' } } } },
    dirty: false,
  };
  const storageMeta = { lastSavedAt: 123, expiresAt: 456 };

  const State = {
    restore: vi.fn(data => {
      state.serialized = data;
      state.activeTemplate = data.activeTemplate ?? null;
      state.dirty = false;
      events.push('restore');
    }),
    serialize: vi.fn(() => state.serialized),
    getActiveTemplate: vi.fn(() => state.activeTemplate),
    markSaved: vi.fn(() => { state.dirty = false; events.push('markSaved'); }),
    markDirty: vi.fn(() => { state.dirty = true; events.push('markDirty'); }),
  };
  const Storage = {
    save: vi.fn(data => {
      events.push('save');
      return saveSuccess ? { success: true, ...storageMeta } : { success: false, reason: 'Kuota penuh' };
    }),
    clearRecovery: vi.fn(() => events.push('clearRecovery')),
    getMeta: vi.fn(() => storageMeta),
  };
  const UI = {
    confirm: vi.fn((title, message, onConfirm, onCancel) => confirm ? onConfirm() : onCancel()),
    toast: vi.fn((...args) => toasts.push(args)),
    updateStorageInfo: vi.fn(() => events.push('updateStorageInfo')),
    markStorageDirty: vi.fn(() => events.push('markStorageDirty')),
    switchTab: vi.fn(),
  };
  const TemplateRegistry = {
    renderTemplateList: vi.fn(),
    updateActiveCard: vi.fn(),
  };
  const FormRenderer = { render: vi.fn() };
  const Settings = { updateStorageStatus: vi.fn() };
  const Utils = { flushDebounces: vi.fn(() => events.push('flush')) };
  const document = { getElementById: vi.fn(() => ({})) };
  class FileReader {
    readAsText(file) {
      this.onload({ target: { result: file.content } });
    }
  }
  const context = {
    State, Storage, UI, TemplateRegistry, FormRenderer, Settings, Utils, document, FileReader,
    window: { App: { selectTemplate: vi.fn() } },
    console: { error: vi.fn(), warn: vi.fn() },
  };
  runInNewContext(source + '\n;globalThis.__DataIO = DataIO;', context, { filename: 'js/data-io.js' });

  return {
    dataIO: context.__DataIO, State, Storage, UI, FormRenderer, Settings, Utils,
    events, toasts, state,
    file: {
      name: 'cadangan.json',
      type: 'application/json',
      size: 200,
      content: JSON.stringify(state.serialized),
    },
  };
}

describe('GS-001: imported JSON persistence', () => {
  it('persists imported state, marks it saved, and clears old recovery only after successful save', async () => {
    const h = createHarness();
    expect(await h.dataIO.importData(h.file)).toBe(true);
    expect(h.events.indexOf('flush')).toBeLessThan(h.events.indexOf('restore'));
    expect(h.events.indexOf('restore')).toBeLessThan(h.events.indexOf('save'));
    expect(h.events.indexOf('save')).toBeLessThan(h.events.indexOf('markSaved'));
    expect(h.Storage.save).toHaveBeenCalledWith(h.State.serialize());
    expect(h.Storage.clearRecovery).toHaveBeenCalledOnce();
    expect(h.UI.updateStorageInfo).toHaveBeenCalledOnce();
    expect(h.Settings.updateStorageStatus).toHaveBeenCalledOnce();
    expect(h.State.markDirty).not.toHaveBeenCalled();
    expect(h.state.dirty).toBe(false);
    expect(h.toasts.at(-1)[1]).toBe('success');
  });

  it('marks imported data dirty and warns rather than claiming it was saved if storage is full', async () => {
    const h = createHarness({ saveSuccess: false });
    expect(await h.dataIO.importData(h.file)).toBe(false);
    expect(h.State.restore).toHaveBeenCalledOnce();
    expect(h.Storage.save).toHaveBeenCalledOnce();
    expect(h.Storage.clearRecovery).not.toHaveBeenCalled();
    expect(h.State.markSaved).not.toHaveBeenCalled();
    expect(h.State.markDirty).toHaveBeenCalledOnce();
    expect(h.UI.markStorageDirty).toHaveBeenCalledOnce();
    expect(h.Settings.updateStorageStatus).toHaveBeenCalledOnce();
    expect(h.state.dirty).toBe(true);
    expect(h.toasts.at(-1)[1]).toBe('warning');
    expect(h.toasts.at(-1)[0]).toContain('belum tersimpan');
  });

  it('does not restore or persist data when import confirmation is cancelled', async () => {
    const h = createHarness({ confirm: false });
    expect(await h.dataIO.importData(h.file)).toBe(false);
    expect(h.State.restore).not.toHaveBeenCalled();
    expect(h.Storage.save).not.toHaveBeenCalled();
    expect(h.toasts).toHaveLength(0);
  });

  it('rejects invalid JSON without modifying saved data', async () => {
    const h = createHarness();
    const badFile = { ...h.file, content: '{not-json' };
    expect(await h.dataIO.importData(badFile)).toBe(false);
    expect(h.State.restore).not.toHaveBeenCalled();
    expect(h.Storage.save).not.toHaveBeenCalled();
    expect(h.toasts.at(-1)[1]).toBe('error');
  });
});
