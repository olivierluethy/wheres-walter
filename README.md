# Where's Walter? 🟢🧣

A procedurally generated **hidden-object game**. Find **Walter** — a yellow-and-blue
striped sweater, a green pompom beanie, brown round glasses, charcoal trousers and white
sneakers, **mid-wave** — hidden in a crowd of hundreds. Play solo on an endless supply of
fresh maps, create and share challenges with a custom hiding spot, or race friends in
real-time multiplayer.

> **Walter is an original character.** He deliberately does **not** reproduce the
> "Waldo/Wally" design (red-and-white striped shirt, red bobble hat, black round glasses,
> blue jeans, brown boots, cane, satchel). He uses the genre's conventions — a striped top,
> a hat, glasses, a friendly wave — but with a clearly different palette and combination.
> All scene artwork is original, procedurally generated SVG built from primitive shapes —
> no copied or licensed imagery anywhere.

### Walter's design (and why he's findable)

Walter was redesigned so players can spot him without burning hints. His distinguishing
features:

| Attribute | Value |
| --- | --- |
| Sweater | bold horizontal stripes, **yellow `#FACC15` + royal blue `#2563EB`** (6 bands) |
| Hat | **green `#16A34A` beanie** with a white pompom |
| Glasses | round, **brown `#78350F`** frames |
| Trousers / shoes | charcoal `#1F2937` / **white sneakers** |
| Pose | **one arm raised, waving — he is the only waving character in the scene** |
| Size | rendered at **1.15× the average decoy scale** (a distinctly larger silhouette) |

The raised arm gives Walter a unique silhouette that reads even at low zoom, and his
high-contrast stripes pop against every theme. When Walter is auto-placed (solo &
multiplayer) the engine samples the background under him and, if his stripes wouldn't
contrast enough, deterministically nudges him to the nearest spot that passes. In the
challenge creator the placement is the creator's choice, so a low-contrast spot only shows
a subtle warning.

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
   (skin, hair, top, trousers, shoes, hat, glasses, **pose**) with theme-specific palettes.
   The factory constructs every decoy to provably satisfy the **exclusivity invariants**
   below, granting *at most one* of Walter's signature attributes explicitly and forcing
   every other signature-bearing field to a non-matching value. **Decoy exclusivity rules
   (absolute at every theme/size/seed/difficulty):**
   - **§3.1** No decoy ever has a raised/waving arm (poses: standing, walking, sitting,
     crouching only).
   - **§3.2** No decoy wears the yellow+blue stripe combo; striped decoys use other pairs
     (red/white, green/white, …) and **≤ 8%** of decoys wear stripes at all.
   - **§3.3** No decoy shares **more than one** of Walter's four signature attributes
     (yellow/blue striped sweater, green pompom beanie, brown round glasses, white sneakers).
   - **§3.4** No decoy renders at Walter's 1.15× scale — decoy scale is bounded to 0.9×–1.05×.
   - **§3.5** Walter is drawn last, so he can never be meaningfully occluded by props or
     other characters.

   These are enforced by construction (not rejection sampling) and verified by an invariant
   test over 50 randomized scenes. The single source of truth for "does this character share
   a signature attribute" is `sharedAttributeCount()` in `palette.ts`, used by both the
   generator and the tests.

   A **`decoyTrickiness`** setting (0–1, default 0.5) scales how many *one-attribute*
   near-misses cluster within a 20%-radius neighborhood of Walter — more near-misses near
   him makes the hunt harder. It **never** loosens the invariants above. Solo and multiplayer
   use 0.5; the challenge creator exposes Easy / Normal / Tricky → 0.25 / 0.5 / 0.8. (Because
   the crowd must stay seed-deterministic, near-misses cluster around the *seed-derived*
   Walter anchor; in a challenge with a custom placement that anchor may differ from the
   creator's exact spot.)
3. **Walter placement**: solo derives Walter's position from a *separate* seeded RNG
   stream (`deriveWalterPosition`); multiplayer places N Walters with enforced minimum
   spacing (`deriveWalterPositions`); challenges use the creator's chosen coordinates.
   Auto-placed Walters are nudged off any low-contrast spot via a deterministic ring search
   (`nudgeForContrast`, using the WCAG `contrastRatio` of his stripes vs `backgroundColorAt`).
   Walter's render scale is the constant `WALTER_SCALE` (1.15× the average decoy) so client
   rendering and server hit-detection always agree and he stays larger than every decoy.
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
(same settings → byte-identical character list; trickiness is part of the deterministic
input), crowd-size bounds, the **decoy exclusivity invariants over 50 randomized scenes**
(§3.1–§3.4), Walter's design (4 signature attributes, waving, larger than any decoy),
trickiness tuning (more near-misses near Walter without breaking invariants), the contrast
placement guarantee (auto-placed Walters never left low-contrast), hit detection,
multi-Walter spacing, the hint invariants (inside + never centered, across 200 randomized
trials and all three levels), and star thresholds.

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

- **Difficulty** (`easy`/`normal`/`hard`) tunes crowd *density*; near-miss frequency is
  driven separately by **`decoyTrickiness`** (the challenge creator's Easy/Normal/Tricky).
  Solo and challenges default to `normal`.
- **Demo / existing challenges:** the seeded demo (`/c/demo`) is regenerated by `npm run seed`
  with the redesigned engine. Challenge links created **before** the redesign still work — the
  stored seed and Walter coordinates are unchanged, so they render the **new** Walter design
  at the **same coordinates** (the DB gains a `decoyTrickiness` column defaulting to 0.5 via
  an automatic migration).
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
