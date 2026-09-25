// お絵描き手帳の車（500 L の3Dモデル）を組み立てる＝index.html（塗る画面）と drive.html（走る動画）で共用。
// 座標＝前が+z・上が+y・車の左（運転席）が+x・約2.6027単位/m。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export const DEF = {bc:'#b8261f',fin:'solid',tt:0,rc:'#f1ede2',cv:1,cc:'#1c1c1c',st:0,sc:'#f1ede2',sw:0.44,sg:0.12,so:0,sd:0,sdc:'#f1ede2',sdy:1.25,sdw:0.1,sdt:'',nb:'',rim:'silver',bmp:'chrome',seat:'#2b2624'};

export function readHash(){
  const S = {...DEF};
  try{ const h=new URLSearchParams(location.hash.slice(1)); for(const k in DEF){ if(h.has(k)){ const v=h.get(k); S[k]= typeof DEF[k]==='number' ? (+v||0) : v; } } }catch(e){}
  return S;
}

// 模様は「車の座標」で描く＝車が動いても幌やストライプが車体に付いてくる（uCarInv＝車の置き場所の逆行列）
const U = {
  uCarInv:{value:new THREE.Matrix4()},
  uCanvas:{value:1}, uCanvasCol:{value:new THREE.Color()},
  uStripe:{value:0}, uStripeCol:{value:new THREE.Color()}, uSW:{value:0.2}, uSG:{value:0.1}, uSO:{value:0},
  uSide:{value:0}, uSideCol:{value:new THREE.Color()}, uSideY:{value:1.2}, uSideW:{value:0.1},
  // アバルトの帯＝形（0 ただの線／1 太帯＋細線2本／2 太帯1本）・帯の前端と後端の z・文字の枠の前端と後端の z・文字（白抜き＝アルファだけ使う）
  uSideT:{value:0}, uSideZ:{value:new THREE.Vector2(1.80,-1.30)}, uTxtZ:{value:new THREE.Vector2()}, uTxt:{value:null},
};
function paintMaterial(isRoof){
  // 両面描画＝窓越しに見える外板の裏側（室内側）もボディ色にする（実車も室内の鉄板はボディ同色）
  const m = new THREE.MeshPhysicalMaterial({clearcoat:1, clearcoatRoughness:0.06, side:THREE.DoubleSide});
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, {uRoof:{value:isRoof?1:0}});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>','#include <common>\nuniform mat4 uCarInv; varying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvWPos=(uCarInv*modelMatrix*vec4(transformed,1.0)).xyz; vWNrm=normalize(mat3(uCarInv)*mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vWPos; varying vec3 vWNrm;
uniform float uRoof,uCanvas,uStripe,uSW,uSG,uSO,uSide,uSideY,uSideW;
uniform vec3 uCanvasCol,uStripeCol,uSideCol;
uniform float uSideT; uniform vec2 uSideZ,uTxtZ; uniform sampler2D uTxt;
float band(float d,float hw){ float a=fwidth(d)*1.2+1e-4; return 1.0-smoothstep(hw-a,hw+a,d); }`)
      .replace('#include <color_fragment>',`#include <color_fragment>
