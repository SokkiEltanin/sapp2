import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Potwierdzenie drugim stuknięciem (2026-11-18, user: "potwierdzenie na Znam to, żeby
 * przez przypadek nie usunąć"). Pierwsze stuknięcie uzbraja (`armed` → UI pokazuje
 * "Na pewno?"), drugie w ciągu `ms` wykonuje akcję; po czasie samo się rozbraja.
 */
export function useConfirmTap(ms = 3000): [boolean, (action: () => void) => void] {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const tap = useCallback((action: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    if (armed) { setArmed(false); action(); return; }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), ms);
  }, [armed, ms]);
  return [armed, tap];
}
