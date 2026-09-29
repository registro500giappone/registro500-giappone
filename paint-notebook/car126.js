// お絵描き手帳の車（126 の3Dモデル）を組み立てる＝126.html（塗る画面）と drive.html?car=126（走る動画）で共用。
// 呼び出し口は car.js（500）と同じ＝{root, apply, update, setBody, wheels, heads, setHeadlights}。
// 元のモデルはメートル単位＝500 と同じ縮尺（約2.6027単位/m）に拡大して置く＝視点・影・動画の段取りを 500 と共用できる。
// 座標＝前が+z・上が+y・車の左（運転席）が+x。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {PROVINCES, cleanPlate, cleanText, loadPlateFont} from './car.js?v=35';
export {PROVINCES, cleanPlate, cleanText};

const K = 2.6027;
// 既定＝1972〜76年のイタリア製初期型（白 233・閉じた屋根・外ミラー無し・1976年6月までの登録のナンバー）
export const DEF = {bc:'#eceae2',fin:'solid',tt:0,rc:'#1a1a1a',sr:0,mr:0,st:0,sc:'#b8261f',sw:0.44,sg:0.12,so:0,sd:0,sdc:'#b8261f',sdy:1.25,sdw:0.1,nb:'',rim:'silver',pt:'',pc:'#1a1a1a',ps:0.35,tx:'',tp:'hood',tc:'#1a1a1a',ts:1,pe:'51',pv:'RM',pn:'M1',pl:'2672'};
// 当時の色＝FIAT の色番号と名前（初期型の資料＋1976年の Personal の6色）。色味は写真からの近似（色見本の実測ではない）
export const COLORS = [['#eceae2','Bianco 233'],['#e6dcc0','Avorio Antico 234'],['#d9c9a3','Beige Chiaro 532'],['#e3c45a','Giallo Tufo 246'],['#d2461e','Rosso Arancio 171'],['#b3261e','Rosso Corallo Scuro 165'],['#5e7a2e','Verde Muschio 329'],['#8db255','Verde Chiaro 358'],['#3fa6a0','Turchese Farfalla 463'],['#3f7fb8','Blu Adriatico 408'],['#1f2f55','Blu Scuro 456']];
export const PAT_SIZE = {chk:[0.35,0.15,0.8], dot:[0.45,0.2,1.0], low:[1.2,0.5,2.2]};

export function readHash(){
  const S = {...DEF};
  try{ const h=new URLSearchParams(location.hash.slice(1)); for(const k in DEF){ if(h.has(k)){ const v=h.get(k); S[k]= typeof DEF[k]==='number' ? (+v||0) : v; } } }catch(e){}
  return S;
}

// ---- 車体の形の寸法（元のモデルを実測・単位は拡大後）----
// 屋根＝雨どいより上（y3.12〜）・前後の窓の間。屋根の中心 z は前後の窓の中ほど
const ROOF_Y = 3.12, ROOF_Z = -0.62;
// 後ろのバッジの中心（光を当てる位置）＝右側の通気口の右端のすぐ下・フードの内側（1974年の実車写真）
const BADGE = {x:-1.0, y:1.87};
// 後ろのナンバーの横ずれ（写真から見積もり＝フードの半幅の約2割）
const REAR_PLATE_DX = -0.25;
// 帆布の開閉屋根（注文装備）＝フロントガラスの上端から前席の上まで（屋根の前半分ほど・当時の写真）。幅は雨どいの内側
const SR = {hx:1.0, z0:0.92, z1:-0.4};

