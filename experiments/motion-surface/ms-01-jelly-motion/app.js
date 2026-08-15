(() => {
'use strict';
globalThis.__JELLY_BUILD='V44.1-R22.1-NO-PLAY';
const canvas=document.querySelector('#scene'), overlay=document.querySelector('#overlay'), stage=document.querySelector('#stage'), percentageEl=document.querySelector('#percentage'), percentageNumberEl=document.querySelector('#percentageNumber'), percentageSignEl=document.querySelector('#percentageSign'), paletteToggle=document.querySelector('#paletteToggle'), palettePanel=document.querySelector('#palettePanel'), swatchesEl=document.querySelector('#swatches'), customColorEl=document.querySelector('#customColor'), autoColorEl=document.querySelector('#autoColor');
const octx=overlay.getContext('2d');
const hud=document.querySelector('#hud'),hudMode=document.querySelector('#hudMode'),hudTime=document.querySelector('#hudTime'),hudValue=document.querySelector('#hudValue');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false});
if(!gl){document.body.innerHTML='<pre style="color:white">WebGL2 required</pre>';throw new Error('WebGL2 required')}
const floatExt=gl.getExtension('EXT_color_buffer_float');
const linearFloat=gl.getExtension('OES_texture_float_linear');
const W=canvas.width,H=canvas.height,DISPLAY_W=overlay.width,DISPLAY_H=overlay.height,DURATION=29.5,N=17,SEG=N-1;
const BBOX={left:-1.019,right:1.09,bottom:-0.3,top:0.65};
const LINE_RADIUS=.024,LINE_HALF=.17; // official TypeGPU geometry constants
const FIXED_DT=1/60;
const PHYS_REF=Object.assign({damping:.01,bendingStrength:.1,archStrength:0,bendingExponent:1.2,endFlatCount:1,endFlatStiffness:.05,archEdgeDeadzone:.01,iterations:16,substeps:6},globalThis.__JELLY_PHYS_TUNE||{});
const TUNE=Object.assign({orangeHueOffset:-1,orangeValue:.62,orangeSat:.94,blueValue:.79,blueSat:.98,lightX:.19,lightY:-.24,lightZ:.75,darkLightX:-.5,darkLightY:-.14,darkLightZ:-.8,density:20,absorbScale:.08,scatterStrength:3,progressScale:1,progressBias:0,bounceScale:.85,sideScale:.5,lightExposure:1.11,darkExposure:.80,slotLift:.085,jellyDarkGain:1.145},globalThis.__JELLY_TUNE||{});
const qs=new URLSearchParams(location.search), injected=Number.isFinite(globalThis.__STATIC_TIME)?Number(globalThis.__STATIC_TIME):null;
const staticTime=injected!==null?clamp(injected,0,DURATION):(qs.has('t')?clamp(Number(qs.get('t'))||0,0,DURATION):null);
let mode=qs.get('mode')==='interactive'?'interactive':'reference',debug=qs.get('debug')==='1',paused=staticTime!==null,t=staticTime??0,last=performance.now(),accum=0,pointerDown=false;
if(debug)hud.hidden=false;

const COLOR_PRESETS=[
  ['Source Orange','#f47828'],['Coral','#ff5b45'],['Gold','#f5b82e'],['Emerald','#22b879'],
  ['Cyan','#28b9d6'],['Source Blue','#2f6fd6'],['Violet','#7354de'],['Magenta','#d94f9f']
];
const DEFAULT_JELLY_COLOR='#f47828';
let colorMode='custom', colorOverride=hexToRgb01(DEFAULT_JELLY_COLOR);
function hexToRgb01(hex){const m=/^#?([0-9a-f]{6})$/i.exec(hex);if(!m)return[.18,.43,.84];const n=parseInt(m[1],16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]}
function chooseColor(hex,button=null){taaFrame=0;colorMode='custom';colorOverride=hexToRgb01(hex);customColorEl.value=hex;for(const b of swatchesEl.querySelectorAll('.swatch'))b.setAttribute('aria-pressed',String(b===button));autoColorEl.setAttribute('aria-pressed','false')}
for(const [name,hex] of COLOR_PRESETS){const b=document.createElement('button');b.type='button';b.className='swatch';b.title=name;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(hex.toLowerCase()===DEFAULT_JELLY_COLOR));b.style.background=hex;b.addEventListener('click',()=>chooseColor(hex,b));swatchesEl.appendChild(b)}
customColorEl.value=DEFAULT_JELLY_COLOR;
palettePanel.hidden=false;paletteToggle.setAttribute('aria-expanded','true');
paletteToggle.addEventListener('click',e=>{e.stopPropagation();palettePanel.hidden=!palettePanel.hidden;paletteToggle.setAttribute('aria-expanded',String(!palettePanel.hidden))});
paletteToggle.addEventListener('pointerdown',e=>e.stopPropagation());palettePanel.addEventListener('pointerdown',e=>e.stopPropagation());
customColorEl.addEventListener('input',()=>chooseColor(customColorEl.value,null));
autoColorEl.setAttribute('aria-pressed','false');autoColorEl.addEventListener('click',()=>{taaFrame=0;colorMode='auto';colorOverride=null;autoColorEl.setAttribute('aria-pressed','true');for(const b of swatchesEl.querySelectorAll('.swatch'))b.setAttribute('aria-pressed','false')});


