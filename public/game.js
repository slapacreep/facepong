const $=id=>document.getElementById(id);
const W=650,H=1000,colors=['#6ae6f5','#ff6fae'];
const state={ws:null,id:null,room:null,players:[],size:2,ballSpeed:1,headSpeed:1,phase:'entry',score:[0,0],ball:{x:325,y:500},host:false,ready:false,faceImages:new Map(),track:'tilt',controlX:.5,controlY:.5,neutral:null,landmarker:null,cameraStream:null,cameraOn:false,lastTrack:0,lastMove:0,lastFace:0,tracking:false,sound:true,lastHit:null,lastRound:0,notice:'',touchActive:false,lastVideoTime:-1,stillX:.5,stillY:.5,trackingError:''};
const canvas=$('arena'),ctx=canvas.getContext('2d');
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),3300);}
function wsSend(payload){if(state.ws?.readyState===WebSocket.OPEN)state.ws.send(JSON.stringify(payload));}
function screen(name){['entry','lobby','game'].forEach(id=>$(id).classList.toggle('hidden',id!==name));$('roomTag').classList.toggle('hidden',name==='entry');}
function roomFromURL(){return new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z2-9]/g,'')||'';}
function randomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>chars[x%chars.length]).join('');}
function connect(room){const name=$('playerName').value.trim()||localStorage.getItem('facepong-name')||'Player';localStorage.setItem('facepong-name',name);if(state.ws)state.ws.close();const protocol=location.protocol==='https:'?'wss:':'ws:';state.ws=new WebSocket(`${protocol}//${location.host}/ws`);state.ws.onopen=()=>wsSend({type:'join',room,name});state.ws.onmessage=e=>{let msg;try{msg=JSON.parse(e.data);}catch{return;}onMessage(msg);};state.ws.onclose=()=>{toast('Connection lost. Refresh to reconnect.');$('trackingStatus').textContent='DISCONNECTED';};state.ws.onerror=()=>toast('Could not connect to game server');}
function onMessage(msg){if(msg.type==='error'){toast(msg.message);return;}if(msg.type==='welcome'){state.id=msg.id;state.room=msg.room;history.replaceState(null,'',`/?room=${msg.room}`);screen('lobby');$('roomCode').textContent=msg.room;$('inviteUrl').textContent=location.href;return;}if(msg.type==='face'){const img=new Image();img.onload=()=>state.faceImages.set(msg.id,img);img.src=msg.image;return;}if(msg.type==='state'){const oldPhase=state.phase;const oldRound=state.lastRound;state.players=msg.players;state.size=msg.size;state.ballSpeed=msg.ballSpeed??1;state.headSpeed=msg.headSpeed??1;state.phase=msg.phase;state.score=msg.score;state.ball=msg.ball;state.lastHit=msg.lastHit;state.lastRound=msg.round;state.host=msg.players[0]?.id===state.id;state.ready=!!msg.players.find(p=>p.id===state.id)?.ready;renderSpeedControls();
 if(msg.phase==='lobby'){screen('lobby');renderLobby();}else{screen('game');renderGameUI();if(msg.phase==='playing'&&oldPhase!=='playing')toast('THE MATCH IS ON!');if(msg.phase==='finished')finishGame();}
 if(oldRound!==msg.round&&oldRound>0&&msg.phase==='playing')beep(260,.06);}}
