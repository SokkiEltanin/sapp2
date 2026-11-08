import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { ymd, todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import type { Task } from '@/types/calendar';

// Dodawanie zadania (2026-10-30, user: "może od razu z... działające zadania"). Jedno
// pole terminu napędza kategoryzację na TERAZ/TERMINOWE/BEZTERMINOWE w tasks.tsx
// (deadline <= dziś → TERAZ, deadline w przyszłości → TERMINOWE, brak → BEZTERMINOWE)
// — stąd szybki wybór "Dziś/Jutro/Za tydzień/Bez terminu" zamiast pełnego date-pickera
// (brak zainstalowanej biblioteki do tego, a te trzy opcje pokrywają realny use-case
// bez nowej zależności). Tag — jedno pole tekstowe, nie lista: `Task.tags` to string[],
// ale UI dla wielu tagów naraz to rozbudowa na później, jeśli user tego zażąda.
//
// KONTROLOWANY przez rodzica (`onClose`), nie własny stan otwarcia (2026-10-30,
// user: "zależy nam na przestrzeni... chcę mieć zamiast tam przycisk w prawym nad
// navbarem") — wcześniej ten komponent sam renderował pełnoszerokościowy
// przycisk-wyzwalacz zajmujący stały wiersz w scrollu; teraz wyzwalacz to pływający
// FAB w tasks.tsx (nad navbarem, nie zajmuje miejsca na liście), ten komponent
// renderuje WYŁĄCZNIE formularz.
//
// Przebudowany na `AppBottomSheet` (2026-11-02, kontynuacja migracji z Faza 3.6) —
// `visible`/`return null` USUNIĘTE (martwy kod: jedyny caller, `tasks.tsx`, już
// wołał `visible` jako literał `true`, bo faktyczną widoczność kontrolował
// otaczający `Modal`; teraz kontroluje ją `AppBottomSheet` w `tasks.tsx`). Własny
// `card` (tło/border/radius/padding) ZDJĘTY — sheet sam daje to tło, drugie "pudełko
// w pudełku" dublowałoby chrome. Tytuł "Nowe zadanie" dodany na górze — odpowiednik
// spec's `taskAdd` popupu (`.st`/`.sh`), bez redundantnej drugiej linii "Dodaj",
// której mockup używa jako generycznego szablonu wszystkich popupów formularzy.
//
// `editingTask` + "Dokładny termin" (2026-11-08, user: "edycja zadan, mozliwosc
// ustawienia przy dodawaniu terminu dokładnego w stylu samsunga scroll plus
// klikalny kalendarz" + "dodac edycje... taskow") — dwie osobne prośby, ten sam
// plik. Edycja: ten sam formularz co dodawanie (jak `AddExpenseModal`'s
// `editingExpense`), wstępnie wypełniony z `editingTask`, `onSave` zamiast `onAdd`
// (parent w `tasks.tsx` decyduje `addTask` vs `updateTask` po tym czy
// `editingTask` było ustawione przy otwarciu). Dokładny termin: PIĄTY chip
// otwiera naTYWny `DateTimePickerAndroid` (data → potem godzina, połączone w
// jedno) — to DOKŁADNIE ten sam, już sprawdzony wzorzec co w `AddExpenseModal`
// (`openDatePicker`), świadomie NIE własny UI kalendarza/scrolla do budowania —
// na Samsungu z One UI to WŁAŚNIE jest "styl Samsunga" (systemowy dialog, nie
// jego imitacja).
const DEADLINE_OPTIONS = [
  { key: 'none', label: 'Bez terminu' },
  { key: 'today', label: 'Dziś' },
  { key: 'tomorrow', label: 'Jutro' },
  { key: 'week', label: 'Za tydzień' },
] as const;
type DeadlineChoice = (typeof DEADLINE_OPTIONS)[number]['key'] | 'custom';

// Parsuje zarówno stare, "data-only" deadliny (`YYYY-MM-DD`, bez godziny — jak
// zapisywały dotychczasowe szybkie opcje) jak i nowe precyzyjne
// (`YYYY-MM-DDTHH:MM:00`, lokalny czas bez strefy — ten sam zapis co
// `eventStart()` w `app/(tabs)/index.tsx` już używa gdzie indziej w appce).
function parseDeadline(deadline: string): Date {
  return deadline.includes('T') ? new Date(deadline) : new Date(`${deadline}T00:00:00`);
}

function formatCustomLabel(d: Date): string {
  const day = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function AddTaskCard({
  editingTask,
  onSave,
  onClose,
}: {
  editingTask?: Task | null;
  onSave: (input: { title: string; tags: string[]; deadline?: string }) => void;
  onClose: () => void;
}) {
  const s = makeS();
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [deadlineChoice, setDeadlineChoice] = useState<DeadlineChoice>('none');
  const [customDeadline, setCustomDeadline] = useState<Date | null>(null);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setTag(editingTask.tags[0] ?? '');
      if (editingTask.deadline) {
        setDeadlineChoice('custom');
        setCustomDeadline(parseDeadline(editingTask.deadline));
      } else {
        setDeadlineChoice('none');
        setCustomDeadline(null);
      }
    } else {
      setTitle('');
      setTag('');
      setDeadlineChoice('none');
      setCustomDeadline(null);
    }
  }, [editingTask]);

  const reset = () => {
    setTitle('');
    setTag('');
    setDeadlineChoice('none');
    setCustomDeadline(null);
    onClose();
  };

  const pickCustomDeadline = () => {
    haptic.tap();
    const base = customDeadline ?? new Date();
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      onChange: (dateEvent, selectedDate) => {
        if (dateEvent.type !== 'set' || !selectedDate) return;
        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type !== 'set' || !selectedTime) return;
            const combined = new Date(selectedDate);
            combined.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
            setCustomDeadline(combined);
            setDeadlineChoice('custom');
          },
        });
      },
    });
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    haptic.success();
    let deadline: string | undefined;
    if (deadlineChoice === 'custom' && customDeadline) {
      const hh = String(customDeadline.getHours()).padStart(2, '0');
      const mm = String(customDeadline.getMinutes()).padStart(2, '0');
      deadline = `${ymd(customDeadline)}T${hh}:${mm}:00`;
    } else if (deadlineChoice !== 'none') {
      const d = new Date();
      if (deadlineChoice === 'tomorrow') d.setDate(d.getDate() + 1);
      else if (deadlineChoice === 'week') d.setDate(d.getDate() + 7);
      deadline = deadlineChoice === 'today' ? todayISO() : ymd(d);
    }
    const trimmedTag = tag.trim();
    onSave({ title: trimmedTitle, tags: trimmedTag ? [trimmedTag] : [], deadline });
    reset();
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>{editingTask ? 'Edytuj zadanie' : 'Nowe zadanie'}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Co trzeba zrobić?"
        placeholderTextColor={colors.text.muted}
        style={s.titleInput}
        autoFocus
      />
      <TextInput
        value={tag}
        onChangeText={setTag}
        placeholder="Tag (opcjonalnie, np. UR)"
        placeholderTextColor={colors.text.muted}
        style={s.tagInput}
        autoCapitalize="characters"
      />
      <View style={s.chips}>
        {DEADLINE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[s.chip, deadlineChoice === opt.key && s.chipActive]}
            onPress={() => { haptic.tap(); setDeadlineChoice(opt.key); }}
            activeOpacity={0.7}
          >
            <Text style={[s.chipLabel, deadlineChoice === opt.key && s.chipLabelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.chip, deadlineChoice === 'custom' && s.chipActive]}
          onPress={pickCustomDeadline}
          activeOpacity={0.7}
        >
          <Text style={[s.chipLabel, deadlineChoice === 'custom' && s.chipLabelActive]}>
            {deadlineChoice === 'custom' && customDeadline ? formatCustomLabel(customDeadline) : 'Dokładny termin'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => { haptic.tap(); reset(); }} activeOpacity={0.7}>
          <Text style={s.cancelLabel}>Anuluj</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, !title.trim() && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!title.trim()}
          activeOpacity={0.7}
        >
          <Text style={s.saveLabel}>{editingTask ? 'Zapisz' : 'Dodaj'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  card: { gap: spacing[2] },
  title: { fontSize: 20, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.4, color: c.text.bright, marginBottom: spacing[1] },
  titleInput: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary,
    backgroundColor: c.bg.elevated, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  tagInput: {
    fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.elevated, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { paddingHorizontal: spacing[2], paddingVertical: 5, borderRadius: radius.sm, backgroundColor: c.bg.elevated },
  chipActive: { backgroundColor: c.text.bright },
  chipLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelActive: { color: c.bg.primary },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[1] },
  cancelBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  cancelLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  saveBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: c.text.bright },
  saveBtnDisabled: { opacity: 0.4 },
  saveLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