const U = {
  uCarInv:{value:new THREE.Matrix4()}, uBody:{value:new THREE.Color()},
  uTT:{value:0}, uRoofCol:{value:new THREE.Color()},
  uSR:{value:0}, uSRCol:{value:new THREE.Color('#1c1c1c')},
  uStripe:{value:0}, uStripeCol:{value:new THREE.Color()}, uSW:{value:0.2}, uSG:{value:0.1}, uSO:{value:0},
  uSide:{value:0}, uSideCol:{value:new THREE.Color()}, uSideY:{value:1.2}, uSideW:{value:0.1},
  uPat:{value:0}, uPatCol:{value:new THREE.Color()}, uPatS:{value:0.35},
};
function paintMaterial(){
  const m = new THREE.MeshPhysicalMaterial({clearcoat:1, clearcoatRoughness:0.06, side:THREE.DoubleSide});
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>','#include <common>\nuniform mat4 uCarInv; varying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvWPos=(uCarInv*modelMatrix*vec4(transformed,1.0)).xyz; vWNrm=normalize(mat3(uCarInv)*mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vWPos; varying vec3 vWNrm;
uniform float uTT,uSR,uStripe,uSW,uSG,uSO,uSide,uSideY,uSideW;
uniform vec3 uRoofCol,uSRCol,uStripeCol,uSideCol;
uniform float uPat,uPatS; uniform vec3 uPatCol;
float band(float d,float hw){ float a=fwidth(d)*1.2+1e-4; return 1.0-smoothstep(hw-a,hw+a,d); }`)
      .replace('#include <color_fragment>',`#include <color_fragment>
vec3 wn=normalize(vWNrm);
float ff=gl_FrontFacing?1.0:0.0;
// 屋根＝雨どいから上。ツートンは屋根だけを塗る
float isRoof=smoothstep(${(ROOF_Y-0.02).toFixed(3)},${(ROOF_Y+0.02).toFixed(3)},vWPos.y)*step(0.2,wn.y);
diffuseColor.rgb=mix(diffuseColor.rgb,uRoofCol,isRoof*uTT);
// 帆布のサンルーフ＝屋根の前寄りの開口に帆布を張る（角を丸めた四角）
float isSR=0.0;
if(uSR>0.5 && wn.y>0.5 && vWPos.y>3.0){
  vec2 q=vec2(abs(vWPos.x), abs(vWPos.z-(${((SR.z0+SR.z1)/2).toFixed(3)})));
  vec2 d=q-vec2(${(SR.hx-0.1).toFixed(3)}, ${((SR.z0-SR.z1)/2-0.1).toFixed(3)});
  float sd=length(max(d,0.0))+min(max(d.x,d.y),0.0)-0.1;
  isSR=1.0-smoothstep(-0.01,0.01,sd);
}
float pat=0.0;
if(uPat>0.5 && uPat<1.5){
  float cx=sin(3.14159*vWPos.x/uPatS), cz=sin(3.14159*(vWPos.z-(${ROOF_Z.toFixed(3)}))/uPatS), k=cx*cz, a=fwidth(k)+1e-4;
  pat=smoothstep(-a,a,k)*isRoof*smoothstep(0.8,0.92,wn.y);
}
if(uPat>1.5 && uPat<2.5){
  vec3 an=abs(wn); vec2 p=(an.x>an.y&&an.x>an.z)?vWPos.zy:(an.y>an.z?vWPos.xz:vWPos.xy);
  vec2 c=p/uPatS; c.x+=0.5*mod(floor(c.y),2.0);
  float d=length(fract(c)-0.5)*uPatS, r=uPatS*0.3, a=fwidth(d)+1e-4;
  pat=1.0-smoothstep(r-a,r+a,d);
}
if(uPat>2.5){ float a=fwidth(vWPos.y)+1e-4; pat=1.0-smoothstep(uPatS-a,uPatS+a,vWPos.y); }
pat*=(1.0-isSR)*ff;
diffuseColor.rgb=mix(diffuseColor.rgb,uPatCol,pat);
float stp=0.0; float ax=abs(vWPos.x);
if(uStripe>0.5 && uStripe<1.5) stp=band(abs(vWPos.x-uSO),uSW*0.5);
if(uStripe>1.5) stp=band(abs(ax-(uSG*0.5+uSW*0.5)),uSW*0.5);
stp*=(1.0-smoothstep(0.6,0.8,abs(wn.x)))*(1.0-isSR)*ff;
float sdl=0.0;
if(uSide>0.5){ sdl=band(abs(vWPos.y-uSideY),uSideW*0.5)*smoothstep(0.45,0.65,abs(wn.x))*ff; }
diffuseColor.rgb=mix(diffuseColor.rgb,uSRCol,isSR);
diffuseColor.rgb=mix(diffuseColor.rgb,uStripeCol,stp);
diffuseColor.rgb=mix(diffuseColor.rgb,uSideCol,sdl);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
roughnessFactor=mix(roughnessFactor,0.92,isSR); metalnessFactor=mix(metalnessFactor,0.0,isSR);`)
      // 元の「126p」の文字（126p 固有＝イタリアの126には無い）の陰が焼き込まれている＝その範囲だけ陰を効かせない
      .replace('#include <aomap_fragment>',`if(!(vWPos.z<-3.7 && vWPos.x>-1.12 && vWPos.x<-0.69 && vWPos.y>1.42 && vWPos.y<1.6)){
#include <aomap_fragment>
}`)
      .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat*=1.0-isSR;
#endif`);
  };
  m.customProgramCacheKey = () => 'paint126';
  return m;
}

