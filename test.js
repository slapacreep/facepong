const assert=require('node:assert/strict');
const {server,makeRoom,zone,playerRadius,tick,addBot,removeBots,updateBots,playerSummary}=require('./server');
for(let n=1;n<=6;n++){
 const room=makeRoom('ABCDEF');room.size=n;
 for(let team=0;team<2;team++)for(let i=0;i<n;i++){
  const z=zone(room,{team,slot:i});assert(z.minX<z.maxX&&z.minY<z.maxY);
  assert(z.minX>=0&&z.maxX<=650&&z.maxY<=1000);
  assert(team===0?z.minY>500:z.maxY<500);
 }
 assert(playerRadius(room)>0&&playerRadius(room)<=52);
}
// 1v1 faces are exactly 20% bigger than the earlier 43px cap.
const solo=makeRoom('SOLO1');solo.size=1;assert.equal(playerRadius(solo),51.6);
for(let size=1;size<=6;size++){
 const bots=makeRoom('BOTS1');bots.size=size;
 for(let team=0;team<2;team++)for(let i=0;i<size;i++)assert(addBot(bots,team));
 assert.equal(bots.players.length,size*2);
 assert(bots.players.every(p=>p.bot&&p.ready&&playerSummary(p).bot));
 assert.equal(addBot(bots,0),false);
 bots.phase='playing';bots.serveAt=Date.now()+99999;const before=bots.players.map(p=>[p.x,p.y]);tick(bots,.05);
 assert(bots.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 bots.phase='lobby';removeBots(bots);assert.equal(bots.players.length,0);
}
const adjustable=makeRoom('SPEED');assert.equal(adjustable.ballSpeed,1);assert.equal(adjustable.headSpeed,1);
const duel=makeRoom('DUELS');duel.size=1;assert(playerRadius(duel)>playerRadius(makeRoom('ABCDEF')));
const duelZone=zone(duel,{team:0,slot:0});assert(duelZone.maxX-duelZone.minX>500);
// Top goal belongs to team 1 -> team 0 scores.
const r=makeRoom('ABCDEF');r.phase='playing';r.serveAt=0;r.ball={x:325,y:-11,vx:0,vy:-350};tick(r,.05);assert.equal(r.score[0],1);assert.equal(r.round,1);
const fast=makeRoom('FASTS');fast.phase='playing';fast.ballSpeed=1.5;fast.serveAt=Date.now()+10000;tick(fast,.05);assert.equal(fast.ball.vy,0);fast.serveAt=Date.now()-1;tick(fast,.05);assert.equal(Math.abs(fast.ball.vy),465);
const t=makeRoom('FINSH');t.phase='playing';t.score=[6,0];t.serveAt=0;t.ball={x:325,y:-11,vx:0,vy:-350};tick(t,.05);assert.equal(t.phase,'finished');
// Portrait sidewalls (left/right) rebound, never score.
for(const [x,vx,expectedSign] of [[9,-400,1],[641,400,-1]]){
 const wall=makeRoom('WALLS');wall.phase='playing';wall.serveAt=0;wall.ball={x,y:500,vx,vy:200};tick(wall,.05);
 assert.deepEqual(wall.score,[0,0]);assert.equal(Math.sign(wall.ball.vx),expectedSign);
}
// Ball must be entirely past top/bottom line to score.
for(const [y,vy] of [[-6,-30],[1006,30]]){
 const edge=makeRoom('EDGES');edge.phase='playing';edge.serveAt=0;edge.ball={x:325,y,vx:0,vy};tick(edge,.05);assert.deepEqual(edge.score,[0,0]);
}
const bottom=makeRoom('BOTTOM');bottom.phase='playing';bottom.serveAt=0;bottom.ball={x:325,y:1011,vx:0,vy:350};tick(bottom,.05);assert.deepEqual(bottom.score,[0,1]);
server.listen(0,'127.0.0.1',async()=>{const port=server.address().port;const res=await fetch(`http://127.0.0.1:${port}/health`);assert.equal(res.status,200);const home=await fetch(`http://127.0.0.1:${port}/`);assert.equal(home.status,200);const html=await home.text();assert(html.includes('YOUR FACE'));assert(html.includes('gameBallSpeed'));assert(html.includes('gameHeadSpeed'));console.log('All smoke tests passed.');server.close(()=>process.exit(0));});
