// Port z sapp 1:1 — generyczny in-memory async mutex, kluczowany stringiem. Potrzebny
// w `services/bankCommit.ts`: powiadomienie z banku i ręcznie dodany paragon TEJ SAMEJ
// płatności, przychodzące w odstępie milisekund, oba czytały `expensesStore` ZANIM
// pierwsze zdążyło dopisać swój wpis — dedup (amount+dzień+sklep) nie miał szans
// zadziałać, bo z punktu widzenia każdego wywołania było "pierwsze". Nie persystowane —
// pamięć tylko w ramach jednej działającej sesji appki wystarczy, bo wyścig ma znaczenie
// tylko między dwoma commitami ścigającymi się NAWZAJEM, nie między sesjami.
const locks = new Map<string, Promise<void>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((res) => { release = res; });
  locks.set(key, prev.then(() => mine));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === mine) locks.delete(key);
  }
}