const REF=globalThis.__JELLY_REFERENCE_TRACK||{fps:60,duration:DURATION,frames:[]};
const REF_FPS=REF.fps||60;
function referenceFrame(time){
  const i=clamp(Math.round(time*REF_FPS),0,Math.max(0,REF.frames.length-1));
  const r=REF.frames[i]||[null,null,18,0];
  return {index:i,down:r[0]!==null,cursorX:r[0],cursorY:r[1],hue:r[2]??18,theme:r[3]??0};
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function smooth(x){x=clamp(x,0,1);return x*x*(3-2*x)}
function easeOutQuad(x){x=clamp(x,0,1);return 1-(1-x)*(1-x)}
function lerp(a,b,q){return a+(b-a)*q}
function sample(keys,time,easing=true){if(time<=keys[0][0])return keys[0].slice(1);for(let i=1;i<keys.length;i++){if(time<=keys[i][0]){const a=keys[i-1],b=keys[i];let q=(time-a[0])/(b[0]-a[0]);if(easing)q=smooth(q);return a.slice(1).map((v,j)=>lerp(v,b[j+1],q))}}return keys.at(-1).slice(1)}
function hsv2rgb(h,s,v){h=((h%360)+360)%360/60;const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c;let r=0,g=0,b=0;if(h<1){r=c;g=x}else if(h<2){r=x;g=c}else if(h<3){g=c;b=x}else if(h<4){g=x;b=c}else if(h<5){r=x;b=c}else{r=c;b=x}return[r+m,g+m,b+m]}
const REFERENCE_PERCENT_KEYS=[[0,100],[.25,94],[.5,68],[.75,44],[1,27],[1.25,20],[1.5,18],[1.75,20],[2,32],[2.25,53],[2.5,73],[2.75,83],[3,88],[3.25,71],[3.5,27],[3.75,8],[4,2],[4.25,1],[4.5,38],[4.75,56],[5,18],[5.5,77],[6,66],[6.5,37],[7,38],[8,38],[13.5,38],[14,54],[14.5,96],[18,96],[18.5,96],[19,69],[19.5,19],[20,2],[20.5,35],[21,86],[21.5,100],[21.75,86],[21.8,72],[22,38],[22.2,11],[22.25,10],[22.5,18],[22.7,93],[22.75,93],[23,100],[23.25,28],[23.5,8],[24,38],[24.5,53],[25,100],[25.5,100],[26,24],[26.5,2],[27,40],[27.5,71],[28,87],[28.5,99],[29,100],[29.5,100]];
function referencePercentAt(time){if(time<=REFERENCE_PERCENT_KEYS[0][0])return REFERENCE_PERCENT_KEYS[0][1];for(let i=1;i<REFERENCE_PERCENT_KEYS.length;i++){const a=REFERENCE_PERCENT_KEYS[i-1],b=REFERENCE_PERCENT_KEYS[i];if(time<=b[0])return lerp(a[1],b[1],clamp((time-a[0])/(b[0]-a[0]),0,1))}return REFERENCE_PERCENT_KEYS.at(-1)[1]}
function stateAt(time){const r=referenceFrame(time);return{value:referencePercentAt(time),hue:r.hue,theme:r.theme,colorDepth:smooth((time-8.0)/5.0),cursorX:r.cursorX,cursorY:r.cursorY,pointerDown:r.down,frame:r.index}}
function pointerXToTarget(clientX){const normalized=clientX/720,clamped=clamp(normalized,.45,.9);return ((clamped-.4)/.5)*1.7-.5}

class JellyPhysics{
 constructor(){this.iterations=16;this.substeps=6;this.damping=.01;this.bendingStrength=.1;this.archStrength=2;this.endFlatCount=1;this.endFlatStiffness=.05;this.bendingExponent=1.2;this.archEdgeDeadzone=.01;this.currentCompression=0;this.contactStrength=0;this.contactPairs=0;this.layerPressure=0;this.layerRelease=0;this.startX=-1;this.endX=.9;this.yOffset=-.03;this.totalLength=1.9;this.restLen=this.totalLength/(N-1);this.x=new Float32Array(N);this.y=new Float32Array(N);this.px=new Float32Array(N);this.py=new Float32Array(N);this.nx=new Float32Array(N);this.ny=new Float32Array(N);this.cx=new Float32Array(SEG);this.cy=new Float32Array(SEG);this.targetX=.9;this.reset()}
 reset(){for(let i=0;i<N;i++){const q=i/(N-1);this.x[i]=lerp(this.startX,this.endX,q);this.y[i]=this.yOffset;this.px[i]=this.x[i];this.py[i]=this.y[i];this.nx[i]=0;this.ny[i]=1}this.targetX=.9;this.computeDerived()}
 setTarget(x){this.targetX=clamp(x,this.startX-this.totalLength,this.startX+this.totalLength)}
 update(dt){if(dt<=0)return;const h=dt/this.substeps,damp=clamp(this.damping,0,.999),compression=Math.max(0,1-Math.abs(this.targetX-this.startX)/this.totalLength);this.currentCompression=compression;for(let s=0;s<this.substeps;s++){this.integrate(h,damp,compression);this.projectConstraints()}this.computeDerived()}
 integrate(h,damp,compression){for(let i=0;i<N;i++){const x=this.x[i],y=this.y[i];if(i===0){this.x[i]=this.startX;this.y[i]=this.yOffset;this.px[i]=this.startX;this.py[i]=this.yOffset;continue}if(i===N-1){this.x[i]=this.targetX;this.y[i]=.05;this.px[i]=this.targetX;this.py[i]=.05;continue}const vx=(x-this.px[i])*(1-damp),vy=(y-this.py[i])*(1-damp);let ay=0;if(compression>0){const q=i/(N-1),e=this.archEdgeDeadzone;const s1=q<=e?0:q>=1-e?1:smooth((q-e)/(1-2*e));const r=1-q;const s2=r<=e?0:r>=1-e?1:smooth((r-e)/(1-2*e));const profile=Math.sin(Math.PI*q)*s1*s2;ay=this.archStrength*profile*compression}this.px[i]=x;this.py[i]=y;this.x[i]=x+vx;this.y[i]=y+vy+ay*h*h;if(this.y[i]<this.yOffset)this.y[i]=this.yOffset}}
 projectDistance(i,j,rest,k){const dx=this.x[j]-this.x[i],dy=this.y[j]-this.y[i],len=Math.hypot(dx,dy);if(len<1e-8)return;const w1=(i===0||i===N-1)?0:1,w2=(j===0||j===N-1)?0:1,ws=w1+w2;if(ws<=0)return;const diff=(len-rest)/len,c1=w1/ws*k,c2=w2/ws*k;this.x[i]+=dx*diff*c1;this.y[i]+=dy*diff*c1;this.x[j]-=dx*diff*c2;this.y[j]-=dy*diff*c2}
 projectSelfContact(){
  if(this.contactStrength<=0||this.currentCompression<.12){this.contactPairs=0;return;}
  const lp=clamp(this.layerPressure,0,1),lr=clamp(this.layerRelease,0,1);
  const minSep=lerp(.112,.1065,lp),targetSep=lerp(.132,.1175,lp)*(1+.055*lr),attractRange=lerp(.202,.224,lp),attractK=lerp(.030,.071,lp)*(1-.42*lr);let pairs=0;
  for(let i=1;i<N-2;i++)for(let j=i+3;j<N-1;j++){
    const dx=this.x[j]-this.x[i],dy=this.y[j]-this.y[i],d=Math.hypot(dx,dy);if(d<1e-6)continue;
    const elevated=(this.y[i]>this.yOffset+.012||this.y[j]>this.yOffset+.012);if(!elevated)continue;
    const im=Math.max(0,i-1),ip=Math.min(N-1,i+1),jm=Math.max(0,j-1),jp=Math.min(N-1,j+1);
    let itx=this.x[ip]-this.x[im],ity=this.y[ip]-this.y[im],jtx=this.x[jp]-this.x[jm],jty=this.y[jp]-this.y[jm],il=Math.hypot(itx,ity),jl=Math.hypot(jtx,jty);
    if(il<1e-6||jl<1e-6)continue;itx/=il;ity/=il;jtx/=jl;jty/=jl;
    const parallel=Math.abs(itx*jtx+ity*jty),pairGate=smooth(clamp((parallel-.42)/.48,0,1));if(pairGate<.015)continue;
    let corr=0;
    if(d<minSep)corr=(minSep-d)*(.74+.26*this.contactStrength);
    else if(d<attractRange&&Math.abs(dy)<.135&&this.currentCompression>.25)corr=-(d-targetSep)*attractK*this.contactStrength*pairGate;
    if(Math.abs(corr)<1e-6)continue;
    const nx=dx/d,ny=dy/d,w=.5;this.x[i]-=nx*corr*w;this.y[i]-=ny*corr*w;this.x[j]+=nx*corr*w;this.y[j]+=ny*corr*w;pairs++;
  }
  this.contactPairs=pairs;
 }
 projectConstraints(){for(let it=0;it<this.iterations;it++){for(let i=0;i<N-1;i++)this.projectDistance(i,i+1,this.restLen,.1);for(let i=1;i<N-1;i++){const q=i/(N-1),d=Math.abs(q-.5)*2,strength=d**this.bendingExponent,k=this.bendingStrength*(.05+.95*strength);this.projectDistance(i-1,i+1,2*this.restLen,k)}if(this.contactStrength>0&&it%2===0)this.projectSelfContact();if(this.endFlatCount>0){this.y[1]+=(this.yOffset-this.y[1])*this.endFlatStiffness;this.y[N-2]+=(this.yOffset-this.y[N-2])*this.endFlatStiffness}this.x[0]=this.startX;this.y[0]=this.yOffset;this.x[N-1]=this.targetX;this.y[N-1]=.05}}
 computeDerived(){const eps=1e-6;for(let i=0;i<N;i++){let dx,dy;if(i===0){dx=this.x[1]-this.x[0];dy=this.y[1]-this.y[0]}else if(i===N-1){dx=this.x[N-1]-this.x[N-2];dy=this.y[N-1]-this.y[N-2]}else{dx=this.x[i+1]-this.x[i-1];dy=this.y[i+1]-this.y[i-1]}let len=Math.hypot(dx,dy);if(len<eps){this.nx[i]=i?this.nx[i-1]:0;this.ny[i]=i?this.ny[i-1]:1}else{dx/=len;dy/=len;this.nx[i]=-dy;this.ny[i]=dx}}for(let i=0;i<SEG;i++){const ax=this.x[i],ay=this.y[i],bx=this.x[i+1],by=this.y[i+1],nax=this.nx[i],nay=this.ny[i],nbx=this.nx[i+1],nby=this.ny[i+1];if(i===0||i===SEG-1||nax*nbx+nay*nby>.99){this.cx[i]=(ax+bx)*.5;this.cy[i]=(ay+by)*.5;continue}const tax=nay,tay=-nax,tbx=nby,tby=-nbx,dx=bx-ax,dy=by-ay,den=tax*tby-tay*tbx;if(Math.abs(den)<=1e-6){this.cx[i]=(ax+bx)*.5;this.cy[i]=(ay+by)*.5}else{const tt=(dx*tby-dy*tbx)/den;this.cx[i]=ax+tt*tax;this.cy[i]=ay+tt*tay}}}
 injectDragImpulse(velocity,boost=1){
  const speed=clamp(Math.abs(velocity),0,8);if(speed<.025)return;
  // The end-cap follows the pointer, while the body initially resists the motion.
  // In Verlet terms moving prev in the opposite direction creates the visible lag/whip.
  const lateral=clamp(velocity*.0062*boost,-.074,.074);
  const lift=clamp((speed*.00325+speed*speed*.00026)*boost,0,.041);
  for(let i=1;i<N-1;i++){
    const q=i/(N-1),center=Math.pow(Math.sin(Math.PI*q),1.05),tail=.12+.88*smooth(q),w=center*tail;
    const wave=Math.sin(q*Math.PI*1.7)*(.35+.65*this.currentCompression);
    this.px[i]+=lateral*w*(.42+.72*q);
    this.py[i]-=lift*w*(.82+1.38*this.currentCompression)*(1.0+.24*wave);
  }
 }
 injectReleaseSnap(velocity){
   const speed=clamp(Math.abs(velocity),0,8);if(speed<.08)return;
   const kick=clamp(velocity*.0055,-.048,.048),lift=clamp(speed*.00255,0,.024);
   for(let i=1;i<N-1;i++){const q=i/(N-1),w=Math.sin(Math.PI*q)*(.3+.7*q);this.px[i]-=kick*w;this.py[i]-=lift*w;}
 }
 dampResidualVelocity(amount){const a=clamp(amount,0,1);if(a<=0)return;for(let i=1;i<N-1;i++){this.px[i]=lerp(this.px[i],this.x[i],a);this.py[i]=lerp(this.py[i],this.y[i],a)}}
 injectReversalWave(velocity,intensity=1){
   const speed=clamp(Math.abs(velocity),0,8),gain=clamp(intensity,0,1);if(speed<.35||gain<=.001)return;
   const lateral=clamp(velocity*.0036*gain,-.034,.034),lift=clamp(speed*.00155*gain,0,.0125);
   for(let i=1;i<N-1;i++){const q=i/(N-1),body=Math.pow(Math.sin(Math.PI*q),1.15),delay=.18+.82*smooth(q),wave=.72+.28*Math.sin((q*1.55+.12)*Math.PI);this.px[i]+=lateral*body*delay;this.py[i]-=lift*body*wave;}
 }
 injectReboundTail(direction,energy,age,percent){
   const safe=smooth(clamp((percent-15)/18,0,1)),e=clamp(energy,0,1.5)*safe;if(e<.002||age<=.035||age>.42)return;
   const local=Math.max(0,age-.035),envelope=Math.exp(-local*7.6),osc=Math.sin(local*23.0),gain=e*envelope*osc;if(Math.abs(gain)<.002)return;
   const lateral=clamp(-direction*.0058*gain,-.010,.010),vertical=clamp(Math.abs(gain)*.0019,0,.0032);
   for(let i=1;i<N-1;i++){const q=i/(N-1),body=Math.pow(Math.sin(Math.PI*q),1.2),travel=smooth(clamp((q-(local*.75-.08))/.52,0,1)),phase=.75+.25*Math.cos((q-local*1.7)*Math.PI),w=body*(.28+.72*travel)*phase;this.px[i]+=lateral*w;this.py[i]+=vertical*w*Math.sign(gain)*.36;}
 }
 setReferenceProfile(fastUnfold=0){this.damping=PHYS_REF.damping;this.bendingStrength=PHYS_REF.bendingStrength;this.archStrength=lerp(PHYS_REF.archStrength,2,fastUnfold);this.bendingExponent=PHYS_REF.bendingExponent;this.endFlatCount=PHYS_REF.endFlatCount;this.endFlatStiffness=PHYS_REF.endFlatStiffness;this.archEdgeDeadzone=PHYS_REF.archEdgeDeadzone;this.iterations=PHYS_REF.iterations;this.substeps=PHYS_REF.substeps;this.contactStrength=0}
 setInteractiveProfile(velocity,percent=50){const q=clamp(Math.abs(velocity)/3.25,0,1),midIn=smooth(clamp((percent-15)/12,0,1)),midOut=1-smooth(clamp((percent-55)/15,0,1)),mid=midIn*midOut,compress=smooth(clamp((-velocity-.10)/2.8,0,1)),release=smooth(clamp((velocity-.10)/2.8,0,1)),stabilityBand=(1-smooth(clamp(Math.abs(percent-30)/7,0,1)))*(1-smooth(clamp(Math.abs(velocity)/.55,0,1)));this.damping=lerp(.0085,.00115,q)+.0045*stabilityBand;this.bendingStrength=lerp(.09,.032,q)*(1-.10*mid*(.55+.45*compress));this.archStrength=(2.35+5.35*q)*(1+.065*mid*(.55+.45*compress));this.bendingExponent=lerp(1.28,1.78,q);this.contactStrength=clamp((.43+.55*q+.18*mid*(.65+.35*compress)-.08*mid*release)*(1-.78*stabilityBand),0,1.08);this.layerPressure=mid*(.62+.38*compress)*(1-.22*stabilityBand);this.layerRelease=mid*release;if(percent>=24&&percent<=36){this.contactStrength=0;this.layerPressure*=.72}}
 applyLowEndpointShape(percent,amount,dt){
  const a=clamp(amount,0,1);if(a<=.0001)return;
  const rawP=clamp(percent,0,38),zeroLock=smooth(clamp((.85-rawP)/.85,0,1)),unlock=easeOutQuad((rawP-5.5)/9.5),topologyHold=1-unlock,effectiveA=Math.max(a,topologyHold);
  const p=rawP<=5.5?2:lerp(2,Math.max(2,rawP),unlock);let lo=LOW_SHAPE_KEYS[0],hi=LOW_SHAPE_KEYS[LOW_SHAPE_KEYS.length-1];
  for(let k=1;k<LOW_SHAPE_KEYS.length;k++){if(p<=LOW_SHAPE_KEYS[k].p){lo=LOW_SHAPE_KEYS[k-1];hi=LOW_SHAPE_KEYS[k];break}}
  const span=Math.max(.001,hi.p-lo.p),u=smooth((p-lo.p)/span),shapeEnd=lerp(lo.pts[N-1][0],hi.pts[N-1][0],u);
  // At 0% we deliberately stop using the spring follower's overshoot.  The source's minimum
  // state is a closed ~1-2% curl, so mapping UI 0% to that canonical geometry is both stable
  // and visually faithful.  This removes the velocity-history-dependent split seen in R8.
  const liveRatio=(this.targetX-this.startX)/(shapeEnd-this.startX),ratio=lerp(liveRatio,1,Math.max(zeroLock,topologyHold));
  const settle=(1-Math.exp(-dt*lerp(38,26,unlock)))*effectiveA;
  for(let i=1;i<N-1;i++){
    const q=i/(N-1),sx=lerp(lo.pts[i][0],hi.pts[i][0],u),sy=lerp(lo.pts[i][1],hi.pts[i][1],u),tx=this.startX+(sx-this.startX)*ratio,ty=sy;
    if(rawP<=5.5){this.x[i]=tx;this.y[i]=ty;this.px[i]=tx;this.py[i]=ty;continue;}
    const center=.72+.28*Math.sin(Math.PI*q),w=clamp(settle*center+topologyHold*.88+zeroLock*.82,0,1),dx=(tx-this.x[i])*w,dy=(ty-this.y[i])*w;
    this.x[i]+=dx;this.y[i]+=dy;this.px[i]+=dx*(.98+.02*effectiveA);this.py[i]+=dy*(.98+.02*effectiveA);
  }
  const lockedEnd=lerp(this.targetX,shapeEnd,Math.max(zeroLock,topologyHold));
  this.targetX=lockedEnd;this.x[0]=this.startX;this.y[0]=this.yOffset;this.px[0]=this.startX;this.py[0]=this.yOffset;
  this.x[N-1]=lockedEnd;this.y[N-1]=.05;this.px[N-1]=lockedEnd;this.py[N-1]=.05;this.computeDerived();
 }
 get endCap(){return[this.x[N-2],this.y[N-2],this.x[N-1],this.y[N-1]]}
}

const LOW_SHAPE_KEYS=[
 {p:2,pts:[[-1,-.03],[-.879821,-.029275],[-.773049,.033558],[-.724245,.145886],[-.740094,.265722],[-.801863,.368994],[-.807854,.490233],[-.736062,.588903],[-.615011,.599217],[-.551672,.495920],[-.570752,.376758],[-.639357,.278296],[-.664639,.160270],[-.626760,.044205],[-.529397,-.030870],[-.403462,-.027013],[-.309220,.05]]},
 {p:7,pts:[[-1,-.03],[-.880333,-.030021],[-.769966,.024035],[-.712147,.132654],[-.728057,.253693],[-.800861,.349672],[-.829461,.467054],[-.777947,.577988],[-.658685,.602837],[-.595198,.499290],[-.611063,.380310],[-.640536,.264528],[-.627843,.144773],[-.569018,.039028],[-.467365,-.028172],[-.341924,-.025699],[-.245847,.05]]},
 {p:11,pts:[[-1,-.03],[-.879853,-.029236],[-.772676,.032436],[-.720422,.142830],[-.728825,.263169],[-.781124,.371331],[-.779679,.492449],[-.705479,.588938],[-.584867,.601073],[-.513989,.503278],[-.517318,.383212],[-.566069,.273987],[-.569658,.153671],[-.518635,.044537],[-.423327,-.031341],[-.296878,-.027970],[-.203978,.05]]},
 {p:19,pts:[[-1,-.03],[-.879887,-.029083],[-.771900,.030049],[-.710924,.134782],[-.696562,.253649],[-.711263,.372197],[-.682574,.489023],[-.600983,.577977],[-.482064,.598644],[-.395362,.514257],[-.386669,.393229],[-.440982,.286046],[-.463809,.168030],[-.426219,.051119],[-.327226,-.021431],[-.201541,-.024391],[-.103585,.05]]},
 {p:27,pts:[[-1,-.03],[-.881532,-.030187],[-.762721,-.017161],[-.657783,.043912],[-.596917,.148925],[-.590985,.268675],[-.619976,.384964],[-.585510,.500980],[-.483201,.565300],[-.370383,.521801],[-.311339,.415880],[-.317444,.295551],[-.368417,.186031],[-.352203,.063318],[-.258770,-.018153],[-.132576,-.024080],[-.034178,.05]]},
 {p:38,pts:[[-1,-.03],[-.880632,-.029835],[-.767035,.012081],[-.682547,.098342],[-.640571,.211066],[-.640300,.330611],[-.606255,.445372],[-.524803,.534069],[-.407044,.559009],[-.310968,.486516],[-.273301,.372284],[-.285958,.253460],[-.267534,.135211],[-.203990,.032511],[-.100779,-.031190],[.024367,-.026466],[.119295,.05]]}
];

const physics=new JellyPhysics();

function compile(type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(sh);console.error(src.split('\n').map((l,i)=>`${i+1}: ${l}`).join('\n'));throw new Error(msg)}return sh}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}
const fullscreenVS=`#version 300 es
precision highp float;out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.0-1.0,0,1);}`;
const bezierFS=`#version 300 es
precision highp float;in vec2 vUv;out vec4 outData;uniform vec2 uPoints[17];uniform vec2 uControls[16];
const float LEFT=${BBOX.left},RIGHT=${BBOX.right},BOTTOM=${BBOX.bottom},TOP=${BBOX.top};
vec2 bez(vec2 A,vec2 B,vec2 C,float t){float s=1.0-t;return s*s*A+2.0*s*t*B+t*t*C;}
vec2 bezD(vec2 A,vec2 B,vec2 C,float t){return 2.0*((1.0-t)*(B-A)+t*(C-B));}
float sdBezierExact(vec2 pos,vec2 A,vec2 B,vec2 C){
  vec2 a=B-A,b=A-2.0*B+C,c=a*2.0,d=A-pos;
  float bb=max(dot(b,b),.0001);
  float kk=1.0/bb,kx=kk*dot(a,b),ky=kk*(2.0*dot(a,a)+dot(d,b))/3.0,kz=kk*dot(d,a);
  float pp=ky-kx*kx,p3=pp*pp*pp,q=kx*(2.0*kx*kx-3.0*ky)+kz,h=q*q+4.0*p3,res;
  if(h>=0.0){h=sqrt(h);vec2 x=(vec2(h,-h)-q)/2.0;vec2 uv=sign(x)*pow(abs(x),vec2(1.0/3.0));float t=clamp(uv.x+uv.y-kx,0.0,1.0);vec2 f=d+(c+b*t)*t;res=dot(f,f);}
  else{float z=sqrt(max(-pp,0.0));float denom=pp*z*2.0;float vv=acos(clamp(q/denom,-1.0,1.0))/3.0;float m=cos(vv),n=sin(vv)*1.732050808;vec2 tt=clamp(vec2(m+m,-n-m)*z-kx,0.0,1.0);vec2 f=d+(c+b*tt.x)*tt.x;vec2 g=d+(c+b*tt.y)*tt.y;res=min(dot(f,f),dot(g,g));}
  return sqrt(max(res,0.0));
}
float curveDistance(vec2 p){float md=1e10;for(int i=0;i<16;i++)md=min(md,sdBezierExact(p,uPoints[i],uControls[i],uPoints[i+1]));return md;}
void main(){
  vec2 p=vec2(mix(LEFT,RIGHT,vUv.x),mix(TOP,BOTTOM,vUv.y));
  float md=1e10,mt=0.0;int closest=0;
  for(int i=0;i<16;i++){float d=sdBezierExact(p,uPoints[i],uControls[i],uPoints[i+1]);if(d<md){md=d;closest=i;vec2 A=uPoints[i],B=uPoints[i+1],AB=B-A,AP=p-A;float l=length(AB);mt=l>0.0?clamp(dot(AP,AB)/(l*l),0.0,1.0):0.0;}}
  float eps=.03;float xp=curveDistance(p+vec2(eps,0)),xm=curveDistance(p-vec2(eps,0)),yp=curveDistance(p+vec2(0,eps)),ym=curveDistance(p-vec2(0,eps));
  float progress=(float(closest)+mt)/16.0;
  outData=vec4(md,progress,(xp-xm)/(2.0*eps),(yp-ym)/(2.0*eps));
}`;

