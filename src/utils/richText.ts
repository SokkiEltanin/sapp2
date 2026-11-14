// Formatowanie tekstu notatki (2026-11-14, user: "w samej notatce wielkość liter,
// bold, kursywa, kolory, podkreślenia"). Tekst zostaje zwykłym stringiem (`Note.text`
// — szukanie, synchronizacja, podgląd działają jak dotąd), style to "odcinki" (runs)
// pokrywające tekst po kolei: suma `n` = długość tekstu. Czyste funkcje —
// testy __tests__/richText.test.ts. Edytor: app/note.tsx, podgląd: NotePreview.
export type TextSize = 's' | 'm' | 'l' | 'xl';
export interface RunStyle { b?: boolean; i?: boolean; u?: boolean; c?: string; h?: string; z?: TextSize }
export interface TextRun extends RunStyle { n: number }

export const SIZE_PX: Record<TextSize, number> = { s: 13, m: 16, l: 21, xl: 28 };
const KEYS: (keyof RunStyle)[] = ['b', 'i', 'u', 'c', 'h', 'z'];

export function clean(st: RunStyle): RunStyle {
  const out: RunStyle = {};
  if (st.b) out.b = true;
  if (st.i) out.i = true;
  if (st.u) out.u = true;
  if (st.c) out.c = st.c;
  if (st.h) out.h = st.h;
  if (st.z && st.z !== 'm') out.z = st.z;
  return out;
}
const same = (a: RunStyle, b: RunStyle) => KEYS.every((k) => (a[k] ?? undefined) === (b[k] ?? undefined));
export const isPlain = (st: RunStyle) => Object.keys(clean(st)).length === 0;

/** Scala sąsiednie odcinki o tym samym stylu, wyrzuca puste. */
export function normalize(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const r of runs) {
    if (r.n <= 0) continue;
    const st = clean(r);
    const last = out[out.length - 1];
    if (last && same(last, st)) last.n += r.n;
    else out.push({ n: r.n, ...st });
  }
  return out;
}

/** Odcinki dopasowane do długości tekstu (brakujące = zwykły tekst, nadmiar ucięty). */
export function fitRuns(runs: TextRun[] | undefined, len: number): TextRun[] {
  const out: TextRun[] = [];
  let left = len;
  for (const r of runs ?? []) {
    if (left <= 0) break;
    const n = Math.min(r.n, left);
    out.push({ ...r, n });
    left -= n;
  }
  if (left > 0) out.push({ n: left });
  return normalize(out);
}

function splitAt(runs: TextRun[], pos: number): TextRun[] {
  const out: TextRun[] = [];
  let at = 0;
  for (const r of runs) {
    if (pos > at && pos < at + r.n) {
      out.push({ ...r, n: pos - at }, { ...r, n: at + r.n - pos });
    } else out.push({ ...r });
    at += r.n;
  }
  return out;
}

/** Zmiana stylu fragmentu [start, end) — `patch` nadpisuje cechy (undefined/false = zdejmij). */
export function applyStyle(runs: TextRun[], start: number, end: number, patch: Partial<RunStyle>): TextRun[] {
  if (end <= start) return runs;
  const parts = splitAt(splitAt(runs, start), end);
  let at = 0;
  const out = parts.map((r) => {
    const inside = at >= start && at + r.n <= end;
    at += r.n;
    return inside ? { ...r, ...patch } : r;
  });
  return normalize(out);
}

/** Styl w punkcie (znak przed kursorem — tak dziedziczy pisanie). */
export function styleAt(runs: TextRun[], pos: number): RunStyle {
  let at = 0;
  for (const r of runs) {
    if (pos > at && pos <= at + r.n) return clean(r);
    at += r.n;
  }
  return pos === 0 && runs[0] ? clean(runs[0]) : {};
}

/** Czy cecha jest włączona na CAŁYM zaznaczeniu (wtedy przycisk ją zdejmuje). */
export function allHave(runs: TextRun[], start: number, end: number, key: 'b' | 'i' | 'u'): boolean {
  let at = 0, seen = false;
  for (const r of runs) {
    const a = at, b = at + r.n;
    at = b;
    if (b <= start || a >= end) continue;
    seen = true;
    if (!r[key]) return false;
  }
  return seen;
}

/**
 * Aktualizacja odcinków po edycji tekstu: wspólny początek/koniec starego i nowego
 * tekstu, środek usunięty, wstawione znaki dostają `typing` (styl przy kursorze albo
 * ustawiony z paska przed pisaniem).
 */
export function onTextEdit(oldText: string, newText: string, runs: TextRun[], typing: RunStyle): TextRun[] {
  if (oldText === newText) return runs;
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  let sfx = 0;
  while (sfx < max - p && oldText[oldText.length - 1 - sfx] === newText[newText.length - 1 - sfx]) sfx++;
  const delEnd = oldText.length - sfx;
  const ins = newText.length - sfx - p;
  const fitted = fitRuns(runs, oldText.length);
  const parts = splitAt(splitAt(fitted, p), delEnd);
  const before: TextRun[] = [], after: TextRun[] = [];
  let at = 0;
  for (const r of parts) {
    if (at + r.n <= p) before.push(r);
    else if (at >= delEnd) after.push(r);
    at += r.n;
  }
  return normalize([...before, ...(ins > 0 ? [{ n: ins, ...clean(typing) }] : []), ...after]);
}

/** Podział tekstu na kawałki do renderu (<Text> z odpowiednim stylem). */
export function segments(text: string, runs: TextRun[] | undefined): { t: string; st: RunStyle }[] {
  const out: { t: string; st: RunStyle }[] = [];
  let at = 0;
  for (const r of fitRuns(runs, text.length)) {
    out.push({ t: text.slice(at, at + r.n), st: clean(r) });
    at += r.n;
  }
  return out;
}

export const hasFormatting = (runs: TextRun[] | undefined) => !!runs?.some((r) => !isPlain(r));
