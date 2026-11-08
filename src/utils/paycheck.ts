import type { Expense } from '@/types/finances';

// Port z sapp (src/utils/paycheck.ts + isPaycheck z hooks/useWorkEarnings.ts) 1:1.

// Usuwa polskie znaki diakrytyczne, żeby "wrzesień"/"września" itp. trafiały w jeden rdzeń.
function dePl(s: string): string {
  return s.toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z');
}

const MONTH_STEMS = ['stycz', 'lut', 'mar', 'kwie', 'maj', 'czerw', 'lip', 'sierp', 'wrzes', 'pazdz', 'listop', 'grud'];

function monthIndexFromText(text: string): number {
  const t = dePl(text);
  // Rdzeń miesiąca liczy się TYLKO po "za " (…WYPŁATA ZA KWIECIEŃ) — goły rdzeń fałszywie
  // trafiał w nazwy firm, np. "MARKETING INVESTMENT GROUP" zawiera "mar" (marzec).
  for (let i = 0; i < MONTH_STEMS.length; i++) {
    if (new RegExp(`za\\s+${MONTH_STEMS[i]}`).test(t)) return i;
  }
  return -1;
}

const pad = (n: number) => String(n).padStart(2, '0');

// YYYY-MM za który jest wypłata. Preferowane źródło: tytuł "[JD] WYPŁATA ZA <miesiąc>".
// Fallback: pensje wypłaca się z dołu, więc wypłata datowana na miesiąc M jest za M-1.
export function paycheckTargetMonth(e: { note?: string; date: string }): string {
  const [y, m] = e.date.slice(0, 10).split('-').map(Number);
  const mi = monthIndexFromText(e.note ?? '');
  if (mi >= 0) {
    const year = mi > (m - 1) ? y - 1 : y;
    return `${year}-${pad(mi + 1)}`;
  }
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Wypłata dla stawki pracy = przychód niosący prefiks pracodawcy ([JD]) jako tag albo w
// notatce. Celowo rygorystyczne: stawka dzieli przez godziny kalendarza TEGO prefiksu, więc
// generyczny przychód z innego źródła (np. dorywcza fucha) nie może się wliczyć. Brak
// prefiksu → żaden przychód nie liczy się jako wypłata (sapp2 nie ma kategorii "salary" do
// fallbacku jak sapp — `type: 'income'` samo nie wystarcza, zbyt szerokie).
export function isPaycheck(e: Expense, workPrefix?: string): boolean {
  if (e.type !== 'income') return false;
  const wp = workPrefix?.trim().toLowerCase();
  if (!wp) return false;
  return (e.tags ?? []).some((t) => t.toLowerCase() === wp) || (e.note ?? '').toLowerCase().includes(wp);
}
