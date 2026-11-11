// Logika pola liczbowego (2026-11-11) — pola typu `value={String(liczba)}` +
// parsowanie przy KAŻDYM znaku gubiły to, co user właśnie pisał: "12," →
// parseFloat → 12 → "12" (przecinek/kropka znika, nie da się wpisać "0,5"),
// a wyczyszczone pole wskakiwało z powrotem na "0", którego nie dało się
// skasować. `NumberInput` trzyma SUROWY tekst lokalnie i tylko liczbę oddaje
// wyżej — te dwie funkcje decydują kiedy.

// "" / niepoprawne → undefined; przecinek jak kropka (polska klawiatura).
export function parseNumberInput(text: string): number | undefined {
  const s = text.replace(',', '.').trim();
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

// Czy tekst w polu trzeba nadpisać nową wartością z zewnątrz (np. cena
// przeliczona z ilość × cena jedn.). NIE nadpisuje, gdy tekst już znaczy tę
// samą liczbę ("12," = 12, "0.50" = 0.5) albo gdy user wyczyścił pole, a
// wartość spadła do 0/undefined — inaczej znowu wróciłby problem z "0".
export function shouldSyncNumberText(text: string, value: number | undefined): boolean {
  const parsed = parseNumberInput(text);
  if (parsed === value) return false;
  if (text.trim() === '' && (value == null || value === 0)) return false;
  return true;
}

export function formatNumberInput(value: number | undefined): string {
  return value == null ? '' : String(value);
}
