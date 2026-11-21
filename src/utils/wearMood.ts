import type { MoodEntry } from '@/types/mood';

// Humor zapisany na zegarku (2026-11-21, user: "humor… palcem na kole"). Zegarek wysyła
// DataItem "/sapp2/mood/<id>" {id, mood, energy, date, t}; WearListenerService (plugins/
// withWearSync.js) dopisuje go do wear_mood_queue.json, a appka przy otwarciu zamienia
// na zwykłe wpisy (services/widgetToggleDrain.ts). Id z zegarka = brak dubli przy
// ponownym dosłaniu przez Data Layer.
const clamp = (v: number) => Math.min(5, Math.max(1, v));
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function wearMoodEntries(existing: MoodEntry[], msgs: unknown[]): MoodEntry[] {
  const have = new Set(existing.map((e) => e.id));
  const out: MoodEntry[] = [];
  for (const raw of msgs) {
    let m: any = raw;
    if (typeof raw === 'string') { try { m = JSON.parse(raw); } catch { continue; } }
    if (!m || typeof m !== 'object') continue;
    const id = `w_${String(m.id ?? '')}`;
    const mood = Number(m.mood), energy = Number(m.energy);
    if (id === 'w_' || have.has(id) || !isFinite(mood) || !isFinite(energy) || !YMD.test(String(m.date))) continue;
    const at = new Date(Number(m.t) || Date.now()).toISOString();
    have.add(id);
    out.push({
      id, date: String(m.date), mood: Math.round(clamp(mood) * 100) / 100, energy: Math.round(clamp(energy) * 100) / 100,
      tags: [], note: undefined, createdAt: at, updatedAt: at,
    });
  }
  return out;
}
