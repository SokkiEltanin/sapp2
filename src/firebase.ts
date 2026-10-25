import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(firebaseApp);
