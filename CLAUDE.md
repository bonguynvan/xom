# Xóm Peti: project notes for Claude

A 1990s Vietnamese xóm seen from above at an angle (scroll painting / Age of Empires scale, small people):
railway, rows of tube houses, the main street with shops, market, đình, pond, well, bus stop. Shopkeepers,
walkers, kids, vendors, vehicles and animals each follow their own day and chat at random. No goals, no
scores, very little interaction (the user asked for that): drag to look around, wheel/pinch to zoom.
Part of the Peti family (`peti.vn` link hub, `duavit.peti.vn`), same visual style: thick ink outlines,
hard shadows, Baloo 2 + Be Vietnam Pro, cream/tomato/sun palette.
The user writes in **Vietnamese**; answer in Vietnamese. All UI text is Vietnamese.
Domain **https://xom.peti.vn**, repo `bonguynvan/xom` (public, open to contributors; see CONTRIBUTING.md).

## Commands
```bash
npm start   # scripts/serve.js on 127.0.0.1:3500 (same server as production: files, /api/live, /api/ops)
npm test    # node:test, all suites in test/
```
No dependencies, no build step.

## Architecture
- `public/js/world.js`: pure, immutable simulation. `stepWorld(world)` returns a new world, fixed
  `STEP_MS` = 50, game clock 1 real second = 1 game minute. Every random choice is
  `noise(seed, agent, tick, salt)` (stateless, `rng.js`), so a seed replays the same day exactly.
  Agent states: inside, walk, stay, chat, drive, away. Seats are claimed through a per-step scratch Set.
  People walk a graph of hand-drawn curved ways (`map.js`: road pavements, winding alleys, dead ends,
  the pond path, aisles; `routeNodes()` = memoised Dijkstra), plus a short straight leg from a way to a
  door or seat. `travel()` always backs out the way the agent came in. `trainAt(minute)` is a pure timetable.
  Kinds: keeper, walker, kid, vendor, vehicle (rides the curved road by arc length), animal, stray (the
  visitors from Đua Vịt, `duavit-cast.js`: roam every alley).
- `cast.js` (residents), `map.js` (curves, graph, scales K/SPRITE/SPEED), `places.js` (shops along the
  road, open places south of it, and ~110 tube houses grown along the alleys by `growHouses()`, fronts
  facing the viewer, kept off the road and lowered when their roof would hide a way).
- Drawing: `painters.js` registry (vendored duavit painters + `people90*.js`), `face.js` (cartoon faces,
  no text, so a mirrored character still reads), `body.js`. `buildings.js` draws the old side-on facades
  shrunk by K plus a roof seen from above; `scenery.js` the ground and everything else; `render.js`
  depth-sorts all standing things by their ground y, caches each building as a bitmap (zoom ≤ 2), tints
  the scene by the hour, then draws speech bubbles on top. Sound will be background music only (the
  user's call: with this many characters voices would be noise).
- Vietnamese look: `facade.js` (lime-wash walls with moss, green louvred shutters, chuồng cọp cages, wrought-iron
  balconies, washing poles, bird cages, the flag, blue house numbers, hand-painted signs, folding iron gates),
  `street-life.js` (parked Cubs, quán cóc with parasols and plastic stools, the ward banner, the xóm gate,
  bamboo hedge, egrets). Pavements are red brick; roofs are clay tile, corrugated iron or concrete with a brick tank.
- Crowd: `crowd.js` generates ~500 everyday neighbours and kids (simulated); `extras.js` is the background
  crowd (~400 people on the pavement stools, in the market, kids on the bare ground) that is a pure function
  of the clock, not simulated. `meet()` uses a grid so a thousand walkers stay cheap. `sprites.js` caches the
  ground, every building and every resident pose as bitmaps (zoom ≤ 2); speech bubbles are capped per frame.
- Music: `music.js` synthesises the lofi with Web Audio (no recordings) from `music-score.js` (pure, tested:
  chords, ngũ cung melody, mood by hour); a 🎵 button starts it (browsers need a click). If
  `public/music/lofi.mp3` exists it plays instead. Levels were measured with an analyser (rms ~0.09, peak ~0.5).
- Time: the page runs in real time on Vietnam time (UTC+7, `vnNow()` in main.js) whatever the visitor's zone;
  `?tua=60` fast-forwards (a minute per second). `createWorld({ rate })` takes game minutes per real second.
- `camera.js` (fit/cover, clamp, zoom at a point, pan, drift), `main.js` (loop, drag/pinch/wheel/keys).
- `public/js/duavit/`: unmodified copies from duavit (see `VENDORED.md`); do not edit here.

## Invariants
- `stepWorld` never mutates its input (`test/world.test.js` deep-freezes). Same seed → same day.
- CSP is strict (`script-src 'self'`, no inline styles/scripts): set styles via CSSOM or classes,
  never `style=""` or `innerHTML`. `deploy/xom.caddy` and `scripts/serve.js` must send the same CSP (tested).
- Painters face right and contain no text (they are mirrored when walking left).
- The game runs in the browser. The server serves files, counts open /api/live streams (no IPs kept, a
  per-IP cap only in memory) and answers the peti admin on /api/ops/* (OPS_TOKEN, timingSafeEqual, blocked at
  the public proxy). No accounts, no cookies, no access logs.

## Conventions (user's rules)
- Commit/push **only when asked**. Conventional commits. **Never** add `Co-Authored-By: Claude`,
  "Generated with Claude Code", or session links anywhere.
- Small files (< 800 lines), immutable updates, tests with `node:test`; run `npm test` before reporting done.
- UI changes: check in a real browser at desktop and phone widths.
- No gambling vocabulary anywhere user-facing (tested in `test/cast.test.js`). Do not depict real groups
  of people as animals or mock them; quirky ("dị") characters are welcome.

## Deploy
Node container (node:24-alpine, no npm install) on 127.0.0.1:3500 (uid 10013, writes only data/) behind
the server's shared edge Caddy; see `deploy/README.md`. Port 3400 is taken by the peti admin dashboard, 3200 by duavit, 3300 by the hub.
