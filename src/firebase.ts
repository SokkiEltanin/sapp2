import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import * as firebaseAuth from 'firebase/auth';
import { initializeAuth, getAuth, indexedDBLocalPersistence, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wszystko tu poza `apiKey` to publiczna konfiguracja klienta (projekt sapp2-a2354,
// patrz INFRA.md) — bezpieczna do commitowania, tak jak google-services.json. `apiKey`
// JEDYNY idzie przez zmienną środowiskową (.env lokalnie, gitignored; GitHub Secret
// przy CI) — ta sama konwencja co w sapp.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'sapp2-a2354.firebaseapp.com',
  projectId: 'sapp2-a2354',
  storageBucket: 'sapp2-a2354.firebasestorage.app',
  messagingSenderId: '237061417548',
  appId: '1:237061417548:web:e804071aad44628b0162e9',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// `experimentalForceLongPolling` — bez tego pierwszy test Firestore na realnym Androidzie
// zawiesił się w nieskończoność (ani sukces, ani błąd): domyślny transport Firestore
// (WebChannel/gRPC-web auto-detect) potrafi nie otworzyć się poprawnie w RN/Hermes, a bez
// strumienia zapisy/odczyty po prostu czekają bez końca zamiast zwrócić błąd. Long polling
// to standardowy, udokumentowany fix na ten dokładnie objaw. `ignoreUndefinedProperties` —
// ta sama konwencja co w sapp (src/services/firebase.ts) — żeby `undefined` w zagnieżdżonym
// polu nie wywalało zapisu.
let _db: Firestore;
try {
  _db = initializeFirestore(firebaseApp, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  });
} catch {
  _db = getFirestore(firebaseApp);
}
export const db: Firestore = _db;

// Logowanie wymagane od razu (2026-10-28, user: "wymagaj logowania Google od razu" —
// prostszy wariant niż sap-owa anonimowa-sesja-linkowana-z-Google), więc trwała
// persystencja sesji jest KRYTYCZNA — bez niej user musiałby logować się ponownie
// przy każdym starcie appki. `getReactNativePersistence` istnieje TYLKO w RN-owym
// buildzie `firebase/auth` (nie w typach/web buildzie) — stąd wyciągnięte dynamicznie
// (`as any`), nie jako nazwany import, żeby nie wywalić typecheck/web. Ten sam
// dokładnie gotcha i fix co w sapp (src/services/firebase.ts).
const getRNPersistence = (firebaseAuth as any).getReactNativePersistence as
  | ((storage: unknown) => unknown)
  | undefined;

let _auth: Auth;
try {
  _auth = initializeAuth(firebaseApp, {
    persistence: getRNPersistence ? (getRNPersistence(AsyncStorage) as any) : indexedDBLocalPersistence,
  });
} catch {
  _auth = getAuth(firebaseApp);
}
export const auth: Auth = _auth;

// sapp (src/services/firebase.ts) złapał ten sam objaw: zapis bez persystencji nie
// resolve'uje ANI nie rejectuje na słabym/zablokowanym połączeniu — wisi tak długo, aż
// realne połączenie z serwerem się uda. `withTimeout` daje twardy sufit, więc UI zawsze
// dostaje jakiś wynik zamiast wiecznej klepsydry.
export function withTimeout<T>(
  promise: Promise<T>,
  ms = 10000,
  message = 'Operacja trwa zbyt długo — sprawdź połączenie z internetem i spróbuj ponownie.',
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}
