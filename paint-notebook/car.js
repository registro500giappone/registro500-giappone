// お絵描き手帳の車（500 L の3Dモデル）を組み立てる＝index.html（塗る画面）と drive.html（走る動画）で共用。
// 座標＝前が+z・上が+y・車の左（運転席）が+x・約2.6027単位/m。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export const DEF = {bc:'#b8261f',fin:'solid',tt:0,rc:'#f1ede2',cv:1,cc:'#1c1c1c',st:0,sc:'#f1ede2',sw:0.44,sg:0.12,so:0,sd:0,sdc:'#f1ede2',sdy:1.25,sdw:0.1,nb:'',rim:'silver',bmp:'chrome',seat:'#2b2624'};

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
float sdl=0.0;
if(uSide>0.5) sdl=band(abs(vWPos.y-uSideY),uSideW*0.5)*smoothstep(0.45,0.65,abs(wn.x))*(1.0-isCanvas)*ff;
diffuseColor.rgb=mix(diffuseColor.rgb,uCanvasCol,isCanvas);
diffuseColor.rgb=mix(diffuseColor.rgb,uStripeCol,stp);
diffuseColor.rgb=mix(diffuseColor.rgb,uSideCol,sdl);`)
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
  g.fillStyle='#111'; g.font='700 '+(txt.length>2?110:140)+'px "Helvetica Neue",Arial,sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(txt,128,138);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
// ナンバープレート＝1951〜76年のイタリアの型（黒地に白字）。後ろ＝2段 275×200mm・前＝1段 262×57mm
// 番号は架空（上段 県名＋紋章＋頭の桁／下段 末尾4桁、前は番号が先で県名が後）
const PLATE_FONT = '"Barlow Condensed","Arial Narrow",sans-serif';
export async function loadPlateFont(){
  const wait = (p,ms) => Promise.race([p, new Promise(r=>setTimeout(r,ms))]);
  let l=document.querySelector('link[data-plate-font]');
  if(!l){
    l=document.createElement('link'); l.rel='stylesheet'; l.dataset.plateFont='1';
    l.href='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500&display=block';
    // 字形の定義（CSS）が届く前に fonts.load を呼ぶと、何も待たずに終わる
    const css=new Promise(r=>{ l.onload=l.onerror=r; }); document.head.appendChild(l); await wait(css,3000);
  }
  try{ await wait(document.fonts.load('500 100px "Barlow Condensed"','Roma0'),3000); }catch(e){}
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
  // 打ち出しの縁（黒い板の縁が光を拾う程度）
  g.strokeStyle='#3a3a3a'; g.lineWidth=H*(kind==='rear'?0.02:0.05); const m=g.lineWidth*1.5; g.strokeRect(m,m,W-2*m,H-2*m);
  g.fillStyle='#eee'; g.textBaseline='middle';
  if(kind==='rear'){
    // 実物（Cosenza・Roma の写真）＝上下の段とも字の高さは板の約4割・左右の端が揃う。
    // 下段の4文字は端から端まで均等に配り、上段は県名を左端・番号を右端に置く（入りきらなければ横だけ詰める）
    const px=W/275, L=16*px, R=W-16*px, capH=H*0.38;
    g.textBaseline='alphabetic'; g.textAlign='left'; // 字の高さは基線から測る（middle のままだと半分に出る）
    g.font='500 100px '+PLATE_FONT; const k=capH/g.measureText('0').actualBoundingBoxAscent;
    g.font='500 '+Math.round(100*k)+'px '+PLATE_FONT;
    const base1=H*0.07+capH, base2=H*0.93;
    const spread=(s,x0,x1,y)=>{ // 1字ずつ、最初の字の左端と最後の字の右端を x0・x1 に合わせて等間隔に置く
      // 実物の下段は字が幅広で字間は字幅の3割ほど＝細長い書体は横に広げて埋める（広げすぎない上限 1.5 倍）
      const n=s.length, ws0=[...s].map(ch=>g.measureText(ch).width), sum0=ws0.reduce((p,q)=>p+q,0);
      const sx=Math.min(1.5,(x1-x0)/(sum0+(n-1)*0.3*sum0/n)), ws=ws0.map(w=>w*sx), gp=(x1-x0-sum0*sx)/(n-1);
      let x=x0; [...s].forEach((ch,i)=>{ g.save(); g.translate(x,y); g.scale(sx,1); g.fillText(ch,0,0); g.restore(); x+=ws[i]+gp; });
    };
    spread('110F',L,R,base2);
    // 紋章は板の中央＝県名は中央の左、番号は中央の右に、紋章の分の隙間を残して収める
    const er=10*px, a=g.measureText('Roma').width, b=g.measureText('00').width, half=W/2-er-5*px-L;
    const sx=Math.min(1,half/a,half/b);
    g.save(); g.translate(L,base1); g.scale(sx,1); g.fillText('Roma',0,0); g.restore();
    g.save(); g.translate(R,base1); g.scale(sx,1); g.textAlign='right'; g.fillText('00',0,0); g.restore();
    plateEmblem(g,W/2,H*0.07+er*1.3,er); // 紋章は小さく、上段の上寄り・板の左右の中央（ユーザー確定）
  }else{
    const px=W/262;
    // 番号・紋章・県名の並び全体を測って中央へ（縁から 14mm は空ける）
    let fs=46*px; const er=8*px, gap=6*px;
    const total=()=>{ g.font='500 '+Math.round(fs)+'px '+PLATE_FONT; return [g.measureText('00110F').width, g.measureText('Roma').width]; };
    let [a,b]=total(); const room=W-28*px;
    if(a+b+2*(er+gap)>room){ fs*=room/(a+b+2*(er+gap)); [a,b]=total(); }
    const x0=(W-(a+b+2*(er+gap)))/2;
    g.textAlign='left'; g.fillText('00110F',x0,H*0.54);
    plateEmblem(g,x0+a+gap+er,H*0.5,er);
    g.fillText('Roma',x0+a+2*(gap+er),H*0.54);
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

  let decals = [], lastNb = null;
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
    seatMat.color.set(S.seat);
    if(S.rim==='body'){ rimMat.color.set(S.bc); rimMat.metalness=0; rimMat.roughness=0.3; }
    else if(S.rim==='white'){ rimMat.color.set('#eeeeea'); rimMat.metalness=0; rimMat.roughness=0.3; }
    else if(S.rim==='black'){ rimMat.color.set('#1b1b1b'); rimMat.metalness=0; rimMat.roughness=0.4; }
    else { rimMat.color.set('#d8d8d8'); rimMat.metalness=0.85; rimMat.roughness=0.22; }
    if(S.bmp==='body'){ bumperMat.color.set(S.bc); bumperMat.metalness=0; bumperMat.roughness=0.3; }
    else if(S.bmp==='black'){ bumperMat.color.set('#1b1b1b'); bumperMat.metalness=0; bumperMat.roughness=0.5; }
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
