import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeatherData } from '@/utils/weather';

// Pogoda (2026-11-13): lokalizacja ('gps' = bieżąca pozycja telefonu, 'city' =
// miasto wybrane ręcznie) + ostatnio pobrane dane (persist → kafel od razu po
// starcie appki, odświeżenie w tle). Trafia też do backupu (mały; wybór
// miasta warto odzyskać razem z resztą).
export interface WeatherLocation { mode: 'gps' | 'city'; name: string; lat: number; lon: number }

interface WeatherState {
  location: WeatherLocation | null;
  gpsDenied: boolean;
  data: WeatherData | null;
  error: string | null;
  loading: boolean;
  setLocation: (loc: WeatherLocation | null) => void;
  setData: (data: WeatherData) => void;
  setError: (e: string | null) => void;
  setLoading: (v: boolean) => void;
  setGpsDenied: (v: boolean) => void;
}

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set) => ({
      location: null,
      gpsDenied: false,
      data: null,
      error: null,
      loading: false,
      setLocation: (location) => set({ location, data: null, error: null }),
      setData: (data) => set({ data, error: null }),
      setError: (error) => set({ error }),
      setLoading: (loading) => set({ loading }),
      setGpsDenied: (gpsDenied) => set({ gpsDenied }),
    }),
    {
      name: 'weather-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (st) => ({ location: st.location, data: st.data, gpsDenied: st.gpsDenied }),
    },
  ),
);
