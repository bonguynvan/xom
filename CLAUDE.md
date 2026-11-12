# Xóm Peti: project notes for Claude

A 1990s Vietnamese xóm built in 3D with three.js (the old 2D canvas version was removed on 2026-11-11):
railway, rows of tube houses, the main street with shops, market, đình, pond, well, bus stop. Shopkeepers,
walkers, kids, vendors, vehicles and animals each follow their own day and chat at random. No goals, no
scores: a title screen to pick, dress and name a character, then walk the streets with WASD (or just watch).
Part of the Peti family (`peti.vn` link hub, `duavit.peti.vn`): Baloo 2 + Be Vietnam Pro, cream/tomato/sun palette.
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
  road, open places south of it, and ~110 tube houses grown along the alleys by `growHouses()`, kept off the road).
- Public buildings: the primary school, trạm y tế and UBND phường; `places.js` reserves their ground
  (`CIVIC_PLACES`) before the houses grow, so they stand where a few houses would have been.
- Data-only street details: `street-life.js` (parked Cubs, pavement stool clusters, quán cóc, banner/gate x, bamboo
  hedge), `decor.js` (market trays), `greenery.js` (`groundIsFree`). The 3D modules build the meshes from them.
- Crowd: `crowd.js` generates ~790 everyday neighbours and kids (simulated; half the kids are pupils, painter
  `hocSinh`); `extras.js` is the background crowd (~700: pavement stools, market, kids on the bare ground, pond,
  pupils at the school gate at the bell, clinic patients, dawn exercises and the afternoon crowd in the đình yard)
  that is a pure function of the clock, not simulated. `meet()` uses a grid so a thousand walkers stay cheap.
  The cast `painter` field is now a look key: `people3d.js` uses it for female model, hat, carrying pole.
- Cost (measured): a simulation step is ~0.4 ms for ~1,280 agents.
- Talk: `lines.js` pools (any time, by part of day, by place, by weather, catchphrases, more greetings and
  quarrels, traffic quarrels, honks). `pickLine` draws from weighted pools and each agent remembers its last 6
  lines (`recent`) so it does not repeat; greetings and quarrels avoid recent lines too (`freshPair`).
- Day and night: bedtimes spread from 19:00 (a few owls past midnight; `awake()` handles sleepAt > 24); people
  go home for a while (`until`) at lunch, in the rain, now and then; night vendors (`hours` in the cast) 19:30-1:30.
- Traffic: ~200 riders (cast TRAFFIC) out by `trafficAt(hour)` (rush 7:30 and 17:30); sub-lanes; car-following on
  the previous step's positions (`gapsAhead`), so queues form; hasty riders get close and sometimes `bump`
  (both stop and quarrel, a star is drawn). Visual only.
- Weather: `scripts/weather.js` fetches Hà Nội from Open-Meteo every 15 min (server side; WEATHER=off disables);
  the admin can force a kind (settings.weather). Pages get it on /api/live and call `setWeather`: rain sends people
  home and thins the crowd, heat fills the pond with swimmers, rain drawn by `sky3d.js`, music adds rain.
- Loa phường: the admin announcement from /api/live is read out by the loudspeaker on its pole as a bubble for
  9 s every 45 s (`main3d.js`).
- Music: `music.js` synthesises the lofi with Web Audio (no recordings) from `music-score.js` (pure, tested:
  chords, ngũ cung melody, mood by hour); a 🎵 button starts it (browsers need a click). If
  `public/music/lofi.mp3` exists it plays instead. Levels were measured with an analyser (rms ~0.09, peak ~0.5).
- Time: the page runs in real time on Vietnam time (UTC+7) whatever the visitor's zone;
  `?tua=60` fast-forwards (a minute per second). `createWorld({ rate })` takes game minutes per real second.

