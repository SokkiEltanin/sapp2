import { useEffect, useState, type RefObject } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { ymd, todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import { deadlineHasTime, parseDeadline } from '@/utils/taskDeadline';
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

function formatCustomLabel(d: Date, hasTime: boolean): string {
  const day = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  if (!hasTime) return day;
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function AddTaskCard({
  editingTask,
  onSave,
  onClose,
  titleRef,
  knownTags = [],
}: {
  editingTask?: Task | null;
  onSave: (input: { title: string; tags: string[]; deadline?: string }) => void;
  onClose: () => void;
  // Fokus (i klawiatura) z rodzica przez `AppBottomSheet`'s `initialFocusRef`
  // (2026-11-11) — goły `autoFocus` w RN `Modal`u na Androidzie nie otwierał
  // klawiatury, patrz komentarz w AppBottomSheet.tsx.
  titleRef?: RefObject<TextInput | null>;
  // Tagi już użyte w innych zadaniach (2026-11-11) — szybki wybór jednym
  // stuknięciem zamiast przepisywać "UR" za każdym razem.
  knownTags?: string[];
}) {
  const s = makeS();
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [deadlineChoice, setDeadlineChoice] = useState<DeadlineChoice>('none');
  const [customDeadline, setCustomDeadline] = useState<Date | null>(null);
  // Edytowany deadline date-only (z szybkich chipów) NIE ma godziny — bez tej
  // flagi edycja pokazywała i zapisywała sztuczne "00:00" (2026-11-11).
  const [customHasTime, setCustomHasTime] = useState(false);

  useEffect(() => {
    setTitle(editingTask?.title ?? '');
    setTag(editingTask?.tags[0] ?? '');
    const dl = editingTask?.deadline;
    if (!dl) {
      setDeadlineChoice('none');
      setCustomDeadline(null);
      setCustomHasTime(false);
      return;
    }
    // Date-only dziś/jutro wraca na swój szybki chip, reszta = "Dokładny termin".
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (!deadlineHasTime(dl) && dl.slice(0, 10) === todayISO()) { setDeadlineChoice('today'); setCustomDeadline(null); return; }
    if (!deadlineHasTime(dl) && dl.slice(0, 10) === ymd(tomorrow)) { setDeadlineChoice('tomorrow'); setCustomDeadline(null); return; }
    setDeadlineChoice('custom');
    setCustomDeadline(parseDeadline(dl));
    setCustomHasTime(deadlineHasTime(dl));
  }, [editingTask]);

  const reset = () => {
    setTitle('');
    setTag('');
    setDeadlineChoice('none');
    setCustomDeadline(null);
    setCustomHasTime(false);
    onClose();
  };

  const tagSuggestions = knownTags.slice(0, 6);

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
            setCustomHasTime(true);
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
      deadline = customHasTime ? `${ymd(customDeadline)}T${hh}:${mm}:00` : ymd(customDeadline);
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
        ref={titleRef}
        value={title}
        onChangeText={setTitle}
        placeholder="Co trzeba zrobić?"
        placeholderTextColor={colors.text.muted}
        style={s.titleInput}
        returnKeyType="done"
        onSubmitEditing={handleSave}
        submitBehavior="blurAndSubmit"
      />
      <TextInput
        value={tag}
        onChangeText={setTag}
        placeholder="Tag (opcjonalnie, np. UR)"
        placeholderTextColor={colors.text.muted}
        style={s.tagInput}
        autoCapitalize="characters"
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
      {tagSuggestions.length > 0 && (
        <View style={s.chips}>
          {tagSuggestions.map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.tagChip, tag.trim() === t && s.chipActive]}
              onPress={() => { haptic.tap(); setTag(tag.trim() === t ? '' : t); }}
              activeOpacity={0.7}
            >
              <Text style={[s.chipLabel, tag.trim() === t && s.chipLabelActive]}>#{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={s.sectionLabel}>Termin</Text>
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
            {deadlineChoice === 'custom' && customDeadline ? formatCustomLabel(customDeadline, customHasTime) : 'Dokładny termin'}
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
  tagChip: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm, backgroundColor: c.bg.elevated },
  sectionLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: spacing[1] },
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
