import { collection, doc } from 'firebase/firestore';
import { auth, db } from '@/firebase';

// Logowanie Google jest wymagane OD RAZU (2026-10-28, user: "wymagaj logowania
// Google od razu") — w przeciwieństwie do sapp (sesja anonimowa + fallback, patrz
// src/services/firebase.ts tam) sapp2 NIE MA anonimowego usera. Bramka w
// app/_layout.tsx (useAuthGate) nie wpuszcza na żaden ekran poza /login bez
// zalogowanego Firebase-usera, więc w momencie gdy cokolwiek poniżej mogłoby się
// wykonać, `auth.currentUser` jest już gwarantowany — brak usera tutaj jest błędem
// programisty (wywołanie przed bramką/poza nią), nie brakującym przypadkiem do
// cichej obsługi (stąd `throw`, nie fallback na anonimowe logowanie jak w sapp).
export function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

export const userCol = (name: string) => collection(db, 'users', requireUid(), name);
export const userDoc = (name: string, id: string) => doc(db, 'users', requireUid(), name, id);
