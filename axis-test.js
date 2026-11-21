const assert=require('node:assert/strict');const {update}=require('./public/axis-control');
let p=update(.5,.5,.8,.7);assert.equal(p.y,.5);assert.equal(p.x,.8);assert.equal(p.axis,'x');
p=update(p.x,p.y,.8,.7,p.axis);assert.equal(p.x,.8);assert.equal(p.y,.7);assert.equal(p.axis,'y');
p=update(.5,.5,.501,.499);assert.deepEqual(p,{x:.5,y:.5,axis:'none'});
p=update(.5,.5,.2,.1);assert.equal(p.x,.5);assert.equal(p.y,.1);
for(let i=0;i<50;i++){let x=Math.random(),y=Math.random(),z=update(.5,.5,x,y);assert.ok(z.x===.5||z.y===.5);}
console.log('Four-direction axis-control tests passed.');
