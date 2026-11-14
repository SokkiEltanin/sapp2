import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pin, PinOff, Trash2, Check, X, Plus, Undo2, Eraser, Pencil } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useNotesStore, genNoteId } from '@/store/notesStore';
import type { Note, NoteItem, NoteStroke } from '@/types/notes';
import { isEmptyNote } from '@/utils/notes';
import DrawingCanvas, { type DrawTool } from '@/components/notes/DrawingCanvas';
import { haptic } from '@/utils/haptics';

// Edytor notatki (2026-11-14). Pełny ekran (rysowanie potrzebuje miejsca).
// Zapis: tekst/lista lokalnie w stanie, do store'a z opóźnieniem 400 ms (pisanie
// nie zapisuje persist przy każdej literze); rysunek — po każdej kresce. Wyjście z
// pustą notatką = notatka znika (bez śmieciowych pustych wpisów).
const PEN_COLORS = ['#F2F2F2', '#EF4444', '#FBBF24', '#22C55E', '#60A5FA', '#A78BFA'];
const PEN_WIDTHS = [2, 4, 9];

export default function NoteScreen() {
  const s = makeS();
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNotesStore((st) => st.notes.find((n) => n.id === id));
  const update = useNotesStore((st) => st.update);
  const remove = useNotesStore((st) => st.remove);
  const setPinned = useNotesStore((st) => st.setPinned);

  const [title, setTitle] = useState(note?.title ?? '');
  const [text, setText] = useState(note?.text ?? '');
  const [items, setItems] = useState<NoteItem[]>(note?.items ?? []);
  const [tool, setTool] = useState<DrawTool>({ color: PEN_COLORS[0], width: PEN_WIDTHS[1], eraser: false });
  const [confirmDel, setConfirmDel] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<Note>>({});

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (id && Object.keys(pending.current).length) { update(id, pending.current); pending.current = {}; }
  };
  const save = (patch: Partial<Note>) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  };

  // Wyjście: dopisz zaległe zmiany; pusta notatka znika.
  useEffect(() => () => {
    flush();
    const n = useNotesStore.getState().notes.find((x) => x.id === id);
    if (n && isEmptyNote(n)) useNotesStore.getState().remove(n.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!note) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headBtn}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        </View>
        <Text style={s.missing}>Tej notatki już nie ma.</Text>
      </SafeAreaView>
    );
  }

  const setItemsSave = (next: NoteItem[]) => { setItems(next); save({ items: next }); };
  const addItem = (afterIdx?: number) => {
    const it: NoteItem = { id: genNoteId('it'), text: '', done: false };
    const next = [...items];
    next.splice(afterIdx == null ? next.length : afterIdx + 1, 0, it);
    setItemsSave(next);
    setFocusId(it.id);
  };
  const strokesChange = (strokes: NoteStroke[]) => update(note.id, { strokes });

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headBtn} hitSlop={8}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <TextInput
          value={title}
          onChangeText={(t) => { setTitle(t); save({ title: t }); }}
          placeholder={note.kind === 'list' ? 'Lista' : note.kind === 'drawing' ? 'Rysunek' : 'Tytuł'}
          placeholderTextColor={colors.text.muted}
          style={s.titleInput}
        />
        <TouchableOpacity onPress={() => { haptic.tap(); setPinned(note.id, !note.pinned); }} style={s.headBtn} hitSlop={8} accessibilityLabel={note.pinned ? 'Odepnij z Dashboardu' : 'Przypnij na Dashboard'}>
          {note.pinned ? <Pin size={18} color={colors.accent.orange} /> : <PinOff size={18} color={colors.text.muted} />}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { haptic.tap(); if (!confirmDel) { setConfirmDel(true); return; } remove(note.id); router.back(); }}
          style={[s.headBtn, confirmDel && s.delOn]} hitSlop={8} accessibilityLabel="Usuń notatkę"
        >
          <Trash2 size={17} color={confirmDel ? colors.bg.primary : colors.text.muted} />
        </TouchableOpacity>
      </View>

      {note.kind === 'text' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TextInput
            value={text}
            onChangeText={(t) => { setText(t); save({ text: t }); }}
            placeholder="Pisz…"
            placeholderTextColor={colors.text.muted}
            style={s.body}
            multiline
            textAlignVertical="top"
            autoFocus={!note.text}
          />
        </KeyboardAvoidingView>
      )}

      {note.kind === 'list' && (
        <ScrollView contentContainerStyle={s.listWrap} keyboardShouldPersistTaps="handled">
          {items.map((it, idx) => (
            <View key={it.id} style={s.itemRow}>
              <TouchableOpacity
                style={[s.check, it.done && s.checkOn]}
                onPress={() => { haptic.tap(); setItemsSave(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x))); }}
                hitSlop={6}
              >
                {it.done && <Check size={14} color={colors.bg.primary} />}
              </TouchableOpacity>
              <TextInput
                value={it.text}
                onChangeText={(t) => setItemsSave(items.map((x) => (x.id === it.id ? { ...x, text: t } : x)))}
                onSubmitEditing={() => addItem(idx)}
                blurOnSubmit={false}
                autoFocus={focusId === it.id}
                placeholder="Pozycja"
                placeholderTextColor={colors.text.muted}
                style={[s.itemInput, it.done && s.itemDone]}
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => { haptic.tap(); setItemsSave(items.filter((x) => x.id !== it.id)); }} hitSlop={8}>
                <X size={15} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addRow} onPress={() => { haptic.tap(); addItem(); }} activeOpacity={0.7}>
            <Plus size={16} color={colors.text.secondary} />
            <Text style={s.addLabel}>Dodaj pozycję</Text>
          </TouchableOpacity>
          {items.some((i) => i.done) && (
            <TouchableOpacity onPress={() => { haptic.tap(); setItemsSave(items.filter((i) => !i.done)); }} style={s.clearDone}>
              <Text style={s.clearDoneLabel}>Usuń odhaczone ({items.filter((i) => i.done).length})</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {note.kind === 'drawing' && (
        <>
          <View style={s.canvasBox}>
            <DrawingCanvas
              strokes={note.strokes}
              onChange={strokesChange}
              tool={tool}
              onRatio={(r) => { if (!note.canvasRatio || Math.abs(note.canvasRatio - r) > 0.05) update(note.id, { canvasRatio: Math.round(r * 100) / 100 }); }}
            />
          </View>
          <View style={s.toolbar}>
            {PEN_COLORS.map((c) => (
              <TouchableOpacity key={c} onPress={() => { haptic.tap(); setTool((t) => ({ ...t, color: c, eraser: false })); }}
                style={[s.swatch, { backgroundColor: c }, !tool.eraser && tool.color === c && s.swatchOn]} accessibilityLabel={`Kolor ${c}`} />
            ))}
            <View style={s.sep} />
            {PEN_WIDTHS.map((w) => (
              <TouchableOpacity key={w} onPress={() => { haptic.tap(); setTool((t) => ({ ...t, width: w, eraser: false })); }}
                style={[s.toolBtn, !tool.eraser && tool.width === w && s.toolOn]} accessibilityLabel={`Grubość ${w}`}>
                <View style={{ width: w + 3, height: w + 3, borderRadius: (w + 3) / 2, backgroundColor: !tool.eraser && tool.width === w ? colors.bg.primary : colors.text.primary }} />
              </TouchableOpacity>
            ))}
            <View style={s.sep} />
            <TouchableOpacity onPress={() => { haptic.tap(); setTool((t) => ({ ...t, eraser: !t.eraser })); }} style={[s.toolBtn, tool.eraser && s.toolOn]} accessibilityLabel="Gumka">
              {tool.eraser ? <Eraser size={16} color={colors.bg.primary} /> : <Eraser size={16} color={colors.text.primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { haptic.tap(); if (note.strokes.length) update(note.id, { strokes: note.strokes.slice(0, -1) }); }} style={s.toolBtn} accessibilityLabel="Cofnij">
              <Undo2 size={16} color={note.strokes.length ? colors.text.primary : colors.text.muted} />
            </TouchableOpacity>
          </View>
          {tool.eraser && <Text style={s.hint}><Pencil size={10} color={colors.text.muted} /> Gumka usuwa całe kreski, których dotkniesz.</Text>}
        </>
      )}
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[2], paddingVertical: spacing[2] },
  headBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  delOn: { backgroundColor: c.accent.red },
  titleInput: { flex: 1, minWidth: 0, fontSize: 18, fontFamily: 'Inter_900Black', color: c.text.primary, paddingVertical: 6 },
  missing: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text.muted, padding: spacing[4] },
  body: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', color: c.text.primary, paddingHorizontal: spacing[4], paddingTop: spacing[2] },

  listWrap: { paddingHorizontal: spacing[4], paddingBottom: 60 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.text.secondary, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: c.accent.green, borderColor: c.accent.green },
  itemInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: c.text.primary, paddingVertical: 9 },
  itemDone: { color: c.text.muted, textDecorationLine: 'line-through' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  addLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  clearDone: { alignSelf: 'flex-start', marginTop: spacing[2] },
  clearDoneLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted, textDecorationLine: 'underline' },

  canvasBox: { flex: 1, marginHorizontal: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: spacing[3], flexWrap: 'wrap' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.bright, transform: [{ scale: 1.12 }] },
  sep: { width: 1, height: 22, backgroundColor: c.ui.line, marginHorizontal: 4 },
  toolBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border.default },
  toolOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
}));
