/* =============================================================
   theme-init.js — CSP-safe early theme bootstrap
   =============================================================
   File ini sengaja dimuat secara blocking di <head> sebelum stylesheet
   untuk mencegah flash tema. Seluruh kode berasal dari same-origin
   external script sehingga kompatibel dengan script-src 'self'.
*/
(function initializeThemeClass() {
  try {
    const theme = localStorage.getItem('ui-theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    }
  } catch {
    // Storage dapat tidak tersedia pada mode privat atau kebijakan browser.
  }
})();
