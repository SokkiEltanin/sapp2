export type HabitKey = 'water' | 'sweets' | 'training';

// Jeden rekord na dzień, 3 booleany — `true` = "udało się" dla KAŻDEGO z trzech
// (symetrycznie, żeby `habitStreak` liczyła wszystkie tak samo): woda = wypiłem
// dość, słodycze = obyło się bez nich, trening = potrenowałem. Brak rekordu dla
// danego dnia = jeszcze nieoznaczone (NIE to samo co `false` — patrz
// `utils/habitStreak.ts`'s komentarz o "dziś jeszcze nie zaznaczone").
export interface HabitDay {
  date: string; // YYYY-MM-DD
  water: boolean;
  sweets: boolean;
  training: boolean;
}

export const HABIT_LABELS: Record<HabitKey, string> = {
  water: 'Woda',
  sweets: 'Słodycze',
  training: 'Trening',
};

export const HABIT_QUESTIONS: Record<HabitKey, string> = {
  water: 'Wypiłeś dziś wystarczająco wody?',
  sweets: 'Obyło się dziś bez słodyczy?',
  training: 'Trenowałeś dziś?',
};
