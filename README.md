# BALLFACE — Finger-Controlled Selfie Edition

A portrait-first multiplayer pong party game. Take a selfie with the phone's native camera picker or upload a photo, then use your finger to move that **still photo** as your paddle.

## Deploy

Deploy this repository as a Render Node.js Web Service. Build command: `npm install` (or leave blank, there are no runtime dependencies). Start command: `npm start`. Root directory: the folder containing `package.json`. HTTPS recommended for microphone voice chat; gameplay itself needs no camera permissions.

## Playing

1. Create or join a lobby by invite URL.
2. Choose a photo using TAKE PHOTO or UPLOAD PICTURE. This is required before Ready; the phone's native camera picker may open for TAKE PHOTO, but no live camera stream or face tracking is used.
3. Pick a team and press Ready. Hosts can fill remaining slots with bots and set 1v1 through 6v6, points/timed rules and speeds.
4. After the countdown, **drag a finger anywhere on the portrait court**. Only horizontal or vertical movement is applied per update, not diagonals. Fast drags translate to stronger hits. Every player sees their own team at the bottom.
5. Left and right sidelines bounce the ball; a goal is scored only when the ball completely crosses the top or bottom line. Later rounds get faster.

## Privacy and image cutting

The browser makes a **transparent PNG face-shaped oval crop**. Everything outside the crop is transparent. This is not AI/background semantic segmentation: pixels immediately beside the face inside the oval can remain, so upload a tightly framed face photo (or a transparent-background PNG) for the cleanest look. The selected image is broadcast to room participants and held in server room memory; do not upload sensitive pictures. No face tracking, camera feed, or camera permission is used by gameplay.

Optional voice chat and optional microphone recording are separate and require their own explicit microphone permissions. Music uploads, lobby links, bots, theme switcher, highlights, and score controls are retained.

## Tests

Run `npm test`. Includes server, integration, music transfer, four-direction axis, and touch/photo source checks. Phone/browser usability still requires real-device testing.
