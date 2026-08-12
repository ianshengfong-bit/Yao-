const CACHE_NAME = "yao-v6";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg"
];


/* =========================
   安裝新版 Service Worker
========================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FILES_TO_CACHE))
            .then(() => self.skipWaiting())

    );

});


/* =========================
   啟用新版
   清除所有舊快取
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
   網路優先
========================= */

self.addEventListener("fetch", event => {

    /*
     * 只處理 GET
     */

    if (event.request.method !== "GET") {
        return;
    }


    event.respondWith(

        fetch(event.request)
            .then(response => {

                /*
                 * 網路成功
                 * 使用最新版本
                 */

                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {

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
                 * 沒網路時才使用快取
                 */

                return caches.match(event.request);

            })

    );

});
