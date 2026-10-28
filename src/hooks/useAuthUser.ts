import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/firebase';

// `initializing` startuje jako `true` bez wyjątków — nawet dla sesji odtworzonej z
// persystencji AsyncStorage, `auth.currentUser` NIE jest ustawiony synchronicznie,
// Firebase zawsze i tak woła `onAuthStateChanged` asynchronicznie przynajmniej raz
// (stąd żadnego "optymistycznego" odczytu `auth.currentUser` na starcie — byłby
// prawie zawsze `null` i tylko zamigał ekranem logowania na pół klatki).
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  return { user, initializing };
}
