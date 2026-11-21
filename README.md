# FACE PONG — mobile face-controlled multiplayer game

A runnable browser game with shareable private room links, 2v2 / 3v3 / 4v4 / 5v5 / 6v6 matches, phone selfie-camera head tracking, avatar snapshots, server-controlled ball physics and touch/mouse testing fallback.

## Start locally

Requires **Node.js 20+**. No npm install or third-party server packages are needed.

```bash
npm start
```

Open **http://localhost:3000**. Create a room, select 2v2 through 6v6, invite friends with **Copy Link**, assign teams, have everyone tap **Ready**, then start the match.

## Getting real phones into the same lobby

Deploy the entire folder to a **Node.js web host** (for example Render, Railway, Fly.io, or a VPS), setting the start command to `npm start` and enabling WebSocket connections. Share the resulting HTTPS website URL via the Copy Link button. Each player needs their own phone.

- Camera access requires **HTTPS** on public domains (or localhost for local testing).
- The first camera start downloads the MediaPipe face landmark library / model from public CDNs. This requires an internet connection.
- Each phone calculates head landmarks **locally**; only normalized position commands and occasional tiny JPEG face thumbnails are transmitted to room participants. Camera video is not streamed.
- For a local network demo, an HTTPS tunnel or HTTPS reverse proxy is needed to access cameras on phones.
- A hosted instance has rooms only in memory; redeploying/restarting clears rooms. Run **one instance** of the server for correct room synchronization.
- Up to six players per team; as size increases each face gets a narrower vertical band and smaller avatar.
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
