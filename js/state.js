/* =============================================================
   state.js — Centralized application state management
   =============================================================
   Sumber kebenaran tunggal untuk seluruh state aplikasi.
   State disimpan dalam memori. Storage.js menangani persistensi.
   Setiap perubahan state sebaiknya dilakukan melalui fungsi setter
   di sini agar perubahan dapat dilacak dan disinkronkan ke storage.
*/

const State = (() => {

  /* ── Ukuran kertas baku (dalam mm) ── */
  const PAPER_SIZES = {
    A4:     { width: 210,    height: 297,   label: 'A4 (210 × 297 mm)'     },
    A5:     { width: 148,    height: 210,   label: 'A5 (148 × 210 mm)'     },
    F4:     { width: 215,    height: 330,   label: 'F4 / Folio (215 × 330 mm)' },
    Letter: { width: 215.9,  height: 279.4, label: 'Letter (215.9 × 279.4 mm)' },
    Legal:  { width: 215.9,  height: 355.6, label: 'Legal (215.9 × 355.6 mm)'  },
    Custom: { width: 210,    height: 297,   label: 'Custom'                 },
  };

  /* ── Preset margin (mm) ── */
  const MARGIN_PRESETS = {
    default: { top: 20, right: 20, bottom: 25, left: 25, label: 'Default'  },
    normal:  { top: 25, right: 25, bottom: 25, left: 25, label: 'Normal'   },
    narrow:  { top: 12, right: 12, bottom: 12, left: 12, label: 'Sempit'   },
    wide:    { top: 30, right: 30, bottom: 30, left: 35, label: 'Lebar'    },
  };

  /* ── Preset dokumen lengkap ── */
  const DOCUMENT_PRESETS = {
    'a4-normal': {
      label: 'A4 Normal',
      paper: { size: 'A4', unit: 'mm' },
      orientation: 'portrait',
      margin: { ...MARGIN_PRESETS.default },
    },
    'a4-narrow': {
      label: 'A4 Sempit',
      paper: { size: 'A4', unit: 'mm' },
      orientation: 'portrait',
      margin: { ...MARGIN_PRESETS.narrow },
    },
    'a5-normal': {
      label: 'A5',
      paper: { size: 'A5', unit: 'mm' },
      orientation: 'portrait',
      margin: { top: 15, right: 15, bottom: 15, left: 15 },
    },
    'f4-normal': {
      label: 'F4 / Folio',
      paper: { size: 'F4', unit: 'mm' },
      orientation: 'portrait',
      margin: { ...MARGIN_PRESETS.default },
    },
    'landscape': {
      label: 'A4 Landscape',
      paper: { size: 'A4', unit: 'mm' },
      orientation: 'landscape',
      margin: { top: 15, right: 15, bottom: 20, left: 20 },
    },
  };

  /* ── Default Settings ── */
  const DEFAULT_SETTINGS = () => ({
    paper: {
      size: 'A4',
      customWidth: 210,
      customHeight: 297,
      unit: 'mm',
    },
    orientation: 'portrait',
    margin: {
      top: 20,
      right: 20,
      bottom: 25,
      left: 25,
    },
    typography: {
      fontFamily:  'Times New Roman',  // font isi surat
      fontSize:    12,                 // pt, range 7–22
      lineHeight:  1.5,                // jarak baris konten
      tableSize:   7.5,                // pt untuk teks dalam tabel
    },
    print: {
      scale: 100,
    },
    preview: {
      zoom: 'auto',
      showMarginGuide: false,
      showPrintableArea: false,
    },
    activePreset: 'a4-normal',
  });

  /* ── Default KOP Config ── */
  const DEFAULT_KOP_ROW = (index) => ({
    id: Utils.generateId('kop-row'),
    text: '',
    fontFamily: 'Times New Roman',
    fontSize: 12,           // pt, range 7–22
    bold: false,
    italic: false,
    underline: false,
    textAlign: 'center',    // 'left' | 'center' | 'right'
    lineHeight: 1.2,
    color: '#000000',
    letterSpacing: 0,       // em
    textTransform: 'none',  // 'none' | 'uppercase' | 'capitalize' | 'lowercase'
  });

  const DEFAULT_KOP_CONFIG = () => ({
    logoLeft: {
      dataUrl: null,
      width: 65,      // px dalam preview
      height: 65,
      objectFit: 'contain',
      verticalAlign: 'center', // 'top' | 'center' | 'bottom'
    },
    logoRight: {
      enabled: false,
      dataUrl: null,
      width: 65,
      height: 65,
      objectFit: 'contain',
      verticalAlign: 'center',
    },
    rows: [
      // Default 4 baris KOP
      {
        id: Utils.generateId('kop-row'),
        text: 'KEMENTERIAN AGAMA',
        fontFamily: 'Times New Roman',
        fontSize: 11,
        bold: false,
        italic: false,
        underline: false,
        textAlign: 'center',
        lineHeight: 1.2,
        color: '#000000',
        letterSpacing: 0,
        textTransform: 'none',
      },
      {
        id: Utils.generateId('kop-row'),
        text: 'YAYASAN PENDIDIKAN ISLAM TERAWAS DARUSSALAM',
        fontFamily: 'Times New Roman',
        fontSize: 11,
        bold: false,
        italic: false,
        underline: false,
        textAlign: 'center',
        lineHeight: 1.2,
        color: '#000000',
        letterSpacing: 0,
        textTransform: 'none',
      },
      {
        id: Utils.generateId('kop-row'),
        text: 'MADRASAH TSANAWIYAH NURUL FALAH',
        fontFamily: 'Times New Roman',
        fontSize: 14,
        bold: true,
        italic: false,
        underline: false,
        textAlign: 'center',
        lineHeight: 1.2,
        color: '#000000',
        letterSpacing: 0,
        textTransform: 'none',
      },
      {
        id: Utils.generateId('kop-row'),
        text: 'Alamat: Jl. Jambi Lama RT. 004 Kelurahan Terawas Kecamatan STL. Ulu Terawas Kabupaten Musi Rawas ~30771',
        fontFamily: 'Times New Roman',
        fontSize: 8,
        bold: false,
        italic: true,
        underline: false,
        textAlign: 'center',
        lineHeight: 1.2,
        color: '#000000',
        letterSpacing: 0,
        textTransform: 'none',
      },
    ],
  });

  /* ── Application State (in-memory) ── */
  let _state = {
    /* Template aktif */
    activeTemplate: null,

    /* KOP konfigurasi */
    kop: DEFAULT_KOP_CONFIG(),

    /* Pengaturan dokumen (kertas, margin, cetak, preview) */
    settings: DEFAULT_SETTINGS(),

    /* Data form per-template */
    forms: {},

    /*
     * Konfigurasi tabel per-template.
     * Struktur: { [templateId]: { [tableId]: { header: { columns: {...} }, body: { columns: {...} } } } }
     * Setiap kolom: { horizontalAlign, verticalAlign, bold, italic, fontSize }
     */
    tables: {},

    /* UI state */
    ui: {
      activeTab: 'template',
      previewZoom: 1,
      isDirty: false,
    },

    /* Storage meta (di-sync dari Storage) */
    storage: {
      lastSavedAt: null,
      expiresAt: null,
      available: false,
    },
  };

  /* ── Listeners ── */
  const _listeners = {};

  /* ── Subscribe/emit system ── */
  function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(callback);
    return () => off(event, callback); // return unsubscribe fn
  }

  function off(event, callback) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(cb => cb !== callback);
  }

  function emit(event, data) {
    if (!_listeners[event]) return;
    _listeners[event].forEach(cb => {
      try { cb(data); } catch (err) {
        console.warn(`[State] Error di listener "${event}":`, err);
      }
    });
  }

  /* ── Getter: seluruh state (deep clone) ── */
  function getState() {
    return Utils.deepClone(_state);
  }

  /* ── Getter: bagian tertentu ── */
  function getKop() {
    return Utils.deepClone(_state.kop);
  }

  function getActiveTemplate() {
    return _state.activeTemplate;
  }

  function getFormData(templateId) {
    const id = templateId || _state.activeTemplate;
    if (!id) return null;
    return Utils.deepClone(_state.forms[id] || null);
  }

  function getUi() {
    return Utils.deepClone(_state.ui);
  }

  function getStorageMeta() {
    return Utils.deepClone(_state.storage);
  }

  /* ── Setter: template aktif ── */
  function setActiveTemplate(templateId) {
    if (_state.activeTemplate === templateId) return;
    _state.activeTemplate = templateId;
    _state.ui.isDirty = true;
    emit('template:change', { templateId });
    emit('state:change', { field: 'activeTemplate' });
  }

  /* ── Setter: KOP config (partial update) ── */
  function setKop(partial) {
    _state.kop = Utils.deepMerge(_state.kop, partial);
    _state.ui.isDirty = true;
    emit('kop:change', { kop: Utils.deepClone(_state.kop) });
    emit('state:change', { field: 'kop' });
  }

  /* ── Setter: KOP row tunggal ── */
  function setKopRow(rowId, partial) {
    const idx = _state.kop.rows.findIndex(r => r.id === rowId);
    if (idx === -1) return;
    _state.kop.rows[idx] = Utils.deepMerge(_state.kop.rows[idx], partial);
    _state.ui.isDirty = true;
    emit('kop:rowChange', { rowId, row: Utils.deepClone(_state.kop.rows[idx]) });
    emit('kop:change', { kop: Utils.deepClone(_state.kop) });
    emit('state:change', { field: 'kop.rows' });
  }

  /* ── Setter: jumlah baris KOP ── */
  function setKopRowCount(count) {
    const MIN_ROWS = 1;
    const MAX_ROWS = 10;
    const safeCount = Utils.clamp(count, MIN_ROWS, MAX_ROWS);
    const currentRows = _state.kop.rows;

    if (safeCount > currentRows.length) {
      // Tambah baris baru
      const toAdd = safeCount - currentRows.length;
      for (let i = 0; i < toAdd; i++) {
        currentRows.push(DEFAULT_KOP_ROW(currentRows.length));
      }
    } else if (safeCount < currentRows.length) {
      // Kurangi baris dari belakang
      currentRows.splice(safeCount);
    }

    _state.kop.rows = [...currentRows];
    _state.ui.isDirty = true;
    emit('kop:rowCountChange', { count: safeCount });
    emit('kop:change', { kop: Utils.deepClone(_state.kop) });
    emit('state:change', { field: 'kop.rows' });
  }

  /* ── Setter: logo KOP ── */
  function setKopLogo(side, partial) {
    if (side !== 'left' && side !== 'right') return;
    const key = side === 'left' ? 'logoLeft' : 'logoRight';
    _state.kop[key] = Utils.deepMerge(_state.kop[key], partial);
    _state.ui.isDirty = true;
    emit('kop:logoChange', { side, logo: Utils.deepClone(_state.kop[key]) });
    emit('kop:change', { kop: Utils.deepClone(_state.kop) });
    emit('state:change', { field: `kop.${key}` });
  }

  /* ── Setter: form data (partial) ── */
  function setFormData(templateId, partial) {
    const id = templateId || _state.activeTemplate;
    if (!id) return;
    if (!_state.forms[id]) _state.forms[id] = {};
    _state.forms[id] = Utils.deepMerge(_state.forms[id], partial);
    _state.ui.isDirty = true;
    emit('form:change', { templateId: id, data: Utils.deepClone(_state.forms[id]) });
    emit('state:change', { field: 'forms' });
  }

  /* ── Setter: inisialisasi form data dari template default ── */
  function initFormData(templateId, defaultData) {
    if (!_state.forms[templateId]) {
      _state.forms[templateId] = Utils.deepClone(defaultData);
      emit('form:init', { templateId });
    }
  }

  /* ── Setter: UI state ── */
  function setUi(partial) {
    _state.ui = { ..._state.ui, ...partial };
    emit('ui:change', { ui: Utils.deepClone(_state.ui) });
  }

  /* ── Setter: active tab ── */
  function setActiveTab(tab) {
    if (_state.ui.activeTab === tab) return;
    _state.ui.activeTab = tab;
    emit('ui:tabChange', { tab });
  }

  /* ── Setter: zoom level ── */
  function setZoom(zoom) {
    const safeZoom = Utils.clamp(zoom, 0.3, 2.5);
    _state.ui.previewZoom = safeZoom;
    emit('ui:zoomChange', { zoom: safeZoom });
  }

  /* ── Setter: storage meta ── */
  function setStorageMeta(meta) {
    _state.storage = { ..._state.storage, ...meta };
    emit('storage:metaChange', { meta: Utils.deepClone(_state.storage) });
  }

  /* ────────────────────────────────────────────────
     SETTINGS GETTERS & SETTERS
  ──────────────────────────────────────────────── */
  const VALID_PAPER_UNITS = ['mm', 'cm', 'in'];

  function _normalizePaperSize(value) {
    const raw = String(value ?? '').trim();
    const exact = Object.prototype.hasOwnProperty.call(PAPER_SIZES, raw) ? raw : null;
    if (exact) return exact;

    const match = Object.keys(PAPER_SIZES).find(key => key.toLowerCase() === raw.toLowerCase());
    return match || 'A4';
  }

  function _toFiniteNumber(value, fallback, min = -Infinity, max = Infinity) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Utils.clamp(n, min, max);
  }

  function _normalizeSettings(input) {
    const settings = Utils.deepMerge(DEFAULT_SETTINGS(), input || {});

    settings.paper = settings.paper || {};
    settings.paper.size = _normalizePaperSize(settings.paper.size);
    settings.paper.unit = VALID_PAPER_UNITS.includes(settings.paper.unit)
      ? settings.paper.unit
      : 'mm';

    /*
     * customWidth/customHeight adalah nilai internal dalam mm.
     * paper.unit hanya menentukan satuan yang ditampilkan di Settings.
     */
    settings.paper.customWidth = _toFiniteNumber(
      settings.paper.customWidth,
      DEFAULT_SETTINGS().paper.customWidth,
      CUSTOM_DIMENSION_MIN_MM,
      CUSTOM_DIMENSION_MAX_MM
    );
    settings.paper.customHeight = _toFiniteNumber(
      settings.paper.customHeight,
      DEFAULT_SETTINGS().paper.customHeight,
      CUSTOM_DIMENSION_MIN_MM,
      CUSTOM_DIMENSION_MAX_MM
    );

    settings.orientation = settings.orientation === 'landscape' ? 'landscape' : 'portrait';

    settings.margin = settings.margin || {};
    ['top', 'right', 'bottom', 'left'].forEach(side => {
      settings.margin[side] = _toFiniteNumber(
        settings.margin[side],
        DEFAULT_SETTINGS().margin[side],
        0,
        60
      );
    });

    settings.typography = settings.typography || {};
    settings.typography.fontFamily = String(
      settings.typography.fontFamily || DEFAULT_SETTINGS().typography.fontFamily
    );
    settings.typography.fontSize = _toFiniteNumber(
      settings.typography.fontSize,
      DEFAULT_SETTINGS().typography.fontSize,
      7,
      22
    );
    settings.typography.lineHeight = _toFiniteNumber(
      settings.typography.lineHeight,
      DEFAULT_SETTINGS().typography.lineHeight,
      0.5,
      3
    );
    settings.typography.tableSize = _toFiniteNumber(
      settings.typography.tableSize,
      DEFAULT_SETTINGS().typography.tableSize,
      6,
      14
    );

    settings.print = settings.print || {};
    settings.print.scale = _toFiniteNumber(
      settings.print.scale,
      DEFAULT_SETTINGS().print.scale,
      50,
      150
    );

    settings.preview = settings.preview || {};
    const previewZoom = settings.preview.zoom;
    if (
      typeof previewZoom !== 'string' &&
      !Number.isFinite(Number(previewZoom))
    ) {
      settings.preview.zoom = DEFAULT_SETTINGS().preview.zoom;
    }

    return settings;
  }



  /** Kembalikan seluruh settings (deep clone) */
  function getSettings() {
    return Utils.deepClone(_state.settings);
  }

  /** Update settings secara partial, lalu emit event */
  function setSettings(partial) {
    _state.settings = _normalizeSettings(Utils.deepMerge(_state.settings, partial));
    _state.ui.isDirty = true;
    emit('settings:change', { settings: Utils.deepClone(_state.settings) });
    emit('state:change', { field: 'settings' });
  }

  /**
   * Hitung dimensi kertas aktif dalam mm.
   * Memperhitungkan orientasi landscape (tukar lebar/tinggi).
   */
  function getPaperDimensions() {
    const s    = _state.settings;
    const size = s.paper.size;
    let w, h;

    if (size === 'Custom') {
      // customWidth/customHeight selalu disimpan internal dalam mm.
      w = Number(s.paper.customWidth);
      h = Number(s.paper.customHeight);
    } else {
      const def = PAPER_SIZES[size] || PAPER_SIZES.A4;
      w = def.width;
      h = def.height;
    }

    // Landscape → tukar lebar & tinggi
    if (s.orientation === 'landscape') {
      return { widthMm: h, heightMm: w };
    }
    return { widthMm: w, heightMm: h };
  }

  /** Kembalikan margin aktif dalam mm */
  function getMarginMm() {
    const m = _state.settings.margin;
    return { top: m.top, right: m.right, bottom: m.bottom, left: m.left };
  }

  /** Terapkan preset dokumen */
  function applyDocumentPreset(presetKey) {
    const preset = DOCUMENT_PRESETS[presetKey];
    if (!preset) return;
    _state.settings = Utils.deepMerge(_state.settings, {
      paper:       { size: preset.paper.size, unit: preset.paper.unit || 'mm' },
      orientation: preset.orientation,
      margin:      { ...preset.margin },
      activePreset: presetKey,
    });
    _state.ui.isDirty = true;
    emit('settings:change', { settings: Utils.deepClone(_state.settings) });
    emit('settings:presetApplied', { presetKey });
    emit('state:change', { field: 'settings' });
  }

  /** Reset settings ke default */
  function resetSettings() {
    _state.settings = DEFAULT_SETTINGS();
    _state.ui.isDirty = true;
    emit('settings:change', { settings: Utils.deepClone(_state.settings) });
    emit('settings:reset', {});
    emit('state:change', { field: 'settings' });
  }

  /* ── Konversi satuan ke mm (internal selalu mm) ── */
  function _toMm(value, unit) {
    const n = parseFloat(value) || 0;
    if (unit === 'cm')  return n * 10;
    if (unit === 'in')  return n * 25.4;
    return n; // mm default
  }

  /* ── Daftar font yang tersedia untuk isi surat ── */
  const DOCUMENT_FONTS = [
    { value: 'Times New Roman',    label: 'Times New Roman'    },
    { value: 'Arial',              label: 'Arial'              },
    { value: 'Calibri',            label: 'Calibri'            },
    { value: 'Georgia',            label: 'Georgia'            },
    { value: 'Verdana',            label: 'Verdana'            },
    { value: 'Tahoma',             label: 'Tahoma'             },
    { value: 'Trebuchet MS',       label: 'Trebuchet MS'       },
    { value: 'Palatino Linotype',  label: 'Palatino Linotype'  },
    { value: 'Garamond',           label: 'Garamond'           },
    { value: 'Book Antiqua',       label: 'Book Antiqua'       },
    { value: 'Courier New',        label: 'Courier New'        },
  ];

  /* ────────────────────────────────────────────────
     TABLE CONFIG GETTERS & SETTERS
  ──────────────────────────────────────────────── */

  /**
   * Kembalikan konfigurasi tabel untuk satu templateId.
   * @param {string} templateId
   * @returns {Object} — { [tableId]: { header: {...}, body: {...} } }
   */
  function getTableConfig(templateId) {
    const id = templateId || _state.activeTemplate;
    if (!id) return {};
    return Utils.deepClone(_state.tables[id] || {});
  }

  /**
   * Set konfigurasi satu tabel dalam template.
   * @param {string} templateId
   * @param {string} tableId     — ID tabel (mis. 'siswa', 'peserta')
   * @param {Object} config      — { header: { columns: {...} }, body: { columns: {...} } }
   */
  function setTableConfig(templateId, tableId, config) {
    const id = templateId || _state.activeTemplate;
    if (!id || !tableId) return;

    if (!_state.tables[id]) _state.tables[id] = {};
    _state.tables[id][tableId] = Utils.deepMerge(
      _state.tables[id][tableId] || {},
      config
    );
    _state.ui.isDirty = true;
    emit('table:change', { templateId: id, tableId, config: Utils.deepClone(_state.tables[id][tableId]) });
    emit('state:change', { field: 'tables' });
  }

  /**
   * Reset konfigurasi tabel ke default (hapus override user).
   * @param {string} templateId
   * @param {string|null} tableId — null = reset semua tabel template ini
   */
  function resetTableConfig(templateId, tableId = null) {
    const id = templateId || _state.activeTemplate;
    if (!id) return;

    if (tableId === null) {
      // Reset seluruh konfigurasi tabel template ini
      delete _state.tables[id];
    } else {
      if (_state.tables[id]) {
        delete _state.tables[id][tableId];
      }
    }
    _state.ui.isDirty = true;
    emit('table:reset', { templateId: id, tableId });
    emit('state:change', { field: 'tables' });
  }

  /**
   * Inisialisasi table config untuk template jika belum ada.
   * Dipakai oleh TableConfigManager saat template pertama kali dipilih.
   * @param {string} templateId
   * @param {Object} defaultConfig — { [tableId]: { header: {...}, body: {...} } }
   */
  function initTableConfig(templateId, defaultConfig) {
    if (!templateId) return;
    if (!_state.tables[templateId]) {
      _state.tables[templateId] = Utils.deepClone(defaultConfig);
      emit('table:init', { templateId });
    }
  }

  /* ── Reset state (setelah data expired atau user reset) ── */
  function reset() {
    _state = {
      activeTemplate: null,
      kop: DEFAULT_KOP_CONFIG(),
      settings: DEFAULT_SETTINGS(),
      forms: {},
      tables: {},
      ui: {
        activeTab: 'template',
        previewZoom: 1,
        isDirty: false,
      },
      storage: {
        lastSavedAt: null,
        expiresAt: null,
        available: _state.storage.available,
      },
    };
    emit('state:reset', {});
    emit('state:change', { field: 'all' });
  }

  /* ── Serialize state untuk penyimpanan (hanya data penting) ── */
  function serialize() {
    return Utils.deepClone({
      activeTemplate: _state.activeTemplate,
      kop:            _state.kop,
      settings:       _state.settings,
      forms:          _state.forms,
      tables:         _state.tables,
    });
  }

  /* ── Restore state dari data tersimpan ── */
  function restore(savedData) {
    if (!savedData) return;
    try {
      if (savedData.activeTemplate !== undefined) {
        _state.activeTemplate = savedData.activeTemplate;
      }
      if (savedData.kop) {
        _state.kop = Utils.deepMerge(DEFAULT_KOP_CONFIG(), savedData.kop);
      }
      if (savedData.settings) {
        _state.settings = _normalizeSettings(savedData.settings);
      }
      if (savedData.forms) {
        _state.forms = Utils.deepClone(savedData.forms);
      }
      if (savedData.tables && typeof savedData.tables === 'object') {
        _state.tables = Utils.deepClone(savedData.tables);
      }
      _state.ui.isDirty = false;
      emit('state:restore', { data: savedData });
      emit('state:change', { field: 'all' });
    } catch (err) {
      console.warn('[State] Gagal restore state:', err);
    }
  }

  /* ── Mark as saved (reset dirty flag) ── */
  function markSaved(storageMeta) {
    _state.ui.isDirty = false;
    if (storageMeta) {
      _state.storage.lastSavedAt = storageMeta.lastSavedAt;
      _state.storage.expiresAt = storageMeta.expiresAt;
    }
    emit('state:saved', { meta: storageMeta });
  }

  /* ── Cek apakah state kotor (ada perubahan belum tersimpan) ── */
  function isDirty() {
    return _state.ui.isDirty;
  }

  /* ── Public API ── */
  return {
    // Getters
    getState,
    getKop,
    getActiveTemplate,
    getFormData,
    getUi,
    getStorageMeta,
    getSettings,
    getPaperDimensions,
    getMarginMm,
    getTypography: () => Utils.deepClone(_state.settings.typography || DEFAULT_SETTINGS().typography),
    getTableConfig,
    isDirty,

    // Setters
    setActiveTemplate,
    setKop,
    setKopRow,
    setKopRowCount,
    setKopLogo,
    setFormData,
    initFormData,
    setUi,
    setActiveTab,
    setZoom,
    setStorageMeta,
    setSettings,
    applyDocumentPreset,
    resetSettings,
    setTableConfig,
    resetTableConfig,
    initTableConfig,

    // State lifecycle
    reset,
    serialize,
    restore,
    markSaved,

    // Events
    on,
    off,
    emit,

    // Default factories & constants (untuk digunakan module lain)
    createDefaultKopRow:    DEFAULT_KOP_ROW,
    createDefaultKop:       DEFAULT_KOP_CONFIG,
    createDefaultSettings:  DEFAULT_SETTINGS,
    PAPER_SIZES,
    MARGIN_PRESETS,
    DOCUMENT_PRESETS,
    DOCUMENT_FONTS,
  };

})();
