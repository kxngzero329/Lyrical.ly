export interface YouTubeSearchResult {
  videoId: string | null;
}

const YOUTUBE_SEARCH_API_URL = "/api/youtube-search";

export async function searchYouTube(q: string): Promise<YouTubeSearchResult> {
  const cleanedQuery = q.trim();

  if (!cleanedQuery) return { videoId: null };

  try {
    const params = new URLSearchParams({ q: cleanedQuery });
    const response = await fetch(`${YOUTUBE_SEARCH_API_URL}?${params.toString()}`);

    if (!response.ok) {
      return { videoId: null };
    }

    return (await response.json()) as YouTubeSearchResult;
  } catch {
    return { videoId: null };
  }
}
