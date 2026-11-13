import { useEffect } from 'react';
import { startCloudSync, stopCloudSync } from '@/services/cloudSync';

// Synchronizacja włączona, dopóki ktoś jest zalogowany (2026-11-13) — patrz
// services/cloudSync.ts. Wylogowanie zatrzymuje nasłuch.
export function useCloudSync(uid: string | null | undefined): void {
  useEffect(() => {
    if (!uid || uid === 'web-preview') { stopCloudSync(); return; } // atrapa podglądu web
    startCloudSync(uid).catch(() => {});
    return () => stopCloudSync();
  }, [uid]);
}
