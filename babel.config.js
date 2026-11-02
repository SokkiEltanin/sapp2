module.exports = function (api) {
  const platform = api.caller((caller) => caller && caller.platform);
  api.cache.using(() => platform);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      // reanimated 4.x z nowym architekturem: plugin nie jest potrzebny (ten sam
      // komentarz co w sapp — zostawiony tu z tego samego powodu, nie zgadywany).
      // Tylko web (2026-11-02, DESIGN.md §9 "pętla wizualna" — patrz
      // babel-strip-import-meta.js) — native/Hermes buduje się bez tego.
      platform === 'web' && require.resolve('./babel-strip-import-meta.js'),
    ].filter(Boolean),
  };
};
