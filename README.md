# Where's Walter? 🟢🧣

A procedurally generated **hidden-object game**. Find **Walter** — green beanie (with
a white pom), orange-and-white striped scarf, yellow jacket, and brown round glasses —
hidden in a crowd of hundreds. Play solo on an endless supply of fresh maps, create and
share challenges with a custom hiding spot, or race friends in real-time multiplayer.

> **Walter is an original character.** He deliberately does **not** wear the trademarked
> red-and-white striped shirt, red bobble hat, and round glasses of "Waldo/Wally". All
> scene artwork is original, procedurally generated SVG built from primitive shapes — no
> copied or licensed imagery anywhere.

---

## Quick start

```bash
npm install        # installs all three workspaces (compiles better-sqlite3 natively)
npm run seed       # seeds the demo challenge so /c/demo works immediately
npm run dev        # starts server (:4000) + client (:5173) with one command
```

Then open **http://localhost:5173**.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds `shared`, then runs server + client concurrently (hot reload). |
| `npm run build` | Production build of all three workspaces. |
| `npm run test` | Builds `shared` and runs the engine unit tests (Vitest). |
| `npm run seed` | Inserts/refreshes the demo challenge (`/c/demo`). |
| `npm run typecheck` | Strict `tsc --noEmit` across every workspace. |
| `npm start` *(in `server/`)* | Runs the built server, which **also serves the built client** (single-port production mode). |

For production: `npm run build` then `npm start --workspace server` and open
http://localhost:4000 — Express serves `client/dist` and handles SPA deep links.

---

## Tech stack

- **Client:** Vite + React 18 + TypeScript + **Tailwind CSS** (dark-mode only; no other UI framework, no hand-written CSS beyond the Tailwind entry).
- **Server:** Node + Express + TypeScript, **Socket.IO** for real-time multiplayer.
- **Database:** SQLite via `better-sqlite3` (single file at `server/data/walter.db`, zero-config).
- **Shared:** a `@walter/shared` package containing the seeded map generator, RNG, hit
  detection, hint/score logic, SVG renderer and all types — imported by **both** client
  and server so maps render identically on both sides.
- **Seeded RNG:** `seedrandom`. Every map is fully determined by its settings.

Monorepo layout (npm workspaces):

```
wheres-walter/
├── shared/   # @walter/shared — engine + types + renderer (+ Vitest tests)
├── server/   # @walter/server — Express REST + Socket.IO + SQLite
└── client/   # @walter/client — React + Tailwind SPA
```

---

## How the seeded generation works

A scene is **fully determined** by `MapSettings = { seed, theme, mapSize, difficulty }`.
The same settings always produce a pixel-identical crowd on the client and the server.

