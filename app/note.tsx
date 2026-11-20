import { goBack } from '@/services/nav';
import { create } from 'zustand';
import { removeWithUndo } from '@/services/undo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pin, PinOff, Trash2, Check, X, Plus, Undo2, Eraser, Pencil, Folder, Brush, PenLine, Type, NotebookText, Eye, EyeOff, Hand } from 'lucide-react-native';
import ColorPicker from '@/components/notes/ColorPicker';
import { StrokesLayer } from '@/components/notes/DrawingCanvas';
import { useNoteViewStore, tileCutY } from '@/store/noteViewStore';
import FolderSheet, { type FolderSheetMode } from '@/components/notes/FolderSheet';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useNotesStore, genNoteId } from '@/store/notesStore';
import type { Note, NoteItem, NoteStroke } from '@/types/notes';
import { isEmptyNote } from '@/utils/notes';
import DrawingCanvas, { type DrawTool, type PressureInfo } from '@/components/notes/DrawingCanvas';
import RichTextEditor from '@/components/notes/RichTextEditor';
import { hasFormatting, type TextRun } from '@/utils/richText';
import { haptic } from '@/utils/haptics';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { usePenStore } from '@/store/penStore';

// Edytor notatki (2026-11-14). Pełny ekran (rysowanie potrzebuje miejsca).
// Zapis: tekst/lista lokalnie w stanie, do store'a z opóźnieniem 400 ms (pisanie
// nie zapisuje persist przy każdej literze); rysunek — po każdej kresce. Wyjście z
// pustą notatką = notatka znika (bez śmieciowych pustych wpisów).
const PEN_COLORS = ['#F2F2F2', '#EF4444', '#FBBF24', '#22C55E', '#60A5FA', '#A78BFA'];
// Grubości (2026-11-18): 5 do wyboru w panelu pióra — kółko w podglądzie ma realny rozmiar kreski.
const PEN_WIDTHS = [2, 4, 6, 9, 14];

// Dolna krawędź rysunku w px (kreski trzymane w jednostkach szerokości) — strona
// rośnie, żeby było miejsce pod najniższą kreską.
function strokesBottom(strokes: NoteStroke[], w: number): number {
  let max = 0;
  for (const st of strokes) for (let i = 1; i < st.p.length; i += 2) if (st.p[i] > max) max = st.p[i];
  return max * w;
}