const sceneFS=`#version 300 es
precision highp float;in vec2 vUv;out vec4 outColor;uniform sampler2D uBezier;uniform sampler2D uDigits;uniform vec2 uResolution;uniform vec2 uJitter;uniform vec4 uEndCap;uniform vec3 uJellyColor;uniform vec3 uLightDirection;uniform float uTheme;uniform float uDensity;uniform float uAbsorbScale;uniform float uScatterStrength;uniform float uProgressScale;uniform float uProgressBias;uniform float uBounceScale;uniform float uSideScale;uniform float uLightExposure;uniform float uDarkExposure;uniform float uSlotLift;uniform float uJellyDarkGain;uniform float uLowSeal;
const float PI=3.14159265359;const float SURF=.001;const float MAXD=10.0;const int MAXSTEPS=64;const float LINE_R=${LINE_RADIUS};const float LINE_H=${LINE_HALF};const float LEFT=${BBOX.left},RIGHT=${BBOX.right},BOTTOM=${BBOX.bottom},TOP=${BBOX.top};
float sat(float x){return clamp(x,0.0,1.0);}vec3 sat3(vec3 x){return clamp(x,vec3(0),vec3(1));}
float sdRoundedBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;}
float opExtrude(float d2,float axis,float h){vec2 w=vec2(d2,abs(axis)-h);return min(max(w.x,w.y),0.0)+length(max(w,vec2(0)));}
float rectCut(vec2 p){return sdRoundedBox(p,vec2(1.02,.22),.22);}
float mainDist(vec3 p){float plane=p.y+.06;float shell=opExtrude(-rectCut(p.xz),p.y,.01)-.02;return min(plane,shell);}
vec4 polyInfo(vec2 p){vec2 uv=vec2((p.x-LEFT)/(RIGHT-LEFT),(TOP-p.y)/(TOP-BOTTOM));return texture(uBezier,clamp(uv,0.0,1.0));}
float sdPieExact(vec2 p,vec2 sc,float r){vec2 pw=vec2(abs(p.x),p.y);float l=length(pw)-r;float h=clamp(dot(pw,sc),0.0,r);float m=length(pw-sc*h);return max(l,m*sign(sc.y*pw.x-sc.x*pw.y));}float smoothUnion(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}float capDist(vec3 p){vec2 a=uEndCap.xy,b=uEndCap.zw;vec2 dir=normalize(b-a+vec2(1e-7,0));vec2 d=p.xy-a;float lx=dot(d,dir),ly=dot(d,vec2(-dir.y,dir.x));float pie=sdPieExact(vec2(p.z,lx),vec2(1.0,0.0),LINE_H);return opExtrude(pie,ly,.001)-LINE_R;}
vec2 sliderInfoDist(vec3 p){vec4 info=polyInfo(p.xy);float neck=smoothstep(.70,.78,info.y)*(1.0-smoothstep(.90,.96,info.y));float body=opExtrude(info.x,p.z,LINE_H)-LINE_R-uLowSeal*neck*.015;float cap=capDist(p);float d=info.y>.94?cap:body;if(uLowSeal>.001){float joined=smoothUnion(body,cap,mix(.010,.038,uLowSeal));d=mix(d,joined,uLowSeal);}return vec2(d,info.y);}
float sliderApprox(vec3 p){if(p.x<LEFT||p.x>RIGHT||p.y<BOTTOM||p.y>TOP)return 1e9;vec4 info=polyInfo(p.xy);return opExtrude(info.x,p.z,LINE_H)-LINE_R;}
vec3 tetraNormalMain(vec3 p,float e){vec3 o1=vec3(1,-1,-1)*e,o2=vec3(-1,-1,1)*e,o3=vec3(-1,1,-1)*e,o4=vec3(1,1,1)*e;return normalize(o1*mainDist(p+o1)+o2*mainDist(p+o2)+o3*mainDist(p+o3)+o4*mainDist(p+o4));}
vec3 tetraNormalCap(vec3 p,float e){vec3 o1=vec3(1,-1,-1)*e,o2=vec3(-1,-1,1)*e,o3=vec3(-1,1,-1)*e,o4=vec3(1,1,1)*e;return normalize(o1*capDist(p+o1)+o2*capDist(p+o2)+o3*capDist(p+o3)+o4*capDist(p+o4));}
vec3 normalMain(vec3 p){if(abs(p.z)>.22||abs(p.x)>1.02)return vec3(0,1,0);return tetraNormalMain(p,.0001);}
vec3 normalCap(vec3 p){return tetraNormalCap(p,.01);}
vec3 normalSlider(vec3 p,float prog){vec4 info=polyInfo(p.xy);vec2 g=info.zw;float th=LINE_H*.85,az=abs(p.z),zd=max(0.0,((az-th)*LINE_H)/(LINE_H-th));float ed=LINE_R-info.x;float ec=.9,zc=.1,blend=smoothstep(ec*LINE_R+zc*LINE_H,0.0,zd*zc+ed*ec);vec3 zvec=vec3(0,0,sign(p.z==0.0?1.0:p.z));vec3 n=normalize(mix(zvec,vec3(g,0),blend*.5+.5));if(prog>.94){float ratio=clamp((prog-.94)/.02,0.0,1.0);n=normalize(mix(n,normalCap(p),ratio));}return n;}
float ao(vec3 p,vec3 n){float occ=0.0,w=1.0;for(int i=1;i<=3;i++){float sh=.1/3.0*float(i);vec3 sp=p+n*sh;float d=min(mainDist(sp),sliderApprox(sp))-.005;occ+=max(0.0,sh-d)*w;w*=.5;}return sat(1.0-.5*occ/.1);}
vec3 fakeShadow(vec3 p,vec3 L){vec3 jc=uJellyColor;if(p.y<-.03){float edge=sat(1.0-(rectCut(p.xz)+.02)*30.0);float grad=sat(-p.z*4.0*L.z+1.0);return vec3(1.0)*edge*(grad*.5);}vec2 uv=vec2((p.x-p.z*L.x*sign(L.z))*.5+.5,1.0-(-p.z/L.z)*.5-.2);vec4 data=texture(uBezier,uv);float js=mix(0.0,data.y,sat(p.x*1.5+1.1));vec3 sh=mix(vec3(0),jc,js);float contrast=20.0*sat(uv.y)*(.8+uEndCap.x*.2);float fe=10.0;float uvf=sat(uv.x*fe)*sat((1.0-uv.x)*fe)*sat((1.0-uv.y)*fe)*sat(uv.y);float inf=sat((1.0-L.y)*2.0)*uvf;return mix(vec3(1),mix(sh,vec3(1),sat(data.x*contrast-.3)),inf);}
vec3 lighting(vec3 p,vec3 n,vec3 ro){vec3 L=normalize(-uLightDirection),fs=fakeShadow(p,L);float diff=max(dot(n,L),0.0);vec3 V=normalize(ro-p),R=reflect(-L,n);float spec=pow(max(dot(V,R),0.0),10.0)*.6;vec3 base=vec3(.9);vec3 directional=base*diff*fs;vec3 ambient=base*.6*.6;return sat3(directional+ambient+vec3(spec)*fs);}
float textMask(vec3 p){
  const float tw=.38,th=.33;vec2 q=vec2(p.x-.72,p.z);
  if(abs(q.x)>tw*.5||abs(q.y)>th*.5)return 0.0;
  vec2 uv=vec2((q.x+tw*.5)/tw,(q.y+th*.5)/th);
  return texture(uDigits,uv).r;
}
vec4 renderBg(vec3 ro,vec3 rd,float td){
  vec3 p=ro+rd*td;
  vec3 n=normalMain(p);
  vec3 lightDir=uLightDirection;
  float highlights=0.0;
  float highlightWidth=1.0,highlightHeight=.2,offsetX=0.0,offsetZ=.05,causticScale=.2;
  offsetX-=lightDir.x*causticScale;offsetZ+=lightDir.z*causticScale;
  float endCapX=uEndCap.x,sliderStretch=(endCapX+1.0)*.5;
  if(abs(p.x+offsetX)<highlightWidth && abs(p.z+offsetZ)<highlightHeight){
    float uvx=((p.x+offsetX+highlightWidth*2.0)/highlightWidth)*.5;
    float uvz=((p.z+offsetZ+highlightHeight*2.0)/highlightHeight)*.5;
    vec2 centered=vec2(uvx-.5,uvz-.5);
    vec2 fuv=vec2(centered.x,1.0-pow(abs(centered.y-.5)*2.0,2.0)*.3);
    float density=max(0.0,(texture(uBezier,fuv).x-.25)*8.0);
    float fadeX=smoothstep(0.0,-.2,p.x-endCapX);
    float fadeZ=1.0-pow(abs(centered.y-.5)*2.0,3.0);
    float fadeStretch=sat(1.0-sliderStretch);
    float edgeFade=sat(fadeX)*sat(fadeZ)*fadeStretch;
    highlights=(pow(density,3.0)*edgeFade*3.0*(1.0+lightDir.z))/1.5;
  }
  float sq=dot(p-vec3(endCapX,0,0),p-vec3(endCapX,0,0));
  vec3 bounce=uJellyColor*((1.0/(sq*15.0+1.0))*.4)*uBounceScale;
  vec3 side=uJellyColor*((1.0/(sq*40.0+1.0))*.3)*abs(n.z)*uSideScale;
  vec3 bg=lighting(p,n,ro)*ao(p,n)+bounce+side;
  float m=textMask(p);bg=mix(bg,sat3(bg*.5),m);
  bg*=1.0+highlights;
  // The source clip transitions to a darker environment; preserve the material response while lowering exposure.
  bg*=uLightExposure*mix(1.0,uDarkExposure,uTheme);
  float slotMask=1.0-smoothstep(-.035,-.015,p.y);bg+=vec3(uSlotLift)*uTheme*slotMask;
  return vec4(bg,1);
}
float marchBg(vec3 ro,vec3 rd){float t=0.0;for(int i=0;i<64;i++){float d=mainDist(ro+rd*t);t+=d;if(d<SURF||t>MAXD)break;}return t;}
vec3 marchNoJelly(vec3 ro,vec3 rd){float t=0.0;for(int i=0;i<6;i++){float d=mainDist(ro+rd*t);t+=d;if(t>MAXD||d<SURF*10.0)break;}if(t<MAXD)return renderBg(ro,rd,t).rgb;return vec3(0);}
bool boxHit(vec3 ro,vec3 rd,out float tn,out float tf){vec3 mn=vec3(LEFT,BOTTOM,-.25),mx=vec3(RIGHT,TOP,.25),inv=1.0/rd;vec3 t0=(mn-ro)*inv,t1=(mx-ro)*inv;vec3 lo=min(t0,t1),hi=max(t0,t1);tn=max(max(lo.x,lo.y),lo.z);tf=min(min(hi.x,hi.y),hi.z);return tf>=max(tn,0.0);}
float fres(float c,float i1,float i2){float r=(i1-i2)/(i1+i2);r*=r;return r+(1.0-r)*pow(1.0-c,5.0);}
vec3 getRay(vec2 uv){vec2 ndc=vec2(uv.x*2.0-1.0,uv.y*2.0-1.0)-uJitter;vec3 ro=vec3(.024,2.7,1.9),target=vec3(0),up0=vec3(0,1,0);vec3 f=normalize(target-ro),r=normalize(cross(f,up0)),u=cross(r,f);float k=tan(PI/8.0);return normalize(f+r*ndc.x*k+u*ndc.y*k);}
void main(){vec3 ro=vec3(.024,2.7,1.9),rd=getRay(vUv);float bgd=marchBg(ro,rd);vec4 bg=renderBg(ro,rd,bgd);float tn,tf;if(!boxHit(ro,rd,tn,tf)){outColor=vec4(tanh(bg.rgb*1.3),1);return;}float t=max(0.0,tn);for(int i=0;i<64;i++){vec3 p=ro+rd*t;vec2 si=sliderInfoDist(p);float md=mainDist(p);float d=min(si.x,md);t+=d;if(d<SURF){vec3 hp=ro+rd*t;if(si.x>md)break;vec3 N=normalSlider(hp,si.y),I=rd;float cosi=sat(dot(-I,N)),F=fres(cosi,1.0,1.42);vec3 refl=vec3(sat(hp.y+.2));vec3 refr=refract(I,N,1.0/1.42),rc=vec3(0);if(dot(refr,refr)>0.0){vec3 env=marchNoJelly(hp+refr*SURF*4.0,refr);float prog=sat(si.y*uProgressScale+uProgressBias);float density=uDensity;vec3 scatterTint=uJellyColor*1.5,absorb=(vec3(1)-uJellyColor)*density,T=exp(-absorb*(prog*prog)*uAbsorbScale);vec3 lightDir=-normalize(uLightDirection);float forward=max(0.0,dot(lightDir,refr));vec3 scatter=scatterTint*(uScatterStrength*forward*prog*prog*prog);rc=env*T+scatter;}vec3 col=mix(rc,refl,F);col*=mix(1.0,uJellyDarkGain,uTheme);outColor=vec4(tanh(col*1.3),1);return;}if(t>bgd||t>tf)break;}outColor=vec4(tanh(bg.rgb*1.3),1);}`;

