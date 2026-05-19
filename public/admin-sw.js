/* Klar Control — service worker (scope: /admin).
   Network-first for pages so auth/data stay fresh; the cache is only a
   fallback when offline. Icons/fonts are cached for instant relaunch. */
const CACHE = "klar-admin-v1";
const OFFLINE = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Klar Control — offline</title>
<style>html,body{margin:0;height:100%}body{background:#070709;color:#f4f4f6;
font:15px/1.6 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}
div{max-width:320px;padding:24px}h1{font-size:19px;margin:0 0 8px}p{color:#9a9aa2;margin:0}</style>
</head><body><div><h1>Offline</h1><p>Keine Verbindung. Sobald du wieder online bist, lädt das Dashboard normal.</p></div></body></html>`;

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.put("/admin-offline", new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    ),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/admin-last", copy));
          return res;
        })
        .catch(async () =>
          (await caches.match("/admin-last")) ||
          (await caches.match("/admin-offline")),
        ),
    );
    return;
  }

  if (url.pathname.startsWith("/logo/") || url.pathname.startsWith("/admin")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});
