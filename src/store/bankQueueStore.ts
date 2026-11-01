import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParsedBankTx } from '@/utils/bankNotification';

// Port z sapp (src/store/bankQueueStore.ts), JEDNA adaptacja: sapp pamiętał
// `category: ExpenseCategory` per transakcja — sapp2 ma `tags: string[]` (jak Expense,
// patrz types/finances.ts) zamiast sztywnej kategorii, dokładnie ta sama zmiana co już
// zrobiona w `merchantMemory.ts`. Reszta (kolejka do przeglądu, autopilot, dedup po
// czasie powiadomienia, log historii) bez zmian.
export interface PendingBankTx extends ParsedBankTx {
  id: string;
  tags: string[];                 // aktualne (ew. edytowane przez usera) tagi — tylko wydatki
  suggestedTags: string[];        // co podpowiedziała pamięć sprzedawcy — do wykrycia korekty
  auto?: boolean;                 // zaufany sprzedawca → auto-zatwierdzenie przy następnym otwarciu appki
  isPaycheck?: boolean;           // przychód: oznacz jako wypłatę (tag 'wypłata')
  flagReason?: string;            // ustawione → wstrzymane do potwierdzenia (coś wyglądało nietypowo)
  matchedSource?: 'learned' | 'guess'; // skąd wzięły się tagi — patrz bankIngest.ts
  addedAt: number;
}

// Limit pamięci dedupu powiadomień niżej — ograniczony, żeby nigdy nie rosła w
// nieskończoność (z grubsza rok+ typowego ruchu bankowego; stare wpisy po prostu wypadają).
const SEEN_NOTIFICATIONS_MAX = 500;

// Log przechwytywania (tylko do wglądu w Ustawieniach — nic go nie czyta z powrotem przy
// księgowaniu) — trzyma zdenormalizowaną kopię pól do pokazania, nie referencję do
// `pending`. Capped jak `seenNotifications` niżej — rolling window, nie pełny audyt.
const HISTORY_MAX = 150;

export interface BankIngestHistoryEntry {
  id: string;
  at: number;
  store: string;
  storeKey: string; // do "Stwórz szablon z tego" (merchantMemory) i do odrzucenia z poziomu historii
  amount: number;
  currency: string;
  direction: 'in' | 'out';
  tags: string[];
  matchedSource?: 'learned' | 'guess';
  isPaycheck?: boolean;
  auto: boolean;
  flagReason?: string;
  // Dopisywane PO commicie (bank-review.tsx/bankAutoProcess.ts), nie przy enqueue —
  // `tags` tu to tagi w momencie zatwierdzenia (user mógł je poprawić), nie podpowiedź
  // z chwili złapania powiadomienia. `expenseId` + `matched` napędzają "Cofnij"
  // (2026-11-01, user: "mam nadzieję że zrobiłeś w zatwierdzeniu historię żebym mógł
  // cofnąć"): `matched:true` = scalono z już istniejącym wydatkiem (cofnięcie tylko
  // odpina `bankMatched`), `matched:false` = dodano nowy (cofnięcie usuwa go całkiem).
  expenseId?: string;
  matched?: boolean;
  undone?: boolean;
}

interface BankQueueState {
  pending: PendingBankTx[];
  enabled: boolean;              // główny przełącznik auto-logowania z powiadomień
  autoAll: boolean;               // pełny autopilot: loguj każdą płatność kartą BEZ przeglądu
  // `seenNotifications` — trwała (persist), międzysesyjna pamięć kluczy `pkg:postTime`
  // (Android `n.postTime`, ORYGINALNY czas wysłania powiadomienia, stabilny między
  // wielokrotnymi dostawami tego samego eventu) — sprawdzana w `ingestBankNotification`
  // PRZED parsowaniem, więc dokładnie ten sam event nigdy nie trafi do kolejki drugi raz,
  // niezależnie ile dni minęło. Potrzebne, bo natywny `NotificationListenerService` ma
  // DRUGĄ ścieżkę dostawy — `onListenerConnected` (system re-bind, np. po zabiciu usługi
  // przez OEM battery-saver) zamiata WSZYSTKIE wciąż widoczne powiadomienia w zasobniku.
  seenNotifications: string[];
  history: BankIngestHistoryEntry[];
  setEnabled: (v: boolean) => void;
  setAutoAll: (v: boolean) => void;
  wasNotificationSeen: (key: string) => boolean;
  markNotificationSeen: (key: string) => void;
  enqueue: (tx: Omit<PendingBankTx, 'id' | 'addedAt'>) => boolean; // false = duplikat
  update: (id: string, patch: Partial<PendingBankTx>) => void;
  remove: (id: string) => void;
  clear: () => void;
  clearHistory: () => void;
  updateHistoryEntry: (id: string, patch: Partial<BankIngestHistoryEntry>) => void;
}

export const useBankQueue = create<BankQueueState>()(
  persist(
    (set, get) => ({
      pending: [],
      enabled: false,
      autoAll: false,
      seenNotifications: [],
      history: [],
      setEnabled: (v) => set({ enabled: v }),
      wasNotificationSeen: (key) => get().seenNotifications.includes(key),
      markNotificationSeen: (key) => set((s) => ({
        seenNotifications: s.seenNotifications.includes(key)
          ? s.seenNotifications
          : [...s.seenNotifications, key].slice(-SEEN_NOTIFICATIONS_MAX),
      })),
      // Włączenie pełnego autopilota przełącza cały backlog na `auto` — też przychody.
      // Coś wyraźnie oflagowane (flagReason) zostaje ręczne — to "zapytaj, gdy wygląda nietypowo".
      setAutoAll: (v) => set((s) => ({
        autoAll: v,
        pending: v ? s.pending.map((p) => (p.flagReason ? p : { ...p, auto: true })) : s.pending,
      })),
      enqueue: (tx) => {
        // dedup: ta sama kwota + w ciągu 3 min + ten sam sklep już w kolejce
        const dup = get().pending.some((p) =>
          Math.abs(p.amount - tx.amount) < 0.011
          && p.storeKey === tx.storeKey
          && Math.abs(new Date(p.dateISO).getTime() - new Date(tx.dateISO).getTime()) < 3 * 60000);
        if (dup) return false;
        const id = `bnk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const at = Date.now();
        set((s) => ({
          pending: [{ ...tx, id, addedAt: at }, ...s.pending],
          history: [
            {
              id, at, store: tx.store, storeKey: tx.storeKey, amount: tx.amount, currency: tx.currency,
              direction: tx.direction, tags: tx.tags, matchedSource: tx.matchedSource,
              isPaycheck: tx.isPaycheck, auto: !!tx.auto, flagReason: tx.flagReason,
            },
            ...s.history,
          ].slice(0, HISTORY_MAX),
        }));
        return true;
      },
      update: (id, patch) => set((s) => ({ pending: s.pending.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      remove: (id) => set((s) => ({ pending: s.pending.filter((p) => p.id !== id) })),
      clear: () => set({ pending: [] }),
      clearHistory: () => set({ history: [] }),
      updateHistoryEntry: (id, patch) => set((s) => ({
        history: s.history.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),
    }),
    { name: 'bank-queue-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
