// Lekki runner dla CZYSTEJ logiki (parser paragonów, podział stałe/zmienne/jedzenie,
// fuzzy-matching produktów) — port konfiguracji 1:1 z sapp (jest.config.js tam).
// Środowisko `node` + babel-jest (babel.config.js → babel-preset-expo transpiluje TS,
// module-resolver rozwiązuje alias '@'). Nie testujemy komponentów RN tutaj — tylko
// funkcje dające się sprawdzić deterministycznie.
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: ['node_modules/(?!(date-fns|@react-native-async-storage)/)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
