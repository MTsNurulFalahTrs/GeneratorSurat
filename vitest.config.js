import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Aplikasi menggunakan classic browser scripts yang diuji dalam VM Node.
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // Sertakan file yang belum dijalankan tes: coverage 0% harus terlihat,
      // bukan tersembunyi dari laporan. Semua modul internal serta API diukur.
      all: true,
      include: [
        'js/**/*.js',
        'templates/**/*.js',
        'api/**/*.js',
      ],
      exclude: [
        'js/vendor/**',
        '**/*.d.ts',
        'node_modules/**',
        'coverage/**',
        'dist/**',
      ],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
