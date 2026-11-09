# GS-006 — Cakupan kode (code coverage)

## Konfigurasi

Pengukuran Vitest memakai provider V8 dengan `coverage.all: true` dan cakupan:

- `js/**/*.js`: modul browser utama (State, Storage, editor, workflow, rendering, PDF client, PWA)
- `templates/**/*.js`: definisi seluruh template
- `api/**/*.js`: endpoint PDF dan helper keamanan

Paket vendor `js/vendor/**`, file `*.d.ts`, dependensi, dan artefak build dikecualikan. Menjalankan `npm run test:coverage` membuat laporan teks, HTML, LCOV, dan `coverage/coverage-summary.json`. Workflow GitHub Actions menyimpan laporan sebagai artefak **generator-surat-coverage** selama 14 hari.

## Baseline awal — 9 November 2026

Sumber: [GitHub Actions run #42567765491](https://github.com/MTsNurulFalahTrs/GeneratorSurat/actions/runs/42567765491).

| Metrik | Total |
| --- | ---: |
| Statements | 1,74% |
| Branches | 3,10% |
| Functions | 1,39% |
| Lines | 1,84% |
| API `export-pdf-security.js` — statements | 77,07% |
| API `export-pdf-security.js` — lines | 82,35% |
| Frontend `js/**` — dilaporkan | 0% |
| Template `templates/**` — dilaporkan | 0% |

### Penting: keterbatasan instrumentasi

**Angka 0% pada modul frontend dan template bukan bukti bahwa seluruh modul tersebut belum diuji.** Sebagian besar test aplikasi memuat classic scripts menggunakan `readFileSync` dan `runInNewContext`/`vm.runInContext`. Pada konfigurasi Vitest V8 saat ini, eksekusi melalui konteks VM tersebut tidak tercatat pada peta coverage file sumber. Akibatnya, laporan saat ini dapat membedakan kode yang terukur secara langsung dan file yang belum *terinstrumentasi*, tetapi **belum dapat digunakan untuk menyatakan cakupan perilaku seluruh frontend**.

Perintah `npm test` tetap memeriksa perilaku yang diuji dalam VM. Sebagai contoh, pengujian registrasi sepuluh template dan paginasi seluruh template berjalan, meskipun angka coverage `templates/**` dan `js/preview-renderer.js` masih 0%. Jangan memakai persentase total tersebut untuk mengevaluasi efektivitas test frontend tanpa memperbaiki instrumentasi.

## Langkah berikutnya (di luar GS-006)

1. Tambahkan jalur instrumentasi untuk classic scripts yang dieksekusi dalam VM (misalnya mentransformasi sumber yang dimuat pada harness ke versi terinstrumentasi) atau ekstrak logika bisnis murni menjadi modul yang diimpor langsung oleh Vitest tanpa mengubah perilaku aplikasi.
2. Perluas tes unit terinstrumentasi untuk State, Storage, Validation, TemplateRegistry, pagination, dan API.
3. Jalankan ulang `npm run test:coverage`, bandingkan baseline per-modul, dan barulah tetapkan ambang minimum yang realistis di CI.
4. Tambahkan tes browser untuk ketepatan layout fisik, overflow, cetak, dan ekspor PDF; coverage unit bukan pengganti UAT visual.

Tidak ada ambang persentase wajib yang ditetapkan pada GS-006 karena baseline VM belum merepresentasikan eksekusi frontend. **Status CI success berarti pengujian dan proses pembuatan laporan berhasil, bukan berarti coverage tinggi.**
