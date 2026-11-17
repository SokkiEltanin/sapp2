import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Profil (2026-11-17, user: "nie dodaliśmy danych w profilu — imię, data urodzenia itp.").
// Używane: BMI i wiek w panelu ciała (BodySheet), urodziny w "Najbliższych eventach" na
// Dashboardzie (utils/profile.ts). Synchronizowane w dokumencie `prefs` (cloudSync).
export interface Profile {
  name: string;
  birthDate: string | null;  // YYYY-MM-DD
  heightCm: number | null;
}
interface ProfileState extends Profile {
  t: number;
  setProfile: (p: Partial<Profile>) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      name: '', birthDate: null, heightCm: null, t: 0,
      setProfile: (p) => set({ ...p, t: Date.now() }),
    }),
    { name: 'profile-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ name: s.name, birthDate: s.birthDate, heightCm: s.heightCm, t: s.t }) },
  ),
);
