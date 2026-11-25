import { INCOME_CATS, INCOME_META, incomeCategoryOf } from '@/utils/incomeCategory';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_META } from '@/utils/expenseCategory';
import { FOOD_SUBCATS, FOOD_SUBCAT_META } from '@/utils/food';
import { useCategoryRulesStore } from '@/store/categoryRulesStore';
import { haptic } from '@/utils/haptics';
import type { PaymentMethod, FvOverride } from '@/types/finances';

import { makeS } from './addExpenseStyles';
import { Pill, FV_CHOICES, PAYMENT_CHOICES, PAYMENT_LABEL, PAYER_CHOICES, type Panel } from './addExpenseParts';

// Szczegóły wydatku: rząd pigułek + JEDEN otwarty panel pod spodem (wydzielone z AddExpenseModal,
// 2026-11-25, bez zmian działania). Stan trzyma formularz — tu tylko widok i przełączniki.
export type ExpenseDetailsProps = {
  type: 'expense' | 'income';
  own: boolean;
  panel: Panel | null;
  setPanel: (p: Panel | null) => void;
  togglePanel: (p: Panel) => void;
  fvChoice: FvOverride | 'auto';
  setFvChoice: (v: FvOverride | 'auto') => void;
  foodWhole: boolean;
  foodSubcat: string | undefined;
  setFoodSubcat: (v: string | undefined) => void;
  mealGuess: string | null | undefined;
  expenseCategory: string | undefined;
  setExpenseCategory: (v: string | undefined) => void;
  incomeCategory: string | undefined;
  setIncomeCategory: (v: string | undefined) => void;
  tags: string[];
  removeTag: (t: string) => void;
  note: string;
  setNote: (v: string) => void;
  storeName: string;
  payer: 'me' | 'partner';
  setPayer: (v: 'me' | 'partner') => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  ruleMatch: string;
  ruleSaved: string | null;
  setRuleSaved: (v: string | null) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  addTag: () => void;
  tagSuggestions: string[];
  addSuggestedTag: (t: string) => void;
};

