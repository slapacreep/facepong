## Portrait gameplay (new)

Hold each phone vertically. Your team appears upright at the **bottom**, and opponents appear **upside down at the top**, on every device (team 1 receives a 180° rotated local view). The canonical server court is 650 × 1000: team 0 defends the bottom; team 1 defends the top. Players are divided into horizontal lanes as team size rises from 1v1 to 6v6. Left/right are rebound sidewalls; a goal is scored only once the full ball passes the top or bottom edge. Camera-based movement is transformed per device to match the local viewpoint. The front-camera tracker must still load successfully for hands-free play; mouse/touch remains a fallback for testing.

# FACE PONG — mobile face-controlled multiplayer game

A runnable browser game with shareable private room links, 1v1 / 2v2 / 3v3 / 4v4 / 5v5 / 6v6 matches, phone selfie-camera head tracking, avatar snapshots, server-controlled ball physics and touch/mouse testing fallback.

## Start locally

Requires **Node.js 20+**. No npm install or third-party server packages are needed.

```bash
npm start
```

Open **http://localhost:3000**. Create a room, select 1v1 through 6v6, invite friends with **Copy Link**, assign teams, have everyone tap **Ready**, then start the match.

## Getting real phones into the same lobby

Deploy the entire folder to a **Node.js web host** (for example Render, Railway, Fly.io, or a VPS), setting the start command to `npm start` and enabling WebSocket connections. Share the resulting HTTPS website URL via the Copy Link button. Each player needs their own phone.

- Camera access requires **HTTPS** on public domains (or localhost for local testing).
- The first camera start downloads the MediaPipe face landmark library / model from public CDNs. This requires an internet connection.
- Each phone calculates head landmarks **locally**; only normalized position commands and occasional tiny JPEG face thumbnails are transmitted to room participants. Camera video is not streamed.
- For a local network demo, an HTTPS tunnel or HTTPS reverse proxy is needed to access cameras on phones.
- A hosted instance has rooms only in memory; redeploying/restarting clears rooms. Run **one instance** of the server for correct room synchronization.
- One to six players per team; as size increases each face gets a narrower vertical band and smaller avatar.
- Head-tilt control is enabled by default; users can switch to **head position** control or fallback to touch controls.

## Project files

`server.js` — native Node HTTP + WebSocket game server, room join, teams, scoring, authoritative ball physics.

`public/index.html`, `public/style.css`, `public/game.js` — responsive game, lobby, camera and face tracking, ball visuals.

`test.js` — lightweight automated server and physics tests.

## Current beta limitations

- Real-time face snapshots are simple circular crops, not fully animated 3D cartoon avatars.
- Single-camera roll and pitch are approximate. Calibration plus a sensitivity slider help; moving between camera positions or lighting setups may require recalibration.
- Phone browser performance and internet connections affect responsiveness.
- Multiplayer needs a public deployment; sharing a localhost link won't work between distant devices.
- Face tracking requires a supported browser with `getUserMedia` and WebGL/WASM support. Manual touch/mouse fallback is available.
- Rooms are ephemeral; disconnecting a player during a match resets it to the lobby.
- For a production release, add room persistence, authentication/moderation, connection rate limits, and a more polished ball-prediction/netcode layer.

## Game controls

- Tilt your head left/right to move horizontally.
- Tilt/raise/lower your face to move vertically (approximate pitch tracking).
- Move quickly toward the ball: the server uses how quickly your avatar moves into the ball to boost rebound power.
- Switching control mode uses your physical head position instead of head tilt.
- Pointer/touch controls work automatically when face tracking isn't available.
- First team to 7 wins.

## Scoring and walls

- The top and bottom edges are solid walls: the ball rebounds and play continues, with no score.
- The left and right outer edges are goal lines: only when the **whole ball** passes beyond one does the defending team concede a point.
- Going past the blue/left side scores one point for pink/right; going past pink/right scores one for blue/left.
- A face collision sends the ball back into play; first team to 7 wins. These rules apply in 1v1 through 6v6.

## Unified update: 1v1–6v6, goal-line scoring, and match-speed controls

This package combines the earlier 1v1 support and wall-bounce scoring improvements into **one deployment**.

- **Smaller default visuals:** ball radius 8 arena units (previously 12); avatar radius scales from 43 units in 1v1 to 14 units in 5v5/6v6, helping maintain visibility without crowded giant faces.
- **Host-controlled ball speed:** adjustable between **0.5× and 1.8×** in the lobby or while playing. Changes affect the live ball immediately and future serves/hits.
- **Host-controlled head movement speed:** adjustable between **0.5× and 1.8×**. This changes how much physical head movement moves the avatar and the server-side movement cap for all players.
- **Personal sensitivity:** each player still has their own sensitivity slider for their camera and comfort. Players' phone cameras control avatars directly rather than slowly animating toward each measured position; tracking/network frame rates still impose latency.
- **Scoring:** top and bottom rebound; goals only count after the *whole* ball passes the left or right end line.

These controls work with touch/mouse fallback too. The host must start the match after choosing team size; all team slots need to be occupied and ready.

### Update an existing GitHub/Render deployment

Copy the **contents of the `facepong` folder** to the top level of your existing GitHub repo (alongside `package.json`), replacing `server.js`, `test.js`, and the files in `public/`. Commit to the branch Render uses (`main` by default). Render should redeploy on that commit. Build: `npm install`; Start: `npm start`.

## Camera tracker repair (November 2026)

- Face tracking now uses MediaPipe's documented `vision_bundle.mjs` entry point with a second CDN fallback, and tries both GPU and CPU delegates.
- After granting camera access, allow the tracking model to load; this requires internet access on each player's device. If it fails, tap **RETRY TRACKER**. The browser developer console logs the actual failure.
- Webcam permission alone does not mean the face-tracker model is ready. The status must say **FACE TRACKING ACTIVE** after it locates your face.
- Head movement uses each decoded camera frame (up to 60 fps), a tiny stillness dead zone, direct updates with no easing, and no automatic re-centering. **RECALIBRATE** establishes a fresh neutral position.
- Default mode combines head tilt and head translation; switch modes if the front camera's angle makes tilt awkward. Each player can adjust local sensitivity; host speed multiplier applies to the match.
- Phone browsers must access the game over **HTTPS** for camera support.
- The motion calibration and feel still need testing on actual phones and connections; remote network/model downloads are not testable from this development container.
