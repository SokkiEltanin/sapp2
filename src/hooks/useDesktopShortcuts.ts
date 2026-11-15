import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { goBack } from '@/services/nav';
import { shortcutFor } from '@/utils/desktopShortcuts';
import { tabFromPath } from '@/utils/desktopColumns';
import { requestQuickAdd } from '@/services/quickAdd';

// Skróty klawiszowe na komputerze (2026-11-14) — lista: utils/desktopShortcuts.ts.
// Esc na zakładce (nic do zamknięcia) nic nie robi; otwarte okno (arkusz) zamyka się
// samo przez Modal, więc tu nie dublujemy.
export function useDesktopShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      // Otwarty arkusz (Modal) — nie przełączamy ekranów pod nim.
      if (document.querySelector('[aria-modal="true"]')) return;
      const a = shortcutFor({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, typing });
      if (!a) return;
      e.preventDefault();
      if (a.kind === 'back') {
        if (!tabFromPath(window.location.pathname.replace(/^\/sapp2/, '') || '/')) goBack();
        return;
      }
      if (a.kind === 'add') {
        requestQuickAdd(a.what);
        router.navigate((a.what === 'expense' ? '/finances' : '/tasks') as any);
        return;
      }
      if (a.href === '/' || a.href === '/finances' || a.href === '/tasks' || a.href === '/daily') router.navigate(a.href as any);
      else router.push(a.href as any);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