export default function NoteScreen() {
  const kb = useKeyboardHeight();
  const s = makeS();
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNotesStore((st) => st.notes.find((n) => n.id === id));
  const update = useNotesStore((st) => st.update);
  const remove = useNotesStore((st) => st.remove);
  const setPinned = useNotesStore((st) => st.setPinned);
  const folders = useNotesStore((st) => st.folders);
  const [folderSheet, setFolderSheet] = useState<FolderSheetMode | null>(null);

  const [title, setTitle] = useState(note?.title ?? '');
  const [text, setText] = useState(note?.text ?? '');
  const [runs, setRuns] = useState<TextRun[] | undefined>(note?.runs);
  const [items, setItems] = useState<NoteItem[]>(note?.items ?? []);
  const [tool, setTool] = useState<DrawTool>({ color: PEN_COLORS[0], width: PEN_WIDTHS[1], eraser: false });
  // Odczyt nacisku (2026-11-18, user: "rysowanie laguje"): stan w małym store poza ekranem —
  // wcześniej useState tutaj przerysowywał CAŁY ekran notatki (edytor tekstu!) 10×/s w trakcie
  // rysowania. Teraz odświeża się tylko <PressureLabel>. Ostatni odczyt zostaje 2 s.
  const pressureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPressure = useCallback((p: PressureInfo | null) => {
    if (pressureTimer.current) clearTimeout(pressureTimer.current);
    if (p) usePressureLive.setState({ p });
    else pressureTimer.current = setTimeout(() => usePressureLive.setState({ p: null }), 2000);
  }, []);
  // Tekst + rysunek w jednej notatce (2026-11-15, user: "połączyć TEKST RYSUNEK... po
  // prostu narzędzie wybrać tekst albo rysunek"): przełącznik narzędzia na dole, kreski
  // leżą na tej samej "stronie" co tekst i przewijają się razem z nim.
  // S-Pen (2026-11-18): palec przewija dopiero, gdy appka wykryła rysik (inaczej bez rysika
  // nie dałoby się rysować); "+ strona" dokłada wysokość ekranu pod rysunkiem.
  const penFinger = usePenStore((st) => st.fingerScroll);
  const penSeen = usePenStore((st) => st.stylusSeen);
  const penScroll = penFinger && penSeen;
  const penButton = usePenStore((st) => st.buttonEraser);
  const [extraPages, setExtraPages] = useState(0);
  const pageScroll = useRef<any>(null);
  const pageY = useRef(0);
  const pageY0 = useRef(0);
  const [mode, setMode] = useState<'text' | 'draw'>(note?.kind === 'drawing' || (!!note && !note.text && note.strokes.length > 0) ? 'draw' : 'text');
  const [viewH, setViewH] = useState(0);
  const [pageW, setPageW] = useState(0);
  // Linia "widoczne na Dashboardzie" (2026-11-15) — store/noteViewStore.ts.
  const tile = useNoteViewStore((st) => st.tile);
  const guide = useNoteViewStore((st) => st.guide);
  const toggleGuide = useNoteViewStore((st) => st.toggleGuide);
  const setStorePageW = useNoteViewStore((st) => st.setPageW);
  const cutY = tileCutY(tile, pageW);
  const [showColors, setShowColors] = useState(false);
  const [showPen, setShowPen] = useState(false); // panel: pióro/pędzel + grubość
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
          <TouchableOpacity onPress={goBack} accessibilityLabel="Wstecz" style={s.headBtn}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
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
        <TouchableOpacity onPress={goBack} accessibilityLabel="Wstecz" style={s.headBtn} hitSlop={8}><ChevronLeft size={22} color={colors.text.primary} /></TouchableOpacity>
        <TextInput
          value={title}
          onChangeText={(t) => { setTitle(t); save({ title: t }); }}
          placeholder={note.kind === 'list' ? 'Lista' : note.kind === 'drawing' ? 'Rysunek' : 'Tytuł'}
          placeholderTextColor={colors.text.muted}
          style={s.titleInput}
        />
        {/* Wszystkie notatki (2026-11-15, user: "z Dashboardu przenosi tylko do tej notatki
            i nie mam jak wejść do ekranu notatek"). */}
        <TouchableOpacity onPress={() => { haptic.tap(); flush(); router.navigate('/notes' as any); }} style={s.headBtn} hitSlop={8} accessibilityLabel="Wszystkie notatki">
          <NotebookText size={18} color={colors.text.secondary} />
        </TouchableOpacity>
        {/* Katalog (2026-11-14) — kolor ikony = kolor katalogu, szara = bez katalogu. */}
        <TouchableOpacity onPress={() => { haptic.tap(); flush(); setFolderSheet({ kind: 'pick', noteId: note.id, current: note.folderId ?? null }); }} style={s.headBtn} hitSlop={8}
          accessibilityLabel={`Katalog: ${folders.find((f) => f.id === note.folderId)?.name ?? 'brak'}`}>
          <Folder size={18} color={folders.find((f) => f.id === note.folderId)?.color ?? colors.text.muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { haptic.tap(); setPinned(note.id, !note.pinned); }} style={s.headBtn} hitSlop={8} accessibilityLabel={note.pinned ? 'Odepnij z Dashboardu' : 'Przypnij na Dashboard'}>
          {note.pinned ? <Pin size={18} color={colors.accent.orange} /> : <PinOff size={18} color={colors.text.muted} />}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { haptic.tap(); if (!confirmDel) { setConfirmDel(true); return; } removeWithUndo(useNotesStore, 'notes', note, `Usunięto notatkę${note.title ? `: ${note.title}` : ''}`); goBack(); }}
          style={[s.headBtn, confirmDel && s.delOn]} hitSlop={8} accessibilityLabel="Usuń notatkę"
        >
          <Trash2 size={17} color={confirmDel ? colors.bg.primary : colors.text.muted} />
        </TouchableOpacity>
      </View>

      {(note.kind === 'text' || note.kind === 'drawing') && (
        // Klawiatura (2026-11-15, user: "klawiatura zasłania pisanie"): RN 0.81 na
        // Androidzie jest edge-to-edge — okno nie kurczy się pod klawiaturę, a
        // KeyboardAvoidingView bez `behavior` nic nie robi. Realna wysokość klawiatury
        // jako padding — pasek formatowania i przełącznik Tekst/Rysunek nad nią.
        <View style={{ flex: 1, paddingBottom: kb }}>
          <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setViewH(e.nativeEvent.layout.height)}>
            {viewH > 0 && (
              <RichTextEditor
                text={text}
                runs={runs}
                onChange={(t, r) => { setText(t); setRuns(r); save({ text: t, runs: hasFormatting(r) ? r : undefined }); }}
                autoFocus={mode === 'text' && !note.text && note.strokes.length === 0}
                editable={mode === 'text'}
                toolbar={mode === 'text'}
                page={{
                  // Nieskończona strona (2026-11-18): "+ strona" na dole dokłada wysokość ekranu.
                  minHeight: Math.max(viewH - 54, strokesBottom(note.strokes, pageW) + 160) + extraPages * Math.max(1, viewH - 54),
                  wrap: (field) => (
                    // GH ScrollView: rysik aktywuje gest kreski (scroll się nie rusza), palec przy
                    // `fingerScroll` odpada z gestu i przewija stronę.
                    // W trybie rysunku przewija gest płótna (dwa palce / palec przy S-Penie) przez
                    // scrollTo — natywny scroll wyłączony, bo wygrywał z kreską (2026-11-18).
                    <GHScrollView ref={pageScroll} style={{ flex: 1 }} scrollEnabled={mode === 'text'} keyboardShouldPersistTaps="handled"
                      scrollEventThrottle={16} onScroll={(e) => { pageY.current = e.nativeEvent.contentOffset.y; }}>
                      <View onLayout={(e: LayoutChangeEvent) => { setPageW(e.nativeEvent.layout.width); setStorePageW(e.nativeEvent.layout.width); }}>
                        {field}
                        {guide && cutY != null && (
                          <View style={[s.guide, { top: cutY }]} pointerEvents="none">
                            <Text style={s.guideLabel}>widoczne na Dashboardzie ↑</Text>
                          </View>
                        )}
                        {mode === 'draw' ? (
                          <View style={StyleSheet.absoluteFill}>
                            <DrawingCanvas strokes={note.strokes} onChange={strokesChange} tool={tool} onPressure={setPressure} fingerScroll={penScroll} buttonEraser={penButton}
                              onScrollStart={() => { pageY0.current = pageY.current; }}
                              onScrollBy={(dy) => pageScroll.current?.scrollTo({ y: Math.max(0, pageY0.current - dy), animated: false })} />
                          </View>
                        ) : note.strokes.length > 0 && pageW > 0 ? (
                          <View style={StyleSheet.absoluteFill} pointerEvents="none">
                            <StrokesLayer strokes={note.strokes} width={pageW} height={Math.max(viewH, strokesBottom(note.strokes, pageW) + 160)} />
                          </View>
                        ) : null}
                      </View>
                      {mode === 'draw' && (
                        <TouchableOpacity style={s.addPage} onPress={() => { haptic.tap(); setExtraPages((n) => n + 1); }} accessibilityLabel="Dodaj stronę">
                          <Plus size={16} color={colors.text.secondary} />
                          <Text style={s.addPageTxt}>strona niżej</Text>
                        </TouchableOpacity>
                      )}
                    </GHScrollView>
                  ),
                }}
              />
            )}
          </View>
          {/* Dolny pasek (2026-11-18, user: "navbar za duży — pióro/pędzel mniejsze, pisanie obok
              jako T"): JEDEN niski rząd ikon — T/✎ (tekst albo rysunek), przy rysunku: pióro,
              pędzel, palec, gumka, cofnij; oko = linia kafla. Kolory i grubości rząd niżej. */}
          {mode === 'draw' && showColors && (
            <View style={s.colorPanel}>
              <ColorPicker base={PEN_COLORS} value={tool.color} onPick={(c) => setTool((t) => ({ ...t, color: c, eraser: false }))} size={26} />
            </View>
          )}
          {/* Panel narzędzia (2026-11-18, user: "pędzel/pióro jako jedno, po kliknięciu wybór i
              wielkość kółeczka z wizualizacją"): rodzaj + grubość z podglądem w bieżącym kolorze. */}
          {mode === 'draw' && showPen && (
            <View style={s.penPanel}>
              <View style={s.penKinds}>
                {([[false, 'Pióro', 'stała grubość', PenLine], [true, 'Pędzel', 'S-Pen: mocniej = grubiej', Brush]] as const).map(([b, label, desc, Icon]) => {
                  const on = !!tool.brush === b;
                  return (
                    <TouchableOpacity key={label} onPress={() => { haptic.tap(); setTool((t) => ({ ...t, brush: b, eraser: false })); }} style={[s.penKind, on && s.penKindOn]} accessibilityLabel={label}>
                      <Icon size={16} color={on ? colors.bg.primary : colors.text.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.penKindTxt, on && { color: colors.bg.primary }]}>{label}</Text>
                        <Text style={[s.penKindDesc, on && { color: colors.bg.primary, opacity: 0.7 }]} numberOfLines={1}>{desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.penWidths}>
                {PEN_WIDTHS.map((w) => {
                  const on = tool.width === w;
                  const d = Math.max(4, w * 1.6);
                  return (
                    <TouchableOpacity key={w} onPress={() => { haptic.tap(); setTool((t) => ({ ...t, width: w, eraser: false })); }} style={[s.penWidth, on && s.penWidthOn]} accessibilityLabel={`Grubość ${w}`}>
                      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: tool.color }} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <PressureLabel brush={!!tool.brush} style={s.penPressure} />
            </View>
          )}
          {mode === 'draw' && (
            <View style={s.toolbar}>
              {PEN_COLORS.slice(0, 4).map((c) => (
                <TouchableOpacity key={c} onPress={() => { haptic.tap(); setTool((t) => ({ ...t, color: c, eraser: false })); }}
                  style={[s.swatch, { backgroundColor: c }, !tool.eraser && tool.color === c && s.swatchOn]} accessibilityLabel={`Kolor ${c}`} />
              ))}
              <TouchableOpacity onPress={() => { haptic.tap(); setShowPen(false); setShowColors((v) => !v); }}
                style={[s.swatch, s.moreColors, !PEN_COLORS.slice(0, 4).includes(tool.color) && { backgroundColor: tool.color }, showColors && s.swatchOn]} accessibilityLabel="Więcej kolorów i moja paleta">
                {PEN_COLORS.slice(0, 4).includes(tool.color) ? <Plus size={13} color={colors.text.primary} /> : null}
              </TouchableOpacity>
            </View>
          )}
          <View style={s.modeSwitch}>
            <View style={s.seg}>
              {([['text', 'Tekst', Type], ['draw', 'Rysunek', PenLine]] as const).map(([m, label, Icon]) => {
                const on = mode === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); flush(); setMode(m); setShowColors(false); setShowPen(false); }} style={[s.segBtn, on && s.toolOn]} accessibilityLabel={`Narzędzie: ${label}`}>
                    <Icon size={15} color={on ? colors.bg.primary : colors.text.primary} />
                  </TouchableOpacity>
                );
              })}
            </View>
            {mode === 'draw' && (
              <>
                <View style={s.sep} />
                {/* Jedno narzędzie: ikona pióra/pędzla + kropka w kolorze i grubości; stuknięcie = panel. */}
                <TouchableOpacity onPress={() => { haptic.tap(); setShowColors(false); setShowPen((v) => !v); if (tool.eraser) setTool((t) => ({ ...t, eraser: false })); }}
                  style={[s.penBtn, !tool.eraser && s.toolOn]} accessibilityLabel={`${tool.brush ? 'Pędzel' : 'Pióro'} — zmień narzędzie i grubość`}>
                  {tool.brush ? <Brush size={15} color={!tool.eraser ? colors.bg.primary : colors.text.primary} /> : <PenLine size={15} color={!tool.eraser ? colors.bg.primary : colors.text.primary} />}
                  <View style={{ width: Math.max(4, tool.width * 0.9), height: Math.max(4, tool.width * 0.9), borderRadius: 8, backgroundColor: tool.color, borderWidth: 1, borderColor: 'rgba(127,127,127,0.6)' }} />
                </TouchableOpacity>
                {/* Palec rysuje / przewija — gdy appka wykryła S-Pena (inaczej palec zawsze rysuje). */}
                {penSeen && (
                  <TouchableOpacity onPress={() => { haptic.tap(); usePenStore.getState().set({ fingerScroll: !penFinger }); }}
                    style={[s.iconBtn, !penFinger && s.toolOn]} accessibilityLabel={penFinger ? 'Palec przewija — stuknij, żeby rysował' : 'Palec rysuje — stuknij, żeby przewijał'}>
                    <Hand size={15} color={!penFinger ? colors.bg.primary : colors.text.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { haptic.tap(); setTool((t) => ({ ...t, eraser: !t.eraser })); }} style={[s.iconBtn, tool.eraser && s.toolOn]} accessibilityLabel="Gumka">
                  <Eraser size={15} color={tool.eraser ? colors.bg.primary : colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { haptic.tap(); if (note.strokes.length) update(note.id, { strokes: note.strokes.slice(0, -1) }); }} style={s.iconBtn} accessibilityLabel="Cofnij">
                  <Undo2 size={15} color={note.strokes.length ? colors.text.primary : colors.text.muted} />
                </TouchableOpacity>
              </>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => { haptic.tap(); toggleGuide(); }} style={[s.iconBtn, guide && s.guideBtnOn]}
              accessibilityLabel={guide ? 'Ukryj linię kafelka Dashboardu' : 'Pokaż linię kafelka Dashboardu'}>
              {guide ? <Eye size={15} color={colors.text.primary} /> : <EyeOff size={15} color={colors.text.muted} />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {note.kind === 'list' && (
        <ScrollView style={{ marginBottom: kb }} contentContainerStyle={s.listWrap} keyboardShouldPersistTaps="handled">
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

      <FolderSheet mode={folderSheet} onClose={() => setFolderSheet(null)} />
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

  addPage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: spacing[3], marginVertical: spacing[3], paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border.default },
  addPageTxt: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  canvasBox: { flex: 1, marginHorizontal: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, overflow: 'hidden' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingTop: spacing[2] },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], height: 32, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  modeLabel: { fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  pressure: { flex: 1, textAlign: 'right', fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 6 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.bright, transform: [{ scale: 1.12 }] },
  sep: { width: 1, height: 22, backgroundColor: c.ui.line, marginHorizontal: 4 },
  toolBtn: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border.default },
  toolOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  moreColors: { borderColor: c.border.default, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  colorPanel: { paddingHorizontal: spacing[3], paddingBottom: spacing[2] },
  penPanel: { marginHorizontal: spacing[3], marginBottom: 6, padding: spacing[3], gap: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  penKinds: { flexDirection: 'row', gap: 6 },
  penKind: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  penKindOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  penKindTxt: { fontSize: 13, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  penKindDesc: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.text.muted },
  penWidths: { flexDirection: 'row', justifyContent: 'space-between' },
  penWidth: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  penWidthOn: { borderColor: c.text.bright, backgroundColor: c.ui.in2 },
  penPressure: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textAlign: 'center', marginTop: -4 },
  penBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 9, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  guide: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.text.muted, opacity: 0.45 },
  guideLabel: { position: 'absolute', right: spacing[3], top: -16, fontSize: 9.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  guideBtn: { width: 40, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  guideBtnOn: { borderColor: c.text.muted },
  modeSwitch: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.ui.line },
  seg: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segBtn: { width: 32, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border.default },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  modeTabOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  modeTabLabel: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.text.primary },
  hint: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.text.muted, paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
}));

const usePressureLive = create<{ p: PressureInfo | null }>(() => ({ p: null }));
function PressureLabel({ brush, style }: { brush: boolean; style: any }) {
  const pressure = usePressureLive((st) => st.p);
  return (
    <Text style={style} numberOfLines={1}>
      {pressure
        ? (pressure.stylus ? `Nacisk rysika ${Math.round((pressure.pressure ?? 0) * 100)}% · ×${pressure.factor.toFixed(2).replace('.', ',')}` : `Palec · grubość z szybkości ×${pressure.factor.toFixed(2).replace('.', ',')}`)
        : brush ? 'Rysuj S-Penem — mocniej = grubiej' : ''}
    </Text>
  );
}
