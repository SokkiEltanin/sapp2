import { router } from 'expo-router';

// Bezpieczne "wstecz" (2026-11-14, user: "posprawdzaj ekrany jak cofam"): gdy ekran
// otwarto bez historii (link z widgetu, odświeżenie strony na komputerze), zwykłe
// router.back() nie ma dokąd wrócić i nic się nie dzieje — wtedy Dashboard.
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
