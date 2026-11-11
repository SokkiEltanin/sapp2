import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Undo2, BookmarkPlus, Trash2, Landmark, AlertTriangle, Zap, ChevronRight } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { useBankQueue, type BankIngestHistoryEntry } from '@/store/bankQueueStore';
import { undoBankHistoryEntry } from '@/services/bankCommit';
import { loadMerchantMemory, merchantFor, type MerchantMemory } from '@/utils/merchantMemory';
import MerchantTemplateSheet, { type TemplateTarget } from '@/components/finances/MerchantTemplateSheet';
import { haptic } from '@/utils/haptics';

// Ekran "Historia" (2026-11-01, user: "mam nadzieję że zrobiłeś w zatwierdzeniu
// historię żebym mógł cofnąć albo stworzyć szablon z wyłapanych") — `history` w
// bankQueueStore.ts już istniał (log do wglądu), ale NIGDZIE nie był wyświetlany;
// ten ekran to pierwszy realny konsument. Dwie akcje per wpis:
// - "Cofnij" (tylko gdy `expenseId` ustawione, patrz bankCommit.ts/undoBankHistoryEntry)
//   — usuwa dodany wydatek (albo tylko odpina `bankMatched`, jeśli wpis był scalony
//   z już istniejącym), oznacza wpis jako cofnięty (zostaje widoczny, wyszarzony).
// - "Stwórz szablon z tego" — identyczna akcja co w bank-review.tsx, tylko tutaj
//   działająca z pozycji PRZESZŁEJ (już zaksięgowanej), nie z aktywnej kolejki.
const curLabel = (cur?: string) => (!cur || cur === 'PLN') ? 'zł' : cur;

