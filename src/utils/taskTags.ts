// Kolory tagów zadań (2026-11-16, user: "ten tag #UR dziwnie wygląda... wizualne
// kafelki, bardziej wyróżniające się"). Tag bierze kolor z kalendarza: wydarzenia
// "[PUR] ..." są niebieskie → zadanie z tagiem PUR też. Bez dopasowania — stały
// kolor z palety wg hasza nazwy (ten sam tag = zawsze ten sam kolor).
const FALLBACK = ['#4C8DF6', '#F59E0B', '#22C55E', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#38BDF8'];

export const normTag = (t: string) => t.trim().replace(/^#/, '').toUpperCase();

export function tagColorMap(events: { title: string; color?: string }[]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const e of events) {
    const m = /^\s*\[([^\]]+)\]/.exec(e.title ?? '');
    if (!m || !e.color) continue;
    const tag = normTag(m[1]);
    const v = votes.get(tag) ?? new Map<string, number>();
    v.set(e.color, (v.get(e.color) ?? 0) + 1);
    votes.set(tag, v);
  }
  const out = new Map<string, string>();
  for (const [tag, v] of votes) out.set(tag, [...v.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return out;
}

export function tagColor(tag: string, map?: Map<string, string>): string {
  const t = normTag(tag);
  const hit = map?.get(t);
  if (hit) return hit;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
