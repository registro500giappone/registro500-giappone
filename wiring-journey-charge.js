/* 旅ページ第1号「チャージランプが消えない」共通描画。
   ダイナモ版 wiring-journey-charge.html と オルタ版 wiring-journey-charge-alt.html の2ページで共有する。
   オルタ版は読み込み前に window.JOURNEY_ALT = true を立てる。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。 */
(function(){
  'use strict';
  var ALT = !!window.JOURNEY_ALT;
  var NET=null, PATCHES=null;

  /* 被覆色（原典の色名 → 画面の色）。案C＝線は被覆色・通電は黄点の動き・無電は薄く */
  var WC={ROSSO:'#c0392b',AZZURRO:'#4a9fd8',VERDE:'#2f7d4f',MARRONE:'#6f4a2a',NERO:'#33302b',GRIGIO:'#8d8574'};
  var C={deep:'#2c3a31',body:'#3f5347',in_:'#e6e0d0',sub:'#8d8574',hi:'#b8442e',dim:'#ddd5c4',out:'#c9c2b1',ok:'#2f7d4f'};

  /* 場面を作る＝controls を通して部品位置を決め、必要なら故障を直接上書きして solve する */
  function scenario(o){
    o=o||{};
    var alt = ('alt' in o) ? o.alt : ALT;
    var net = NET;
    if(alt) net = WiringSim.applyPatches(NET, PATCHES.patches, {generator:'オルタネーター'}, 'F');
    var pos = WiringSim.positionsFrom(net, o.inputs||{}, 'F');
    if(o.override) for(var k in o.override) pos[k]=o.override[k];
    var r = WiringSim.solve(net, {type:'F', positions:pos});
    var lamp=null;
    for(var i=0;i<r.loads.length;i++) if(r.loads[i].id==='quadro.warn_charge') lamp=r.loads[i];
    /* 充電＝発電源が回っていて、B+ と導体だけで同じ成分（＝カットアウト/内蔵レギュが閉） */
    var charging = alt
      ? (pos.alternator==='RUN' && r.comp['alternator.D+']===r.comp['battery.+'])
      : (pos.dynamo==='RUN' && r.comp['dynamo.51']===r.comp['battery.+']);
    return {r:r, pos:pos, lampOn:lamp?lamp.on:false, charging:charging, alt:alt};
  }

  /* ---- 旅の絵（縦の滝）。線1本ごとに netlist の wire id を対応させ、状態で塗る ---- */
  var X=100, RX=235;                         /* 主列と、充電が戻る右の道 */
  function draw(sc, mode){
    mode=mode||{};
    var r=sc.r, pos=sc.pos, s=[];
    function wcol(id, fallback){             /* wire id → 状態つきの色 */
      var w=null; for(var i=0;i<r.wires.length;i++) if(r.wires[i].id===id) w=r.wires[i];
      var col = w&&w.color ? WC[w.color] : (fallback||C.sub);
      var st = r.wire[id];
      return { col:(st==='off'||st===undefined)?C.dim:col, live:(st==='hot'||st==='gnd') };
    }
    function dots(x,y1,y2,up){               /* 縦線に流れる黄点（CSSで縦に動く） */
      for(var y=y1;y<=y2;y+=22)
        s.push('<circle class="'+(up?'dot up':'dot')+'" cx="'+x+'" cy="'+y+'" r="4.6"/>');
    }
    function dotsH(y,x1,x2,dir){             /* 横線に流れる黄点（dir='right'|'left'） */
      for(var x=x1;x<=x2;x+=22)
        s.push('<circle class="dot '+dir+'" cx="'+x+'" cy="'+y+'" r="4.6"/>');
    }
    function seg(x1,y1,x2,y2,id,thick,fallback){
      var c=wcol(id,fallback);
      s.push('<path d="M'+x1+','+y1+' L'+x2+','+y2+'" stroke="'+c.col+'" stroke-width="'+(thick?6.5:5)+'" fill="none" stroke-linecap="round"/>');
      if(x1===x2 && c.live){
        /* 点きているとき＝放電の向き（下へ）。充電中＝バッテリーへ戻る線だけ上へ */
        if(sc.lampOn) dots(x1, Math.min(y1,y2)+6, Math.max(y1,y2)-26, false);
        else if(sc.charging && (id==='w11-01'||id==='w11-03'||id==='pga-01'||id==='w11-05'))
          dots(x1, Math.min(y1,y2)+26, Math.max(y1,y2)-6, true);
      }
    }
    function label(x,y,t,col,anchor,size){
      s.push('<text x="'+x+'" y="'+y+'" font-size="'+(size||13)+'" fill="'+(col||C.sub)+'"'+(anchor?' text-anchor="'+anchor+'"':'')+'>'+t+'</text>');
    }
    function ground(x,y,name){
      s.push('<path d="M'+(x-16)+','+y+' L'+(x+16)+','+y+' M'+(x-10)+','+(y+7)+' L'+(x+10)+','+(y+7)+' M'+(x-4)+','+(y+14)+' L'+(x+4)+','+(y+14)+'" stroke="'+C.deep+'" stroke-width="3.5" fill="none" stroke-linecap="round"/>');
      if(name) label(x+24,y+12,name,C.deep);
    }

    /* ===== バッテリー（端子とセルキャップのある形） ===== */
    s.push('<rect x="'+(X-45)+'" y="18" width="90" height="44" rx="6" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
    s.push('<rect x="'+(X-45)+'" y="18" width="90" height="10" rx="5" fill="'+C.deep+'"/>');
    s.push('<rect x="'+(X-34)+'" y="8" width="13" height="14" rx="2.5" fill="'+C.hi+'"/>');       /* ＋端子 */
    s.push('<rect x="'+(X+21)+'" y="8" width="13" height="14" rx="2.5" fill="#5c5a56"/>');        /* −端子 */
    s.push('<text x="'+(X-46)+'" y="16" font-size="13" font-weight="700" fill="'+C.hi+'" text-anchor="end">+</text>');
    s.push('<text x="'+(X+48)+'" y="16" font-size="14" font-weight="700" fill="#5c5a56">−</text>');
    s.push('<g fill="'+C.in_+'" opacity=".85"><circle cx="'+(X-20)+'" cy="40" r="4"/><circle cx="'+X+'" cy="40" r="4"/><circle cx="'+(X+20)+'" cy="40" r="4"/></g>');
    s.push('<text x="'+X+'" y="56" font-size="12" fill="#fffdf8" text-anchor="middle">バッテリー</text>');

    /* B+の幹。w11-01(ROSSO太)→始動レバー節点→w11-03/pga-01→J（レギュ30 or オルタB+） */
    seg(X,62,X,100, 'w11-01', true);
    label(X+12,88,'ROSSO 赤・太',WC.ROSSO);
    s.push('<circle cx="'+X+'" cy="100" r="4.5" fill="'+C.deep+'"/>');
    s.push('<path d="M'+X+',100 L'+(X+78)+',100" stroke="'+C.out+'" stroke-width="3" stroke-dasharray="5 5"/>');
    label(X+12,116,'始動レバー・セルへ（この旅の外）',C.sub,null,11);
    if(sc.alt){ seg(X,100,X,144,'pga-01',true,C.body); label(X+12,134,'太い線（施工次第）',C.sub,null,12); }
    else      { seg(X,100,X,144,'w11-03',true);        label(X+12,134,'MARRONE 茶・太',WC.MARRONE); }

    /* J＝右の道の付け根（レギュレータの30端子／オルタのB+端子と同じ節点） */
    s.push('<circle cx="'+X+'" cy="144" r="4.5" fill="'+C.deep+'"/>');
    label(X-12,140, sc.alt?'右の道＝B+へ':'右の道＝30へ', C.deep, 'end', 12);
    /* 右の道（同じ節点を箱の30/B+へ）。充電中はここを電気が上へ戻る */
    var jst = r.node[sc.alt?'alternator.B+':'regulator.30'];
    var jcol = (jst==='hot') ? (sc.alt?C.body:WC.ROSSO) : C.dim;
    s.push('<path d="M'+X+',144 L'+RX+',144 L'+RX+',388 L'+(sc.alt?172:168)+',388" stroke="'+jcol+'" stroke-width="5.5" fill="none" stroke-linecap="round"/>');
    if(sc.charging){
      for(var cy0=180;cy0<376;cy0+=22) s.push('<circle class="dot up" cx="'+RX+'" cy="'+cy0+'" r="4.6"/>');
      dotsH(388,176,208,'right');            /* 箱の30/B+ → 右の道の下の横 */
      dotsH(144,134,224,'left');             /* 右の道の上の横 → J（バッテリーへ） */
      label(RX+8,264,'充電',WC.ROSSO);
    }

    /* J→キースイッチ（w10-01 ROSSO）。途中に F1 の枝＝この旅は通らない */
    seg(X,144,X,196, 'w10-01');
    label(X+12,190,'ROSSO 赤',WC.ROSSO);
    s.push('<path d="M'+X+',168 L'+(X-56)+',168" stroke="'+C.out+'" stroke-width="3" stroke-dasharray="5 5"/>');
    s.push('<rect x="'+(X-76)+'" y="160" width="18" height="16" rx="3" fill="none" stroke="'+C.out+'" stroke-width="2.5"/>');
    label(6,152,'ヒューズF1・ホーンへ',C.sub,null,11);
    label(2,190,'（この旅は通らない）',C.sub,null,11);

    /* ===== キースイッチ＝箱の中の接点が、キーを回すと橋を架ける ===== */
    var keyOn = pos.ign_sw==='ON';
    s.push('<rect x="50" y="196" width="100" height="48" rx="8" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
    /* 鍵の絵（左側・ONで回る） */
    s.push('<circle cx="72" cy="220" r="12" fill="'+C.in_+'"/>');
    s.push('<rect x="70" y="206" width="4" height="14" rx="1.5" fill="'+C.deep+'" transform="rotate('+(keyOn?42:0)+' 72 220)"/>');
    /* 接点（上下2点＋橋）：ONで縦につながる */
    s.push('<circle cx="'+X+'" cy="206" r="3.8" fill="'+C.in_+'"/>');
    s.push('<circle cx="'+X+'" cy="234" r="3.8" fill="'+C.in_+'"/>');
    if(keyOn) s.push('<path d="M'+X+',206 L'+X+',234" stroke="'+C.in_+'" stroke-width="3.5"/>');
    else      s.push('<path d="M'+X+',206 L'+(X+13)+',228" stroke="'+C.in_+'" stroke-width="3.5"/>');
    s.push('<text x="128" y="224" font-size="10.5" fill="'+C.in_+'" text-anchor="middle">'+(keyOn?'接点 閉':'接点 開')+'</text>');
    label(156,214,'キースイッチ',C.deep,null,12);
    label(156,230, keyOn?'キーON':'キーOFF', keyOn?C.deep:C.sub, null, 12);

    /* キー→計器盤（w10-02 AZZURRO） */
    seg(X,244,X,288,'w10-02');
    label(X+12,276,'AZZURRO 水色',WC.AZZURRO);

    /* ===== チャージランプ＝メーターの小窓と同じ顔 ===== */
    var lit = sc.lampOn;
    if(lit){
      s.push('<circle cx="'+X+'" cy="302" r="36" fill="'+C.hi+'" opacity=".16"><animate attributeName="opacity" values=".16;.05;.16" dur="1.6s" repeatCount="indefinite"/></circle>');
    }
    s.push('<rect x="'+(X-36)+'" y="288" width="72" height="28" rx="5" fill="'+(lit?'#c0392b':C.in_)+'" stroke="'+(lit?'#7c2418':'#b3ab98')+'" stroke-width="2"/>');
    s.push('<text x="'+X+'" y="307" font-size="11.5" font-weight="700" fill="'+(lit?'#fffdf8':C.sub)+'" text-anchor="middle">GENERAT.</text>');
    label(144,298,'チャージランプ', lit?C.hi:C.sub, null, 12);
    label(144,314, lit?'点いている':'消えている', lit?C.hi:C.ok, null, 12);

    /* ランプ→箱の51/D+（w11-07/pga-03 VERDE） */
    seg(X,316,X,356, sc.alt?'pga-03':'w11-07', false, WC.VERDE);
    label(X+12,336,'VERDE 緑',WC.VERDE);
    label(X+12,350,'←テスターで見る線',WC.VERDE,null,11);

    if(sc.alt){
      /* ===== オルタネーター（レギュレータ内蔵） ===== */
      s.push('<rect x="48" y="356" width="124" height="74" rx="14" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
      s.push('<text x="110" y="382" font-size="12" fill="#fffdf8" text-anchor="middle">オルタネーター</text>');
      s.push('<text x="110" y="398" font-size="10.5" fill="'+C.in_+'" text-anchor="middle">（レギュレータ内蔵）</text>');
      label(X-12,352,'D+',C.deep,'end',12); label(176,380,'B+',C.deep,null,12);
      s.push('<text x="110" y="418" font-size="10.5" fill="'+C.in_+'" text-anchor="middle">'+(pos.alternator==='RUN'?'発電中＝D+はB+の高さ':'停止中＝D+はアース近傍')+'</text>');
      /* 本体アース（pga-04）＝ブラケット接地 */
      seg(X,430,X,458,'pga-04',false,WC.NERO);
      ground(X,458,'車体アース');
      label(X+24,478,'本体はブラケットで接地',C.sub,null,11);
      if(mode.suspect){
        s.push('<rect x="30" y="322" width="212" height="168" rx="12" fill="none" stroke="'+C.hi+'" stroke-width="2.5" stroke-dasharray="7 6"/>');
        s.push('<text x="36" y="514" font-size="13" fill="'+C.hi+'" font-weight="700">容疑者はこの中だけ</text>');
      }
      if(mode.probes){
        probe(172,392,'①',36,34);
        probe(88,356,'②',-46,-20);
        label(8,514,'①オルタのB+↔車体　②D+↔車体',C.sub,null,11.5);
      }
      return wrap(s, (mode.suspect||mode.probes)?524:500);
    }

    /* ===== レギュレータ＝51から下は素通し。接点（カットアウト）は30への枝 ===== */
    s.push('<rect x="44" y="356" width="124" height="64" rx="8" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
    s.push('<text x="52" y="372" font-size="10.5" fill="'+C.in_+'">レギュレータ</text>');
    label(X-12,352,'51',C.deep,'end',12); label(172,380,'30',C.deep,null,12);
    /* 51→ダイナモへの素通しの道（接点が開いていてもここは常につながっている）。
       充電中はダイナモから上がってきた電気がここを通って接点→30へ抜ける＝流れを見せる */
    s.push('<path d="M'+X+',356 L'+X+',420" stroke="'+C.in_+'" stroke-width="3" opacity=".9"/>');
    /* 30への枝＝カットアウト接点。充電中だけ閉じる */
    var cut = pos.regulator==='CHARGE';
    s.push('<path d="M'+X+',388 L126,388" stroke="'+C.in_+'" stroke-width="3" opacity=".9"/>');
    s.push('<path d="M146,388 L168,388" stroke="'+C.in_+'" stroke-width="3" opacity=".9"/>');
    s.push('<circle cx="126" cy="388" r="3.8" fill="'+C.in_+'"/>');
    s.push('<circle cx="146" cy="388" r="3.8" fill="'+C.in_+'"/>');
    if(cut) s.push('<path d="M126,388 L146,388" stroke="'+C.in_+'" stroke-width="3.5"/>');
    else    s.push('<path d="M146,388 L130,378" stroke="'+C.in_+'" stroke-width="3.5"/>');
    /* 充電中＝ダイナモから上がってきた電気が閉じた接点をくぐって30へ抜ける横の流れ */
    if(sc.charging && cut) dotsH(388,108,140,'right');
    s.push('<text x="132" y="404" font-size="10" fill="'+C.in_+'" text-anchor="middle">カットアウト '+(cut?'閉':'開')+'</text>');
    s.push('<text x="60" y="414" font-size="10" fill="'+C.in_+'" opacity=".85">51から下は素通し</text>');
    /* レギュレータのアース（w11-08）＝細い枝 */
    s.push('<path d="M62,420 L62,434" stroke="'+WC.NERO+'" stroke-width="3"/>');
    ground(62,434,'');

    /* 箱の51→ダイナモ51（w11-05 MARRONE太） */
    seg(X,420,X,458,'w11-05',true);
    label(X+12,446,'MARRONE 茶・太',WC.MARRONE);

    /* ===== ダイナモ（プーリーのある丸胴） ===== */
    s.push('<rect x="54" y="458" width="112" height="70" rx="26" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
    s.push('<text x="110" y="478" font-size="12" fill="#fffdf8" text-anchor="middle">ダイナモ</text>');
    label(X-12,454,'51',C.deep,'end',12);
    var arm = pos.dynamo==='STOP';
    /* プーリー（ベルトが掛かる所）。回転中は回す */
    s.push('<g'+(arm?'':' class="spin"')+' style="transform-origin:184px 493px">'+
           '<circle cx="184" cy="493" r="15" fill="'+C.in_+'" stroke="'+C.deep+'" stroke-width="2.5"/>'+
           '<line x1="184" y1="481" x2="184" y2="505" stroke="'+C.deep+'" stroke-width="2"/></g>');
    s.push('<circle cx="184" cy="493" r="4.5" fill="'+C.deep+'"/>');
    label(176,462, arm?'回っていない':'発電中', arm?C.hi:C.ok, null, 12);
    label(176,522,'←ベルトが回す',C.sub,null,10.5);
    /* 中のコイルの道（止まっている間だけ 51→車体 が通じる） */
    s.push('<circle cx="'+X+'" cy="492" r="3.4" fill="'+C.in_+'"/>');
    s.push('<circle cx="'+X+'" cy="510" r="3.4" fill="'+C.in_+'"/>');
    if(arm) s.push('<path d="M'+X+',492 L'+X+',510" stroke="'+C.in_+'" stroke-width="3.5"/>');
    else    s.push('<path d="M'+X+',492 L'+(X+11)+',503" stroke="'+C.in_+'" stroke-width="3.5"/>');
    s.push('<text x="'+(X-8)+'" y="505" font-size="10.5" fill="'+C.in_+'" text-anchor="end">コイル</text>');
    s.push('<text x="110" y="524" font-size="10" fill="'+C.in_+'" text-anchor="middle">'+(arm?'いまは通じている':'回転中は通じない')+'</text>');

    /* ダイナモ−→車体（w11-09） */
    seg(X,528,X,558,'w11-09');
    ground(X,558,'車体アース');

    /* 容疑区間の囲み */
    if(mode.suspect){
      s.push('<rect x="30" y="322" width="212" height="264" rx="12" fill="none" stroke="'+C.hi+'" stroke-width="2.5" stroke-dasharray="7 6"/>');
      s.push('<text x="36" y="608" font-size="13" fill="'+C.hi+'" font-weight="700">容疑者はこの中だけ</text>');
    }
    /* テスターのプローブ */
    if(mode.probes){
      probe(86,458,'①',-46,-20);
      probe(88,356,'②',-46,-20);
      label(8,608,'①ダイナモの51↔車体　②レギュレータの51↔30',C.sub,null,11.5);
    }
    return wrap(s, (mode.suspect||mode.probes)?618:592);

    function probe(x,y,t,dx,dy){
      s.push('<path d="M'+(x+dx)+','+(y+dy)+' L'+x+','+y+'" stroke="'+C.hi+'" stroke-width="3.5" stroke-linecap="round"/>');
      s.push('<circle cx="'+(x+dx)+'" cy="'+(y+dy-4)+'" r="11" fill="'+C.hi+'"/>');
      s.push('<text x="'+(x+dx)+'" y="'+(y+dy)+'" font-size="12" fill="#fffdf8" text-anchor="middle">'+t+'</text>');
    }
  }
  function wrap(parts, h){ return {vb:'0 0 300 '+h, body:parts.join('')}; }
  function put(id, sc, mode){
    var e=document.getElementById(id); if(!e) return;
    var d=draw(sc,mode);
    e.setAttribute('viewBox',d.vb); e.innerHTML=d.body;
  }

  /* ---- 実車ではここ（実寸線画＋オーナー実測の配置）。⏳実車写真が集まったら差し替え予定 ---- */
  function carMap(carSvgText, layout){
    var e=document.getElementById('carmap'); if(!e) return;
    var inner = carSvgText.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
    /* 車のCSSをこの図の中だけに閉じ込める。⚠️<style>は文書のどこにあっても全体に効く＝
       全セレクタを漏れなく #carcrop 配下に書き換える（旧実装は先頭の path{ を取り逃し、
       stroke:currentColor と vector-effect が旅の絵とC1メーターのパスを全部乗っ取っていた） */
    inner = inner.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, function(_, attrs, css){
      var scoped = css.replace(/(^|\})([^{}@]+)\{/g, function(_, brace, sel){
        var s = sel.split(',').map(function(x){
          x = x.trim();
          if(!x) return x;
          return x.indexOf('#carcrop')===0 ? x : '#carcrop '+x;
        }).join(',');
        return brace+' '+s+'{';
      });
      return '<style'+attrs+'>'+scoped+'</style>';
    });
    function pt(id){ var p=layout.parts[id]; return {x:25+p.m*1000, y:683.15-p.lat*1000}; }
    var dy=pt('dynamo'), rg=pt('regulator');
    var genName = ALT ? 'オルタネーター' : 'ダイナモ';
    var html =
      '<g id="carcrop" style="color:#cbc4b3">'+inner+'</g>'+
      '<circle cx="'+dy.x+'" cy="'+dy.y+'" r="16" fill="#b8442e"/>'+
      '<text x="'+(dy.x-26)+'" y="'+(dy.y+8)+'" font-size="34" fill="#b8442e" text-anchor="end" font-weight="700">'+genName+'</text>';
    if(!ALT){
      html +=
        '<circle cx="'+rg.x+'" cy="'+rg.y+'" r="16" fill="#2c3a31"/>'+
        '<text x="'+(rg.x-26)+'" y="'+(rg.y+8)+'" font-size="34" fill="#2c3a31" text-anchor="end" font-weight="700">レギュレータ</text>';
    }
    html +=
      '<text x="2345" y="588" font-size="26" fill="#a49b87">←車の前方</text>'+
      '<text x="2985" y="588" font-size="26" fill="#a49b87" text-anchor="end">車の後ろ</text>'+
      '<text x="2662" y="1166" font-size="26" fill="#a49b87" text-anchor="middle">エンジンルームを上から（上が車の右側）</text>';
    e.setAttribute('viewBox','2330 540 665 640');
    e.innerHTML = html;
  }

  /* ---- 検算（期待値は原典と実車から先に書いた・計算結果を写していない）。両ページで全7件を回す ---- */
  var CHECKS=[
    {label:'キーOFF・停止中',                s:{alt:false,inputs:{key:'OFF',engine:'STOP'}},                                        expect:false},
    {label:'キーON・停止中',                 s:{alt:false,inputs:{key:'ON',engine:'STOP'}},                                         expect:true },
    {label:'エンジン回転中',                 s:{alt:false,inputs:{key:'ON',engine:'RUN'}},                                          expect:false},
    {label:'回転中・ダイナモ回らず（ベルト切れ相当）', s:{alt:false,inputs:{key:'ON',engine:'RUN'},override:{dynamo:'STOP',regulator:'OFF'}}, expect:true },
    {label:'ヒューズF1切れ・キーON停止中',    s:{alt:false,inputs:{key:'ON',engine:'STOP',f1:'BLOWN'}},                              expect:true },
    {label:'オルタ換装・キーON停止中',        s:{alt:true,inputs:{key:'ON',engine:'STOP'}},                                          expect:true },
    {label:'オルタ換装・回転中',              s:{alt:true,inputs:{key:'ON',engine:'RUN'}},                                           expect:false}
  ];
  function runChecks(){
    var tb=document.getElementById('checks'); if(!tb) return;
    for(var i=0;i<CHECKS.length;i++){
      var c=CHECKS[i], sc=scenario(c.s), ok=(sc.lampOn===c.expect);
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+c.label+'</td><td>'+(sc.lampOn?'点く':'消える')+'</td><td>'+(c.expect?'点く':'消える')+'</td>'+
                   '<td class="'+(ok?'check-ok':'check-ng')+'">'+(ok?'✓':'✗ 不一致')+'</td>';
      tb.appendChild(tr);
    }
  }

  /* ---- トグル（唯一の操作＝停止中↔回転中） ---- */
  var CAPS = ALT ? {
    STOP:'<b>キーON・停止中＝点く。</b>黄色い点＝いま電気が流れている所。バッテリー→キースイッチ→チャージランプ→オルタのD+、と一周つながっている（停止中のD+はアース近傍）ので流れる＝点く。',
    RUN:'<b>エンジン回転中＝消える。</b>発電が始まるとD+がB+と同じ高さに上がり、ランプの両端の電圧差が無くなる＝流れない＝消える。右の道は充電の電気がバッテリーへ戻っているところ。'
  } : {
    STOP:'<b>キーON・停止中＝点く。</b>黄色い点＝いま電気が流れている所。バッテリー→キースイッチ→チャージランプ→レギュレータ（素通し）→ダイナモの中のコイル→車体アース、と一周つながっているので流れる＝点く。',
    RUN:'<b>エンジン回転中＝消える。</b>発電が始まってカットアウトの接点が閉じ、ランプの下側にも上側と同じ電圧が来た。両端の差が無い＝流れない＝消える。右の道は充電の電気がバッテリーへ戻っているところ。'
  };
  function setMain(v){
    var btns=document.querySelectorAll('#tg button');
    for(var i=0;i<btns.length;i++) btns[i].className = btns[i].getAttribute('data-v')===v?'on':'';
    put('j-main', scenario({inputs:{key:'ON',engine:v}}), {});
    var cap=document.getElementById('mainCap'); if(cap) cap.innerHTML=CAPS[v];
  }

  /* ---- 起動 ---- */
  Promise.all([
    fetch('/wiring-net.json').then(function(r){return r.json();}),
    fetch('/wiring-patches.json').then(function(r){return r.json();}),
    fetch('/wiring-img/car-top-v9.svg').then(function(r){return r.text();})
  ]).then(function(a){
    NET=a[0]; PATCHES=a[1];
    fetch('/wiring-layout.json').then(function(r){return r.json();}).then(function(L){ carMap(a[2], L); });

    var vers=document.getElementById('vers');
    if(vers) vers.textContent =
      'wiring-net.json NET_VERSION '+NET.NET_VERSION+' / wiring-patches.json PATCH_VERSION '+PATCHES.PATCH_VERSION;

    setMain('STOP');
    var btns=document.querySelectorAll('#tg button');
    for(var i=0;i<btns.length;i++) btns[i].addEventListener('click', function(){ setMain(this.getAttribute('data-v')); });

    if(ALT){
      put('j-fault', scenario({inputs:{key:'ON',engine:'RUN'},override:{alternator:'STOP'}}), {suspect:true});
      put('j-test',  scenario({inputs:{key:'ON',engine:'RUN'},override:{alternator:'STOP'}}), {probes:true});
      put('j-fixed', scenario({inputs:{key:'ON',engine:'RUN'}}), {});
    }else{
      put('j-fault', scenario({inputs:{key:'ON',engine:'RUN'},override:{dynamo:'STOP',regulator:'OFF'}}), {suspect:true});
      put('j-test',  scenario({inputs:{key:'ON',engine:'RUN'},override:{dynamo:'STOP',regulator:'OFF'}}), {probes:true});
      put('j-fixed', scenario({inputs:{key:'ON',engine:'RUN'}}), {});
    }
    runChecks();
  });
})();
