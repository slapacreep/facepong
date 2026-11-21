const assert=require('node:assert/strict');
const {server,makeRoom,zone,playerRadius,tick}=require('./server');
for(let n=1;n<=6;n++){const room=makeRoom('ABCDEF');room.size=n;for(let i=0;i<n;i++){const p={team:0,slot:i};const z=zone(room,p);assert(z.minY<z.maxY);assert(z.minX<z.maxX);assert(z.minY>=0);assert(z.maxY<=650);}assert(playerRadius(room)>0);assert(playerRadius(room)<=43);}
const adjustable=makeRoom('SPEED');assert.equal(adjustable.ballSpeed,1);assert.equal(adjustable.headSpeed,1);
const duel=makeRoom('ABCDEF');duel.size=1;assert(playerRadius(duel)>playerRadius(makeRoom('ABCDEF')));const duelZone=zone(duel,{team:0,slot:0});assert(duelZone.maxY-duelZone.minY>500);
const r=makeRoom('ABCDEF');r.phase='playing';r.serveAt=0;r.ball={x:1001,y:325,vx:350,vy:0};tick(r,.05);assert.equal(r.score[0],1);assert.equal(r.round,1);
const fast=makeRoom('FASTS');fast.phase='playing';fast.ballSpeed=1.5;fast.serveAt=Date.now()+10000;tick(fast,.05);assert.equal(fast.ball.vx,0);fast.serveAt=Date.now()-1;tick(fast,.05);assert.equal(Math.abs(fast.ball.vx),465);
const t=makeRoom('ABCDEF');t.phase='playing';t.score=[6,0];t.serveAt=0;t.ball={x:1001,y:325,vx:350,vy:0};tick(t,.05);assert.equal(t.phase,'finished');
// A side-wall (top/bottom) hit must rebound, never score.
for(const [y,vy,expectedSign] of [[9,-400,1],[641,400,-1]]){
 const wall=makeRoom('WALLS');wall.phase='playing';wall.serveAt=0;wall.ball={x:500,y,vx:200,vy};
 tick(wall,.05);assert.deepEqual(wall.score,[0,0]);
 assert.equal(Math.sign(wall.ball.vy),expectedSign);
 assert.equal(wall.phase,'playing');
}
// A ball still touching the left/right goal line is not a conceded point.
for(const [x,vx] of [[-6,-30],[1006,30]]){
 const edge=makeRoom('EDGES');edge.phase='playing';edge.serveAt=0;edge.ball={x,y:325,vx,vy:0};
 tick(edge,.05);assert.deepEqual(edge.score,[0,0]);
}
// Once it completely passes the left goal line, the right team gets a point.
const left=makeRoom('LEFTS');left.phase='playing';left.serveAt=0;left.ball={x:-9,y:325,vx:-350,vy:0};tick(left,.05);assert.deepEqual(left.score,[0,1]);
server.listen(0,'127.0.0.1',async()=>{const port=server.address().port;const res=await fetch(`http://127.0.0.1:${port}/health`);assert.equal(res.status,200);const home=await fetch(`http://127.0.0.1:${port}/`);assert.equal(home.status,200);const html=await home.text();assert(html.includes('YOUR FACE'));assert(html.includes('gameBallSpeed'));assert(html.includes('gameHeadSpeed'));console.log('All smoke tests passed.');server.close(()=>process.exit(0));});
