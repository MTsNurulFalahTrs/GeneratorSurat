/* =============================================================
   state.js — Centralized application state management
   =============================================================
   Sumber kebenaran tunggal untuk seluruh state aplikasi.
   State disimpan dalam memori. Storage.js menangani persistensi.
   Setiap perubahan state sebaiknya dilakukan melalui fungsi setter
   di sini agar perubahan dapat dilacak dan disinkronkan ke storage.
*/

const State = (() => {

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
    activeTemplate: null,     // string: 'dpu' | 'mutasi-masuk' | 'siswa-baru' | null

    /* KOP konfigurasi */
    kop: DEFAULT_KOP_CONFIG(),

    /* Data form per-template */
    forms: {},                // { 'dpu': {...}, 'mutasi-masuk': {...}, ... }

    /* UI state */
    ui: {
      activeTab: 'template',  // 'template' | 'kop' | 'form'
      previewZoom: 1,         // scale factor
      isDirty: false,         // ada perubahan belum disimpan
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

  /* ── Reset state (setelah data expired atau user reset) ── */
  function reset() {
    _state = {
      activeTemplate: null,
      kop: DEFAULT_KOP_CONFIG(),
      forms: {},
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
      kop: _state.kop,
      forms: _state.forms,
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
        // Merge dengan default untuk memastikan semua field ada
        _state.kop = Utils.deepMerge(DEFAULT_KOP_CONFIG(), savedData.kop);
      }
      if (savedData.forms) {
        _state.forms = Utils.deepClone(savedData.forms);
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

    // State lifecycle
    reset,
    serialize,
    restore,
    markSaved,

    // Events
    on,
    off,
    emit,

    // Default factories (untuk digunakan module lain)
    createDefaultKopRow: DEFAULT_KOP_ROW,
    createDefaultKop: DEFAULT_KOP_CONFIG,
  };

})();