const bezProg=program(fullscreenVS,bezierFS),sceneProg=program(fullscreenVS,sceneFS),vao=gl.createVertexArray();
const QUALITY_SCALE=clamp(Number(qs.get('quality'))||1.5,1,2),RW=Math.round(W*QUALITY_SCALE),RH=Math.round(H*QUALITY_SCALE);
const blitFS=`#version 300 es
precision highp float;in vec2 vUv;out vec4 outColor;uniform sampler2D uScene;uniform vec2 uTexel;
void main(){vec2 o=uTexel*1.5;vec3 c=texture(uScene,vUv).rgb*4.0;c+=(texture(uScene,vUv+vec2(o.x,0)).rgb+texture(uScene,vUv-vec2(o.x,0)).rgb+texture(uScene,vUv+vec2(0,o.y)).rgb+texture(uScene,vUv-vec2(0,o.y)).rgb)*2.0;c+=texture(uScene,vUv+o).rgb+texture(uScene,vUv-o).rgb+texture(uScene,vUv+vec2(o.x,-o.y)).rgb+texture(uScene,vUv+vec2(-o.x,o.y)).rgb;outColor=vec4(c/16.0,1);}`;
const blitProg=program(fullscreenVS,blitFS),sceneTex=gl.createTexture(),sceneFbo=gl.createFramebuffer();
gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,RW,RH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('scene framebuffer unsupported');gl.bindFramebuffer(gl.FRAMEBUFFER,null);

