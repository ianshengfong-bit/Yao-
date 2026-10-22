const CACHE_NAME = "yao-workspace-20261022-jade-2";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js?v=20261022-jade-2",
    "./workspace.js?v=20261022-jade-2",
    "./workspace.css",
    "./workspace-refresh.css?v=20261022-jade-2",
    "./capture-date.js",
    "./capture-plan.js",
    "./capture-store.js",
    "./capture-view.js",
    "./field-views.js",
    "./smart-entry.js",
    "./admin.js?v=20261022-jade-2",
    "./admin-status.js",
    "./admin-dom.js",
    "./admin-core.js",
    "./reminder-core.js",
    "./admin-store.js",
    "./admin.css",
    "./manifest.json",
    "./icon.svg"
];

/* =========================================
   安裝新版 Service Worker
========================================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(
                    FILES_TO_CACHE
                );

            })
            .then(() => {

                return self.skipWaiting();

            })

    );

});


/* =========================================
   啟用新版
   清除舊快取
========================================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(
                            name =>
                                name.startsWith("yao-") && name !== CACHE_NAME
                        )
                        .map(
                            name =>
                                caches.delete(name)
                        )

                );

            })
            .then(() => {

                return self.clients.claim();

            })

    );

});


/* =========================================
   網路優先
   有網路 → 使用最新資料
   沒網路 → 使用快取
========================================= */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }


    if (new URL(event.request.url).origin !== self.location.origin) return;

    event.respondWith(

        fetch(event.request)

            .then(response => {

                /*
                 * 網路成功
                 * 更新快取
                 */

                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {

                    const responseClone =
                        response.clone();


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
                 * 沒網路
                 * 使用快取
                 */

                return caches.match(
                    event.request
                );

            })

    );

});

