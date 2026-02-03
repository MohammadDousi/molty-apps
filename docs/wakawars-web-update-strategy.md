# WakaWars Web + Electron Update Strategy

## Goal
Ensure the hosted web app updates propagate quickly to all clients, including the Electron menu bar app, without stale caches.

## Hosting + Cache Rules
- Serve `index.html` with `Cache-Control: no-store` so clients always revalidate the entry HTML.
- Serve hashed JS/CSS assets with `Cache-Control: public, max-age=31536000, immutable`.
- Ensure each deploy produces new hashed asset filenames so caches are naturally busted.

## Service Worker Update Flow
- Use a Workbox-based service worker (for example via `vite-plugin-pwa`) to precache build assets.
- On page load, register the service worker and listen for a new worker reaching the `waiting` state.
- When an update is detected, show an in-app banner or toast with a `Reload` action.
- On user action, post a `SKIP_WAITING` message to the service worker, then reload the page.
- On activate, the new worker should call `clients.claim()` to take control immediately.

## Electron Client Behavior
- The Electron app loads `https://wakawars.molty.cool` directly, so it naturally picks up new HTML as soon as it reloads.
- To avoid sticky caches in Electron, prefer `no-store` on `index.html` and rely on the service worker update prompt.
- If we need a more aggressive path, add an IPC hook to trigger `webContents.reloadIgnoringCache()` after a web update is detected.

## Compatibility + Rollout
- Keep API changes backward-compatible for at least one release so older Electron versions continue to work.
- If breaking changes are needed, gate them behind a server flag or versioned API route and roll out in two stages.

## Minimal Implementation Checklist
- Add a service worker with precache + update handling.
- Add a small UI banner for “Update available”.
- Confirm `index.html` is served with `no-store`.
- Confirm build outputs use hashed filenames.
