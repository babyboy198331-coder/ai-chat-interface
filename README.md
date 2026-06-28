# Nimbus — AI Chat Interface

A multi-model AI chat application with live token streaming, built with Next.js (App Router) and the OpenRouter API.

**Live demo:** https://deep-seek-clone-wine.vercel.app

## Features

- **Live token streaming** — responses render word-by-word via a server-side streaming proxy (Edge-style `ReadableStream` over SSE)
- **Multi-model switching** — swap between Llama 3, Gemma 2, DeepSeek, and Qwen mid-conversation; the model allowlist is validated server-side
- **Stop & regenerate** — cancel a response mid-stream (`AbortController` wired through to the upstream request) or regenerate the last reply
- **Markdown rendering** — custom zero-dependency renderer with fenced code blocks, copy-to-clipboard, inline code, lists, headings, and links
- **Persistent conversations** — chats are auto-titled from your first message and stored locally; search and manage them from the sidebar
- **Responsive** — collapsible sidebar on desktop, off-canvas drawer with backdrop on mobile

## Tech Stack

Next.js · React · Tailwind CSS · OpenRouter API (streaming)

## Getting Started

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` with your OpenRouter key:

   ```bash
   OPENROUTER_KEY=sk-or-...
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Architecture Notes

The browser never sees the API key — all model calls go through `app/api/OpenRouter/route.js`, which validates the requested model against an allowlist (shared with the client via `app/config/models.js`, so the two never drift apart), forwards the conversation upstream, and re-streams tokens back to the client as plain text. The client reads the stream with `response.body.getReader()` and updates React state per chunk, using functional state updaters to avoid stale-closure bugs during rapid streaming updates.

The API route also guards against abuse and misconfiguration:

- Fails fast with a clear error if `OPENROUTER_KEY` is missing, instead of an opaque upstream 502.
- Caps conversation size (60 messages / 8,000 chars per message / 60,000 chars total) before forwarding upstream.
- Applies a per-IP sliding-window rate limit (20 requests/minute) to protect against credit-burning abuse on a public deployment. It's in-memory and process-local — fine for a single instance, swap in Redis/Upstash if you scale horizontally.

## Desktop App (Electron)

`electron.js` wraps the app in a desktop shell. Because the app relies on server-side API routes (not just static pages), it can't use a static export — instead, production builds bundle a self-contained Next.js server (`output: "standalone"` in `next.config.ts`) that Electron spawns locally and points the window at.

```bash
npm run electron        # dev: launches Electron against `next dev`
npm run electron:dist    # prod: builds Next.js + packages with electron-builder
```