vec3 wn=normalize(vWNrm);
float isCanvas=0.0;
// 幌＝上面図（wiring-simulator/ref/blueprint_4views_hi.png）の画素実測＝先端から1111〜1799mm。
// 前端＝フロントガラス上端(z1.22)の直後・後端＝後席の窓の前端(z-0.62)。幅は屋根パネルの継ぎ目(|x|=1.023)の内側
if(uCanvas>0.5 && wn.y>0.5 && vWPos.y>2.9){
  vec2 q=vec2(abs(vWPos.x), abs(vWPos.z-0.27));
  vec2 d=q-vec2(0.98-0.08, 0.89-0.08);
  float sd=length(max(d,0.0))+min(max(d.x,d.y),0.0)-0.08;
  isCanvas=1.0-smoothstep(-0.01,0.01,sd);
}
float stp=0.0; float ax=abs(vWPos.x);
if(uStripe>0.5 && uStripe<1.5) stp=band(abs(vWPos.x-uSO),uSW*0.5);
if(uStripe>1.5) stp=band(abs(ax-(uSG*0.5+uSW*0.5)),uSW*0.5);
stp*=1.0-smoothstep(0.6,0.8,abs(wn.x));
stp*=1.0-isCanvas;
float ff=gl_FrontFacing?1.0:0.0; // 室内側（裏面）には模様を描かない
stp*=ff;
float sdl=0.0, sdt=0.0;
if(uSide>0.5){
  float dy=vWPos.y-uSideY;
  sdl=band(abs(dy),uSideW*0.5);
  if(uSideT>0.5){
    // アバルトの帯＝前輪の後ろから後輪の手前まで（1＝上下に細い線を添える）
    if(uSideT<1.5){ float t=uSideW*0.13, g=uSideW*0.13; sdl=max(sdl,band(abs(abs(dy)-(uSideW*0.5+g+t*0.5)),t*0.5)); }
    sdl*=band(abs(vWPos.z-(uSideZ.x+uSideZ.y)*0.5),(uSideZ.x-uSideZ.y)*0.5);
    // 文字は外から見て左から右へ読める向き（車の左側＝前が左・右側＝後ろが左）
    float L=uTxtZ.x-uTxtZ.y, u=vWPos.x>0.0?(uTxtZ.x-vWPos.z)/L:(vWPos.z-uTxtZ.y)/L, v=0.5+dy/uSideW;
    if(u>0.0 && u<1.0 && v>0.0 && v<1.0) sdt=texture2D(uTxt,vec2(u,v)).a;
  }
  sdl*=smoothstep(0.45,0.65,abs(wn.x))*(1.0-isCanvas)*ff;
}
diffuseColor.rgb=mix(diffuseColor.rgb,uCanvasCol,isCanvas);
diffuseColor.rgb=mix(diffuseColor.rgb,uStripeCol,stp);
diffuseColor.rgb=mix(diffuseColor.rgb,uSideCol,sdl*(1.0-sdt)); // 文字は切り抜き＝下の塗装が見える`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
roughnessFactor=mix(roughnessFactor,0.92,isCanvas); metalnessFactor=mix(metalnessFactor,0.0,isCanvas);`)
      .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat*=1.0-isCanvas;
#endif`);
  };
  m.customProgramCacheKey = () => 'paint500';
  return m;
}

