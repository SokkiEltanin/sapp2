import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/firebase';

// `initializing` startuje jako `true` bez wyjątków — nawet dla sesji odtworzonej z
// persystencji AsyncStorage, `auth.currentUser` NIE jest ustawiony synchronicznie,
// Firebase zawsze i tak woła `onAuthStateChanged` asynchronicznie przynajmniej raz
// (stąd żadnego "optymistycznego" odczytu `auth.currentUser` na starcie — byłby
// prawie zawsze `null` i tylko zamigał ekranem logowania na pół klatki).
//
// `Platform.OS === 'web'` → fake zalogowany user, BEZ wołania Firebase (2026-11-02,
// DESIGN.md §9 "pętla wizualna": `expo start --web` + Playwright screenshot obok
// `app-design.html`). Prawdziwe logowanie Google przez `expo start --web` w tym
// środowisku nie jest wykonalne (brak prawdziwego konta/OAuth popupu w headless
// Playwright) — appka jest i tak WYŁĄCZNIE na Androida (CLAUDE.md: "APK z GitHub"),
// web nigdy nie jest celem produkcyjnym, więc `Platform.OS==='web'` NIGDY nie
// zachodzi w prawdziwym buildzie — bezpieczne na stałe, nie trzeba pamiętać o
// cofnięciu przed commitem.
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setUser({ email: 'web-preview@localhost', uid: 'web-preview' } as User);
      setInitializing(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  return { user, initializing };
}
