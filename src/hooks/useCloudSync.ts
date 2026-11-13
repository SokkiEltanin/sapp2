import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { startCloudSync, stopCloudSync } from '@/services/cloudSync';

// Synchronizacja włączona, dopóki ktoś jest zalogowany (2026-11-13) — patrz
// services/cloudSync.ts. Wylogowanie zatrzymuje nasłuch.
// Start odłożony (2026-11-13, wydajność): pierwsze porównanie liczy skróty WSZYSTKICH
// elementów (przy tysiącach wydatków to zauważalna chwila na JS) — najpierw pierwszy
// ekran i animacje, potem synchronizacja w tle.
const START_DELAY_MS = 2500;

export function useCloudSync(uid: string | null | undefined): void {
  useEffect(() => {
    if (!uid || uid === 'web-preview') { stopCloudSync(); return; } // atrapa podglądu web
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const t = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) startCloudSync(uid).catch(() => {});
      });
    }, START_DELAY_MS);
    return () => { cancelled = true; clearTimeout(t); task?.cancel(); stopCloudSync(); };
  }, [uid]);
}
