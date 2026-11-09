import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const scripts = [...read('index.html').matchAll(/<script\b[^>]*src=["'](templates\/[^"']+\.js)["']/g)]
  .map(match => match[1]);

function makeElement(tagName, height = 0) {
  const attributes = {};
  const style = { setProperty(name, value) { this[name] = value; } };
  const element = {
    tagName, height, style, dataset: {}, attributes, children: [], parentNode: null,
    className: '', textContent: '', _html: '',
    get offsetHeight() { return this.height || 600; },
    get clientHeight() { return this.height || 600; },
    get scrollHeight() {
      return this.children.reduce((sum, child) => sum + child.height, 0);
    },
    get lastElementChild() { return this.children.at(-1) || null; },
    getBoundingClientRect() {
      const siblings = this.parentNode?.children || [];
      const index = siblings.indexOf(this);
      const previous = index >= 0
        ? siblings.slice(0, index).reduce((total, item) => total + item.height, 0)
        : 0;
      return { top: previous, bottom: previous + this.offsetHeight, height: this.offsetHeight };
    },
    getAttribute(name) { return attributes[name] || null; },
    setAttribute(name, value) { attributes[name] = String(value); },
    matches(selector) { return selector === '.doc-table-wrap' ? false : false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    remove() { this.parentNode?.removeChild(this); },
  };
  const classes = new Set();
  element.classList = {
    add(...names) { names.forEach(name => classes.add(name)); },
    remove(...names) { names.forEach(name => classes.delete(name)); },
    contains(name) { return classes.has(name); },
    toggle(name, force) {
      if (force === undefined ? !classes.has(name) : force) classes.add(name);
      else classes.delete(name);
    },
  };
  Object.defineProperty(element, 'innerHTML', {
    get() { return element._html; },
    set(html) {
      element._html = String(html);
      element.children.length = 0;
      if (tagName === 'preview' && html) {
        const source = makeElement('source', 600);
        source.children = element._fixtureHeights.map(height => makeElement('block', height));
        for (const child of source.children) child.parentNode = source;
        source.getAttribute = name => name === 'style' ? 'padding:20mm;' : null;
        element._source = source;
      } else if (tagName === 'preview') {
        element._source = null;
      }
    },
  });
  return element;
}

function createPreviewHarness(heights = [350, 350, 350], withTableConfig = false) {
  const preview = makeElement('preview');
  preview._fixtureHeights = heights;
  preview.querySelector = selector => {
    if (selector === ':scope > .doc-content') return preview._source;
    if (selector === ':scope > .surat-page') return preview.children[0] || null;
    return null;
  };
  preview.querySelectorAll = selector => {
    if (selector === ':scope > .surat-page[data-page-count]') return preview.children;
    return [];
  };
  const wrapper = makeElement('wrapper');
  const pageInfo = makeElement('info');
  const zoomInfo = makeElement('zoom');
  const elements = {
    'surat-preview': preview,
    'preview-canvas-wrapper': wrapper,
    'preview-page-info': pageInfo,
    'zoom-level-text': zoomInfo,
  };
  const document = {
    getElementById: id => elements[id] || null,
    createElement: tag => makeElement(tag, tag === 'section' ? 600 : 600),
    fonts: { ready: Promise.resolve() },
  };
  const state = {
    currentId: null, currentData: null, tables: {}, listeners: {},
    on: vi.fn((event, callback) => {
      (state.listeners[event] ||= []).push(callback);
    }),
    getTableConfig: templateId => state.tables[templateId] || {},
    initTableConfig: (templateId, config) => { state.tables[templateId] = config; },
    setTableConfig: (templateId, tableId, config) => {
      (state.tables[templateId] ||= {})[tableId] = config;
      (state.listeners['table:change'] || []).forEach(callback => callback({ templateId, tableId }));
    },
    getUi: () => ({ previewZoom: 1 }),
    getActiveTemplate: () => state.currentId,
    getFormData: () => state.currentData,
    getKop: () => ({}),
    getSettings: () => ({
      orientation: 'portrait',
      preview: { showMarginGuide: false, showPrintableArea: false },
      pageNumber: { enabled: true },
    }),
    getMarginMm: () => ({ top: 20, bottom: 20, left: 20, right: 20 }),
    getPaperDimensions: () => ({ widthMm: 210, heightMm: 297 }),
    getTypography: () => ({
      fontFamily: 'Times New Roman', fontSize: 12, lineHeight: 1.2,
      tableSize: 8, headingSize: 12,
    }),
    setZoom: vi.fn(), setSettings: vi.fn(),
  };
  const context = {
    console: { warn: vi.fn(), info: vi.fn() },
    document, State: state, Promise, Set,
    requestAnimationFrame: callback => Promise.resolve().then(() => callback()),
    getComputedStyle: () => ({ paddingBottom: '0' }),
    KopEditor: { renderKopHtml: () => '<div class="doc-kop">KOP</div>' },
    TableRenderer: {
      render: () => '<div class="doc-table-wrap"><table></table></div>',
      renderDpuTable: () => '<div class="doc-table-wrap"><table></table></div>',
    },
  };
  runInNewContext(read('js/utils.js'), context);
  for (const path of scripts) runInNewContext(read(path), context, { filename: path });
  runInNewContext(read('js/template-registry.js'), context);
  if (withTableConfig) {
    runInNewContext(read('js/table-config.js'), context);
    runInNewContext(read('js/table-config-ui.js'), context);
  }
  runInNewContext(read('js/preview-renderer.js'), context);
  const registry = runInNewContext('TemplateRegistry', context);
  const renderer = runInNewContext('PreviewRenderer', context);
  registry.init();
  renderer.init();
  return { renderer, registry, state, preview, wrapper, pageInfo, context };
}

describe('GS-005: pagination integration across all runtime templates', () => {
  it('covers the ten real templates loaded by index.html', () => {
    expect(scripts).toHaveLength(10);
    expect(scripts).toContain('templates/rekap-nilai.js');
    expect(scripts).toContain('templates/surat-izin.js');
  });

  for (const path of scripts) {
    const id = path.slice('templates/'.length, -'.js'.length);
    it('renders ' + id + ' through the physical-page paginator with overflow and numbering', async () => {
      const h = createPreviewHarness();
      const template = h.registry.get(id);
      expect(template).toBeTruthy();
      h.state.currentId = id;
      h.state.currentData = template.createDefaultData();
      h.renderer.render(template, h.state.currentData, {});
      expect(h.preview.innerHTML).toContain('doc-content');
      expect(h.preview.style.minHeight).toBe('0');
      await h.renderer.waitForReady(30);
      expect(h.preview.classList.contains('surat-preview--document')).toBe(true);
      expect(h.preview.dataset.pageCount).toBe('3');
      expect(h.preview.children).toHaveLength(3);
      expect(h.preview.children.map(page => page.dataset.pageNumber)).toEqual(['1', '2', '3']);
      expect(h.preview.children.every(page => page.dataset.pageCount === '3')).toBe(true);
      expect(h.pageInfo.textContent).toBe('3 halaman');
      expect(h.preview.children.every(page => page.style.height.endsWith('px'))).toBe(true);
    });
  }

  it('keeps short content on one physical page without introducing a blank page', async () => {
    const h = createPreviewHarness([120]);
    const template = h.registry.get('surat-izin');
    h.state.currentId = template.TEMPLATE_ID;
    h.state.currentData = template.createDefaultData();
    h.renderer.render(template, h.state.currentData, {});
    await h.renderer.waitForReady(30);
    expect(h.preview.dataset.pageCount).toBe('1');
    expect(h.preview.children).toHaveLength(1);
    expect(h.pageInfo.textContent).toBe('1 halaman');
  });
});


describe('Rekap Nilai: panel Pengaturan Tabel vs preview', () => {
  const open = () => {
    const h = createPreviewHarness([120], true);
    const template = h.registry.get('rekap-nilai');
    const manager = runInNewContext('TableConfigManager', h.context);
    const tableUi = runInNewContext('TableConfigUI', h.context);
    h.state.currentId = 'rekap-nilai';
    h.state.currentData = template.createDefaultData();
    manager.initForTemplate('rekap-nilai');

    const mount = {
      innerHTML: '', style: {},
      querySelector: () => null,
      removeAttribute: () => {},
      addEventListener: () => {},
    };
    tableUi.init(mount);
    tableUi.render('rekap-nilai');
    return { ...h, template, manager, tableUi, mount };
  };
  const htmlCardCount = (html, className) =>
    (html.match(new RegExp('class="' + className + '"', 'g')) || []).length;

  it('shows 17 editable width/header/body columns for default layout, not 30', () => {
    const h = open();
    const layout = h.template.getTableLayout(h.state.currentData);
    expect(layout.columns.map(c => c.key)).toHaveLength(17);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__width-row')).toBe(17);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__col-card')).toBe(34);
    expect(h.mount.innerHTML).not.toContain('data-col-key="bab5_tp4"');
    expect(h.mount.innerHTML).toContain('data-col-key="sts"');
    expect(h.mount.innerHTML).toContain('data-col-idx="26"');
  });

  it('rebuilds the panel when BAB/TP/LM counts change without shifting stable settings', () => {
    const h = open();
    const previous = h.template.getTableLayout(h.state.currentData);
    const originalIndex = previous.columns.find(c => c.key === 'sts').configIndex;
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'body', originalIndex, { italic: true });
    h.state.currentData.header = { ...h.state.currentData.header, jumlahBab: 1, jumlahTpBab: 1, jumlahLm: 1 };
    for (const callback of h.state.listeners['form:change'] || []) {
      callback({ templateId: 'rekap-nilai' });
    }
    const reduced = h.template.getTableLayout(h.state.currentData);
    expect(reduced.columns).toHaveLength(8);
    expect(reduced.columns.find(c => c.key === 'sts').configIndex).toBe(originalIndex);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__width-row')).toBe(8);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__col-card')).toBe(16);
    expect(h.manager.getResolvedConfig('rekap-nilai', 'rekap-nilai').body.columns[originalIndex].italic).toBe(true);

    h.state.currentData.header = { ...h.state.currentData.header, jumlahBab: 5, jumlahTpBab: 4, jumlahLm: 4 };
    for (const callback of h.state.listeners['form:change'] || []) callback({ templateId: 'rekap-nilai' });
    expect(h.template.getTableLayout(h.state.currentData).columns).toHaveLength(30);
    expect(htmlCardCount(h.mount.innerHTML, 'tbl-cfg__width-row')).toBe(30);
  });

  it('applies custom widths and per-column text styling at their actual preview positions', () => {
    const h = open();
    const keys = h.template.tableColumns;
    const idx = key => keys.findIndex(column => column.key === key);
    h.state.currentData.murid[0].bab2_tp2 = '42';
    h.state.currentData.murid[0].sts = '88';
    h.manager.updateColumnWidth('rekap-nilai', 'rekap-nilai', 'sts', {
      mode: 'custom', value: 24, unit: 'mm',
    });
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'header', idx('sts'), {
      italic: true, horizontalAlign: 'right',
    });
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'body', idx('bab2_tp2'), {
      italic: true, horizontalAlign: 'right',
    });
    h.manager.updateColumn('rekap-nilai', 'rekap-nilai', 'body', idx('sts'), {
      bold: true,
    });
    h.renderer.render(h.template, h.state.currentData, {});
    const html = h.preview.innerHTML;
    const layout = h.template.getTableLayout(h.state.currentData);
    const widths = [...html.matchAll(/<col(?: style="([^"]*)")?>/g)];
    expect(widths).toHaveLength(layout.columns.length);
    expect(widths[layout.columns.findIndex(c => c.key === 'sts')][1]).toContain('width:24mm');
    expect(html).toMatch(/style="[^"]*font-style:italic[^"]*text-align:right[^"]*">Sumatif Tengah Semester/);
    expect(html).toMatch(/<td style="[^"]*text-align:right[^"]*font-style:italic[^"]*">42<\/td>/);
    expect(html).toMatch(/<td style="[^"]*font-weight:bold[^"]*">88<\/td>/);
  });

  it('applies bulk styling only to currently visible columns and retains hidden custom widths', () => {
    const h = open();
    const keys = h.template.tableColumns;
    const keyIndex = key => keys.findIndex(col => col.key === key);
    h.manager.updateColumnWidth('rekap-nilai', 'rekap-nilai', 'bab5_tp4', {
      mode: 'custom', value: 13, unit: 'mm',
    });
    h.manager.applyToAllColumns('rekap-nilai', 'rekap-nilai', 'header', { bold: true });
    const config = h.manager.getResolvedConfig('rekap-nilai', 'rekap-nilai');
    expect(config.header.columns[keyIndex('sts')].bold).toBe(true);
    expect(config.header.columns[keyIndex('bab5_tp4')].bold).toBe(false);
    h.manager.setAllColumnWidthMode('rekap-nilai', 'rekap-nilai', 'auto');
    expect(h.manager.getResolvedConfig('rekap-nilai', 'rekap-nilai').columnWidths.byKey.bab5_tp4.value).toBe(13);
  });
});