const taaFS=`#version 300 es
precision highp float;in vec2 vUv;out vec4 outColor;uniform sampler2D uCurrent;uniform sampler2D uHistory;uniform vec2 uTexel;uniform float uBlend;uniform float uFirst;
void main(){vec3 c=texture(uCurrent,vUv).rgb;if(uFirst>.5){outColor=vec4(c,1);return;}vec3 mn=vec3(999),mx=vec3(-999);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec3 n=texture(uCurrent,vUv+vec2(float(x),float(y))*uTexel).rgb;mn=min(mn,n);mx=max(mx,n);}vec3 h=clamp(texture(uHistory,vUv).rgb,mn,mx);float fx=smoothstep(.69,.73,vUv.x)*(1.0-smoothstep(.83,.87,vUv.x));float fy=smoothstep(.45,.49,vUv.y)*(1.0-smoothstep(.53,.57,vUv.y));float textRegion=fx*fy;float blend=mix(uBlend,.70,textRegion);outColor=vec4(mix(c,h,blend),1);}`;
const taaProg=program(fullscreenVS,taaFS);const taaTex=[gl.createTexture(),gl.createTexture()],taaFbo=[gl.createFramebuffer(),gl.createFramebuffer()];let interactiveTaaBlend=.82,lastInteractivePercent=38;
for(let i=0;i<2;i++){gl.bindTexture(gl.TEXTURE_2D,taaTex[i]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,RW,RH,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,taaFbo[i]);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,taaTex[i],0);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);const tu={cur:gl.getUniformLocation(taaProg,'uCurrent'),hist:gl.getUniformLocation(taaProg,'uHistory'),texel:gl.getUniformLocation(taaProg,'uTexel'),blend:gl.getUniformLocation(taaProg,'uBlend'),first:gl.getUniformLocation(taaProg,'uFirst')};let taaFrame=0;
function halton(index,base){let r=0,f=1/base,i=index;while(i>0){r+=f*(i%base);i=Math.floor(i/base);f/=base}return r}
function currentJitter(){const i=(taaFrame%1024)+1;return[((halton(i,2)-.5)*2)/RW,((halton(i,3)-.5)*2)/RH]}
function resolveTAA(){const cur=taaFrame&1,prev=1-cur;gl.bindFramebuffer(gl.FRAMEBUFFER,taaFbo[cur]);gl.viewport(0,0,RW,RH);gl.useProgram(taaProg);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.uniform1i(tu.cur,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,taaTex[prev]);gl.uniform1i(tu.hist,1);gl.uniform2f(tu.texel,1/RW,1/RH);gl.uniform1f(tu.blend,mode==='reference'?.90:interactiveTaaBlend);gl.uniform1f(tu.first,taaFrame===0?1:0);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,null);taaFrame++;return taaTex[cur]}

