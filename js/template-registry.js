/* =============================================================
   template-registry.js — Registrasi dan manajemen template surat
   =============================================================
   Sistem ini bersifat extensible: untuk menambah template baru,
   cukup buat file definisi di /templates/ lalu daftarkan di sini
   dengan memanggil TemplateRegistry.register(templateObject).
*/

const TemplateRegistry = (() => {

  /* ── Penyimpanan template ── */
  const _templates = new Map();

  /* ── Register template ── */
  function register(templateDef) {
    if (!templateDef || !templateDef.TEMPLATE_ID) {
      console.warn('[TemplateRegistry] Template tidak valid:', templateDef);
      return;
    }
    if (_templates.has(templateDef.TEMPLATE_ID)) {
      console.warn(`[TemplateRegistry] Template "${templateDef.TEMPLATE_ID}" sudah terdaftar, menimpa.`);
    }
    _templates.set(templateDef.TEMPLATE_ID, templateDef);
    console.info(`[TemplateRegistry] Template "${templateDef.TEMPLATE_ID}" terdaftar.`);
  }

  /* ── Ambil template berdasarkan ID ── */
  function get(templateId) {
    const tpl = _templates.get(templateId);
    if (!tpl) {
      console.warn(`[TemplateRegistry] Template "${templateId}" tidak ditemukan.`);
      return null;
    }
    return tpl;
  }

  /* ── Ambil semua template ── */
  function getAll() {
    return Array.from(_templates.values());
  }

  /* ── Jumlah template terdaftar ── */
  function count() {
    return _templates.size;
  }

  /* ── Render daftar template sebagai kartu UI ── */
  function renderTemplateList(containerEl, activeTemplateId, onSelect) {
    if (!containerEl) return;

    containerEl.innerHTML = '';
    const templates = getAll();

    if (templates.length === 0) {
      containerEl.innerHTML = `
        <div class="form-empty-state">
          <p>Tidak ada template tersedia.</p>
        </div>`;
      return;
    }

    templates.forEach(tpl => {
      const isActive = tpl.TEMPLATE_ID === activeTemplateId;
      const card = document.createElement('div');
      card.className = `template-card${isActive ? ' active' : ''}`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      card.dataset.templateId = tpl.TEMPLATE_ID;

      const orientLabel = tpl.meta.orientation === 'landscape' ? 'A4 Landscape' : 'A4 Portrait';

      card.innerHTML = `
        <div class="template-card__icon">${Utils.escapeHtml(tpl.meta.icon || '📄')}</div>
        <div class="template-card__name">${Utils.escapeHtml(tpl.meta.name)}</div>
        <div class="template-card__desc">${Utils.escapeHtml(tpl.meta.description)}</div>
        <span class="template-card__badge">${orientLabel}</span>
      `;

      card.addEventListener('click', () => {
        if (typeof onSelect === 'function') onSelect(tpl.TEMPLATE_ID);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (typeof onSelect === 'function') onSelect(tpl.TEMPLATE_ID);
        }
      });

      containerEl.appendChild(card);
    });
  }

  /* ── Update active state kartu ── */
  function updateActiveCard(containerEl, activeTemplateId) {
    if (!containerEl) return;
    const cards = containerEl.querySelectorAll('.template-card');
    cards.forEach(card => {
      const isActive = card.dataset.templateId === activeTemplateId;
      card.classList.toggle('active', isActive);
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /* ── Cek apakah template memiliki tabel ── */
  function templateHasTables(templateId) {
    const tpl = _templates.get(templateId);
    if (!tpl) return false;
    // Template dianggap punya tabel jika ada tableColumns atau tables array
    if (Array.isArray(tpl.tableColumns) && tpl.tableColumns.length > 0) return true;
    if (Array.isArray(tpl.tables) && tpl.tables.length > 0) return true;
    return false;
  }

  /**
   * Kembalikan definisi semua tabel yang ada di template.
   * Mendukung dua format:
   *   1. Legacy: template.tableColumns (single table)
   *   2. Multi-table: template.tables = [{ id, label, columns }]
   *
   * Selalu return array: [{ id, label, columns }]
   */
  function getTableDefinitions(templateId) {
    const tpl = _templates.get(templateId);
    if (!tpl) return [];

    // Format baru: multi-table
    if (Array.isArray(tpl.tables) && tpl.tables.length > 0) {
      return tpl.tables.map(t => ({
        id:      t.id      || 'table-0',
        label:   t.label   || 'Tabel',
        columns: Array.isArray(t.columns) ? t.columns : [],
        tableDefaultConfig: t.tableDefaultConfig || null,
      }));
    }

    // Format legacy: single tableColumns → dibungkus jadi satu tabel
    if (Array.isArray(tpl.tableColumns) && tpl.tableColumns.length > 0) {
      // Gunakan template ID sebagai table ID agar stabil
      return [{
        id:      templateId,
        label:   tpl.meta?.name || 'Tabel Utama',
        columns: tpl.tableColumns,
        tableDefaultConfig: tpl.tableDefaultConfig || null,
      }];
    }

    return [];
  }

  /* ── Inisialisasi: daftarkan semua template yang sudah di-load ── */
  function init() {
    // Template didefinisikan di file terpisah dan sudah di-load sebelum registry
    // Urutkan sesuai urutan yang diinginkan di UI

    if (typeof TemplateDPU !== 'undefined') {
      register(TemplateDPU);
    }
    if (typeof TemplateMutasiMasuk !== 'undefined') {
      register(TemplateMutasiMasuk);
    }
    if (typeof TemplateSiswaBaru !== 'undefined') {
      register(TemplateSiswaBaru);
    }

    /*
     * ── CARA MENAMBAH TEMPLATE BARU ──
     * 1. Buat file baru di /templates/nama-template.js
     * 2. Ekspor objek dengan struktur {TEMPLATE_ID, meta, createDefaultData, createItem, formSections, tableColumns}
     * 3. Load file tersebut di index.html sebelum <script src="js/template-registry.js">
     * 4. Tambahkan baris di bawah ini:
     *    if (typeof TemplateNamaBaru !== 'undefined') register(TemplateNamaBaru);
     */

    console.info(`[TemplateRegistry] ${count()} template terdaftar.`);
  }

  /* ── Public API ── */
  return {
    register,
    get,
    getAll,
    count,
    renderTemplateList,
    updateActiveCard,
    templateHasTables,
    getTableDefinitions,
    init,
  };

})();
