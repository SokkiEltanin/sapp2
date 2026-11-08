import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Check, X, Landmark, Zap, Sparkles, AlertTriangle, Plus, BookmarkPlus, History } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useBankQueue, type PendingBankTx } from '@/store/bankQueueStore';
import { commitBankTx } from '@/services/bankCommit';
import { loadMerchantMemory, saveMerchant, setMerchantAuto, AUTO_THRESHOLD, type MerchantMemory } from '@/utils/merchantMemory';
import { haptic } from '@/utils/haptics';

// Port z sapp (app/bank-review.tsx), styl sapp2 (themedStyles, bez PressableScale/
// haptyki/toastów — żadnego z nich appka jeszcze nie ma). Największa różnica: sapp ma
// sztywną listę kategorii (CATS) do wyboru dla wydatku — sapp2 zamiast tego edytuje
// WOLNE `tags`, ten sam wzorzec tag-input co w AddExpenseModal.tsx (pole + "+"
// + chipy do usunięcia). Walutę obcą TEN ekran dalej pokazuje tylko jako ostrzeżenie
// (brak edytowalnego pola kwoty tutaj) — realne przeliczenie PLN dzieje się PO
// zatwierdzeniu, w AddExpenseModal.tsx (2026-11-09, `Expense.originalAmount`/
// `originalCurrency`, patrz bankCommit.ts).
//
// `submittingIds` — commity są teraz SYNCHRONICZNE (patrz bankCommit.ts, offline-first),
// więc wyścig wielokrotnego naciśnięcia który w sapp wymagał spinnera/10s-timeout jest
// w praktyce niemożliwy — ale blokada zostaje jako tania, darmowa ochrona przed
// podwójnym tapem w tej samej klatce.
const curLabel = (cur?: string) => (!cur || cur === 'PLN') ? 'zł' : cur;

