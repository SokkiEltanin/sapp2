import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wieczorne przypomnienie o humorze (2026-11-18) — tylko lokalnie (powiadomienia są per
// telefon). Ustawienia → Powiadomienia. Plan: utils/moodReminder.ts.
interface MoodReminderState {
  enabled: boolean;
  hour: number;
  minute: number;
  set: (p: Partial<Pick<MoodReminderState, 'enabled' | 'hour' | 'minute'>>) => void;
}

export const useMoodReminderStore = create<MoodReminderState>()(
  persist(
    (set) => ({ enabled: true, hour: 21, minute: 0, set: (p) => set(p) }),
    { name: 'mood-reminder-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ enabled: s.enabled, hour: s.hour, minute: s.minute }) },
  ),
);
