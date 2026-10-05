/* =============================================================
   about.js — Informasi aplikasi, panduan, privasi, S&K, FAQ
   ============================================================= */

const About = (() => {

  const CONSENT_KEY = 'generator-surat-about-consent-v1';

  let _initialized = false;

  const WA_NUMBER = '6283167428682';
  const WA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    'Halo Kak Randi, saya ingin berkonsultasi tentang Generator Surat Madrasah.'
  )}`;

  function _hasAccepted() {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'accepted';
    } catch {
      return false;
    }
  }

  function _saveAcceptance() {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
      return true;
    } catch {
      return false;
    }
  }

  function _section(icon, title, content, open = false) {
    return `
      <details class="about-section" ${open ? 'open' : ''}>
        <summary class="about-section__summary">
          <span class="about-section__icon" aria-hidden="true">${icon}</span>
          <span>${title}</span>
          <span class="about-section__chevron" aria-hidden="true"></span>
        </summary>
        <div class="about-section__body">${content}</div>
      </details>`;
  }

  function _buildBody({ firstVisit = false } = {}) {
    const consentMarkup = firstVisit
      ? `
        <div class="about-consent-box">
          <label class="about-consent">
            <input id="about-consent-checkbox" type="checkbox" />
            <span>
              Saya sudah membaca dan menyetujui <strong>Syarat &amp; Ketentuan penggunaan aplikasi ini</strong>.
            </span>
          </label>
          <p class="about-consent__hint">
            Persetujuan ini hanya disimpan di browser/perangkat Anda untuk mengingat bahwa informasi S&amp;K
            sudah dibaca. Ini bukan akun dan tidak mengirim data surat ke pengembang.
          </p>
        </div>`
      : `
        <div class="about-acknowledged">
          <span class="about-acknowledged__icon" aria-hidden="true">✓</span>
          <span>S&amp;K penggunaan aplikasi telah disetujui pada perangkat ini.</span>
        </div>`;

    return `
      <div class="about-modal-content">

        <div class="about-hero">
          <div class="about-hero__icon" aria-hidden="true">✉️</div>
          <div class="about-hero__main">
            <span class="about-eyebrow">INFORMASI APLIKASI</span>
            <h4 class="about-hero__title">Generator Surat Madrasah</h4>
            <p class="about-hero__desc">
              Aplikasi untuk membantu membuat, mengatur, menyimpan, mencadangkan, dan mencetak
              dokumen surat madrasah melalui browser dengan alur kerja yang sederhana.
            </p>
          </div>
        </div>

        <div class="about-highlights">
          <div class="about-highlight">
            <span class="about-highlight__icon">🔒</span>
            <div>
              <strong>Berbasis perangkat</strong>
              <small>Data surat dikelola di browser pengguna.</small>
            </div>
          </div>
          <div class="about-highlight">
            <span class="about-highlight__icon">💾</span>
            <div>
              <strong>Backup &amp; Draft</strong>
              <small>Data dapat disimpan sebagai draft dan backup JSON.</small>
            </div>
          </div>
          <div class="about-highlight">
            <span class="about-highlight__icon">🖨️</span>
            <div>
              <strong>Siap cetak</strong>
              <small>Preview dirancang mengikuti hasil print/PDF.</small>
            </div>
          </div>
        </div>

        ${_section('ℹ️', 'Tentang Aplikasi', `
          <p>
            <strong>Generator Surat Madrasah</strong> dikembangkan untuk membantu operator, tenaga
            administrasi, dan warga madrasah membuat dokumen secara lebih cepat, rapi, dan konsisten.
          </p>
          <div class="about-contact-card">
            <div class="about-contact-card__title">Pengembang</div>
            <div class="about-contact-grid">
              <span>Nama</span><strong>Randi Pratama, S.Pd.</strong>
              <span>WhatsApp</span><a href="${WA_URL}" target="_blank" rel="noopener noreferrer">0831 6742 8682</a>
              <span>Email</span><a href="mailto:tumtsnurulfalah@gmail.com">tumtsnurulfalah@gmail.com</a>
            </div>
          </div>
          <div class="about-support-grid">
            <div class="about-support-card">
              <span class="about-support-card__icon">💝</span>
              <div>
                <strong>Dukungan &amp; Donasi</strong>
                <p>
                  Pengguna yang ingin mendukung pengembangan aplikasi dapat berdonasi melalui
                  <strong>DANA</strong>, <strong>ShopeePay</strong>, atau <strong>GoPay</strong>.
                  Untuk detail tujuan/nomor donasi, silakan hubungi pengembang melalui WhatsApp.
                </p>
                <a class="about-inline-link" href="${WA_URL}" target="_blank" rel="noopener noreferrer">
                  Hubungi pengembang via WhatsApp →
                </a>
              </div>
            </div>
            <div class="about-support-card">
              <span class="about-support-card__icon">🧩</span>
              <div>
                <strong>Request Template Surat</strong>
                <p>
                  Memiliki format/template surat sendiri yang belum tersedia? Anda dapat meminta
                  format tersebut ditambahkan ke aplikasi dengan menghubungi pengembang via WhatsApp.
                </p>
                <a class="about-inline-link" href="${WA_URL}" target="_blank" rel="noopener noreferrer">
                  Ajukan request template →
                </a>
              </div>
            </div>
          </div>
          <p class="about-note">
            Aplikasi dapat terus dikembangkan berdasarkan kebutuhan administrasi madrasah dan masukan pengguna.
          </p>
        `, true)}

        ${_section('💾', 'Cara Aplikasi Mengelola Data Pengguna', `
          <ol class="about-steps">
            <li><strong>Pemrosesan utama berlangsung di browser.</strong> Data surat yang Anda isi digunakan
              untuk membentuk preview, pengaturan dokumen, dan hasil cetak.</li>
            <li><strong>Penyimpanan cepat menggunakan localStorage.</strong> Data yang disimpan melalui tombol
              <em>Simpan</em> memiliki masa berlaku otomatis <strong>2 jam sejak penyimpanan terakhir</strong>.</li>
            <li><strong>Draft bernama bersifat persisten.</strong> Draft yang dibuat melalui fitur Data Management
              disimpan di perangkat dan tidak mengikuti TTL penyimpanan cepat.</li>
            <li><strong>Backup JSON dapat diekspor.</strong> File backup dapat disimpan oleh pengguna dan
              diimpor kembali melalui fitur Import Backup.</li>
            <li><strong>Data tetap berada pada perangkat kecuali pengguna sendiri membagikannya.</strong>
              Jangan menyalin atau mengunggah file backup ke tempat yang tidak Anda percayai.</li>
          </ol>
          <div class="about-callout about-callout--warning">
            <strong>Penting:</strong> perangkat bersama dapat membuat orang lain yang memiliki akses ke browser
            melihat data yang tersimpan. Gunakan perangkat yang aman dan hapus draft/backup yang tidak diperlukan.
          </div>
        `)}

        ${_section('🧭', 'Tata Cara Penggunaan Aplikasi', `
          <ol class="about-steps about-steps--numbered">
            <li><strong>Pilih Template Surat</strong> yang sesuai.</li>
            <li><strong>Atur KOP Surat</strong> termasuk logo dan teks KOP.</li>
            <li><strong>Isi data surat</strong> pada bagian Isi Surat.</li>
            <li><strong>Atur Pengaturan</strong> seperti ukuran kertas, orientasi, margin, tipografi,
              tabel, dan footer nomor halaman sesuai kebutuhan.</li>
            <li><strong>Periksa Preview Surat</strong> termasuk jumlah halaman dan posisi elemen.</li>
            <li><strong>Simpan</strong> untuk pemulihan cepat atau gunakan <strong>Data Management</strong>
              untuk draft/backup.</li>
            <li><strong>Cetak</strong> atau simpan sebagai PDF setelah hasil preview sesuai.</li>
          </ol>
          <p class="about-note">
            Untuk dokumen yang panjang, selalu periksa setiap halaman pada preview sebelum dicetak.
          </p>
        `)}

        ${_section('🛡️', 'Privasi dan Keamanan Data', `
          <p>
            Privasi pengguna merupakan bagian penting dari penggunaan aplikasi. Pengguna tetap bertanggung
            jawab atas data pribadi yang dimasukkan ke dalam dokumen.
          </p>
          <div class="about-rule-list">
            <div><strong>Minimalkan data.</strong><span>Masukkan hanya data yang memang diperlukan untuk surat.</span></div>
            <div><strong>Amankan perangkat.</strong><span>Gunakan PIN/password perangkat dan browser yang terpercaya.</span></div>
            <div><strong>Hapus data yang tidak diperlukan.</strong><span>Hapus draft atau data lokal sebelum memindahtangankan perangkat.</span></div>
            <div><strong>Jaga backup.</strong><span>File JSON backup dapat berisi data surat dan harus diperlakukan sebagai dokumen sensitif.</span></div>
            <div><strong>Waspadai tautan.</strong><span>Gunakan hanya tautan resmi aplikasi dan kanal pengembang yang tercantum di About.</span></div>
          </div>
          <p class="about-note">
            Fitur aplikasi tidak dimaksudkan sebagai pengganti kebijakan keamanan informasi atau tata kelola data
            resmi milik madrasah/instansi.
          </p>
        `)}

        ${_section('📜', 'Syarat dan Ketentuan', `
          <ol class="about-terms">
            <li>Aplikasi disediakan sebagai alat bantu administrasi dan tidak menjamin bahwa setiap dokumen
              otomatis memenuhi seluruh ketentuan internal atau peraturan instansi.</li>
            <li>Pengguna bertanggung jawab atas kebenaran, kelengkapan, legalitas, dan penggunaan seluruh data
              serta dokumen yang dibuat.</li>
            <li>Pengguna wajib menjaga kerahasiaan data pribadi, data peserta didik, dan dokumen yang dihasilkan.</li>
            <li>Pengguna tidak diperkenankan menggunakan aplikasi untuk tindakan yang melanggar hukum,
              merugikan pihak lain, atau menyalahgunakan data.</li>
            <li>Fitur, template, tata letak, dan mekanisme aplikasi dapat diperbarui untuk perbaikan,
              kompatibilitas, dan kebutuhan administrasi.</li>
            <li>Pengembang tidak bertanggung jawab atas kehilangan data yang timbul karena kerusakan perangkat,
              penghapusan browser, kegagalan penyimpanan lokal, kelalaian pengguna, atau kondisi di luar kendali pengembang.</li>
            <li>Pengguna dianjurkan melakukan pemeriksaan akhir dan menyimpan backup untuk dokumen penting.</li>
            <li>Dengan menggunakan aplikasi, pengguna menyatakan telah membaca dan menyetujui Syarat &amp; Ketentuan ini.</li>
          </ol>
        `)}

        ${_section('❓', 'FAQ (Pertanyaan yang Sering Diajukan)', `
          <div class="about-faq">
            <details><summary>Apakah data surat otomatis dikirim ke pengembang?</summary>
              <p>Data surat digunakan oleh aplikasi di browser untuk pemrosesan dan penyimpanan lokal. Pengguna tetap
                harus berhati-hati saat menggunakan perangkat bersama atau membagikan file backup.</p>
            </details>
            <details><summary>Berapa lama data yang disimpan melalui tombol Simpan bertahan?</summary>
              <p>Penyimpanan cepat menggunakan TTL 2 jam sejak penyimpanan terakhir. Draft bernama pada Data Management
                memiliki mekanisme penyimpanan terpisah dan tidak mengikuti TTL tersebut.</p>
            </details>
            <details><summary>Bagaimana cara menyimpan dokumen lebih lama?</summary>
              <p>Gunakan fitur Draft pada Data Management atau ekspor Backup JSON dan simpan file backup di lokasi yang aman.</p>
            </details>
            <details><summary>Apakah saya dapat meminta template surat baru?</summary>
              <p>Ya. Kirim contoh format/template surat kepada pengembang melalui WhatsApp agar dapat dipertimbangkan
                untuk ditambahkan ke aplikasi.</p>
            </details>
            <details><summary>Bagaimana cara berdonasi?</summary>
              <p>Donasi dapat dilakukan melalui DANA, ShopeePay, atau GoPay. Hubungi pengembang melalui WhatsApp
                untuk mendapatkan detail tujuan donasi.</p>
            </details>
            <details><summary>Apakah hasil preview pasti sama dengan hasil cetak?</summary>
              <p>Aplikasi dirancang agar preview dan print/PDF konsisten, tetapi tetap lakukan pemeriksaan akhir,
                terutama pada printer/browser yang memiliki pengaturan cetak khusus.</p>
            </details>
          </div>
        `)}

        ${consentMarkup}

      </div>`;
  }

  function _show({ firstVisit = false } = {}) {
    UI.showModal({
      title: firstVisit ? 'Selamat Datang di Generator Surat' : 'Tentang / About',
      body: _buildBody({ firstVisit }),
      footer: [
        {
          label: firstVisit ? 'Saya Setuju & Tutup' : 'Tutup',
          class: firstVisit ? 'btn--primary' : 'btn--secondary',
          closeOnClick: true,
          onClick: firstVisit ? () => {
            _saveAcceptance();
          } : undefined,
        },
      ],
      showCloseButton: !firstVisit,
      closeOnBackdrop: !firstVisit,
      closeOnEscape: !firstVisit,
      initialFocusSelector: firstVisit ? '#about-consent-checkbox' : null,
      onClose: () => {
        // Tidak ada aksi tambahan. Saat kunjungan pertama, tombol close
        // hanya bisa diaktifkan setelah checkbox dicentang.
      },
    });

    const modalFooter = document.getElementById('modal-footer');
    const closeBtn = modalFooter?.querySelector('button');
    const consent = document.getElementById('about-consent-checkbox');

    if (firstVisit && closeBtn && consent) {
      closeBtn.disabled = !consent.checked;
      consent.addEventListener('change', () => {
        closeBtn.disabled = !consent.checked;
      });

      // Jaga agar modal pertama tidak dapat ditutup melalui klik luar/ESC.
      // UI.showModal sudah menonaktifkan kedua jalur tersebut.
    }
  }

  function open() {
    _show({ firstVisit: false });
  }

  function _bindButton() {
    const button = document.getElementById('btn-about');
    if (!button) return;
    button.addEventListener('click', open);
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    _bindButton();

    if (!_hasAccepted()) {
      requestAnimationFrame(() => _show({ firstVisit: true }));
    }
  }

  return {
    init,
    open,
  };

})();