export default function BankReview() {
  const s = makeS();
  const { pending, update, remove, updateHistoryEntry } = useBankQueue();
  const [mem, setMem] = useState<MerchantMemory>({});
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

  const reloadMem = useCallback(() => { loadMerchantMemory().then(setMem).catch(() => {}); }, []);
  useFocusEffect(reloadMem);

  const addTag = (p: PendingBankTx) => {
    const t = (tagDrafts[p.id] ?? '').trim();
    if (t && !p.tags.includes(t)) { haptic.tap(); update(p.id, { tags: [...p.tags, t] }); }
    setTagDrafts((d) => ({ ...d, [p.id]: '' }));
  };
  const removeTag = (p: PendingBankTx, t: string) => { haptic.tap(); update(p.id, { tags: p.tags.filter((x) => x !== t) }); };

  const accept = async (p: PendingBankTx) => {
    if (submittingIds.has(p.id)) return;
    haptic.success();
    setSubmittingIds((prev) => new Set(prev).add(p.id));
    try {
      const corrected = JSON.stringify([...p.tags].sort()) !== JSON.stringify([...p.suggestedTags].sort());
      const res = await commitBankTx(p, { corrected });
      if (res.ok) {
        updateHistoryEntry(p.id, { tags: p.tags, matched: res.matched, expenseId: res.expenseId });
        reloadMem();
        remove(p.id);
      }
    } finally {
      setSubmittingIds((prev) => { if (!prev.has(p.id)) return prev; const next = new Set(prev); next.delete(p.id); return next; });
    }
  };

  const reject = (p: PendingBankTx) => { haptic.tap(); remove(p.id); };
  const revoke = (storeKey: string) => { haptic.tap(); setMerchantAuto(storeKey, false).then(reloadMem).catch(() => {}); };

  // "Stwórz szablon z tego" (2026-11-01, user: "stworzyć szablon z wyłapanych") —
  // zamiast budować DRUGI, równoległy mechanizm dopasowywania (sapp miał tu osobny
  // bankRulesStore/"szablony powiadomień"), przyspiesza ISTNIEJĄCY mechanizm
  // zaufania sprzedawcy: normalnie sklep awansuje na automat po AUTO_THRESHOLD
  // czystych akceptacjach — tu user jawnie, jednym tapem, nadaje go OD RAZU z
  // aktualnie ustawionymi tagami. Kolejna płatność z tego sklepu (ten sam storeKey)
  // już go złapie i zaksięguje automatycznie — to jest "szablon" w słowniku appki.
  const createTemplate = (p: PendingBankTx) => {
    haptic.success();
    saveMerchant(p.storeKey, { tags: p.tags, name: p.store })
      .then(() => setMerchantAuto(p.storeKey, true))
      .then(reloadMem)
      .catch(() => {});
  };

  // Sklepy, które awansowały na autopilota — pokazane żeby user mógł cofnąć zaufanie.
  const autoMerchants = useMemo(
    () => Object.entries(mem).filter(([, v]) => v.auto).map(([k, v]) => ({ key: k, name: v.name || k })),
    [mem],
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Płatności z banku</Text>
        <TouchableOpacity onPress={() => router.push('/bank-history' as any)} style={s.backBtn} hitSlop={8}>
          <History size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {pending.length === 0 && (
          <View style={s.empty}>
            <Landmark size={30} color={colors.text.muted} />
            <Text style={s.emptyText}>
              Brak nic do zatwierdzenia. Gdy zapłacisz kartą lub wpłynie przelew,
              powiadomienie z banku pojawi się tu automatycznie.
            </Text>
          </View>
        )}

        {pending.map((p) => {
          const d = new Date(p.dateISO);
          const info = mem[p.storeKey];
          const accepts = info?.cleanAccepts ?? 0;
          const isIn = p.direction === 'in';
          const foreign = !!p.currency && p.currency !== 'PLN';
          const submitting = submittingIds.has(p.id);
          return (
            <View key={p.id} style={[s.card, p.flagReason && s.cardFlagged]}>
              {p.flagReason && (
                <View style={s.flagRow}>
                  <AlertTriangle size={13} color="#FBBF24" />
                  <Text style={s.flagText}>{p.flagReason}</Text>
                </View>
              )}
              <View style={s.cardTop}>
                <Text style={[s.amount, isIn && s.amountIncome]}>
                  {isIn ? '+' : ''}{p.amount.toFixed(2)} {curLabel(p.currency)}
                </Text>
                <Text style={s.time}>
                  {d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · {d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              {/* 2026-11-09, user: "jak obca waluta niech się nie liczy bezpośrednio
                  tylko po kliknięciu trzeba wprowadzić ile to w PLN żeby zapisać" —
                  zatwierdzenie TEŻ idzie przez `commitBankTx`'s `isForeign` ścieżkę
                  (bankCommit.ts), więc ten tekst musi mówić to samo co dzieje się
                  naprawdę: kwota=0 dopóki user nie wpisze PLN w edycji wydatku. */}
              {foreign && <Text style={s.fxHint}>Waluta obca — zostanie dodana z kwotą 0 zł, otwórz ją potem w Finansach i wpisz realną kwotę w PLN.</Text>}

              <Text style={s.fieldLabel}>{isIn ? 'Nadawca / tytuł' : 'Sklep'}</Text>
              <TextInput
                value={p.store}
                onChangeText={(v) => update(p.id, { store: v })}
                style={s.input}
                placeholderTextColor={colors.text.muted}
                placeholder={isIn ? 'Nadawca' : 'Sklep'}
              />

              {isIn ? (
                <TouchableOpacity
                  onPress={() => update(p.id, { isPaycheck: !p.isPaycheck })}
                  style={[s.jdToggle, p.isPaycheck && s.jdToggleOn]}
                  activeOpacity={0.85}
                >
                  <Zap size={14} color={p.isPaycheck ? colors.bg.primary : colors.accent.green} />
                  <Text style={[s.jdText, p.isPaycheck && s.jdTextOn]}>
                    {p.isPaycheck ? 'Wypłata z pracy ✓' : 'To zwykły przychód (stuknij = wypłata)'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={s.fieldLabel}>Tagi</Text>
                  <View style={s.tagInputRow}>
                    <TextInput
                      value={tagDrafts[p.id] ?? ''}
                      onChangeText={(v) => setTagDrafts((d2) => ({ ...d2, [p.id]: v }))}
                      placeholder="np. Spożywcze, Transport…"
                      placeholderTextColor={colors.text.muted}
                      style={s.tagInputField}
                      onSubmitEditing={() => addTag(p)}
                      returnKeyType="done"
                    />
                    <TouchableOpacity style={s.tagAddBtn} onPress={() => addTag(p)} activeOpacity={0.7}>
                      <Plus size={14} color={colors.bg.primary} />
                    </TouchableOpacity>
                  </View>
                  {p.tags.length > 0 && (
                    <View style={s.chips}>
                      {p.tags.map((t) => (
                        <TouchableOpacity key={t} style={s.tagChip} onPress={() => removeTag(p, t)} activeOpacity={0.7}>
                          <Text style={s.tagChipLabel}>{t}</Text>
                          <X size={10} color={colors.bg.primary} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {info?.auto ? (
                    <View style={s.trustRow}>
                      <Zap size={13} color={colors.accent.green} />
                      <Text style={s.trustAuto}>Sklep na automacie — kolejne dodam sam</Text>
                    </View>
                  ) : (
                    <>
                      <View style={s.trustRow}>
                        <Sparkles size={13} color={colors.text.muted} />
                        <Text style={s.trustText}>Zaufanie {accepts}/{AUTO_THRESHOLD} → automat</Text>
                        <View style={s.trustBar}>
                          <View style={[s.trustFill, { width: `${Math.min(100, (accepts / AUTO_THRESHOLD) * 100)}%` }]} />
                        </View>
                      </View>
                      <TouchableOpacity style={s.templateBtn} onPress={() => createTemplate(p)} activeOpacity={0.8}>
                        <BookmarkPlus size={13} color={colors.text.secondary} />
                        <Text style={s.templateBtnText}>Stwórz szablon z tego (automat od razu)</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}

              <View style={s.actions}>
                <TouchableOpacity style={[s.actBtn, s.rejectBtn]} onPress={() => reject(p)} activeOpacity={0.85} disabled={submitting}>
                  <X size={16} color={colors.accent.red} />
                  <Text style={[s.actText, { color: colors.accent.red }]}>Odrzuć</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, s.acceptBtn, submitting && s.acceptBtnDisabled]} onPress={() => accept(p)} activeOpacity={0.85} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color={colors.bg.primary} /> : <Check size={16} color={colors.bg.primary} />}
                  <Text style={[s.actText, { color: colors.bg.primary }]}>{submitting ? 'Dodaję…' : 'Zatwierdź'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {autoMerchants.length > 0 && (
          <View style={s.trusted}>
            <View style={s.trustedHead}>
              <Zap size={16} color={colors.accent.green} />
              <Text style={s.trustedTitle}>Zaufane sklepy (automat)</Text>
            </View>
            <Text style={s.trustedSub}>Płatności z tych sklepów dodaję automatycznie. Stuknij ×, by wrócić do ręcznej akceptacji.</Text>
            {autoMerchants.map((m) => (
              <View key={m.key} style={s.trustedRow}>
                <Text style={s.trustedName} numberOfLines={1}>{m.name}</Text>
                <TouchableOpacity onPress={() => revoke(m.key)} style={s.trustedRevoke} activeOpacity={0.8} hitSlop={8}>
                  <X size={15} color={colors.text.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', maxWidth: 280, lineHeight: 19 },

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  cardFlagged: { borderColor: '#FBBF2455' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FBBF2414', borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 6, marginBottom: spacing[2] },
  flagText: { flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FBBF24' },
  fxHint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: spacing[2] },

  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  amount: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.primary, letterSpacing: -0.5 },
  amountIncome: { color: c.accent.green },
  time: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.muted },

  fieldLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing[3], marginBottom: spacing[1] },
  input: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_500Medium', color: c.text.primary },

  tagInputRow: { flexDirection: 'row', gap: spacing[2] },
  tagInputField: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: 10,
  },
  tagAddBtn: { width: 40, borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.text.bright, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6,
  },
  tagChipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.bg.primary },

  jdToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing[3],
    paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: '#2AC68F55', backgroundColor: '#2AC68F14',
  },
  jdToggleOn: { backgroundColor: c.accent.green, borderColor: c.accent.green },
  jdText: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.accent.green },
  jdTextOn: { color: c.bg.primary },

  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[3] },
  trustText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  trustAuto: { fontSize: 11.5, fontFamily: 'Inter_900Black', color: c.accent.green },
  trustBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: c.border.default, overflow: 'hidden', marginLeft: 4 },
  trustFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent.green },
  templateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing[2],
    paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  templateBtnText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },

  trusted: { marginTop: spacing[4], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  trustedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustedTitle: { fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.primary },
  trustedSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.text.muted, lineHeight: 17, marginTop: spacing[1], marginBottom: spacing[2] },
  trustedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border.default },
  trustedName: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  trustedRevoke: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: c.bg.elevated },

  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg },
  rejectBtn: { borderWidth: 1, borderColor: `${colors.accent.red}55`, backgroundColor: `${colors.accent.red}12` },
  acceptBtn: { backgroundColor: c.text.bright },
  acceptBtnDisabled: { opacity: 0.6 },
  actText: { fontSize: 14, fontFamily: 'Inter_900Black' },
}));
