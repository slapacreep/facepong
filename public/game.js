
const $=id=>document.getElementById(id);
const W=650,H=1000,colors=['#6ae6f5','#ff6fae'];
const state={
 ws:null,id:null,room:null,players:[],size:2,ballSpeed:1,headSpeed:1,phase:'entry',score:[0,0],ball:{x:325,y:500},host:false,ready:false,
 faceImages:new Map(),selfieData:'',selfieSource:'',track:'tilt',controlX:.5,controlY:.5,sentX:.5,sentY:.5,neutral:null,landmarker:null,cameraStream:null,cameraOn:false,lastTrack:0,lastMove:0,lastFace:0,
 tracking:false,sound:true,lastHit:null,lastHitEvent:null,lastRound:0,lastVideoTime:-1,stillX:.5,stillY:.5,trackingError:'',cameraReady:false,lastCameraReport:null,
 mode:'points',targetPoints:7,durationMinutes:2,countdownAt:0,matchEndsAt:0,roundSpeed:1,effects:[],recordHighlights:false,recordMic:false,micStream:null,
 mediaRecorder:null,audioChunks:[],audioBlobUrl:'',replayShots:[],recordingActive:false,theme:localStorage.getItem('facepong-style')==='pink'?'pink':'blue',touchActive:false,axisLock:'none',voiceEnabled:false,voiceMuted:true,voiceStream:null,voicePeers:new Map(),music:null,musicVisible:true
};
const canvas=$('arena'),ctx=canvas.getContext('2d');
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),3300);}
function wsSend(payload){if(state.ws?.readyState===WebSocket.OPEN)state.ws.send(JSON.stringify(payload));}
function screen(name){['entry','lobby','game'].forEach(id=>$(id).classList.toggle('hidden',id!==name));$('roomTag').classList.toggle('hidden',name==='entry');}
function roomFromURL(){return new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z2-9]/g,'')||'';}
function randomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>chars[x%chars.length]).join('');}
function me(){return state.players.find(p=>p.id===state.id)||null;}
function localTeam(){return me()?.team ?? 0;}
function avatarBg(){return state.theme==='pink'?'#ffffff':'#000000';}
function avatarEmoji(team){return team===1?'✿':'❄︎';}
function setTheme(style){
 const selected=style||state.theme||'blue';state.theme=selected==='pink'?'pink':'blue';
 document.body.classList.toggle('theme-pink',state.theme==='pink');
 document.body.classList.toggle('theme-blue',state.theme==='blue');
 $('styleBoy').classList.toggle('active',state.theme==='blue');
 $('styleGirl').classList.toggle('active',state.theme==='pink');
 $('styleBoy').setAttribute('aria-pressed',String(state.theme==='blue'));
 $('styleGirl').setAttribute('aria-pressed',String(state.theme==='pink'));
 document.querySelector('meta[name="theme-color"]').content=state.theme==='pink'?'#fff0f6':'#080a12';
}
function connect(room){const name=$('playerName').value.trim()||localStorage.getItem('facepong-name')||'Player';localStorage.setItem('facepong-name',name);if(state.ws)state.ws.close();const protocol=location.protocol==='https:'?'wss:':'ws:';state.ws=new WebSocket(`${protocol}//${location.host}/ws`);state.ws.onopen=()=>wsSend({type:'join',room,name});state.ws.onmessage=e=>{let msg;try{msg=JSON.parse(e.data);}catch{return;}onMessage(msg);};state.ws.onclose=()=>{for(const id of [...state.voicePeers.keys()])closeVoicePeer(id);toast('Connection lost. Refresh to reconnect.');$('trackingStatus').textContent='DISCONNECTED';};state.ws.onerror=()=>toast('Could not connect to game server');}
function onMessage(msg){
 if(msg.type==='error'){toast(msg.message);return;}
 if(msg.type==='welcome'){state.id=msg.id;state.room=msg.room;history.replaceState(null,'',`/?room=${msg.room}`);screen('lobby');$('roomCode').textContent=msg.room;$('inviteUrl').textContent=location.href;if(state.cameraReady){state.lastCameraReport=null;reportCamera(true);}if(state.selfieData)sendFaceImage();return;}
 if(msg.type==='signal'){handleSignal(msg).catch(err=>console.warn('Voice signal:',err));return;}if(msg.type==='face'){const img=new Image();img.onload=()=>{state.faceImages.set(msg.id,img);if(state.phase==='lobby')renderLobby();};img.src=msg.image;return;}
 if(msg.type!=='state')return;
 const oldPhase=state.phase, oldHit=state.lastHit, oldRound=state.lastRound;
 state.players=msg.players;state.size=msg.size;state.ballSpeed=msg.ballSpeed??1;state.headSpeed=msg.headSpeed??1;state.phase=msg.phase;state.mode=msg.mode||'points';state.targetPoints=msg.targetPoints||7;state.durationMinutes=msg.durationMinutes||2;state.countdownAt=msg.countdownAt||0;state.matchEndsAt=msg.matchEndsAt||0;state.score=msg.score;state.ball=msg.ball;state.lastHit=msg.lastHit;state.lastRound=msg.round;state.roundSpeed=msg.roundSpeed??1;state.host=msg.players[0]?.id===state.id;state.ready=!!me()?.ready;state.music=msg.music||null;
 setTheme();renderSpeedControls();syncVoicePeers();if(state.voiceEnabled||!(/Microphone blocked|Microphone unavailable|Microphone could not|No microphone found|Browser blocked/.test($('voiceStatus').textContent)))renderVoiceUI();renderMusicUI();
 if(oldHit!==state.lastHit&&state.lastHit){registerHit(state.lastHit);}
 if(oldPhase!==state.phase){
  if(state.phase==='playing'){startMatchRecording();toast('THE MATCH IS ON!');}
  if(oldPhase==='playing'&&state.phase!=='playing'){stopMatchRecording();}
 }
 if(state.phase==='lobby'){screen('lobby');renderLobby();}
 else {screen('game');renderGameUI(); if(state.phase==='finished') finishGame();}
 if(oldRound!==state.lastRound&&oldRound>0&&state.phase==='playing')beep(260,.06);
}
function renderSpeedControls(){
 for(const [key,id,valueId] of [['ballSpeed','ballSpeed','ballSpeedValue'],['headSpeed','headSpeed','headSpeedValue'],['ballSpeed','gameBallSpeed','gameBallSpeedValue'],['headSpeed','gameHeadSpeed','gameHeadSpeedValue']]){
  const slider=$(id);if(!slider)continue; if(document.activeElement!==slider) slider.value=String(state[key]); $(valueId).textContent=`${state[key].toFixed(1)}×`; slider.disabled=!state.host;
 }
}
function renderLobby(){
 const r=state;$('lobbyCount').textContent=`${r.players.length} / ${r.size*2}`;$('blueCount').textContent=`${r.players.filter(p=>p.team===0).length} / ${r.size}`;$('pinkCount').textContent=`${r.players.filter(p=>p.team===1).length} / ${r.size}`;
 for(let team=0;team<2;team++){
  const list=$(team?'pinkList':'blueList');list.replaceChildren();const players=r.players.filter(p=>p.team===team);
  for(let i=0;i<r.size;i++){
   const el=document.createElement('div');el.className='playerentry'+(players[i]?'':' empty');
   if(players[i]){
    const p=players[i];
    const avatar=document.createElement('div');avatar.className='avatar';
    const imgSrc=p.id===state.id?state.selfieData:imageToDataUrl(state.faceImages.get(p.id));
    if(imgSrc){const img=document.createElement('img');img.src=imgSrc;img.alt=`${p.name} face`;avatar.append(img);} else {const ph=document.createElement('div');ph.className='placeholder';ph.textContent=avatarEmoji(team);avatar.append(ph);}
    const meta=document.createElement('div');meta.className='meta';
    const name=document.createElement('div');name.className='name';name.textContent=p.name+(p.id===state.id?' (YOU)':'')+(r.players[0]?.id===p.id?' ★':'');
    const sub=document.createElement('div');sub.className='sub';sub.textContent=p.bot?'BOT PLAYER':p.cameraReady?'TRACKING READY':'ENABLE TRACKING';
    meta.append(name,sub);
    const stat=document.createElement('span');stat.className='status '+(p.ready?'yes':'');stat.textContent=p.bot?'🤖 BOT':!p.cameraReady?'📷 ENABLE CAMERA':p.ready?'READY':'WAITING';
    el.append(avatar,meta,stat);
   } else el.textContent=`+ Open slot ${i+1}`;
   list.append(el);
  }
 }
 document.querySelectorAll('[data-size]').forEach(btn=>{btn.classList.toggle('selected',Number(btn.dataset.size)===r.size);btn.disabled=!r.host;});
 $('readyBtn').textContent=r.ready?'✓ READY':r.cameraReady?'I’M READY':'ENABLE CAMERA FIRST'; $('readyBtn').disabled=!r.cameraReady&&!r.ready; $('readyBtn').style.borderColor=r.ready?'#72e7a6':'';
 $('startBtn').classList.toggle('hidden',!r.host); $('startBtn').disabled=r.players.length!==r.size*2||!r.players.every(p=>p.ready&&(p.bot||p.cameraReady));
 $('fillBots').disabled=!r.host; $('clearBots').disabled=!r.host;
 const mode=$('matchMode'); if(document.activeElement!==mode) mode.value=r.mode; const target=$('targetPoints'); if(document.activeElement!==target) target.value=r.targetPoints; const duration=$('durationMinutes'); if(document.activeElement!==duration) duration.value=r.durationMinutes;
 $('pointsRule').classList.toggle('hidden',r.mode!=='points'); $('timedRule').classList.toggle('hidden',r.mode!=='timed'); for(const el of [mode,target,duration]) el.disabled=!r.host;
 $('lobbyCameraStatus').textContent=r.cameraReady?'◉ FACE TRACKING READY':state.cameraOn?'TRACKER STARTING…':'CAMERA NOT ENABLED';
 $('recordHighlights').checked=state.recordHighlights; $('recordMic').checked=state.recordMic; $('recordMic').disabled=!state.recordHighlights;
}
function renderGameUI(){ $('blueScore').textContent=state.score[0]; $('pinkScore').textContent=state.score[1]; $('matchLabel').textContent=`ROUND ${Math.max(1,state.lastRound||1)} · ${state.roundSpeed.toFixed(1)}×`; $('phaseMessage').textContent=state.phase==='finished'?'MATCH OVER':state.mode==='timed'?`${Math.max(0,Math.ceil((state.matchEndsAt-Date.now())/1000))}s REMAINING`:`FIRST TO ${state.targetPoints} WINS`; $('countdownOverlay').classList.toggle('hidden',state.phase!=='countdown'); if(state.phase==='countdown')$('countdownNumber').textContent=String(Math.max(1,Math.ceil((state.countdownAt-Date.now())/1000))); $('gameOverlay').classList.toggle('hidden',state.phase!=='finished'); }
function finishGame(){const winner=state.score[0]===state.score[1]?-1:state.score[0]>state.score[1]?0:1;$('overlayTitle').textContent=winner<0?'DRAW!':winner===0?'BLUE WINS!':'PINK WINS!';$('overlayTitle').style.color=winner<0?'#fff':colors[winner];$('overlaySubtitle').textContent=state.recordHighlights?`Replays ready · ${state.replayShots.length} highlight${state.replayShots.length===1?'':'s'} captured`:'MATCH COMPLETE';$('rematchBtn').classList.toggle('hidden',!state.host);renderReplayPanel();}
function radius(){return state.size===1?Math.min(65,43*1.2*1.2):Math.max(14,Math.min(43,65/state.size));}
function zone(p){const lane=W/state.size,margin=Math.min(24,Math.max(9,lane*.13)); return {x0:p.slot*lane+margin,x1:(p.slot+1)*lane-margin,y0:p.team===0?H*.58:50,y1:p.team===0?H-50:H*.42};}
function flipped(){return localTeam()===1;}
function toCourt(x,y){return flipped()?{x:W-x,y:H-y}:{x,y};}
function localMove(x,y){return flipped()?{x:1-x,y:1-y}:{x,y};}
function backgroundGradient(){const g=ctx.createLinearGradient(0,0,0,H);if(state.theme==='pink'){g.addColorStop(0,'#301223');g.addColorStop(.34,'#150912');g.addColorStop(1,'#07090d');}else{g.addColorStop(0,'#06142a');g.addColorStop(.34,'#07111d');g.addColorStop(1,'#05070c');}return g;}
function drawArenaFX(time){
 ctx.fillStyle=backgroundGradient();ctx.fillRect(0,0,W,H);
 // themed texture
 ctx.save();ctx.globalAlpha=.16;
 if(state.theme==='pink'){
  for(let i=0;i<8;i++){const x=(i*91+(time*0.012)%90)-20;ctx.fillStyle='rgba(255,180,210,.08)';ctx.beginPath();ctx.ellipse(x,120+i*95,18,9,Math.sin(i+time*.0007),0,Math.PI*2);ctx.fill();}
 } else {
  ctx.strokeStyle='rgba(180,235,255,.09)';ctx.lineWidth=2;for(let y=90;y<H;y+=120){ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(W-30,y);ctx.stroke();}
 }
 ctx.restore();
 // laser border
 ctx.save();ctx.lineWidth=3;ctx.strokeStyle=state.theme==='pink'?'rgba(255,111,174,.88)':'rgba(106,230,245,.88)';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=12;ctx.setLineDash([22,16]);ctx.lineDashOffset=-(time*0.03)%38;ctx.strokeRect(8,8,W-16,H-16);ctx.restore();
 ctx.save();ctx.setLineDash([10,12]);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.restore();
 ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=2;ctx.strokeRect(1,1,W-2,H-2);
 // goals and side walls
 ctx.fillStyle='rgba(255,111,174,.24)';ctx.fillRect(0,0,W,7);ctx.fillStyle='rgba(106,230,245,.24)';ctx.fillRect(0,H-7,W,7);
}
function drawPlayer(p,pr,reverse){
 const z=zone(p),own=p.id===state.id; ctx.fillStyle=p.team===0?'#6ae6f50b':'#ff6fae0b';ctx.fillRect(z.x0,z.y0,z.x1-z.x0,z.y1-z.y0);
 if(own){ctx.strokeStyle=colors[p.team]+'66';ctx.setLineDash([4,8]);ctx.lineWidth=1;ctx.strokeRect(z.x0,z.y0,z.x1-z.x0,z.y1-z.y0);ctx.setLineDash([]);} const x=p.x??(z.x0+z.x1)/2,y=p.y??(z.y0+z.y1)/2;
 ctx.save();ctx.translate(x,y); const viewTeam=reverse?1:0; if(reverse ? p.team===viewTeam : p.team!==viewTeam)ctx.rotate(Math.PI);
 ctx.shadowColor=colors[p.team];ctx.shadowBlur=own?21:9; ctx.beginPath();ctx.arc(0,0,pr,0,Math.PI*2); ctx.fillStyle=state.theme==='pink'?'#ffffff':'#000000';ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=own?4.5:3;ctx.stroke();ctx.shadowBlur=0;ctx.clip();
 const face=state.faceImages.get(p.id);
 if(face){ctx.drawImage(face,-pr,-pr,pr*2,pr*2);} else {
  ctx.fillStyle='#d6b3aa';ctx.beginPath();ctx.ellipse(0,0,pr*.72,pr*.83,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#171923';ctx.beginPath();ctx.arc(-pr*.22,-pr*.1,pr*.08,0,Math.PI*2);ctx.arc(pr*.22,-pr*.1,pr*.08,0,Math.PI*2);ctx.fill();ctx.lineWidth=Math.max(2,pr*.06);ctx.strokeStyle='#171923';ctx.beginPath();ctx.arc(0,pr*.08,pr*.25,0,Math.PI);ctx.stroke();
 }
 ctx.restore();
 ctx.fillStyle=own?'#fff':'rgba(255,255,255,.84)';ctx.font='600 14px Space Grotesk, sans-serif';ctx.textAlign='center';ctx.fillText(p.name,x,y+pr+18);
}
function drawBall(){ ctx.save();ctx.translate(state.ball.x,state.ball.y);ctx.shadowColor='#ffee88';ctx.shadowBlur=18;const r=13;ctx.fillStyle='#fff5a2';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore(); }
function updateEffects(dt){ state.effects=state.effects.filter(e=>{e.life-=dt; e.x+=e.vx*dt; e.y+=e.vy*dt; e.vx*=0.98; e.vy*=0.98; return e.life>0;}); }
function drawEffects(){ for(const e of state.effects){const a=Math.max(0,e.life/e.max);ctx.save();ctx.globalAlpha=a;ctx.translate(e.x,e.y);ctx.rotate(e.rot||0); if(e.kind==='petal'){ctx.fillStyle='rgba(255,190,215,.9)';ctx.beginPath();ctx.ellipse(0,0,e.size*.9,e.size*.45,e.rot||0,0,Math.PI*2);ctx.fill();} else {ctx.strokeStyle='rgba(180,235,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-e.size,0);ctx.lineTo(e.size,0);ctx.lineTo(0,e.size*.8);ctx.stroke();} ctx.restore(); } }
function spawnImpact(team,x,y){ for(let i=0;i<9;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*180;state.effects.push({kind:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.22+Math.random()*.16,max:.35,size:3+Math.random()*4,rot:a});}
 if(team===1){for(let i=0;i<12;i++){const a=-Math.PI/2+(Math.random()-.5)*1.8,s=40+Math.random()*120;state.effects.push({kind:'petal',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.5+Math.random()*.4,max:.9,size:4+Math.random()*4,rot:Math.random()*Math.PI});}}
}
function registerHit(playerId){ const p=state.players.find(q=>q.id===playerId); if(!p) return; const x=p.x??W/2,y=p.y??H/2; spawnImpact(p.team,x,y); captureReplayShot(playerId); if(state.sound) beep(p.team===1?620:480,.05); }
function captureReplayShot(playerId){ if(!state.recordHighlights || state.replayShots.length>=10) return; const src = playerId===state.id ? state.selfieData : imageToDataUrl(state.faceImages.get(playerId)); if(!src) return; const p=state.players.find(q=>q.id===playerId); state.replayShots.push({src,name:p?.name||'Player',team:p?.team??0,at:Date.now()}); }
function imageToDataUrl(img){ if(!img) return ''; const c=document.createElement('canvas'); c.width=96;c.height=96; const x=c.getContext('2d'); x.fillStyle=avatarBg(); x.fillRect(0,0,96,96); x.drawImage(img,0,0,96,96); return c.toDataURL('image/png'); }
function captureLiveFaceDataURL(size=144){ const v=$('camera'); if(!v.videoWidth) return ''; const c=document.createElement('canvas'), x=c.getContext('2d'); const dim=Math.min(v.videoWidth,v.videoHeight); c.width=size;c.height=size; x.fillStyle=avatarBg(); x.fillRect(0,0,size,size); x.save(); x.beginPath(); x.arc(size/2,size/2,size*0.46,0,Math.PI*2); x.closePath(); x.clip(); x.translate(size,0); x.scale(-1,1); const crop=dim*0.82; const sx=(v.videoWidth-crop)/2, sy=(v.videoHeight-crop)/2; x.drawImage(v,sx,sy,crop,crop,0,0,size,size); x.restore(); return c.toDataURL('image/jpeg',.82); }
async function startMatchRecording(){ if(!state.recordHighlights||state.recordingActive) return; state.replayShots=[]; state.audioChunks=[]; clearReplayDownloads(); if(state.recordMic){ try{ state.micStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false}); const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm'; state.mediaRecorder=new MediaRecorder(state.micStream,{mimeType:mime}); state.mediaRecorder.ondataavailable=e=>{if(e.data?.size) state.audioChunks.push(e.data);}; state.mediaRecorder.start(1000);}catch(err){console.warn('Mic recording unavailable',err);toast('Mic permission denied or unavailable. Continuing without voice recording.'); state.recordMic=false; $('recordMic').checked=false; }} state.recordingActive=true; }
function stopMatchRecording(){ if(!state.recordingActive) return; state.recordingActive=false; if(state.mediaRecorder && state.mediaRecorder.state!=='inactive'){ state.mediaRecorder.stop(); state.mediaRecorder.onstop=()=>{ if(state.audioBlobUrl) URL.revokeObjectURL(state.audioBlobUrl); if(state.audioChunks.length){ state.audioBlobUrl=URL.createObjectURL(new Blob(state.audioChunks,{type:'audio/webm'})); const a=$('downloadAudio'); a.href=state.audioBlobUrl; a.classList.remove('hidden'); } }; }
 if(state.micStream){ state.micStream.getTracks().forEach(t=>t.stop()); state.micStream=null; }
}
function clearReplayDownloads(){ $('downloadAudio').classList.add('hidden'); $('downloadCollage').classList.add('hidden'); $('replayPanel').classList.add('hidden'); $('replayGrid').replaceChildren(); if(state.audioBlobUrl){URL.revokeObjectURL(state.audioBlobUrl); state.audioBlobUrl='';} }
function renderReplayPanel(){ const panel=$('replayPanel'); const grid=$('replayGrid'); grid.replaceChildren(); if(!state.recordHighlights || !state.replayShots.length){ panel.classList.add('hidden'); return; } panel.classList.remove('hidden'); for(const shot of state.replayShots.slice(-8)){ const img=document.createElement('img'); img.src=shot.src; img.alt=`${shot.name} replay`; grid.append(img); }
 const collage=createCollage(state.replayShots.slice(-8)); if(collage){ const a=$('downloadCollage'); a.href=collage; a.classList.remove('hidden'); }
}
function createCollage(shots){
 if(!shots.length)return '';
 const cols=Math.min(4,shots.length),rows=Math.ceil(shots.length/cols),size=180;
 const c=document.createElement('canvas');c.width=cols*size;c.height=rows*size+50;const x=c.getContext('2d');
 x.fillStyle=state.theme==='pink'?'#180912':'#081019';x.fillRect(0,0,c.width,c.height);
 x.fillStyle='#fff';x.font='bold 24px sans-serif';x.fillText('BALLFACE HIGHLIGHTS',18,32);
 shots.forEach((shot,i)=>{
  const col=i%cols,row=Math.floor(i/cols),px=col*size,py=row*size+50;
  const img=new Image();img.onload=()=>{x.drawImage(img,px+6,py+6,size-12,size-12);x.strokeStyle=shot.team===1?'#ff6fae':'#6ae6f5';x.lineWidth=4;x.strokeRect(px+6,py+6,size-12,size-12);x.fillStyle='rgba(0,0,0,.6)';x.fillRect(px+6,py+size-39,size-12,27);x.fillStyle='#fff';x.font='600 15px sans-serif';x.fillText(shot.name,px+14,py+size-18);const a=$('downloadCollage');a.href=c.toDataURL('image/png');a.classList.remove('hidden');};img.src=shot.src;
 });return c.toDataURL('image/png');
}
function draw(time=0){ requestAnimationFrame(draw); if(!['countdown','playing','finished'].includes(state.phase)) return; if(state.phase==='countdown'||(state.phase==='playing'&&state.mode==='timed')) renderGameUI(); const dpr=window.devicePixelRatio||1,b=canvas.getBoundingClientRect(); if(!b.width) return; const cw=Math.floor(b.width*dpr), ch=Math.floor(b.height*dpr); if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;} ctx.setTransform(cw/W,0,0,ch/H,0,0); const reverse=flipped(); updateEffects(1/60); ctx.save(); if(reverse){ctx.translate(W,H);ctx.rotate(Math.PI);} drawArenaFX(time); const pr=radius(); for(const p of state.players) drawPlayer(p,pr,reverse); drawBall(); drawEffects(); ctx.restore(); }
function beep(freq=440,dur=.05){ if(!state.sound) return; try{ const ac=beep.ctx||(beep.ctx=new (window.AudioContext||window.webkitAudioContext)()); const o=ac.createOscillator(),g=ac.createGain(); o.type='triangle'; o.frequency.value=freq; g.gain.value=.02; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+dur); o.stop(ac.currentTime+dur);}catch{} }
const MP_VERSION='0.10.35'; const MP_BASES=[`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`,`https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}`]; const MODEL_URL='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
function trackStatus(message){$('trackingStatus').textContent=message;}
async function loadFaceTracker(){ const errors=[]; for(const base of MP_BASES){ try{ const vision=await import(`${base}/vision_bundle.mjs`); const files=await vision.FilesetResolver.forVisionTasks(`${base}/wasm`); for(const delegate of ['GPU','CPU']){ try{return await vision.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL_URL,delegate},runningMode:'VIDEO',numFaces:1});} catch(e){errors.push(`${delegate} ${base}: ${e.message||e}`);} } } catch(e){errors.push(`Module ${base}: ${e.message||e}`);} } throw new Error(errors.join(' | ').slice(0,600)); }
async function startCamera(){ if(state.landmarker&&state.cameraOn) return; if(!navigator.mediaDevices?.getUserMedia){trackStatus('HTTPS IS REQUIRED FOR CAMERA');toast('Open the secure https:// game link to use your camera.');return;} try{ if(!state.cameraOn){ state.cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:60,max:60}}}); $('camera').srcObject=state.cameraStream; $('lobbyCamera').srcObject=state.cameraStream; await $('camera').play(); await $('lobbyCamera').play().catch(()=>{}); state.cameraOn=true; } $('cameraLabel').textContent='LIVE';$('enableCamera').textContent='RETRY TRACKER';$('enableCamera').disabled=true; trackStatus('LOADING FACE TRACKING…'); try{ state.landmarker=await loadFaceTracker(); state.lastVideoTime=-1; state.neutral=null; state.lastTrack=0; trackStatus('LOOK AT CAMERA TO CALIBRATE'); $('enableCamera').textContent='CAMERA ON'; requestAnimationFrame(cameraLoop);} catch(err){console.error('Face tracking load error:',err); state.trackingError=String(err.message||err); reportCamera(false); trackStatus('TRACKER LOAD FAILED — TAP RETRY'); $('enableCamera').textContent='RETRY TRACKER';$('enableCamera').disabled=false; toast('Could not load face tracking. Check internet / tracking error in browser console.');}} catch(err){reportCamera(false);console.error('Camera error:',err);toast('Camera unavailable. Check camera permission and HTTPS.');trackStatus('CAMERA PERMISSION / HTTPS ERROR');$('enableCamera').disabled=false;} }
function reportCamera(ready){ if(state.lastCameraReport!==ready){state.lastCameraReport=ready;state.cameraReady=ready;wsSend({type:'camera',ready});} const label=$('lobbyCameraStatus'); if(label) label.textContent=ready?'◉ FACE TRACKING READY':state.cameraOn?'WAITING FOR FACE / TRACKER':'CAMERA NOT ENABLED'; }
function clamp01(x){return Math.max(0,Math.min(1,x));}
function holdStill(value,last,deadZone=.012){return Math.abs(value-last)<deadZone?last:value;}
function cameraLoop(timestamp){ if(!state.cameraOn||!state.landmarker) return; requestAnimationFrame(cameraLoop); const video=$('camera'); if(video.readyState<2||video.currentTime===state.lastVideoTime) return; if(timestamp-state.lastTrack<16) return; state.lastVideoTime=video.currentTime; state.lastTrack=timestamp; let results; try{results=state.landmarker.detectForVideo(video,timestamp);} catch(err){state.tracking=false;reportCamera(false);trackStatus('TRACKING ERROR — RETRY CAMERA');console.warn('Face detection:',err);return;} const landmarks=results.faceLandmarks?.[0]; if(!landmarks){state.tracking=false;reportCamera(false);trackStatus('NO FACE — LOOK AT CAMERA');return;} const left=landmarks[33],right=landmarks[263],nose=landmarks[1],forehead=landmarks[10],chin=landmarks[152]; if(!left||!right||!nose||!forehead||!chin) return; const roll=Math.atan2(right.y-left.y,right.x-left.x); const eyeWidth=Math.hypot(right.x-left.x,right.y-left.y); const faceHeight=Math.max(.025,Math.hypot(chin.x-forehead.x,chin.y-forehead.y)); const centerX=(forehead.x+chin.x)/2,centerY=(forehead.y+chin.y)/2; const eyeX=(left.x+right.x)/2,eyeY=(left.y+right.y)/2; const yaw=(nose.x-eyeX)/Math.max(.05,eyeWidth); const pitch=(nose.y-eyeY)/faceHeight; const measurement={roll,pitch,yaw,tx:centerX,ty:centerY,scale:eyeWidth}; if(!state.neutral){state.neutral=measurement;state.stillX=.5;state.stillY=.5;state.controlX=.5;state.controlY=.5;state.sentX=.5;state.sentY=.5;state.axisLock='none';toast('Face calibrated. Stay still to hold position.');} const n=state.neutral; const sensitivity=Number($('sensitivity').value)/100*state.headSpeed; const turnX=(measurement.yaw-n.yaw), shiftX=(measurement.tx-n.tx), nodY=(measurement.pitch-n.pitch), shiftY=(measurement.ty-n.ty), tilt=(measurement.roll-n.roll); let hx=.5-((tilt*1.0)-(turnX*1.35)-(shiftX*2.9))*sensitivity; let hy=.5+((nodY*2.45)+(shiftY*3.1))*sensitivity; if(state.track==='translation'){ hx=.5+(shiftX*3.7+turnX*.8)*sensitivity; hy=.5+(shiftY*3.4+nodY*.65)*sensitivity; } hx=clamp01(hx); hy=clamp01(hy); const axisMove=BallfaceAxis.update(state.controlX,state.controlY,hx,hy,state.axisLock); state.controlX=axisMove.x; state.controlY=axisMove.y; state.axisLock=axisMove.axis; state.stillX=state.controlX; state.stillY=state.controlY; state.tracking=true;reportCamera(true);trackStatus('◉ FACE TRACKING ACTIVE'); if(timestamp-state.lastMove>30){const outgoing=BallfaceAxis.update(state.sentX,state.sentY,state.controlX,state.controlY,state.axisLock);state.sentX=outgoing.x;state.sentY=outgoing.y;wsSend({type:'move',...localMove(state.sentX,state.sentY),tracking:true});state.lastMove=timestamp;} if(!state.selfieData&&state.id){takeStillSelfie();} }
function sendFaceImage(){if(state.selfieData)wsSend({type:'face',image:state.selfieData});}
function setStaticSelfie(src,source){
 state.selfieData=src;state.selfieSource=source;
 $('mySelfiePreview').src=src;$('gameSelfiePreview').src=src;$('mySelfiePreview').classList.remove('hidden');$('selfiePlaceholder').classList.add('hidden');
 const image=new Image();image.onload=()=>{if(state.id){state.faceImages.set(state.id,image);renderLobby();}};image.src=src;
 sendFaceImage();toast(source==='upload'?'Photo set!':'Selfie captured!');
}
function cropStillImage(img,source='upload'){
 const c=document.createElement('canvas'),x=c.getContext('2d'),size=112;
 c.width=c.height=size; x.fillStyle=avatarBg();x.fillRect(0,0,size,size);
 x.save();x.beginPath();x.arc(size/2,size/2,size*.465,0,Math.PI*2);x.clip();
 const w=img.naturalWidth||img.videoWidth,h=img.naturalHeight||img.videoHeight;const d=Math.min(w,h)*.84;
 x.drawImage(img,(w-d)/2,(h-d)/2,d,d,0,0,size,size);x.restore();
 setStaticSelfie(c.toDataURL('image/jpeg',.7),source);
}
function takeStillSelfie(){if(!$('camera').videoWidth){toast('Enable your camera first, then take a selfie.');return;}const img=captureLiveFaceDataURL(112);if(img)setStaticSelfie(img,'camera');}
async function readUploadedSelfie(file){
 if(!file)return;if(!file.type.startsWith('image/')||file.size>8*1024*1024){toast('Choose an image under 8 MB.');return;}
 const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});cropStillImage(img);}catch{toast('Could not open that image. Try JPG or PNG.');}finally{URL.revokeObjectURL(url);}
}

