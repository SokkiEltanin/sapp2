import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { themedStyles } from '@/theme';

// `Tag` — design/app-design.html §Komponenty: "9px/800, warianty: ur (niebieski), fr
// (jasny), jd, dom, ikona dzwonka". `ur` to JEDYNY naprawdę kolorowy (niebieski)
// wariant w całym systemie — niesie realne znaczenie ("Uczelnia/termin akademicki"),
// reszta jest odcieniami szarości (patrz zasada #6 w prompt usera: "Akcenty
// kolorystyczne tylko gdy niosą znaczenie").
export type TagVariant = 'default' | 'ur' | 'fr' | 'jd' | 'alarm';

export default function Tag({ variant = 'default', label }: { variant?: TagVariant; label?: string }) {
  const s = makeS();
  if (variant === 'alarm') {
    return (
      <View style={[s.base, BG.default]}>
        <Bell size={10} color={colors.text.primary} strokeWidth={2.4} />
      </View>
    );
  }
  const v = variant as 'default' | 'ur' | 'fr' | 'jd';
  return (
    <View style={[s.base, BG[v]]}>
      <Text style={[s.label, { color: FG[v] }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  base: {
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, minWidth: 26,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  label: { fontSize: 9, fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.3, color: c.text.primary },
}));

const BG = {
  default: { backgroundColor: colors.ui.in2 },
  ur: { backgroundColor: colors.ui.ur },
  fr: { backgroundColor: colors.text.primary },
  jd: { backgroundColor: '#333333' },
};
const FG = {
  default: colors.text.primary,
  ur: colors.ui.urTxt,
  fr: colors.bg.primary,
  jd: colors.text.primary,
};
