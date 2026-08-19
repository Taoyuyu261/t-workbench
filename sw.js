// Service Worker：网络优先（保证每次拿到最新版），离线时回退缓存。
// 版本号每次发版递增，activate 时清掉旧缓存。
const CACHE = "wb-v7";
const SHELL = ["index.html", "styles.css", "app.js", "config.js", "data.js", "feeds.json", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const file = url.pathname.split("/").pop();
  if (!SHELL.includes(file)) return;
  // 网络优先：在线永远拿最新；失败（离线）才用缓存
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
