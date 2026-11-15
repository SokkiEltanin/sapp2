import { Platform } from 'react-native';

// Wersja na komputer (2026-11-15, user: "żeby nie były surowe takie elementy jak
// kalendarze, paski te po prawej"): elementy rysowane przez przeglądarkę (paski
// przewijania, pola daty/godziny, zaznaczenie, obwódka aktywnego pola) w ciemnym,
// cienkim stylu appki zamiast jasnych domyślnych. Raz, przy starcie (app/_layout.tsx).
const CSS = `
:root { color-scheme: dark; }
* { scrollbar-width: thin; scrollbar-color: #343434 transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #2E2E2E; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: #464646; background-clip: padding-box; border: 2px solid transparent; }
::-webkit-scrollbar-button, ::-webkit-scrollbar-corner { display: none; background: transparent; }
::selection { background: rgba(242, 242, 242, 0.22); }
input, textarea { caret-color: #F2F2F2; }
input:focus, textarea:focus, select:focus { outline: none; }
input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.75); cursor: pointer; }
`;

let done = false;
export function installWebStyles(): void {
  if (done || Platform.OS !== 'web' || typeof document === 'undefined') return;
  done = true;
  const el = document.createElement('style');
  el.setAttribute('data-sapp2', 'web-styles');
  el.textContent = CSS;
  document.head.appendChild(el);
}
