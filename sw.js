const CACHE_NAME = "yao-v5";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg"
];


/* =========================
   安裝
========================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FILES_TO_CACHE))
            .then(() => self.skipWaiting())

    );

});


/* =========================
   啟用
========================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => caches.delete(name))

                );

            })
            .then(() => self.clients.claim())

    );

});


/* =========================
   讀取
   網路優先
========================= */

self.addEventListener("fetch", event => {

    event.respondWith(

        fetch(event.request)

            .then(response => {

                /*
                 * 網路成功
                 * 使用最新檔案
                 */

                if (response && response.status === 200) {

                    const responseClone = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {

                            cache.put(
                                event.request,
                                responseClone
                            );

                        });

                }

                return response;

            })

            .catch(() => {

                /*
                 * 沒網路時
                 * 才使用快取
                 */

                return caches.match(event.request);

            })

    );

});
