// Mock AsyncStorage w środowisku node — odblokowuje testowanie utili, które importują
// natywny storage (productMemory.ts/merchantMemory.ts/expensesStore.ts). Bez tego sam
// import wywala test. Port 1:1 z sapp (jest.setup.js tam).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
