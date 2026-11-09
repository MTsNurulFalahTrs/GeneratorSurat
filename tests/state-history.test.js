import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const utilsSource = readFileSync(new URL('../js/utils.js', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../js/state.js', import.meta.url), 'utf8');

function createState() {
  const templateOrientations = {
    dpu: 'landscape',
    'mutasi-masuk': 'landscape',
    'siswa-baru': 'landscape',
    'ijop-permohonan': 'portrait',
    'ijop-sptjm-satpen': 'portrait',
    'ijop-rekomendasi-pengawas': 'portrait',
    'ijop-rekomendasi-kankemenag': 'portrait',
    'ijop-sptjm-kankemenag': 'portrait',
  };
  const context = vm.createContext({
    console: { warn() {} },
    TemplateRegistry: {
      get: templateId => Object.prototype.hasOwnProperty.call(templateOrientations, templateId)
        ? {
            TEMPLATE_ID: templateId,
            meta: { orientation: templateOrientations[templateId] },
          }
        : null,
    },
  });
  vm.runInContext(utilsSource, context, { filename: 'utils.js' });
  vm.runInContext(stateSource, context, { filename: 'state.js' });
  return vm.runInContext('State', context);
}

describe('State undo/redo coverage', () => {
  it('uses the selected template orientation as a default and keeps it undoable', () => {
    const State = createState();

    expect(State.getSettings().orientation).toBe('portrait');
    State.setActiveTemplate('dpu');

    expect(State.getSettings().orientation).toBe('landscape');
    expect(State.getSettings().activePreset).toBe('custom');
    expect(State.getHistoryInfo().canUndo).toBe(true);

    expect(State.undo()).toBe(true);
    expect(State.getActiveTemplate()).toBe(null);
    expect(State.getSettings().orientation).toBe('portrait');

    expect(State.redo()).toBe(true);
    expect(State.getActiveTemplate()).toBe('dpu');
    expect(State.getSettings().orientation).toBe('landscape');
  });

  it('applies the declared orientation for every registered document template', () => {
    const State = createState();
    const cases = [
      ['dpu', 'landscape'],
      ['mutasi-masuk', 'landscape'],
      ['siswa-baru', 'landscape'],
      ['ijop-permohonan', 'portrait'],
      ['ijop-sptjm-satpen', 'portrait'],
      ['ijop-rekomendasi-pengawas', 'portrait'],
      ['ijop-rekomendasi-kankemenag', 'portrait'],
      ['ijop-sptjm-kankemenag', 'portrait'],
    ];

    for (const [templateId, orientation] of cases) {
      State.setActiveTemplate(templateId);
      expect(State.getSettings().orientation, templateId).toBe(orientation);
    }
  });

  it('emits a dedicated settings event when template orientation changes', () => {
    const State = createState();
    const events = [];
    State.on('settings:change', payload => events.push(payload));

    State.setActiveTemplate('dpu');

    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('template-default');
    expect(events[0].templateId).toBe('dpu');
    expect(events[0].settings.orientation).toBe('landscape');
  });

  it('does not change the active orientation for an unknown template', () => {
    const State = createState();
    State.setSettings({ orientation: 'landscape' });

    State.setActiveTemplate('unknown-template');

    expect(State.getActiveTemplate()).toBe(null);
    expect(State.getSettings().orientation).toBe('landscape');
  });

  it('preserves an explicit orientation override until another template is selected', () => {
    const State = createState();
    State.setActiveTemplate('dpu');
    State.setSettings({ orientation: 'portrait' });

    expect(State.getSettings().orientation).toBe('portrait');
    State.setActiveTemplate('ijop-permohonan');
    expect(State.getSettings().orientation).toBe('portrait');

    State.setActiveTemplate('siswa-baru');
    expect(State.getSettings().orientation).toBe('landscape');
  });

  it('records table configuration changes in undo and redo history', () => {
    const State = createState();
    State.setActiveTemplate('dpu');
    State.setTableConfig('dpu', 'siswa', { header: { bold: true } });

    expect(State.getTableConfig('dpu').siswa.header.bold).toBe(true);
    expect(State.getHistoryInfo().canUndo).toBe(true);

    expect(State.undo()).toBe(true);
    expect(State.getTableConfig('dpu').siswa).toBeUndefined();

    expect(State.redo()).toBe(true);
    expect(State.getTableConfig('dpu').siswa.header.bold).toBe(true);
  });

  it('records table reset and restores the removed configuration on undo', () => {
    const State = createState();
    State.setTableConfig('dpu', 'siswa', { body: { italic: true } });
    State.markSaved();

    State.resetTableConfig('dpu', 'siswa');
    expect(State.getTableConfig('dpu').siswa).toBeUndefined();
    expect(State.undo()).toBe(true);
    expect(State.getTableConfig('dpu').siswa.body.italic).toBe(true);
  });

  it('records resetSettings so document settings can be restored with undo', () => {
    const State = createState();
    const defaultMarginLeft = State.getSettings().margin.left;

    State.setSettings({ margin: { left: 40 } });
    State.markSaved();

    State.resetSettings();
    expect(State.getSettings().margin.left).toBe(defaultMarginLeft);
    expect(State.undo()).toBe(true);
    expect(State.getSettings().margin.left).toBe(40);
  });

  it('exposes markDirty for a recovered document that could not be persisted', () => {
    const State = createState();
    State.markDirty();
    expect(State.isDirty()).toBe(true);
  });
});
