/* Zmień VERSION przy każdej publikacji zmienionych plików. */
const VERSION = 'male-kroki-github-2026-11-11-v1';
const CACHE = VERSION + '-' + self.registration.scope;
const FILES = ['./', './index.html', './styles.css', './content.js', './math-content.js', './polish-content.js', './english-content.js', './nature-content.js', './chapters.js', './generated-content.js', './version.json', './core.js', './visuals.js', './app.js', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  // Nowa wersja czeka na zamknięcie starych kart, aby nie mieszać plików.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('male-kroki-') && key.endsWith('-' + self.registration.scope) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const filename = url.pathname.slice(scope.pathname.length);
  const known = FILES.some(file => file.slice(2) === filename) || event.request.mode === 'navigate';
  if (!known) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch { if (event.request.mode === 'navigate') { const index = await cache.match('./index.html'); if (index) return index; } return Response.error(); }
  })());
});
self.addEventListener('message', event => {
  if (event.data !== 'CHECK_OFFLINE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const complete = (await Promise.all(FILES.map(file => cache.match(new URL(file, self.registration.scope))))).every(Boolean);
    event.ports[0].postMessage(complete ? 'OFFLINE_READY' : 'OFFLINE_INCOMPLETE');
  })());
});


