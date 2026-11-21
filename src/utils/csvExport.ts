import { incomeCategoryOf, INCOME_META } from './incomeCategory';
import type { Expense } from '@/types/finances';
import { fvSplitOf } from './fixedVariable';
import { variableSplitOf, EXPENSE_CATEGORY_META, UNCATEGORIZED } from './expenseCategory';

// Eksport transakcji do CSV (2026-11-14) — pod polskiego Excela: średnik, przecinek
// dziesiętny, BOM (polskie znaki), daty RRRR-MM-DD. Jeden wiersz = jedna transakcja,
// pozycje paragonu w ostatniej kolumnie. Testy: __tests__/csvExport.test.ts.
const PAY: Record<string, string> = { cash: 'gotówka', card: 'karta', blik: 'BLIK', transfer: 'przelew' };
const num = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

export function csvCell(v: string): string {
  const s = v.replace(/\r?\n/g, ' ').trim();
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function bucket(e: Expense): string {
  if (e.type === 'income') return 'przychód';
  const s = fvSplitOf(e);
  const parts = [s.fixed > 0 && 'stałe', s.food > 0 && 'jedzenie', s.variable > 0 && 'zmienne'].filter(Boolean);
  return parts.length ? parts.join('+') : 'przelew/pominięte';
}

function categories(e: Expense): string {
  if (e.type === 'income') return INCOME_META[incomeCategoryOf(e)]?.label ?? '';
  const tags = [...variableSplitOf(e).keys()].filter((t) => t !== UNCATEGORIZED);
  return tags.map((t) => EXPENSE_CATEGORY_META[t]?.label ?? t).join(', ');
}

export function transactionsCsv(expenses: Expense[]): string {
  const head = ['Data', 'Typ', 'Sklep / opis', 'Kwota', 'Koszyk', 'Kategorie', 'Notatka', 'Płatność', 'Tagi', 'Pozycje'];
  const rows = [...expenses].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [
    e.date,
    e.type === 'income' ? 'przychód' : 'wydatek',
    e.storeName || e.note || '',
    num(e.type === 'income' ? e.amount : -e.amount),
    bucket(e),
    categories(e),
    e.storeName ? e.note : '',
    e.paymentMethod ? PAY[e.paymentMethod] ?? e.paymentMethod : '',
    e.tags.join(', '),
    (e.receiptItems ?? []).filter((i) => !i.excluded).map((i) => `${i.name} ${num(i.price)}${i.discount ? ` (−${num(i.discount)})` : ''}`).join(' | '),
  ].map((c) => csvCell(String(c))).join(';'));
  return `﻿${[head.join(';'), ...rows].join('\r\n')}\r\n`;
}

export function csvFileName(now: Date, label = 'transakcje'): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `soen-${label}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.csv`;
}
