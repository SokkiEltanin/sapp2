import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, RefreshCw, X } from 'lucide-react-native';
import { spacing, radius, themedStyles } from '@/theme';
import { useAppUpdateStore, applyOtaUpdate } from '@/services/appUpdate';

// Mały pasek na górze nad każdym ekranem — tylko gdy jest co zrobić. OTA ma
// pierwszeństwo (szybsze: restart zamiast instalacji APK).
export function UpdateBanner() {
  const s = makeS();
  const insets = useSafeAreaInsets();
  const otaReady = useAppUpdateStore((x) => x.otaReady);
  const apk = useAppUpdateStore((x) => x.apk);
  const dismissed = useAppUpdateStore((x) => x.dismissed);
  if (dismissed || (!otaReady && !apk)) return null;
  const ota = otaReady;
  const onPress = () => {
    if (ota) applyOtaUpdate();
    else if (apk) Linking.openURL(apk.url).catch(() => {});
  };
  return (
    <View pointerEvents="box-none" style={[s.wrap, { top: insets.top + 6 }]}>
      <View style={s.pill}>
        <TouchableOpacity onPress={onPress} style={s.main} accessibilityRole="button">
          {ota ? <RefreshCw size={14} color="#000" /> : <Download size={14} color="#000" />}
          <Text style={s.txt} numberOfLines={1}>
            {ota ? 'Aktualizacja gotowa · Uruchom ponownie' : `Nowy APK #${apk!.build} · Pobierz`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => useAppUpdateStore.setState({ dismissed: true })} hitSlop={10} accessibilityLabel="Ukryj">
          <X size={14} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeS = themedStyles(() => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: '#FFFFFF',
    borderRadius: radius.full, paddingLeft: spacing[3], paddingRight: spacing[3], paddingVertical: spacing[2],
    maxWidth: '92%',
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 },
  txt: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000', flexShrink: 1 },
}));