function pointerMove(ev){ if(state.phase!=='playing'||state.tracking) return; const p=me(); if(!p) return; const box=canvas.getBoundingClientRect(),point=toCourt((ev.clientX-box.left)/box.width*W,(ev.clientY-box.top)/box.height*H),z=zone(p); const motion=BallfaceAxis.update(state.controlX,state.controlY,(point.x-z.x0)/(z.x1-z.x0),(point.y-z.y0)/(z.y1-z.y0),state.axisLock);state.controlX=motion.x;state.controlY=motion.y;state.axisLock=motion.axis;const outgoing=BallfaceAxis.update(state.sentX,state.sentY,motion.x,motion.y,motion.axis);state.sentX=outgoing.x;state.sentY=outgoing.y;wsSend({type:'move',...localMove(state.sentX,state.sentY),tracking:false}); }
canvas.addEventListener('pointerdown',e=>{state.touchActive=true;canvas.setPointerCapture(e.pointerId);pointerMove(e);}); canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||state.touchActive)pointerMove(e);}); canvas.addEventListener('pointerup',()=>{state.touchActive=false;});
for(const [id,key] of [['ballSpeed','ballSpeed'],['headSpeed','headSpeed'],['gameBallSpeed','ballSpeed'],['gameHeadSpeed','headSpeed']]) $(id).addEventListener('input',ev=>{if(!state.host)return; const value=Number(ev.target.value); state[key]=value; for(const labelId of (key==='ballSpeed'?['ballSpeedValue','gameBallSpeedValue']:['headSpeedValue','gameHeadSpeedValue'])) $(labelId).textContent=`${value.toFixed(1)}×`; wsSend({type:'settings',key,value});});

