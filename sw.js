const CACHE_NAME = "yao-v7";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg"
];


/* =========================
   安裝新版
========================= */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(
                    cache =>
                        cache.addAll(
                            FILES_TO_CACHE
                        )
                )
                .then(
                    () =>
                        self.skipWaiting()
                )

        );

    }
);


/* =========================
   啟用新版
   清除舊快取
========================= */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches
                .keys()
                .then(
                    cacheNames => {

                        return Promise.all(

                            cacheNames
                                .filter(
                                    name =>
                                        name !==
                                        CACHE_NAME
                                )
                                .map(
                                    name =>
                                        caches.delete(
                                            name
                                        )
                                )

                        );

                    }
                )
                .then(
                    () =>
                        self.clients.claim()
                )

        );

    }
);


/* =========================
   網路優先
========================= */

self.addEventListener(
    "fetch",
    event => {

        if (
            event.request.method !==
            "GET"
        ) {

            return;

        }


        /*
         * Firebase / Google 外部資源
         * 不放進自己的網站快取
         */

        const url =
            new URL(
                event.request.url
            );


        if (
            url.origin !==
            self.location.origin
        ) {

            return;

        }


        event.respondWith(

            fetch(
                event.request
            )
                .then(
                    response => {

                        if (
                            response &&
                            response.status ===
                            200
                        ) {

                            const clone =
                                response.clone();


                            caches
                                .open(
                                    CACHE_NAME
                                )
                                .then(
                                    cache => {

                                        cache.put(
                                            event.request,
                                            clone
                                        );

                                    }
                                );

                        }


                        return response;

                    }
                )
                .catch(
                    () =>
                        caches.match(
                            event.request
                        )
                )

        );

    }
);