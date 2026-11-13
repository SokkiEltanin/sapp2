import type { Expense } from '@/types/finances';
import { productGroupKey, productGroupLabel, canonicalProductName, normalizeProductName, trigrams } from './productMemory';

// Faza 2.3 — katalog produktów, agregowany z historii `Expense.receiptItems` (sapp2
// nie ma osobnej, przechowywanej listy "Produktów" — tylko pamięć per-nazwa
// (productMemory.ts) + surowe pozycje paragonów, więc katalog to WIDOK, nie nowy
// store). Grupowanie przez `productGroupKey`/`productGroupLabel` (1:1 z sapp),
// aliasy (scalone duplikaty) zastosowane PRZED grupowaniem, żeby scalenie
// natychmiast odbiło się na widoku, bez przepisywania historycznych wydatków.
export interface ProductCatalogEntry {
  groupKey: string;
  label: string;
  rawNames: string[];
  foodSubcat?: string;
  timesBought: number;
  totalSpent: number;
  lastPrice: number;
  lastDate: string;
}

export function buildProductCatalog(expenses: Expense[], aliases: Record<string, string> = {}): ProductCatalogEntry[] {
  const groups = new Map<string, { names: Set<string>; items: { foodSubcat?: string; price: number; date: string }[] }>();
  for (const e of expenses) {
    for (const it of e.receiptItems ?? []) {
      if (it.kind === 'deposit') continue;
      const name = it.name.trim();
      if (!name) continue;
      const canonical = canonicalProductName(name, aliases);
      const key = productGroupKey(canonical);
      const g = groups.get(key) ?? { names: new Set(), items: [] };
      g.names.add(canonical);
      g.items.push({ foodSubcat: it.foodSubcat, price: it.price, date: e.date });
      groups.set(key, g);
    }
  }

  const entries: ProductCatalogEntry[] = [];
  for (const [key, g] of groups) {
    const sorted = [...g.items].sort((a, b) => b.date.localeCompare(a.date));
    const last = sorted[0];
    const subcatCounts = new Map<string, number>();
    let totalSpent = 0;
    for (const it of g.items) {
      totalSpent += it.price;
      if (it.foodSubcat) subcatCounts.set(it.foodSubcat, (subcatCounts.get(it.foodSubcat) ?? 0) + 1);
    }
    let foodSubcat: string | undefined;
    let max = 0;
    for (const [tag, n] of subcatCounts) if (n > max) { max = n; foodSubcat = tag; }
    entries.push({
      groupKey: key,
      label: productGroupLabel([...g.names]),
      rawNames: [...g.names],
      foodSubcat,
      timesBought: g.items.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      lastPrice: last.price,
      lastDate: last.date,
    });
  }
  return entries.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

// Para wpisów, których etykiety są w paśmie niepewności suggestSimilarName
// (0.45–0.60) — podobne, ale NIE scalone automatycznie w grupowaniu (inny pierwszy
// token / literówka). Pokazane jako "czy to to samo?" do ręcznego potwierdzenia —
// NIGDY automatycznego scalenia.
export interface DuplicateCandidate { a: ProductCatalogEntry; b: ProductCatalogEntry; score: number }

export function findDuplicateCandidates(entries: ProductCatalogEntry[], lo = 0.45, hi = 0.60): DuplicateCandidate[] {
  // Wydajność (2026-11-13): nazwy normalizowane i trygramy budowane RAZ na produkt
  // (wcześniej w każdym z n² porównań — przy ~270 produktach ~73 tys. normalizacji
  // i budowań zbiorów). Wynik identyczny jak productNameSimilarity.
  const norm = entries.map((e) => normalizeProductName(e.label));
  const grams = norm.map((n) => (n.length < 2 ? null : trigrams(n)));
  const result: DuplicateCandidate[] = [];
  for (let i = 0; i < entries.length; i++) {
    const ga = grams[i];
    for (let j = i + 1; j < entries.length; j++) {
      let score: number;
      if (norm[i] === norm[j]) score = 1;
      else {
        const gb = grams[j];
        if (!ga || !gb) continue;
        let inter = 0;
        const [small, big] = ga.size < gb.size ? [ga, gb] : [gb, ga];
        for (const t of small) if (big.has(t)) inter++;
        score = (2 * inter) / (ga.size + gb.size);
      }
      if (score >= lo && score < hi) result.push({ a: entries[i], b: entries[j], score });
    }
  }
  return result.sort((a, b) => b.score - a.score);
}
