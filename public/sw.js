/* Сервис-воркер: кэширует игру для полной работы офлайн.
   Игра и иконка живут внутри index.html — кэшируется один файл. */
const CACHE = "sudoku-zen-v3";
const ASSETS = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        Promise.all(
          ASSETS.map((url) =>
            fetch(url)
              .then((res) => (res.ok ? c.put(url, res.clone()) : null))
              .catch(() => null)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request)
          .then((res) => {
            try {
              if (res.ok && new URL(e.request.url).origin === self.location.origin) {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(e.request, copy));
              }
            } catch (_) {}
            return res;
          })
          .catch(() => caches.match("./index.html"))
    )
  );
});
