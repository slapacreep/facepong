# FACE PONG — Portrait Multiplayer Prototype

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
