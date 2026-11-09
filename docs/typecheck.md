# GS-007 — TypeScript `checkJs` quality gate

## Tujuan dan implementasi

`tsconfig.json` sudah memuat `allowJs: true`, `checkJs: true`, dan `noEmit: true`. Pada tahap GS-007, TypeScript **5.8.3 dipasang dan dikunci** pada `package.json` serta `package-lock.json`.

Perintah yang tersedia:

- `npm run check:types`: menjalankan `tsc --noEmit` dan **gagal bila ada diagnostik baru** relatif terhadap baseline terkontrol.
- `npm run check:types:raw`: menjalankan **pemeriksaan penuh tanpa baseline** untuk melihat semua error yang masih ada (exit code tetap gagal selama ada error).
- `npm run check`: syntax → type gate → unit/integration tests.

GitHub Actions `Quality Checks` sudah memanggil `npm run check` pada PR menuju `main` dan setiap push ke `main`. Karena itu type gate sekarang wajib untuk lulus job ini.

## Mengapa memakai baseline bertahap?

Pada pemeriksaan pertama TypeScript mengeluarkan **173 diagnostik lama** dari 12 file sumber, termasuk masalah DOM selector yang terlalu luas, deklarasi global untuk skrip klasik, referensi Node.js yang memerlukan tipe Node, JSDoc, dan kemungkinan nilai null.

Diagnostik ini ada **sebelum GS-007** dan sebelumnya tidak pernah dijalankan sebagai gate. Mengaktifkan perintah mentah langsung akan membuat seluruh CI gagal, tanpa pemisahan error baru dan error warisan.

Sebagai tahap transisi yang transparan:

1. `scripts/tsc-baseline.json` menyimpan 53 *signature* diagnostik lama (file, kode TS, teks diagnostik, dan jumlah kemunculan), total 173 error.
2. `scripts/check-types.js` tetap menjalankan **TypeScript penuh** untuk seluruh file sesuai `tsconfig.json` (tidak menyetel `checkJs: false`, tidak memakai `@ts-nocheck` massal).
3. Bila ada kode TS baru, file baru, pesan tipe baru, atau jumlah suatu signature meningkat di atas baseline, pemeriksaan gagal.
4. Jika error lama diperbaiki, penurunan jumlahnya diperbolehkan. Baseline sebaiknya diperkecil melalui PR yang ditinjau.
5. Posisi baris tidak menjadi bagian signature sehingga pemindahan kode yang tidak mengubah diagnostik tidak mengakibatkan kegagalan palsu.

**Batasan yang harus dipahami:** GS-007 **belum** membuat `npm run check:types:raw` bersih. Status `success` pada CI berarti **tidak ada error tipe baru di luar baseline**, bukan berarti semua kode bebas error TypeScript.

## Urutan penyelesaian legacy diagnostics

Rekomendasi pekerjaan lanjutan:

1. Tambahkan `@types/node` yang sesuai Node.js 22, lalu kurangi error `process`, `Buffer`, dan modul `node:*`.
2. Perbaiki deklarasi global/konfigurasi `moduleDetection` untuk browser classic scripts termasuk `TemplateDPU`, `TemplateSuratIzin`, dan objek custom `Storage` yang bentrok dengan DOM Storage.
3. Perbaiki JSDoc serta anotasi tipe DOM pada `settings.js`, `ui.js`, `workflow.js`, dan `preview-renderer.js` dengan `HTMLInputElement`, `HTMLElement`, `KeyboardEvent`, dan null checks tepat.
4. Validasi semua perubahan melalui unit/integration tests dan `npm run check:types:raw` untuk mengurangi baseline.
5. Ketika jumlah error TypeScript mentah = **0**, hapus baseline dan ubah `npm run check:types` menjadi `tsc --noEmit` langsung; pertahankan sebagai CI gate.

## Pengujian gate

`tests/typescript-gate.test.js` memverifikasi:

- Parsing diagnostik sumber dan konfigurasi.
- Penolakan signature baru maupun kenaikan jumlah error.
- Ketahanan terhadap perubahan posisi baris.

Jangan memperbarui baseline secara otomatis saat CI gagal, karena dapat menyembunyikan regresi baru.
