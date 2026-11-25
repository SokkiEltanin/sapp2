// Limit pamięci AsyncStorage na Androidzie (2026-11-25, user: "żeby apka była samowystarczalna na
// długo"). Domyślnie biblioteka ogranicza bazę do ~6 MB — po przekroczeniu zapis po cichu przestaje
// działać (rysunki S-Pen i lata paragonów rosną). gradle.properties `AsyncStorage_db_size_in_MB`
// czyta node_modules/@react-native-async-storage/async-storage/android/config.gradle.
// Duże pojedyncze wartości (>~2 MB, limit CursorWindow przy odczycie) dzieli src/services/safeStorage.ts.
const { withGradleProperties } = require('@expo/config-plugins');

const SIZE_MB = '512';

module.exports = function withAsyncStorageSize(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'AsyncStorage_db_size_in_MB'));
    props.push({ type: 'property', key: 'AsyncStorage_db_size_in_MB', value: SIZE_MB });
    cfg.modResults = props;
    return cfg;
  });
};
