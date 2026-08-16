const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const TIKWM_API = "https://www.tikwm.com/api/?url=";

// ============================================================
// STATIC WEBSITE
// ============================================================

app.use(express.static(path.join(__dirname, "public")));


// ============================================================
// TIKTOK URL VALIDATION
// ============================================================

function isTikTokUrl(value) {
    try {
        const url = new URL(value);

        const host = url.hostname
            .toLowerCase()
            .replace(/^www\./, "");

        const allowedHosts = [
            "tiktok.com",
            "m.tiktok.com",
            "vm.tiktok.com",
            "vt.tiktok.com"
        ];

        return allowedHosts.some(
            (allowed) =>
                host === allowed ||
                host.endsWith("." + allowed)
        );

    } catch {
        return false;
    }
}


// ============================================================
// DOWNLOAD API
// ============================================================

app.get("/api/download", async (req, res) => {

    const url = String(req.query.url || "").trim();

    if (!url) {
        return res.status(400).json({
            ok: false,
            error: "TikTok URL is required."
        });
    }

    if (!isTikTokUrl(url)) {
        return res.status(400).json({
            ok: false,
            error: "Invalid TikTok URL."
        });
    }

    try {

        console.log("🔗 Processing:", url);

        const response = await fetch(
            TIKWM_API + encodeURIComponent(url),
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `TikWM API returned ${response.status}`
            );
        }

        const json = await response.json();

        const data = json?.data;

        if (!data?.play) {

            return res.status(404).json({
                ok: false,
                error:
                    "No downloadable video was found for this link."
            });
        }


        // ====================================================
        // RETURN MEDIA INFORMATION
        // ====================================================

        const videoUrl = data.play;
        const audioUrl = data.music || null;

        res.json({

            ok: true,

            title:
                data.title ||
                "Media Save Video",

            author:
                data.author?.nickname ||
                data.author?.unique_id ||
                "",

            cover:
                data.cover ||
                "",

            duration:
                data.duration ||
                0,

            video:
                `/api/media?url=${encodeURIComponent(
                    videoUrl
                )}&type=video`,

            audio:
                audioUrl
                    ? `/api/media?url=${encodeURIComponent(
                          audioUrl
                      )}&type=audio`
                    : null
        });

    } catch (error) {

        console.error(
            "❌ Download API Error:",
            error.message
        );

        res.status(502).json({
            ok: false,
            error:
                "Media service is temporarily unavailable. Please try again later."
        });
    }
});


// ============================================================
// MEDIA PROXY
// ============================================================

app.get("/api/media", async (req, res) => {

    const target =
        String(req.query.url || "").trim();

    const type =
        req.query.type === "audio"
            ? "audio"
            : "video";


    if (!target) {

        return res.status(400).send(
            "Missing media URL."
        );
    }


    try {

        const mediaUrl = new URL(target);


        // Only HTTPS URLs
        if (mediaUrl.protocol !== "https:") {

            return res.status(400).send(
                "Invalid media URL."
            );
        }


        const upstream = await fetch(
            mediaUrl,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
                }
            }
        );


        if (
            !upstream.ok ||
            !upstream.body
        ) {

            return res.status(502).send(
                "Media could not be fetched."
            );
        }


        // ====================================================
        // CONTENT TYPE
        // ====================================================

        const contentType =
            upstream.headers.get(
                "content-type"
            ) ||
            (
                type === "audio"
                    ? "audio/mpeg"
                    : "video/mp4"
            );


        res.setHeader(
            "Content-Type",
            contentType
        );


        res.setHeader(
            "Cache-Control",
            "public, max-age=300"
        );


        res.setHeader(
            "Content-Disposition",

            `inline; filename="media-save-${
                type === "audio"
                    ? "audio.mp3"
                    : "video.mp4"
            }"`
        );


        const contentLength =
            upstream.headers.get(
                "content-length"
            );


        if (contentLength) {

            res.setHeader(
                "Content-Length",
                contentLength
            );
        }


        // ====================================================
        // STREAM MEDIA
        // ====================================================

        const reader =
            upstream.body.getReader();


        res.on("close", () => {

            reader
                .cancel()
                .catch(() => {});

        });


        while (true) {

            const {
                done,
                value
            } = await reader.read();


            if (done) {
                break;
            }


            res.write(
                Buffer.from(value)
            );
        }


        res.end();

    } catch (error) {

        console.error(
            "❌ Media Proxy Error:",
            error.message
        );


        if (!res.headersSent) {

            res.status(502).send(
                "Media proxy failed."
            );

        } else {

            res.end();
        }
    }
});


// ============================================================
// SPA FALLBACK
// ============================================================

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log(
            "╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮"
        );

        console.log(
            "      🚀 MEDIA SAVE"
        );

        console.log(
            "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
        );

        console.log(
            `🌐 Server running on port ${PORT}`
        );

        console.log(
            "🎬 TikTok Downloader: READY"
        );

        console.log(
            "⚡ API: READY"
        );

        console.log(
            "🎧 Audio Support: READY"
        );

        console.log(
            "💫 Animated Website: READY"
        );
    }
);