function renderSpeedControls(){
 for(const [key,id,valueId] of [['ballSpeed','ballSpeed','ballSpeedValue'],['headSpeed','headSpeed','headSpeedValue'],['ballSpeed','gameBallSpeed','gameBallSpeedValue'],['headSpeed','gameHeadSpeed','gameHeadSpeedValue']]){
  const slider=$(id);if(!slider)continue;
  if(document.activeElement!==slider)slider.value=String(state[key]);
  $(valueId).textContent=`${state[key].toFixed(1)}×`;
  slider.disabled=!state.host;
 }
}
function renderLobby(){const r=state;$('lobbyCount').textContent=`${r.players.length} / ${r.size*2}`;$('blueCount').textContent=`${r.players.filter(p=>p.team===0).length} / ${r.size}`;$('pinkCount').textContent=`${r.players.filter(p=>p.team===1).length} / ${r.size}`;
 for(let team=0;team<2;team++){const list=$(team?'pinkList':'blueList');list.replaceChildren();const players=r.players.filter(p=>p.team===team);for(let i=0;i<r.size;i++){const el=document.createElement('div');el.className='playerentry'+(players[i]?'':' empty');if(players[i]){const p=players[i],pf=document.createElement('span');pf.className='pfp';pf.textContent='◉';const label=document.createElement('span');label.textContent=p.name+(p.id===r.id?' (YOU)':'')+(r.players[0]?.id===p.id?' ★':'');const stat=document.createElement('span');stat.className='status '+(p.ready?'yes':'');stat.textContent=p.ready?'✓ READY':'WAITING';el.append(pf,label,stat);}else el.textContent=`+ Open slot ${i+1}`;list.append(el);}}
 document.querySelectorAll('[data-size]').forEach(btn=>{btn.classList.toggle('selected',Number(btn.dataset.size)===r.size);btn.disabled=!r.host;});$('readyBtn').textContent=r.ready?'✓ READY':'I’M READY';$('readyBtn').style.borderColor=r.ready?'#72e7a6':'';$('startBtn').classList.toggle('hidden',!r.host);$('startBtn').disabled=r.players.length!==r.size*2||!r.players.every(p=>p.ready);}