const ZEKKEN_FONT = '"Archivo Black","Arial Black",sans-serif';
const PLATE_FONT = '"Barlow Condensed","Arial Narrow",sans-serif';
function numberTexture(txt){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  g.fillStyle='#fff'; g.beginPath(); g.arc(128,128,120,0,Math.PI*2); g.fill();
  g.strokeStyle='#1a1a1a'; g.lineWidth=5; g.beginPath(); g.arc(128,128,117,0,Math.PI*2); g.stroke();
  g.fillStyle='#111'; g.font=(txt.length>2?110:140)+'px '+ZEKKEN_FONT; g.textAlign='center'; g.textBaseline='alphabetic';
  const m=g.measureText(txt), s=Math.min(1,190/m.width);
  g.save(); g.translate(128,128+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2); g.scale(s,1); g.fillText(txt,0,0); g.restore();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
function freeText(txt,col){
  const H=256, c=document.createElement('canvas'), g=c.getContext('2d'), fs=190, pad=24;
  g.font=fs+'px '+ZEKKEN_FONT; c.width=Math.ceil(g.measureText(txt).width+pad*2); c.height=H;
  g.font=fs+'px '+ZEKKEN_FONT; g.fillStyle=col; g.textBaseline='middle'; g.fillText(txt,pad,H*0.54);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return {tex:t, aspect:c.width/H};
}

// ---- ナンバー（年代で型が変わる＝plateTexture126 で描き分ける）----
const plateParts = S => ({ e:S.pe, v:PROVINCES.some(p=>p[0]===S.pv)?S.pv:'RM', n:cleanPlate(S.pn,2).padStart(2,'0'), l:cleanPlate(S.pl,4).padStart(4,'0') });
function plateEmblem(g,x,y,r,col){
  g.save(); g.strokeStyle=col; g.lineWidth=r*0.14; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.stroke();
  g.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.3:r*0.72; g.lineTo(x+rr*Math.cos(a),y+rr*Math.sin(a)); }
  g.closePath(); g.fillStyle=col; g.fill(); g.restore();
}
// 1字ずつ並べて左端 x0〜右端 x1 を埋める（car.js と同じやり方）
function plateRow(g,items,x0,x1,base,capH,gap,font=PLATE_FONT,wt='500'){
  g.font=wt+' 100px '+font; const fs=100*capH/g.measureText('0').actualBoundingBoxAscent, set=h=>g.font=wt+' '+(fs*h)+'px '+font;
  const ws=items.map(it=>it.t ? (set(it.h||1), g.measureText(it.t).width) : 0), fixed=items.reduce((p,it)=>p+(it.w||0),0);
  const s=Math.min(1.8,(x1-x0-fixed-gap*(items.length-1))/ws.reduce((p,q)=>p+q,0));
  const gp=(x1-x0-fixed-s*ws.reduce((p,q)=>p+q,0))/Math.max(1,items.length-1);
  const pos=[]; let x=x0;
  items.forEach((it,i)=>{ pos.push(x); if(it.t){ set(it.h||1); g.save(); g.translate(x,base); g.scale(s,1); g.fillText(it.t,0,0); g.restore(); x+=ws[i]*s; } else x+=it.w; x+=gp; });
  return pos;
}
// 板の寸法（mm）＝前 262×57（1951〜85年で同じ）／後ろ〜1976年6月 275×200 の正方形2段／
// 後ろ1976年6月〜 橙の県名板 200×107 を番号板 330×107 の上に重ねた2段（正方形の取付部の車＝初期の126）
export const PLATE_MM = {front:[262,57], rear51:[275,200], rear76:[330,214]};
const ORANGE = '#f08a1c';
// 返す＝{tex, mm:[幅,高さ]}。rear76 は県名板の左右が空く＝透明（アルファで切り抜く）
export function plateTexture126(kind, P){
  const key = kind==='front' ? 'front' : (P.e==='76' ? 'rear76' : 'rear51'), [MW,MH]=PLATE_MM[key];
  const c=document.createElement('canvas'), g=c.getContext('2d'), W=1024, H=Math.round(W*MH/MW), px=W/MW;
  c.width=W; c.height=H; g.textBaseline='alphabetic'; g.textAlign='left';
  // 板1枚＝黒地に細い白い縁
  const board=(x,y,w,h,lw)=>{ g.fillStyle='#0d0d0d'; g.fillRect(x,y,w,h); g.strokeStyle='#d9d9d4'; g.lineWidth=lw; const m=lw*1.2; g.strokeRect(x+m,y+m,w-2*m,h-2*m); };
  const num=P.n+P.l;
  if(key==='front'){
    board(0,0,W,H,H*0.035); g.fillStyle='#eee';
    const L=10*px, R=W-10*px, capH=H*0.60, er=5*px;
    const pos=plateRow(g,[{t:num},{w:2*er},{t:P.v==='RM'?'ROMA':P.v}],L,R,H*0.2+capH,capH,H*0.06);
    plateEmblem(g,pos[1]+er,H*0.5,er,'#eee');
  }else if(key==='rear51'){
    // 上段＝県名・紋章・番号の頭2桁／下段＝下4桁。ローマは「R＋小さい OMA」（500 の当時の写真と同じ型）
    board(0,0,W,H,H*0.014); g.fillStyle='#eee';
    const L=14*px, R=W-14*px, capH=H*0.40, gap=H*0.025, base1=H*0.06+capH, base2=H*0.95;
    if(P.v==='RM'){
      plateRow(g,[{t:'R'},{t:'O',h:0.55},{t:'M',h:0.55},{t:'A',h:0.55},{t:P.n[0]},{t:P.n[1]}],L,R,base1,capH,gap);
      plateEmblem(g,W/2,H*0.06+capH*0.22,7*px,'#eee');
    }else{
      const er=9*px, pos=plateRow(g,[{t:P.v[0]},{t:P.v[1]},{w:2*er},{t:P.n[0]},{t:P.n[1]}],L,R,base1,capH,gap);
      plateEmblem(g,pos[2]+er,H*0.06+capH*0.5,er,'#eee');
    }
    plateRow(g,[...P.l].map(t=>({t})),L,R,base2,capH,gap);
  }else{
    // 上＝県名板（黒地に橙の字・ローマは R だけ大きい「ROMA」＝当時の実物写真と同じ）
    // 県名板は長短2種＝正方形の取付部の車は長い方（県名を中央）を番号板の上に付ける
    const hTop=107*px, wTop=W, xTop=0;
    board(xTop,0,wTop,hTop,hTop*0.03); g.fillStyle=ORANGE;
    { const capH=hTop*0.72, base=hTop*0.5+capH/2;
      if(P.v==='RM') plateRow(g,[{t:'R'},{t:'O',h:0.62},{t:'M',h:0.62},{t:'A',h:0.62}],W*0.16,W*0.84,base,capH,hTop*0.04);
      else plateRow(g,[{t:P.v[0]},{t:P.v[1]}],W*0.3,W*0.7,base,capH,hTop*0.3); }
    // 下＝番号板（左に上から丸い刻印の欄・小さい県名の繰り返し・紋章／番号は1行）
    const y2=H-107*px, h2=107*px; board(0,y2,W,h2,h2*0.03); g.fillStyle='#eee';
    const lx=14*px+h2*0.16;
    g.strokeStyle='rgba(238,238,238,0.35)'; g.lineWidth=px*0.8; g.beginPath(); g.arc(lx,y2+h2*0.27,h2*0.15,0,Math.PI*2); g.stroke();
    g.font='500 '+(h2*0.2)+'px '+PLATE_FONT; g.textAlign='center'; g.fillText(P.v,lx,y2+h2*0.68); g.textAlign='left';
    plateEmblem(g,lx,y2+h2*0.84,h2*0.07,'#eee');
    const capH=h2*0.72; plateRow(g,[...num].map(t=>({t})),lx+h2*0.22,W-14*px,y2+h2*0.5+capH/2,capH,h2*0.04);
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return {tex:t, mm:[MW,MH]};
}

// ---- エンブレム（前・後ろ）＝絵を描いて面に貼る ----
// 返す map（色・アルファで形）・mr（青＝金属・緑＝粗さ）・w/h（拡大後の単位）
function emblemFront(kind){
  const M=K/1000, W=1024, H=256, w=120*M, h=30*M;
  const mk=()=>{ const c=document.createElement('canvas'); c.width=W; c.height=H; return [c,c.getContext('2d')]; };
  const [map,g]=mk(), [mr,q]=mk();
  const sk=70, cell=(W-sk)/4;
  const para=(c,x0,x1,i)=>{ c.beginPath(); c.moveTo(x0+sk+i,i); c.lineTo(x1+sk-i,i); c.lineTo(x1-i,H-i); c.lineTo(x0+i,H-i); c.closePath(); };
  { const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#f2f2f0'); gr.addColorStop(0.5,'#9c9c9c'); gr.addColorStop(1,'#dededc'); g.fillStyle=gr; }
  para(g,0,W-sk,0); g.fill(); q.fillStyle='rgb(0,32,255)'; para(q,0,W-sk,0); q.fill();
  for(let k=0;k<4;k++){
    const x0=k*cell, x1=x0+cell;
    g.fillStyle='#141414'; para(g,x0,x1,14); g.fill(); q.fillStyle='rgb(0,170,0)'; para(q,x0,x1,14); q.fill();
    for(const [c,col] of [[g,'#e4e4e2'],[q,'rgb(0,32,255)']]){
      c.save(); c.translate(x0+cell/2+sk/2, H*0.5); c.transform(1,0,-sk/H,1,0,0);
      c.font='150px "Michroma","Arial Black",sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle=col; c.fillText('FIAT'[k],0,6); c.restore();
    }
  }
  const t=new THREE.CanvasTexture(map); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  const t2=new THREE.CanvasTexture(mr); t2.anisotropy=8;
  return {map:t, mr:t2, w, h};
}

// 後ろのバッジ（初期型）＝「FIAT」の上段と「126」の下段。字は1字ずつ枠に入る（メッキの枠に黒地・銀の字）。
// 形は当時の写真（Wikimedia Commons "FIAT 126 scritta"＝Personal 4 の3段版）から。大きさは写真の比からの推定＝約90×52mm
function badgeRear(){
  const M=K/1000, W=900, H=520, w=90*M, h=52*M;
  const mk=()=>{ const c=document.createElement('canvas'); c.width=W; c.height=H; return [c,c.getContext('2d')]; };
  const [map,g]=mk(), [mr,q]=mk(), CH='rgb(0,40,255)', DK='rgb(0,170,0)';
  const chrome=()=>{ const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#f4f4f2'); gr.addColorStop(0.5,'#9a9a9a'); gr.addColorStop(1,'#e2e2e0'); return gr; };
  g.fillStyle=chrome(); g.beginPath(); g.roundRect(0,0,W,H,26); g.fill(); q.fillStyle=CH; q.fillRect(0,0,W,H);
  const rows=[['F','I','A','T'],['1','2','6']], pad=22, gap=14, rh=(H-2*pad-gap)/2;
  rows.forEach((row,r)=>{
    const y=pad+r*(rh+gap), cw=(W-2*pad-gap*(row.length-1))/row.length;
    row.forEach((ch,i)=>{
      const x=pad+i*(cw+gap);
      g.fillStyle='#121212'; g.beginPath(); g.roundRect(x,y,cw,rh,10); g.fill(); q.fillStyle=DK; q.fillRect(x,y,cw,rh);
      for(const [c,col] of [[g,chrome()],[q,CH]]){
        c.save(); c.font='600 '+(rh*0.95)+'px '+PLATE_FONT; c.textAlign='center'; c.textBaseline='alphabetic';
        const m=c.measureText(ch), cap=m.actualBoundingBoxAscent; c.translate(x+cw/2, y+rh/2+cap/2); c.scale(1,rh*0.74/cap);
        c.fillStyle=col; c.fillText(ch,0,0); c.restore();
      }
    });
  });
  const t=new THREE.CanvasTexture(map); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  const t2=new THREE.CanvasTexture(mr); t2.anisotropy=8;
  return {map:t, mr:t2, w, h};
}

// 元のモデル（126p の後期）の横長のナンバー取付部＝黒い樹脂。初期型は正方形の板を車体に直に付ける＝この範囲は車体の色で塗る
// 範囲は実測（後ろ z-3.9・|x|≦0.62・y1.2〜1.47／前 z3.71・y0.6〜0.87）
function plasticMaterial(src){
  const m=src.clone();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {uCarInv:U.uCarInv, uBody:U.uBody});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>',`#include <common>
uniform mat4 uCarInv; varying vec3 vCPos;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
vCPos=(uCarInv*modelMatrix*vec4(transformed,1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec3 vCPos; uniform vec3 uBody; float plateArea=0.0;`)
      .replace('#include <color_fragment>',`#include <color_fragment>
if(abs(vCPos.x)<0.64 && ((vCPos.z<-3.75 && vCPos.y>1.18 && vCPos.y<1.49) || (vCPos.z>3.6 && vCPos.y>0.58 && vCPos.y<0.89))){ plateArea=1.0; diffuseColor.rgb=uBody*0.86; }`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,0.3,plateArea);`)
      .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
metalnessFactor=mix(metalnessFactor,0.0,plateArea);`)
      // くぼみの陰は真っ黒に焼き込まれている＝塗った範囲は陰を効かせない
      .replace('#include <aomap_fragment>',`if(plateArea<0.5){
#include <aomap_fragment>
}`);
  };
  m.customProgramCacheKey = () => 'plastic126';
  return m;
}

function setFinish(m,fin){
  if(fin==='metal'){ m.metalness=0.55; m.roughness=0.32; m.clearcoat=1; }
  else if(fin==='matte'){ m.metalness=0; m.roughness=0.75; m.clearcoat=0; }
  else { m.metalness=0; m.roughness=0.28; m.clearcoat=1; }
  m.needsUpdate=true;
}

export async function loadCar(url){
  const bodyMat = paintMaterial();
  const glassMat = new THREE.MeshPhysicalMaterial({color:0xe4ecef,transparent:true,opacity:0.32,roughness:0.02,metalness:0,depthWrite:false,envMapIntensity:2.2,clearcoat:1,clearcoatRoughness:0.02});
  const decalMat = new THREE.MeshPhysicalMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,clearcoat:1,clearcoatRoughness:0.06,roughness:0.4});
  let rimMat = null, metalMat = null, plasticMat = null; const headMats = [];

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const g = await loader.loadAsync(url);
  const root = new THREE.Group(); g.scene.scale.setScalar(K); root.add(g.scene);
  let bodyMesh = null, plateMesh = null; const frontLogo = [], rearLogo = [], mirrors = [], mirrorHosts = [], wheelNodes = {};
  const fontReady = loadPlateFont();
  // 前輪は元のモデルでは右へ切ってある＝後輪と同じ向きに戻す（まっすぐ走らせるため）
  const wq = {};
  g.scene.traverse(o => { const w=(o.name||'').match(/^Fiat_126P_Wheel_(Front|Rear)_(Left|Right)/); if(w) wq[w[1][0]+w[2][0]]=o; });
  if(wq.FL && wq.RL) wq.FL.quaternion.copy(wq.RL.quaternion);
  if(wq.FR && wq.RR) wq.FR.quaternion.copy(wq.RR.quaternion);
  for(const k in wq) wheelNodes[k]=wq[k];
  root.updateMatrixWorld(true);
  g.scene.traverse(o => {
    if(!o.isMesh) return;
    const mn = o.material.name;
    if(mn==='Scene') o.visible = false; // 元のモデルの地面（影の板）＝この画面は自前の影を敷く
    // 塗装＝元の材質の陰（AO）だけ引き継ぐ＝継ぎ目・ドアの隙間の影が残る
    else if(mn==='Fiat_126P_Car_paint'){ if(o.material.aoMap){ bodyMat.aoMap=o.material.aoMap; bodyMat.aoMapIntensity=1; } o.material = bodyMat; bodyMesh = o; }
    else if(mn==='Fiat_126P_Windows') o.material = glassMat;
    else if(mn==='Fiat_126P_Rim'){ if(!rimMat){ rimMat=o.material.clone(); } o.material = rimMat; }
    else if(mn==='Fiat_126P_Plastic'){ if(!plasticMat) plasticMat=plasticMaterial(o.material); o.material=plasticMat; }
    else if(mn==='Fiat_126P_Metal'){ if(!metalMat){ metalMat=o.material.clone(); } o.material = metalMat; }
    else if(mn==='Fiat_126P_License_plate'){ o.material = new THREE.MeshPhysicalMaterial({color:0x0d0d0d,roughness:0.5}); plateMesh = o; }
    // 灯火の反射板は元のモデルでは点灯している（発光10）＝消しておく。前照灯だけ動画で点ける
    else if(/^Fiat_126P_Reflector_/.test(mn)){ o.material = o.material.clone(); o.material.emissiveIntensity = 0; if(mn==='Fiat_126P_Reflector_Headlight'){ o.material.emissive.set(0xfff1d6); headMats.push(o.material); } }
    else if(mn==='Fiat_126P_Fiat_Front_Emblem'){ frontLogo.push(o); }
    else if(mn==='Fiat_126P_Mirror'){ mirrors.push(o); }
    // 前の小灯は初期型では白いレンズ（車幅灯とウインカーを兼ねる・1976年から橙）＝前の2つだけ白く、側面の方向指示器は橙のまま
    else if(mn==='Fiat_126P_Turnsignal_Glass'){
      o.material=o.material.clone(); o.material.color.set(0xffffff); o.material.vertexColors=true;
      const a=o.geometry.attributes.position, col=new Float32Array(a.count*3), v=new THREE.Vector3();
      for(let i=0;i<a.count;i++){ v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld); const front=v.z>3.2; col.set(front?[0.95,0.95,0.93]:[1,0.244,0.019],i*3); }
      o.geometry=o.geometry.clone(); o.geometry.setAttribute('color',new THREE.BufferAttribute(col,3)); }
    else if(mn==='Fiat_126P_Rear_Emblem'){ rearLogo.push(o); }
    if(mn==='Fiat_126P_Metal'||mn==='Fiat_126P_Plastic') mirrorHosts.push(o);
  });
  // ドアミラーの鏡以外（メッキの殻と樹脂の腕）はメッキ・樹脂の部品に混ざっている＝車体の外へ張り出した三角形だけ切り出して別部品にする
  // （初期型はミラー無しが標準＝1976年に義務化。付け外しを切り替えられるように）
  mirrorHosts.forEach(o => {
    const gm=o.geometry, pos=gm.attributes.position, idx=gm.index?gm.index.array:[...Array(pos.count).keys()], v=new THREE.Vector3();
    const out=(i)=>{ v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld); return Math.abs(v.x)>1.73 && v.y>2.0 && v.y<2.45 && v.z>1.05 && v.z<1.45; };
    const keep=[], take=[];
    for(let t=0;t<idx.length;t+=3){ const a=idx[t],b=idx[t+1],c=idx[t+2]; (out(a)||out(b)||out(c)?take:keep).push(a,b,c); }
    if(!take.length) return;
    const g2=new THREE.BufferGeometry(); for(const k in gm.attributes) g2.setAttribute(k,gm.attributes[k]); g2.setIndex(take);
    const g1=gm.clone(); g1.setIndex(keep); o.geometry=g1;
    const m=new THREE.Mesh(g2,o.material); m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); o.parent.add(m); mirrors.push(m);
  });
  root.updateMatrixWorld(true);

  // 車輪＝タイヤとホイールを車輪の中心を軸にした台へ載せ替える
  const wheels = [];
  for(const k of ['FL','FR','RL','RR']){
    const n = wheelNodes[k]; if(!n) continue;
    const parts=[]; n.traverse(o=>{ if(o.isMesh) parts.push(o); });
    const box = new THREE.Box3(); parts.forEach(p=>box.expandByObject(p));
    const pivot = new THREE.Object3D(); box.getCenter(pivot.position); root.worldToLocal(pivot.position); root.add(pivot); root.updateMatrixWorld(true);
    parts.forEach(p=>pivot.attach(p));
    wheels.push({pivot, radius:(box.max.y-box.min.y)/2, front:k[0]==='F', left:k[1]==='L'});
  }
  const heads = [];
  g.scene.traverse(o=>{ if(o.isMesh && headMats.includes(o.material)){
    const b=new THREE.Box3().setFromObject(o), c=b.getCenter(new THREE.Vector3()), r=(b.max.y-b.min.y)/2;
    heads.push(new THREE.Vector3(b.max.x-r, c.y, c.z), new THREE.Vector3(b.min.x+r, c.y, c.z)); } });

  // ナンバー＝元の板（ポーランドの今の型・前後が1つの部品）は隠し、イタリアの当時の寸法の板を同じ場所へ立てる。
  // 元の板は前後とも垂直の平面（前 z3.708・後ろ z-3.9）。前は板の中心に、後ろは下端をそろえて置く（正方形の板は背が高い）
  await fontReady;
  const plates = {};
  if(plateMesh){
    plateMesh.visible=false;
    const a=plateMesh.geometry.attributes.position, v=new THREE.Vector3(), ext={};
    for(let i=0;i<a.count;i++){ v.fromBufferAttribute(a,i).applyMatrix4(plateMesh.matrixWorld); const k=v.z>0?'front':'rear';
      const e=ext[k]||(ext[k]={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z:v.z}); e.x0=Math.min(e.x0,v.x); e.x1=Math.max(e.x1,v.x); e.y0=Math.min(e.y0,v.y); e.y1=Math.max(e.y1,v.y); }
    for(const kind of ['front','rear']){
      const e=ext[kind]; if(!e) continue; const sg=kind==='front'?1:-1;
      const m=new THREE.MeshPhysicalMaterial({roughness:0.45,metalness:0,clearcoat:0.4,clearcoatRoughness:0.3,transparent:true,alphaTest:0.5});
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1), m);
      // 後ろは中心より車の右側（-x）へ寄せる＝初期型の実車写真2枚（1973年英国・1974年ペルージャ）がどちらも取っ手の軸より右
      mesh.rotation.y = sg>0 ? 0 : Math.PI; mesh.position.set((e.x0+e.x1)/2+(sg<0?REAR_PLATE_DX:0), 0, e.z+sg*0.012);
      root.add(mesh); plates[kind]={mat:m, mesh, cy:(e.y0+e.y1)/2, y0:e.y0};
    }
  }

  // 前のエンブレム＝元の「POLSKI FIAT」の位置へ前から当てて貼る
  let emMesh=null, lastEm=null;
  function buildEmblem(kind){
    if(emMesh){ root.remove(emMesh); emMesh.geometry.dispose(); emMesh.material.map.dispose(); emMesh.material.metalnessMap.dispose(); emMesh.material.dispose(); emMesh=null; }
    frontLogo.forEach(o=>o.visible=false);
    if(!bodyMesh) return;
    root.updateMatrixWorld(true);
    const box=new THREE.Box3(); frontLogo.forEach(o=>box.expandByObject(o)); const c=box.getCenter(new THREE.Vector3());
    const ray=new THREE.Raycaster(); ray.set(new THREE.Vector3(c.x,c.y,c.z+3), new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObject(bodyMesh,false)[0]; if(!hit) return;
    const T=emblemFront(kind);
    const mat=new THREE.MeshPhysicalMaterial({map:T.map, metalnessMap:T.mr, roughnessMap:T.mr, metalness:1, roughness:1, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4});
    const geo=new DecalGeometry(bodyMesh, hit.point, new THREE.Euler(), new THREE.Vector3(T.w,T.h,0.5));
    geo.applyMatrix4(root.matrixWorld.clone().invert()); emMesh=new THREE.Mesh(geo,mat); root.add(emMesh);
  }

  // 後ろのバッジ＝エンジンフードの右上（後ろから見て右＝車の右 -x）・右のルーバーの外側、ルーバーと同じ高さ（初期型の写真）。
  // 元の「126p」の文字（フードの右下）は隠す
  let badgeMesh=null;
  function buildBadge(){
    rearLogo.forEach(o=>o.visible=false);
    if(!bodyMesh) return;
    root.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(); ray.set(new THREE.Vector3(BADGE.x,BADGE.y,-10), new THREE.Vector3(0,0,1));
    const hit=ray.intersectObject(bodyMesh,false)[0]; if(!hit) return;
    const T=badgeRear();
    const mat=new THREE.MeshPhysicalMaterial({map:T.map, metalnessMap:T.mr, roughnessMap:T.mr, metalness:1, roughness:1, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-4});
    const geo=new DecalGeometry(bodyMesh, hit.point, new THREE.Euler(0,Math.PI,0), new THREE.Vector3(T.w,T.h,0.5));
    geo.applyMatrix4(root.matrixWorld.clone().invert()); badgeMesh=new THREE.Mesh(geo,mat); root.add(badgeMesh);
  }

  // ドアの中心（ゼッケン・文字の置き場所）＝前の窓の後端〜後輪の前（実測）
  const DOOR = {z:0.45, w:1.6};
  let decals=[], lastNb=null;
  function buildDecals(nb){
    decals.forEach(d=>{root.remove(d); d.geometry.dispose();}); decals=[];
    if(!bodyMesh || !nb) return;
    if(decalMat.map) decalMat.map.dispose();
    decalMat.map=numberTexture(nb); decalMat.needsUpdate=true;
    root.updateMatrixWorld(true);
    const mw=root.matrixWorld, inv=mw.clone().invert(), ray=new THREE.Raycaster(), size=0.9, cy=1.55;
    for(const sgn of [1,-1]){
      ray.set(new THREE.Vector3(sgn*6,cy,DOOR.z).applyMatrix4(mw), new THREE.Vector3(-sgn,0,0).transformDirection(mw));
      const hit=ray.intersectObject(bodyMesh,false)[0]; if(!hit) continue;
      const q=new THREE.Quaternion().setFromRotationMatrix(mw).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,sgn*Math.PI/2,0)));
      const geo=new DecalGeometry(bodyMesh, hit.point, new THREE.Euler().setFromQuaternion(q), new THREE.Vector3(size,size,0.8));
      geo.applyMatrix4(inv); const m=new THREE.Mesh(geo,decalMat); decals.push(m); root.add(m);
    }
  }

  const textMat = new THREE.MeshPhysicalMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,clearcoat:1,clearcoatRoughness:0.06,roughness:0.4});
  let textMeshes=[], lastTx=null;
  function buildText(tx,tp,tc,ts){
    textMeshes.forEach(m=>{root.remove(m); m.geometry.dispose();}); textMeshes=[];
    if(textMat.map){ textMat.map.dispose(); textMat.map=null; }
    if(!tx || !bodyMesh) return;
    const T=freeText(tx,tc); textMat.map=T.tex; textMat.needsUpdate=true;
    root.updateMatrixWorld(true);
    const mw=root.matrixWorld, inv=mw.clone().invert(), rw=new THREE.Matrix4().extractRotation(mw), ray=new THREE.Raycaster();
    const spots = tp==='door'
      ? [1,-1].map(s=>[new THREE.Vector3(s*6,1.15,DOOR.z), new THREE.Vector3(-s,0,0), new THREE.Vector3(0,0,-s), DOOR.w*0.8, 0.3])
      : tp==='side'
      ? [1,-1].map(s=>[new THREE.Vector3(s*6,1.6,-1.2), new THREE.Vector3(-s,0,0), new THREE.Vector3(0,0,-s), 0.95, 0.3])
      : [[new THREE.Vector3(0,10,2.75), new THREE.Vector3(0,-1,0), new THREE.Vector3(1,0,0), 1.4, 0.34]];
    for(const [o,dir,xr,maxW,maxH] of spots){
      ray.set(o.clone().applyMatrix4(mw), dir.clone().transformDirection(mw));
      const hit=ray.intersectObject(bodyMesh,false)[0]; if(!hit) continue;
      const n=dir.clone().negate(), x=xr.clone().addScaledVector(n,-xr.dot(n)).normalize(), y=new THREE.Vector3().crossVectors(n,x);
      const rot=new THREE.Euler().setFromRotationMatrix(rw.clone().multiply(new THREE.Matrix4().makeBasis(x,y,n)));
      const k=Math.min(1.6,Math.max(0.3,ts||1)), h=Math.min(maxH*k,maxW*k/T.aspect);
      const geo=new DecalGeometry(bodyMesh, hit.point, rot, new THREE.Vector3(h*T.aspect,h,0.4));
      geo.applyMatrix4(inv); const m=new THREE.Mesh(geo,textMat); textMeshes.push(m); root.add(m);
    }
  }

  buildEmblem(); buildBadge();
  let curS=null, lastPl=null;
  function apply(S){
    curS=S;
    bodyMat.color.set(S.bc); U.uBody.value.set(S.bc); setFinish(bodyMat,S.fin);
    U.uTT.value=S.tt; U.uRoofCol.value.set(S.rc); U.uSR.value=S.sr;
    U.uStripe.value=S.st; U.uStripeCol.value.set(S.sc); U.uSW.value=S.sw; U.uSG.value=S.sg; U.uSO.value=-S.so;
    U.uSide.value=S.sd; U.uSideCol.value.set(S.sdc); U.uSideY.value=S.sdy; U.uSideW.value=S.sdw;
    const pt=['chk','dot','low'].indexOf(S.pt)+1;
    U.uPat.value=pt; U.uPatCol.value.set(S.pc);
    if(pt){ const [,lo,hi]=PAT_SIZE[S.pt]; U.uPatS.value=Math.min(hi,Math.max(lo,S.ps)); }
    const tx=cleanText(S.tx), tp=['side','door'].includes(S.tp)?S.tp:'hood', ts=Math.min(1.6,Math.max(0.3,S.ts||1)), txKey=[tx,tp,S.tc,ts].join('|');
    if(lastTx!==txKey){ lastTx=txKey; buildText(tx,tp,S.tc,ts); }
    if(rimMat){
      if(S.rim==='body'){ rimMat.color.set(S.bc); rimMat.metalness=0; rimMat.roughness=0.3; }
      else if(S.rim==='white'){ rimMat.color.set('#eeeeea'); rimMat.metalness=0; rimMat.roughness=0.3; }
      else if(S.rim==='black'){ rimMat.color.set('#1b1b1b'); rimMat.metalness=0; rimMat.roughness=0.4; }
      else if(S.rim[0]==='#'){ rimMat.color.set(S.rim); rimMat.metalness=0; rimMat.roughness=0.3; }
      else { rimMat.color.set('#ffffff'); rimMat.metalness=1; rimMat.roughness=1; }
    }
    mirrors.forEach(o=>o.visible=!!S.mr);
    const P=plateParts(S), plKey=[P.e,P.v,P.n,P.l].join('|');
    if(plKey!==lastPl){ lastPl=plKey; for(const k in plates){ const p=plates[k], T=plateTexture126(k,P); if(p.mat.map) p.mat.map.dispose(); p.mat.map=T.tex; p.mat.needsUpdate=true;
      const w=T.mm[0]*K/1000, h=T.mm[1]*K/1000; p.mesh.scale.set(w,h,1); p.mesh.position.y = k==='front' ? p.cy : p.y0+h/2; } }
    if(lastNb!==S.nb){ lastNb=S.nb; buildDecals(S.nb); }
  }
  function update(){ root.updateMatrixWorld(true); U.uCarInv.value.copy(root.matrixWorld).invert(); }
  function setBody(col){
    bodyMat.color.set(col); U.uBody.value.set(col);
    if(curS && curS.rim==='body' && rimMat) rimMat.color.set(col);
  }
  function setHeadlights(k){ headMats.forEach(m=>{ m.emissive.set(0xfff1d6); m.emissiveIntensity=k*6; }); }
  return {root, apply, update, setBody, wheels, heads, setHeadlights, bodyMesh};
}
