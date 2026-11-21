const assert=require('node:assert/strict');const fs=require('node:fs');
const c=fs.readFileSync('public/game.js','utf8'),h=fs.readFileSync('public/index.html','utf8'),s=fs.readFileSync('server.js','utf8');
assert(!c.includes('loadFaceTracker'));assert(!c.includes('getUserMedia({audio:false'));assert(!h.includes('id="enableCamera"'));assert(!h.includes('id="lobbyEnableCamera"'));
assert(h.includes('id="takePhotoInput"'));assert(h.includes('id="uploadSelfie"'));assert(c.includes("canvas.addEventListener('pointermove',pointerMove)"));
assert(s.includes("'Choose a photo before pressing Ready.'"));assert(s.includes('p.cameraReady=true'));
console.log('Touch-only selfie tests passed.');
