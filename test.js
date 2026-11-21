const assert=require('node:assert/strict');
const {server,makeRoom,zone,playerRadius,tick}=require('./server');
for(let n=2;n<=6;n++){const room=makeRoom('ABCDEF');room.size=n;for(let i=0;i<n;i++){const p={team:0,slot:i};const z=zone(room,p);assert(z.minY<z.maxY);assert(z.minX<z.maxX);assert(z.minY>=0);assert(z.maxY<=650);}assert(playerRadius(room)>0);}
const r=makeRoom('ABCDEF');r.phase='playing';r.serveAt=0;r.ball={x:1001,y:325,vx:350,vy:0};tick(r,.05);assert.equal(r.score[0],1);assert.equal(r.round,1);
const t=makeRoom('ABCDEF');t.phase='playing';t.score=[6,0];t.serveAt=0;t.ball={x:1001,y:325,vx:350,vy:0};tick(t,.05);assert.equal(t.phase,'finished');
server.listen(0,'127.0.0.1',async()=>{const port=server.address().port;const res=await fetch(`http://127.0.0.1:${port}/health`);assert.equal(res.status,200);const home=await fetch(`http://127.0.0.1:${port}/`);assert.equal(home.status,200);assert((await home.text()).includes('YOUR FACE'));console.log('All smoke tests passed.');server.close(()=>process.exit(0));});
