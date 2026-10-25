module.exports = function (api) {
  api.cache(true);
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
    ],
  };
};
