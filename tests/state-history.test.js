import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const utilsSource = readFileSync(new URL('../js/utils.js', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../js/state.js', import.meta.url), 'utf8');

function createState() {
  const context = vm.createContext({
    console: { warn() {} },
    TemplateRegistry: { get: templateId => ({ TEMPLATE_ID: templateId }) },
  });
  vm.runInContext(utilsSource, context, { filename: 'utils.js' });
  vm.runInContext(stateSource, context, { filename: 'state.js' });
  return vm.runInContext('State', context);
}

describe('State undo/redo coverage', () => {
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
