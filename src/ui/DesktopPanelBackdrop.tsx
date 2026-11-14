import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { goBack } from '@/services/nav';
import { WEB_MAX_W } from './layout';
import { isDesktopPanelPath } from '@/utils/desktopColumns';

// Komputer (2026-11-14): gdy z prawej jest otwarty panel (ustawienia, notatki…),
// kolumny po lewej są lekko przyciemnione, a kliknięcie w nie zamyka panel — jak w
// aplikacjach na komputer. Bez tego kliknięcia w kolumny po prostu nie działały
// (warstwa ekranu Stacka zasłania całe okno).
export function DesktopPanelBackdrop() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  if (!isDesktopPanelPath(pathname)) return null;
  return (
    <Pressable
      onPress={goBack}
      accessibilityLabel="Zamknij panel"
      style={[st.backdrop, { width: Math.max(0, width - WEB_MAX_W) }]}
    />
  );
}

const st = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', cursor: 'pointer' } as any,
});