function renderGameUI(){$('blueScore').textContent=state.score[0];$('pinkScore').textContent=state.score[1];$('matchLabel').textContent=`${state.size} VS ${state.size}`;$('phaseMessage').textContent=state.phase==='finished'?'MATCH OVER':'FIRST TO 7 WINS';$('gameOverlay').classList.toggle('hidden',state.phase!=='finished');}
function finishGame(){const winner=state.score[0]>state.score[1]?0:1;$('overlayTitle').textContent=winner===0?'BLUE WINS!':'PINK WINS!';$('overlayTitle').style.color=colors[winner];$('rematchBtn').classList.toggle('hidden',!state.host);}
function radius(){return Math.max(14,Math.min(43,65/state.size));}
function zone(p){
 const lane=W/state.size,margin=Math.min(24,Math.max(9,lane*.13));
 return {x0:p.slot*lane+margin,x1:(p.slot+1)*lane-margin,
  y0:p.team===0?H*.58:50,y1:p.team===0?H-50:H*.42};
}
// Team 1 sees the exact same match rotated 180°, so its players are at the bottom.
function flipped(){return state.players.find(p=>p.id===state.id)?.team===1;}
function toCourt(x,y){return flipped()?{x:W-x,y:H-y}:{x,y};}
function localMove(x,y){return flipped()?{x:1-x,y:1-y}:{x,y};}
function draw(){requestAnimationFrame(draw);if(state.phase!=='playing'&&state.phase!=='finished')return;
 const dpr=window.devicePixelRatio||1,bounds=canvas.getBoundingClientRect();if(!bounds.width)return;
 const cw=Math.floor(bounds.width*dpr),ch=Math.floor(bounds.height*dpr);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 ctx.setTransform(cw/W,0,0,ch/H,0,0);ctx.fillStyle='#05070c';ctx.fillRect(0,0,W,H);
 const reverse=flipped();
 ctx.save();if(reverse){ctx.translate(W,H);ctx.rotate(Math.PI);}
 ctx.save();ctx.setLineDash([10,12]);ctx.strokeStyle='#242c3b';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.restore();
 ctx.strokeStyle='#1a2330';ctx.lineWidth=2;ctx.strokeRect(1,1,W-2,H-2);
 // Sidelines rebound. The horizontal end lines at top/bottom are goals.
 ctx.fillStyle=colors[1];ctx.globalAlpha=.22;ctx.fillRect(0,0,W,6);
 ctx.fillStyle=colors[0];ctx.fillRect(0,H-6,W,6);ctx.globalAlpha=1;
 const pr=radius();
 for(const p of state.players){
  const z=zone(p),own=p.id===state.id;
  ctx.fillStyle=p.team===0?'#6ae6f50b':'#ff6fae0b';ctx.fillRect(z.x0,z.y0,z.x1-z.x0,z.y1-z.y0);
  if(own){ctx.strokeStyle=colors[p.team]+'66';ctx.setLineDash([4,8]);ctx.lineWidth=1;ctx.strokeRect(z.x0,z.y0,z.x1-z.x0,z.y1-z.y0);ctx.setLineDash([]);}
  const x=p.x??(z.x0+z.x1)/2,y=p.y??(z.y0+z.y1)/2;
  ctx.save();ctx.translate(x,y);
  // Orient all faces naturally for the local player: your team is upright,
  // the opposing faces at the top are inverted.
  const viewTeam=reverse?1:0;
  if(p.team!==viewTeam)ctx.rotate(Math.PI);
  ctx.shadowColor=colors[p.team];ctx.shadowBlur=own?21:9;
  ctx.beginPath();ctx.arc(0,0,pr,0,Math.PI*2);
  ctx.fillStyle=p.team===0?'#153645':'#452037';ctx.fill();ctx.strokeStyle=colors[p.team];ctx.lineWidth=own?4:2.5;ctx.stroke();ctx.shadowBlur=0;ctx.clip();
  const face=state.faceImages.get(p.id);
  if(face){ctx.drawImage(face,-pr,-pr,pr*2,pr*2);}
  else{ctx.fillStyle='#d6b3aa';ctx.beginPath();ctx.ellipse(0,0,pr*.72,pr*.83,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#171923';ctx.beginPath();ctx.arc(-pr*.26,-pr*.08,pr*.085,0,7);ctx.arc(pr*.26,-pr*.08,pr*.085,0,7);ctx.fill();ctx.strokeStyle='#171923';ctx.lineWidth=pr*.07;ctx.beginPath();ctx.arc(0,pr*.19,pr*.26,0,Math.PI);ctx.stroke();}
  ctx.restore();
  // Labels rotate into the viewer's orientation rather than upside down.
  ctx.save();ctx.translate(x,y);if(reverse)ctx.rotate(Math.PI);
  ctx.fillStyle=own?'#ffffff':'#b8bfcc';ctx.textAlign='center';ctx.font=`${Math.max(13,Math.min(19,pr*.5))}px Space Grotesk`;
  ctx.fillText(p.name.substring(0,11),0,pr+17);
  if(own){ctx.fillStyle=colors[p.team];ctx.font='bold 12px DM Mono';ctx.fillText('YOU',0,-pr-9);}
  ctx.restore();
 }
 if(state.phase==='playing'){const b=state.ball;ctx.save();ctx.shadowColor='#fff0a0';ctx.shadowBlur=18;ctx.fillStyle='#fff0a0';ctx.beginPath();ctx.arc(b.x,b.y,8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.restore();}
 ctx.restore();
}
function beep(f=460,seconds=.08){if(!state.sound)return;try{const ac=beep.ac||(beep.ac=new (window.AudioContext||window.webkitAudioContext)());const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.065,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+seconds);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+seconds);}catch{}}
// Browser-based front camera tracking. Load the official MediaPipe ESM bundle; try a mirror if blocked.
// Landmarks remain on the player's phone; only normalized movement enters the game websocket.
const MP_VERSION='0.10.35';
const MP_BASES=[`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`,`https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}`];
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
function trackStatus(message){$('trackingStatus').textContent=message;}
async function loadFaceTracker(){
 const errors=[];
 for(const base of MP_BASES){
  try{
   const vision=await import(`${base}/vision_bundle.mjs`);
   const files=await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
   for(const delegate of ['GPU','CPU']){
    try{return await vision.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL_URL,delegate},runningMode:'VIDEO',numFaces:1});}
    catch(e){errors.push(`${delegate} ${base}: ${e.message||e}`);}
   }
  }catch(e){errors.push(`Module ${base}: ${e.message||e}`);}
 }
 throw new Error(errors.join(' | ').slice(0,600));
}
async function startCamera(){
 if(state.landmarker&&state.cameraOn)return;
 if(!navigator.mediaDevices?.getUserMedia){trackStatus('HTTPS IS REQUIRED FOR CAMERA');toast('Open the secure https:// game link to use your camera.');return;}
 try{
  if(!state.cameraOn){
   state.cameraStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:60,max:60}}});
   $('camera').srcObject=state.cameraStream;
   await $('camera').play();state.cameraOn=true;
  }
  $('cameraLabel').textContent='LIVE';$('enableCamera').textContent='RETRY TRACKER';$('enableCamera').disabled=true;
  trackStatus('LOADING FACE TRACKING…');
  try{
   state.landmarker=await loadFaceTracker();state.lastVideoTime=-1;state.neutral=null;state.lastTrack=0;
   trackStatus('LOOK AT CAMERA TO CALIBRATE');$('enableCamera').textContent='CAMERA ON';
   requestAnimationFrame(cameraLoop);
  }catch(err){
   console.error('Face tracking load error:',err);
   state.trackingError=String(err.message||err);
   trackStatus('TRACKER LOAD FAILED — TAP RETRY');
   $('enableCamera').textContent='RETRY TRACKER';$('enableCamera').disabled=false;
   toast('Could not load face tracking. Check internet / tracking error in browser console.');
  }
 }catch(err){console.error('Camera error:',err);toast('Camera unavailable. Check camera permission and HTTPS.');trackStatus('CAMERA PERMISSION / HTTPS ERROR');$('enableCamera').disabled=false;}
}
function clamp01(x){return Math.max(0,Math.min(1,x));}
function holdStill(value,last,deadZone=.008){return Math.abs(value-last)<deadZone?last:value;}
function cameraLoop(timestamp){
 if(!state.cameraOn||!state.landmarker)return;
 requestAnimationFrame(cameraLoop);
 const video=$('camera');
 if(video.readyState<2||video.currentTime===state.lastVideoTime)return;
 if(timestamp-state.lastTrack<16)return; // up to 60 updates/sec when device can handle it
 state.lastVideoTime=video.currentTime;state.lastTrack=timestamp;
 let results;
 try{results=state.landmarker.detectForVideo(video,timestamp);}
 catch(err){state.tracking=false;trackStatus('TRACKING ERROR — RETRY CAMERA');console.warn('Face detection:',err);return;}
 const landmarks=results.faceLandmarks?.[0];
 if(!landmarks){state.tracking=false;trackStatus('NO FACE — LOOK AT CAMERA');return;}
 const left=landmarks[33],right=landmarks[263],nose=landmarks[1],forehead=landmarks[10],chin=landmarks[152];
 if(!left||!right||!nose||!forehead||!chin)return;
 const roll=Math.atan2(right.y-left.y,right.x-left.x);
 const eyeWidth=Math.hypot(right.x-left.x,right.y-left.y);
 const faceHeight=Math.max(.025,Math.hypot(chin.x-forehead.x,chin.y-forehead.y));
 const midY=(forehead.y+chin.y)/2;
 const pitch=(nose.y-midY)/faceHeight;
 const measurement={roll,pitch,tx:nose.x,ty:nose.y,scale:eyeWidth};
 if(!state.neutral){state.neutral=measurement;state.stillX=.5;state.stillY=.5;toast('Face calibrated. Stay still to hold position.');}
 const neutral=state.neutral;
 const sensitivity=Number($('sensitivity').value)/100*state.headSpeed;
 let hx,hy;
 if(state.track==='tilt'){
  // Roll steers horizontally; pitch steers vertically. Small real translations also count,
  // so lifting/lowering the head works even without an exaggerated nod.
  hx=.5+((measurement.roll-neutral.roll)*1.65-(measurement.tx-neutral.tx)*.55)*sensitivity;
  hy=.5+((measurement.pitch-neutral.pitch)*3.8+(measurement.ty-neutral.ty)*1.55)*sensitivity;
 }else{
  hx=.5-(measurement.tx-neutral.tx)*3.4*sensitivity;
  hy=.5+(measurement.ty-neutral.ty)*3.2*sensitivity;
 }
 hx=clamp01(hx);hy=clamp01(hy);
 // No auto-centering / no easing. Ignore only sub-pixel tracking noise.
 state.controlX=holdStill(hx,state.stillX);
 state.controlY=holdStill(hy,state.stillY);
 state.stillX=state.controlX;state.stillY=state.controlY;
 state.tracking=true;trackStatus('◉ FACE TRACKING ACTIVE');
 if(timestamp-state.lastMove>30){wsSend({type:'move',...localMove(state.controlX,state.controlY),tracking:true});state.lastMove=timestamp;}
 if(timestamp-state.lastFace>3800&&state.id){state.lastFace=timestamp;sendFaceImage();}
}
function sendFaceImage(){const v=$('camera');if(!v.videoWidth)return;const c=$('previewCanvas'),x=c.getContext('2d');const dimension=Math.min(v.videoWidth,v.videoHeight);c.width=96;c.height=96;x.save();x.translate(96,0);x.scale(-1,1);x.drawImage(v,(v.videoWidth-dimension)/2,(v.videoHeight-dimension)/2,dimension,dimension,0,0,96,96);x.restore();wsSend({type:'face',image:c.toDataURL('image/jpeg',.55)});}
function pointerMove(ev){if(state.phase!=='playing'||state.tracking)return;const p=state.players.find(p=>p.id===state.id);if(!p)return;const box=canvas.getBoundingClientRect(),point=toCourt((ev.clientX-box.left)/box.width*W,(ev.clientY-box.top)/box.height*H),x=point.x,y=point.y,z=zone(p);state.controlX=Math.max(0,Math.min(1,(x-z.x0)/(z.x1-z.x0)));state.controlY=Math.max(0,Math.min(1,(y-z.y0)/(z.y1-z.y0)));wsSend({type:'move',x:state.controlX,y:state.controlY,tracking:false});}
canvas.addEventListener('pointerdown',e=>{state.touchActive=true;canvas.setPointerCapture(e.pointerId);pointerMove(e);});canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||state.touchActive)pointerMove(e);});canvas.addEventListener('pointerup',()=>{state.touchActive=false;});
for(const [id,key] of [['ballSpeed','ballSpeed'],['headSpeed','headSpeed'],['gameBallSpeed','ballSpeed'],['gameHeadSpeed','headSpeed']]){
 $(id).addEventListener('input',ev=>{if(!state.host)return;const value=Number(ev.target.value);state[key]=value;
  for(const labelId of (key==='ballSpeed'?['ballSpeedValue','gameBallSpeedValue']:['headSpeedValue','gameHeadSpeedValue']))$(labelId).textContent=`${value.toFixed(1)}×`;
  wsSend({type:'settings',key,value});
 });
}
$('createBtn').onclick=()=>connect(randomCode());$('joinBtn').onclick=()=>$('joinForm').classList.toggle('hidden');$('joinConfirm').onclick=()=>{const room=$('joinCode').value.toUpperCase().trim();if(!/^[A-Z2-9]{5,7}$/.test(room))return toast('Enter a valid lobby code');connect(room);};$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinConfirm').click();});$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('createBtn').click();});$('playerName').value=localStorage.getItem('facepong-name')||'';
$('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Invite link copied!');}catch{prompt('Copy this invite link:',location.href);}};
document.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>wsSend({type:'size',size:Number(b.dataset.size)}));document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>wsSend({type:'team',team:Number(b.dataset.team)}));$('readyBtn').onclick=()=>wsSend({type:'ready',ready:!state.ready});$('startBtn').onclick=()=>wsSend({type:'start'});$('rematchBtn').onclick=()=>wsSend({type:'rematch'});$('enableCamera').onclick=startCamera;$('calibrateBtn').onclick=()=>{state.neutral=null;toast('Face calibration reset. Look straight ahead.');};$('modeBtn').onclick=()=>{state.track=state.track==='tilt'?'translation':'tilt';state.neutral=null;$('modeBtn').textContent=state.track==='tilt'?'MODE: HEAD TILT':'MODE: HEAD POSITION';toast(`Control mode: ${state.track}`);};$('soundToggle').onclick=()=>{state.sound=!state.sound;$('soundToggle').textContent=state.sound?'♪':'♪̸';};
const initialRoom=roomFromURL();if(initialRoom){$('joinCode').value=initialRoom;$('joinForm').classList.remove('hidden');$('joinBtn').textContent='INVITE LINK DETECTED';}requestAnimationFrame(draw);
