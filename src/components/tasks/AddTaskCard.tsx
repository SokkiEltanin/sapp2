import { useEffect, useState, type RefObject } from 'react';
import { removeTaskTag } from '@/services/taskTags';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { openPicker } from '@/services/picker';
import StepsEditor from './StepsEditor';
import { useTaskDraftStore } from '@/store/taskDraftStore';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { ymd, todayISO } from '@/utils/date';
import { haptic } from '@/utils/haptics';
import { deadlineHasTime, parseDeadline } from '@/utils/taskDeadline';
import type { Task, Subtask, TaskAlarm } from '@/types/calendar';

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

// Godzina także przy Dziś/Jutro/Za tydzień (2026-11-25, user: "jak klikam dzisiaj, żeby godzina była
// do wybrania — teraz tylko dokładny termin ma datę i godzinę, bez sensu, jak chcę zaplanować coś
// na dziś na 15"). Bez godziny = cały dzień (jak dotąd). Z godziną → wybór przypomnienia.
type HM = { h: number; m: number };
const hm2 = (n: number) => String(n).padStart(2, '0');
const fmtHM = (t: HM) => `${hm2(t.h)}:${hm2(t.m)}`;
const ALARM_OPTIONS: { key: TaskAlarm; label: string; hint: string }[] = [
  { key: 'notify', label: 'Powiadomienie', hint: 'zwykłe powiadomienie z przyciskami „Zrobione” i „Za godzinę”' },
  { key: 'alarm', label: 'Alarm', hint: 'ekran alarmu na pełny ekran z dźwiękiem budzika, też przy zablokowanym telefonie' },
  { key: 'off', label: 'Bez', hint: 'bez przypomnienia — tylko godzina na liście' },
];

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
  onSave: (input: { title: string; tags: string[]; deadline?: string; subtasks?: Subtask[]; alarm?: TaskAlarm }) => void;
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
  const [quickTime, setQuickTime] = useState<HM | null>(null);   // godzina dla Dziś/Jutro/Za tydzień
  const [alarm, setAlarm] = useState<TaskAlarm>('notify');
  // Kroki / kamienie milowe (2026-11-16) — też edytowalne w szczegółach zadania.
  const [steps, setSteps] = useState<Subtask[]>([]);

  // Kopia robocza (2026-11-16, store/taskDraftStore.ts): klucz = id edytowanego
  // zadania albo 'new'. `ready` dopiero po wczytaniu szkicu — inaczej pierwszy zapis
  // pustego formularza skasowałby szkic, zanim wróci.
  const draftKey = editingTask?.id ?? 'new';
  const [hydrated, setHydrated] = useState(() => useTaskDraftStore.persist.hasHydrated());
  useEffect(() => useTaskDraftStore.persist.onFinishHydration(() => setHydrated(true)), []);
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  const fillFromTask = () => {
    setTitle(editingTask?.title ?? '');
    setTag(editingTask?.tags[0] ?? '');
    setSteps(editingTask?.subtasks ?? []);
    const dl = editingTask?.deadline;
    setCustomDeadline(null);
    setCustomHasTime(false);
    setQuickTime(null);
    setAlarm(editingTask?.alarm ?? 'notify');
    if (!dl) { setDeadlineChoice('none'); return; }
    // Dziś/jutro (z godziną albo bez) wraca na swój szybki chip, reszta = "Dokładny termin".
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const quick = dl.slice(0, 10) === todayISO() ? 'today' : dl.slice(0, 10) === ymd(tomorrow) ? 'tomorrow' : null;
    if (quick) {
      setDeadlineChoice(quick);
      if (deadlineHasTime(dl)) { const d = parseDeadline(dl); setQuickTime({ h: d.getHours(), m: d.getMinutes() }); }
      return;
    }
    setDeadlineChoice('custom');
    setCustomDeadline(parseDeadline(dl));
    setCustomHasTime(deadlineHasTime(dl));
  };

  useEffect(() => {
    fillFromTask();
    if (!hydrated) { setReady(false); return; }
    const d = useTaskDraftStore.getState().drafts[draftKey];
    if (d) {
      setTitle(d.title);
      setTag(d.tag);
      setSteps(d.steps);
      setDeadlineChoice(d.deadlineChoice as DeadlineChoice);
      setCustomDeadline(d.custom ? new Date(d.custom) : null);
      setCustomHasTime(d.customHasTime);
      setQuickTime(d.quickTime ?? null);
      setAlarm(d.alarm ?? 'notify');
      setRestoredAt(d.savedAt);
    } else setRestoredAt(null);
    setReady(true);
  }, [editingTask, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const computeDeadline = (): string | undefined => {
    if (deadlineChoice === 'custom' && customDeadline) {
      const hh = String(customDeadline.getHours()).padStart(2, '0');
      const mm = String(customDeadline.getMinutes()).padStart(2, '0');
      return customHasTime ? `${ymd(customDeadline)}T${hh}:${mm}:00` : ymd(customDeadline);
    }
    if (deadlineChoice === 'none' || deadlineChoice === 'custom') return undefined;
    const d = new Date();
    if (deadlineChoice === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (deadlineChoice === 'week') d.setDate(d.getDate() + 7);
    const day = deadlineChoice === 'today' ? todayISO() : ymd(d);
    return quickTime ? `${day}T${fmtHM(quickTime)}:00` : day;
  };
  const isQuick = deadlineChoice === 'today' || deadlineChoice === 'tomorrow' || deadlineChoice === 'week';
  const timedDeadline = (() => { const dl = computeDeadline(); return dl && deadlineHasTime(dl) ? parseDeadline(dl) : null; })();

  // Każda zmiana → szkic. Edycja bez zmian względem zadania = brak szkicu.
  useEffect(() => {
    if (!ready) return;
    const st = useTaskDraftStore.getState();
    if (editingTask) {
      const unchanged = title === editingTask.title && tag === (editingTask.tags[0] ?? '')
        && JSON.stringify(steps) === JSON.stringify(editingTask.subtasks ?? [])
        && (computeDeadline() ?? '') === (editingTask.deadline ?? '')
        && alarm === (editingTask.alarm ?? 'notify');
      if (unchanged) { st.clear(draftKey); return; }
    }
    st.save(draftKey, { title, tag, deadlineChoice, custom: customDeadline ? customDeadline.toISOString() : null, customHasTime, quickTime, alarm, steps });
  }, [ready, title, tag, deadlineChoice, customDeadline, customHasTime, quickTime, alarm, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  const discardDraft = () => {
    haptic.tap();
    useTaskDraftStore.getState().clear(draftKey);
    setRestoredAt(null);
    fillFromTask();
  };

  const reset = () => {
    useTaskDraftStore.getState().clear(draftKey);
    setRestoredAt(null);
    setTitle('');
    setTag('');
    setDeadlineChoice('none');
    setCustomDeadline(null);
    setCustomHasTime(false);
    setQuickTime(null);
    setAlarm('notify');
    setSteps([]);
    onClose();
  };

  const tagSuggestions = knownTags.slice(0, 6);

  const pickCustomDeadline = () => {
    haptic.tap();
    const base = customDeadline ?? new Date();
    openPicker({
      value: base,
      mode: 'date',
      onChange: (dateEvent, selectedDate) => {
        if (dateEvent.type !== 'set' || !selectedDate) return;
        openPicker({
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

  const pickQuickTime = () => {
    haptic.tap();
    const base = new Date();
    if (quickTime) base.setHours(quickTime.h, quickTime.m, 0, 0);
    else base.setHours(base.getHours() + 1, 0, 0, 0);
    openPicker({
      value: base,
      mode: 'time',
      is24Hour: true,
      onChange: (ev, picked) => {
        if (ev.type !== 'set' || !picked) return;
        setQuickTime({ h: picked.getHours(), m: picked.getMinutes() });
      },
    });
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    haptic.success();
    const deadline = computeDeadline();
    const trimmedTag = tag.trim();
    onSave({ title: trimmedTitle, tags: trimmedTag ? [trimmedTag] : [], deadline, subtasks: steps.length ? steps : undefined, alarm: deadline && deadlineHasTime(deadline) ? alarm : undefined });
    reset();
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>{editingTask ? 'Edytuj zadanie' : 'Nowe zadanie'}</Text>
      {restoredAt && (
        <View style={s.draftRow}>
          <Text style={s.draftTxt} numberOfLines={1}>Przywrócono szkic z {new Date(restoredAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
          <TouchableOpacity onPress={discardDraft} hitSlop={8}><Text style={s.draftBtn}>Wyczyść</Text></TouchableOpacity>
        </View>
      )}
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
              onLongPress={() => { if (tag.trim() === t) setTag(''); removeTaskTag(t); }}
              delayLongPress={450}
              activeOpacity={0.7}
              accessibilityHint="Przytrzymaj, by usunąć tag ze wszystkich zadań"
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
      {isQuick && (
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, !quickTime && s.chipActive]} onPress={() => { haptic.tap(); setQuickTime(null); }} activeOpacity={0.7}>
            <Text style={[s.chipLabel, !quickTime && s.chipLabelActive]}>Cały dzień</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, !!quickTime && s.chipActive]} onPress={pickQuickTime} activeOpacity={0.7} accessibilityLabel="Wybierz godzinę">
            <Text style={[s.chipLabel, !!quickTime && s.chipLabelActive]}>{quickTime ? `o ${fmtHM(quickTime)}` : 'O godzinie…'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {timedDeadline && (
        <>
          <Text style={s.sectionLabel}>Przypomnienie</Text>
          <View style={s.chips}>
            {ALARM_OPTIONS.map((o) => (
              <TouchableOpacity key={o.key} style={[s.chip, alarm === o.key && s.chipActive]} onPress={() => { haptic.tap(); setAlarm(o.key); }} activeOpacity={0.7}>
                <Text style={[s.chipLabel, alarm === o.key && s.chipLabelActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.hint}>
            {timedDeadline.getTime() <= Date.now()
              ? 'Ta godzina już minęła — przypomnienie się nie pokaże.'
              : `${ALARM_OPTIONS.find((o) => o.key === alarm)?.hint ?? ''}`}
          </Text>
        </>
      )}
      <Text style={s.sectionLabel}>Kroki do celu (opcjonalnie)</Text>
      <StepsEditor steps={steps} onChange={setSteps} placeholder="Np. „Zebrać źródła” — Enter dodaje" />
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
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.md, backgroundColor: c.ui.in2 },
  draftTxt: { flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  draftBtn: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.bright },
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
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[1] },
  cancelBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  cancelLabel: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  saveBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: c.text.bright },
  saveBtnDisabled: { opacity: 0.4 },
  saveLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
