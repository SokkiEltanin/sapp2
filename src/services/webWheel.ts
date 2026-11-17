// Kółko myszy na komputerze (2026-11-17, user: "na komputerze w wielu miejscach nie działa
// scroll, ani poziomy, ani pionowy"). Poziome paski (chipy, filtry, tabela wydatków) na
// zwykłej myszy nie przewijały się wcale — kółko daje tylko deltaY. Ten handler zamienia
// pionowe kółko na poziome przewijanie, gdy pod kursorem jest element przewijany TYLKO
// w poziomie (i nie da się już przewinąć niczego pionowo między nim a kursorem).
// Tylko web, montowany raz w app/_layout.tsx — telefon nietknięty.
function scrollableX(el: HTMLElement): boolean {
  const st = getComputedStyle(el);
  return (st.overflowX === 'auto' || st.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
}
function scrollableY(el: HTMLElement): boolean {
  const st = getComputedStyle(el);
  return (st.overflowY === 'auto' || st.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
}

export function installWheelToHorizontal(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.deltaY === 0) return;
    for (let el = e.target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
      if (scrollableY(el)) return; // najbliższy przewijany pionowo — zwykłe zachowanie
      if (scrollableX(el)) {
        const max = el.scrollWidth - el.clientWidth;
        const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
        if (next === el.scrollLeft) return; // na końcu paska — niech przewija stronę
        el.scrollLeft = next;
        e.preventDefault();
        return;
      }
    }
  };
  window.addEventListener('wheel', onWheel, { passive: false });
  return () => window.removeEventListener('wheel', onWheel);
}
