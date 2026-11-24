
const SITE = "https://www.cineflix.qd.je";
const TMDB = "https://api.themoviedb.org/3";
const ANILIST = "https://graphql.anilist.co";

function slugify(title) {
    return String(title || "")
        .toLowerCase()
        .trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function urlEntry(path) {
    return `<url><loc>${xmlEscape(SITE + path)}</loc></url>`;
}

async function fetchTMDB(path, token) {
    const response = await fetch(TMDB + path, {
        headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`TMDB request failed: ${response.status}`);
    }

    return response.json();
}

async function fetchAniList(page) {
    const query = `
        query ($page: Int) {
            Page(page: $page, perPage: 50) {
                media(
                    type: ANIME,
                    isAdult: false,
                    sort: POPULARITY_DESC
                ) {
                    id
                    title {
                        english
                        romaji
                        native
                    }
                }
            }
        }
    `;

    const response = await fetch(ANILIST, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            query,
            variables: { page }
        })
    });

    if (!response.ok) {
        throw new Error(`AniList request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors || !result.data?.Page) {
        throw new Error("AniList returned an error.");
    }

    return result.data.Page.media || [];
}

export async function onRequestGet({ env }) {
    try {
        const token =
    env?.TMDB_TOKEN ||
    env?.TMDB_READ_ACCESS_TOKEN;

        if (!token) {
            return new Response("TMDB_TOKEN is not configured.", {
                status: 500
            });
        }

        const urls = new Set();

        urls.add(urlEntry("/"));

        // TMDB movies
        for (let page = 1; page <= 5; page++) {
            const data = await fetchTMDB(
                `/discover/movie?include_adult=false&language=en-US&sort_by=popularity.desc&page=${page}`,
                token
            );

            for (const movie of data.results || []) {
                const title = movie.title || movie.original_title;
                const slug = slugify(title);

                if (slug) {
                    urls.add(urlEntry(`/movie/${slug}`));
                }
            }
        }

        // TMDB TV shows
        for (let page = 1; page <= 5; page++) {
            const data = await fetchTMDB(
                `/discover/tv?include_adult=false&language=en-US&sort_by=popularity.desc&page=${page}`,
                token
            );

            for (const show of data.results || []) {
                const title = show.name || show.original_name;
                const slug = slugify(title);

                if (slug) {
                    urls.add(urlEntry(`/tv/${slug}`));
                }
            }
        }

        // AniList anime
        for (let page = 1; page <= 5; page++) {
            const animeList = await fetchAniList(page);

            for (const anime of animeList) {
                const title =
                    anime.title.english ||
                    anime.title.romaji ||
                    anime.title.native ||
                    "Unknown Anime";

                const slug = slugify(title);

                if (slug && anime.id) {
                    urls.add(
                        urlEntry(`/anime/${slug}-${Number(anime.id)}`)
                    );
                }
            }
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(urls).join("\n")}
</urlset>`;

        return new Response(xml, {
            headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "public, max-age=3600"
            }
        });

     } catch (error) {
        console.error("CineFlix sitemap error:", error);

        return new Response(
            `CineFlix sitemap error: ${error.message || String(error)}`,
            {
                status: 500,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8"
                }
            }
        );
    }
}
