import { fileURLToPath, URL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Lyrical.ly Vite Dev Server",
      },
    });

    const text = await response.text();

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      data: {
        message: error instanceof Error ? error.message : "Upstream request failed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function stripSyncedLyrics(syncedLyrics?: string | null) {
  if (!syncedLyrics) return null;

  const plain = syncedLyrics
    .split("\n")
    .map((line) => line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/g, "").trim())
    .filter(Boolean)
    .join("\n");

  return plain || null;
}

function cleanLyricsText(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/g, "").trimEnd())
    .join("\n")
    .trim();
}

function getLyricsFromUnknown(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const item = data as {
    lyrics?: unknown;
    plainLyrics?: unknown;
    syncedLyrics?: unknown;
    instrumental?: unknown;
  };

  if (typeof item.lyrics === "string" && item.lyrics.trim()) return cleanLyricsText(item.lyrics);
  if (typeof item.plainLyrics === "string" && item.plainLyrics.trim()) {
    return cleanLyricsText(item.plainLyrics);
  }
  if (item.instrumental) return "Instrumental track — no lyrics available.";
  if (typeof item.syncedLyrics === "string") return stripSyncedLyrics(item.syncedLyrics);

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeDeezerSuggestions(data: unknown) {
  const root = asRecord(data);
  const tracks = Array.isArray(root?.data) ? root.data : [];

  return tracks
    .map((track) => {
      const item = asRecord(track);
      const artist = asRecord(item?.artist);
      const album = asRecord(item?.album);

      if (!item || !artist || typeof item.title !== "string" || typeof artist.name !== "string") {
        return null;
      }

      return {
        id: Number(item.id) || 0,
        title: item.title,
        preview: typeof item.preview === "string" ? item.preview : undefined,
        duration: typeof item.duration === "number" ? item.duration : undefined,
        artist: {
          id: Number(artist.id) || 0,
          name: artist.name,
          picture: typeof artist.picture === "string" ? artist.picture : undefined,
          picture_medium:
            typeof artist.picture_medium === "string" ? artist.picture_medium : undefined,
        },
        album: {
          id: Number(album?.id) || 0,
          title: typeof album?.title === "string" ? album.title : "",
          cover: typeof album?.cover === "string" ? album.cover : undefined,
          cover_medium: typeof album?.cover_medium === "string" ? album.cover_medium : undefined,
          cover_big: typeof album?.cover_big === "string" ? album.cover_big : undefined,
        },
      };
    })
    .filter(Boolean);
}

async function fetchSuggestions(query: string) {
  const deezer = await fetchJson(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
  const deezerSuggestions = normalizeDeezerSuggestions(deezer.data);

  if (deezer.ok && deezerSuggestions.length > 0) {
    return { data: deezerSuggestions };
  }

  const lyricsOvh = await fetchJson(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);

  if (lyricsOvh.ok) {
    return lyricsOvh.data;
  }

  return { data: [] };
}

async function fetchLyricsFromLrclib(artist: string, title: string) {
  const exactParams = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });

  const exact = await fetchJson(`https://lrclib.net/api/get?${exactParams.toString()}`);
  const exactLyrics = getLyricsFromUnknown(exact.data);

  if (exact.ok && exactLyrics) return exactLyrics;

  const searchParams = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });

  const search = await fetchJson(`https://lrclib.net/api/search?${searchParams.toString()}`);

  if (Array.isArray(search.data)) {
    for (const item of search.data) {
      const lyrics = getLyricsFromUnknown(item);
      if (lyrics) return lyrics;
    }
  }

  return null;
}

async function fetchLyricsWithFallback(artist: string, title: string) {
  const lyricsOvh = await fetchJson(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
  );

  const lyricsOvhText = getLyricsFromUnknown(lyricsOvh.data);
  if (lyricsOvh.ok && lyricsOvhText) return lyricsOvhText;

  const lrclibText = await fetchLyricsFromLrclib(artist, title);
  if (lrclibText) return lrclibText;

  return null;
}

async function handleLyricsDev(url: URL, res: ServerResponse) {
  const type = url.searchParams.get("type");

  if (type === "suggest") {
    const q = url.searchParams.get("q")?.trim();

    if (!q) {
      writeJson(res, 400, { error: "Missing search query" });
      return;
    }

    writeJson(res, 200, await fetchSuggestions(q));
    return;
  }

  if (type === "lyrics") {
    const artist = url.searchParams.get("artist")?.trim();
    const title = url.searchParams.get("title")?.trim();

    if (!artist || !title) {
      writeJson(res, 400, { error: "Missing artist or title" });
      return;
    }

    const lyrics = await fetchLyricsWithFallback(artist, title);

    if (!lyrics) {
      writeJson(res, 404, { error: "Lyrics not found for this track" });
      return;
    }

    writeJson(res, 200, { lyrics });
    return;
  }

  writeJson(res, 400, { error: "Invalid lyrics request type" });
}

async function handleYouTubeDev(url: URL, res: ServerResponse) {
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!q) {
    writeJson(res, 400, { videoId: null });
    return;
  }

  try {
    const response = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} official audio`)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    );

    if (!response.ok) {
      writeJson(res, 200, { videoId: null });
      return;
    }

    const html = await response.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);

    writeJson(res, 200, { videoId: match?.[1] ?? null });
  } catch {
    writeJson(res, 200, { videoId: null });
  }
}

function localApiPlugin(): Plugin {
  return {
    name: "lyrical-local-api",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const requestUrl = new URL(req.url ?? "/", "http://localhost");

        try {
          if (requestUrl.pathname === "/api/lyrics") {
            await handleLyricsDev(requestUrl, res);
            return;
          }

          if (requestUrl.pathname === "/api/youtube-search") {
            await handleYouTubeDev(requestUrl, res);
            return;
          }
        } catch (error) {
          console.error("Local API error:", error);
          writeJson(res, 502, { error: "Local API request failed" });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
});
