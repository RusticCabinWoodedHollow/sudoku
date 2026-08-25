const CACHE_NAME = "sudoku-zen-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];

// Предварительное кэширование всех ресурсов при установке
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map((url) => cache.add(url).catch(() => undefined))
      );
    }).then(() => self.skipWaiting())
  );
});

// Очистка старых кэшей и активация нового
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Стратегия: сначала кэш, потом сеть (Cache First) для офлайн-работы
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Если есть в кэше — возвращаем из кэша
      if (cached) return cached;
      
      // Если нет в кэше — пробуем получить из сети
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => {
        // Если сеть недоступна, возвращаем index.html для SPA
        return caches.match("./index.html");
      });
    })
  );
});
