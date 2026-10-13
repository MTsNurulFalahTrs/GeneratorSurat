import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Jalankan test di Node environment (bukan browser)
    // Fungsi murni di utils.js dan validation.js tidak butuh DOM
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['js/utils.js', 'js/validation.js'],
    },
  },
});
