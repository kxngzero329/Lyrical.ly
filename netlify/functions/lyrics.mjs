const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
  "cache-control": "public, max-age=300",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Lyrical.ly Netlify Function",
      },
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
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

function stripSyncedLyrics(syncedLyrics) {
  if (!syncedLyrics) return null;

  const plain = syncedLyrics
    .split("\n")
    .map((line) => line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/g, "").trim())
    .filter(Boolean)
    .join("\n");

  return plain || null;
}

function cleanLyricsText(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/g, "").trimEnd())
    .join("\n")
    .trim();
}

function getLyricsFromData(data) {
  if (!data || typeof data !== "object") return null;

  if (typeof data.lyrics === "string" && data.lyrics.trim()) {
    return cleanLyricsText(data.lyrics);
  }

  if (typeof data.plainLyrics === "string" && data.plainLyrics.trim()) {
    return cleanLyricsText(data.plainLyrics);
  }

  if (data.instrumental) {
    return "Instrumental track — no lyrics available.";
  }

  if (typeof data.syncedLyrics === "string") {
    return stripSyncedLyrics(data.syncedLyrics);
  }

  return null;
}

function asRecord(value) {
  return value && typeof value === "object" ? value : null;
}

function normalizeDeezerSuggestions(data) {
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

async function fetchSuggestions(query) {
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

async function fetchLyricsFromLrclib(artist, title) {
  const exactParams = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });

  const exact = await fetchJson(`https://lrclib.net/api/get?${exactParams.toString()}`);
  const exactLyrics = getLyricsFromData(exact.data);

  if (exact.ok && exactLyrics) return exactLyrics;

  const searchParams = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });

  const search = await fetchJson(`https://lrclib.net/api/search?${searchParams.toString()}`);

  if (Array.isArray(search.data)) {
    for (const item of search.data) {
      const lyrics = getLyricsFromData(item);
      if (lyrics) return lyrics;
    }
  }

  return null;
}

async function fetchLyricsWithFallback(artist, title) {
  const lyricsOvh = await fetchJson(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
  );

  const lyricsOvhText = getLyricsFromData(lyricsOvh.data);
  if (lyricsOvh.ok && lyricsOvhText) return lyricsOvhText;

  const lrclibText = await fetchLyricsFromLrclib(artist, title);
  if (lrclibText) return lrclibText;

  return null;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const params = event.queryStringParameters ?? {};
  const type = params.type;

  if (type === "suggest") {
    const q = params.q?.trim();

    if (!q) {
      return json(400, { error: "Missing search query" });
    }

    return json(200, await fetchSuggestions(q));
  }

  if (type === "lyrics") {
    const artist = params.artist?.trim();
    const title = params.title?.trim();

    if (!artist || !title) {
      return json(400, {
        error: "Missing artist or title",
      });
    }

    const lyrics = await fetchLyricsWithFallback(artist, title);

    if (!lyrics) {
      return json(404, {
        error: "Lyrics not found for this track",
      });
    }

    return json(200, { lyrics });
  }

  return json(400, {
    error: "Invalid lyrics request type",
  });
}
