'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const ORIGIN = process.env.PUBLIC_ORIGIN || '';
const rooms = new Map();
const WIDTH=650, HEIGHT=1000, RADIUS=8, TICK=1000/30;
const MAX_MUSIC_BYTES=12*1024*1024;
const MUSIC_TYPES={'audio/mpeg':'mp3','audio/mp3':'mp3','video/mp4':'mp4','audio/mp4':'mp4'};
const musicFiles=new Map();
function musicResponse(req,res,pathname){
 const m=/^\/api\/room-music\/([A-Z2-9]{5,7})\/([a-f0-9]{16})$/.exec(pathname);if(!m)return false;
 const item=musicFiles.get(m[1]);if(!item||item.token!==m[2]){res.writeHead(404).end('Song not found');return true;}
 const size=item.buffer.length;let start=0,end=size-1,status=200;
 if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
 if(!match){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return true;}
 if(match[1]===''&&match[2]!==''){start=Math.max(0,size-Number(match[2]));}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return true;}
 end=Math.min(end,size-1);status=206;
 }
 res.writeHead(status,{'Content-Type':item.type,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store',...(status===206?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
 if(req.method==='HEAD')res.end();else res.end(item.buffer.subarray(start,end+1));return true;
}
function uploadMusic(req,res,url){
 const roomId=url.searchParams.get('room')||'',playerId=req.headers['x-facepong-player-id'];const room=rooms.get(roomId);
 if(!room||room.players[0]?.id!==playerId||room.players[0]?.bot){res.writeHead(403).end('Only the lobby host can upload music');return;}
 const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
 const length=Number(req.headers['content-length']);
 if(!MUSIC_TYPES[type]||!Number.isInteger(length)||length<128||length>MAX_MUSIC_BYTES){res.writeHead(413).end('Use an MP3 or MP4 under 12 MB');return;}
 const chunks=[];let total=0,finished=false;
 req.on('data',chunk=>{total+=chunk.length;if(total>MAX_MUSIC_BYTES||total>length){finished=true;res.writeHead(413).end('File too large');req.destroy();return;}chunks.push(chunk);});
 req.on('end',()=>{if(finished)return;if(total!==length){res.writeHead(400).end('Incomplete upload');return;}
 // Limit temporary total shared memory to avoid unlimited uploads across many rooms.
 const totalStored=[...musicFiles.values()].reduce((a,b)=>a+b.buffer.length,0)-(musicFiles.get(roomId)?.buffer.length||0);
 if(totalStored+total>96*1024*1024){res.writeHead(503).end('Music storage temporarily full');return;}
 const token=crypto.randomBytes(8).toString('hex');const name=String(req.headers['x-facepong-filename']||'Uploaded song').replace(/[^\w. ()-]/g,'').slice(0,70)||'Uploaded song';
 musicFiles.set(roomId,{buffer:Buffer.concat(chunks),token,type});
 room.music={type:'upload',url:`/api/room-music/${roomId}/${token}`,name,by:room.players[0].name,at:Date.now()};broadcast(room,snapshot(room));
 res.writeHead(201,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:true,name}));
 });
 req.on('error',()=>{if(!res.headersSent)res.writeHead(400).end('Upload interrupted');});
}

