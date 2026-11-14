import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Trash2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useErrorLog, clearErrorLog } from '@/services/errorLog';
import { formatErrorLog, entryTime } from '@/utils/errorLog';
import { haptic } from '@/utils/haptics';

// Dziennik błędów (Ustawienia → Diagnostyka). "Kopiuj" = cały tekst ze stosem do
// wklejenia w czat/zgłoszenie; wpis stuknięty rozwija stos.
export default function ErrorLogSheet({ visible, onClose, header }: { visible: boolean; onClose: () => void; header: string }) {
  const s = makeS();
  const entries = useErrorLog((x) => x.entries);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(formatErrorLog(entries, header));
    haptic.tap();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.9} header={<Text style={s.title}>Dziennik błędów</Text>}
      footer={entries.length > 0 ? (
        <View style={s.btns}>
          <TouchableOpacity style={[s.btn, s.btnMain]} onPress={copy}>
            <Copy size={15} color={colors.bg.primary} />
            <Text style={[s.btnLabel, s.btnLabelMain]}>{copied ? 'Skopiowano' : 'Kopiuj wszystko'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} onPress={() => { haptic.tap(); clearErrorLog(); }}>
            <Trash2 size={15} color={colors.text.secondary} />
            <Text style={s.btnLabel}>Wyczyść</Text>
          </TouchableOpacity>
        </View>
      ) : undefined}>
      {entries.length === 0 ? (
        <Text style={s.empty}>Pusto — od ostatniego czyszczenia nic się nie wywaliło.</Text>
      ) : entries.map((e, i) => (
        <TouchableOpacity key={`${e.t}-${i}`} style={s.row} activeOpacity={0.7} onPress={() => setOpen(open === i ? null : i)}>
          <View style={s.rowHead}>
            <Text style={s.where}>{e.where}{e.n && e.n > 1 ? ` ×${e.n}` : ''}</Text>
            <Text style={s.time}>{entryTime(e.t)}</Text>
          </View>
          <Text style={s.msg} numberOfLines={open === i ? undefined : 2}>{e.msg}</Text>
          {open === i && e.stack ? <Text style={s.stack}>{e.stack}</Text> : null}
        </TouchableOpacity>
      ))}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  empty: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text.muted, paddingVertical: spacing[4], textAlign: 'center' },
  row: { backgroundColor: c.ui.in, borderRadius: radius.inner, padding: spacing[3], marginBottom: spacing[2] },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  where: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: c.accent.red, textTransform: 'uppercase', letterSpacing: 0.5 },
  time: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  msg: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text.primary, lineHeight: 17 },
  stack: { fontSize: 10.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2], lineHeight: 15 },
  btns: { flexDirection: 'row', gap: spacing[2], paddingTop: spacing[2] },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.btn, backgroundColor: c.ui.in },
  btnMain: { backgroundColor: c.text.primary },
  btnLabel: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  btnLabelMain: { color: c.bg.primary },
}));
