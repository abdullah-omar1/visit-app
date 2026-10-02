// Service worker: يخلي التطبيق يفتح من غير نت. غيّر رقم النسخة مع كل تحديث للتطبيق.
const VERSION = "v2";
const CACHE = "visit-app-" + VERSION;
const SHELL = [
  "./",
  "index.html",
  "config.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png"
];
const EXTRA_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  // Firestore / Auth / Google APIs تمر للشبكة مباشرة
  if (!same && !EXTRA_HOSTS.includes(url.hostname)) return;

  e.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: same });
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      // للصفحات: نحاول الشبكة أولاً ثم الكاش (تحديث أسرع)
      if (req.mode === "navigate") {
        const netRes = await network;
        if (netRes) return netRes;
        return cached || caches.match("index.html") || caches.match("./");
      }

      // للباقي: كاش أولاً ثم شبكة
      if (cached) {
        network.catch(() => {}); // تحديث في الخلفية
        return cached;
      }
      const netRes = await network;
      if (netRes) return netRes;
      // fallback نهائي للتنقل
      if (req.headers.get("accept") && req.headers.get("accept").includes("text/html")) {
        return caches.match("index.html") || caches.match("./");
      }
      return new Response("", { status: 503, statusText: "Offline" });
    })()
  );
});
