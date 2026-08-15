(() => {
  'use strict';
  globalThis.__JELLY_SWITCH_BUILD = 'MS02-R7.2-BALANCED-FRAMING';

  const canvas = document.getElementById('scene');
  const stage = document.getElementById('stage');
  const stateLabel = document.getElementById('stateLabel');
  const paletteToggle = document.getElementById('paletteToggle');
  const palettePanel = document.getElementById('palettePanel');
  const swatches = document.getElementById('swatches');
  const customColor = document.getElementById('customColor');

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });

  if (!gl) {
    stage.innerHTML = '<div class="webgl-error">WebGL2 unavailable</div>';
    return;
  }

  const VS = `#version 300 es
  in vec2 aPos;
  out vec2 vUv;
  void main(){
    vUv=aPos*0.5+0.5;
    gl_Position=vec4(aPos,0.0,1.0);
  }`;

  const SCENE_FS = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform vec2 uResolution;
  uniform vec2 uJitter;
  uniform float uProgress;
  uniform float uSquashX;
  uniform float uSquashZ;
  uniform float uWiggleX;
  uniform vec3 uColor;

  const float MAX_DIST = 10.0;
  const float SURF_DIST = 0.001;
  const int MAX_STEPS = 64;
  const float JELLY_IOR = 1.42;
  const float JELLY_SCATTER_STRENGTH = 3.0;
  const vec3 JELLY_HALFSIZE = vec3(0.35,0.30,0.30);
  const float SWITCH_RAIL_LENGTH = 0.40;
  const vec3 SOURCE_LIGHT_DIRECTION = normalize(vec3(0.19,-0.24,0.75));
  const vec3 LIGHT_DIR = -SOURCE_LIGHT_DIRECTION;

  float saturate(float x){ return clamp(x,0.0,1.0); }
  vec3 saturate3(vec3 x){ return clamp(x,0.0,1.0); }

  float sdRoundedBox2d(vec2 p, vec2 b, float r){
    vec2 q=abs(p)-b+r;
    return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r;
  }

  float sdRoundedBox3d(vec3 p, vec3 b, float r){
    vec3 q=abs(p)-b+r;
    return min(max(q.x,max(q.y,q.z)),0.0)+length(max(q,0.0))-r;
  }

  float opExtrudeY(vec3 p,float d,float h){
    vec2 w=vec2(d,abs(p.y)-h);
    return min(max(w.x,w.y),0.0)+length(max(w,vec2(0.0)));
  }

  vec3 opCheapBend(vec3 p,float k){
    float c=cos(k*p.x);
    float s=sin(k*p.x);
    mat2 m=mat2(c,-s,s,c);
    return vec3(m*p.xy,p.z);
  }

  vec3 rotateZ(vec3 p,float a){
    float c=cos(a),s=sin(a);
    return vec3(c*p.x+s*p.y,-s*p.x+c*p.y,p.z);
  }

  float rectangleCutoutDist(vec2 xz){
    const float groundRoundness=0.02;
    const float groundRadius=0.05;
    return sdRoundedBox2d(
      xz,
      vec2(SWITCH_RAIL_LENGTH*0.5+0.2+groundRoundness,groundRadius+groundRoundness),
      groundRadius+groundRoundness
    );
  }

  float mainSceneDist(vec3 p){
    const float groundThickness=0.03;
    const float groundRoundness=0.02;
    float plane=p.y+0.06;
    float cutout=opExtrudeY(p,-rectangleCutoutDist(p.xz),groundThickness-groundRoundness)-groundRoundness;
    return min(plane,cutout);
  }

  float jellyDist(vec3 p){
    vec3 jellyOrigin=vec3(
      (uProgress-0.5)*SWITCH_RAIL_LENGTH-uSquashX*(uProgress-0.5)*0.2,
      JELLY_HALFSIZE.y*0.5,
      0.0
    );
    vec3 jellyInvScale=vec3(1.0-uSquashX,1.0,1.0-uSquashZ);
    vec3 localPos=rotateZ((p-jellyOrigin)*jellyInvScale,uWiggleX);
    return sdRoundedBox3d(opCheapBend(localPos,0.8),JELLY_HALFSIZE-vec3(0.1),0.1);
  }

  vec2 sceneInfo(vec3 p){
    float bg=mainSceneDist(p);
    float jelly=jellyDist(p);
    return jelly<bg ? vec2(jelly,1.0) : vec2(bg,0.0);
  }

  float sceneDistForAO(vec3 p){ return min(mainSceneDist(p),jellyDist(p)); }

  vec3 approxNormal(vec3 p,float e){
    float d=sceneInfo(p).x;
    vec3 n=vec3(
      sceneInfo(p+vec3(e,0,0)).x-d,
      sceneInfo(p+vec3(0,e,0)).x-d,
      sceneInfo(p+vec3(0,0,e)).x-d
    );
    return normalize(n);
  }

  vec3 getNormal(vec3 p){
    if(abs(p.z)>0.5 || abs(p.x)>1.02) return vec3(0,1,0);
    return approxNormal(p,0.0001);
  }

  vec3 fakeShadow(vec3 p,vec3 lightDir){
    const float groundThickness=0.03;
    if(p.y < -groundThickness){
      float cutout=rectangleCutoutDist(p.xz)+0.02;
      float edgeDarkening=saturate(1.0-cutout*30.0);
      float lightGradient=saturate(-p.z*4.0*lightDir.z+1.0);
      return vec3(edgeDarkening*lightGradient*0.5);
    }
    return vec3(1.0);
  }

  float calculateAO(vec3 p,vec3 n){
    const float AO_RADIUS=0.1;
    const float AO_INTENSITY=0.5;
    const float AO_BIAS=SURF_DIST*5.0;
    float total=0.0;
    float weight=1.0;
    float stepDistance=AO_RADIUS/3.0;
    for(int i=1;i<=3;i++){
      float sampleHeight=stepDistance*float(i);
      float distanceToSurface=sceneDistForAO(p+n*sampleHeight)-AO_BIAS;
      float contribution=max(0.0,sampleHeight-distanceToSurface);
      total += contribution*weight;
      weight *= 0.5;
      if(total>AO_RADIUS/AO_INTENSITY) break;
    }
    return saturate(1.0-(AO_INTENSITY*total)/AO_RADIUS);
  }

  vec3 calculateLighting(vec3 p,vec3 n,vec3 rayOrigin){
    vec3 fs=fakeShadow(p,LIGHT_DIR);
    float diffuse=max(dot(n,LIGHT_DIR),0.0);
    vec3 viewDir=normalize(rayOrigin-p);
    vec3 reflectDir=reflect(-LIGHT_DIR,n);
    float specularFactor=pow(max(dot(viewDir,reflectDir),0.0),10.0);
    vec3 specular=vec3(specularFactor*0.6);
    vec3 baseColor=vec3(0.9);
    vec3 directional=baseColor*diffuse*fs;
    vec3 ambient=baseColor*vec3(0.6)*0.6;
    vec3 finalSpecular=specular*fs;
    return saturate3(directional+ambient+finalSpecular);
  }

  vec3 renderBackground(vec3 rayOrigin,vec3 rayDirection,float backgroundHitDist){
    vec3 hitPosition=rayOrigin+rayDirection*backgroundHitDist;
    vec3 n=getNormal(hitPosition);
    float switchX=(uProgress-0.5)*SWITCH_RAIL_LENGTH;
    float sqDist=dot(hitPosition-vec3(switchX,0,0),hitPosition-vec3(switchX,0,0));
    vec3 bounceLight=uColor*((1.0/(sqDist*15.0+1.0))*0.4);
    vec3 sideBounceLight=uColor*((1.0/(sqDist*40.0+1.0))*0.3)*abs(n.z);
    float emission=smoothstep(0.7,1.0,uProgress)*2.0+0.7;
    vec3 lit=calculateLighting(hitPosition,n,rayOrigin);
    vec3 backgroundColor=vec3(1.0)*lit*calculateAO(hitPosition,n);
    backgroundColor += bounceLight*emission;
    backgroundColor += sideBounceLight*emission;
    return backgroundColor;
  }

  float marchMain(vec3 ro,vec3 rd){
    float dist=0.0;
    for(int i=0;i<MAX_STEPS;i++){
      vec3 p=ro+rd*dist;
      float hit=mainSceneDist(p);
      dist += hit;
      if(hit<SURF_DIST || dist>MAX_DIST) break;
    }
    return dist;
  }

  vec3 rayMarchNoJelly(vec3 ro,vec3 rd){
    float dist=0.0;
    float hit=0.0;
    for(int i=0;i<6;i++){
      vec3 p=ro+rd*dist;
      hit=mainSceneDist(p);
      dist += hit;
      if(dist>MAX_DIST || hit<SURF_DIST*10.0) break;
    }
    if(dist<MAX_DIST) return renderBackground(ro,rd,dist);
    return vec3(0.0);
  }

  vec2 intersectBox(vec3 ro,vec3 rd){
    vec3 invDir=1.0/rd;
    vec3 t1=(-vec3(1.0)-ro)*invDir;
    vec3 t2=( vec3(1.0)-ro)*invDir;
    vec3 tMinVec=min(t1,t2);
    vec3 tMaxVec=max(t1,t2);
    float tMin=max(tMinVec.x,max(tMinVec.y,tMinVec.z));
    float tMax=min(tMaxVec.x,min(tMaxVec.y,tMaxVec.z));
    return vec2(tMin,tMax);
  }

  vec3 rayMarch(vec3 ro,vec3 rd){
    float backgroundDist=marchMain(ro,rd);
    vec3 background=renderBackground(ro,rd,backgroundDist);

    vec2 boxHit=intersectBox(ro,rd);
    if(boxHit.y<boxHit.x || boxHit.y<0.0) return background;

    float distanceFromOrigin=max(0.0,boxHit.x);
    for(int i=0;i<MAX_STEPS;i++){
      vec3 currentPosition=ro+rd*distanceFromOrigin;
      vec2 hitInfo=sceneInfo(currentPosition);
      distanceFromOrigin += hitInfo.x;

      if(hitInfo.x<SURF_DIST){
        vec3 hitPosition=ro+rd*distanceFromOrigin;
        if(hitInfo.y<0.5) break;

        vec3 N=getNormal(hitPosition);
        vec3 I=rd;
        float cosi=clamp(dot(-I,N),0.0,1.0);
        float r0=pow((1.0-JELLY_IOR)/(1.0+JELLY_IOR),2.0);
        float F=r0+(1.0-r0)*pow(1.0-cosi,5.0);
        vec3 reflection=vec3(saturate(hitPosition.y+0.2));

        float eta=1.0/JELLY_IOR;
        float k=1.0-eta*eta*(1.0-cosi*cosi);
        vec3 refractedColor=vec3(0.0);
        if(k>0.0){
          vec3 refrDir=normalize(I*eta+N*(eta*cosi-sqrt(k)));
          vec3 p=hitPosition+refrDir*(SURF_DIST*2.0);
          vec3 exitPos=p+refrDir*(SURF_DIST*2.0);
          vec3 env=rayMarchNoJelly(exitPos,refrDir);

          vec3 scatterTint=uColor*1.5;
          vec3 absorb=(vec3(1.0)-uColor)*20.0;
          float materialProgress=saturate(mix(1.0,0.6,hitPosition.y*(1.0/(JELLY_HALFSIZE.y*2.0))+0.25))*uProgress;
          vec3 T=exp(-(absorb*(materialProgress*materialProgress))*0.08);
          float forward=max(0.0,dot(LIGHT_DIR,refrDir));
          vec3 scatter=scatterTint*(JELLY_SCATTER_STRENGTH*forward*pow(materialProgress,3.0));
          refractedColor=env*T+scatter;
        }

        return reflection*F+refractedColor*(1.0-F);
      }

      if(distanceFromOrigin>backgroundDist) break;
    }
    return background;
  }

  void main(){
    vec2 ndc=vec2(
      gl_FragCoord.x/uResolution.x*2.0-1.0,
      gl_FragCoord.y/uResolution.y*2.0-1.0
    )+uJitter;
    float aspect=uResolution.x/uResolution.y;
    float tanHalf=tan(3.14159265359/8.0); // 45 degree source FOV

    vec3 ro=vec3(0.024,2.7,1.9);
    vec3 target=vec3(0.0);
    vec3 fw=normalize(target-ro);
    vec3 rt=normalize(cross(fw,vec3(0,1,0)));
    vec3 up=normalize(cross(rt,fw));
    vec3 rd=normalize(fw+rt*(ndc.x*aspect*tanHalf)+up*(ndc.y*tanHalf));

    vec3 color=rayMarch(ro,rd);
    fragColor=vec4(tanh(max(color,vec3(0.0))*1.5),1.0);
  }`;

  const RESOLVE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;
  uniform sampler2D uCurrent;
  uniform sampler2D uHistory;
  uniform ivec2 uSize;
  uniform int uFirstFrame;
  void main(){
    ivec2 p=ivec2(clamp(gl_FragCoord.xy,vec2(0.0),vec2(uSize)-vec2(1.0)));
    vec3 currentColor=texelFetch(uCurrent,p,0).rgb;
    if(uFirstFrame==1){ fragColor=vec4(currentColor,1.0); return; }
    vec3 historyColor=texelFetch(uHistory,p,0).rgb;
    vec3 minColor=vec3(9999.0);
    vec3 maxColor=vec3(-9999.0);
    for(int x=-1;x<=1;x++){
      for(int y=-1;y<=1;y++){
        ivec2 q=clamp(p+ivec2(x,y),ivec2(0),uSize-ivec2(1));
        vec3 c=texelFetch(uCurrent,q,0).rgb;
        minColor=min(minColor,c);
        maxColor=max(maxColor,c);
      }
    }
    vec3 historyClamped=clamp(historyColor,minColor,maxColor);
    fragColor=vec4(mix(currentColor,historyClamped,0.9),1.0);
  }`;

  const BLIT_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;
  uniform sampler2D uTexture;

  // R7.2 balanced presentation framing.
  // The source-faithful 45° scene, SDF, lighting, physics and TAA remain untouched.
  // Keep a modest presentation crop only. The 45° source camera remains unchanged.
  // R7.1 used 1.3548x and looked oversized; R7.2 settles at 1.16x.
  const float PRESENT_ZOOM = 1.16;

  void main(){
    vec2 uv=(vUv-vec2(0.5))/PRESENT_ZOOM+vec2(0.5);
    fragColor=texture(uTexture,uv);
  }`;

  function compile(type,src){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,src);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      throw new Error(gl.getShaderInfoLog(shader)||'shader compile error');
    }
    return shader;
  }

  function makeProgram(fs){
    const p=gl.createProgram();
    gl.attachShader(p,compile(gl.VERTEX_SHADER,VS));
    gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)||'program link error');
    return p;
  }

  const sceneProgram=makeProgram(SCENE_FS);
  const resolveProgram=makeProgram(RESOLVE_FS);
  const blitProgram=makeProgram(BLIT_FS);

  const vao=gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  for(const p of [sceneProgram,resolveProgram,blitProgram]){
    const loc=gl.getAttribLocation(p,'aPos');
    if(loc>=0){ gl.useProgram(p); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0); }
  }

  const U={
    resolution:gl.getUniformLocation(sceneProgram,'uResolution'),
    jitter:gl.getUniformLocation(sceneProgram,'uJitter'),
    progress:gl.getUniformLocation(sceneProgram,'uProgress'),
    squashX:gl.getUniformLocation(sceneProgram,'uSquashX'),
    squashZ:gl.getUniformLocation(sceneProgram,'uSquashZ'),
    wiggleX:gl.getUniformLocation(sceneProgram,'uWiggleX'),
    color:gl.getUniformLocation(sceneProgram,'uColor'),
  };
  const RU={
    current:gl.getUniformLocation(resolveProgram,'uCurrent'),
    history:gl.getUniformLocation(resolveProgram,'uHistory'),
    size:gl.getUniformLocation(resolveProgram,'uSize'),
    first:gl.getUniformLocation(resolveProgram,'uFirstFrame'),
  };
  const BU={texture:gl.getUniformLocation(blitProgram,'uTexture')};

  function makeTexture(w,h,linear=true){
    const tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,linear?gl.LINEAR:gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,linear?gl.LINEAR:gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    return tex;
  }

  function makeFbo(tex){
    const f=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete');
    return f;
  }

  let renderTargets=null;
  let internalWidth=0,internalHeight=0;
  let frameCount=0;
  const QUALITY_SCALE=0.75;

  function destroyTargets(){
    if(!renderTargets) return;
    gl.deleteTexture(renderTargets.currentTex);
    gl.deleteFramebuffer(renderTargets.currentFbo);
    for(const t of renderTargets.historyTex) gl.deleteTexture(t);
    for(const f of renderTargets.historyFbo) gl.deleteFramebuffer(f);
    renderTargets=null;
  }

  function rebuildTargets(w,h){
    destroyTargets();
    internalWidth=Math.max(2,Math.floor(w*QUALITY_SCALE));
    internalHeight=Math.max(2,Math.floor(h*QUALITY_SCALE));
    const currentTex=makeTexture(internalWidth,internalHeight,false);
    const historyTex=[makeTexture(internalWidth,internalHeight,true),makeTexture(internalWidth,internalHeight,true)];
    renderTargets={
      currentTex,
      currentFbo:makeFbo(currentTex),
      historyTex,
      historyFbo:[makeFbo(historyTex[0]),makeFbo(historyTex[1])],
    };
    frameCount=0;
  }

  class Spring{
    constructor(stiffness,damping,mass=1){
      this.value=0; this.target=0; this.velocity=0;
      this.stiffness=stiffness; this.damping=damping; this.mass=mass;
    }
    update(dt){
      const Fspring=-this.stiffness*(this.value-this.target);
      const Fdamp=-this.damping*this.velocity;
      const a=(Fspring+Fdamp)/this.mass;
      this.velocity += a*dt;
      this.value += this.velocity*dt;
    }
  }

  const squashX=new Spring(1000,10);
  const squashZ=new Spring(900,12);
  const wiggleX=new Spring(1000,20);
  let toggled=false;
  let pressed=false;
  let progress=0;
  let velocity=0;
  let lastTimestamp=null;
  let activePointer=null;

  const palette=[
    ['TypeGPU Blue','#1480ff'],['Source Orange','#ff7313'],['Coral','#ff5b45'],['Gold','#f5b82e'],
    ['Emerald','#22b879'],['Cyan','#28b9d6'],['Violet','#7354de'],['Magenta','#d94f9f']
  ];
  const swatchButtons=[];
  let color=hexToRgb('#1480ff');

  function hexToRgb(hex){
    const value=parseInt(hex.slice(1),16);
    return [(value>>16&255)/255,(value>>8&255)/255,(value&255)/255];
  }

  function selectColor(hex,button){
    color=hexToRgb(hex);
    customColor.value=hex;
    stage.style.setProperty('--jelly-rgb',color.map(v=>Math.round(v*255)).join(','));
    [...swatches.children].forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  }

  function setToggle(next){
    toggled=Boolean(next);
    stage.dataset.state=toggled?'on':'off';
    stateLabel.textContent=toggled?'ON':'OFF';
  }

  palette.forEach(([name,hex],index)=>{
    const button=document.createElement('button');
    button.className='swatch'; button.type='button'; button.title=name; button.setAttribute('aria-label',name);
    button.style.background=hex; button.setAttribute('aria-pressed',String(index===0));
    button.addEventListener('click',event=>{ event.stopPropagation(); takeManualControl(); selectColor(hex,button); });
    swatches.appendChild(button); swatchButtons.push(button);
  });
  stage.style.setProperty('--jelly-rgb','20,128,255');
  customColor.value='#1480ff';

  // Auto demo is intentionally outside the source renderer/physics. It only
  // simulates the same pressed/toggled/color inputs that a user would create.
  let demoState='arming';
  let demoStartAt=performance.now()+700;
  let demoStep=0;
  let demoNextActionAt=demoStartAt;
  let autoReleaseAt=0;
  let autoPressed=false;
  stage.dataset.demo=demoState;

  function setDemoState(next){ demoState=next; stage.dataset.demo=next; }
  function takeManualControl(){
    if(demoState==='manual') return;
    autoPressed=false; pressed=false; stage.classList.remove('is-pressed');
    setDemoState('manual');
  }

  function beginAutoPress(now){
    if(demoState!=='running') return;
    pressed=true; autoPressed=true; stage.classList.add('is-pressed');
    autoReleaseAt=now+180;
  }

  function updateAutoDemo(now){
    if(demoState==='manual') return;
    if(demoState==='arming'){
      if(now<demoStartAt) return;
      setDemoState('running');
      demoNextActionAt=now;
    }
    if(autoPressed && now>=autoReleaseAt){
      autoPressed=false; pressed=false; stage.classList.remove('is-pressed'); setToggle(!toggled);
    }
    if(demoState!=='running' || autoPressed || now<demoNextActionAt) return;
    const sequence=[0,1,4]; // official blue -> orange -> emerald
    const index=sequence[demoStep%sequence.length];
    selectColor(palette[index][1],swatchButtons[index]);
    beginAutoPress(now);
    demoStep=(demoStep+1)%sequence.length;
    demoNextActionAt=now+1550;
  }

  customColor.addEventListener('input',event=>{
    event.stopPropagation(); takeManualControl(); color=hexToRgb(customColor.value);
    stage.style.setProperty('--jelly-rgb',color.map(v=>Math.round(v*255)).join(','));
    [...swatches.children].forEach(item=>item.setAttribute('aria-pressed','false'));
  });

  paletteToggle.addEventListener('click',event=>{
    event.stopPropagation(); takeManualControl(); palettePanel.hidden=!palettePanel.hidden;
    paletteToggle.setAttribute('aria-expanded',String(!palettePanel.hidden));
  });
  palettePanel.addEventListener('pointerdown',event=>{ takeManualControl(); event.stopPropagation(); });
  palettePanel.addEventListener('pointerup',event=>event.stopPropagation());

  function isPaletteTarget(target){ return target?.closest?.('#palettePanel') || target?.closest?.('#paletteToggle'); }

  stage.addEventListener('pointerdown',event=>{
    if(isPaletteTarget(event.target)) return;
    takeManualControl(); activePointer=event.pointerId; pressed=true; stage.classList.add('is-pressed');
    stage.setPointerCapture?.(event.pointerId); event.preventDefault();
  });

  stage.addEventListener('pointerup',event=>{
    if(isPaletteTarget(event.target)) return;
    if(activePointer!==null && event.pointerId!==activePointer) return;
    activePointer=null; pressed=false; stage.classList.remove('is-pressed'); setToggle(!toggled); event.preventDefault();
  });

  stage.addEventListener('pointercancel',()=>{
    activePointer=null; pressed=false; stage.classList.remove('is-pressed');
  });

  function sourcePhysicsUpdate(dt){
    if(dt<=0) return;
    let acc=0;
    if(toggled && progress<1) acc=100;
    if(!toggled && progress>0) acc=-100;

    if(pressed){
      squashX.velocity=-2;
      squashZ.velocity=1;
      wiggleX.velocity=1*Math.sign(progress-0.5);
    }

    velocity += acc*dt;
    if(progress>0 && progress<1) wiggleX.velocity=velocity;
    progress += velocity*dt;

    if(progress>1){
      progress=1; velocity=0;
      squashX.velocity=-5; squashZ.velocity=5; wiggleX.velocity=-10;
    }
    if(progress<0){
      progress=0; velocity=0;
      squashX.velocity=-5; squashZ.velocity=5; wiggleX.velocity=10;
    }
    progress=Math.max(0,Math.min(1,progress));

    squashX.update(dt);
    squashZ.update(dt);
    wiggleX.update(dt);
  }

  function halton(index,base){
    let result=0, f=1/base, i=index;
    while(i>0){ result += f*(i%base); i=Math.floor(i/base); f/=base; }
    return result;
  }

  function resize(){
    const rect=canvas.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,1.5);
    const width=Math.max(2,Math.round(rect.width*dpr));
    const height=Math.max(2,Math.round(rect.height*dpr));
    if(canvas.width!==width || canvas.height!==height || !renderTargets){
      canvas.width=width; canvas.height=height; rebuildTargets(width,height);
    }
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function bindTexture(unit,tex){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,tex); }

  function render(timestamp){
    resize();
    updateAutoDemo(timestamp);
    frameCount++;
    const dt=Math.min(lastTimestamp!==null?(timestamp-lastTimestamp)*0.001:0,0.1);
    lastTimestamp=timestamp;
    sourcePhysicsUpdate(dt);

    const jitterX=((halton(frameCount,2)-0.5)*2.0)/internalWidth;
    const jitterY=((halton(frameCount,3)-0.5)*2.0)/internalHeight;

    gl.bindVertexArray(vao);

    // 1) source raymarch at qualityScale 0.75 for a clearer presentation
    gl.bindFramebuffer(gl.FRAMEBUFFER,renderTargets.currentFbo);
    gl.viewport(0,0,internalWidth,internalHeight);
    gl.useProgram(sceneProgram);
    gl.uniform2f(U.resolution,internalWidth,internalHeight);
    gl.uniform2f(U.jitter,jitterX,jitterY);
    gl.uniform1f(U.progress,progress);
    gl.uniform1f(U.squashX,squashX.value);
    gl.uniform1f(U.squashZ,squashZ.value);
    gl.uniform1f(U.wiggleX,wiggleX.value);
    gl.uniform3f(U.color,color[0],color[1],color[2]);
    gl.drawArrays(gl.TRIANGLES,0,3);

    // 2) source-style 0.9 history TAA + 3x3 neighborhood clamp
    const currentIndex=frameCount%2;
    const previousIndex=1-currentIndex;
    gl.bindFramebuffer(gl.FRAMEBUFFER,renderTargets.historyFbo[currentIndex]);
    gl.viewport(0,0,internalWidth,internalHeight);
    gl.useProgram(resolveProgram);
    bindTexture(0,renderTargets.currentTex);
    bindTexture(1,frameCount===1?renderTargets.currentTex:renderTargets.historyTex[previousIndex]);
    gl.uniform1i(RU.current,0); gl.uniform1i(RU.history,1);
    gl.uniform2i(RU.size,internalWidth,internalHeight);
    gl.uniform1i(RU.first,frameCount===1?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3);

    // 3) linear upsample to presentation canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.useProgram(blitProgram);
    bindTexture(0,renderTargets.historyTex[currentIndex]);
    gl.uniform1i(BU.texture,0);
    gl.drawArrays(gl.TRIANGLES,0,3);

    requestAnimationFrame(render);
  }

  const qa=new URLSearchParams(location.search);
  if(qa.has('qa')){
    takeManualControl();
    const forced=qa.get('qa');
    if(forced==='on'){ progress=1; setToggle(true); }
    if(forced==='off'){ progress=0; setToggle(false); }
    const forcedColor=qa.get('color');
    if(forcedColor && /^[0-9a-fA-F]{6}$/.test(forcedColor)){
      color=hexToRgb('#'+forcedColor); customColor.value='#'+forcedColor;
      stage.style.setProperty('--jelly-rgb',color.map(v=>Math.round(v*255)).join(','));
    }
  }

  requestAnimationFrame(render);
})();
