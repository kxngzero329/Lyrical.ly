# Lyrical.ly — Clean Vite Build

This is a clean client-side Vite + React rebuild of the original Lyrical.ly project.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL, usually:

```txt
http://localhost:8080
```

The local Vite dev server includes API middleware for:

- `/api/lyrics`
- `/api/youtube-search`

That means you do not need `netlify dev` for normal local development.

## Build

```bash
npm run build
```

## Deploy to Netlify

Netlify will use `netlify.toml`:

```txt
Build command: npm run build
Publish directory: dist
```

In production, `/api/lyrics` and `/api/youtube-search` are redirected to Netlify Functions so the browser does not hit third-party APIs directly.
