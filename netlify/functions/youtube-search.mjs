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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed", videoId: null });
  }

  const q = event.queryStringParameters?.q?.trim() ?? "";

  if (!q) {
    return json(400, { videoId: null });
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `${q} official audio`,
    )}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return json(200, { videoId: null });
    }

    const html = await response.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);

    return json(200, { videoId: match?.[1] ?? null });
  } catch (error) {
    console.error("YouTube search function error:", error);
    return json(200, { videoId: null });
  }
}
