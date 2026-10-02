/* =============================================================
   workflow.js — UX Workflow orchestration
   =============================================================
   Menghubungkan navigasi editor, status kesiapan, dan preflight
   cetak tanpa mengubah schema State/Storage maupun renderer dokumen.
   ============================================================= */

const Workflow = (() => {

  const STEPS = [
    { id: 'template', label: 'Template', shortLabel: 'Template', step: 1, next: 'form' },
    { id: 'kop', label: 'KOP Surat', shortLabel: 'KOP', step: 2, next: 'form', previous: 'template' },
    { id: 'form', label: 'Isi Surat', shortLabel: 'Isi Surat', step: 3, next: 'settings', previous: 'kop' },
    { id: 'settings', label: 'Finalisasi', shortLabel: 'Finalisasi', step: 4, previous: 'form' },
  ];

  let _rootEl = null;
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _rootEl = document.getElementById('workflow-actions');
    if (!_rootEl) return;

    _initialized = true;
    _renderShell();
    _bindEvents();
    _ensureTabStatus();
    update();

    State.on('state:change', update);
    State.on('state:restore', update);
    State.on('state:reset', update);
    State.on('template:change', update);
    State.on('kop:change', update);
    State.on('form:change', update);
    State.on('settings:change', update);
  }

  function _renderShell() {
    _rootEl.innerHTML = `
      <div class="workflow-actions__meta">
        <div class="workflow-actions__step" id="workflow-step-label">Langkah 1 dari 4</div>
        <div class="workflow-actions__status" id="workflow-status" aria-live="polite">Pilih template surat untuk memulai.</div>
      </div>
      <div class="workflow-actions__buttons">
        <button type="button" class="btn btn--secondary btn--sm workflow-actions__back" id="workflow-back">
          <span aria-hidden="true">←</span>
          <span>Kembali</span>
        </button>
        <button type="button" class="btn btn--primary btn--sm workflow-actions__next" id="workflow-next">
          <span id="workflow-next-label">Lanjut</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    `;
  }

  function _bindEvents() {
    document.getElementById('workflow-back')?.addEventListener('click', () => {
      const step = _getCurrentStep();
      if (!step.previous) return;
      UI.switchTab(step.previous);
    });

    document.getElementById('workflow-next')?.addEventListener('click', () => {
      const step = _getCurrentStep();
      if (step.id === 'settings') {
        preparePrint();
        return;
      }

      if (step.id === 'template' && !State.getActiveTemplate()) {
        UI.toast('Pilih template surat terlebih dahulu.', 'warning');
        document.getElementById('template-list')
          ?.querySelector('.template-card')
          ?.focus();
        return;
      }

      if (step.next) UI.switchTab(step.next);
    });
  }

  function _ensureTabStatus() {
    const tabs = document.querySelectorAll('.editor-tab');
    tabs.forEach((tab, index) => {
      const step = STEPS[index];
      if (!step) return;
      tab.dataset.workflowStep = String(step.step);

      let status = tab.querySelector('.editor-tab__status');
      if (!status) {
        status = document.createElement('span');
        status.className = 'editor-tab__status';
        status.setAttribute('aria-hidden', 'true');
        tab.appendChild(status);
      }
    });
  }

  function _getCurrentStep() {
    const activeTab = State.getUi().activeTab || 'template';
    return STEPS.find(step => step.id === activeTab) || STEPS[0];
  }

  function _getFormValidation() {
    const templateId = State.getActiveTemplate();
    const formData = templateId ? State.getFormData(templateId) : null;

    if (!templateId || !formData || typeof Validation === 'undefined') {
      return {
        valid: false,
        errors: [{ field: 'form', message: 'Template atau data form belum tersedia.' }],
      };
    }

    if (templateId === 'dpu' && typeof Validation.formDpu === 'function') {
      return Validation.formDpu(formData);
    }

    if ((templateId === 'mutasi-masuk' || templateId === 'siswa-baru')
        && typeof Validation.formSiswa === 'function') {
      return Validation.formSiswa(formData, templateId);
    }

    return { valid: true, errors: [] };
  }

  function _getKopValidation() {
    if (typeof Validation?.kopConfig !== 'function') {
      return { valid: true, errors: [] };
    }
    return Validation.kopConfig(State.getKop());
  }

  function _getStatus(step) {
    if (step.id === 'template') {
      return State.getActiveTemplate()
        ? { state: 'complete', text: 'Template dipilih' }
        : { state: 'attention', text: 'Belum dipilih' };
    }

    if (step.id === 'kop') {
      const check = _getKopValidation();
      return check.valid
        ? { state: 'complete', text: 'KOP siap digunakan' }
        : { state: 'attention', text: `${check.errors.length} perlu diperbaiki` };
    }

    if (step.id === 'form') {
      if (!State.getActiveTemplate()) {
        return { state: 'neutral', text: 'Menunggu template' };
      }
      const check = _getFormValidation();
      return check.valid
        ? { state: 'complete', text: 'Data siap dicetak' }
        : { state: 'attention', text: `${check.errors.length} perlu diperbaiki` };
    }

    return { state: 'neutral', text: 'Periksa sebelum mencetak' };
  }

  function _getFooterStatus(step) {
    const status = _getStatus(step);

    if (step.id === 'template') {
      return State.getActiveTemplate()
        ? 'Template sudah dipilih. Lanjutkan ke pengisian surat.'
        : 'Pilih template surat yang akan dibuat.';
    }

    if (step.id === 'kop') {
      return status.state === 'complete'
        ? 'KOP surat siap. Anda dapat melanjutkan ke Isi Surat.'
        : 'Lengkapi KOP, terutama Logo Kiri yang wajib.';
    }

    if (step.id === 'form') {
      if (!State.getActiveTemplate()) return 'Pilih template terlebih dahulu.';
      return status.state === 'complete'
        ? 'Semua field wajib terisi. Pengaturan dapat disesuaikan sebelum cetak.'
        : `${status.text}. Periksa field yang ditandai sebelum finalisasi.`;
    }

    return 'Sebelum mencetak, aplikasi akan memeriksa KOP dan field wajib.';
  }

  function update() {
    if (!_initialized) return;

    const current = _getCurrentStep();
    const status = _getStatus(current);

    const stepLabel = document.getElementById('workflow-step-label');
    const statusEl = document.getElementById('workflow-status');
    const backBtn = document.getElementById('workflow-back');
    const nextBtn = document.getElementById('workflow-next');
    const nextLabel = document.getElementById('workflow-next-label');

    if (stepLabel) stepLabel.textContent = `Langkah ${current.step} dari ${STEPS.length} · ${current.label}`;
    if (statusEl) {
      statusEl.textContent = _getFooterStatus(current);
      statusEl.dataset.state = status.state;
    }

    if (backBtn) {
      backBtn.hidden = !current.previous;
    }

    if (nextBtn) {
      const isTemplateBlocked = current.id === 'template' && !State.getActiveTemplate();
      nextBtn.disabled = isTemplateBlocked;
      nextBtn.classList.toggle('btn--success', current.id === 'settings' && !isTemplateBlocked);
      nextBtn.classList.toggle('btn--primary', current.id !== 'settings');
      nextBtn.setAttribute(
        'aria-label',
        current.id === 'settings' ? 'Periksa data lalu cetak surat' : `Lanjut ke ${STEPS.find(s => s.id === current.next)?.label || 'langkah berikutnya'}`
      );
    }

    if (nextLabel) {
      if (current.id === 'settings') {
        nextLabel.textContent = 'Periksa & Cetak';
      } else if (current.id === 'template') {
        nextLabel.textContent = 'Ke Isi Surat';
      } else if (current.id === 'kop') {
        nextLabel.textContent = 'Ke Isi Surat';
      } else {
        nextLabel.textContent = 'Ke Finalisasi';
      }
    }

    const tabs = document.querySelectorAll('.editor-tab');
    tabs.forEach((tab, index) => {
      const step = STEPS[index];
      if (!step) return;
      const tabStatus = _getStatus(step);
      tab.classList.toggle('workflow-complete', tabStatus.state === 'complete');
      tab.classList.toggle('workflow-attention', tabStatus.state === 'attention');

      const statusDot = tab.querySelector('.editor-tab__status');
      if (statusDot) {
        statusDot.dataset.state = tabStatus.state;
        statusDot.title = tabStatus.text;
      }
    });
  }

  function _collectPrintChecks() {
    const errors = [];
    const templateId = State.getActiveTemplate();

    if (!templateId) {
      errors.push({
        step: 'template',
        field: 'template',
        message: 'Pilih template surat terlebih dahulu.',
      });
      return errors;
    }

    const kopCheck = _getKopValidation();
    (kopCheck.errors || []).forEach(error => {
      errors.push({
        step: 'kop',
        field: error.field,
        message: error.message,
      });
    });

    const formCheck = _getFormValidation();
    (formCheck.errors || []).forEach(error => {
      errors.push({
        step: 'form',
        field: error.field,
        message: error.message,
      });
    });

    return errors;
  }

  function preparePrint() {
    const errors = _collectPrintChecks();

    if (errors.length === 0) {
      if (typeof Print !== 'undefined' && typeof Print.printDocument === 'function') {
        Print.printDocument();
      }
      return true;
    }

    _showPrintIssues(errors);
    return false;
  }

  function _showPrintIssues(errors) {
    const first = errors[0];
    const previewErrors = errors.slice(0, 6);
    const more = errors.length > previewErrors.length
      ? `<div class="workflow-validation-more">dan ${errors.length - previewErrors.length} masalah lainnya.</div>`
      : '';

    const list = previewErrors.map(error =>
      `<li><strong>${Utils.escapeHtml(error.message)}</strong></li>`
    ).join('');

    UI.showModal({
      title: 'Periksa Sebelum Mencetak',
      body: `
        <div class="workflow-validation">
          <p>Surat belum siap dicetak. Perbaiki bagian berikut terlebih dahulu:</p>
          <ul>${list}</ul>
          ${more}
        </div>`,
      footer: [
        {
          label: 'Perbaiki Sekarang',
          class: 'btn--primary',
          onClick: () => setTimeout(() => _focusError(first), 80),
        },
        {
          label: 'Tutup',
          class: 'btn--secondary',
        },
      ],
    });
  }

  function _focusError(error) {
    if (!error) return;

    if (error.step === 'template') {
      UI.switchTab('template');
      setTimeout(() => {
        document.getElementById('template-list')
          ?.querySelector('.template-card')
          ?.focus();
      }, 60);
      return;
    }

    if (error.step === 'kop') {
      UI.switchTab('kop');
      setTimeout(() => {
        const target = error.field === 'logoLeft'
          ? document.getElementById('logo-file-left')
          : document.getElementById('kop-rows-count');
        if (target) target.focus();
      }, 60);
      return;
    }

    UI.switchTab('form');
    setTimeout(() => {
      const target = _findFormErrorTarget(error.field);
      if (target) {
        _expandFormTarget(target);
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  }

  function _findFormErrorTarget(fieldPath) {
    if (!fieldPath) return null;

    const repeatMatch = fieldPath.match(/^([^\[]+)\[(\d+)\]\.(.+)$/);
    if (repeatMatch) {
      const sectionId = repeatMatch[1];
      const index = Number(repeatMatch[2]);
      const key = repeatMatch[3];
      const list = document.getElementById(`repeatable-list-${sectionId}`);
      const entry = list?.querySelectorAll('.row-entry')?.[index];
      return entry?.querySelector(`[data-field-key="${CSS.escape(key)}"] input, [data-field-key="${CSS.escape(key)}"] select, [data-field-key="${CSS.escape(key)}"] textarea`) || null;
    }

    const directId = `field-${fieldPath.replace(/\./g, '-')}`;
    return document.getElementById(directId)
      || document.querySelector(`[data-field-key="${CSS.escape(fieldPath.split('.').pop())}"] input, [data-field-key="${CSS.escape(fieldPath.split('.').pop())}"] select, [data-field-key="${CSS.escape(fieldPath.split('.').pop())}"] textarea`);
  }

  function _expandFormTarget(target) {
    const section = target.closest('.form-section');
    if (!section) return;

    const body = section.querySelector('.form-section__body');
    const header = section.querySelector('.form-section__header');
    if (body?.classList.contains('collapsed')) {
      header?.click();
    }

    const entry = target.closest('.row-entry');
    if (entry) {
      const entryBody = entry.querySelector('.row-entry__body');
      const entryHeader = entry.querySelector('.row-entry__header');
      if (entryBody && !entryBody.classList.contains('is-open')) {
        entryHeader?.click();
      }
    }
  }

  return {
    init,
    update,
    preparePrint,
  };

})();
