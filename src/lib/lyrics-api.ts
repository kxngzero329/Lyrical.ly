export interface Suggestion {
  id: number;
  title: string;
  preview?: string;
  duration?: number;
  artist: {
    id: number;
    name: string;
    picture?: string;
    picture_medium?: string;
  };
  album: {
    id: number;
    title: string;
    cover?: string;
    cover_medium?: string;
    cover_big?: string;
  };
}

export interface LyricsResult {
  artist: string;
  title: string;
  lyrics: string;
  cover?: string;
  preview?: string;
}

const LYRICS_API_URL = "/api/lyrics";

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

export async function suggestSongs(query: string, signal?: AbortSignal): Promise<Suggestion[]> {
  const cleanedQuery = query.trim();

  if (!cleanedQuery) return [];

  const params = new URLSearchParams({
    type: "suggest",
    q: cleanedQuery,
  });

  const response = await fetch(`${LYRICS_API_URL}?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Search failed"));
  }

  const data = await response.json();
  return (data?.data ?? []) as Suggestion[];
}

export async function fetchLyrics(
  artist: string,
  title: string,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({
    type: "lyrics",
    artist,
    title,
  });

  const response = await fetch(`${LYRICS_API_URL}?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Lyrics not found"));
  }

  const data = await response.json();

  if (!data?.lyrics) {
    throw new Error("No lyrics available for this track");
  }

  return String(data.lyrics).replace(/\r\n/g, "\n").trim();
}
