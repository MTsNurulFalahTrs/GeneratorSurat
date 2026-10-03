/* =============================================================
   kop-editor.js — Editor KOP Surat (logo + baris teks)
   ============================================================= */

const KopEditor = (() => {

  const FONT_FAMILIES = [
    'Times New Roman',
    'Arial',
    'Calibri',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Palatino Linotype',
  ];

  const MIN_ROWS = 1;
  const MAX_ROWS = 10;
  const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
  const LOGO_MAX_DIM   = 250;             // px setelah kompresi

  let _rootEl = null;

  /* ── Inisialisasi editor ── */
  function init() {
    _rootEl    = document.getElementById('kop-editor-root');

    if (!_rootEl) {
      console.warn('[KopEditor] Root element tidak ditemukan.');
      return;
    }

    _render();

    // Subscribe state changes
    State.on('kop:change', () => _updateMiniPreview());
    State.on('state:restore', () => {
      _render();
      _updateMiniPreview();
    });
    State.on('state:reset', () => {
      _render();
      _updateMiniPreview();
    });
  }

  /* ── Render seluruh editor ── */
  function _render() {
    if (!_rootEl) return;
    _rootEl.innerHTML = '';

    const kop = State.getKop();

    // 1. Mini preview KOP
    const miniPreviewWrap = _buildMiniPreview(kop);
    _rootEl.appendChild(miniPreviewWrap);

    // 2. Logo section
    const logoSection = _buildLogoSection(kop);
    _rootEl.appendChild(logoSection);

    // 3. Rows count control
    const rowsControl = _buildRowsControl(kop.rows.length);
    _rootEl.appendChild(rowsControl);

    // 4. Rows list
    const rowsList = _buildRowsList(kop.rows);
    _rootEl.appendChild(rowsList);

    _updateMiniPreview();
  }

  /* ── Mini Preview ── */
  function _buildMiniPreview(kop) {
    const wrap = document.createElement('div');
    wrap.className = 'kop-mini-preview';
    wrap.innerHTML = `
      <div class="kop-mini-preview__label">Preview KOP</div>
      <div class="kop-mini-preview__frame">
        <div id="kop-mini-preview-inner"></div>
      </div>`;
    return wrap;
  }

  function _updateMiniPreview() {
    const el = _rootEl && _rootEl.querySelector('#kop-mini-preview-inner');
    if (!el) return;
    const kop = State.getKop();
    el.innerHTML = _renderKopHtml(kop, { scale: 0.55 });
  }

  /* ── Render KOP HTML (dipakai oleh mini-preview dan preview-renderer) ── */
  function _renderKopHtml(kop, options = {}) {
    const { scale = 1 } = options;

    const logoW = Math.round((kop.logoLeft.width || 65) * scale);
    const logoH = Math.round((kop.logoLeft.height || 65) * scale);
    const rLogoW = Math.round(((kop.logoRight && kop.logoRight.width) || 65) * scale);
    const rLogoH = Math.round(((kop.logoRight && kop.logoRight.height) || 65) * scale);

    // Logo kiri
    let logoLeftHtml;
    if (kop.logoLeft && kop.logoLeft.dataUrl) {
      logoLeftHtml = `<img src="${Utils.escapeHtml(kop.logoLeft.dataUrl)}"
        width="${logoW}" height="${logoH}"
        style="object-fit:${kop.logoLeft.objectFit || 'contain'};display:block;"
        alt="Logo kiri" />`;
    } else {
      logoLeftHtml = `<div class="doc-kop__logo--empty" style="width:${logoW}px;height:${logoH}px;font-size:${Math.max(7, 9 * scale)}pt;">Logo<br>Kiri</div>`;
    }

    // Logo kanan (opsional)
    let logoRightHtml = '';
    if (kop.logoRight && kop.logoRight.enabled) {
      if (kop.logoRight.dataUrl) {
        logoRightHtml = `<div class="doc-kop__logo" style="align-items:${_vaToFlex(kop.logoRight.verticalAlign)};">
          <img src="${Utils.escapeHtml(kop.logoRight.dataUrl)}"
            width="${rLogoW}" height="${rLogoH}"
            style="object-fit:${kop.logoRight.objectFit || 'contain'};display:block;"
            alt="Logo kanan" />
        </div>`;
      } else {
        logoRightHtml = `<div class="doc-kop__logo" style="align-items:${_vaToFlex(kop.logoRight.verticalAlign)};">
          <div class="doc-kop__logo--empty" style="width:${rLogoW}px;height:${rLogoH}px;font-size:${Math.max(7, 9 * scale)}pt;">Logo<br>Kanan</div>
        </div>`;
      }
    }

    // Baris teks
    const rowsHtml = kop.rows.map(row => {
      const style = Utils.buildStyleString({
        fontFamily: row.fontFamily,
        fontSize: `${(row.fontSize * scale).toFixed(2)}pt`,
        fontWeight: row.bold ? 'bold' : 'normal',
        fontStyle: row.italic ? 'italic' : 'normal',
        textDecoration: row.underline ? 'underline' : 'none',
        textAlign: row.textAlign,
        lineHeight: row.lineHeight,
        color: row.color,
        letterSpacing: row.letterSpacing ? `${row.letterSpacing}em` : '0',
        textTransform: row.textTransform || 'none',
      });
      const text = Utils.escapeHtml(row.text || '');
      return `<div class="doc-kop__row" style="${style}">${text || '&nbsp;'}</div>`;
    }).join('');

    const vaLeft = _vaToFlex(kop.logoLeft.verticalAlign || 'center');

    return `
      <div class="kop-display" style="padding:${Math.round(6 * scale)}px ${Math.round(10 * scale)}px ${Math.round(4 * scale)}px;">
        <div class="doc-kop__logo" style="align-items:${vaLeft};">
          ${logoLeftHtml}
        </div>
        <div class="doc-kop__text">${rowsHtml}</div>
        ${logoRightHtml}
      </div>`;
  }

  function _vaToFlex(va) {
    const map = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
    return map[va] || 'center';
  }

  /* ── Logo Section ── */
  function _buildLogoSection(kop) {
    const section = document.createElement('div');
    section.className = 'kop-logo-section';

    section.innerHTML = `
      <div class="kop-logo-section__title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Logo KOP Surat
      </div>

      <!-- Logo Toggle Row -->
      <div class="kop-logo-right-toggle">
        <span style="font-size:var(--text-xs);color:var(--color-text-secondary);">Logo kanan (opsional)</span>
        <label class="toggle-switch" title="Aktifkan logo kanan">
          <input type="checkbox" class="toggle-switch__input" id="kop-logo-right-toggle"
            ${kop.logoRight && kop.logoRight.enabled ? 'checked' : ''} />
          <span class="toggle-switch__track"></span>
        </label>
      </div>

      <div class="kop-logo-pair">
        <!-- Logo Kiri -->
        <div class="kop-logo-editor" id="logo-left-editor">
          <div class="kop-logo-editor__label">
            Logo Kiri
            <span class="kop-logo-editor__badge badge badge--danger">Wajib</span>
          </div>
          ${_buildLogoUploadHtml('left', kop.logoLeft)}
        </div>

        <!-- Logo Kanan -->
        <div class="kop-logo-editor kop-logo-right-content${kop.logoRight && kop.logoRight.enabled ? ' enabled' : ''}" id="logo-right-editor">
          <div class="kop-logo-editor__label">
            Logo Kanan
            <span class="kop-logo-editor__badge badge badge--neutral">Opsional</span>
          </div>
          ${_buildLogoUploadHtml('right', kop.logoRight || {})}
        </div>
      </div>`;

    // Bind toggle
    const toggleInput = section.querySelector('#kop-logo-right-toggle');
    const rightContent = section.querySelector('#logo-right-editor');
    toggleInput.addEventListener('change', () => {
      const enabled = toggleInput.checked;
      rightContent.classList.toggle('enabled', enabled);
      State.setKopLogo('right', { enabled });
    });

    // Bind logo uploads
    _bindLogoEditor(section, 'left');
    _bindLogoEditor(section, 'right');

    return section;
  }

  function _buildLogoUploadHtml(side, logoConfig) {
    const hasImage = logoConfig && logoConfig.dataUrl;
    const w = logoConfig && logoConfig.width ? logoConfig.width : 65;
    const h = logoConfig && logoConfig.height ? logoConfig.height : 65;

    return `
      <div class="kop-logo-upload${hasImage ? ' hidden' : ''}" id="logo-upload-${side}">
        <input type="file" accept="image/*" class="kop-logo-upload__input"
          id="logo-file-${side}" aria-label="Pilih logo ${side}" />
        <div class="kop-logo-upload__icon">🖼️</div>
        <div class="kop-logo-upload__text">Klik untuk upload</div>
      </div>

      <div class="kop-logo-preview${hasImage ? ' has-image' : ''}" id="logo-preview-${side}">
        <div class="kop-logo-preview__img-wrap">
          <img class="kop-logo-preview__img" id="logo-img-${side}"
            src="${hasImage ? Utils.escapeHtml(logoConfig.dataUrl) : ''}"
            alt="Logo ${side}" style="max-height:60px;" />
        </div>
        <div class="kop-logo-actions">
          <button class="btn btn--sm btn--secondary" id="logo-change-${side}" title="Ganti logo">Ganti</button>
          <button class="btn btn--sm btn--danger-outline" id="logo-remove-${side}" title="Hapus logo">Hapus</button>
        </div>
        <!-- Ukuran -->
        <div class="kop-logo-size">
          <div class="kop-logo-size__field">
            <span class="kop-logo-size__label">Lebar (px)</span>
            <input type="number" class="kop-logo-size__input" id="logo-w-${side}"
              value="${w}" min="20" max="200" />
          </div>
          <div class="kop-logo-size__field">
            <span class="kop-logo-size__label">Tinggi (px)</span>
            <input type="number" class="kop-logo-size__input" id="logo-h-${side}"
              value="${h}" min="20" max="200" />
          </div>
        </div>
      </div>`;
  }

  function _bindLogoEditor(containerEl, side) {
    const fileInput  = containerEl.querySelector(`#logo-file-${side}`);
    const uploadArea = containerEl.querySelector(`#logo-upload-${side}`);
    const previewArea = containerEl.querySelector(`#logo-preview-${side}`);
    const imgEl      = containerEl.querySelector(`#logo-img-${side}`);
    const changeBtn  = containerEl.querySelector(`#logo-change-${side}`);
    const removeBtn  = containerEl.querySelector(`#logo-remove-${side}`);
    const wInput     = containerEl.querySelector(`#logo-w-${side}`);
    const hInput     = containerEl.querySelector(`#logo-h-${side}`);

    if (!fileInput) return;

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const vResult = Validation.imageFile(file, {
        required: side === 'left',
        maxSize: MAX_LOGO_BYTES,
      });
      if (!vResult.valid) {
        UI.toast(vResult.message, 'error');
        fileInput.value = '';
        return;
      }

      Utils.readFileAsDataUrl(file)
        .then(dataUrl => Utils.compressImage(dataUrl, LOGO_MAX_DIM, LOGO_MAX_DIM, 0.9))
        .then(compressed => {
          const sizeBytes = Utils.base64SizeBytes(compressed);
          if (sizeBytes > MAX_LOGO_BYTES) {
            UI.toast(`Gambar terlalu besar setelah kompresi: ${Utils.formatBytes(sizeBytes)}`, 'warning');
          }
          _applyLogoDataUrl(side, compressed, imgEl, uploadArea, previewArea);
        })
        .catch(err => {
          UI.toast(err.message || 'Gagal memuat gambar.', 'error');
          fileInput.value = '';
        });
    });

    // Change button → trigger file input hidden
    if (changeBtn) {
      changeBtn.addEventListener('click', () => fileInput.click());
    }

    // Remove button
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        if (side === 'left') {
          UI.confirm(
            'Hapus Logo Kiri',
            'Logo kiri wajib ada. Yakin ingin menghapusnya?',
            () => _removeLogo(side, imgEl, uploadArea, previewArea, fileInput)
          );
        } else {
          _removeLogo(side, imgEl, uploadArea, previewArea, fileInput);
        }
      });
    }

    // Width/height inputs
    const debSave = Utils.debounce((which, val) => {
      const n = Utils.safeInt(val, which === 'w' ? 65 : 65);
      const clamped = Utils.clamp(n, 20, 200);
      const partial = which === 'w' ? { width: clamped } : { height: clamped };
      State.setKopLogo(side, partial);
      // Reset input ke clamped value
      if (which === 'w' && wInput) wInput.value = clamped;
      if (which === 'h' && hInput) hInput.value = clamped;
    }, 400);

    if (wInput) wInput.addEventListener('input', (e) => debSave('w', e.target.value));
    if (hInput) hInput.addEventListener('input', (e) => debSave('h', e.target.value));
  }

  function _applyLogoDataUrl(side, dataUrl, imgEl, uploadArea, previewArea) {
    if (imgEl) imgEl.src = dataUrl;
    if (uploadArea) uploadArea.classList.add('hidden');
    if (previewArea) previewArea.classList.add('has-image');
    State.setKopLogo(side, { dataUrl });
  }

  function _removeLogo(side, imgEl, uploadArea, previewArea, fileInput) {
    if (imgEl) imgEl.src = '';
    if (uploadArea) uploadArea.classList.remove('hidden');
    if (previewArea) previewArea.classList.remove('has-image');
    if (fileInput) fileInput.value = '';
    State.setKopLogo(side, { dataUrl: null });
  }

  /* ── Rows Count Control ── */
  function _buildRowsControl(currentCount) {
    const wrap = document.createElement('div');
    wrap.className = 'kop-rows-control';
    wrap.id = 'kop-rows-control';

    wrap.innerHTML = `
      <span class="kop-rows-control__label">Jumlah Baris KOP</span>
      <div class="input-stepper" style="width:110px;">
        <button class="input-stepper__btn" id="kop-rows-dec" type="button"
          aria-label="Kurangi baris">−</button>
        <input type="number" class="input-stepper__input" id="kop-rows-count"
          value="${currentCount}" min="${MIN_ROWS}" max="${MAX_ROWS}"
          aria-label="Jumlah baris KOP" />
        <button class="input-stepper__btn" id="kop-rows-inc" type="button"
          aria-label="Tambah baris">+</button>
      </div>`;

    const decBtn  = wrap.querySelector('#kop-rows-dec');
    const incBtn  = wrap.querySelector('#kop-rows-inc');
    const countIn = wrap.querySelector('#kop-rows-count');

    decBtn.addEventListener('click', () => _changeRowCount(-1, countIn));
    incBtn.addEventListener('click', () => _changeRowCount(+1, countIn));
    countIn.addEventListener('change', () => {
      const val = Utils.safeInt(countIn.value, MIN_ROWS);
      _applyRowCount(val, countIn);
    });

    return wrap;
  }

  function _changeRowCount(delta, inputEl) {
    const kop = State.getKop();
    const newCount = Utils.clamp(kop.rows.length + delta, MIN_ROWS, MAX_ROWS);
    _applyRowCount(newCount, inputEl);
  }

  function _applyRowCount(count, inputEl) {
    const valid = Validation.kopRowCount(count);
    if (!valid.valid) {
      UI.toast(valid.message, 'warning');
      // Reset input
      if (inputEl) inputEl.value = State.getKop().rows.length;
      return;
    }
    State.setKopRowCount(count);
    if (inputEl) inputEl.value = count;
    // Re-render rows list
    _reRenderRowsList();
  }

  function _reRenderRowsList() {
    const kop = State.getKop();
    const existingList = _rootEl && _rootEl.querySelector('#kop-rows-list');
    if (existingList) {
      const newList = _buildRowsList(kop.rows);
      existingList.replaceWith(newList);
    }
    // Sync counter input
    const countIn = _rootEl && _rootEl.querySelector('#kop-rows-count');
    if (countIn) countIn.value = kop.rows.length;
  }

  /* ── Rows List ── */
  function _buildRowsList(rows) {
    const list = document.createElement('div');
    list.className = 'kop-rows-list';
    list.id = 'kop-rows-list';

    rows.forEach((row, idx) => {
      const item = _buildRowItem(row, idx);
      list.appendChild(item);
    });

    return list;
  }

  /* ── Single Row Item ── */
  function _buildRowItem(row, idx) {
    const item = document.createElement('div');
    item.className = 'kop-row-item';
    item.dataset.rowId = row.id;

    const previewText = row.text || `(Baris ${idx + 1} kosong)`;
    const fontOpts = FONT_FAMILIES.map(f =>
      `<option value="${f}" ${row.fontFamily === f ? 'selected' : ''}>${f}</option>`
    ).join('');

    const alignBtns = ['left', 'center', 'right'].map(a => {
      const icon = a === 'left'
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>`
        : a === 'center'
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>`;
      return `<button type="button" class="align-btn${row.textAlign === a ? ' active' : ''}"
        data-align="${a}" title="Rata ${a}">${icon}</button>`;
    }).join('');

    item.innerHTML = `
      <div class="kop-row-item__header">
        <span class="kop-row-item__num">${idx + 1}</span>
        <span class="kop-row-item__preview-text">${Utils.escapeHtml(Utils.truncate(previewText, 45))}</span>
        <svg class="kop-row-item__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="kop-row-item__body">
        <!-- Teks -->
        <div>
          <div class="kop-control-label">Teks</div>
          <input type="text" class="kop-row-item__text-input" data-field="text"
            value="${Utils.escapeHtml(row.text || '')}"
            placeholder="Isi baris ${idx + 1}..." />
        </div>

        <!-- Font Family + Size -->
        <div class="kop-row-item__controls">
          <div>
            <div class="kop-control-label">Font</div>
            <select class="kop-font-select" data-field="fontFamily">${fontOpts}</select>
          </div>
          <div>
            <div class="kop-control-label">Ukuran (pt)</div>
            <div class="input-stepper">
              <button type="button" class="input-stepper__btn" data-action="font-dec">−</button>
              <input type="number" class="input-stepper__input" data-field="fontSize"
                value="${row.fontSize}" min="7" max="22" style="width:42px;" />
              <button type="button" class="input-stepper__btn" data-action="font-inc">+</button>
            </div>
          </div>

          <!-- Style buttons -->
          <div>
            <div class="kop-control-label">Gaya</div>
            <div class="style-toolbar">
              <button type="button" class="style-btn style-btn--bold${row.bold ? ' active' : ''}"
                data-field="bold" title="Tebal (Bold)"><b>B</b></button>
              <button type="button" class="style-btn style-btn--italic${row.italic ? ' active' : ''}"
                data-field="italic" title="Miring (Italic)"><i>I</i></button>
              <button type="button" class="style-btn style-btn--underline${row.underline ? ' active' : ''}"
                data-field="underline" title="Garis bawah"><u>U</u></button>
            </div>
          </div>

          <!-- Alignment -->
          <div>
            <div class="kop-control-label">Rata</div>
            <div class="align-btns">${alignBtns}</div>
          </div>

          <!-- Line Height -->
          <div>
            <div class="kop-control-label">Jarak baris</div>
            <select class="kop-font-select" data-field="lineHeight">
              ${[1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0].map(v =>
                `<option value="${v}" ${parseFloat(row.lineHeight) === v ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>

          <!-- Text Transform -->
          <div>
            <div class="kop-control-label">Transformasi</div>
            <select class="kop-transform-select" data-field="textTransform">
              <option value="none"     ${row.textTransform === 'none'      ? 'selected' : ''}>Normal</option>
              <option value="uppercase"${row.textTransform === 'uppercase' ? 'selected' : ''}>UPPERCASE</option>
              <option value="capitalize"${row.textTransform === 'capitalize'? 'selected' : ''}>Capitalize</option>
              <option value="lowercase"${row.textTransform === 'lowercase' ? 'selected' : ''}>lowercase</option>
            </select>
          </div>

          <!-- Warna teks -->
          <div class="kop-row-item__controls-full">
            <div class="kop-control-label">Warna Teks</div>
            <div class="color-input-wrap">
              <input type="color" data-field="color" value="${row.color || '#000000'}" />
              <input type="text" class="color-hex-input" data-field="color-hex"
                value="${row.color || '#000000'}" maxlength="7" placeholder="#000000" />
            </div>
          </div>
        </div>
      </div>`;

    // ── Bind events ──

    // Toggle open/close — CSS class yang mengontrol display, bukan inline style
    const header = item.querySelector('.kop-row-item__header');
    header.addEventListener('click', () => {
      const isNowOpen = item.classList.toggle('is-open');
      item.querySelector('.kop-row-item__chevron').classList.toggle('is-open', isNowOpen);
    });

    // Buat debounced save untuk field teks
    const debouncedSave = Utils.debounce((field, value) => {
      State.setKopRow(row.id, { [field]: value });
    }, 250);

    // Text input
    const textInput = item.querySelector('[data-field="text"]');
    textInput.addEventListener('input', (e) => {
      // Update preview text di header secara langsung
      const previewSpan = item.querySelector('.kop-row-item__preview-text');
      if (previewSpan) previewSpan.textContent = Utils.truncate(e.target.value || `(Baris ${idx + 1} kosong)`, 45);
      debouncedSave('text', e.target.value);
    });

    // Font family
    item.querySelector('[data-field="fontFamily"]').addEventListener('change', (e) => {
      State.setKopRow(row.id, { fontFamily: e.target.value });
    });

    // Font size stepper
    const fontInput = item.querySelector('[data-field="fontSize"]');
    item.querySelector('[data-action="font-dec"]').addEventListener('click', () => {
      const cur = Utils.safeFloat(fontInput.value, 12);
      const newVal = Utils.clamp(cur - 0.5, 7, 22);
      fontInput.value = newVal;
      State.setKopRow(row.id, { fontSize: newVal });
    });
    item.querySelector('[data-action="font-inc"]').addEventListener('click', () => {
      const cur = Utils.safeFloat(fontInput.value, 12);
      const newVal = Utils.clamp(cur + 0.5, 7, 22);
      fontInput.value = newVal;
      State.setKopRow(row.id, { fontSize: newVal });
    });
    fontInput.addEventListener('change', (e) => {
      const v = Validation.fontSize(e.target.value);
      if (!v.valid) { UI.toast(v.message, 'warning'); e.target.value = row.fontSize; return; }
      const newVal = Utils.clamp(Utils.safeFloat(e.target.value, 12), 7, 22);
      e.target.value = newVal;
      State.setKopRow(row.id, { fontSize: newVal });
    });

    // Bold / Italic / Underline toggles
    item.querySelectorAll('.style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const currentVal = State.getKop().rows.find(r => r.id === row.id)?.[field] ?? false;
        const newVal = !currentVal;
        btn.classList.toggle('active', newVal);
        State.setKopRow(row.id, { [field]: newVal });
      });
    });

    // Alignment buttons
    item.querySelectorAll('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        item.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.setKopRow(row.id, { textAlign: btn.dataset.align });
      });
    });

    // Line height
    item.querySelector('[data-field="lineHeight"]').addEventListener('change', (e) => {
      State.setKopRow(row.id, { lineHeight: parseFloat(e.target.value) });
    });

    // Text transform
    item.querySelector('[data-field="textTransform"]').addEventListener('change', (e) => {
      State.setKopRow(row.id, { textTransform: e.target.value });
    });

    // Color picker
    const colorPicker = item.querySelector('[data-field="color"]');
    const colorHex    = item.querySelector('[data-field="color-hex"]');

    colorPicker.addEventListener('input', (e) => {
      colorHex.value = e.target.value;
      debouncedSave('color', e.target.value);
    });

    colorHex.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        colorPicker.value = val;
        debouncedSave('color', val);
      }
    });

    return item;
  }

  /* ── Public: render KOP HTML (dipanggil oleh preview-renderer) ── */
  function renderKopHtml(kop) {
    return _renderKopHtml(kop, { scale: 1 });
  }

  /* ── Public API ── */
  return {
    init,
    renderKopHtml,
  };

})();
