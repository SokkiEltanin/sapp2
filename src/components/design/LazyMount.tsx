import { useEffect, useState, type ReactNode } from 'react';

// Wydajność (2026-11-13, user: "klikam finanse i lekko laguje... wszystko się
// odświeża, te produkty, te samochody"). Ukryte okienka (sheety) były zamontowane
// CAŁY CZAS w ekranach zakładek, więc ich ciężkie wyliczenia (katalog produktów,
// szukanie duplikatów O(n²), dane "Wydatki") liczyły się przy wejściu na ekran i
// przy KAŻDEJ zmianie wydatków — mimo że nikt ich nie oglądał.
//
// LazyMount: dziecko istnieje TYLKO gdy okienko jest otwarte (+ chwilę po
// zamknięciu, żeby animacja zamykania AppBottomSheet — 200 ms — się dokończyła).
// Zasada dla nowego kodu: każdy sheet z niebanalnymi wyliczeniami w ekranie
// zakładki owijamy w <LazyMount visible={…}>.
export function useLazyMount(visible: boolean, keepMs = 450): boolean {
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(false), keepMs);
    return () => clearTimeout(t);
  }, [visible, keepMs]);
  return visible || mounted;
}

export default function LazyMount({ visible, children }: { visible: boolean; children: ReactNode }) {
  return useLazyMount(visible) ? <>{children}</> : null;
}
