/* Creator dashboard: service worker (scope /dashboard), so the dashboard installs as an app.
   Pages always come from the network: they carry personal data and signed image links, so
   nothing of them is cached. Only when the network is gone a small offline page answers. */
const CACHE = "klar-dashboard-v1";
const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Klar Studios: offline</title>
<style>html,body{margin:0;height:100%}body{background:#ededeb;color:#0e0e10;
font:15px/1.6 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center}
div{max-width:320px;padding:24px}h1{font-size:19px;margin:0 0 8px}p{color:#5d5d63;margin:0}</style>
</head><body><div><h1>You're offline</h1><p>Your dashboard loads again as soon as you're back online.</p></div></body></html>`;

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.put("/dashboard-offline", new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    ),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("klar-dashboard-") && k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match("/dashboard-offline")));
});
