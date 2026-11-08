# Generator Surat Madrasah

Aplikasi web untuk membuat surat resmi madrasah secara mudah, cepat, dan profesional. Pengisian formulir, pengelolaan state, dan pembentukan preview berlangsung di browser. Fitur Ekspor PDF mengirimkan HTML/CSS preview ke endpoint serverless Vercel untuk dirender menggunakan Chromium, kemudian mengembalikan file PDF ke browser.

---

## Daftar Isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Struktur Project](#struktur-project)
- [Cara Menjalankan Secara Lokal](#cara-menjalankan-secara-lokal)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Template Surat yang Tersedia](#template-surat-yang-tersedia)
- [Cara Menggunakan Aplikasi](#cara-menggunakan-aplikasi)
- [Sistem Penyimpanan Lokal dan TTL 2 Jam](#sistem-penyimpanan-lokal-dan-ttl-2-jam)
- [Cara Menambahkan Template Surat Baru](#cara-menambahkan-template-surat-baru)
- [Arsitektur Kode](#arsitektur-kode)
- [Catatan Pengembang](#catatan-pengembang)

---

## Fitur

- **8 Template Surat** siap pakai: DPU, Mutasi Masuk, Siswa Baru, serta lima template IJOP
- **Editor KOP Surat** fleksibel — logo kiri (wajib) + logo kanan (opsional), jumlah baris dapat diatur (1–10), setiap baris dapat dikonfigurasi secara individual (font, ukuran, tebal, miring, garis bawah, rata teks, warna, transformasi huruf)
- **Tab Pengaturan** — kontrol penuh atas ukuran kertas, orientasi, margin, skala cetak, dan tampilan preview
- **Live Preview** surat secara real-time dengan kontrol zoom
- **Cetak / Print** langsung dari browser dengan format halaman yang tepat sesuai pengaturan
- **Penyimpanan Lokal** dengan TTL 2 jam sejak pengguna menekan Simpan; data yang belum disimpan tidak otomatis dipersistenkan
- **Ekspor PDF langsung** melalui endpoint serverless Vercel dengan Chromium; HTML/CSS preview dikirim ke server untuk proses rendering
- **Extensible** — template baru dapat ditambahkan tanpa mengubah arsitektur inti
- **Advanced Data Management** — draft bernama tanpa TTL, kelola draft, serta ekspor/impor backup JSON
- **Responsif** — editor dan preview beradaptasi pada desktop, tablet, dan smartphone

---

## Teknologi

| Teknologi | Keterangan |
|-----------|------------|
| HTML5 | Markup semantik |
| CSS3 | Custom Properties, Flexbox, Grid, `@media print` |
| JavaScript Vanilla | ES6+, tidak ada framework |
| localStorage | Penyimpanan data lokal dengan TTL |
| FileReader API | Upload dan baca gambar logo secara lokal |
| Canvas API | Kompresi gambar logo sebelum disimpan |
| `window.print()` | Cetak dokumen dengan `@page` orientation |
| Vercel Functions | Endpoint serverless untuk ekspor PDF |
| `puppeteer-core` + `@sparticuz/chromium` | Render HTML/CSS menjadi PDF pada server |

Frontend menggunakan HTML/CSS/Vanilla JavaScript tanpa framework. Ekspor PDF memakai satu endpoint serverless Vercel; aplikasi tidak menggunakan database server.

---

## Struktur Project

```
/
├── index.html                    # Shell utama aplikasi
├── vercel.json                   # Konfigurasi deploy Vercel
├── README.md                     # Dokumentasi ini
│
├── css/
│   ├── main.css                  # Layout global, CSS Custom Properties, reset
│   ├── components.css            # Komponen UI reusable (button, form, modal, toast, settings)
│   ├── kop-editor.css            # Styling khusus editor KOP Surat
│   ├── preview.css               # Area preview dan rendering dokumen surat
│   ├── print.css                 # @media print — hanya surat yang dicetak
│   └── ui-modern.css              # Layer UI/UX modern, responsive, dan accessibility (screen-only)
│
├── js/
│   ├── utils.js                  # Helper functions (format tanggal, escapeHtml, dll)
│   ├── storage.js                # localStorage wrapper dengan TTL 2 jam
│   ├── state.js                  # Centralized state management + event emitter
│   │                             # (termasuk PAPER_SIZES, MARGIN_PRESETS, DOCUMENT_PRESETS,
│   │                             #  DEFAULT_SETTINGS, getPaperDimensions, getMarginMm)
│   ├── validation.js             # Validasi input form dan konfigurasi KOP
│   ├── template-registry.js      # Registrasi dan manajemen template (extensible)
│   ├── kop-editor.js             # UI Editor KOP Surat (logo, baris teks)
│   ├── form-renderer.js          # Render form input dinamis per template
│   ├── preview-renderer.js       # Render live preview surat (gunakan settings dari state)
│   ├── print.js                  # Logika cetak — @page style dinamis dari settings
│   ├── settings.js               # UI dan logika tab Pengaturan
│   ├── ui.js                     # Toast, Modal, Tabs, Panel Resizer, Storage Info
│   └── app.js                    # Entry point — boot sequence aplikasi
│
├── templates/
│   ├── dpu.js                    # Template: Daftar Peserta Ujian (DPU)
│   ├── mutasi-masuk.js           # Template: Pengesahan Siswa Mutasi Masuk
│   └── siswa-baru.js             # Template: Pengesahan Siswa Baru
│
└── assets/
    └── icons/
        ├── logo.svg              # Logo aplikasi (512×512)
        ├── favicon.svg           # Favicon aplikasi
        └── logo-placeholder.svg  # Ikon placeholder logo KOP
```

---

## Cara Menjalankan Secara Lokal

Karena aplikasi ini adalah static web app murni (HTML + CSS + JS), tidak diperlukan build tool, bundler, atau server Node.js.

**Opsi 1 — Buka langsung di browser:**
```
Buka file index.html langsung di browser Chrome/Firefox/Edge.
```
> Catatan: Beberapa browser membatasi `file://` protocol untuk FileReader API. Gunakan Opsi 2 untuk pengalaman terbaik.

**Opsi 2 — Gunakan live server sederhana:**

Jika menggunakan VS Code:
1. Install ekstensi **Live Server** oleh Ritwick Dey
2. Klik kanan `index.html` → **Open with Live Server**

Atau gunakan Python (jika terinstall):
```bash
# Python 3
python -m http.server 8080

# Lalu buka: http://localhost:8080
```

Atau gunakan Node.js:
```bash
npx serve .
# Lalu buka URL yang ditampilkan
```

---

## Deploy ke Vercel

1. **Push ke GitHub** — Upload seluruh folder project ke repository GitHub.

2. **Import di Vercel:**
   - Buka [vercel.com](https://vercel.com)
   - Klik **Add New → Project**
   - Pilih repository GitHub yang berisi project ini
   - Frontend statis dilayani Vercel dan `api/export-pdf.js` dijalankan sebagai Serverless Function
   - Klik **Deploy**

3. **Selesai.** Tidak ada konfigurasi build tambahan yang diperlukan karena tidak ada bundler atau compiler.

File `vercel.json` sudah dikonfigurasi dengan:
- Security headers (X-Content-Type-Options, X-Frame-Options, dll.)
- Cache control untuk CSS, JS, dan assets
- Clean URLs

---

## Template Surat yang Tersedia

### 1. Daftar Peserta Ujian (DPU)
- **ID:** `dpu`
- **Orientasi:** A4 Landscape
- **Keterangan:** Daftar peserta ujian madrasah dengan data registrasi, NIK, NISN, asal sekolah, dan status terdaftar di EMIS.
- **Kolom:** URT, INDK, NISN, Registrasi, NIK, Nama Siswa, L/P, Tempat Lahir, Tanggal Lahir, Nama Orang Tua, Asal Sekolah, No. Ijazah, Status EMIS (Sudah/Belum/Alasan)
- **Tanda Tangan:** 3 pihak (Katim Kurikulum, Kasi Pendidikan Madrasah, Kepala MTs)

### 2. Daftar Pengesahan Siswa Mutasi Masuk
- **ID:** `mutasi-masuk`
- **Orientasi:** A4 Landscape
- **Keterangan:** Daftar pengesahan siswa baru yang mutasi masuk ke madrasah, beserta data kelas tujuan.
- **Kolom:** No, NIS, NISN, Nama Siswa, L/P, Tempat/Tgl Lahir, Nama Orang Tua, Sekolah Asal, Kelas, No. Ijazah, K.K.R.P.S, No. Pengesahan
- **Tanda Tangan:** 4 pihak (Kasi Penmad, Pengawas, Induk KKM, Kepala Madrasah) + Pengesahan Palembang

### 3. Daftar Pengesahan Siswa Baru
- **ID:** `siswa-baru`
- **Orientasi:** A4 Landscape
- **Keterangan:** Daftar pengesahan siswa baru per tahun ajaran. Kelas tercantum di header, bukan per baris.
- **Kolom:** No, NIS, NISN, Nama Siswa, L/P, Tempat/Tgl Lahir, Nama Orang Tua, Sekolah Asal, No. Ijazah, K.K.R.P.S, No. Pengesahan
- **Tanda Tangan:** 4 pihak + Pengesahan Palembang

---

### 4. IJOP: Surat Permohonan Lembaga
- **ID:** `ijop-permohonan`
- **Orientasi:** A4 Portrait
- **Keterangan:** Permohonan perpanjangan izin operasional RA/Madrasah dari lembaga ke Kantor Kementerian Agama.

### 5. IJOP: SPTJM dari Kepala Satpen
- **ID:** `ijop-sptjm-satpen`
- **Orientasi:** A4 Portrait
- **Keterangan:** Surat Pernyataan Tanggung Jawab Mutlak dari Kepala Satuan Pendidikan.

### 6. IJOP: Rekomendasi Pengawas
- **ID:** `ijop-rekomendasi-pengawas`
- **Orientasi:** A4 Portrait
- **Keterangan:** Rekomendasi perpanjangan izin operasional dari Pengawas Madrasah.

### 7. IJOP: Rekomendasi Kakankemenag
- **ID:** `ijop-rekomendasi-kankemenag`
- **Orientasi:** A4 Portrait
- **Keterangan:** Rekomendasi perpanjangan izin operasional dari Kepala Kantor Kementerian Agama.

### 8. IJOP: SPTJM Kakankemenag
- **ID:** `ijop-sptjm-kankemenag`
- **Orientasi:** A4 Portrait
- **Keterangan:** Surat Pernyataan Tanggung Jawab Mutlak dari Kepala Kantor Kementerian Agama.


## Tab Pengaturan

Tab **Pengaturan** tersedia di panel editor kiri (ikon ⚙️). Semua perubahan langsung memengaruhi preview secara real-time dan diterapkan pada hasil cetak.

### Preset Dokumen

| Preset | Ukuran | Orientasi | Margin |
|--------|--------|-----------|--------|
| A4 Normal | A4 | Portrait | 20/20/25/25 mm |
| A4 Sempit | A4 | Portrait | 12/12/12/12 mm |
| A5 | A5 | Portrait | 15/15/15/15 mm |
| F4 / Folio | F4 | Portrait | 20/20/25/25 mm |
| A4 Landscape | A4 | Landscape | 15/15/20/20 mm |

Setelah preset dipilih dan salah satu nilai diubah manual, status preset otomatis berubah menjadi **Custom**.

### Ukuran Kertas

Tersedia: **A4**, **A5**, **F4/Folio**, **Letter**, **Legal**, dan **Custom**.

Untuk ukuran Custom, masukkan lebar dan tinggi dengan satuan **mm**, **cm**, atau **inch**. Konversi antar satuan dilakukan otomatis.

### Orientasi

**Portrait** atau **Landscape**. Perubahan langsung memperbarui dimensi paper di preview.

### Margin

Atur margin atas, kanan, bawah, dan kiri secara individual (satuan mm, range 0–60 mm). Tersedia 4 preset margin: Default, Normal, Sempit, Lebar.

### Skala Cetak

80%, 85%, 90%, 95%, **100%** (default), 105%, 110%, 115%, 120%, atau Custom (50–150%).

> **Catatan browser**: Skala cetak diupayakan melalui CSS `@page`. Beberapa browser tetap menampilkan dialog cetak mereka sendiri. Nilai yang dikonfigurasi di aplikasi ini adalah rekomendasi — bukan perintah yang dapat memaksa pengaturan printer.

### Tampilan Preview

| Pengaturan | Keterangan |
|------------|------------|
| Zoom Auto | Menyesuaikan otomatis ke viewport |
| Fit Page | Surat penuh terlihat dalam viewport |
| Fit Width | Lebar surat mengisi viewport |
| 100% | Ukuran aktual (1:1) |
| Panduan Margin | Garis biru putus sebagai panduan margin |
| Area Cetak | Highlight area yang akan dicetak |

> **Penting**: Zoom preview HANYA mengubah tampilan di layar. Ukuran dokumen dan margin tidak berubah.

### Pemisahan Preview dan Print

```
Preview zoom 70%  →  Tampilan di layar diperkecil 70%
                      Ukuran dokumen asli tidak berubah

Print scale 90%   →  Hasil cetak 90% dari ukuran dokumen
                      (via @page CSS yang diinjeksi saat cetak)
```

### Alur Pengaturan

```
Tab Pengaturan
    │
    ▼
State.setSettings()  ─── emit 'settings:change'
    │                         │
    ▼                         ▼
State.getPaperDimensions()   PreviewRenderer._renderCurrent()
State.getMarginMm()          (update ukuran & margin preview)
    │
    ▼
Print.printDocument()
└── _applyPageStyle()
    └── @page { size: ...; margin: ... }
        + @media print scale transform
```

---

## Cara Menggunakan Tab Pengaturan

---

## Cara Menggunakan Aplikasi

### Langkah 1 — Pilih Template
- Buka tab **Template** di panel kiri
- Klik template surat yang ingin dibuat
- Aplikasi akan otomatis berpindah ke tab **Isi Surat**

### Langkah 2 — Atur KOP Surat
- Buka tab **KOP Surat**
- Upload **Logo Kiri** (wajib) — klik area upload atau drag & drop gambar
- Aktifkan **Logo Kanan** jika diperlukan, lalu upload gambarnya
- Atur jumlah baris KOP (default: 4 baris, maksimum: 10 baris)
- Klik setiap baris untuk mengatur: teks, font, ukuran (7–22 pt), tebal, miring, garis bawah, rata teks, warna, transformasi huruf
- Preview KOP langsung terlihat di bagian atas panel editor

### Langkah 3 — Isi Data Surat
- Buka tab **Isi Surat**
- Isi bagian **Data Madrasah** (nama, NSM/NPSN, status, tahun pelajaran, dll.)
- Tambahkan data **peserta/siswa** dengan klik tombol **Tambah Peserta/Siswa**
- Setiap peserta/siswa dapat dibuka, diisi, dan dihapus secara individual
- Isi bagian **Tanda Tangan** (nama, jabatan, NIP setiap pihak)

### Langkah 4 — Preview dan Cetak
- Preview surat terlihat secara real-time di panel kanan
- Gunakan tombol **+** / **−** untuk menyesuaikan zoom preview
- Klik **Simpan** di header untuk menyimpan data ke perangkat
- Klik **Cetak** untuk dialog cetak browser atau **Ekspor PDF** untuk membuat file PDF langsung

### Reset Data
- Klik **Reset** di header untuk menghapus semua data dan memulai dari awal
- Konfirmasi akan muncul sebelum data dihapus

---

## Sistem Penyimpanan Lokal, TTL, dan Pemulihan Data

Data surat, pengaturan, dan preview dikelola di browser. Penyimpanan cepat menggunakan `localStorage`; draft bernama dan snapshot pemulihan disimpan terpisah pada perangkat. **Pengecualian penting:** saat pengguna menjalankan Ekspor PDF, HTML dan CSS dari preview (yang dapat berisi data surat dan logo) dikirim ke `api/export-pdf` di Vercel untuk dirender oleh Chromium. Jangan gunakan ekspor PDF untuk data yang tidak boleh diproses oleh server tersebut tanpa persetujuan yang sesuai.

### Mekanisme TTL dan snapshot pemulihan

| Kondisi | Perilaku |
|---------|----------|
| Pengguna refresh atau hard refresh | Data tetap tersedia selama masa TTL belum berakhir |
| Pengguna klik **Simpan** | Penyimpanan cepat diperbarui dan TTL dihitung ulang selama 2 jam |
| Dua jam sejak penyimpanan terakhir | Snapshot terakhir diamankan secara lokal untuk pemulihan hingga 30 hari; dokumen yang sedang terbuka tidak direset |
| Pengguna memilih **Pulihkan Snapshot** | Snapshot ditampilkan setelah konfirmasi dan disimpan kembali sebagai penyimpanan cepat baru |
| Kuota browser tidak cukup untuk membuat arsip | Record lama tidak dihapus atau ditimpa; pengguna diberi peringatan dan dapat menggunakan Export Backup atau draft bernama |
| Pengguna memilih **Reset Data** | Penyimpanan cepat, snapshot pemulihan, dan draft bernama dihapus setelah konfirmasi |

Snapshot pemulihan hanya menyimpan **satu versi terakhir** agar tidak menghabiskan kuota browser. Snapshot tersedia sampai 30 hari sejak diarsipkan. Bila pengguna membuat perubahan yang belum disimpan saat TTL habis, data yang sedang terbuka tetap dipertahankan di memori dan ditandai belum tersimpan; jangan tutup tab sebelum menyimpan atau mengekspor backup.

### Cara menyimpan dan memulihkan

1. Klik **Simpan** untuk membuat penyimpanan cepat dengan TTL dua jam.
2. Gunakan **Simpan Draft** di Data Management untuk menyimpan dokumen bernama yang tidak mengikuti TTL penyimpanan cepat.
3. Saat notifikasi kedaluwarsa muncul, pilih **Pulihkan Snapshot** bila ingin kembali ke data simpan terakhir. Pemulihan menggantikan dokumen yang sedang terbuka setelah konfirmasi.
4. Gunakan **Export Backup** untuk menyimpan salinan JSON di luar browser. File backup dapat berisi data pribadi siswa dan harus diperlakukan sebagai dokumen sensitif.

### Pengamanan endpoint Ekspor PDF

Endpoint `api/export-pdf` hanya menerima origin yang terdaftar secara eksplisit, membatasi ukuran HTML/CSS dan dimensi kertas, membatasi jumlah render paralel, menonaktifkan JavaScript pada halaman Chromium, serta memblokir request jaringan eksternal. CORS dan pemeriksaan origin merupakan perlindungan browser, bukan sistem autentikasi pengguna.

Endpoint membatasi hingga 10 request per IP per 60 detik. Tanpa konfigurasi Redis, limiter lokal tetap berjalan sebagai perlindungan dasar per instance Vercel dan tidak menjamin kuota global lintas-instance. Untuk pembatasan terdistribusi, tambahkan kedua environment variable berikut di Vercel (target Production dan Preview) menggunakan nilai rahasia dari Upstash Redis REST:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Ketika kredensial Redis dikonfigurasi tetapi layanan Redis tidak tersedia, ekspor ditolak sementara (HTTP 503), bukan diam-diam kembali ke limiter lokal. Jangan menaruh token Redis di kode sumber atau file yang dikirim ke browser.

## Cara Menambahkan Template Surat Baru

Sistem template dirancang agar mudah diperluas. Untuk menambahkan template baru, ikuti langkah-langkah berikut:

---

### Langkah 1 — Buat File Definisi Template

Buat file baru di folder `templates/`, misalnya `templates/nama-template.js`.

Setiap template harus mengekspor objek dengan struktur sebagai berikut:

```javascript
const TemplateNamaBaru = (() => {

  // ── 1. ID unik template (harus unik di seluruh aplikasi)
  const TEMPLATE_ID = 'nama-template';

  // ── 2. Metadata template (ditampilkan di UI)
  const meta = {
    id: TEMPLATE_ID,
    name: 'Nama Template yang Ditampilkan',
    description: 'Deskripsi singkat fungsi surat ini.',
    icon: '📄',                    // Emoji sebagai ikon kartu
    orientation: 'landscape',      // 'landscape' atau 'portrait'
    paperSize: 'a4',               // 'a4' (saat ini hanya a4 yang didukung)
    category: 'kategori',          // bebas, untuk pengelompokan
  };

  // ── 3. Default data form (struktur data awal saat template dipilih)
  function createDefaultData() {
    return {
      meta: {
        namaMadrasah: 'MTs Nurul Falah',
        tahun: '2026',
        // ... field lain sesuai kebutuhan template
      },
      // Untuk data berulang (daftar siswa, peserta, dll):
      items: [
        _createItem(),
      ],
      tandaTangan: {
        kota: 'Musi Rawas',
        tahun: '2026',
        pihak1: { jabatan: '', nama: '', nip: '' },
        // ... pihak lain sesuai kebutuhan
      },
    };
  }

  // ── 4. Factory untuk membuat satu item baru dalam daftar berulang
  function _createItem(no = 1) {
    return {
      id: Utils.generateId('item'),   // WAJIB: ID unik untuk setiap item
      nama: '',
      nis: '',
      // ... field lain sesuai kebutuhan
    };
  }

  // ── 5. Definisi seksi-seksi form
  //    Setiap seksi akan menjadi accordion di tab "Isi Surat"
  const formSections = [
    {
      id: 'meta',                     // ID seksi (digunakan sebagai key di formData)
      title: 'Data Madrasah',         // Judul accordion
      icon: '🏫',                     // Emoji ikon
      fields: [
        // Contoh field teks
        {
          key: 'meta.namaMadrasah',   // Dot notation — path di dalam formData
          label: 'Nama Madrasah',
          type: 'text',
          placeholder: 'Contoh: MTs Nurul Falah',
          required: true,
          maxLength: 100,             // opsional
        },
        // Contoh field select
        {
          key: 'meta.status',
          label: 'Status',
          type: 'select',
          options: ['Swasta', 'Negeri'],   // array string atau array {value, label}
          required: true,
        },
        // Contoh field tanggal
        {
          key: 'meta.tanggal',
          label: 'Tanggal',
          type: 'date',
          required: false,
        },
        // Contoh field angka
        {
          key: 'meta.jumlah',
          label: 'Jumlah',
          type: 'number',
          min: 1,
          max: 999,
          required: false,
        },
        // Contoh field checkbox
        {
          key: 'meta.aktif',
          label: 'Status Aktif',
          type: 'checkbox',
          labelTrue: 'Aktif',
          labelFalse: 'Tidak Aktif',
          required: false,
        },
      ],
    },

    // Seksi dengan data berulang (daftar siswa, peserta, dll)
    {
      id: 'items',                    // ID seksi = nama array di formData
      title: 'Daftar Item',
      icon: '👥',
      type: 'repeatable',            // WAJIB: tandai sebagai seksi berulang
      itemLabel: 'Item',             // Label untuk tombol "Tambah ..."
      itemFactory: _createItem,      // Fungsi factory untuk item baru
      fields: [
        // Field di sini akan diaplikasikan per-item dalam array
        {
          key: 'nama',               // Key langsung (tanpa dot) karena sudah di dalam item
          label: 'Nama',
          type: 'text',
          required: true,
        },
        // Contoh field kondisional (hanya tampil jika kondisi terpenuhi)
        {
          key: 'keterangan',
          label: 'Keterangan',
          type: 'text',
          required: false,
          showIf: (item) => item.aktif === false,  // opsional: fungsi kondisi
        },
      ],
    },

    // Seksi tanda tangan
    {
      id: 'tandaTangan',
      title: 'Tanda Tangan',
      icon: '✍️',
      fields: [
        { key: 'tandaTangan.kota',          label: 'Kota',          type: 'text', required: false },
        { key: 'tandaTangan.tahun',         label: 'Tahun',         type: 'text', required: false },
        { key: 'tandaTangan.pihak1.jabatan',label: 'Jabatan',       type: 'text', required: false },
        { key: 'tandaTangan.pihak1.nama',   label: 'Nama',          type: 'text', required: false },
        { key: 'tandaTangan.pihak1.nip',    label: 'NIP',           type: 'text', required: false },
      ],
    },
  ];

  // ── 6. Definisi kolom tabel (untuk preview dan print)
  const tableColumns = [
    { key: 'no',    header: 'No',   width: '8mm',  align: 'center' },
    { key: 'nama',  header: 'Nama', width: '40mm', align: 'left'   },
    // key 'no' adalah kolom otomatis (nomor urut, diisi renderer)
    // key lain = nama field di dalam item
  ];

  // ── Export
  return {
    TEMPLATE_ID,
    meta,
    createDefaultData,
    createItem: _createItem,
    formSections,
    tableColumns,
  };

})();
```

---

### Langkah 2 — Load File di index.html

Tambahkan tag `<script>` di `index.html`, **sebelum** baris `<script src="js/template-registry.js">`:

```html
<!-- Tambahkan baris ini: -->
<script src="templates/nama-template.js"></script>

<!-- Baris ini sudah ada, jangan diubah urutannya: -->
<script src="js/template-registry.js"></script>
```

Pastikan urutan script tetap:
```
utils.js → storage.js → state.js → validation.js
  → [semua file templates/*.js]
  → template-registry.js
  → ui.js → kop-editor.js → form-renderer.js
  → preview-renderer.js → print.js → app.js
```

---

### Langkah 3 — Daftarkan di template-registry.js

Buka `js/template-registry.js`, cari fungsi `init()`, dan tambahkan baris registrasi:

```javascript
function init() {
  if (typeof TemplateDPU !== 'undefined')         register(TemplateDPU);
  if (typeof TemplateMutasiMasuk !== 'undefined') register(TemplateMutasiMasuk);
  if (typeof TemplateSiswaBaru !== 'undefined')   register(TemplateSiswaBaru);

  // ── Tambahkan baris ini untuk template baru:
  if (typeof TemplateNamaBaru !== 'undefined')    register(TemplateNamaBaru);
}
```

---

### Langkah 4 — Tambahkan Renderer di preview-renderer.js

Buka `js/preview-renderer.js`, cari fungsi `_buildDocumentHtml()`, dan tambahkan case untuk template baru:

```javascript
function _buildDocumentHtml(tpl, formData, kop) {
  const id = tpl.TEMPLATE_ID;
  if (id === 'dpu')          return _renderDpu(formData, kop);
  if (id === 'mutasi-masuk') return _renderSiswa(formData, kop, tpl, true);
  if (id === 'siswa-baru')   return _renderSiswa(formData, kop, tpl, false);

  // ── Tambahkan baris ini:
  if (id === 'nama-template') return _renderNamaBaru(formData, kop, tpl);

  return '<div style="padding:20px;color:#666;">Template tidak dikenali.</div>';
}
```

Kemudian buat fungsi `_renderNamaBaru()` di file yang sama:

```javascript
function _renderNamaBaru(data, kop, tpl) {
  const { meta, items = [], tandaTangan: ttd = {} } = data;

  // KOP
  const kopHtml = _buildKopHtml(kop);

  // Info header
  const infoHtml = `
    <div class="doc-meta">
      <table>
        <tr><td>Madrasah</td><td>:</td><td><strong>${_esc(meta.namaMadrasah)}</strong></td></tr>
        <tr><td>Tahun</td><td>:</td><td>${_esc(meta.tahun)}</td></tr>
      </table>
    </div>`;

  // Judul
  const judulHtml = `
    <div class="doc-title-block">
      <h1 class="doc-title">JUDUL SURAT ANDA</h1>
    </div>`;

  // Tabel data
  const cols = tpl.tableColumns;
  const theadCells = cols.map(c =>
    `<th style="width:${c.width};text-align:${c.align};">${_esc(c.header)}</th>`
  ).join('');

  const tbodyRows = items.map((item, i) => {
    const cells = cols.map(c => {
      const val = c.key === 'no' ? String(i + 1) : String(item[c.key] ?? '');
      return `<td style="text-align:${c.align};">${_esc(val)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const tableHtml = `
    <div class="doc-table-wrap">
      <table class="doc-table">
        <thead><tr>${theadCells}</tr></thead>
        <tbody>${tbodyRows}</tbody>
      </table>
    </div>`;

  // Tanda tangan
  const ttdHtml = `
    <div class="doc-ttd-section">
      <div class="doc-ttd-row">
        <div class="doc-ttd-col">
          <p>${_esc(ttd.kota || '')}, ${_esc(ttd.tahun || '')}</p>
          <p class="doc-ttd-col__role">${_esc(ttd.pihak1?.jabatan || '')}</p>
          <div class="doc-ttd-col__space"></div>
          <p class="doc-ttd-col__name">${_esc(ttd.pihak1?.nama || '.............................')}</p>
          <p class="doc-ttd-col__nip">NIP. ${_esc(ttd.pihak1?.nip || '-')}</p>
        </div>
      </div>
    </div>`;

  return `
    <div class="doc-content">
      ${kopHtml}
      <hr class="doc-kop-divider" />
      <hr class="doc-kop-divider-thin" />
      ${infoHtml}
      ${judulHtml}
      ${tableHtml}
      ${ttdHtml}
    </div>`;
}
```

---

### Ringkasan Checklist Menambah Template

```
[ ] 1. Buat file templates/nama-template.js dengan struktur lengkap
[ ] 2. Pastikan TEMPLATE_ID unik
[ ] 3. Isi meta: name, description, icon, orientation, paperSize
[ ] 4. Buat createDefaultData() dengan struktur data yang lengkap
[ ] 5. Buat _createItem() sebagai factory untuk item dalam seksi repeatable
[ ] 6. Definisikan formSections[] dengan field yang sesuai
[ ] 7. Definisikan tableColumns[] sesuai kolom yang ingin ditampilkan
[ ] 8. Tambahkan <script src="templates/nama-template.js"> di index.html
[ ] 9. Daftarkan di TemplateRegistry.init() di js/template-registry.js
[ ] 10. Tambahkan case di _buildDocumentHtml() di js/preview-renderer.js
[ ] 11. Buat fungsi _renderNamaBaru() di js/preview-renderer.js
[ ] 12. Uji coba: pilih template, isi form, cek preview, coba cetak
```

---

### Tipe Field yang Didukung oleh Form Renderer

| `type` | Komponen | Keterangan |
|--------|----------|------------|
| `text` | `<input type="text">` | Teks bebas |
| `number` | `<input type="number">` | Angka dengan `min`, `max` |
| `date` | `<input type="date">` | Pemilih tanggal (ISO format) |
| `select` | `<select>` | Pilihan — `options` berupa array string atau `[{value, label}]` |
| `textarea` | `<textarea>` | Teks panjang dengan `rows` |
| `checkbox` | `<input type="checkbox">` | Toggle dengan `labelTrue`, `labelFalse` |

### Properti Field yang Tersedia

| Properti | Tipe | Wajib | Keterangan |
|----------|------|-------|------------|
| `key` | string | ✅ | Dot-notation path ke data (mis. `meta.namaMadrasah`) |
| `label` | string | ✅ | Label yang ditampilkan |
| `type` | string | ✅ | Tipe input (lihat tabel di atas) |
| `required` | boolean | — | Apakah field wajib diisi |
| `placeholder` | string | — | Teks placeholder |
| `maxLength` | number | — | Batas karakter maksimum |
| `min` / `max` | number | — | Untuk `type: 'number'` |
| `rows` | number | — | Untuk `type: 'textarea'` |
| `options` | array | — | Untuk `type: 'select'` |
| `labelTrue` / `labelFalse` | string | — | Untuk `type: 'checkbox'` |
| `showIf` | function | — | `(item) => boolean` — kondisi tampil |

---

## Arsitektur Kode

### Alur Data

```
User Input
    │
    ▼
FormRenderer ──────► State (setFormData)
KopEditor    ──────► State (setKop)
                          │
                          ├──► Event: 'form:change' / 'kop:change'
                          │
                          ▼
                    PreviewRenderer
                    (render live preview)
                          │
                          ▼
                    #surat-preview (DOM)

User klik Simpan:
    State.serialize() ──► Storage.save() ──► localStorage
    
User klik Cetak:
    Print.printDocument() ──► window.print()
    (UI aplikasi tersembunyi via @media print)
    
Page load berikutnya:
    Storage.load() ──► State.restore() ──► render ulang
```

### Modul Utama

| Modul | Tanggung Jawab |
|-------|----------------|
| `state.js` | Single source of truth — semua data aplikasi termasuk settings |
| `storage.js` | Persistensi ke localStorage + pengecekan TTL |
| `template-registry.js` | Registrasi dan lookup template |
| `kop-editor.js` | UI editor KOP, mengupdate `State.kop` |
| `form-renderer.js` | Render form dinamis, mengupdate `State.forms[templateId]` |
| `preview-renderer.js` | Subscribe event state, render HTML surat dengan dimensi dari `State.getPaperDimensions()` |
| `settings.js` | UI tab Pengaturan, mengupdate `State.settings`, menerapkan overlay preview |
| `print.js` | Injeksi `@page` CSS dari `State.getSettings()`, cetak dokumen |
| `ui.js` | Komponen UI murni (toast, modal, tabs) — tidak punya state sendiri |
| `app.js` | Orchestrator — menginisialisasi semua modul termasuk `Settings.init()` |

### Event System

Modul berkomunikasi melalui event di `State`:

```javascript
// Subscribe
State.on('form:change',     ({ templateId, data }) => { ... });
State.on('kop:change',      ({ kop }) => { ... });
State.on('template:change', ({ templateId }) => { ... });
State.on('settings:change', ({ settings }) => { ... });  // ← baru
State.on('state:restore',   () => { ... });
State.on('state:reset',     () => { ... });

// Emit (dilakukan otomatis oleh setter di State)
State.setFormData(templateId, partialData); // → emit 'form:change'
State.setKop(partial);                      // → emit 'kop:change'
State.setActiveTemplate(templateId);        // → emit 'template:change'
State.setSettings(partial);                 // → emit 'settings:change'
State.applyDocumentPreset(key);             // → emit 'settings:change' + 'settings:presetApplied'
State.resetSettings();                      // → emit 'settings:change' + 'settings:reset'
```

---

## Catatan Pengembang

### Keterbatasan Saat Ini
- Engine dokumen menggunakan HTML/CSS browser sehingga detail hasil cetak dapat sedikit berbeda antar-browser/printer.
- Ukuran gambar logo setelah kompresi diupayakan ≤ 2 MB. Logo dengan resolusi sangat tinggi akan dikompresi otomatis.
- `localStorage` memiliki batas ~5–10 MB tergantung browser. Jika logo berukuran besar, total data bisa mendekati batas. Gunakan logo berformat PNG/SVG dengan resolusi wajar (maks 300×300 px).

### Browser yang Didukung
- Chrome 90+
- Firefox 90+
- Edge 90+
- Safari 14+

### Menambahkan Ukuran Kertas Lain (F4/Folio)

Ukuran kertas A4, A5, F4/Folio, Letter, Legal, dan Custom sudah dihitung terpusat melalui `State.getPaperDimensions()`, sehingga renderer dan print tidak lagi bergantung pada class ukuran kertas khusus.

Di template definition (`meta`):
```javascript
const meta = {
  orientation: 'portrait',
  paperSize: 'folio',   // nilai baru
  ...
};
```

Di `preview-renderer.js` fungsi `render()`:
```javascript
const sizeMap = {
  'a4-portrait':  { w: 210, h: 297 },
  'a4-landscape': { w: 297, h: 210 },
  'folio':        { w: 215, h: 330 },
};
```

---

## Lisensi

Dibuat untuk keperluan internal MTs Nurul Falah, Kabupaten Musi Rawas.
Dapat dimodifikasi dan disesuaikan sesuai kebutuhan madrasah.
