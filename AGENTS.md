# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Commands

Use `pnpm` as the package manager (pnpm-lock.yaml). The `packageManager` field
in package.json pins the version, and pnpm switches to it automatically. Scripts
run as `pnpm run <script>`:

- **Dev server**: `dev` (Vite dev server with HMR, proxies `/api` to `localhost:4746`)
- **Build**: `build` (production build via Vite)
- **Type check**: `check` (runs svelte-check and tsc)
- **Lint**: `lint` (Oxlint; also runs during check)
- **Format**: `format` (Oxfmt with Svelte and Tailwind class sorting)
- **Format check**: `format:check`
- **Preview**: `preview` (serve production build locally)

Run `format`, `check`, and `build` between changes.

## Architecture

Lyra Web is a music player SPA built with **Svelte 5** + **TypeScript** + **Tailwind CSS 4** + **Vite**.

### Routing

Hash-based client-side routing in `src/App.svelte` using regex matching on `window.location.hash`:

- `#/` → LibraryList
- `#/libraries/:id` → LibraryAlbums
- `#/albums/:id` → AlbumPage
- `#/playlists` → PlaylistList
- `#/playlists/:id` → PlaylistPage

### State Management

Uses Svelte 5 runes (`$state`, `$derived`, `$derived.by`) for reactivity. Global player state lives in `src/lib/player.svelte.ts` as module-level `$state` variables, exposed via the `getPlayer()` function.

### API Layer

`src/lib/api.ts` contains typed fetch wrappers (`get`, `post`, `patch`, `del`) calling `/api/*` endpoints. The Vite dev server proxies these to the backend at `localhost:3000`. Types for all API responses are in `src/lib/types.ts`.

Audio streaming uses `/api/download/:entryId` via a native HTML5 `<audio>` element.

### Code Organization

All components and modules live in `src/lib/`. There are no subdirectories — components, the API client, types, and the player store are all siblings in that flat structure.

### Backend API Convention

The backend uses snake_case for all JSON fields (e.g., `track_title`, `db_id`, `duration_ms`). Query params use `inc=` to request related data (e.g., `?inc=artists,tracks,covers`).
