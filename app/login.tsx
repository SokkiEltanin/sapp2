import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogIn } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { spacing, radius, themedStyles } from '@/theme';
import { signInWithGoogle } from '@/services/googleAuth';

// Jedyna droga do appki (2026-10-28, user: "wymagaj logowania Google od razu") —
// bramka w app/_layout.tsx (useAuthGate) przekierowuje tu KAŻDEGO niezalogowanego
// usera z każdego innego ekranu, więc to NIE jest opcjonalny krok do przeskoczenia.
export default function LoginScreen() {
  const s = makeS();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // Sukces: bramka w app/_layout.tsx sama przekieruje na '/' po zmianie stanu
      // `onAuthStateChanged` — bez ręcznego router.replace tutaj.
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('Native module') || msg.includes('cannot be null') || msg.includes('TurboModule')) {
        setError('Logowanie Google wymaga builda APK — nie działa w Expo Go.');
      } else if (msg.includes('cancel') || msg.includes('CANCELED')) {
        setError(null);
      } else {
        setError(`Błąd logowania: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <View style={s.logoWrap}>
          <LogIn size={40} color={colors.accent.blue} />
        </View>
        <Text style={s.title}>Sapp2</Text>
        <Text style={s.subtitle}>Zaloguj się kontem Google, żeby zacząć.</Text>

        <TouchableOpacity style={s.button} onPress={handlePress} disabled={loading} activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={colors.bg.primary} />
          ) : (
            <Text style={s.buttonLabel}>Zaloguj przez Google</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={s.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  logoWrap: {
    width: 84, height: 84, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.accent.blue}1A`, marginBottom: spacing[2],
  },
  title: { fontSize: 24, fontFamily: 'Inter_900Black', color: c.text.primary },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: c.text.muted, textAlign: 'center', lineHeight: 19, marginBottom: spacing[3] },
  button: {
    backgroundColor: c.text.primary, borderRadius: radius.lg,
    paddingHorizontal: spacing[6], paddingVertical: spacing[3],
    minWidth: 220, alignItems: 'center', justifyContent: 'center',
  },
  buttonLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.bg.primary },
  error: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.accent.red, textAlign: 'center', marginTop: spacing[2] },
}));
