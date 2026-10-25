// Dark-only — user: "jasny tryb żegnamy na zawsze". Jedna, stała paleta, żadnego
// przełącznika/wariantu do utrzymywania ani testowania.
export const colors = {
  bg: {
    primary: '#0B0E14',
    elevated: '#14171F',
    card: '#181B24',
  },
  border: {
    default: '#262A36',
    subtle: '#1D212B',
  },
  text: {
    primary: '#F5F6FA',
    secondary: '#A7ADBD',
    muted: '#6B7180',
  },
  accent: {
    blue: '#6C9EFF',   // Dashboard
    orange: '#FB923C', // Daily
    green: '#2AC68F',  // Finanse
    red: '#EF4444',    // Pupil
    purple: '#A78BFA',
  },
} as const;

export type Colors = typeof colors;
