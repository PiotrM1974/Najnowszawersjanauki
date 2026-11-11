/* Wspólna baza. Matematyka i nowy polski są dołączane osobnymi plikami. */
(function (root) {
  'use strict';
  root.MaleKrokiContent = { categories: [], chapters: [], items: [], books: [], version: 3 };
  if (typeof module !== 'undefined') module.exports = root.MaleKrokiContent;
})(typeof globalThis !== 'undefined' ? globalThis : window);
