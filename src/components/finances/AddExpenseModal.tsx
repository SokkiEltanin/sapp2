import { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { X, Receipt, Banknote, ClipboardPaste, Plus, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { todayISO, ymd } from '@/utils/date';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { parseReceiptText } from '@/utils/receiptParser';
import { useExpensesStore } from '@/store/expensesStore';
import {
  loadNameAliases, canonicalProductName, loadFoodSubcatMemory, applyFoodSubcatMemory,
  loadPriceMemory, savePriceMemory, saveFoodSubcatMemory, type PriceMemory,
} from '@/utils/productMemory';
import { buildProductCatalog } from '@/utils/productCatalog';
import type { Expense, ReceiptItem, PaymentMethod, FvBucket } from '@/types/finances';
import ReceiptItemRow from './ReceiptItemRow';

// "Jeden ujednolicony dodaj" (ARCHITECTURE.md §FINANSE, decyzja 2026-10-26) — PASTE
// paragonu i RĘCZNE dodawanie pozycji nie są dwoma osobnymi ekranami (jak w sapp:
// scan.tsx vs manual.tsx), tylko JEDNĄ listą pozycji: paste ją wypełnia automatycznie,
// "+ Dodaj pozycję" dopisuje ręcznie — oba na tym samym, wspólnym `ReceiptItemRow`.
// Brak pozycji wcale → pole "Kwota" odkrywa się jako zwykły szybki wydatek (czynsz,
// paliwo) bez rozbijania na produkty — user nie jest zmuszony do paragonu, żeby
// zapisać jedną liczbę.
function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const FV_CHOICES: { key: FvBucket | 'auto'; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'fixed', label: 'Stałe' },
  { key: 'variable', label: 'Zmienne' },
  { key: 'food', label: 'Jedzenie' },
];

const PAYMENT_CHOICES: { key: PaymentMethod; label: string }[] = [
  { key: 'card', label: 'Karta' },
  { key: 'blik', label: 'BLIK' },
  { key: 'cash', label: 'Gotówka' },
  { key: 'transfer', label: 'Przelew' },
];
const PAYMENT_LABEL: Record<PaymentMethod, string> = Object.fromEntries(PAYMENT_CHOICES.map((p) => [p.key, p.label])) as Record<PaymentMethod, string>;
const PAYER_CHOICES: { key: 'me' | 'partner'; label: string }[] = [
  { key: 'me', label: 'Ja' },
  { key: 'partner', label: 'Olesia' },
];

export default function AddExpenseModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeS();
  const expenses = useExpensesStore((st) => st.expenses);
  const addExpense = useExpensesStore((st) => st.addExpense);
  const kb = useKeyboardHeight();

  // Pamięć produktowa (Faza 2.1, dotąd nieużywana — zamykany gap z Faza 2.2, user:
  // "wpisuję nazwę... sugeruje... klikam, cena się uzupełnia"). Wczytywana raz na
  // otwarcie modala: aliasy nazw (2026-10-31 scalenia z `ProductsModal`), pamięć
  // podkategorii jedzenia, pamięć cen (anomalie w `ReceiptItemRow`), znane nazwy
  // (katalog, do `suggestSimilarName` w `ReceiptItemRow`).
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [priceMemory, setPriceMemory] = useState<PriceMemory>({});
  const [foodSubcatMemory, setFoodSubcatMemory] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!visible) return;
    loadNameAliases().then(setAliases);
    loadPriceMemory().then(setPriceMemory);
    loadFoodSubcatMemory().then(setFoodSubcatMemory);
  }, [visible]);
  const knownNames = useMemo(() => buildProductCatalog(expenses, aliases).map((p) => p.label), [expenses, aliases]);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [pasteText, setPasteText] = useState('');
  const [usedPaste, setUsedPaste] = useState(false);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [parsedTotal, setParsedTotal] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [note, setNote] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [payer, setPayer] = useState<'me' | 'partner'>('me');
  const [paidOpen, setPaidOpen] = useState(false);
  const [fvChoice, setFvChoice] = useState<FvBucket | 'auto'>('auto');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const reset = () => {
    setType('expense'); setPasteText(''); setUsedPaste(false); setItems([]); setParsedTotal(0);
    setStoreName(''); setNote(''); setAmountInput(''); setDate(todayISO()); setPaymentMethod('card');
    setPayer('me'); setPaidOpen(false); setFvChoice('auto'); setTags([]); setTagInput('');
  };

  const handleClose = () => { reset(); onClose(); };

  // Rdzeń rozpoznawania, wspólny dla ręcznego "Rozpoznaj" i szybkiej wklejki ze
  // schowka (patrz `handlePasteFromClipboard` niżej) — żeby nie duplikować logiki.
  // Pamięć nauczona z poprzednich paragonów podpięta TUTAJ (nie było jej wcale w
  // Fazie 2.2): `canonicalProductName` naprawia nazwę przez znane aliasy/marki
  // (np. "jezykicherry" → "Jeżyki") OD RAZU, bez pytania — to są TWARDE zasady,
  // nie niepewne sugestie. `applyFoodSubcatMemory` to tylko FALLBACK dla pozycji,
  // których słownik słów-kluczowych (`receiptParser.ts`) nie rozpoznał wcale —
  // nigdy nie nadpisuje trafienia, które parser już znalazł.
  const runParse = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const r = parseReceiptText(trimmed);
    const names = r.items.map((it) => canonicalProductName(it.name, aliases));
    const fallbackSubcats = applyFoodSubcatMemory(names, foodSubcatMemory);
    setItems(r.items.map((it, i) => ({
      ...it,
      name: names[i],
      foodSubcat: it.foodSubcat ?? fallbackSubcats[i],
      excluded: it.suspect ?? false,
    })));
    if (r.storeName) setStoreName(r.storeName);
    if (r.date) setDate(r.date);
    setParsedTotal(r.total);
    setPaymentMethod(r.paymentMethod);
    setUsedPaste(true);
  };
  const handleParse = () => runParse(pasteText);

  // Pływający przycisk "wklej i rozpoznaj" (user, 2026-11-01: "zeby ten parser
  // paragonow byl blizej prawego kciuka") — jedno tapnięcie w prawym dolnym rogu,
  // bez przewijania do góry i bez ręcznego wklejania w pole tekstowe. Pole paste
  // nad listą pozycji zostaje jako ścieżka zapasowa (np. tekst wpisany/zdyktowany,
  // nie skopiowany).
  const handlePasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text?.trim()) return;
    setPasteText(text);
    runParse(text);
  };

  const addBlankItem = () => setItems((prev) => [...prev, { name: '', price: 0, quantity: 1, unitPrice: 0 }]);
  const updateItem = (idx: number, patch: Partial<ReceiptItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const includedSum = round2(items.filter((it) => !it.excluded).reduce((sum, it) => sum + it.price, 0));
  const amount = items.length > 0 ? includedSum : (parseFloat(amountInput.replace(',', '.')) || 0);
  const mismatch = usedPaste && parsedTotal > 0 && Math.abs(includedSum - parsedTotal) > 0.01;
  const canSave = amount > 0;

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const expense: Expense = {
      id: genId(),
      type,
      amount,
      date,
      note: note.trim(),
      storeName: type === 'expense' && storeName.trim() ? storeName.trim() : undefined,
      tags,
      receiptItems: type === 'expense' && items.length > 0 ? items : undefined,
      source: usedPaste ? 'receipt' : 'manual',
      fvOverride: type === 'expense' && fvChoice !== 'auto' ? fvChoice : null,
      paymentMethod: type === 'expense' ? paymentMethod : undefined,
      payer: type === 'expense' && payer !== 'me' ? payer : undefined,
      createdAt: now,
      updatedAt: now,
    };
    addExpense(expense);
    // Zapis = moment nauki (było całkowicie brakujące w Fazie 2.2 — pamięć
    // istniała, ale nic jej nigdy nie zasilało). Tylko pozycje z realną nazwą/
    // ceną, kaucje pominięte (nie są "produktem" o typowej cenie).
    const realItems = items.filter((it) => it.name.trim() && it.kind !== 'deposit');
    if (realItems.length > 0) {
      saveFoodSubcatMemory(realItems.map((it) => ({ name: it.name, foodSubcat: it.foodSubcat })));
      savePriceMemory(realItems.filter((it) => it.unitPrice > 0).map((it) => ({ name: it.name, unitPrice: it.unitPrice })));
    }
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={handleClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* `paddingBottom: kb` zamiast `KeyboardAvoidingView` (user, 2026-11-01:
            "klawiatura nie zasłania tego co piszesz") — RN's `Modal` na Androidzie
            portuje treść do OSOBNEJ natywnej hierarchii, gdzie `KeyboardAvoidingView`/
            `windowSoftInputMode` bywa niewiarygodne (patrz useKeyboardHeight.ts,
            port z sapp). Płynie też do pływającego przycisku paste niżej, żeby
            wędrował razem z resztą treści, nie chował się pod klawiaturą. */}
        <View style={[s.flex1, { paddingBottom: kb }]}>
          <View style={s.header}>
            <Text style={s.title}>{type === 'expense' ? 'Nowy wydatek' : 'Nowy przychód'}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8} style={s.closeBtn}>
              <X size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.typeRow}>
              <TouchableOpacity
                style={[s.typeChip, type === 'expense' && s.typeChipActive]}
                onPress={() => setType('expense')}
                activeOpacity={0.7}
              >
                <Receipt size={14} color={type === 'expense' ? colors.bg.primary : colors.text.muted} />
                <Text style={[s.typeChipLabel, type === 'expense' && s.typeChipLabelActive]}>Wydatek</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.typeChip, type === 'income' && s.typeChipActive]}
                onPress={() => setType('income')}
                activeOpacity={0.7}
              >
                <Banknote size={14} color={type === 'income' ? colors.bg.primary : colors.text.muted} />
                <Text style={[s.typeChipLabel, type === 'income' && s.typeChipLabelActive]}>Przychód</Text>
              </TouchableOpacity>
            </View>

            {type === 'expense' && (
              <View style={s.section}>
                <Text style={s.label}>Wklej tekst paragonu</Text>
                <TextInput
                  value={pasteText}
                  onChangeText={setPasteText}
                  placeholder="Wklej tekst paragonu ze sklepu / SMS-a / aplikacji banku…"
                  placeholderTextColor={colors.text.muted}
                  style={s.pasteInput}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity style={[s.parseBtn, !pasteText.trim() && s.btnDisabled]} onPress={handleParse} disabled={!pasteText.trim()} activeOpacity={0.7}>
                  <ClipboardPaste size={14} color={colors.bg.primary} />
                  <Text style={s.parseBtnLabel}>Rozpoznaj paragon</Text>
                </TouchableOpacity>
              </View>
            )}

            {type === 'expense' && (
              <View style={s.section}>
                <Text style={s.label}>Sklep / firma</Text>
                <TextInput
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder="np. Lidl, Orlen…"
                  placeholderTextColor={colors.text.muted}
                  style={s.textInput}
                />
              </View>
            )}

            <View style={s.section}>
              <Text style={s.label}>Data</Text>
              <View style={s.chips}>
                {[{ key: 'today', label: 'Dziś', v: todayISO() }, { key: 'yesterday', label: 'Wczoraj', v: ymd(new Date(Date.now() - 86400000)) }].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.chip, date === opt.v && s.chipActive]}
                    onPress={() => setDate(opt.v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipLabel, date === opt.v && s.chipLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
                <View style={s.dateBadge}><Text style={s.dateBadgeLabel}>{date}</Text></View>
              </View>
            </View>

            {type === 'expense' && (
              <View style={s.section}>
                <View style={s.itemsHeader}>
                  <Text style={s.label}>Pozycje{items.length > 0 ? ` (${items.length})` : ''}</Text>
                  <TouchableOpacity style={s.addItemBtn} onPress={addBlankItem} activeOpacity={0.7}>
                    <Plus size={13} color={colors.text.bright} />
                    <Text style={s.addItemLabel}>Dodaj pozycję</Text>
                  </TouchableOpacity>
                </View>
                {items.map((it, idx) => (
                  <ReceiptItemRow
                    key={idx}
                    item={it}
                    onChange={(patch) => updateItem(idx, patch)}
                    onDelete={() => removeItem(idx)}
                    priceMemory={priceMemory}
                    knownNames={knownNames}
                  />
                ))}
                {items.length > 0 && (
                  <View style={s.sumRow}>
                    <Text style={s.sumLabel}>Suma pozycji</Text>
                    <Text style={s.sumValue}>{includedSum.toFixed(2)} zł</Text>
                  </View>
                )}
                {mismatch && (
                  <Text style={s.mismatchText}>
                    Na paragonie: {parsedTotal.toFixed(2)} zł — różnica {Math.abs(includedSum - parsedTotal).toFixed(2)} zł, sprawdź pozycje
                  </Text>
                )}
              </View>
            )}

            {(items.length === 0) && (
              <View style={s.section}>
                <Text style={s.label}>Kwota</Text>
                <View style={s.amountRow}>
                  <TextInput
                    value={amountInput}
                    onChangeText={setAmountInput}
                    placeholder="0,00"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="decimal-pad"
                    style={s.amountInput}
                  />
                  <Text style={s.currencyLg}>zł</Text>
                </View>
              </View>
            )}

            <View style={s.section}>
              <Text style={s.label}>Notatka</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="opcjonalny opis…"
                placeholderTextColor={colors.text.muted}
                style={s.textInput}
              />
            </View>

            {type === 'expense' && (
              <View style={s.section}>
                <Text style={s.label}>Rozlicz jako</Text>
                <View style={s.chips}>
                  {FV_CHOICES.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.chip, fvChoice === opt.key && s.chipActive]}
                      onPress={() => setFvChoice(opt.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipLabel, fvChoice === opt.key && s.chipLabelActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {type === 'expense' && (
              <View style={s.section}>
                {/* Zwinięte domyślnie (user, 2026-11-01: "ta opcja mniej widoczna po
                    rozwinięciu kto płacił i czym... żeby to miejsca nie zajmowało,
                    ale żeby dało się zmienić") — w 99% przypadków to "Ja · Karta",
                    więc nie zasługuje na stałe miejsce jak "Rozlicz jako" wyżej. */}
                <TouchableOpacity style={s.paidSummaryRow} onPress={() => setPaidOpen((v) => !v)} activeOpacity={0.7}>
                  <Text style={s.label}>
                    Zapłacono: {PAYER_CHOICES.find((p) => p.key === payer)?.label} · {PAYMENT_LABEL[paymentMethod]}
                  </Text>
                  {paidOpen ? <ChevronUp size={14} color={colors.text.muted} /> : <ChevronDown size={14} color={colors.text.muted} />}
                </TouchableOpacity>
                {paidOpen && (
                  <View style={s.paidDetail}>
                    <Text style={s.subLabel}>Kto płacił</Text>
                    <View style={s.chips}>
                      {PAYER_CHOICES.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[s.chip, payer === opt.key && s.chipActive]}
                          onPress={() => setPayer(opt.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.chipLabel, payer === opt.key && s.chipLabelActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={[s.subLabel, s.subLabelGap]}>Czym</Text>
                    <View style={s.chips}>
                      {PAYMENT_CHOICES.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[s.chip, paymentMethod === opt.key && s.chipActive]}
                          onPress={() => setPaymentMethod(opt.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.chipLabel, paymentMethod === opt.key && s.chipLabelActive]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={s.section}>
              <Text style={s.label}>Tagi</Text>
              <View style={s.tagInputRow}>
                <TextInput
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="np. Wakacje, Prezent…"
                  placeholderTextColor={colors.text.muted}
                  style={s.tagInputField}
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                />
                <TouchableOpacity style={s.tagAddBtn} onPress={addTag} activeOpacity={0.7}>
                  <Plus size={14} color={colors.bg.primary} />
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={s.chips}>
                  {tags.map((t) => (
                    <TouchableOpacity key={t} style={s.tagRemoveChip} onPress={() => removeTag(t)} activeOpacity={0.7}>
                      <Text style={s.tagRemoveLabel}>{t}</Text>
                      <X size={10} color={colors.bg.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={s.footer}>
            <View>
              <Text style={s.footerLabel}>{type === 'expense' ? 'Wydatek' : 'Przychód'}</Text>
              <Text style={s.footerAmount}>{amount.toFixed(2)} zł</Text>
            </View>
            <TouchableOpacity style={[s.saveBtn, !canSave && s.btnDisabled]} onPress={handleSave} disabled={!canSave} activeOpacity={0.7}>
              <Text style={s.saveLabel}>Zapisz</Text>
            </TouchableOpacity>
          </View>

          {type === 'expense' && (
            <TouchableOpacity style={s.pasteFab} onPress={handlePasteFromClipboard} activeOpacity={0.8} accessibilityLabel="Wklej ze schowka i rozpoznaj paragon">
              <ClipboardPaste size={20} color={colors.bg.primary} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  title: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.primary },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], gap: spacing[1] },

  typeRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  typeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: c.bg.card,
    borderWidth: 1, borderColor: c.border.default,
  },
  typeChipActive: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  typeChipLabel: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.text.muted },
  typeChipLabelActive: { color: c.bg.primary },

  section: { marginBottom: spacing[4] },
  label: {
    fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[2],
  },
  pasteInput: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3], minHeight: 90, marginBottom: spacing[2],
  },
  parseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.text.bright, borderRadius: radius.md, paddingVertical: spacing[2],
  },
  parseBtnLabel: { fontSize: 12.5, fontFamily: 'Inter_900Black', color: c.bg.primary },
  btnDisabled: { opacity: 0.35 },

  textInput: {
    fontSize: 13.5, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, borderRadius: radius.sm,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
  },
  chipActive: { backgroundColor: c.text.bright, borderColor: c.text.bright },
  chipLabel: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  chipLabelActive: { color: c.bg.primary },
  dateBadge: { paddingHorizontal: spacing[2], paddingVertical: 4 },
  dateBadgeLabel: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.text.muted },

  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.bg.card, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 5,
    borderWidth: 1, borderColor: c.border.default,
  },
  addItemLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.bright },
  sumRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing[1],
    borderTopWidth: 1, borderTopColor: c.border.subtle, marginTop: spacing[1],
  },
  sumLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text.secondary },
  sumValue: { fontSize: 13, fontFamily: 'Inter_900Black', color: c.text.bright },
  mismatchText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.accent.red, marginTop: spacing[1] },

  amountRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3],
  },
  amountInput: { flex: 1, fontSize: 22, fontFamily: 'Inter_900Black', color: c.text.bright, paddingVertical: spacing[2] },
  currencyLg: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text.muted },

  tagInputRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  tagInputField: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  tagAddBtn: {
    width: 40, borderRadius: radius.md, backgroundColor: c.text.bright, alignItems: 'center', justifyContent: 'center',
  },
  tagRemoveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.text.bright, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 4,
  },
  tagRemoveLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.bg.primary },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: c.border.default, backgroundColor: c.bg.primary,
  },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  footerAmount: { fontSize: 20, fontFamily: 'Inter_900Black', color: c.text.bright },
  saveBtn: { paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: c.text.bright },
  saveLabel: { fontSize: 14, fontFamily: 'Inter_900Black', color: c.bg.primary },

  // Pływający, zawsze pod prawym kciukiem — nad stopką z "Zapisz", nie na niej.
  pasteFab: {
    position: 'absolute', right: spacing[4], bottom: 84,
    width: 48, height: 48, borderRadius: radius.full, backgroundColor: c.text.bright,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },

  paidSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paidDetail: { marginTop: spacing[2], gap: spacing[2] },
  subLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  subLabelGap: { marginTop: spacing[1] },
}));