// WebRTC voice is opt-in and local microphone capture is separate from replay consent.
const ICE_SERVERS={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
function voiceSend(){wsSend({type:'voice-status',enabled:state.voiceEnabled,muted:state.voiceMuted});}
function voicePermissionMessage(error){
 const name=error?.name||'UnknownError';
 if(name==='NotAllowedError'||name==='PermissionDeniedError') return 'Microphone blocked. In browser site settings, allow Microphone for this game, then refresh and retry.';
 if(name==='NotFoundError'||name==='DevicesNotFoundError') return 'No microphone found on this device.';
 if(name==='NotReadableError'||name==='TrackStartError') return 'Microphone unavailable or in use by another app. Close other apps and retry.';
 if(name==='SecurityError') return 'Browser blocked the microphone. Open the HTTPS game link in Safari or Chrome directly.';
 return `Microphone could not start (${name}). Check browser microphone permissions and retry.`;
}
async function joinVoice(){
 if(state.voiceEnabled)return;
 const status=$('voiceStatus'),gameStatus=$('gameVoiceStatus');
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
  const msg='Microphone requires a secure HTTPS page opened directly in Safari or Chrome.';
  status.textContent=msg;gameStatus.textContent=msg;toast(msg);return;
 }
 const buttons=['joinVoice','gameJoinVoice'].map($).filter(Boolean);
 buttons.forEach(b=>{b.disabled=true;b.textContent='🎙 REQUESTING MIC…';});
 status.textContent='REQUESTING MICROPHONE PERMISSION…';gameStatus.textContent='REQUESTING MICROPHONE PERMISSION…';
 try{
  // Run directly from Join Voice tap, requesting broad audio compatibility first.
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  if(!stream.getAudioTracks().length)throw new Error('No microphone track returned');
  state.voiceStream=stream;
  for(const track of stream.getAudioTracks()){
   track.applyConstraints?.({echoCancellation:true,noiseSuppression:true,autoGainControl:true}).catch(()=>{});
   track.enabled=true;
  }
  state.voiceEnabled=true;state.voiceMuted=false;
  voiceSend();syncVoicePeers();renderVoiceUI();toast('Microphone enabled. Voice chat connected. Tap Mute anytime.');
 }catch(error){
  console.error('Voice microphone request failed:',error);
  state.voiceEnabled=false;
  const msg=voicePermissionMessage(error);
  status.textContent=msg;gameStatus.textContent=msg;toast(msg);
  buttons.forEach(b=>{b.disabled=false;b.textContent='🎙 RETRY MICROPHONE';});
 }
}
function toggleMute(){if(!state.voiceEnabled)return;state.voiceMuted=!state.voiceMuted;for(const t of state.voiceStream?.getAudioTracks()||[])t.enabled=!state.voiceMuted;voiceSend();renderVoiceUI();}
function renderVoiceUI(){const connected=state.voiceEnabled;const label=connected?(state.voiceMuted?'🔇 UNMUTE':'🎙 MUTE'):'🎙 JOIN VOICE CHAT';
 for(const id of ['joinVoice','gameJoinVoice']){const b=$(id);if(b){b.textContent=connected?'✓ VOICE CONNECTED':label;b.disabled=connected;}}
 for(const id of ['muteVoice','gameMuteVoice']){const b=$(id);if(b){b.disabled=!connected;b.textContent=connected?(state.voiceMuted?'🔇 UNMUTE':'🎙 MUTE'):'🔇 MUTED';}}
 const peers=state.players.filter(p=>p.voiceEnabled&&!p.bot).length;
 $('voiceStatus').textContent=connected?`${peers} IN VOICE · ${state.voiceMuted?'YOUR MIC MUTED':'YOUR MIC ON'}`:'VOICE OFF';
 $('gameVoiceStatus').textContent=connected?`${peers} IN VOICE · ${state.voiceMuted?'MUTED':'LIVE'}`:'VOICE OFF';
}
function closeVoicePeer(id){const peer=state.voicePeers.get(id);if(!peer)return;try{peer.pc.close();}catch{}peer.audio.remove();state.voicePeers.delete(id);}
function syncVoicePeers(){const active=new Set(state.players.filter(p=>p.voiceEnabled&&!p.bot&&p.id!==state.id).map(p=>p.id));for(const id of state.voicePeers.keys())if(!active.has(id))closeVoicePeer(id);if(!state.voiceEnabled)return;for(const id of active) if(!state.voicePeers.has(id) && state.id<id) makeVoicePeer(id,true).catch(console.warn);}
async function makeVoicePeer(id,initiator=false){
 if(state.voicePeers.has(id))return state.voicePeers.get(id);
 if(!state.voiceEnabled||!state.voiceStream)return null;
 const pc=new RTCPeerConnection(ICE_SERVERS);const audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.className='remote-audio';document.body.append(audio);
 state.voiceStream.getTracks().forEach(track=>pc.addTrack(track,state.voiceStream));
 const record={pc,audio,pending:[]};state.voicePeers.set(id,record);
 pc.onicecandidate=e=>{if(e.candidate)wsSend({type:'signal',to:id,kind:'ice',data:e.candidate.toJSON()});};
 pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{toast('Tap the screen to enable voice playback.');});};
 pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState)){if(pc.connectionState==='failed')toast('Voice connection failed. A TURN server may be needed.');}};
 if(initiator){const offer=await pc.createOffer();await pc.setLocalDescription(offer);wsSend({type:'signal',to:id,kind:'offer',data:pc.localDescription.toJSON()});}
 return record;
}
async function handleSignal(msg){if(!state.voiceEnabled||!state.voiceStream||!msg.from)return;let peer=state.voicePeers.get(msg.from);
 if(msg.kind==='offer'){
  if(!peer)peer=await makeVoicePeer(msg.from,false);
  if(!peer)return;
  await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.data));
  for(const c of peer.pending.splice(0))await peer.pc.addIceCandidate(new RTCIceCandidate(c));
  const answer=await peer.pc.createAnswer();await peer.pc.setLocalDescription(answer);
  wsSend({type:'signal',to:msg.from,kind:'answer',data:peer.pc.localDescription.toJSON()});
 }else if(msg.kind==='answer'&&peer){await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.data));for(const c of peer.pending.splice(0))await peer.pc.addIceCandidate(new RTCIceCandidate(c));}
 else if(msg.kind==='ice'){
  if(!peer)peer=await makeVoicePeer(msg.from,false);if(!peer)return;
  if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(new RTCIceCandidate(msg.data));else peer.pending.push(msg.data);
 }
}
// Share official embeddable links only; do not relay or download streaming audio.
function musicEmbed(raw){if(!raw)return null;try{
 const u=new URL(raw);if(u.protocol!=='https:')return null;
 let url=null,name=null;
 if(['www.youtube.com','youtube.com','music.youtube.com','youtu.be'].includes(u.hostname)){
  let id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||(/\/shorts\/([\w-]+)/.exec(u.pathname)||[])[1];
  if(!/^[\w-]{11}$/.test(id||''))return null;
  url=`https://www.youtube-nocookie.com/embed/${id}?playsinline=1`;name='YouTube';
 }else if(u.hostname==='open.spotify.com'){
  const m=u.pathname.match(/^\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)$/);if(!m)return null;
  url=`https://open.spotify.com/embed/${m[1]}/${m[2]}`;name='Spotify';
 }else if(u.hostname==='music.apple.com'){
  url=`https://embed.music.apple.com${u.pathname}${u.search}`;name='Apple Music';
 }else return null;
 return {url,name};
 }catch{return null;}}