const blitSceneLoc=gl.getUniformLocation(blitProg,'uScene'),blitTexelLoc=gl.getUniformLocation(blitProg,'uTexel');
function loc(p,n){return gl.getUniformLocation(p,n)}
const bu={points:loc(bezProg,'uPoints[0]'),controls:loc(bezProg,'uControls[0]')};
const su={digits:loc(sceneProg,'uDigits'),res:loc(sceneProg,'uResolution'),jitter:loc(sceneProg,'uJitter'),bezier:loc(sceneProg,'uBezier'),end:loc(sceneProg,'uEndCap'),jelly:loc(sceneProg,'uJellyColor'),light:loc(sceneProg,'uLightDirection'),theme:loc(sceneProg,'uTheme'),density:loc(sceneProg,'uDensity'),absorbScale:loc(sceneProg,'uAbsorbScale'),scatterStrength:loc(sceneProg,'uScatterStrength'),progressScale:loc(sceneProg,'uProgressScale'),progressBias:loc(sceneProg,'uProgressBias'),bounceScale:loc(sceneProg,'uBounceScale'),sideScale:loc(sceneProg,'uSideScale'),lightExposure:loc(sceneProg,'uLightExposure'),darkExposure:loc(sceneProg,'uDarkExposure'),slotLift:loc(sceneProg,'uSlotLift'),jellyDarkGain:loc(sceneProg,'uJellyDarkGain'),lowSeal:loc(sceneProg,'uLowSeal')};

const BT_W=256,BT_H=128;
const bezTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,bezTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,linearFloat?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,linearFloat?gl.LINEAR:gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,BT_W,BT_H,0,gl.RGBA,gl.HALF_FLOAT,null);
const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,bezTex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('float framebuffer unsupported');gl.bindFramebuffer(gl.FRAMEBUFFER,null);


