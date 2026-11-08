import { create } from 'zustand';

// Mostek efemeryczny (bez `persist` — ma żyć tylko do najbliższego odczytu przez
// `(tabs)/finances.tsx`, nie między sesjami) między miejscem, które DRENUJE udostępniony
// tekst paragonu (`useShareReceiptLaunch.ts`, zamontowany raz w `app/_layout.tsx`) i
// ekranem, który go faktycznie KONSUMUJE (`AddExpenseModal` żyje lokalnie w
// `(tabs)/finances.tsx`, więc drenaż w layout-cie nie ma bezpośredniego dostępu do jej
// `setAddOpen`). Ten sam podział odpowiedzialności co inne drenaże (`bankQueueStore` dla
// powiadomień banku), tylko dla jednej wartości zamiast całej kolejki.
interface ShareReceiptState {
  pendingText: string | null;
  setPendingText: (text: string) => void;
  clear: () => void;
}

export const useShareReceiptStore = create<ShareReceiptState>((set) => ({
  pendingText: null,
  setPendingText: (text) => set({ pendingText: text }),
  clear: () => set({ pendingText: null }),
}));
