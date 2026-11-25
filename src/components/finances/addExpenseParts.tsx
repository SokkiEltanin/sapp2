import { Text, TouchableOpacity } from 'react-native';
import { todayISO, ymd } from '@/utils/date';
import type { PaymentMethod, FvOverride } from '@/types/finances';

import { makeS } from './addExpenseStyles';

// Drobne kawałki formularza wydatku (wydzielone z AddExpenseModal, 2026-11-25, bez zmian działania).
export type Panel = 'paste' | 'fv' | 'cat' | 'food' | 'paid' | 'income' | 'note' | 'tags';

export function genId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Luźny, celowo permisywny heurystyk (2026-11-09, user wybrał "auto-wykrywanie
// przy otwarciu" zamiast samego FAB-a) — fałszywy pozytyw kosztuje tylko
// niegroźny baner do zignorowania, fałszywy negatyw i tak ma FAB jako pewną
// ścieżkę zapasową, więc nie trzeba próbować być precyzyjnym jak sam parser.
// Sygnał: przyzwoita długość + co najmniej jedna kwota w stylu "12,34"/"12.34".
export function looksLikeReceiptText(text: string): boolean {
  const t = text.trim();
  return t.length >= 15 && /\d+[.,]\d{2}/.test(t);
}

export const FV_CHOICES: { key: FvOverride | 'auto'; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'fixed', label: 'Stałe' },
  { key: 'variable', label: 'Zmienne' },
  { key: 'food', label: 'Jedzenie' },
  // "Przelew własny" (fvOverride 'transfer') od 2026-11-16 NIE tutaj, tylko trzeci
  // przycisk obok Wydatek/Przychód (user nie znalazł go w zwiniętym "Rozlicz jako"
  // i potrzebował też przelewu PRZYCHODZĄCEGO) — patrz `own` niżej.
];

export const PAYMENT_CHOICES: { key: PaymentMethod; label: string }[] = [
  { key: 'card', label: 'Karta' },
  { key: 'blik', label: 'BLIK' },
  { key: 'cash', label: 'Gotówka' },
  { key: 'transfer', label: 'Przelew' },
];
export const PAYMENT_LABEL: Record<PaymentMethod, string> = Object.fromEntries(PAYMENT_CHOICES.map((p) => [p.key, p.label])) as Record<PaymentMethod, string>;
export const PAYER_CHOICES: { key: 'me' | 'partner'; label: string }[] = [
  { key: 'me', label: 'Ja' },
  { key: 'partner', label: 'Olesia' },
];


/** Pigułka szczegółu: `label` przygaszony + wartość; `set` = wartość inna niż domyślna (jaśniej),
 *  `on` = otwarty panel (wypełniona). */
export function Pill({ label, value, set, on, onPress }: { label?: string; value: string; set?: boolean; on?: boolean; onPress: () => void }) {
  const s = makeS();
  return (
    <TouchableOpacity style={[s.pill, set && s.pillSet, on && s.pillOn]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.pillTxt, set && s.pillTxtSet, on && s.pillTxtOn]} numberOfLines={1}>
        {label ? <Text style={[s.pillLab, on && s.pillTxtOn]}>{label}: </Text> : null}{value}
      </Text>
    </TouchableOpacity>
  );
}

/** Pigułka daty: "Dziś" / "Wczoraj" / "20.11" (rok, gdy inny niż bieżący) + " · 22:15" z banku. */
export function fmtDatePill(d: string): string {
  const day = d.slice(0, 10);
  const hm = d.length >= 16 ? ` · ${d.slice(11, 16)}` : '';
  if (day === todayISO()) return `Dziś${hm}`;
  if (day === ymd(new Date(Date.now() - 86400000))) return `Wczoraj${hm}`;
  const [y, m, dd] = day.split('-');
  if (!y || !m || !dd) return d;
  return `${dd}.${m}${y === String(new Date().getFullYear()) ? '' : `.${y}`}${hm}`;
}


/** "20.11.2026 · 22:15" (z godziną z banku) albo "20.11.2026". */
export function fmtDateBadge(d: string): string {
  const [y, m, dd] = d.slice(0, 10).split('-');
  if (!y || !m || !dd) return d;
  const hm = d.length >= 16 ? d.slice(11, 16) : '';
  return `${dd}.${m}.${y}${hm ? ` · ${hm}` : ''}`;
}
