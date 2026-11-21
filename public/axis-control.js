/* Four-direction face control. Only one coordinate can change per sample. */
(function(root){
  function clamp(v){return Math.max(0,Math.min(1,v));}
  function update(prevX,prevY,targetX,targetY,prevAxis='none',options={}){
    const dead=options.deadZone??0.012;
    const hysteresis=options.hysteresis??1.18;
    const dx=clamp(targetX)-prevX, dy=clamp(targetY)-prevY;
    const ax=Math.abs(dx), ay=Math.abs(dy);
    if(ax<dead&&ay<dead) return {x:prevX,y:prevY,axis:'none'};
    let axis;
    if(ax<dead) axis='y';
    else if(ay<dead) axis='x';
    else if(prevAxis==='x' && ax>=ay/hysteresis) axis='x';
    else if(prevAxis==='y' && ay>=ax/hysteresis) axis='y';
    else axis=ax>=ay?'x':'y';
    // No diagonal motion, including on frames where direction switches.
    return axis==='x'?{x:clamp(targetX),y:prevY,axis}:{x:prevX,y:clamp(targetY),axis};
  }
  const api={update};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.BallfaceAxis=api;
})(typeof globalThis!=='undefined'?globalThis:this);
