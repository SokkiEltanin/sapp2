import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Zap, X, Check } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import AppBottomSheet from '@/components/design/AppBottomSheet';
import { useExpensesStore } from '@/store/expensesStore';
import { saveMerchant, setMerchantAuto, guessTags } from '@/utils/merchantMemory';
import { haptic } from '@/utils/haptics';

// Formularz szablonu sklepu (2026-11-11, user: "jak zapisuję szablony... co to
// zmienia? Klikam utwórz szablon i pisze szablon utworzony. Nawet nic nie
// wypełniłem. Nawet nie ma żadnego formularza"). "Szablon" w sapp2 = sklep na
// AUTOMACIE w merchantMemory (patrz bank-review.tsx's komentarz przy
// createTemplate): kolejna płatność z tym samym storeKey księguje się sama z tymi
// tagami. Wcześniej jeden tap robił to po cichu — teraz sheet mówi CO się stanie
// i pozwala ustawić tagi przed zapisem. Wspólny dla bank-history i bank-review.
export interface TemplateTarget {
  storeKey: string;
  store: string;
  tags: string[];
  existing?: boolean; // już jest szablonem → "Zapisz zmiany" + "Usuń szablon"
}

export default function MerchantTemplateSheet({ target, onClose, onSaved }: {
  target: TemplateTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const s = makeS();
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const expenses = useExpensesStore((st) => st.expenses);

  useEffect(() => {
    if (target) { setTags(target.tags.length ? target.tags : guessTags(target.store)); setDraft(''); }
  }, [target]);

  // Podpowiedzi = najczęstsze tagi z własnych wydatków (to samo słownictwo co w
  // reszcie appki), bez już wybranych.
  const suggestions = useMemo(() => {
    const count: Record<string, number> = {};
    for (const e of expenses) for (const t of e.tags ?? []) if (!t.startsWith('[')) count[t] = (count[t] ?? 0) + 1;
    const lower = new Set(tags.map((t) => t.toLowerCase()));
    return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t]) => t).filter((t) => !lower.has(t.toLowerCase())).slice(0, 8);
  }, [expenses, tags]);

  const addTag = (t: string) => {
    const v = t.trim();
    if (!v || tags.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    haptic.tap();
    setTags((prev) => [...prev, v]);
    setDraft('');
  };

  const save = async () => {
    if (!target || busy) return;
    const finalTags = draft.trim() ? [...tags, draft.trim()] : tags;
    setBusy(true);
    try {
      await saveMerchant(target.storeKey, { tags: finalTags, name: target.store });
      await setMerchantAuto(target.storeKey, true);
      haptic.success();
      onSaved();
      onClose();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await setMerchantAuto(target.storeKey, false);
      haptic.tap();
      onSaved();
      onClose();
    } finally { setBusy(false); }
  };

  const footer = (
    <View style={s.actions}>
      {target?.existing ? (
        <TouchableOpacity style={s.ghostBtn} onPress={remove} activeOpacity={0.8}>
          <Text style={[s.ghostLabel, { color: colors.accent.red }]}>Usuń szablon</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.ghostBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={s.ghostLabel}>Anuluj</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[s.saveBtn, busy && { opacity: 0.5 }]} onPress={save} activeOpacity={0.8} disabled={busy}>
        <Check size={15} color={colors.bg.primary} />
        <Text style={s.saveLabel}>{target?.existing ? 'Zapisz zmiany' : 'Zapisz szablon'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AppBottomSheet visible={!!target} onClose={onClose} footer={footer}>
      <View style={s.head}>
        <Zap size={16} color={colors.accent.green} />
        <Text style={s.title} numberOfLines={1}>Szablon: {target?.store}</Text>
      </View>
      <Text style={s.explain}>
        Kolejne płatności z tego sklepu (powiadomienie z banku) appka doda SAMA, bez pytania o zatwierdzenie — z tagami poniżej. Szablon możesz w każdej chwili zmienić albo usunąć w Historii.
      </Text>

      <Text style={s.label}>Tagi</Text>
      <View style={s.chips}>
        {tags.map((t) => (
          <TouchableOpacity key={t} style={[s.chip, s.chipOn]} onPress={() => { haptic.tap(); setTags((prev) => prev.filter((x) => x !== t)); }} activeOpacity={0.7}>
            <Text style={[s.chipLabel, s.chipLabelOn]}>{t}</Text>
            <X size={11} color={colors.bg.primary} />
          </TouchableOpacity>
        ))}
        {tags.length === 0 && <Text style={s.noTags}>bez tagów</Text>}
      </View>
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => addTag(draft)}
        blurOnSubmit={false}
        returnKeyType="done"
        placeholder="dopisz tag i Enter"
        placeholderTextColor={colors.text.muted}
        style={s.input}
        autoCapitalize="none"
      />
      {suggestions.length > 0 && (
        <View style={s.chips}>
          {suggestions.map((t) => (
            <TouchableOpacity key={t} style={s.chip} onPress={() => addTag(t)} activeOpacity={0.7}>
              <Text style={s.chipLabel}>+ {t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </AppBottomSheet>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  explain: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, lineHeight: 17, marginTop: spacing[2] },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  chipOn: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelOn: { color: c.bg.primary },
  noTags: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, paddingVertical: 6 },
  input: {
    marginTop: spacing[2], borderWidth: 1, borderColor: c.border.default, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary,
  },
  actions: { flexDirection: 'row', gap: spacing[2] },
  ghostBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, justifyContent: 'center' },
  ghostLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.muted },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[3] },
  saveLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.bg.primary },
}));
