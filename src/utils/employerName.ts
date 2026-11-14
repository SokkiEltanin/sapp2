// Krótka, czytelna nazwa pracodawcy do pigułek (2026-11-14, user: "w pillach u
// pracodawców niesymetryczne wygenerowane nazwy, dziwnie wygląda"). Nazwy z przelewów
// bywają WIELKIMI LITERAMI z formą prawną ("ACME POLSKA SP. Z O.O.") — w pigułce
// zostaje "Acme Polska". Pełna nazwa dalej w karcie pracodawcy.
const LEGAL = /\b(sp(ółka|olka)?\.?\s*z\s*o\.?\s*o\.?|sp\.?\s*k\.?|sp\.?\s*j\.?|s\.?\s*a\.?|s\.?\s*c\.?|spółka akcyjna|spółka cywilna|ltd\.?|gmbh|inc\.?|llc)\s*$/i;

const isAllCaps = (s: string) => /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(s) && s === s.toUpperCase();

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-/])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
}

export function employerShortName(name: string, max = 22): string {
  let n = (name ?? '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) n = n.replace(LEGAL, '').replace(/[\s,.\-]+$/, '').trim();
  // Krótkie skrótowce (IKEA, PKP) zostają; zdania wielkimi literami → Wielkie Początki.
  if (isAllCaps(n) && (n.includes(' ') || n.length > 6)) n = titleCase(n);
  if (!n) n = (name ?? '').trim() || 'Pracodawca';
  return n.length > max ? `${n.slice(0, max - 1).trimEnd()}…` : n;
}

/** Nazwa dla nowego pracodawcy bez duplikatów: "Pracodawca", "Pracodawca 2", … */
export function nextEmployerName(existing: string[]): string {
  const taken = new Set(existing.map((x) => x.trim().toLowerCase()));
  if (!taken.has('pracodawca')) return 'Pracodawca';
  for (let i = 2; ; i++) if (!taken.has(`pracodawca ${i}`)) return `Pracodawca ${i}`;
}