function renderMusicUI(){
 const music=state.music,uploaded=music?.type==='upload',info=uploaded?{url:music.url,name:music.name||'Uploaded song',uploaded:true}:musicEmbed(music?.url);const text=info?`♫ ${info.name} · SHARED BY ${music.by}`:'No music shared yet';$('musicInfo').textContent=text;
 $('shareMusic').disabled=!state.host;$('musicUrl').disabled=!state.host;$('removeMusic').disabled=!state.host||!music;$('uploadSong').disabled=!state.host;$('uploadMusicBtn').disabled=!state.host;
 const key=info?.url||'';for(const [id,show] of [['musicPlayer',true],['gameMusicPlayer',state.musicVisible]]){
  const root=$(id);if(root.dataset.musicKey!==key){root.replaceChildren();root.dataset.musicKey=key;
   if(info){if(info.uploaded){const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=info.url;audio.loop=true;audio.style.width='100%';root.append(audio);}else{const f=document.createElement('iframe');f.title=`${info.name} music player`;f.src=info.url;f.loading='lazy';f.allow='autoplay; encrypted-media; picture-in-picture';f.referrerPolicy='strict-origin-when-cross-origin';f.height=info.name==='YouTube'?'250':'160';root.append(f);}}
  }
  root.classList.toggle('hidden',!info||(id==='musicPlayer'&&!state.musicVisible)||(id==='gameMusicPlayer'&&!show));
 }
 $('gameMusicPanel').classList.toggle('hidden',!info||!state.musicVisible);
 $('toggleMusic').textContent=state.musicVisible?'HIDE PLAYER':'SHOW PLAYER';
 $('gameMusicToggle').textContent=state.musicVisible?'♫ HIDE MUSIC':'♫ SHOW MUSIC';
}
$('createBtn').onclick=()=>connect(randomCode()); $('joinBtn').onclick=()=>$('joinForm').classList.toggle('hidden'); $('joinConfirm').onclick=()=>{const room=$('joinCode').value.toUpperCase().trim(); if(!/^[A-Z2-9]{5,7}$/.test(room)) return toast('Enter a valid lobby code'); connect(room);}; $('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinConfirm').click();}); $('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('createBtn').click();}); $('playerName').value=localStorage.getItem('facepong-name')||'';
$('joinVoice').onclick=joinVoice;$('gameJoinVoice').onclick=joinVoice;$('muteVoice').onclick=toggleMute;$('gameMuteVoice').onclick=toggleMute;$('shareMusic').onclick=()=>{if(!state.host)return;const url=$('musicUrl').value.trim();if(!musicEmbed(url)){toast('Paste a direct YouTube video, Spotify track, or Apple Music link.');return;}wsSend({type:'music',action:'set',url});};$('uploadMusicBtn').onclick=async()=>{
 if(!state.host||!state.room||!state.id)return;
 const file=$('uploadSong').files?.[0];if(!file)return toast('Select an MP3 or MP4 first.');
 if(file.size>12*1024*1024||file.size<128)return toast('Choose a file under 12 MB.');
 const type=file.type||(/\.mp3$/i.test(file.name)?'audio/mpeg':/\.mp4$/i.test(file.name)?'video/mp4':'');
 if(!['audio/mpeg','audio/mp3','video/mp4','audio/mp4'].includes(type))return toast('Only MP3 and MP4 files are supported.');
 const button=$('uploadMusicBtn');button.disabled=true;button.textContent='UPLOADING…';
 try{const res=await fetch(`/api/upload-music?room=${encodeURIComponent(state.room)}`,{method:'POST',headers:{'Content-Type':type,'X-Facepong-Player-Id':state.id,'X-Facepong-Filename':file.name},body:file});
 if(!res.ok)throw new Error(await res.text());toast('Song shared! Each player can tap Play.');$('uploadSong').value='';}
 catch(err){toast('Music upload failed: '+String(err.message||err).slice(0,100));}
 finally{button.textContent='UPLOAD TO ROOM';button.disabled=!state.host;}
};$('removeMusic').onclick=()=>wsSend({type:'music',action:'clear'});$('toggleMusic').onclick=()=>{state.musicVisible=!state.musicVisible;renderMusicUI();};$('gameMusicToggle').onclick=()=>{state.musicVisible=!state.musicVisible;renderMusicUI();};$('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Invite link copied!');}catch{prompt('Copy this invite link:',location.href);}};
document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>wsSend({type:'size',size:Number(b.dataset.size)})); document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>wsSend({type:'team',team:Number(b.dataset.team)})); $('readyBtn').onclick=()=>wsSend({type:'ready',ready:!state.ready}); $('startBtn').onclick=()=>wsSend({type:'start'}); $('rematchBtn').onclick=()=>{clearReplayDownloads(); wsSend({type:'rematch'});}; $('enableCamera').onclick=startCamera; $('lobbyEnableCamera').onclick=startCamera; $('takeSelfie').onclick=takeStillSelfie; $('uploadSelfie').onchange=e=>readUploadedSelfie(e.target.files?.[0]); $('fillBots').onclick=()=>wsSend({type:'bots',action:'fill'}); $('clearBots').onclick=()=>wsSend({type:'bots',action:'clear'}); $('calibrateBtn').onclick=()=>{state.neutral=null;state.axisLock='none';toast('Face calibration reset. Look straight ahead.');}; $('modeBtn').onclick=()=>{state.track=state.track==='tilt'?'translation':'tilt';state.neutral=null;$('modeBtn').textContent=state.track==='tilt'?'MODE: ALL HEAD MOVEMENTS':'MODE: HEAD POSITION + LOOK';toast(`Control mode: ${state.track}`);}; for(const id of ['matchMode','targetPoints','durationMinutes']) $(id).addEventListener('change',()=>{if(!state.host)return; wsSend({type:'rules',mode:$('matchMode').value,targetPoints:Number($('targetPoints').value),durationMinutes:Number($('durationMinutes').value)});}); $('soundToggle').onclick=()=>{state.sound=!state.sound;$('soundToggle').textContent=state.sound?'♪':'♪̸';}; $('styleBoy').onclick=()=>{localStorage.setItem('facepong-style','blue');setTheme('blue');}; $('styleGirl').onclick=()=>{localStorage.setItem('facepong-style','pink');setTheme('pink');}; $('recordHighlights').addEventListener('change',e=>{state.recordHighlights=e.target.checked; $('recordMic').disabled=!state.recordHighlights; if(!state.recordHighlights){state.recordMic=false; $('recordMic').checked=false; clearReplayDownloads();}}); $('recordMic').addEventListener('change',e=>{state.recordMic=e.target.checked;}); setInterval(()=>{if(state.phase==='countdown'||state.phase==='playing'&&state.mode==='timed')renderGameUI();},250);
const initialRoom=roomFromURL(); if(initialRoom){$('joinCode').value=initialRoom;$('joinForm').classList.remove('hidden');document.body.classList.add('invited');$('joinBtn').textContent='JOIN FRIENDS';$('joinBtn').classList.add('join-green');$('joinConfirm').textContent='JOIN THIS LOBBY →';$('joinConfirm').classList.add('join-green');} setTheme(); requestAnimationFrame(draw);
