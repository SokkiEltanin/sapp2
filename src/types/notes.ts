// Notatki (2026-11-14, user: "notatka brzmi spoko... z opcjami LISTY albo rysunku,
// bo mam rysik S-PEN"). Jedna przypięta notatka zastępuje na Dashboardzie listę
// wydatków. Rysunek = kreski (punkty), nie obrazek — lekkie i synchronizowane.
import type { TextRun } from '@/utils/richText';

export type NoteKind = 'text' | 'list' | 'drawing';

export interface NoteItem { id: string; text: string; done: boolean }

// Punkty w jednostkach SZEROKOŚCI płótna (x i y / szerokość) — rysunek wygląda tak
// samo na telefonie i komputerze. `p` = płaska lista [x0, y0, x1, y1, …].
// `w` (pędzel, 2026-11-14): grubość w każdym punkcie jako mnożnik `width` (0.2–1.6,
// z nacisku rysika S-Pen albo szybkości palca); brak = zwykłe pióro o stałej grubości.
// `t` (2026-11-22): rodzaj narzędzia — brak = pióro (albo pędzel, gdy jest `w`), 'pencil' = ołówek
// (cieńszy, półprzezroczysty), 'marker' = zakreślacz (szeroki, przezroczysty, płaskie końce).
export interface NoteStroke { color: string; width: number; p: number[]; w?: number[]; t?: 'pencil' | 'marker' }

// Strona notatki (2026-11-22): kolor tła (brak = motyw) + wzór pod tekstem i rysunkiem.
export type NotePattern = 'none' | 'lines' | 'grid' | 'dots';
export interface NotePageStyle { bg?: string; pattern?: NotePattern }

// Katalogi notatek (2026-11-14, user: "w notatkach dodaj katalogi, edycje").
export interface NoteFolder { id: string; name: string; color: string; createdAt: string; updatedAt: string }

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  text: string;        // treść (tekst) / opis
  runs?: TextRun[];    // formatowanie treści (utils/richText.ts) — brak = zwykły tekst
  items: NoteItem[];   // lista
  strokes: NoteStroke[]; // rysunek
  page?: NotePageStyle;   // tło i wzór strony (utils/notePage.ts)
  canvasRatio?: number;  // wysokość / szerokość płótna (rysunek)
  pinned: boolean;     // na Dashboardzie (najwyżej jedna)
  folderId?: string | null; // katalog (NoteFolder.id); brak = "Bez katalogu"
  createdAt: string;
  updatedAt: string;
}
