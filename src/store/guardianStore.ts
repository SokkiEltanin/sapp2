import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/services/safeStorage';
import type { GuardianState } from '@/utils/guardian';

// Strażnik (utils/guardian.ts): od kiedy dany problem trwa i kiedy ostatnio o nim powiadomiono.
// Lokalnie, per urządzenie.
export const useGuardianStore = create<GuardianState & { lastCheck: number; set: (s: GuardianState & { lastCheck: number }) => void }>()(
  persist(
    (set) => ({ since: {}, notified: {}, lastCheck: 0, set: (s) => set(s) }),
    { name: 'guardian-v1', storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ since: s.since, notified: s.notified, lastCheck: s.lastCheck }) },
  ),
);
