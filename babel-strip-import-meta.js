// Tylko dla `expo start --web` (pętla wizualna z DESIGN.md §9, 2026-11-02) — Metro
// na webie (w przeciwieństwie do natywnego Hermes-bundla, który jakoś to toleruje)
// parsuje `import.meta` jako twardy SyntaxError w zwykłym <script> (nie modułowym).
// Źródło: martwa gałąź wewnątrz zustand/middleware's `devtools` (sprawdza
// `import.meta.env.MODE` jako fallback wykrywania Vite) — Metro NIE tree-shake'uje
// nieużywanych eksportów wewnątrz modułu, więc ten kod i tak ląduje w bundlu mimo
// że appka używa WYŁĄCZNIE `persist`, nigdy `devtools`. Zamienia `import.meta` na
// pusty obiekt — ta gałąź i tak nigdy się nie wykonuje w runtime, więc podmiana jest
// bezpieczna; dotyczy tylko web-buildu (patrz babel.config.js, warunek na `platform`).
module.exports = function stripImportMeta() {
  return {
    visitor: {
      MetaProperty(path) {
        path.replaceWithSourceString('({})');
      },
    },
  };
};
