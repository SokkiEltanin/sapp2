import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import NumberInput from '@/components/design/NumberInput';
import { useProfileStore } from '@/store/profileStore';
import { openPicker } from '@/services/picker';
import { ageOn } from '@/utils/profile';
import { haptic } from '@/utils/haptics';

// Edycja profilu (2026-11-17) — Ustawienia → Profil i konto. Zapis od razu przy zmianie.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const p = useProfileStore();
  const [name, setName] = useState(p.name);
  useEffect(() => { if (visible) setName(useProfileStore.getState().name); }, [visible]);
  const age = ageOn(p.birthDate);

  const pickBirth = () => openPicker({
    value: p.birthDate ? new Date(`${p.birthDate}T12:00:00`) : new Date(2000, 0, 1),
    mode: 'date', maximumDate: new Date(), title: 'Data urodzenia',
    onChange: (ev, d) => { if (ev.type === 'set' && d) { haptic.tap(); p.setProfile({ birthDate: ymd(d) }); } },
  });

  return (
    <AppBottomSheet visible={visible} onClose={() => { if (name.trim() !== p.name) p.setProfile({ name: name.trim() }); onClose(); }}
      header={<Text style={s.title}>Profil</Text>}>
      <Text style={s.label}>Imię</Text>
      <TextInput value={name} onChangeText={setName} onBlur={() => p.setProfile({ name: name.trim() })} placeholder="Jak masz na imię?" placeholderTextColor={colors.text.muted} style={s.input} />

      <Text style={s.label}>Data urodzenia</Text>
      <TouchableOpacity style={s.dateBtn} onPress={pickBirth} activeOpacity={0.8}>
        <CalendarDays size={16} color={colors.text.secondary} />
        <Text style={[s.dateTxt, !p.birthDate && { color: colors.text.muted }]}>
          {p.birthDate ? `${p.birthDate.slice(8, 10)}.${p.birthDate.slice(5, 7)}.${p.birthDate.slice(0, 4)}${age != null ? ` · ${age} lat` : ''}` : 'wybierz datę'}
        </Text>
      </TouchableOpacity>

      <Text style={s.label}>Wzrost (cm)</Text>
      <NumberInput value={p.heightCm ?? undefined} onChangeValue={(n) => p.setProfile({ heightCm: n && n > 0 ? n : null })} placeholder="np. 180" placeholderTextColor={colors.text.muted} style={s.input} />

      <Text style={s.note}>Urodziny pojawią się w „Najbliższych eventach” na Dashboardzie, a wzrost policzy BMI w panelu Kroki → waga. Dane synchronizują się z komputerem.</Text>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.bright, paddingBottom: spacing[2] },
  label: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[3], marginBottom: spacing[2] },
  input: { borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_700Bold', color: c.text.primary },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 11 },
  dateTxt: { fontSize: 15, fontFamily: 'Inter_700Bold', color: c.text.primary },
  note: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[4] },
}));
