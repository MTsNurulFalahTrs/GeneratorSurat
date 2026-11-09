# TypeScript checkJs — Quality Gate Tanpa Baseline

## Status setelah pembersihan diagnostik (9 November 2026)

Pemeriksaan TypeScript penuh kini **lulus dengan nol diagnostik**. Sebelumnya terdapat 173 error pada 12 file; semuanya telah diperbaiki tanpa menonaktifkan `checkJs`, menambahkan `@ts-nocheck` massal, atau mempertahankan pengecualian baseline.

```bash
npm ci
npm run check:types
# tsc --project tsconfig.json --noEmit --pretty false
npm run check
# check:syntax + check:types + Vitest
```

`tsconfig.json` tetap memakai `allowJs: true`, `checkJs: true`, dan `noEmit: true`. `npm run check:types` memanggil TypeScript secara **langsung**; exit code selain nol akan menggagalkan quality gate GitHub Actions pada pull request serta push ke `main`.

## Perbaikan tipe

- Tipe resmi Node 22 (`@types/node`) dikunci dalam dependensi pengembangan.
- Deklarasi global skrip klasik untuk seluruh template ditambahkan; API penyimpanan aplikasi dibedakan dari tipe DOM `Storage`.
- Akses kontrol UI menggunakan anotasi DOM (`HTMLInputElement`, `HTMLSelectElement`, `HTMLElement`), dan angka yang dimasukkan ke `value` dikonversi menjadi string.
- Paginasi tabel memvalidasi elemen `tbody` sebelum digunakan.
- Tipe pilihan tema, hasil `FileReader`, debounce, event keyboard, dan dokumentasi JSDoc disesuaikan.

**Tidak ada lagi** `scripts/tsc-baseline.json`, `scripts/check-types.js`, maupun tes baseline transisi. Sebuah error TypeScript apa pun sekarang menggagalkan CI.

## Batasan jaminan

`tsc --noEmit` dengan `strict: false` bukan bukti bahwa seluruh perilaku aplikasi tanpa bug atau bahwa seluruh nilai memiliki tipe eksplisit. Deklarasi global `any` masih ada untuk kompatibilitas migrasi classic scripts, sehingga pemeriksaan bisa diperkuat lebih lanjut secara bertahap.

Pemeriksaan tipe tidak menggantikan pengujian visual halaman, preview paginasi, cetak, dan ekspor PDF pada browser nyata.
