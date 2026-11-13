// Service worker sapp2 (wersja na komputer, 2026-11-13): appka "do zainstalowania"
// (Chrome/Edge → Zainstaluj) + szybki start. Strategia: sieć najpierw, a przy braku
// sieci — ostatnia zapisana wersja plików (dane i tak synchronizuje Firestore).
const CACHE = 'sapp2-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/sapp2/'))),
  );
});
