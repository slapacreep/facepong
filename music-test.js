const assert=require('node:assert/strict');const {server,rooms,makeRoom}=require('./server');
(async()=>{const r=makeRoom('MUSIC2');r.players.push({id:'test-host',name:'DJ',team:0,ready:false});rooms.set(r.id,r);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const root='http://127.0.0.1:'+server.address().port;
try{let res=await fetch(root+'/api/upload-music?room=MUSIC2',{method:'POST',headers:{'Content-Type':'audio/mpeg','X-Facepong-Player-Id':'not-host','Content-Length':'256'},body:Buffer.alloc(256)});assert.equal(res.status,403);
res=await fetch(root+'/api/upload-music?room=MUSIC2',{method:'POST',headers:{'Content-Type':'audio/mpeg','X-Facepong-Player-Id':'test-host','X-Facepong-Filename':'test.mp3'},body:Buffer.alloc(4096,3)});assert.equal(res.status,201);assert.equal(r.music.type,'upload');
res=await fetch(root+r.music.url,{headers:{Range:'bytes=128-255'}});assert.equal(res.status,206);assert.equal((await res.arrayBuffer()).byteLength,128);assert.equal(res.headers.get('content-type'),'audio/mpeg');
res=await fetch(root+r.music.url);assert.equal(res.status,200);assert.equal((await res.arrayBuffer()).byteLength,4096);console.log('Music upload, access control, and byte-range tests passed.');}
finally{server.close();process.exit(0);}})().catch(e=>{console.error(e);process.exitCode=1;});
