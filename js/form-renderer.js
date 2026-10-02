/* =============================================================
   form-renderer.js — Render form input dinamis per template
   ============================================================= */

const FormRenderer = (() => {

  let _containerEl = null;
  const _debounced = new WeakMap();

  /* ── Inisialisasi ── */
  function init() {
    _containerEl = document.getElementById('form-container');
    if (!_containerEl) {
      console.warn('[FormRenderer] Container tidak ditemukan.');
      return;
    }

    // Buat mount point untuk TableConfigUI (accordion Pengaturan Tabel)
    // Mount point ini berada di luar #form-container agar tidak terhapus
    // saat FormRenderer.render() mengosongkan innerHTML #form-container.
    let mountEl = document.getElementById('table-config-mount');
    if (!mountEl) {
      mountEl = document.createElement('div');
      mountEl.id = 'table-config-mount';
      mountEl.setAttribute('hidden', '');
      mountEl.style.display = 'none';
      // Sisipkan tepat setelah #form-container di dalam tab-form
      const tabForm = document.getElementById('tab-form');
      if (tabForm) {
        tabForm.appendChild(mountEl);
      } else {
        // Fallback: sisipkan setelah form-container
        _containerEl.parentNode?.insertBefore(mountEl, _containerEl.nextSibling);
      }
    }

    // Init TableConfigUI dengan mount point
    if (typeof TableConfigUI !== 'undefined') {
      TableConfigUI.init(mountEl);
    }

    State.on('template:change', ({ templateId }) => {
      render(templateId);
    });

    State.on('state:restore', () => {
      const activeId = State.getActiveTemplate();
      if (activeId) render(activeId);
    });

    State.on('state:reset', () => {
      _showEmpty();
    });
  }

  /* ── Render form untuk template tertentu ── */
  function render(templateId) {
    if (!_containerEl) return;

    const tpl = TemplateRegistry.get(templateId);
    if (!tpl) {
      _showEmpty();
      return;
    }

    // Pastikan default form data sudah ada
    const existingData = State.getFormData(templateId);
    if (!existingData) {
      State.initFormData(templateId, tpl.createDefaultData());
    }

    _containerEl.innerHTML = '';

    const formData = State.getFormData(templateId);

    tpl.formSections.forEach(section => {
      const sectionEl = _buildSection(section, formData, templateId);
      _containerEl.appendChild(sectionEl);
    });

    // Init & render accordion Pengaturan Tabel
    // TableConfigManager.initForTemplate dipanggil oleh TableConfigUI.render
    // via state event, tapi panggil juga langsung di sini untuk keamanan
    if (typeof TableConfigManager !== 'undefined') {
      TableConfigManager.initForTemplate(templateId);
    }
    if (typeof TableConfigUI !== 'undefined') {
      TableConfigUI.render(templateId);
    }
  }

  /* ── Tampilkan empty state ── */
  function _showEmpty() {
    if (!_containerEl) return;
    _containerEl.innerHTML = `
      <div class="form-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
        <p>Pilih template surat terlebih dahulu.</p>
        <button class="btn btn--sm btn--secondary"
          onclick="window.App && window.App.switchTab('template')">
          Pilih Template
        </button>
      </div>`;

    // Sembunyikan accordion Pengaturan Tabel
    const mountEl = document.getElementById('table-config-mount');
    if (mountEl) {
      mountEl.setAttribute('hidden', '');
      mountEl.style.display = 'none';
      mountEl.innerHTML = '';
    }
  }

  /* ── Build satu section ── */
  function _buildSection(section, formData, templateId) {
    const wrap = document.createElement('div');
    wrap.className = 'form-section';
    wrap.id = `section-${section.id}`;

    const isRepeatable = section.type === 'repeatable';

    wrap.innerHTML = `
      <div class="form-section__header" role="button" tabindex="0"
        aria-expanded="true" data-section="${section.id}">
        <span class="form-section__title">
          <span>${Utils.escapeHtml(section.icon || '')} ${Utils.escapeHtml(section.title)}</span>
        </span>
        <svg class="form-section__toggle" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="form-section__body" id="section-body-${section.id}"></div>`;

    const header  = wrap.querySelector('.form-section__header');
    const body    = wrap.querySelector('.form-section__body');
    const chevron = wrap.querySelector('.form-section__toggle');

    // Toggle collapse
    header.addEventListener('click', () => {
      const isOpen = !body.classList.contains('collapsed');
      body.classList.toggle('collapsed', isOpen);
      chevron.classList.toggle('collapsed', isOpen);
      header.setAttribute('aria-expanded', String(!isOpen));
    });
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click(); }
    });

    if (isRepeatable) {
      _buildRepeatableSection(section, formData, templateId, body);
    } else {
      _buildFieldsGroup(section.fields, formData, templateId, body, null);
    }

    return wrap;
  }

  /* ── Build repeatable section (daftar siswa/peserta) ── */
  function _buildRepeatableSection(section, formData, templateId, bodyEl) {
    const dataKey   = section.id; // 'peserta' | 'siswa'
    const items     = (formData[dataKey] || []);
    const listEl    = document.createElement('div');
    listEl.id       = `repeatable-list-${section.id}`;

    // Render semua item yang sudah ada
    items.forEach((item, idx) => {
      const entry = _buildRepeatableEntry(section, item, idx, templateId, listEl);
      listEl.appendChild(entry);
    });

    // Tombol tambah
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-row-btn';
    addBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      Tambah ${Utils.escapeHtml(section.itemLabel || 'Item')}`;

    addBtn.addEventListener('click', () => {
      const current = State.getFormData(templateId);
      const currentItems = current[dataKey] || [];
      const newItem = section.itemFactory(currentItems.length + 1);
      const updatedItems = [...currentItems, newItem];

      State.setFormData(templateId, { [dataKey]: updatedItems });

      const entry = _buildRepeatableEntry(
        section, newItem, currentItems.length, templateId, listEl
      );
      listEl.appendChild(entry);

      // Auto expand entry baru
      const body = entry.querySelector('.row-entry__body');
      const chev = entry.querySelector('.row-entry__chevron');
      if (body) { body.classList.add('is-open'); }
      if (chev) { chev.classList.add('is-open'); }

      // Scroll ke bawah
      setTimeout(() => entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    });

    bodyEl.appendChild(listEl);
    bodyEl.appendChild(addBtn);
  }

  /* ── Build satu entry repeatable ── */
  function _buildRepeatableEntry(section, item, idx, templateId, listEl) {
    const entry = document.createElement('div');
    entry.className = 'row-entry';
    entry.dataset.itemId = item.id;

    const labelText = _getItemLabel(section, item, idx);

    entry.innerHTML = `
      <div class="row-entry__header">
        <span class="row-entry__num">${idx + 1}</span>
        <span class="row-entry__label">${Utils.escapeHtml(labelText)}</span>
        <div class="row-entry__actions">
          <button type="button" class="btn-icon entry-delete-btn" title="Hapus" aria-label="Hapus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
        <svg class="row-entry__chevron" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="row-entry__body"></div>`;

    const header    = entry.querySelector('.row-entry__header');
    const body      = entry.querySelector('.row-entry__body');
    const chevron   = entry.querySelector('.row-entry__chevron');
    const deleteBtn = entry.querySelector('.entry-delete-btn');

    // Toggle collapse (klik header, bukan tombol delete)
    header.addEventListener('click', (e) => {
      if (deleteBtn.contains(e.target)) return;
      const isOpen = body.classList.contains('is-open');
      body.classList.toggle('is-open', !isOpen);
      chevron.classList.toggle('is-open', !isOpen);
    });

    // Delete
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.confirm(
        `Hapus ${section.itemLabel || 'Item'} #${idx + 1}`,
        `Yakin ingin menghapus ${section.itemLabel || 'item'} ini?`,
        () => {
          const current = State.getFormData(templateId);
          const dataKey = section.id;
          const newItems = current[dataKey].filter(it => it.id !== item.id);
          State.setFormData(templateId, { [dataKey]: newItems });
          entry.remove();
          // Renumber entries
          _renumberEntries(listEl);
        }
      );
    });

    // Render fields
    _buildFieldsGroup(section.fields, item, templateId, body, item.id, section.id);

    return entry;
  }

  /* ── Build grup fields ── */
  function _buildFieldsGroup(fields, formData, templateId, containerEl, itemId, sectionId) {
    fields.forEach(fieldDef => {
      // showIf condition
      if (fieldDef.showIf && !fieldDef.showIf(formData)) return;

      const group = _buildField(fieldDef, formData, templateId, itemId, sectionId);
      if (group) containerEl.appendChild(group);
    });
  }

  /* ── Build satu field ── */
  function _buildField(fieldDef, formData, templateId, itemId, sectionId) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.dataset.fieldKey = fieldDef.key;

    const value = _getNestedValue(formData, fieldDef.key);
    // Repeatable fields need unique DOM IDs per student item. Duplicate IDs can
    // make label/autofill/DOM targeting point to another field instance.
    const fieldDomId = `field-${fieldDef.key.replace(/\./g, '-')}${itemId ? `-${itemId}` : ''}`;
    const labelHtml = `
      <label class="form-label" for="field-${fieldDef.key.replace(/\./g, '-')}">
        ${Utils.escapeHtml(fieldDef.label)}
        ${fieldDef.required ? '<span class="required-mark" aria-label="wajib">*</span>' : '<span class="optional-mark">(opsional)</span>'}
      </label>`;

    switch (fieldDef.type) {
      case 'text':
        group.innerHTML = labelHtml + `
          <input type="text" class="form-input"
            id="${fieldDomId}"
            value="${Utils.escapeHtml(String(value ?? ''))}"
            placeholder="${Utils.escapeHtml(fieldDef.placeholder || '')}"
            maxlength="${fieldDef.maxLength || 255}"
            ${fieldDef.required ? 'required' : ''} />`;
        _bindInput(group.querySelector('input'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'number':
        group.innerHTML = labelHtml + `
          <input type="number" class="form-input"
            id="${fieldDomId}"
            value="${value ?? ''}"
            min="${fieldDef.min ?? 0}"
            max="${fieldDef.max ?? 9999}"
            ${fieldDef.required ? 'required' : ''} />`;
        _bindInput(group.querySelector('input'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'date':
        group.innerHTML = labelHtml + `
          <input type="date" class="form-input"
            id="${fieldDomId}"
            value="${Utils.escapeHtml(String(value ?? ''))}"
            ${fieldDef.required ? 'required' : ''} />`;
        _bindInput(group.querySelector('input'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'select': {
        const opts = fieldDef.options.map(opt => {
          if (typeof opt === 'string') {
            return `<option value="${Utils.escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>${Utils.escapeHtml(opt)}</option>`;
          }
          return `<option value="${Utils.escapeHtml(opt.value)}" ${value === opt.value ? 'selected' : ''}>${Utils.escapeHtml(opt.label)}</option>`;
        }).join('');
        group.innerHTML = labelHtml + `
          <select class="form-select" id="${fieldDomId}"
            ${fieldDef.required ? 'required' : ''}>${opts}</select>`;
        _bindInput(group.querySelector('select'), fieldDef, templateId, itemId, sectionId);
        break;
      }

      case 'textarea':
        group.innerHTML = labelHtml + `
          <textarea class="form-textarea"
            id="${fieldDomId}"
            placeholder="${Utils.escapeHtml(fieldDef.placeholder || '')}"
            rows="${fieldDef.rows || 3}"
            ${fieldDef.required ? 'required' : ''}>${Utils.escapeHtml(String(value ?? ''))}</textarea>`;
        _bindInput(group.querySelector('textarea'), fieldDef, templateId, itemId, sectionId);
        break;

      case 'checkbox': {
        const checked = value === true || value === 'true';
        group.innerHTML = `
          <label class="form-label">${Utils.escapeHtml(fieldDef.label)}</label>
          <label class="form-check">
            <input type="checkbox" id="${fieldDomId}"
              ${checked ? 'checked' : ''} />
            <span>${checked ? (fieldDef.labelTrue || 'Ya') : (fieldDef.labelFalse || 'Tidak')}</span>
          </label>`;
        const cbInput = group.querySelector('input[type="checkbox"]');
        const cbLabel = group.querySelector('.form-check span');
        cbInput.addEventListener('change', () => {
          const val = cbInput.checked;
          cbLabel.textContent = val ? (fieldDef.labelTrue || 'Ya') : (fieldDef.labelFalse || 'Tidak');
          _saveFieldValue(fieldDef, val, templateId, itemId, sectionId);
        });
        break;
      }

      default:
        return null;
    }

    return group;
  }

  /* ── Bind input event ke state ── */
  function _bindInput(inputEl, fieldDef, templateId, itemId, sectionId) {
    if (!inputEl) return;

    // Buat debounced handler unik per input
    const debSave = Utils.debounce((val) => {
      _saveFieldValue(fieldDef, val, templateId, itemId, sectionId);
    }, 300);

    const eventType = (fieldDef.type === 'select' || fieldDef.type === 'date') ? 'change' : 'input';

    inputEl.addEventListener(eventType, (e) => {
      let val = e.target.value;
      if (fieldDef.type === 'number') val = Utils.safeFloat(val, 0);
      debSave(val);
    });

    // Validasi on blur untuk field required
    if (fieldDef.required) {
      inputEl.addEventListener('blur', () => {
        const v = Validation.required(inputEl.value, fieldDef.label);
        Validation.validateAndShow(inputEl, v);
      });
      inputEl.addEventListener('focus', () => {
        Validation.clearFieldError(inputEl);
      });
    }
  }

  /* ── Simpan nilai field ke State ── */
  function _saveFieldValue(fieldDef, value, templateId, itemId, sectionId) {
    const current = State.getFormData(templateId);
    if (!current) return;

    if (itemId && sectionId) {
      // Field berada di dalam repeatable item
      const items = current[sectionId] || [];
      const itemIdx = items.findIndex(it => it.id === itemId);
      if (itemIdx === -1) return;

      const updatedItem = Utils.deepClone(items[itemIdx]);
      _setNestedValue(updatedItem, fieldDef.key, value);
      const updatedItems = [...items];
      updatedItems[itemIdx] = updatedItem;

      State.setFormData(templateId, { [sectionId]: updatedItems });

      // Kalau ini field 'namaSiswa' atau 'namaSiswa'/'urt', update label entry
      if (['namaSiswa', 'urt', 'indk', 'nama'].some(k => fieldDef.key === k || fieldDef.key.endsWith('.' + k))) {
        const listEl = document.getElementById(`repeatable-list-${sectionId}`);
        if (listEl) {
          const entry = listEl.querySelector(`[data-item-id="${itemId}"]`);
          if (entry) {
            const tpl = TemplateRegistry.get(templateId);
            const updatedData = State.getFormData(templateId);
            const updatedItem2 = (updatedData[sectionId] || []).find(it => it.id === itemId);
            if (updatedItem2 && tpl) {
              const newLabel = _getItemLabel(
                tpl.formSections.find(s => s.id === sectionId),
                updatedItem2,
                itemIdx
              );
              const labelEl = entry.querySelector('.row-entry__label');
              if (labelEl) labelEl.textContent = newLabel;
            }
          }
        }
      }
    } else {
      // Field root level (meta, tandaTangan, dll)
      const update = {};
      _setNestedValue(update, fieldDef.key, value);
      State.setFormData(templateId, update);
    }
  }

  /* ── Helper: ambil nilai nested dari object (misal 'meta.namaMadrasah') ── */
  function _getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    return parts.reduce((cur, key) => {
      if (cur === null || cur === undefined) return undefined;
      return cur[key];
    }, obj);
  }

  /* ── Helper: set nilai nested pada object ── */
  function _setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  /* ── Helper: label untuk entry repeatable ── */
  function _getItemLabel(section, item, idx) {
    if (!section) return `Item ${idx + 1}`;
    const nameSrc = item.namaSiswa || item.nama || '';
    const numSrc  = item.urt || item.nis || (idx + 1);
    if (nameSrc) return `${numSrc}. ${nameSrc}`;
    return `${section.itemLabel || 'Item'} ${numSrc}`;
  }

  /* ── Renumber entries setelah delete ── */
  function _renumberEntries(listEl) {
    if (!listEl) return;
    const entries = listEl.querySelectorAll('.row-entry');
    entries.forEach((entry, idx) => {
      const numEl = entry.querySelector('.row-entry__num');
      if (numEl) numEl.textContent = idx + 1;
    });
  }

  /* ── Public API ── */
  return {
    init,
    render,
  };

})();
