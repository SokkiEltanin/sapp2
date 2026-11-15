import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Linia "widoczne na Dashboardzie" w edytorze notatki (2026-11-15, user: "żeby było
// widać na notatce jaki fragment jest widoczny (wielkość kafelka na dashboardzie)
// taką słabą linią, której można włączyć lub wyłączyć widoczność"). Kafel Dashboardu
// pokazuje notatkę jako pomniejszoną stronę 1:1 (components/notes/NotePage.tsx), więc
// granica = wysokość kafla × (szerokość strony / szerokość kafla). Wymiary są z TEGO
// urządzenia (telefon i komputer mają inne kafle) — nie synchronizujemy.
interface NoteViewState {
  tile: { w: number; h: number } | null; // obszar notatki w kaflu Dashboardu (px)
  pageW: number | null;                   // szerokość strony w edytorze (px)
  guide: boolean;                         // czy pokazywać linię
  setTile: (w: number, h: number) => void;
  setPageW: (w: number) => void;
  toggleGuide: () => void;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1;

export const useNoteViewStore = create<NoteViewState>()(
  persist(
    (set, get) => ({
      tile: null,
      pageW: null,
      guide: true,
      setTile: (w, h) => {
        const t = get().tile;
        if (w > 0 && h > 0 && !(t && near(t.w, w) && near(t.h, h))) set({ tile: { w, h } });
      },
      setPageW: (w) => { if (w > 0 && !(get().pageW != null && near(get().pageW!, w))) set({ pageW: w }); },
      toggleGuide: () => set((st) => ({ guide: !st.guide })),
    }),
    { name: 'note-view-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Wysokość (px w edytorze), do której sięga kafel Dashboardu; null = nieznana. */
export function tileCutY(tile: { w: number; h: number } | null, pageW: number): number | null {
  if (!tile || pageW <= 0) return null;
  return (tile.h * pageW) / tile.w;
}
