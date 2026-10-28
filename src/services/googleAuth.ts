import { GoogleAuthProvider, signInWithCredential, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/firebase';

// Ten sam client ID co test Diagnostyki w app/settings.tsx — jedna stała, żeby obie
// strony nie mogły się rozjechać (wcześniej był ten sam string wklepany dwa razy).
export const GOOGLE_WEB_CLIENT_ID = '237061417548-pent1blbeebj8kov67f8f5focr98usgr.apps.googleusercontent.com';

// JEDYNE miejsce w appce, gdzie logowanie Google realnie ZALOGOWUJE do Firebase
// (`signInWithCredential`) — test w Ustawieniach/Diagnostyka (`testGoogleSignIn`)
// woła samo `GoogleSignin.signIn()` bez tego kroku, bo sprawdza TYLKO czy
// konfiguracja Google Cloud/Firebase Console jest dobra, nie loguje do appki.
// `@react-native-google-signin` importowany dynamicznie — natywny moduł, którego
// nie ma w Expo Go (patrz komentarz w app/_layout.tsx).
export async function signInWithGoogle() {
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error('Google nie zwrócił idToken');
  const credential = GoogleAuthProvider.credential(idToken);
  const userCred = await signInWithCredential(auth, credential);
  return userCred.user;
}

export async function signOutGoogle() {
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Expo Go / moduł niedostępny — Firebase i tak wyloguje, to drugorzędne.
  }
  await firebaseSignOut(auth);
}
