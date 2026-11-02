import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { Cap } from '@/ui/layout';
import { C, F, R, S } from '@/ui/theme';
import { useHabitsStore } from '@/store/habitsStore';
import { habitStreak } from '@/utils/habitStreak';
import { todayISO } from '@/utils/date';
import { HABIT_LABELS, HABIT_QUESTIONS, type HabitKey } from '@/types/habits';
import { haptic } from '@/utils/haptics';

// Popup "nawyki" — pierwsza REALNA implementacja Woda/Słodycze/Trening (Dashboard
// Faza 3.2/3.10 miały je jako uczciwy stub, `null`/"brak", bo appka nie miała
// store'a). Model: jeden rekord na dzień, 3 booleany (`true` = "udało się" dla
// każdego symetrycznie — patrz types/habits.ts). Tap na kafelek Dashboardu
// (`onOpen('streak', key)`) otwiera TEN sam popup dla wszystkich trzech naraz
// (są powiązane tematycznie, nie ma sensu osobny sheet na jeden toggle) —
// `key` z wywołania tylko decyduje co jest najwyżej, nie zawęża widoku.
const KEYS: HabitKey[] = ['water', 'sweets', 'training'];

export default function HabitsModal({ visible, onClose, focusKey }: { visible: boolean; onClose: () => void; focusKey?: HabitKey }) {
  const days = useHabitsStore((st) => st.days);
  const setHabit = useHabitsStore((st) => st.setHabit);
  const today = todayISO();
  const todayRecord = days.find((d) => d.date === today);

  const order = focusKey ? [focusKey, ...KEYS.filter((k) => k !== focusKey)] : KEYS;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} scrollable={false}>
      <View style={st.card}>
        <Cap l="Dzisiejsze nawyki" />
        {order.map((key) => {
          const on = todayRecord?.[key] === true;
          const streak = habitStreak(days, key, today);
          return (
            <TouchableOpacity
              key={key}
              style={[st.row, on && st.rowOn]}
              onPress={() => { haptic.success(); setHabit(today, key, !on); }}
              activeOpacity={0.8}
            >
              <View style={st.rowTextCol}>
                <Text style={[st.rowLabel, on && st.rowLabelOn]}>{HABIT_LABELS[key]}</Text>
                <Text style={[st.rowQuestion, on && st.rowQuestionOn]}>{HABIT_QUESTIONS[key]}</Text>
              </View>
              <View style={st.streakCol}>
                <Text style={[st.streakNum, on && st.streakNumOn]}>{streak}</Text>
                <Text style={[st.streakUnit, on && st.streakUnitOn]}>dni</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </AppBottomSheet>
  );
}

const st = StyleSheet.create({
  card: { gap: S.gap },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.in, borderRadius: R.inner, padding: S.pad,
  },
  rowOn: { backgroundColor: C.txt },
  rowTextCol: { flex: 1, minWidth: 0, gap: 2, marginRight: S.gap },
  rowLabel: { fontFamily: F.xb, fontSize: 13, color: C.hi },
  rowLabelOn: { color: '#000' },
  rowQuestion: { fontFamily: F.sb, fontSize: 11, color: C.mut },
  rowQuestionOn: { color: 'rgba(0,0,0,.55)' },
  streakCol: { alignItems: 'flex-end' },
  streakNum: { fontFamily: F.xb, fontSize: 20, color: C.hi, fontVariant: ['tabular-nums'] },
  streakNumOn: { color: '#000' },
  streakUnit: { fontFamily: F.sb, fontSize: 9, letterSpacing: 1, color: C.mut, textTransform: 'uppercase' },
  streakUnitOn: { color: 'rgba(0,0,0,.55)' },
});