export default function ExpenseDetails(p: ExpenseDetailsProps) {
  const s = makeS();
  const { type, own, panel, setPanel, togglePanel, fvChoice, setFvChoice, foodWhole, foodSubcat, setFoodSubcat, mealGuess, expenseCategory, setExpenseCategory, incomeCategory, setIncomeCategory, tags, removeTag, note, setNote, storeName, payer, setPayer, paymentMethod, setPaymentMethod, ruleMatch, ruleSaved, setRuleSaved, tagInput, setTagInput, addTag, tagSuggestions, addSuggestedTag } = p;
  return (
    <>
      {/* Szczegóły jako rząd pigułek (2026-11-23, zamiast 5 rozwijanych sekcji jedna pod drugą):
          każda pigułka pokazuje aktualną wartość, stuknięcie otwiera JEDEN panel pod rzędem.
          Wybrane tagi stoją w tym samym rzędzie (× usuwa), "+ tag" otwiera wpisywanie. */}
      <View style={s.pills}>
        {type === 'expense' && !own && (
          <Pill label="Rozlicz" value={FV_CHOICES.find((o) => o.key === fvChoice)?.label ?? 'Auto'} set={fvChoice !== 'auto'} on={panel === 'fv'} onPress={() => togglePanel('fv')} />
        )}
        {foodWhole && (
          <Pill label="Jedzenie" value={foodSubcat ? FOOD_SUBCAT_META[foodSubcat]?.label ?? foodSubcat : mealGuess ? `auto · ${FOOD_SUBCAT_META[mealGuess]?.label}` : 'inne'} set={!!foodSubcat} on={panel === 'food'} onPress={() => togglePanel('food')} />
        )}
        {type === 'expense' && !own && !foodWhole && (
          <Pill label="Kategoria" value={(expenseCategory && EXPENSE_CATEGORY_META[expenseCategory]?.label) || 'brak'} set={!!expenseCategory} on={panel === 'cat'} onPress={() => togglePanel('cat')} />
        )}
        {type === 'income' && !own && (
          <Pill label="Kategoria" value={INCOME_META[incomeCategory ?? '']?.label ?? `auto · ${INCOME_META[incomeCategoryOf({ type: 'income', tags, note, storeName })].label}`} set={!!incomeCategory} on={panel === 'income'} onPress={() => togglePanel('income')} />
        )}
        {type === 'expense' && !own && (
          <Pill value={`${PAYER_CHOICES.find((p) => p.key === payer)?.label} · ${PAYMENT_LABEL[paymentMethod]}`} set={payer !== 'me' || paymentMethod !== 'card'} on={panel === 'paid'} onPress={() => togglePanel('paid')} />
        )}
        <Pill value={note.trim() ? `„${note.trim()}”` : '+ notatka'} set={!!note.trim()} on={panel === 'note'} onPress={() => togglePanel('note')} />
        {tags.map((t) => (
          <TouchableOpacity key={t} style={s.tagRemoveChip} onPress={() => removeTag(t)} activeOpacity={0.7} accessibilityLabel={`Usuń tag ${t}`}>
            <Text style={s.tagRemoveLabel}>{t}</Text>
            <X size={10} color={colors.bg.primary} />
          </TouchableOpacity>
        ))}
        <Pill value="+ tag" on={panel === 'tags'} onPress={() => togglePanel('tags')} />
      </View>

      {panel === 'fv' && (
        <View style={[s.panel, s.chips]}>
          {FV_CHOICES.map((opt) => (
            <TouchableOpacity key={opt.key} style={[s.chip, fvChoice === opt.key && s.chipActive]} onPress={() => { haptic.tap(); setFvChoice(opt.key); setPanel(null); }} activeOpacity={0.7}>
              <Text style={[s.chipLabel, fvChoice === opt.key && s.chipLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {panel === 'food' && foodWhole && (
        <View style={[s.panel, s.chips]}>
          <TouchableOpacity style={[s.chip, !foodSubcat && s.chipActive]} onPress={() => { setFoodSubcat(undefined); setPanel(null); }} activeOpacity={0.7}>
            <Text style={[s.chipLabel, !foodSubcat && s.chipLabelActive]}>{mealGuess ? 'Auto' : 'Inne'}</Text>
          </TouchableOpacity>
          {[...FOOD_SUBCATS.filter((f) => f.tag === 'fast food' || f.tag === 'dania gotowe'), ...FOOD_SUBCATS.filter((f) => f.tag !== 'fast food' && f.tag !== 'dania gotowe')].map((opt) => (
            <TouchableOpacity key={opt.tag} style={[s.chip, foodSubcat === opt.tag && { backgroundColor: opt.color }]} onPress={() => { setFoodSubcat(opt.tag); setPanel(null); }} activeOpacity={0.7}>
              <Text style={[s.chipLabel, foodSubcat === opt.tag && s.chipLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {panel === 'cat' && type === 'expense' && !own && !foodWhole && (
        <View style={s.panel}>
          <View style={s.chips}>
            <TouchableOpacity style={[s.chip, !expenseCategory && s.chipActive]} onPress={() => setExpenseCategory(undefined)} activeOpacity={0.7}>
              <Text style={[s.chipLabel, !expenseCategory && s.chipLabelActive]}>Brak</Text>
            </TouchableOpacity>
            {EXPENSE_CATEGORIES.map((opt) => (
              <TouchableOpacity key={opt.tag} style={[s.chip, expenseCategory === opt.tag && { backgroundColor: opt.color }]} onPress={() => setExpenseCategory(opt.tag)} activeOpacity={0.7}>
                <Text style={[s.chipLabel, expenseCategory === opt.tag && s.chipLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Reguła jednym tapem (2026-11-14): następne wydatki z tego sklepu dostaną
              tę kategorię same (utils/categoryRules.ts, Ustawienia → Reguły kategorii). */}
          {expenseCategory && ruleMatch.length >= 2 && (
            <TouchableOpacity
              style={[s.chip, s.ruleChip, ruleSaved === `${ruleMatch}|${expenseCategory}` && s.chipActive]}
              onPress={() => {
                useCategoryRulesStore.getState().add({ field: 'store', match: ruleMatch, kind: 'var', tag: expenseCategory });
                setRuleSaved(`${ruleMatch}|${expenseCategory}`);
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.chipLabel, ruleSaved === `${ruleMatch}|${expenseCategory}` && s.chipLabelActive]}>
                {ruleSaved === `${ruleMatch}|${expenseCategory}` ? `Zapamiętane: „${ruleMatch}” → ${EXPENSE_CATEGORY_META[expenseCategory]?.label ?? expenseCategory}` : `Zawsze tak dla „${ruleMatch}”`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Kategoria przychodu (2026-11-14) — brak wyboru = zgadywana z opisu/tagów. */}
      {panel === 'income' && type === 'income' && !own && (
        <View style={[s.panel, s.chips]}>
          <TouchableOpacity style={[s.chip, !incomeCategory && s.chipActive]} onPress={() => { setIncomeCategory(undefined); setPanel(null); }} activeOpacity={0.7}>
            <Text style={[s.chipLabel, !incomeCategory && s.chipLabelActive]}>Auto</Text>
          </TouchableOpacity>
          {INCOME_CATS.map((c) => (
            <TouchableOpacity key={c.tag} style={[s.chip, incomeCategory === c.tag && { backgroundColor: c.color, borderColor: c.color }]} onPress={() => { setIncomeCategory(c.tag); setPanel(null); }} activeOpacity={0.7}>
              <Text style={[s.chipLabel, incomeCategory === c.tag && s.chipLabelActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {panel === 'paid' && type === 'expense' && !own && (
        <View style={s.panel}>
          <Text style={s.subLabel}>Kto płacił</Text>
          <View style={s.chips}>
            {PAYER_CHOICES.map((opt) => (
              <TouchableOpacity key={opt.key} style={[s.chip, payer === opt.key && s.chipActive]} onPress={() => setPayer(opt.key)} activeOpacity={0.7}>
                <Text style={[s.chipLabel, payer === opt.key && s.chipLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.subLabel, s.subLabelGap]}>Czym</Text>
          <View style={s.chips}>
            {PAYMENT_CHOICES.map((opt) => (
              <TouchableOpacity key={opt.key} style={[s.chip, paymentMethod === opt.key && s.chipActive]} onPress={() => setPaymentMethod(opt.key)} activeOpacity={0.7}>
                <Text style={[s.chipLabel, paymentMethod === opt.key && s.chipLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {panel === 'note' && (
        <View style={s.panel}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="opcjonalny opis…"
            placeholderTextColor={colors.text.muted}
            style={s.textInput}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => setPanel(null)}
          />
        </View>
      )}

      {panel === 'tags' && (
        <View style={s.panel}>
          <View style={s.tagInputRow}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="np. Wakacje, Prezent…"
              placeholderTextColor={colors.text.muted}
              style={s.tagInputField}
              onSubmitEditing={addTag}
              returnKeyType="done"
              autoFocus
            />
            <TouchableOpacity style={s.tagAddBtn} onPress={addTag} activeOpacity={0.7} accessibilityLabel="Dodaj tag">
              <Plus size={14} color={colors.bg.primary} />
            </TouchableOpacity>
          </View>
          {tagSuggestions.length > 0 && (
            <View style={s.chips}>
              {tagSuggestions.map((t) => (
                <TouchableOpacity key={t} style={s.chip} onPress={() => addSuggestedTag(t)} activeOpacity={0.7}>
                  <Text style={s.chipLabel}>+ {t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </>
  );
}
