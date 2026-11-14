import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Check, Trash2, Folder, FolderX } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useNotesStore } from '@/store/notesStore';
import type { NoteFolder } from '@/types/notes';
import { offerUndo } from '@/services/undo';
import { haptic } from '@/utils/haptics';

// Katalogi notatek (2026-11-14): nowy / edycja (nazwa, kolor, usuń — notatki zostają,
// trafiają do "Bez katalogu", z "Cofnij") / wybór katalogu dla notatki.
export const FOLDER_COLORS = ['#F2F2F2', '#F87171', '#FB923C', '#FBBF24', '#4ADE80', '#2DD4BF', '#60A5FA', '#A78BFA', '#F472B6'];

export type FolderSheetMode =
  | { kind: 'new'; onCreated?: (f: NoteFolder) => void }
  | { kind: 'edit'; folder: NoteFolder; onDeleted?: () => void }
  | { kind: 'pick'; noteId: string; current: string | null };

export default function FolderSheet({ mode, onClose }: { mode: FolderSheetMode | null; onClose: () => void }) {
  const s = makeS();
  const folders = useNotesStore((st) => st.folders);
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[6]);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setConfirmDel(false);
    if (mode.kind === 'edit') { setName(mode.folder.name); setColor(mode.folder.color); }
    else { setName(''); setColor(FOLDER_COLORS[(folders.length + 6) % FOLDER_COLORS.length]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const save = () => {
    if (!mode || !name.trim()) return;
    haptic.success();
    const st = useNotesStore.getState();
    if (mode.kind === 'edit') st.updateFolder(mode.folder.id, { name, color });
    else if (mode.kind === 'new') mode.onCreated?.(st.addFolder(name, color));
    else { const f = st.addFolder(name, color); st.moveNote(mode.noteId, f.id); }
    onClose();
  };

  const del = () => {
    if (!mode || mode.kind !== 'edit') return;
    if (!confirmDel) { haptic.tap(); setConfirmDel(true); return; }
    haptic.warn();
    const st = useNotesStore.getState();
    const folder = mode.folder;
    const members = st.notes.filter((n) => n.folderId === folder.id).map((n) => n.id);
    st.removeFolder(folder.id);
    offerUndo(`Usunięto katalog: ${folder.name}`, () => {
      const cur = useNotesStore.getState();
      if (!cur.folders.some((f) => f.id === folder.id)) useNotesStore.setState({ folders: [...cur.folders, { ...folder, updatedAt: new Date().toISOString() }] });
      for (const id of members) useNotesStore.getState().moveNote(id, folder.id);
    });
    mode.onDeleted?.();
    onClose();
  };

  const pick = (folderId: string | null) => {
    if (!mode || mode.kind !== 'pick') return;
    haptic.tap();
    useNotesStore.getState().moveNote(mode.noteId, folderId);
    onClose();
  };

  const title = !mode ? '' : mode.kind === 'edit' ? 'Edytuj katalog' : mode.kind === 'new' ? 'Nowy katalog' : 'Przenieś do katalogu';

  return (
    <AppBottomSheet visible={!!mode} onClose={onClose} header={<Text style={s.title}>{title}</Text>}>
      {mode?.kind === 'pick' && (
        <View style={s.pickList}>
          <TouchableOpacity style={s.pickRow} onPress={() => pick(null)}>
            <FolderX size={16} color={colors.text.muted} />
            <Text style={s.pickLabel}>Bez katalogu</Text>
            {!mode.current && <Check size={16} color={colors.text.primary} />}
          </TouchableOpacity>
          {folders.map((f) => (
            <TouchableOpacity key={f.id} style={s.pickRow} onPress={() => pick(f.id)}>
              <Folder size={16} color={f.color} />
              <Text style={s.pickLabel} numberOfLines={1}>{f.name}</Text>
              {mode.current === f.id && <Check size={16} color={colors.text.primary} />}
            </TouchableOpacity>
          ))}
          <Text style={s.group}>albo nowy</Text>
        </View>
      )}

      <View style={s.nameRow}>
        <Folder size={18} color={color} />
        <TextInput value={name} onChangeText={setName} placeholder="Nazwa, np. Praca, Dom, Pomysły" placeholderTextColor={colors.text.muted}
          style={s.input} autoFocus={mode?.kind !== 'pick'} onSubmitEditing={save} returnKeyType="done" />
      </View>
      <View style={s.swatches}>
        {FOLDER_COLORS.map((c) => (
          <TouchableOpacity key={c} onPress={() => { haptic.tap(); setColor(c); }} style={[s.swatch, { backgroundColor: c }, color === c && s.swatchOn]} accessibilityLabel={`Kolor ${c}`} />
        ))}
      </View>
      <View style={s.actions}>
        {mode?.kind === 'edit' && (
          <TouchableOpacity style={[s.delBtn, confirmDel && s.delOn]} onPress={del}>
            <Trash2 size={15} color={confirmDel ? colors.bg.primary : colors.accent.red} />
            <Text style={[s.delLabel, confirmDel && { color: colors.bg.primary }]}>{confirmDel ? 'Na pewno? Notatki zostaną' : 'Usuń'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.saveBtn, !name.trim() && { opacity: 0.35 }]} onPress={save} disabled={!name.trim()}>
          <Check size={15} color={colors.bg.primary} />
          <Text style={s.saveLabel}>{mode?.kind === 'edit' ? 'Zapisz' : mode?.kind === 'pick' ? 'Utwórz i przenieś' : 'Utwórz'}</Text>
        </TouchableOpacity>
      </View>
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  title: { fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary, paddingBottom: spacing[2] },
  pickList: { marginBottom: spacing[2] },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.ui.line },
  pickLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  group: { fontSize: 10.5, fontFamily: 'Inter_800ExtraBold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[3] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md, paddingHorizontal: spacing[3] },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.primary },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing[3] },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.bright, transform: [{ scale: 1.1 }] },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: c.accent.red + '66' },
  delOn: { backgroundColor: c.accent.red, borderColor: c.accent.red },
  delLabel: { fontSize: 12.5, fontFamily: 'Inter_800ExtraBold', color: c.accent.red },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.md, backgroundColor: c.text.bright },
  saveLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