function numberTexture(txt){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  g.fillStyle='#fff'; g.beginPath(); g.arc(128,128,120,0,Math.PI*2); g.fill();
  // 細い縁取り（白い車でも丸の縁が見えるように）
  g.strokeStyle='#1a1a1a'; g.lineWidth=5; g.beginPath(); g.arc(128,128,117,0,Math.PI*2); g.stroke();
  // 書体は読み込んで使う（端末まかせにすると iPhone と Windows で字が変わる）。太い字の3桁は丸に収まるよう横だけ縮める
  g.fillStyle='#111'; g.font=(txt.length>2?110:140)+'px '+ZEKKEN_FONT; g.textAlign='center'; g.textBaseline='alphabetic';
  const m=g.measureText(txt), s=Math.min(1,190/m.width);
  g.save(); g.translate(128,128+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2); g.scale(s,1); g.fillText(txt,0,0); g.restore();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
// ナンバープレート＝1951〜76年のイタリアの型（黒地に白字）。後ろ＝2段 275×200mm・前＝1段 262×57mm
// 番号は架空（上段 県名＋紋章＋頭の桁／下段 末尾4桁、前は番号が先で県名が後）
const PLATE_FONT = '"Barlow Condensed","Arial Narrow",sans-serif';
const ZEKKEN_FONT = '"Archivo Black","Arial Black",sans-serif';
// ナンバーとゼッケンの書体をまとめて読み込む
export async function loadPlateFont(){
  const wait = (p,ms) => Promise.race([p, new Promise(r=>setTimeout(r,ms))]);
  let l=document.querySelector('link[data-plate-font]');
  if(!l){
    l=document.createElement('link'); l.rel='stylesheet'; l.dataset.plateFont='1';
    l.href='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500&family=Archivo+Black&family=Michroma&display=block';
    // 字形の定義（CSS）が届く前に fonts.load を呼ぶと、何も待たずに終わる
    const css=new Promise(r=>{ l.onload=l.onerror=r; }); document.head.appendChild(l); await wait(css,3000);
  }
  try{ await wait(Promise.all([document.fonts.load('500 100px "Barlow Condensed"','Roma0'), document.fonts.load('100px "Archivo Black"','0123456789'), document.fonts.load('100px "Michroma"','FIAT ABARTH 5961')]),3000); }catch(e){}
}
// アバルトの帯の文字＝幅の広い書体で「FIAT ABARTH」・数字は輪郭だけ（当時のデカールの見た目）。
// 高さ＝帯の太さ。返す aspect＝横÷縦（帯の太さに掛けると文字の枠の長さになる）
const SIDE_FONT = '"Michroma","Arial Black",sans-serif';
function sideText(kind){
  const H=256, capH=H*0.54, c=document.createElement('canvas'), g=c.getContext('2d');
  const word='FIAT ABARTH', num=kind==='fa'?'':kind, gap=capH*0.9, pad=capH*0.3;
  g.font='100px '+SIDE_FONT; const k=capH/g.measureText('F').actualBoundingBoxAscent, fs=100*k;
  g.font=fs+'px '+SIDE_FONT; g.letterSpacing='0px';
  const w1=g.measureText(word).width, w2=num?g.measureText(num).width:0;
  c.width=Math.ceil(pad*2+w1+(num?gap+w2:0)); c.height=H;
  g.font=fs+'px '+SIDE_FONT; g.textBaseline='alphabetic'; const base=H/2+capH/2;
  g.fillStyle='#fff'; g.fillText(word,pad,base);
  if(num){ g.strokeStyle='#fff'; g.lineWidth=capH*0.09; g.strokeText(num,pad+w1+gap,base); }
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return {tex:t, aspect:c.width/H};
}
// 共和国の紋章（丸に星）を簡略に
function plateEmblem(g,x,y,r){
  g.save(); g.strokeStyle='#eee'; g.lineWidth=r*0.14; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.stroke();
  g.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.3:r*0.72; g.lineTo(x+rr*Math.cos(a),y+rr*Math.sin(a)); }
  g.closePath(); g.fillStyle='#eee'; g.fill(); g.restore();
}
export function plateTexture(kind){
  const c=document.createElement('canvas'), g=c.getContext('2d');
  const W=1024, H = kind==='rear' ? Math.round(W*200/275) : Math.round(W*57/262);
  c.width=W; c.height=H;
  g.fillStyle='#0d0d0d'; g.fillRect(0,0,W,H);
  // 外周の細い白い枠（実物写真＝板の縁が白く光る）
  g.strokeStyle='#d9d9d4'; g.lineWidth=H*(kind==='rear'?0.014:0.035); const m=g.lineWidth*1.2; g.strokeRect(m,m,W-2*m,H-2*m);
  g.fillStyle='#eee'; g.textBaseline='alphabetic'; g.textAlign='left'; // 字の高さは基線から測る
  // 1字ずつ並べる：items＝[{t:字, h:高さの倍率} | {w:空き幅}]。字間 gap は一定、左端 x0〜右端 x1 を埋めるよう字の横幅だけ広げる／詰める
  // 実物（ローマ登録の500の写真）＝字は幅広で字間はほとんど無く、段の端から端まで字で埋まる
  const fontFor=capH=>{ g.font='500 100px '+PLATE_FONT; return 100*capH/g.measureText('0').actualBoundingBoxAscent; };
  function row(items,x0,x1,base,capH,gap){
    const fs=fontFor(capH), set=h=>g.font='500 '+(fs*h)+'px '+PLATE_FONT;
    const ws=items.map(it=>it.t ? (set(it.h||1), g.measureText(it.t).width) : 0), fixed=items.reduce((p,it)=>p+(it.w||0),0);
    const s=Math.min(1.8,(x1-x0-fixed-gap*(items.length-1))/ws.reduce((p,q)=>p+q,0));
    const gp=(x1-x0-fixed-s*ws.reduce((p,q)=>p+q,0))/(items.length-1); // 広げきれない分は字間に回して端を揃える
    const pos=[]; let x=x0;
    items.forEach((it,i)=>{ pos.push(x); if(it.t){ set(it.h||1); g.save(); g.translate(x,base); g.scale(s,1); g.fillText(it.t,0,0); g.restore(); x+=ws[i]*s; } else x+=it.w; x+=gp; });
    return pos;
  }
  if(kind==='rear'){
    // 上段「R OMA 0 0」＝R だけ大きく、OMA は小さい大文字で基線をそろえる（実物写真どおり）。紋章は板の中央・小さい字の上の空き
    // 下段「1 1 0 F」。上下の段とも字の高さは板の約4割、左右の端をそろえる
    const px=W/275, L=14*px, R=W-14*px, capH=H*0.40, gap=H*0.025;
    const base1=H*0.06+capH, base2=H*0.95;
    row([{t:'R'},{t:'O',h:0.55},{t:'M',h:0.55},{t:'A',h:0.55},{t:'0'},{t:'0'}],L,R,base1,capH,gap);
    row([{t:'1'},{t:'1'},{t:'0'},{t:'F'}],L,R,base2,capH,gap);
    plateEmblem(g,W/2,H*0.06+capH*0.22,7*px);
  }else{
    // 「00110F ⊛ ROMA」＝番号が先・県名が後（全部大文字・番号と県名は天地をそろえる＝ユーザー確定）。端から端まで埋める
    const px=W/262, L=10*px, R=W-10*px, capH=H*0.60, er=5*px;
    const pos=row([{t:'00110F'},{w:2*er},{t:'ROMA'}],L,R,H*0.2+capH,capH,H*0.06);
    plateEmblem(g,pos[1]+er,H*0.5,er);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}

function setFinish(m,fin){
  if(fin==='metal'){ m.metalness=0.55; m.roughness=0.32; m.clearcoat=1; }
  else if(fin==='matte'){ m.metalness=0; m.roughness=0.75; m.clearcoat=0; }
  else { m.metalness=0; m.roughness=0.28; m.clearcoat=1; }
  m.needsUpdate=true;
}

export async function loadCar(url){
  const bodyMat = paintMaterial(false), roofMat = paintMaterial(true);
  const rimMat = new THREE.MeshPhysicalMaterial({metalness:0.8,roughness:0.25});
  const seatMat = new THREE.MeshPhysicalMaterial({roughness:0.55,metalness:0,clearcoat:0.3,clearcoatRoughness:0.4});
  // 元データのガラスは濃いグレー・不透明度84%で暗い＝薄い色で透かし、映り込みだけ残す
  const glassMat = new THREE.MeshPhysicalMaterial({color:0xe4ecef,transparent:true,opacity:0.32,roughness:0.02,metalness:0,depthWrite:false,envMapIntensity:2.2,clearcoat:1,clearcoatRoughness:0.02});
  const bumperMat = new THREE.MeshPhysicalMaterial({metalness:1,roughness:0.12});
  const decalMat = new THREE.MeshPhysicalMaterial({transparent:true,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,clearcoat:1,clearcoatRoughness:0.06,roughness:0.4});
  const headMats = [];

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const g = await loader.loadAsync(url);
  const root = new THREE.Group(); root.add(g.scene);
  let doorsMesh = null; const rearPlates = [], wheelParts = {};
  const fontReady = loadPlateFont();
  g.scene.traverse(o => {
    if(!o.isMesh) return;
    const mn = o.material.name, pn = (o.parent && o.parent.name) || '';
    if(mn==='Body_Color'){ o.material = /^Roof/.test(o.name)||/^Roof/.test(pn) ? roofMat : bodyMat; }
    else if(mn==='Glass') o.material = glassMat;
    else if(mn==='Interior_Black_Seat') o.material = seatMat;
    else if(mn==='Rims') o.material = rimMat;
    else if(mn==='Chrome' && /Front_Bumper|Rear_Bumper/.test(o.name) && !/Screws/.test(o.name)) o.material = bumperMat;
    // 板は上半分が「青い帯」の部品・下が白い部品の2つ＝両方を黒い板にして、その上に文字を貼る
    else if(mn==='License_Plate' || mn==='License_Plate_Blue'){ o.material = o.material.clone(); o.material.color.set(0x0d0d0d); rearPlates.push(o); }
    else if(mn==='Headlight_Glass'){ o.material = o.material.clone(); headMats.push(o.material); }
    if(/^Doors/.test(o.name)) doorsMesh = o;
    const w = (o.name+' '+pn).match(/\b(FL|FR|BL|BR)-(Tire|Rim)/);
    if(w) (wheelParts[w[1]] ||= []).push(o);
  });
  root.updateMatrixWorld(true);

  // 車輪＝タイヤとホイールを車輪の中心を軸にした台へ載せ替える（回せるように）
  const wheels = [];
  for(const k of ['FL','FR','BL','BR']){
    const parts = wheelParts[k]; if(!parts) continue;
    const box = new THREE.Box3(); parts.forEach(p=>box.expandByObject(p));
    const pivot = new THREE.Object3D(); box.getCenter(pivot.position); root.add(pivot); root.updateMatrixWorld(true);
    parts.forEach(p=>pivot.attach(p));
    wheels.push({pivot, radius:(box.max.y-box.min.y)/2, front:k[0]==='F', left:k[1]==='L'});
  }
  // 前照灯の位置（動画で光を出すため）
  const heads = [];
  // 左右2灯が1つの部品なので、外寄せの左右2点に分ける（灯の半径＝部品の高さの半分）
  g.scene.traverse(o=>{ if(o.isMesh && o.material && headMats.includes(o.material)){
    const b=new THREE.Box3().setFromObject(o), c=b.getCenter(new THREE.Vector3()), r=(b.max.y-b.min.y)/2;
    heads.push(new THREE.Vector3(b.max.x-r, c.y, c.z), new THREE.Vector3(b.min.x+r, c.y, c.z)); } });

  // ナンバープレート
  await fontReady;
  const plateMat = kind => new THREE.MeshPhysicalMaterial({map:plateTexture(kind),roughness:0.45,metalness:0,clearcoat:0.4,clearcoatRoughness:0.3});
  if(rearPlates.length){
    // 板はエンジンフードに沿って曲がっている＝面に沿うデカールで貼る
    const inv=root.matrixWorld.clone().invert();
    const box=new THREE.Box3(); rearPlates.forEach(p=>box.expandByObject(p)); const c=box.getCenter(new THREE.Vector3());
    // 外向き法線は板の上下で y 0.3〜0.5 と変わる＝中ほどを使い、外れたら角度を振って当て直す
    let n, hit; const ray=new THREE.Raycaster();
    for(const ny of [0.414,0.38,0.45,0.35]){
      n=new THREE.Vector3(0,ny,-Math.sqrt(1-ny*ny)); ray.set(c.clone().addScaledVector(n,2),n.clone().negate());
      hit=ray.intersectObjects(rearPlates,false)[0]; if(hit) break;
    }
    if(hit){
      const x=new THREE.Vector3(-1,0,0), y=new THREE.Vector3().crossVectors(n,x);
      // 板の頂点を x・y 方向へ投影して、実際の広がりと中心を測る（外接箱の角は曲面で外へはみ出すため使わない）
      let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; const v=new THREE.Vector3();
      for(const p of rearPlates){ const a=p.geometry.attributes.position;
        for(let i=0;i<a.count;i++){ v.fromBufferAttribute(a,i).applyMatrix4(p.matrixWorld).sub(hit.point);
          const px=v.dot(x), py=v.dot(y); x0=Math.min(x0,px); x1=Math.max(x1,px); y0=Math.min(y0,py); y1=Math.max(y1,py); } }
      const pos=hit.point.clone().addScaledVector(x,(x0+x1)/2).addScaledVector(y,(y0+y1)/2);
      const rot=new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,n));
      const m=plateMat('rear'); m.polygonOffset=true; m.polygonOffsetFactor=-4; m.depthWrite=false;
      for(const p of rearPlates){
        const geo=new DecalGeometry(p, pos, rot, new THREE.Vector3(x1-x0, y1-y0, 0.5));
        geo.applyMatrix4(inv); root.add(new THREE.Mesh(geo, m));
      }
    }
  }
  {
    // 前＝バンパーの上・エンブレムの下（バンパー上端 y1.039〜エンブレム下端 y1.377 の中ほど）に横長の板
    // 262×57mm＝車の縮尺で 0.68×0.148。この高さの車体の面はほぼ垂直で平ら（中央 z3.857・端 z3.84）
    const w=0.68, h=0.148, d=0.012, black=new THREE.MeshPhysicalMaterial({color:0x0d0d0d,roughness:0.5});
    const front=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), [black,black,black,black,plateMat('front'),black]);
    front.position.set(0, 1.208, 3.857+d/2+0.003); root.add(front);
  }

  let decals = [], lastNb = null, sideTxt = {kind:null};
  function buildDecals(nb){
    decals.forEach(d=>{root.remove(d); d.geometry.dispose();}); decals=[];
    if(!doorsMesh || !nb) return;
    if(decalMat.map) decalMat.map.dispose();
    decalMat.map = numberTexture(nb); decalMat.needsUpdate = true;
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const box=new THREE.Box3().setFromObject(doorsMesh), c=box.getCenter(new THREE.Vector3()).applyMatrix4(inv);
    const ray=new THREE.Raycaster();
    for(const sgn of [1,-1]){
      // ドアの平らな面（高さ0.9〜1.7・1.8に折れ目）の中に収める
      const o=new THREE.Vector3(sgn*6, 1.30, c.z).applyMatrix4(root.matrixWorld);
      const dir=new THREE.Vector3(-sgn,0,0).transformDirection(root.matrixWorld);
      ray.set(o,dir);
      const hit=ray.intersectObject(doorsMesh,false)[0]; if(!hit) continue;
      const q=new THREE.Quaternion().setFromRotationMatrix(root.matrixWorld).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sgn*Math.PI/2, 0)));
      const geo=new DecalGeometry(doorsMesh, hit.point, new THREE.Euler().setFromQuaternion(q), new THREE.Vector3(0.95,0.95,0.8));
      geo.applyMatrix4(inv);
      const m=new THREE.Mesh(geo, decalMat); decals.push(m); root.add(m);
    }
  }

  let curS = null;
  function apply(S){
    curS = S;
    bodyMat.color.set(S.bc); roofMat.color.set(S.tt?S.rc:S.bc);
    setFinish(bodyMat,S.fin); setFinish(roofMat,S.fin);
    U.uCanvas.value=S.cv; U.uCanvasCol.value.set(S.cc);
    U.uStripe.value=S.st; U.uStripeCol.value.set(S.sc); U.uSW.value=S.sw; U.uSG.value=S.sg; U.uSO.value=-S.so; // 車の右＝-x
    U.uSide.value=S.sd; U.uSideCol.value.set(S.sdc); U.uSideY.value=S.sdy; U.uSideW.value=S.sdw;
    const sdt=['595','695','fa'].includes(S.sdt)?S.sdt:'';
    U.uSideT.value = !sdt?0 : sdt==='fa'?2 : 1;
    if(sdt){
      if(sideTxt.kind!==sdt){ if(sideTxt.tex) sideTxt.tex.dispose(); sideTxt={kind:sdt,...sideText(sdt)}; U.uTxt.value=sideTxt.tex; }
      // 文字の枠＝595/695 はドアの前寄り、FIAT ABARTH だけの帯は後ろの端（当時の貼り方）
      const len=S.sdw*sideTxt.aspect, zF=U.uSideZ.value.x, zR=U.uSideZ.value.y, m=0.1;
      if(sdt==='fa') U.uTxtZ.value.set(zR+m+len, zR+m); else U.uTxtZ.value.set(zF-m, zF-m-len);
    }
    seatMat.color.set(S.seat);
    if(S.rim==='body'){ rimMat.color.set(S.bc); rimMat.metalness=0; rimMat.roughness=0.3; }
    else if(S.rim==='white'){ rimMat.color.set('#eeeeea'); rimMat.metalness=0; rimMat.roughness=0.3; }
    else if(S.rim==='black'){ rimMat.color.set('#1b1b1b'); rimMat.metalness=0; rimMat.roughness=0.4; }
    else if(S.rim[0]==='#'){ rimMat.color.set(S.rim); rimMat.metalness=0; rimMat.roughness=0.3; } // パレットで選んだ色
    else { rimMat.color.set('#d8d8d8'); rimMat.metalness=0.85; rimMat.roughness=0.22; }
    if(S.bmp==='body'){ bumperMat.color.set(S.bc); bumperMat.metalness=0; bumperMat.roughness=0.3; }
    else if(S.bmp==='black'){ bumperMat.color.set('#1b1b1b'); bumperMat.metalness=0; bumperMat.roughness=0.5; }
    else if(S.bmp[0]==='#'){ bumperMat.color.set(S.bmp); bumperMat.metalness=0; bumperMat.roughness=0.3; }
    else { bumperMat.color.set('#e6e6e6'); bumperMat.metalness=1; bumperMat.roughness=0.1; }
    if(lastNb!==S.nb){ lastNb=S.nb; buildDecals(S.nb); }
  }
  // 車を動かしたら描画の前に呼ぶ（模様を車に貼り付けたままにする）
  function update(){ root.updateMatrixWorld(true); U.uCarInv.value.copy(root.matrixWorld).invert(); }
  // ボディ色だけを差し替える（動画の塗り替え演出用＝apply より軽い。屋根・ホイール・バンパーが「ボディ同色」ならそれも）
  function setBody(col){
    bodyMat.color.set(col);
    if(curS && !curS.tt) roofMat.color.set(col);
    if(curS && curS.rim==='body') rimMat.color.set(col);
    if(curS && curS.bmp==='body') bumperMat.color.set(col);
  }
  function setHeadlights(k){ headMats.forEach(m=>{ m.emissive.set(0xfff1d6); m.emissiveIntensity=k*6; }); }

  return {root, apply, update, setBody, wheels, heads, setHeadlights, doorsMesh};
}