const digitCanvas=document.createElement('canvas');digitCanvas.width=512;digitCanvas.height=256;const digitCtx=digitCanvas.getContext('2d');const digitTex=gl.createTexture();let digitValue=-1;
gl.bindTexture(gl.TEXTURE_2D,digitTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,512,256,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
function updateDigitTexture(value,force=false){const v=Math.round(clamp(value,0,100));if(!force&&v===digitValue)return;digitValue=v;digitCtx.clearRect(0,0,512,256);digitCtx.direction='ltr';digitCtx.textAlign='right';digitCtx.textBaseline='middle';digitCtx.fillStyle='white';digitCtx.font='180px "Reddit Mono", "Noto Sans Mono Condensed", monospace';digitCtx.fillText(`${v} `,492,128);digitCtx.font='140px "JetBrains Mono", "PT Mono", "DejaVu Sans Mono", monospace';digitCtx.fillText('%',492,138);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,digitTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,digitCanvas);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);taaFrame=0}
document.fonts?.ready?.then(()=>{digitValue=-1;updateDigitTexture(globalThis.__JELLY_STATE?.value??38,true)});
const pointData=new Float32Array(N*2),controlData=new Float32Array(SEG*2);
function renderBezier(){for(let i=0;i<N;i++){pointData[i*2]=physics.x[i];pointData[i*2+1]=physics.y[i]}for(let i=0;i<SEG;i++){controlData[i*2]=physics.cx[i];controlData[i*2+1]=physics.cy[i]}gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,BT_W,BT_H);gl.useProgram(bezProg);gl.bindVertexArray(vao);gl.uniform2fv(bu.points,pointData);gl.uniform2fv(bu.controls,controlData);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
function renderScene(s){renderBezier();gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFbo);gl.viewport(0,0,RW,RH);gl.useProgram(sceneProg);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,bezTex);gl.uniform1i(su.bezier,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,digitTex);gl.uniform1i(su.digits,1);gl.uniform2f(su.res,RW,RH);const jit=currentJitter();gl.uniform2f(su.jitter,jit[0],jit[1]);gl.uniform4fv(su.end,physics.endCap);const inputHue=(s.hue+TUNE.orangeHueOffset)%360,inputValue=lerp(TUNE.orangeValue,TUNE.blueValue,s.colorDepth),inputSat=lerp(TUNE.orangeSat,TUNE.blueSat,s.colorDepth),autoBase=hsv2rgb(inputHue,inputSat,inputValue),base=colorOverride??autoBase;gl.uniform3fv(su.jelly,base);const d1=[TUNE.lightX,TUNE.lightY,TUNE.lightZ],d2=[TUNE.darkLightX,TUNE.darkLightY,TUNE.darkLightZ],qL=clamp(s.theme,0,1),ld=[lerp(d1[0],d2[0],qL),lerp(d1[1],d2[1],qL),lerp(d1[2],d2[2],qL)],len=Math.hypot(...ld);gl.uniform3f(su.light,ld[0]/len,ld[1]/len,ld[2]/len);gl.uniform1f(su.theme,s.theme);gl.uniform1f(su.density,TUNE.density);gl.uniform1f(su.absorbScale,TUNE.absorbScale);gl.uniform1f(su.scatterStrength,TUNE.scatterStrength);gl.uniform1f(su.progressScale,TUNE.progressScale);gl.uniform1f(su.progressBias,TUNE.progressBias);gl.uniform1f(su.bounceScale,TUNE.bounceScale);gl.uniform1f(su.sideScale,TUNE.sideScale);gl.uniform1f(su.lightExposure,TUNE.lightExposure);gl.uniform1f(su.darkExposure,TUNE.darkExposure);gl.uniform1f(su.slotLift,TUNE.slotLift);gl.uniform1f(su.jellyDarkGain,TUNE.jellyDarkGain);const lowSeal=(mode==='interactive')?(s.value<=5.5?1:(s.value<15?lerp(1,.18,easeOutQuad((s.value-5.5)/9.5)):.18*(1-smooth(clamp((s.value-15)/5,0,1))))):0;gl.uniform1f(su.lowSeal,lowSeal);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,null);const resolved=resolveTAA();gl.viewport(0,0,W,H);gl.useProgram(blitProg);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,resolved);gl.uniform1i(blitSceneLoc,0);gl.uniform2f(blitTexelLoc,1/RW,1/RH);gl.drawArrays(gl.TRIANGLES,0,3)}
function drawPercentage(s){updateDigitTexture(s.value);percentageEl.style.display='none';stage.dataset.theme=s.theme>=.5?'dark':'light';}
function drawOverlay(s){
  octx.clearRect(0,0,DISPLAY_W,DISPLAY_H);
  if(mode==='interactive'||!s.pointerDown||s.cursorX===null)return;const x=s.cursorX,y=s.cursorY;octx.save();octx.strokeStyle='rgba(28,28,28,.86)';octx.lineWidth=1.05;octx.beginPath();octx.arc(x,y,11,0,Math.PI*2);octx.stroke();octx.fillStyle='rgba(22,22,22,.92)';octx.beginPath();octx.moveTo(x-2.2,y-4.7);octx.lineTo(x+4.5,y+1.2);octx.lineTo(x+1.5,y+1.2);octx.lineTo(x+.4,y+4.6);octx.lineTo(x-1.0,y+4.1);octx.lineTo(x+.05,y+1.0);octx.lineTo(x-3.1,y+.8);octx.closePath();octx.fill();octx.restore();
}
const PCT_MAP=[[-.43,0],[-.20636,18],[.02435,38],[.45848,73],[.71,96],[.78125,100]];
function displayedFromPhysics(){const x=physics.x[N-2];if(x<=PCT_MAP[0][0])return 0;if(x>=PCT_MAP.at(-1)[0])return 100;for(let i=1;i<PCT_MAP.length;i++){const a=PCT_MAP[i-1],b=PCT_MAP[i];if(x<=b[0])return lerp(a[1],b[1],clamp((x-a[0])/(b[0]-a[0]),0,1))}return 100}
function referenceInputDelay(time){if(time>=21.80&&time<22.18)return 6/60;if(time>=22.18&&time<22.35)return 3/60;return 2/60}
let referenceMouseX=1.0,referenceRawTarget=null;
function referenceStep(time,dt){const r=referenceFrame(Math.max(0,time-referenceInputDelay(time)));let target=referenceRawTarget,rawVelocity=0,fastUnfold=0;if(r.down&&r.cursorX!==null){target=pointerXToTarget(r.cursorX);if(referenceRawTarget!==null&&dt>0)rawVelocity=(target-referenceRawTarget)/dt;fastUnfold=(time>=21.80&&time<=22.70)?1:0;referenceRawTarget=target;const mouseSmoothing=(time>=21.80&&time<=22.35)?.095:((time>22.35&&time<=22.75)?.080:lerp(.08,.07,fastUnfold));referenceMouseX+=(target-referenceMouseX)*mouseSmoothing}else{referenceRawTarget=null}physics.setReferenceProfile(fastUnfold);physics.setTarget(referenceMouseX);physics.update(dt)}
function seek(time){physics.reset();referenceMouseX=1.0;referenceRawTarget=null;let tt=0;while(tt+FIXED_DT<=time+1e-8){tt+=FIXED_DT;referenceStep(tt,FIXED_DT)}const rem=time-tt;if(rem>1e-6)referenceStep(time,rem)}
if(staticTime!==null)seek(staticTime);else{physics.reset();referenceMouseX=1.0;referenceRawTarget=null}
let interactiveTarget=.15,interactiveMouseX=.15,interactiveMouseVX=0,interactiveValue=38,interactivePercentTarget=38,pointerVelocity=0,releaseVelocity=0,lastPointerTarget=.15,lastPointerStamp=performance.now(),gestureEnergy=0,lastGestureVelocity=0,flipEnergy=0,reversalEnergy=0,reversalDirection=0,reversalAge=9,lowEndpointBlend=0,pointerMoveAge=0,gestureActive=0,holdSettling=false,releaseSettling=false,interactiveHue=219,interactiveTheme=1,interactiveDepth=1;stage.style.cursor=mode==='reference'?'none':'default';
function readPointer(e){const r=stage.getBoundingClientRect(),raw=(e.clientX-r.left)/r.width,nx=clamp(raw,.45,.9),target=clamp(((nx-.4)/.5)*1.7-.5,-.7,1),percent=clamp((nx-.45)/(.9-.45)*100,0,100);return{target,percent,nx}}
stage.addEventListener('pointerdown',e=>{if(e.target.closest?.('#paletteToggle,#palettePanel'))return;pointerDown=true;stage.setPointerCapture?.(e.pointerId);if(mode!=='interactive'){const visual=stateAt(t);interactiveHue=visual.hue;interactiveTheme=visual.theme;interactiveDepth=visual.colorDepth;mode='interactive';taaFrame=0;interactiveTarget=physics.targetX;interactiveMouseX=physics.targetX;interactiveValue=displayedFromPhysics();interactivePercentTarget=interactiveValue;stage.style.cursor='default'}const hit=readPointer(e);interactiveTarget=hit.target;interactivePercentTarget=hit.percent;lastPointerTarget=hit.target;lastPointerStamp=performance.now();pointerVelocity=0;releaseVelocity=0;interactiveMouseVX=0;gestureEnergy=0;lastGestureVelocity=0;flipEnergy=0;reversalEnergy=0;reversalDirection=0;reversalAge=9});
stage.addEventListener('pointermove',e=>{if(!pointerDown)return;const hit=readPointer(e),now=performance.now(),dts=Math.max(.004,(now-lastPointerStamp)/1000),v=clamp((hit.target-lastPointerTarget)/dts,-10,10);const prev=pointerVelocity;pointerVelocity=lerp(pointerVelocity,v,.54);gestureEnergy=Math.max(gestureEnergy,Math.abs(pointerVelocity));interactiveTarget=hit.target;interactivePercentTarget=hit.percent;if(Math.sign(prev)!==0&&Math.sign(pointerVelocity)!==Math.sign(prev)&&Math.min(Math.abs(prev),Math.abs(pointerVelocity))>.65){flipEnergy=clamp(flipEnergy+Math.min(1.0,Math.abs(pointerVelocity)/5),0,1.5);const lowSafe=smooth(clamp((hit.percent-15)/18,0,1));physics.injectDragImpulse(pointerVelocity,1.75+flipEnergy*.55);physics.injectReversalWave(pointerVelocity,lowSafe*(.55+.30*clamp(flipEnergy,0,1)));if(lowSafe>.01){reversalEnergy=clamp(.35+.62*clamp(Math.abs(pointerVelocity)/6,0,1)+.22*clamp(flipEnergy,0,1),0,1.35);reversalDirection=Math.sign(pointerVelocity)||1;reversalAge=0}}lastGestureVelocity=prev;lastPointerTarget=hit.target;lastPointerStamp=now});
stage.addEventListener('pointerup',e=>{pointerDown=false;releaseVelocity=pointerVelocity*(1.08+.10*clamp(gestureEnergy/5,0,1));physics.injectDragImpulse(releaseVelocity,2.25+flipEnergy*.35);physics.injectReleaseSnap(releaseVelocity);stage.releasePointerCapture?.(e.pointerId)});stage.addEventListener('pointercancel',()=>{pointerDown=false;releaseVelocity=pointerVelocity;physics.injectDragImpulse(releaseVelocity,1.55);physics.injectReleaseSnap(releaseVelocity)});
window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();paused=!paused}if(e.key==='r'||e.key==='R'){mode='reference';taaFrame=0;physics.setReferenceProfile();stage.style.cursor='none';paused=false;t=0;seek(0)}if(e.key==='i'||e.key==='I'){const visual=stateAt(t);interactiveHue=visual.hue;interactiveTheme=visual.theme;interactiveDepth=visual.colorDepth;mode='interactive';taaFrame=0;stage.style.cursor='default';interactiveTarget=physics.targetX;interactiveMouseX=physics.targetX;interactiveValue=displayedFromPhysics();interactivePercentTarget=interactiveValue;pointerVelocity=0;releaseVelocity=0;interactiveMouseVX=0}if(e.key==='d'||e.key==='D'){debug=!debug;hud.hidden=!debug}});
let staticWarmup=0;function frame(now){stage.dataset.mode=mode;const dt=Math.min(.05,(now-last)/1000);last=now;let s;if(mode==='reference'){if(staticTime===null&&!paused){accum+=dt;while(accum>=FIXED_DT){const nt=t+FIXED_DT;if(nt>DURATION){t=0;seek(0)}else{t=nt;referenceStep(t,FIXED_DT)}accum-=FIXED_DT}}s=stateAt(t)}else{
  // Underdamped pointer follower: quick gestures create visible lag and a short overshoot,
  // while slow drags remain precise.
  // R16: decouple user gesture velocity from the spring follower when the pointer is stationary.
  // The old feedback loop kept re-injecting the follower's own oscillation as fresh gesture energy,
  // which could self-excite around 25-35% even after the user's finger stopped moving.
  pointerMoveAge=Math.max(0,(performance.now()-lastPointerStamp)/1000);gestureActive=pointerDown?smooth(clamp((.095-pointerMoveAge)/.070,0,1)):0;
  const speedNorm=clamp(Math.abs(pointerVelocity)/5,0,1),stillness=pointerDown?(1-gestureActive):0;
  const springK=pointerDown?lerp(238,208,speedNorm):174,damping=pointerDown?(lerp(20.5,15.5,speedNorm)+stillness*7.0):19.2;
  const springA=(interactiveTarget-interactiveMouseX)*springK-interactiveMouseVX*damping;
  interactiveMouseVX+=springA*dt;interactiveMouseVX=clamp(interactiveMouseVX,-8.2,8.2);
  interactiveMouseX+=interactiveMouseVX*dt;interactiveMouseX=clamp(interactiveMouseX,-.72,1.02);
  const simVelocity=interactiveMouseVX;
  if(pointerDown){
    if(gestureActive>.02)pointerVelocity=lerp(pointerVelocity,simVelocity,.15*gestureActive);else pointerVelocity*=Math.exp(-14*dt);
    gestureEnergy=lerp(gestureEnergy,Math.abs(pointerVelocity),.08*gestureActive);flipEnergy*=Math.exp(-3.0*dt);
    if(gestureActive>.02&&Math.abs(pointerVelocity)>.018)physics.injectDragImpulse(pointerVelocity,(1.02+flipEnergy*.22)*gestureActive);
  }else{releaseVelocity*=Math.exp(-4.1*dt);gestureEnergy*=Math.exp(-2.8*dt);flipEnergy*=Math.exp(-4.0*dt);if(Math.abs(releaseVelocity)>.018)physics.injectDragImpulse(releaseVelocity,.40+clamp(gestureEnergy/9,0,.22))}
  const motionVelocity=pointerDown?(pointerVelocity+simVelocity*.12):(releaseVelocity+interactiveMouseVX*.22);
  if(reversalAge<.45){reversalAge+=dt;physics.injectReboundTail(reversalDirection,reversalEnergy,reversalAge,interactivePercentTarget)}
  reversalEnergy*=Math.exp(-3.6*dt);if(reversalAge>=.45&&reversalEnergy<.002)reversalEnergy=0;
  physics.setInteractiveProfile(motionVelocity,interactivePercentTarget);physics.setTarget(interactiveMouseX);const settleBand=interactivePercentTarget>=24&&interactivePercentTarget<=36;holdSettling=pointerDown&&settleBand&&pointerMoveAge>.095;releaseSettling=!pointerDown&&settleBand&&Math.abs(motionVelocity)<.55;if(holdSettling)physics.dampResidualVelocity(1-Math.exp(-22*dt));else if(releaseSettling)physics.dampResidualVelocity(1-Math.exp(-18*dt));physics.update(dt);
  const unlock=easeOutQuad((interactivePercentTarget-5.5)/9.5),post=1-smooth(clamp((interactivePercentTarget-15)/23,0,1)),lowDesired=interactivePercentTarget<=15?lerp(1,.62,unlock):.62*post;
  const lowRate=lowDesired>lowEndpointBlend?20:7.2;lowEndpointBlend+=(lowDesired-lowEndpointBlend)*(1-Math.exp(-dt*lowRate));
  if(lowEndpointBlend>.001)physics.applyLowEndpointShape(interactivePercentTarget,lowEndpointBlend,dt);
  const inHardLowBand=interactivePercentTarget<=5.5,enteringLowBand=inHardLowBand&&lastInteractivePercent>5.5;if(inHardLowBand)taaFrame=0;else if(enteringLowBand)taaFrame=0;const unlockGuard=1-easeOutQuad((interactivePercentTarget-5.5)/9.5),motionAA=smooth(clamp(Math.abs(motionVelocity)/4.5,0,1)),reboundAA=clamp(reversalEnergy*.42,0,.48);interactiveTaaBlend=inHardLowBand?0:lerp(.82,.18,Math.max(unlockGuard,motionAA*.72,reboundAA));lastInteractivePercent=interactivePercentTarget;
  interactiveValue=interactivePercentTarget;s={value:clamp(interactiveValue,0,100),hue:interactiveHue,theme:interactiveTheme,colorDepth:interactiveDepth,cursorX:null,cursorY:null,pointerDown:false}
}drawPercentage(s);renderScene(s);drawOverlay(s);globalThis.__JELLY_STATE={time:t,value:s.value,target:physics.targetX,secondLast:physics.x[N-2],displayed:displayedFromPhysics(),referenceFrame:referenceFrame(t).index,colorMode,paletteOpen:!palettePanel.hidden,activeColor:colorMode==='custom'?customColorEl.value:'AUTO',contactPairs:physics.contactPairs,lowBlend:lowEndpointBlend,taaBlend:interactiveTaaBlend,hardLowBand:interactivePercentTarget<=5.5,layerPressure:physics.layerPressure,layerRelease:physics.layerRelease,reversalEnergy,reversalAge,pointerMoveAge,gestureActive,holdSettling,releaseSettling,points:Array.from({length:N},(_,i)=>[physics.x[i],physics.y[i]])};if(debug){hudMode.textContent=`mode: ${mode}${paused?' / paused':''}`;hudTime.textContent=`time: ${t.toFixed(3)}s`;hudValue.textContent=`value: ${s.value.toFixed(1)} target:${physics.targetX.toFixed(3)} end2:${physics.x[N-2].toFixed(3)}`}if(staticTime===null)requestAnimationFrame(frame);else if(staticWarmup++<12)requestAnimationFrame(frame)}
globalThis.__JELLY_SET_TUNE=(patch={})=>{Object.assign(TUNE,patch);taaFrame=0;const s=mode==='reference'?stateAt(t):{value:interactiveValue,hue:219,theme:1,colorDepth:1,cursorX:null,cursorY:null,pointerDown:false};for(let i=0;i<8;i++)renderScene(s);drawPercentage(s);return {...TUNE}};
globalThis.__JELLY_SET_PHYS=(patch={})=>{Object.assign(PHYS_REF,patch);taaFrame=0;if(mode==='reference')seek(t);const st=mode==='reference'?stateAt(t):{value:interactiveValue,hue:219,theme:1,colorDepth:1,cursorX:null,cursorY:null,pointerDown:false};for(let i=0;i<8;i++)renderScene(st);drawPercentage(st);return {phys:{...PHYS_REF},state:globalThis.__JELLY_STATE}};
requestAnimationFrame(frame);
})();