## Renderer (`/` = `public/index.html`, `public/js/3d/`; old `/3d.html` links get a 301 to `/`)
- `main3d.js` steps `world.js` and draws with three.js r170
  (vendored in `public/js/vendor/three/`, addons rewritten to import `./three.module.min.js`; no importmap, CSP).
- `coords.js` is pure (node:test): map units -> metres (`M` = 0.15, map y -> +Z south), building footprints,
  collision (`boxGrid`, `collide`), `sunAt`, `darkAt` (tested).
- Few draw calls: every wall/roof of one colour or material is one merged `Builder` geometry (`geom.js`); trees,
  stools, vehicles, riders, animals and far people are InstancedMesh. Textures are painted on canvas (`textures.js`).
- People: the nearest (see the budget above) are skinned glTF slots (`people3d.js`, soldier + michelle; michelle borrows the soldier's
  clips, rotations only, no Hips track), everyone else an instanced figure. `extrasAt` entries carry `n` so a
  slot can follow one extra. Bubbles are HTML positioned via CSSOM.
- glb files must have no embedded images (GLTFLoader would make blob: URLs, refused by the CSP): run
  `scripts/unpack-glb.js` on any new model (tested).
- Title and character (`title.js`, `avatar.js`, `select-state.js`, `session.js`, `flyin.js`, `gamepad.js`): the page opens on
  a title screen (a second, transparent WebGL canvas `#studio` over the blurred xóm): look (GUEST_LOOKS), shirt colour,
  headwear, one thing carried, name. `select-state.js` is the pure reducer (tested) and the stored shape
  (`localStorage['xom.guest']` = `{ name, look, shirt, hat, extra }`, only `session.js` touches storage, tested).
  "Vào xóm" POSTs /api/join (the server's name/look win; no stream = walk alone), then `controls.fly()` brings the
  camera down from the sky to behind the shoulder on the way in front of "your" house (`doorFor(name)`, stable per name).
  Shirt/hat/extra are local only: the server and other visitors know just name and look. Your own simulated guest
  agent is hidden (`people.update(…, me)`); you are the avatar. The wave is procedural (no clip): two bones turned
  after the mixer. The soldier glb faces -Z: `loadRigs` turns it round.
- Controller and camera (`player.js`, `input.js`; the maths is pure and tested in `test/controller.test.js`):
  `locomotion.js` (`stepMotion`: acceleration, turn-rate limit; `blendSpace`: idle/walk/run weights and one shared stride
  phase so feet do not slide, from the clips' measured speeds in `CLIP`; `nextAnim`/`poseFor`: idle, fidget, walk, jog, run,
  start, stop, turn, sit, stand — only idle/walk/run are clips, the rest is added to the bones in `avatar.js`),
  `capsule.js` (`slide`: circle vs building boxes and the pond, sub-stepped, wall sliding, round corners),
  `camera-rig.js` (`place`: spring arm with shoulder offset and a swept sphere against the boxes, which carry `h`;
  `damp`: critically damped; `recentre`, `fovAt`, `bobAt`), `interact.js` (`seatsOf`/`nearestSeat`: every plastic stool,
  `nearestPerson`, `headTurn`). Body radius 0.3 > lens radius 0.28, so the camera always fits where you do. No raycasts
  against meshes. `input.js` gathers keys, drag, pointer lock (click the scene while walking), two touch sticks, gamepad.
  E greets: `people.react(key)` holds that neighbour in place (shown only; the simulation goes on), turns them and waves
  (`gesture.js`). C sits on the nearest free stool. `localStorage['xom.feel']` = '0' turns off the sprint FOV and the bob.
- URL: `?che=di` straight into the street, `?che=ngam` straight to the overview (no title), `?live=1` livestream source
  (no buttons, no title, big clock, `xom.peti.vn` tag, music starts by itself), `?gio=`, `?troi=`, `?tua=`, `?chatluong=thap`.
- Triangle budget: skinned characters are 11 k (soldier) and 28 k (michelle) triangles each, so only people within 24 m
  of the focus (max 30, none in the overview) are skinned, and only the nearest 10 cast shadows (`people3d.js`).
- Picture (`quality.js`, pure: tiers thap/vua/cao/toida, `pickTier`, `adapt`/`shed`; `?chatluong=` forces one,
  `localStorage['xom.quality']` keeps the visitor's choice): `post.js` (EffectComposer: scene into a half-float target
  with a depth texture → GTAO reading that depth → bloom → the film pass → SMAA/FXAA; the lowest tier has no composer),
  `grade.js` (pure: `lookAt` the grade by hour and weather, `gradeColor` mirrors the shader), `shadows.js` (CSM on the
  higher tiers; every lit material must be `adopt`ed or it is lit once per cascade), `shade.js` (`hook`: several
  onBeforeCompile additions on one material, with a cache key), `surface.js` (`weathered(material, kind)`: wet response,
  puddles, damp band on walls), `relief.js` (pure: normal and roughness maps from a painted canvas; `embossed()` in
  `textures.js`), `decal-plan.js` (pure) + `decals3d.js` (one atlas, one mesh). Houses cast their shadow through one
  merged invisible mesh (`house-shadows`), never through the visible meshes.
- Near the player (`detail-plan.js` pure + `detail3d.js`): shops have a real opening and room (`shopOpening`, built in
  `buildings3d.js`; each box carries `kind`, `floors`, `px`, `shop`, `roof`); interiors, balcony things and fans are built
  per 24 m chunk when you come within the tier's `detail` radius, one chunk a frame, hidden beyond it.
- Sound (`sound-plan.js` pure + `sound3d.js`): all synthesised Web Audio, positional engines/horns/vendors/loa, beds by
  hour and weather, footsteps by `surfaceKind`; its own 🔈 button; `?tieng=1` starts it (headless: shot.js allows autoplay).
- Crowd (`crowd-plan.js` pure): skinned near (seated on stools, riding poses for riders handed over by `vehicles3d.js`,
  talk gestures), impostors in the middle distance (`impostor.js`: a sheet baked from the rigs at start-up, one instanced
  draw), boxes far away; `sidestep` keeps neighbours out of your space (shown only).
- Multiplayer presence (`net-move.js` pure, shared with the server): POST /api/move `{ sid, x, y, h, a }` (map units),
  validated in `scripts/live.js` (joined, bounds, speed cap, per-page interval, per-IP rate in memory), relayed as the SSE
  event `moves`; pages interpolate 100 ms behind. A remote visitor is drawn where they say they are instead of where their
  simulated stand-in wanders (`people3d.js` `remoteOf`); `world.js` knows nothing of it.
- Tests and screenshots: the server sends Hà Nội's real weather; add `&troi=clear` (or another kind) for a fixed sky.
- `?dung=N` stops after N frames and sets `body[data-ready]` (headless screenshots with swiftshader).
- `?perf=1` (`perf.js`, pure maths tested): fps, CPU ms, draw calls, triangles, textures, geometries, heap; with
  `?dung=N` the numbers land in `body[data-perf]`. `node scripts/shot.js [--gpu] --size WxH "/?gio=9" …` takes the
  screenshots and prints those numbers (Chrome over DevTools, no deps). Plan and baseline: `docs/ke-hoach-aaa.md`.

## Invariants
- `stepWorld` never mutates its input (`test/world.test.js` deep-freezes). Same seed → same day.
- CSP is strict (`script-src 'self'`, no inline styles/scripts): set styles via CSSOM or classes,
  never `style=""` or `innerHTML`. `deploy/xom.caddy` and `scripts/serve.js` must send the same CSP (tested).
- The game runs in the browser. The server serves files, counts open /api/live streams (no IPs kept, a
  per-IP cap only in memory), relays where walking visitors are (/api/move, validated, rate-limited in memory) and answers the peti admin on /api/ops/* (OPS_TOKEN, timingSafeEqual, blocked at
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
