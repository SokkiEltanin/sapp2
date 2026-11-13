import { useEffect, useState, type DependencyList } from 'react';

// Wydajność (2026-11-13): ciężkie wyliczenie dopiero PO animacji otwarcia sheeta
// (~240 ms) — klatki animacji nie konkurują z liczeniem. Do tego czasu `initial`.
export function useDeferredMemo<T>(compute: () => T, deps: DependencyList, initial: T, delayMs = 260): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const t = setTimeout(() => setValue(compute()), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
