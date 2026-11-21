# BALLFACE — Portrait Multiplayer Prototype

A mobile-first Node.js/WebSocket party game for **1v1 through 6v6**. Each phone shows its own team upright at the bottom and opponents upside down at the top. The ball rebounds off left/right walls; a point is conceded only if the entire ball crosses the goal line behind your team. Supports player-controlled teams and host-added bots.

## Run and deploy

Requires Node 20+. Run `npm start` locally (port 3000), or push this folder's **contents** to the root of your existing GitHub repository and deploy a Node **Web Service** on Render. Build command: `npm install`; start command: `npm start`; instance: Free. The live service must use HTTPS for mobile front camera permissions and WebSockets (`wss://`) for lobbies. Share the invite URL from within a lobby. Run just one server instance, since rooms are stored in memory.

## Lobby, cameras and game modes

1. Host creates a room and chooses a team size from 1v1 to 6v6.
2. Host selects **First to X points** (1–50) or **Timed** (2, 5, or 10 minutes).
3. Invite friends by link. Host can fill empty slots with bots, or remove bots before inviting more humans.
4. **Every human enables their front camera in the lobby**, waits for face tracking to recognize their face, and then presses Ready. Bots are camera-ready automatically.
5. The host's Start Match button becomes active only when all team slots are occupied and all players are camera-ready and Ready. The server re-checks these constraints before proceeding.
6. All players see a synchronized countdown, then the game begins. If a camera/tracker loses the face during the countdown, it is cancelled back to the lobby. After the match, the host can return everyone to the lobby.

A timed match ends on the clock; equal scores are shown as a draw. Points matches end when one team reaches the configured target. The countdown is server-timed; displays reflect each phone's clock and network latency.

## Face tracking and responsiveness

The selfie camera is the controller; front-camera video is mirrored in its own preview but the game avatar on your team stays visually upright. Head roll (tilt), yaw (turn/look left/right), pitch (look up/down), and physical x/y shifts all contribute to position. Motion is direct, with a tiny stillness dead zone rather than deliberate easing. Configure personal sensitivity, or let the host adjust global head-speed and ball-speed multipliers. The first tracker initialization fetches MediaPipe WASM and a model from the public Internet; tracking runs on device. Moving fast into the ball increases its outgoing speed.

A laptop touch/mouse fallback is available during live games for testing, but **does not bypass the required lobby camera readiness check**. Every human must have functional camera tracking for the match to start.

## Tests

Run `npm test` for server physics, bots, modes, camera gate, countdown and WebSocket integration smoke tests. These tests do not validate real-camera tracking quality or latency on actual phones. Test the live Render URL with two mobile devices before inviting a larger team.

## Files

- `server.js`: HTTP/WebSocket room service, match modes, bot logic and authoritative physics.
- `public/index.html`, `public/style.css`, `public/game.js`: lobby, portrait game, camera tracking and UI.
- `test.js`, `integration-test.js`: automated smoke/integration tests.

## Limitations

Face avatars are circular webcam crops, not fully rigged 3D characters. Lobbies are in-memory, so a server restart clears them. One frame of lost face detection can revoke lobby readiness; if tracking is unstable, improve lighting and keep your face visible. For real production use, add room persistence, reconnect handling, authentication, rate-limits and network prediction.


## Live voice and shared music

- Voice is **opt in** in lobby or game. Each player can mute/unmute. Browser permission is requested separately from camera. Audio is transmitted peer-to-peer using WebRTC (STUN only). No voice audio is intentionally relayed through the game server. Browser autoplay policies may require a tap to hear peers. For consistently reliable 6v6 voice, provision TURN or an SFU before production.
- The room host can share a supported HTTPS YouTube, Spotify or Apple Music URL. Each player uses the service's official embed and chooses whether to press Play. This is not synchronized playback or rebroadcast: browser autoplay limits, ads, login, licensing, and preview-only playback may apply. Music is not included in highlight captures.
- The existing highlight microphone permission is separate from live voice chat consent.

## Shared room music (prototype)

- The host can upload an MP3 or MP4 (maximum **12 MB** per file), or share a YouTube, Spotify, or Apple Music URL.
- Uploaded music is temporarily held **in server memory** and served to that room with HTTP byte-range support. It is not written to disk; restarting or sleeping the Render instance clears it. Room cleanup also clears music.
- Every player's phone receives the same track link and can tap **Play**, pause and change volume locally, in lobby or during the match. **Playback is not sample-synchronized between phones** and browsers require a user gesture to start music. MP4 audio playback depends on the browser's codecs.
- Use headphones with voice chat to prevent echo. Microphone mute and music volume are independent.
- Upload music only when you have permission to share it. The current host-selected upload is accessible to anyone with the active room's track URL; this is not protected licensed music distribution infrastructure.
- Uploaded file requests are limited to 12 MB; shared upload memory is capped at 96 MB across rooms, appropriate for small prototypes but not a production music platform.

## Live voice chat

Opt-in WebRTC voice, with participant mute/unmute and no automatic recording. For reliable connectivity across all networks and at 6v6 scale, configure a TURN server or use an SFU; the present direct peer-to-peer implementation is primarily for testing.

## Microphone permission troubleshooting

Use the **JOIN VOICE CHAT** button inside the HTTPS game page. It requests microphone access with `getUserMedia({ audio: true })` and displays a specific error if the browser cannot grant access. Camera permission does not grant microphone permission. If the prompt does not appear and the game says **Microphone blocked**, a previous denial may have been saved by the browser: change this site's microphone permission to **Allow** and reload. Open the full Render HTTPS URL directly in Chrome or Safari rather than inside another app's embedded browser. Joining voice is optional; players can remain muted or play with no mic. A secure microphone permission request cannot force the operating system to show a new prompt if access was already denied.