1. **Crowd layout** (`generateScene`): the map dimensions and a target crowd size
   (300–800, clamped) come from `mapSize` × `difficulty`. Characters are placed on a
   **jittered grid** so the crowd is dense but not perfectly aligned, scaled by depth
   (lower = larger), and sorted back-to-front (painter's algorithm) for natural overlap.
   The RNG stream is seeded from the full settings.
2. **Decoys & near-misses** (`makeDecoy`): each decoy is assembled from a parts system
   (skin, hair, jacket, pants, hat, scarf, glasses) with theme-specific palettes. A tunable
   fraction are **deliberate near-misses** — they start as a Walter and break 1–3 of his
   distinguishing traits (green beanie but no scarf; orange scarf but a blue jacket; etc.).
   A hard guarantee ensures **no decoy is ever a full Walter**.
3. **Walter placement**: solo derives Walter's position from a *separate* seeded RNG
   stream (`deriveWalterPosition`); multiplayer places N Walters with enforced minimum
   spacing (`deriveWalterPositions`); challenges use the creator's chosen coordinates.
   Walter's render scale is a pure function of his `y` (`walterScale`) so client rendering
   and server hit-detection always agree.
4. **Hit detection** (`hitBoxFor` / `isHit`): a click is a hit if it lands within a radius
   of `CHAR_HALF_H * scale + 8px` padding around Walter — works in **scene coordinates**
   at any zoom level (the viewer converts screen → scene coords).
5. **Hints** (`generateHint`): a translucent amber circle whose radius shrinks per level
   (35% → 22% → 12% of the map's shorter side). The center is offset off Walter toward the
   map interior (with jitter) so **Walter is always inside but never centered**, and the
   circle never drifts off-screen.
6. **Scoring** (`starsFor`): `effective = raw + wrongClicks×5s + hints×15s`;
   ★★★ `< 45s`, ★★ `< 120s`, ★ otherwise.

The engine is covered by unit tests (`shared/test/engine.test.ts`): seed determinism
(same seed → byte-identical character list), crowd-size bounds, "no decoy is a full
Walter", hit detection, multi-Walter spacing, the hint invariants (inside + never
centered, across 200 randomized trials and all three levels), and star thresholds.

---

## Game modes

### Solo (`/play`)
Every game uses a **fresh random seed** (the map never repeats), with a 3-2-1 countdown,
a live `mm:ss.t` timer, wrong-click rose ripples (`+5s` each, no limit), up to **3 hints**
(`+15s` each, shown in the UI), a confetti win screen with stars, and a **top-10 best-times
list persisted in `localStorage`** shown on the landing page.

### Challenge (`/create` → `/c/:id` → `/c/:id/results`)
The creator picks a name, title, theme and size, then places Walter by tapping the
generated map (repositionable until confirmed; "Reroll Map" gets a new seed). On confirm
the server stores `{ id (nanoid 10), seed, theme, mapSize, walterX, walterY, creatorName,
title, createdAt }` and returns a share URL `…/c/:id` (with copy-to-clipboard). Players
enter a name and play the full solo flow on the creator's map; **clicks, hints and timing
are validated/owned server-side**, one result per name per challenge. A sortable
leaderboard (rank, name, time, wrong clicks, hints, stars) lives at `/c/:id/results`.

### Multiplayer (`/multiplayer`, Socket.IO)
Create a room or join via 6-character code (2–8 players). The host configures number of
Walters (5–20, default 10), time limit (1–5 min, default 3), theme and map size (Large/XL).
On start, all clients get the same seed; the **server holds the authoritative Walter
positions and resolves claims** (first claimer wins by server timestamp; each claimed
Walter is marked with the finder's color and can't be re-claimed). Wrong clicks incur a
server-enforced **2-second personal lockout**. A live scoreboard ranks players by Walters
found; the game ends on time-out **or** all-found (winner = most found, tie-break = earlier
last find), shown on a podium with a host **Rematch**. Disconnects are graceful (player
marked offline, finds keep counting; host migrates if the host leaves).

---

## API summary

REST (`/api/challenges`):

| Method & path | Notes |
| --- | --- |
| `POST /` | Create a challenge → `{ id, shareUrl, resultsUrl }`. |
| `GET /:id` | Public metadata — **Walter coordinates omitted**. |
| `GET /:id/walter.svg` | Walter as opaque SVG markup for the client to inject (see below). |
| `POST /:id/start` | Begin a timed attempt → `{ playToken, serverStartMs }`. |
| `POST /:id/clicks` | Validate a click; on a hit, finalize the attempt server-side. |
| `POST /:id/hints` | Returns hint-circle geometry (never the exact spot). |
| `GET /:id/results` | Leaderboard. |

Socket.IO events (typed payloads in `@walter/shared`): `room:create`, `room:join`,
`room:settings`, `room:leave`, `game:start`, `game:click`, `game:rematch` (client→server);
`room:state`, `game:countdown`, `game:start`, `game:claim`, `game:miss`, `game:lockout`,
`game:end`, `error:msg` (server→client).

Timing is authoritative on the server for both challenges (clock starts on `start`, stops
on a validated hit) and multiplayer (start/end timestamps owned by the room), so results
can't be trivially faked by editing client time.

---

## Design note: concealment in a *visual* find-game

The spec asks that "the client never receives Walter's exact position" for challenges and
multiplayer. A hidden-object game has an inherent tension here: the target **must be drawn
on screen** to be findable, so its pixels are always present client-side. We honour the
requirement as far as is meaningful:

- **Challenges:** `GET /:id` never returns coordinates. Walter is delivered separately as an
  **opaque pre-rendered SVG fragment** (`GET /:id/walter.svg`) that the client injects into
  the scene but **never parses into a usable coordinate** — no `walterX/walterY` ever enters
  client game logic. Clicks are sent to the server and validated against the stored position;
  the server owns timing and writes the result. (A determined user could read the transform
  out of the DOM — true zero-knowledge concealment is impossible when the answer must be
  visible — but the server remains the sole source of truth for results.)
- **Multiplayer:** positions are sent at `game:start` purely for rendering; **claims, the
  2-second lockout, scoring and the win condition are all resolved server-side**, which is
  what actually matters in a simultaneous race.

- **Solo** is client-only (no server round-trip), so it simply uses the deterministic
  seed-derived position.

---

## Conventions chosen where the spec was silent

- **Difficulty** (`easy`/`normal`/`hard`) tunes crowd density and near-miss frequency; solo
  and challenges default to `normal`.
- **Themes:** beach, city plaza, winter market (each with its own palette and background props).
- **Map sizes:** small/medium/large/**xl**; multiplayer is restricted to large/xl per spec.
- **Best-times** ranking uses *effective* time (with penalties). Player name is remembered
  in `localStorage` for convenience across modes.
- **Production** runs single-port: the server serves the built client and SPA deep links.

---

## Intentionally deferred / possible next steps

- **Drag-to-reposition** Walter in the creator currently works as tap-to-(re)place; a true
  pointer-drag handle on the marker was deferred to keep placement robust under pan/zoom.
- **Persistence of rooms**: multiplayer rooms live in server memory (no DB) and are disposed
  when empty — fine for a single-instance deployment; horizontal scaling would need a Redis
  adapter for Socket.IO and shared room state.
- **In-memory attempt tokens** (challenge timing) are not persisted across server restarts;
  an in-flight attempt would need to be restarted. Completed results are persisted in SQLite.
- **Accounts/auth** are out of scope — challenge identity is by display name (one result per
  name per challenge).
- No automated **browser/E2E** tests; the engine has unit tests and the REST + Socket.IO
  flows were verified end-to-end manually during development.
```
