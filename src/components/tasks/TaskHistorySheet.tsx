import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RotateCcw, Trash2, CheckCircle2 } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useCalendarStore } from '@/store/calendarStore';
import { haptic } from '@/utils/haptics';
import { taskProgress } from '@/utils/taskProgress';
import type { Task } from '@/types/calendar';

// Historia zadań (2026-11-16, user: "historia zadań wykonanych/usuniętych na wszelki
// wypadek — na zegarku odznaczyło się niechcący i zadanie zniknęło"). Zrobione
// (status 'done', od najnowszych) i Kosz (status 'deleted', 30 dni). "Przywróć" wraca
// zadanie na listę razem z krokami; w koszu "usuń na zawsze" (drugie stuknięcie).
const DAY = 86400000;

function whenLabel(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const d = new Date(iso);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const hm = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (d.getTime() >= start.getTime()) return `dziś ${hm}`;
  if (d.getTime() >= start.getTime() - DAY) return `wczoraj ${hm}`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) + ` ${hm}`;
}

export default function TaskHistorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const tasks = useCalendarStore((st) => st.tasks);
  const updateTask = useCalendarStore((st) => st.updateTask);
  const deleteTask = useCalendarStore((st) => st.deleteTask);
  const [tab, setTab] = useState<'done' | 'deleted'>('done');
  const [confirm, setConfirm] = useState<string | null>(null);

  const done = useMemo(() => tasks.filter((t) => t.status === 'done')
    .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt)), [tasks]);
  const trash = useMemo(() => tasks.filter((t) => t.status === 'deleted')
    .sort((a, b) => (b.deletedAt ?? b.updatedAt).localeCompare(a.deletedAt ?? a.updatedAt)), [tasks]);
  const list = tab === 'done' ? done : trash;

  const restore = (t: Task) => { haptic.success(); updateTask(t.id, { status: 'pending' }); };
  const forever = (t: Task) => {
    if (confirm !== t.id) { haptic.warn(); setConfirm(t.id); return; }
    haptic.tap(); deleteTask(t.id); setConfirm(null);
  };

  return (
    <AppBottomSheet fixedHeight visible={visible} onClose={() => { setConfirm(null); onClose(); }} maxHeightRatio={0.9}
      header={<Text style={s.title}>Historia zadań</Text>}>
      <View style={s.tabs}>
        {([['done', `Zrobione · ${done.length}`], ['deleted', `Kosz · ${trash.length}`]] as const).map(([k, l]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => { haptic.tap(); setTab(k); setConfirm(null); }}>
            <Text style={[s.tabTxt, tab === k && s.tabTxtOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'deleted' && <Text style={s.note}>Usunięte zadania czekają tu 30 dni, potem znikają na stałe.</Text>}

      {list.length === 0 && <Text style={s.empty}>{tab === 'done' ? 'Jeszcze nic nie odhaczone.' : 'Kosz jest pusty.'}</Text>}
      {list.map((t) => {
        const p = taskProgress(t);
        const at = tab === 'done' ? t.completedAt ?? t.updatedAt : t.deletedAt ?? t.updatedAt;
        const left = tab === 'deleted' ? Math.max(0, 30 - Math.floor((Date.now() - Date.parse(at)) / DAY)) : null;
        return (
          <View key={t.id} style={s.row}>
            {tab === 'done' ? <CheckCircle2 size={16} color={colors.text.muted} /> : <Trash2 size={15} color={colors.text.muted} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name} numberOfLines={2}>{t.title}</Text>
              <Text style={s.meta} numberOfLines={1}>
                {whenLabel(at)}{p.total ? ` · kroki ${p.done}/${p.total}` : ''}{t.tags.length ? ` · ${t.tags.join(', ')}` : ''}{left != null ? ` · ${left} dni do usunięcia` : ''}
              </Text>
            </View>
            {tab === 'deleted' && (
              <TouchableOpacity onPress={() => forever(t)} style={[s.iconBtn, confirm === t.id && s.iconBtnDanger]} accessibilityLabel="Usuń na zawsze">
                <Trash2 size={14} color={confirm === t.id ? colors.bg.primary : colors.accent.red} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => restore(t)} style={s.restore} accessibilityLabel={`Przywróć: ${t.title}`}>
              <RotateCcw size={13} color={colors.bg.primary} />
              <Text style={s.restoreTxt}>Przywróć</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      {confirm && <Text style={s.note}>Stuknij czerwony kosz jeszcze raz, żeby usunąć na zawsze.</Text>}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  tabs: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: radius.md, backgroundColor: c.bg.primary, marginBottom: spacing[3] },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  tabOn: { backgroundColor: c.text.bright },
  tabTxt: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.secondary },
  tabTxtOn: { color: c.bg.primary },
  note: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, marginBottom: spacing[2] },
  empty: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted, textAlign: 'center', paddingVertical: spacing[5] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  name: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text.primary },
  meta: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  iconBtn: { width: 32, height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.red + '55', alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { backgroundColor: c.accent.red, borderColor: c.accent.red },
  restore: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 32, borderRadius: radius.md, backgroundColor: c.text.bright },
  restoreTxt: { fontSize: 12, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
