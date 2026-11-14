// Notatki (2026-11-14, user: "notatka brzmi spoko... z opcjami LISTY albo rysunku,
// bo mam rysik S-PEN"). Jedna przypięta notatka zastępuje na Dashboardzie listę
// wydatków. Rysunek = kreski (punkty), nie obrazek — lekkie i synchronizowane.
export type NoteKind = 'text' | 'list' | 'drawing';

export interface NoteItem { id: string; text: string; done: boolean }

// Punkty w jednostkach SZEROKOŚCI płótna (x i y / szerokość) — rysunek wygląda tak
// samo na telefonie i komputerze. `p` = płaska lista [x0, y0, x1, y1, …].
export interface NoteStroke { color: string; width: number; p: number[] }

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  text: string;        // treść (tekst) / opis
  items: NoteItem[];   // lista
  strokes: NoteStroke[]; // rysunek
  canvasRatio?: number;  // wysokość / szerokość płótna (rysunek)
  pinned: boolean;     // na Dashboardzie (najwyżej jedna)
  createdAt: string;
  updatedAt: string;
}