export default function BankHistory() {
  const s = makeS();
  const { history, updateHistoryEntry } = useBankQueue();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Szablony = sklepy na automacie w merchantMemory (patrz MerchantTemplateSheet).
  // Stan z PAMIĘCI, nie z lokalnego Seta sesji — po powrocie na ekran widać
  // które już są szablonami.
  const [mem, setMem] = useState<MerchantMemory>({});
  const reloadMem = useCallback(() => { loadMerchantMemory().then(setMem).catch(() => {}); }, []);
  useEffect(() => { reloadMem(); }, [reloadMem]);
  const [templateTarget, setTemplateTarget] = useState<TemplateTarget | null>(null);
  const templates = useMemo(
    () => Object.entries(mem).filter(([, v]) => v.auto).map(([k, v]) => ({ key: k, name: v.name || k, tags: v.tags ?? [] })),
    [mem],
  );

  const setBusy = (id: string, v: boolean) => setBusyIds((prev) => {
    const next = new Set(prev);
    if (v) next.add(id); else next.delete(id);
    return next;
  });

  const undo = async (h: BankIngestHistoryEntry) => {
    if (busyIds.has(h.id)) return;
    haptic.tap();
    setBusy(h.id, true);
    try {
      await undoBankHistoryEntry(h);
    } finally {
      setBusy(h.id, false);
    }
  };

  const openTemplate = (h: BankIngestHistoryEntry) => {
    haptic.tap();
    const info = merchantFor(h.storeKey, mem);
    setTemplateTarget({ storeKey: h.storeKey, store: h.store, tags: info?.auto ? info.tags : h.tags, existing: !!info?.auto });
  };

  const clearAll = () => { haptic.tap(); useBankQueue.getState().clearHistory(); };

  const rows = useMemo(() => history, [history]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Historia</Text>
        <TouchableOpacity onPress={clearAll} style={s.backBtn} hitSlop={8} disabled={rows.length === 0}>
          <Trash2 size={18} color={rows.length === 0 ? colors.text.muted : colors.accent.red} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.tplCard}>
          <View style={s.tplHead}>
            <Zap size={15} color={colors.accent.green} />
            <Text style={s.tplTitle}>Szablony sklepów</Text>
          </View>
          <Text style={s.tplSub}>
            Płatności z tych sklepów appka dodaje sama, bez pytania, z podanymi tagami. Nowy szablon: „Stwórz szablon” przy pozycji niżej.
          </Text>
          {templates.length === 0 && <Text style={s.tplEmpty}>Brak szablonów.</Text>}
          {templates.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={s.tplRow}
              activeOpacity={0.7}
              onPress={() => { haptic.tap(); setTemplateTarget({ storeKey: t.key, store: t.name, tags: t.tags, existing: true }); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.tplName} numberOfLines={1}>{t.name}</Text>
                <Text style={s.tplTags} numberOfLines={1}>{t.tags.length ? t.tags.join(', ') : 'bez tagów'}</Text>
              </View>
              <ChevronRight size={16} color={colors.text.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {rows.length === 0 && (
          <View style={s.empty}>
            <Landmark size={30} color={colors.text.muted} />
            <Text style={s.emptyText}>Pusto — jak coś złapiemy z banku, log pojawi się tu.</Text>
          </View>
        )}

        {rows.map((h) => {
          const d = new Date(h.at);
          const isIn = h.direction === 'in';
          const canUndo = !!h.expenseId && !h.undone;
          const isTemplated = !!merchantFor(h.storeKey, mem)?.auto;
          return (
            <View key={h.id} style={[s.card, h.undone && s.cardUndone]}>
              {h.flagReason && (
                <View style={s.flagRow}>
                  <AlertTriangle size={12} color="#FBBF24" />
                  <Text style={s.flagText} numberOfLines={1}>{h.flagReason}</Text>
                </View>
              )}
              <View style={s.top}>
                <Text style={s.store} numberOfLines={1}>{h.store || (isIn ? 'Przychód' : 'Płatność')}</Text>
                <Text style={[s.amount, isIn && s.amountIncome]}>
                  {isIn ? '+' : ''}{h.amount.toFixed(2)} {curLabel(h.currency)}
                </Text>
              </View>
              <Text style={s.time}>
                {d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · {d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                {h.auto ? ' · automat' : ''}
                {h.undone ? ' · cofnięte' : ''}
              </Text>
              {h.tags.length > 0 && (
                <View style={s.chips}>
                  {h.tags.map((t) => (
                    <View key={t} style={s.chip}><Text style={s.chipLabel}>{t}</Text></View>
                  ))}
                </View>
              )}

              {!h.undone && (
                <View style={s.actions}>
                  {canUndo && (
                    <TouchableOpacity style={s.actBtn} onPress={() => undo(h)} activeOpacity={0.8} disabled={busyIds.has(h.id)}>
                      <Undo2 size={13} color={colors.text.secondary} />
                      <Text style={s.actText}>Cofnij</Text>
                    </TouchableOpacity>
                  )}
                  {!isIn && h.storeKey && (
                    <TouchableOpacity style={s.actBtn} onPress={() => openTemplate(h)} activeOpacity={0.8}>
                      <BookmarkPlus size={13} color={isTemplated ? colors.accent.green : colors.text.secondary} />
                      <Text style={[s.actText, isTemplated && { color: colors.accent.green }]}>
                        {isTemplated ? 'Szablon · edytuj' : 'Stwórz szablon'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
      <MerchantTemplateSheet target={templateTarget} onClose={() => setTemplateTarget(null)} onSaved={reloadMem} />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_900Black', color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.muted, textAlign: 'center', maxWidth: 280, lineHeight: 19 },

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  cardUndone: { opacity: 0.55 },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FBBF2414', borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 5, marginBottom: spacing[2] },
  flagText: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FBBF24' },

  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  store: { flex: 1, fontSize: 15, fontFamily: 'Inter_900Black', color: c.text.primary },
  amount: { fontSize: 16, fontFamily: 'Inter_900Black', color: c.text.primary },
  amountIncome: { color: c.accent.green },
  time: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted, marginTop: 2 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[2] },
  chip: { backgroundColor: c.bg.elevated, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 4, borderWidth: 1, borderColor: c.border.default },
  chipLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },

  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  actBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: spacing[3],
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated,
  },
  tplCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[4], gap: spacing[2] },
  tplHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  tplTitle: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.text.primary },
  tplSub: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted, lineHeight: 16 },
  tplEmpty: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.muted },
  tplRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.default },
  tplName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text.primary },
  tplTags: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text.muted, marginTop: 1 },
  actText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
}));
