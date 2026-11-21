'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const ORIGIN = process.env.PUBLIC_ORIGIN || '';
const rooms = new Map();
const WIDTH=1000, HEIGHT=650, RADIUS=8, TICK=1000/30;
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
function makeRoom(id){return {id,players:[],size:2,ballSpeed:1,headSpeed:1,phase:'lobby',score:[0,0],ball:{x:WIDTH/2,y:HEIGHT/2,vx:0,vy:0},lastHit:null,serveAt:0,round:0,gameOver:false,created:Date.now()};}
function safeRoom(id){return typeof id==='string'&&/^[A-Z2-9]{5,7}$/.test(id);}
function playerSummary(p){return {id:p.id,name:p.name,team:p.team,slot:p.slot,x:p.x,y:p.y,ready:p.ready,tracking:p.tracking};}
function snapshot(r){return {type:'state',room:r.id,phase:r.phase,size:r.size,ballSpeed:r.ballSpeed,headSpeed:r.headSpeed,players:r.players.map(playerSummary),score:r.score,ball:r.ball,round:r.round,lastHit:r.lastHit,gameOver:r.gameOver};}
function rearrange(r){for(let team=0;team<2;team++){const players=r.players.filter(p=>p.team===team);players.forEach((p,i)=>{p.slot=i;const range=zone(r,p);p.x=Math.max(range.minX,Math.min(range.maxX,p.x??(range.minX+range.maxX)/2));p.y=(range.minY+range.maxY)/2;});}}
function zone(r,p){const n=r.size,slot=Math.min(p.slot,n-1),g=HEIGHT/n;return {minX:p.team===0?38:WIDTH/2+38,maxX:p.team===0?WIDTH/2-38:WIDTH-38,minY:slot*g+24,maxY:(slot+1)*g-24};}
function playerRadius(r){return Math.max(14,Math.min(43,65/r.size));}
function chooseTeam(r){const c=[r.players.filter(p=>p.team===0).length,r.players.filter(p=>p.team===1).length];return c[0]<=c[1]?0:1;}
function onMessage(socket,old,msg){if(!msg||typeof msg.type!=='string')return old;
 if(msg.type==='join'){if(old)return old;const id=String(msg.room||'').toUpperCase();if(!safeRoom(id)){send(socket,JSON.stringify({type:'error',message:'Invalid room code'}));return null;}let r=rooms.get(id);if(!r){r=makeRoom(id);rooms.set(id,r);}if(r.phase!=='lobby'){send(socket,JSON.stringify({type:'error',message:'Match already started. Join after the rematch.'}));return null;}if(r.players.length>=r.size*2){send(socket,JSON.stringify({type:'error',message:'Lobby is full'}));return null;}
 const name=String(msg.name||'Player').trim().slice(0,18).replace(/[<>]/g,'')||'Player';const p={id:crypto.randomUUID(),name,team:chooseTeam(r),slot:0,x:null,y:null,ready:false,tracking:false,socket,lastX:0,lastY:0,vx:0,vy:0,lastMove:Date.now()};r.players.push(p);rearrange(r);send(socket,JSON.stringify({type:'welcome',id:p.id,room:id}));broadcast(r,snapshot(r));return {room:id,player:p.id};}
 if(!old)return old;const r=rooms.get(old.room),p=r?.players.find(p=>p.id===old.player);if(!r||!p)return old;
 if(msg.type==='size'&&r.phase==='lobby'&&r.players[0]===p){const size=Number(msg.size);if(Number.isInteger(size)&&size>=1&&size<=6&&r.players.length<=size*2){r.size=size;rearrange(r);broadcast(r,snapshot(r));}}
 if(msg.type==='settings'&&r.players[0]===p&&['lobby','playing'].includes(r.phase)){
  const key=msg.key,value=Number(msg.value);
  if((key==='ballSpeed'||key==='headSpeed')&&Number.isFinite(value)){
   const next=Math.round(Math.max(0.5,Math.min(1.8,value))*10)/10;
   if(key==='ballSpeed'&&r.phase==='playing'&&r.ball.vx!==0){const ratio=next/r.ballSpeed;r.ball.vx*=ratio;r.ball.vy*=ratio;}
   r[key]=next;broadcast(r,snapshot(r));
  }
 }
 if(msg.type==='team'&&r.phase==='lobby'){const dest=Number(msg.team);if((dest===0||dest===1)&&r.players.filter(q=>q.team===dest).length<r.size){p.team=dest;rearrange(r);broadcast(r,snapshot(r));}}
 if(msg.type==='ready'&&r.phase==='lobby'){p.ready=!!msg.ready;broadcast(r,snapshot(r));}
 if(msg.type==='start'&&r.players[0]===p&&r.phase==='lobby'){const a=r.players.filter(p=>p.team===0).length,b=r.players.filter(p=>p.team===1).length;if(a!==r.size||b!==r.size){send(socket,JSON.stringify({type:'error',message:`Need ${r.size} players on each team to start.`}));}else if(!r.players.every(p=>p.ready)){send(socket,JSON.stringify({type:'error',message:'Everyone must press Ready.'}));}else{r.phase='playing';r.score=[0,0];r.gameOver=false;r.round=0;resetBall(r);broadcast(r,snapshot(r));}}
 if(msg.type==='rematch'&&r.players[0]===p&&r.phase==='finished'){r.phase='lobby';r.score=[0,0];r.players.forEach(p=>p.ready=false);broadcast(r,snapshot(r));}
 if(msg.type==='face'&&typeof msg.image==='string'&&msg.image.length<35000&&/^data:image\/jpeg;base64,/.test(msg.image)){broadcast(r,{type:'face',id:p.id,image:msg.image});}
 if(msg.type==='move'&&r.phase==='playing'){const now=Date.now(),dt=Math.max(.02,Math.min(.2,(now-p.lastMove)/1000));const z=zone(r,p);const targetX=z.minX+(Math.max(0,Math.min(1,Number(msg.x)||0)))*(z.maxX-z.minX);const targetY=z.minY+(Math.max(0,Math.min(1,Number(msg.y)||0)))*(z.maxY-z.minY);const maxStep=2600*r.headSpeed*dt;const dx=Math.max(-maxStep,Math.min(maxStep,targetX-p.x)),dy=Math.max(-maxStep,Math.min(maxStep,targetY-p.y));p.vx=dx/dt;p.vy=dy/dt;p.x+=dx;p.y+=dy;p.lastMove=now;p.tracking=!!msg.tracking;}
 return old;
}
function leave(socket,session){if(!session)return;const r=rooms.get(session.room);if(!r)return;r.players=r.players.filter(p=>p.id!==session.player);if(!r.players.length){rooms.delete(r.id);return;}if(r.phase==='playing'){r.phase='lobby';r.players.forEach(p=>p.ready=false);resetBall(r);}rearrange(r);broadcast(r,snapshot(r));}
function resetBall(r){r.ball={x:WIDTH/2,y:HEIGHT/2,vx:0,vy:0};r.lastHit=null;r.serveAt=Date.now()+1400;r.round++;}
function tick(r,dt){if(r.phase!=='playing')return;const b=r.ball;if(r.serveAt){if(Date.now()<r.serveAt)return;r.serveAt=0;const dir=Math.random()<.5?-1:1;b.vx=dir*310*r.ballSpeed;b.vy=(Math.random()-.5)*270*r.ballSpeed;}
 const substeps=3,step=dt/substeps,pr=playerRadius(r);for(let n=0;n<substeps;n++){
 b.x+=b.vx*step;b.y+=b.vy*step;
 // Top and bottom are solid rebound walls: touching either never awards points.
 if(b.y<RADIUS){b.y=RADIUS;b.vy=Math.abs(b.vy);}if(b.y>HEIGHT-RADIUS){b.y=HEIGHT-RADIUS;b.vy=-Math.abs(b.vy);}
 // Once the ball has moved clear of the most recent hitter, let that face hit again.
 if(r.lastHit){const hitter=r.players.find(p=>p.id===r.lastHit);if(!hitter||Math.hypot(b.x-hitter.x,b.y-hitter.y)>pr+RADIUS+4)r.lastHit=null;}
 for(const p of r.players){const dist=Math.hypot(b.x-p.x,b.y-p.y),minDist=pr+RADIUS;if(dist>=minDist||dist<.01||r.lastHit===p.id)continue;
 const nx=(b.x-p.x)/dist,ny=(b.y-p.y)/dist,relative=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny;if(relative>=0)continue;
 b.x=p.x+nx*(minDist+.8);b.y=p.y+ny*(minDist+.8);
 const incoming=Math.hypot(b.vx,b.vy);const swing=Math.max(0,p.vx*nx+p.vy*ny);const speed=Math.min(1150*r.ballSpeed,Math.max(220*r.ballSpeed,incoming*.9+swing*.48*r.ballSpeed+70*r.ballSpeed));
 const impulseX=nx*speed+p.vx*.12,impulseY=ny*speed+p.vy*.12;const magnitude=Math.hypot(impulseX,impulseY)||1;b.vx=impulseX/magnitude*speed;b.vy=impulseY/magnitude*speed;
 // Return shots toward opponent more consistently; still permits angled teammate passes.
 if(p.team===0&&b.vx<85)b.vx=Math.max(85,Math.abs(b.vx)*.6);
 if(p.team===1&&b.vx>-85)b.vx=-Math.max(85,Math.abs(b.vx)*.6);
 r.lastHit=p.id;break;
 }
 // Only concede when the *entire ball* crosses the end goal line behind a team.
 // Left goal -> right team scores; right goal -> left team scores.
 if(b.x+RADIUS<0 || b.x-RADIUS>WIDTH){const scoring=b.x+RADIUS<0?1:0;r.score[scoring]++;if(r.score[scoring]>=7){r.phase='finished';r.gameOver=true;r.ball.vx=0;r.ball.vy=0;}else resetBall(r);break;}
 }
}
const server=http.createServer((req,res)=>{let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}if(p==='/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,rooms:rooms.size}));return;}if(p==='/config'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({origin:ORIGIN}));return;}p=path.normalize(p).replace(/^([/\\]*\.\.[/\\])+/, '');if(p==='/'||!path.extname(p))p='/index.html';const full=path.resolve(ROOT,'.'+p);if(!full.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}fs.readFile(full,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache'}).end(data);});});
server.on('upgrade',(req,socket)=>{if(new URL(req.url,'http://localhost').pathname==='/ws')upgrade(req,socket);else socket.destroy();});
setInterval(()=>{for(const r of rooms.values()){tick(r,.05);if(r.phase==='playing'||r.phase==='finished')broadcast(r,snapshot(r));}},50);
setInterval(()=>{for(const [id,r] of rooms)if(!r.players.length||Date.now()-r.created>1000*60*60*12)rooms.delete(id);},60000);
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`FACE PONG listening on http://localhost:${PORT}`));
module.exports={server,rooms,zone,playerRadius,makeRoom,tick};
