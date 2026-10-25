import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Settings } from 'lucide-react-native';
import PlaceholderScreen from '@/components/ui/PlaceholderScreen';
import { spacing, radius, themedStyles } from '@/theme';

// Tymczasowa ikonka Ustawień (prawy górny róg) — Settings docelowo nie będzie osobną
// zakładką, ale na razie to jedyne wejście żeby przetestować logowanie Google/Firebase/
// Calendar. Zniknie/przeniesie się jak zaprojektujemy prawdziwy dashboard.
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const s = makeS();
  return (
    <View style={{ flex: 1 }}>
      <PlaceholderScreen
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Wszystko na jeden rzut oka — bez scrolla, jak ustaliliśmy."
        accent="#6C9EFF"
      />
      <TouchableOpacity
        onPress={() => router.push('/settings' as any)}
        style={[s.gear, { top: insets.top + spacing[2] }]}
      >
        <Settings size={18} color="#A7ADBD" />
      </TouchableOpacity>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  gear: {
    position: 'absolute', right: spacing[3], width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
}));
