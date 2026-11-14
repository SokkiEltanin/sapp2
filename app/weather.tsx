import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/theme/colors';

// Zapasowy cel linku sapp2://weather (normalnie przepisywany wcześniej w
// app/+native-intent.tsx → '/?weather=1'). Zastępuje się Dashboardem z otwartą
// pogodą; czarne tło zamiast pustego (wcześniej szary krok przy cofaniu).
export default function WeatherLink() {
  useEffect(() => {
    router.replace({ pathname: '/', params: { weather: '1' } } as any);
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.bg.primary }} />;
}
