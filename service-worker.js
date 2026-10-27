const CACHE_NAME = "cineflix-v7";

const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(cache => {

                return cache.addAll(APP_FILES);

            })

            .catch(error => {

                console.error(
                    "CineFlix cache installation error:",
                    error
                );

            })

    );

    /*
       IMPORTANT:
       Do NOT activate the new version immediately.
       This allows the CineFlix app to show
       an "Update CineFlix" button first.
    */

});


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()

            .then(cacheNames => {

                return Promise.all(

                    cacheNames

                        .filter(
                            name => name !== CACHE_NAME
                        )

                        .map(
                            name => caches.delete(name)
                        )

                );

            })

    );

    self.clients.claim();

});


/* =====================================================
   FETCH
===================================================== */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }


    const request = event.request;
    const url = new URL(request.url);


    /*
       Don't cache API requests.
    */

    if (
        url.pathname.startsWith("/api/") ||
        url.hostname.includes("api.themoviedb.org")
    ) {

        return;

    }


    event.respondWith(

        fetch(request)

            .then(response => {

                /*
                   Save successful responses
                   into the current CineFlix cache.
                */

                if (
                    response &&
                    response.status === 200 &&
                    response.type !== "opaque"
                ) {

                    const responseClone =
                        response.clone();


                    caches.open(CACHE_NAME)

                        .then(cache => {

                            cache.put(
                                request,
                                responseClone
                            );

                        });

                }


                return response;

            })

            .catch(() => {

                /*
                   If offline, use cached content.
                */

                return caches.match(request)

                    .then(cachedResponse => {

                        if (cachedResponse) {

                            return cachedResponse;

                        }


                        /*
                           If the requested page
                           isn't cached, use index.html.
                        */

                        if (
                            request.destination ===
                            "document"
                        ) {

                            return caches.match(
                                "./index.html"
                            );

                        }


                        return new Response(
                            "CineFlix is currently offline.",
                            {
                                status: 503,
                                headers: {
                                    "Content-Type":
                                        "text/plain"
                                }
                            }
                        );

                    });

            })

    );

});


/* =====================================================
   PUSH NOTIFICATIONS
===================================================== */

self.addEventListener("push", event => {

    console.log(
        "CineFlix Service Worker received push notification."
    );


    let data = {};


    try {

        if (event.data) {

            data = event.data.json();

        }

    }

    catch (error) {

        console.error(
            "CineFlix push data error:",
            error
        );


        data = {

            title:
                "CineFlix",

            body:
                event.data
                    ? event.data.text()
                    : "You have a new notification."

        };

    }


    const title =
        data.title ||
        "🎬 CineFlix";


    const options = {

        body:
            data.body ||
            "You have a new CineFlix notification.",


        icon:
            data.icon ||
            "https://cineflix-rooney.oneapp.dev/icon-192.png",


        badge:
            data.badge ||
            "https://cineflix-rooney.oneapp.dev/icon-192.png",


        tag:
            "cineflix-notification",


        renotify:
            true,


        vibrate: [
            200,
            100,
            200
        ],


        data: {

            url:
                data.url ||
                "https://cineflix-rooney.oneapp.dev/"

        }

    };


    event.waitUntil(

        self.registration.showNotification(
            title,
            options
        )

    );

});


/* =====================================================
   NOTIFICATION CLICK
===================================================== */

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();


        const url =

            event.notification.data &&
            event.notification.data.url

                ? event.notification.data.url

                : "https://cineflix-rooney.oneapp.dev/";


        event.waitUntil(

            clients.matchAll({

                type: "window",

                includeUncontrolled: true

            })

            .then(clientList => {


                /*
                   If CineFlix is already open,
                   focus it.
                */

                for (
                    const client
                    of clientList
                ) {

                    if (
                        "focus" in client
                    ) {

                        client.navigate(url);

                        return client.focus();

                    }

                }


                /*
                   Otherwise open CineFlix.
                */

                if (
                    clients.openWindow
                ) {

                    return clients.openWindow(
                        url
                    );

                }

            })

        );

    }

);


/* =====================================================
   UPDATE MESSAGE
===================================================== */

self.addEventListener(
    "message",
    event => {

        /*
           The CineFlix page sends this message
           when the user presses the Update button.
        */

        if (
            event.data &&
            event.data.type ===
            "SKIP_WAITING"
        ) {

            self.skipWaiting();

        }

    }

);