const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
function broadcast(room,obj){const msg=JSON.stringify(obj);for(const p of room.players)if(p.socket&&!p.socket.destroyed)send(p.socket,msg);}
function send(s,msg){if(s.destroyed)return;const data=Buffer.from(msg),length=data.length;let head;if(length<126){head=Buffer.from([129,length]);}else if(length<65536){head=Buffer.alloc(4);head[0]=129;head[1]=126;head.writeUInt16BE(length,2);}else{head=Buffer.alloc(10);head[0]=129;head[1]=127;head.writeBigUInt64BE(BigInt(length),2);}s.write(Buffer.concat([head,data]));}
function upgrade(req,socket){const key=req.headers['sec-websocket-key'];if(req.headers.upgrade?.toLowerCase()!=='websocket'||!key){socket.destroy();return;}
 const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 let pending=Buffer.alloc(0), current=null;
 socket.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);while(pending.length>=2){const b=pending[1],masked=(b&128)!==0,opcode=pending[0]&15;let len=b&127,offset=2;if(len===126){if(pending.length<4)break;len=pending.readUInt16BE(2);offset=4;}else if(len===127){if(pending.length<10)break;const n=pending.readBigUInt64BE(2);if(n>65536n){socket.destroy();return;}len=Number(n);offset=10;}if(!masked||len>65536){socket.destroy();return;}if(pending.length<offset+4+len)break;const mask=pending.subarray(offset,offset+4),data=Buffer.from(pending.subarray(offset+4,offset+4+len));pending=pending.subarray(offset+4+len);for(let i=0;i<len;i++)data[i]^=mask[i%4];if(opcode===8){socket.end();return;}if(opcode===9){socket.write(Buffer.from([0x8a,0]));continue;}if(opcode===1){try{const msg=JSON.parse(data.toString('utf8'));current=onMessage(socket,current,msg);}catch(e){send(socket,JSON.stringify({type:'error',message:'Invalid message'}));}}}});
 socket.on('close',()=>leave(socket,current));socket.on('error',()=>{});
}
function makeRoom(id){return {id,players:[],size:2,ballSpeed:1,headSpeed:1,phase:'lobby',mode:'points',targetPoints:7,durationMinutes:2,countdownAt:0,matchEndsAt:0,score:[0,0],ball:{x:WIDTH/2,y:HEIGHT/2,vx:0,vy:0},lastHit:null,serveAt:0,round:0,gameOver:false,music:null,created:Date.now()};}
function safeRoom(id){return typeof id==='string'&&/^[A-Z2-9]{5,7}$/.test(id);}
function playerSummary(p){return {id:p.id,name:p.name,team:p.team,slot:p.slot,x:p.x,y:p.y,ready:p.ready,tracking:p.tracking,cameraReady:!!p.cameraReady,bot:!!p.bot,voiceEnabled:!!p.voiceEnabled,muted:!!p.muted};}
function snapshot(r){return {type:'state',room:r.id,phase:r.phase,size:r.size,ballSpeed:r.ballSpeed,headSpeed:r.headSpeed,players:r.players.map(playerSummary),score:r.score,ball:r.ball,round:r.round,lastHit:r.lastHit,gameOver:r.gameOver,mode:r.mode,targetPoints:r.targetPoints,durationMinutes:r.durationMinutes,countdownAt:r.countdownAt,matchEndsAt:r.matchEndsAt,music:r.music};}
function rearrange(r){for(let team=0;team<2;team++){const players=r.players.filter(p=>p.team===team);players.forEach((p,i)=>{p.slot=i;const range=zone(r,p);p.x=Math.max(range.minX,Math.min(range.maxX,p.x??(range.minX+range.maxX)/2));p.y=(range.minY+range.maxY)/2;});}}
function zone(r,p){
 const n=r.size,slot=Math.min(p.slot,n-1),lane=WIDTH/n;
 // Each player owns one horizontal lane on their team's half of the portrait court.
 const margin=Math.min(24,Math.max(9,lane*.13));
 return {minX:slot*lane+margin,maxX:(slot+1)*lane-margin,
  minY:p.team===0?HEIGHT*.58:50,maxY:p.team===0?HEIGHT-50:HEIGHT*.42};
}
function playerRadius(r){return r.size===1?Math.min(54,43*1.2):Math.max(14,Math.min(43,65/r.size));}
function addBot(r,team){
 if(r.phase!=='lobby'||![0,1].includes(team)||r.players.filter(p=>p.team===team).length>=r.size)return false;
 const slot=r.players.filter(p=>p.team===team).length;
 r.players.push({id:crypto.randomUUID(),name:`BOT ${team?'P':'B'}${slot+1}`,bot:true,team,slot:0,x:null,y:null,ready:true,tracking:true,cameraReady:true,socket:null,vx:0,vy:0,lastMove:Date.now()});
 rearrange(r);return true;
}
function removeBots(r){r.players=r.players.filter(p=>!p.bot);rearrange(r);}
function updateBots(r,dt){
 for(const p of r.players){if(!p.bot)continue;
  const z=zone(r,p),ball=r.ball,center=(z.minX+z.maxX)/2;
  // The bots defend their own lane, anticipate incoming shots, and never teleport.
  const approaching=p.team===0?ball.vy>0:ball.vy<0;
  const distance=Math.abs((p.team===0?HEIGHT*.84:HEIGHT*.16)-ball.y);
  const t=approaching?Math.min(1.5,distance/Math.max(120,Math.abs(ball.vy))):0;
  let desired=approaching?ball.x+ball.vx*t*.55:center;
  if(desired<0){desired=-desired;}if(desired>WIDTH){desired=2*WIDTH-desired;}
  desired=Math.max(z.minX,Math.min(z.maxX,desired));
  const centerY=p.team===0?HEIGHT*.83:HEIGHT*.17;
  const targetY=Math.max(z.minY,Math.min(z.maxY,centerY+(approaching?(ball.y-centerY)*.18:0)));
  const limit=(approaching?650:330)*r.headSpeed*dt;
  const dx=Math.max(-limit,Math.min(limit,desired-p.x));
  const dy=Math.max(-limit,Math.min(limit,targetY-p.y));
  p.x+=dx;p.y+=dy;p.vx=dx/dt;p.vy=dy/dt;p.lastMove=Date.now();
 }
}
function chooseTeam(r){const c=[r.players.filter(p=>p.team===0).length,r.players.filter(p=>p.team===1).length];return c[0]<=c[1]?0:1;}
function onMessage(socket,old,msg){if(!msg||typeof msg.type!=='string')return old;
 if(msg.type==='join'){if(old)return old;const id=String(msg.room||'').toUpperCase();if(!safeRoom(id)){send(socket,JSON.stringify({type:'error',message:'Invalid room code'}));return null;}let r=rooms.get(id);if(!r){r=makeRoom(id);rooms.set(id,r);}if(r.phase!=='lobby'){send(socket,JSON.stringify({type:'error',message:'Match already started. Join after the rematch.'}));return null;}if(r.players.length>=r.size*2){const bot=r.players.find(p=>p.bot);if(bot){r.players=r.players.filter(p=>p!==bot);}else{send(socket,JSON.stringify({type:'error',message:'Lobby is full'}));return null;}}
 const name=String(msg.name||'Player').trim().slice(0,18).replace(/[<>]/g,'')||'Player';const p={id:crypto.randomUUID(),name,team:chooseTeam(r),slot:0,x:null,y:null,ready:false,tracking:false,cameraReady:false,socket,voiceEnabled:false,muted:true,lastX:0,lastY:0,vx:0,vy:0,lastMove:Date.now()};r.players.push(p);rearrange(r);send(socket,JSON.stringify({type:'welcome',id:p.id,room:id}));broadcast(r,snapshot(r));return {room:id,player:p.id};}
 if(!old)return old;const r=rooms.get(old.room),p=r?.players.find(p=>p.id===old.player);if(!r||!p)return old;
 if(msg.type==='voice-status'){p.voiceEnabled=msg.enabled===true;p.muted=msg.muted!==false;broadcast(r,snapshot(r));}
 if(msg.type==='signal' && ['offer','answer','ice'].includes(msg.kind) && typeof msg.to==='string'){
  const target=r.players.find(q=>q.id===msg.to&&!q.bot&&q.socket&&q.voiceEnabled);
  if(target&&p.voiceEnabled){
   const data=JSON.stringify(msg.data||{});
   if(data.length<24000)send(target.socket,JSON.stringify({type:'signal',from:p.id,kind:msg.kind,data:msg.data}));
  }
 }
 if(msg.type==='music'&&r.players[0]===p){
  if(msg.action==='clear'){r.music=null;musicFiles.delete(r.id);broadcast(r,snapshot(r));}
  else if(msg.action==='set'&&typeof msg.url==='string'&&msg.url.length<600){
   try{const u=new URL(msg.url);const host=u.hostname.toLowerCase();
    if(u.protocol==='https:' && (['youtube.com','www.youtube.com','youtu.be','music.youtube.com','open.spotify.com','music.apple.com'].includes(host))){
     r.music={url:u.href,by:p.name,at:Date.now()};broadcast(r,snapshot(r));
    }else send(socket,JSON.stringify({type:'error',message:'Use a YouTube, Spotify, or Apple Music link.'}));
   }catch{send(socket,JSON.stringify({type:'error',message:'Invalid music URL.'}));}
  }
 }
 if(msg.type==='size'&&r.phase==='lobby'&&r.players[0]===p){const size=Number(msg.size);if(Number.isInteger(size)&&size>=1&&size<=6&&r.players.length<=size*2){r.size=size;rearrange(r);broadcast(r,snapshot(r));}}
 if(msg.type==='rules'&&r.phase==='lobby'&&r.players[0]===p){
  if(msg.mode==='points'&&Number.isInteger(Number(msg.targetPoints))&&Number(msg.targetPoints)>=1&&Number(msg.targetPoints)<=50){r.mode='points';r.targetPoints=Number(msg.targetPoints);}
  if(msg.mode==='timed'&&[2,5,10].includes(Number(msg.durationMinutes))){r.mode='timed';r.durationMinutes=Number(msg.durationMinutes);}
  broadcast(r,snapshot(r));
 }
 if(msg.type==='camera'){p.cameraReady=!!msg.ready&&!p.bot;p.tracking=p.cameraReady;if(!p.cameraReady)p.ready=false;
  if(r.phase==='countdown'&&!r.players.every(q=>q.bot||q.cameraReady)){r.phase='lobby';r.countdownAt=0;r.players.forEach(q=>q.ready=false);broadcast(r,{type:'error',message:'Countdown cancelled: someone lost camera tracking.'});}
  broadcast(r,snapshot(r));
 }
 if(msg.type==='bots'&&r.phase==='lobby'&&r.players[0]===p){
  if(msg.action==='fill'){for(let team=0;team<2;team++){while(r.players.filter(q=>q.team===team).length<r.size)addBot(r,team);}}
  else if(msg.action==='clear'){removeBots(r);}
  broadcast(r,snapshot(r));
 }
 if(msg.type==='settings'&&r.players[0]===p&&['lobby','playing'].includes(r.phase)){
  const key=msg.key,value=Number(msg.value);
  if((key==='ballSpeed'||key==='headSpeed')&&Number.isFinite(value)){
   const next=Math.round(Math.max(0.5,Math.min(1.8,value))*10)/10;
   if(key==='ballSpeed'&&r.phase==='playing'&&r.ball.vx!==0){const ratio=next/r.ballSpeed;r.ball.vx*=ratio;r.ball.vy*=ratio;}
   r[key]=next;broadcast(r,snapshot(r));
  }
 }
 if(msg.type==='team'&&r.phase==='lobby'){const dest=Number(msg.team);if((dest===0||dest===1)&&r.players.filter(q=>q.team===dest).length<r.size){p.team=dest;rearrange(r);broadcast(r,snapshot(r));}}
 if(msg.type==='ready'&&r.phase==='lobby'){if(msg.ready&&!p.cameraReady){send(socket,JSON.stringify({type:'error',message:'Enable your camera and wait for face tracking before pressing Ready.'}));}else{p.ready=!!msg.ready;broadcast(r,snapshot(r));}}
 if(msg.type==='start'&&r.players[0]===p&&r.phase==='lobby'){const a=r.players.filter(p=>p.team===0).length,b=r.players.filter(p=>p.team===1).length;if(a!==r.size||b!==r.size){send(socket,JSON.stringify({type:'error',message:`Need ${r.size} players on each team to start.`}));}else if(!r.players.every(p=>p.ready)){send(socket,JSON.stringify({type:'error',message:'Everyone must press Ready.'}));}else if(!r.players.every(p=>p.bot||p.cameraReady)){send(socket,JSON.stringify({type:'error',message:'Every human player must enable their camera and have face tracking active.'}));}else{r.phase='countdown';r.countdownAt=Date.now()+4000;r.matchEndsAt=0;r.score=[0,0];r.gameOver=false;r.round=0;resetBall(r);broadcast(r,snapshot(r));}}
 if(msg.type==='rematch'&&r.players[0]===p&&r.phase==='finished'){r.phase='lobby';r.score=[0,0];r.players.forEach(p=>p.ready=false);broadcast(r,snapshot(r));}
 if(msg.type==='face'&&typeof msg.image==='string'&&msg.image.length<35000&&/^data:image\/jpeg;base64,/.test(msg.image)){broadcast(r,{type:'face',id:p.id,image:msg.image});}
 if(msg.type==='move'&&['playing','countdown'].includes(r.phase)){const now=Date.now(),dt=Math.max(.02,Math.min(.2,(now-p.lastMove)/1000));const z=zone(r,p);const targetX=z.minX+(Math.max(0,Math.min(1,Number(msg.x)||0)))*(z.maxX-z.minX);const targetY=z.minY+(Math.max(0,Math.min(1,Number(msg.y)||0)))*(z.maxY-z.minY);const maxStep=2600*r.headSpeed*dt;const dx=Math.max(-maxStep,Math.min(maxStep,targetX-p.x)),dy=Math.max(-maxStep,Math.min(maxStep,targetY-p.y));p.vx=dx/dt;p.vy=dy/dt;p.x+=dx;p.y+=dy;p.lastMove=now;p.tracking=!!msg.tracking;}
 return old;
}
function leave(socket,session){if(!session)return;const r=rooms.get(session.room);if(!r)return;r.players=r.players.filter(p=>p.id!==session.player);if(!r.players.length){rooms.delete(r.id);musicFiles.delete(r.id);return;}if(['playing','countdown'].includes(r.phase)){r.phase='lobby';r.countdownAt=0;r.players.forEach(p=>p.ready=false);resetBall(r);}rearrange(r);broadcast(r,snapshot(r));}
function resetBall(r){r.ball={x:WIDTH/2,y:HEIGHT/2,vx:0,vy:0};r.lastHit=null;r.serveAt=Date.now()+1400;r.round++;}
function tick(r,dt){const now=Date.now();
 if(r.phase==='countdown'){if(!r.players.every(p=>p.bot||p.cameraReady)){r.phase='lobby';r.countdownAt=0;return;}if(now>=r.countdownAt){r.phase='playing';r.matchEndsAt=r.mode==='timed'?now+r.durationMinutes*60000:0;r.serveAt=now+450;}else return;}
 if(r.phase!=='playing')return;
 if(r.mode==='timed'&&r.matchEndsAt&&now>=r.matchEndsAt){r.phase='finished';r.gameOver=true;r.ball.vx=0;r.ball.vy=0;return;}
updateBots(r,dt);for(const p of r.players){if(now-p.lastMove>110){p.vx=0;p.vy=0;}}const b=r.ball;if(r.serveAt){if(Date.now()<r.serveAt)return;r.serveAt=0;const dir=Math.random()<.5?-1:1;b.vy=dir*310*r.ballSpeed;b.vx=(Math.random()-.5)*270*r.ballSpeed;}
 const substeps=3,step=dt/substeps,pr=playerRadius(r);for(let n=0;n<substeps;n++){
 b.x+=b.vx*step;b.y+=b.vy*step;
 // Left/right are solid side walls; top/bottom are the scoring goal lines.
 if(b.x<RADIUS){b.x=RADIUS;b.vx=Math.abs(b.vx);}if(b.x>WIDTH-RADIUS){b.x=WIDTH-RADIUS;b.vx=-Math.abs(b.vx);}
 // Once the ball has moved clear of the most recent hitter, let that face hit again.
 if(r.lastHit){const hitter=r.players.find(p=>p.id===r.lastHit);if(!hitter||Math.hypot(b.x-hitter.x,b.y-hitter.y)>pr+RADIUS+4)r.lastHit=null;}
 for(const p of r.players){const dist=Math.hypot(b.x-p.x,b.y-p.y),minDist=pr+RADIUS;if(dist>=minDist||dist<.01||r.lastHit===p.id)continue;
 const nx=(b.x-p.x)/dist,ny=(b.y-p.y)/dist,relative=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny;if(relative>=0)continue;
 b.x=p.x+nx*(minDist+.8);b.y=p.y+ny*(minDist+.8);
 const incoming=Math.hypot(b.vx,b.vy);const swing=Math.max(0,p.vx*nx+p.vy*ny);const speed=Math.min(1150*r.ballSpeed,Math.max(220*r.ballSpeed,incoming*.9+swing*.48*r.ballSpeed+70*r.ballSpeed));
 const impulseX=nx*speed+p.vx*.12,impulseY=ny*speed+p.vy*.12;const magnitude=Math.hypot(impulseX,impulseY)||1;b.vx=impulseX/magnitude*speed;b.vy=impulseY/magnitude*speed;
 // Return shots toward opponent more consistently; still permits angled teammate passes.
 if(p.team===0&&b.vy>-85)b.vy=-Math.max(85,Math.abs(b.vy)*.6);
 if(p.team===1&&b.vy<85)b.vy=Math.max(85,Math.abs(b.vy)*.6);
 r.lastHit=p.id;break;
 }
 // Only concede when the *entire ball* crosses the end goal line behind a team.
 // Top goal (behind team 1) -> team 0 scores; bottom goal -> team 1 scores.
 if(b.y+RADIUS<0 || b.y-RADIUS>HEIGHT){const scoring=b.y+RADIUS<0?0:1;r.score[scoring]++;if(r.mode==='points'&&r.score[scoring]>=r.targetPoints){r.phase='finished';r.gameOver=true;r.ball.vx=0;r.ball.vy=0;}else resetBall(r);break;}
 }
}
const server=http.createServer((req,res)=>{let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}if(p.startsWith('/api/room-music/')){if(req.method==='GET'||req.method==='HEAD')musicResponse(req,res,p);else res.writeHead(405).end();return;}if(p==='/api/upload-music'){if(req.method==='POST')uploadMusic(req,res,new URL(req.url,'http://localhost'));else res.writeHead(405).end();return;}if(p==='/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,rooms:rooms.size}));return;}if(p==='/config'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({origin:ORIGIN}));return;}p=path.normalize(p).replace(/^([/\\]*\.\.[/\\])+/, '');if(p==='/'||!path.extname(p))p='/index.html';const full=path.resolve(ROOT,'.'+p);if(!full.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}fs.readFile(full,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache'}).end(data);});});
server.on('upgrade',(req,socket)=>{if(new URL(req.url,'http://localhost').pathname==='/ws')upgrade(req,socket);else socket.destroy();});
setInterval(()=>{for(const r of rooms.values()){tick(r,.05);if(r.phase==='playing'||r.phase==='finished'||r.phase==='countdown')broadcast(r,snapshot(r));}},50);
setInterval(()=>{for(const [id,r] of rooms)if(!r.players.length||Date.now()-r.created>1000*60*60*12){rooms.delete(id);musicFiles.delete(id);}},60000);
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`FACE PONG listening on http://localhost:${PORT}`));
module.exports={server,rooms,zone,playerRadius,makeRoom,tick,addBot,removeBots,updateBots,playerSummary};
