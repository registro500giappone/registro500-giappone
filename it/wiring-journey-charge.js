/* ストーリー第1回「チャージランプが消えない」の絵。ID: charge_lamp_on ダイナモ版 wiring-journey-charge.html とオルタ版 wiring-journey-charge-alt.html の2ページで共有する。
   オルタ版は読み込み前に window.JOURNEY_ALT = true を立てる。
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。 */
(function(){
  'use strict';
  var ALT = !!window.JOURNEY_ALT;
  var WC = Journey.WC, C = Journey.C;

  var X=100, RX=235;                         /* 主列と、充電が戻る右の道 */

  /* ---- ストーリーの絵（縦の滝）。線1本ごとに netlist の wire id を対応させ、状態で塗る ---- */
  function draw(k, mode){
    var sc=k.sc, r=k.r, pos=k.pos, s=k.s;
    function seg(a,b,c,d,e,f,g){ k.seg(a,b,c,d,e,f,g); }
    function dotsH(y,x1,x2,dir){ k.dotsH(y,x1,x2,dir); }
    function label(x,y,t,col,anchor,size){ k.label(x,y,t,col,anchor,size); }
    function ground(x,y,name){ k.ground(x,y,name); }

    /* ===== バッテリー（端子とセルキャップのある形） ===== */
    k.battery(X);

    /* B+の幹。w11-01(ROSSO太)→スターターレバー節点→w11-03/pga-01→J（レギュ30 or オルタB+） */
    seg(X,62,X,100, 'w11-01', true);
    label(X+12,88,'ROSSO, sezione grossa',WC.ROSSO);
    k.node(X,100);
    k.dashOut(X,100,X+78);
    label(X+12,116,'Verso la leva di avviamento / motorino (fuori da questa puntata)',C.sub,null,10.5);
    if(sc.alt){ seg(X,100,X,144,'pga-01',true,C.body); label(X+12,134,'Cavo grosso (secondo il montaggio)',C.sub,null,12); }
    else      { seg(X,100,X,144,'w11-03',true);        label(X+12,134,'MARRONE, sezione grossa',WC.MARRONE); }

    /* J＝右の道の付け根（レギュレータの30端子／オルタのB+端子と同じ節点） */
    k.node(X,144);
    label(X-12,140, sc.alt?'Ramo destro → B+':'Ramo destro → 30', C.deep, 'end', 12);
    /* 右の道（同じ節点を箱の30/B+へ）。充電中はここを電気が上へ戻る */
    var jst = r.node[sc.alt?'alternator.B+':'regulator.30'];
    var jcol = (jst==='hot') ? (sc.alt?C.body:WC.ROSSO) : C.dim;
    s.push('<path d="M'+X+',144 L'+RX+',144 L'+RX+',388 L'+(sc.alt?172:168)+',388" stroke="'+jcol+'" stroke-width="5.5" fill="none" stroke-linecap="round"/>');
    if(sc.charging){
      for(var cy0=180;cy0<376;cy0+=22) s.push('<circle class="dot up" cx="'+RX+'" cy="'+cy0+'" r="4.6"/>');
      dotsH(388,176,208,'right');            /* 箱の30/B+ →右の道の下の横 */
      dotsH(144,134,224,'left');             /* 右の道の上の横→ J（バッテリーへ） */
      label(RX+8,264,'In carica',WC.ROSSO);
    }

    /* J→キースイッチ（w10-01 ROSSO）。途中に F1 の枝＝このストーリーは通らない */
    seg(X,144,X,196, 'w10-01');
    label(X+12,190,'ROSSO',WC.ROSSO);
    k.dashOut(X,168,X-56);
    s.push('<rect x="'+(X-76)+'" y="160" width="18" height="16" rx="3" fill="none" stroke="'+C.out+'" stroke-width="2.5"/>');
    label(6,152,'Al fusibile F1 / clacson',C.sub,null,11);
    label(2,190,'(fuori da questa puntata)',C.sub,null,9.5);

    /* ===== キースイッチ＝箱の中の接点が、キーを回すと橋を架ける ===== */
    k.keySwitch(X, 196, pos.ign_sw==='ON');

    /* キー→計器盤（w10-02 AZZURRO） */
    seg(X,244,X,288,'w10-02');
    label(X+12,276,'AZZURRO',WC.AZZURRO);

    /* ===== チャージランプ＝メーターの小窓と同じ顔 ===== */
    k.lampWindow(X, 288, 'GENERAT.', sc.lampOn, ['Spia di carica','accesa','spenta'], 156);

    /* ランプ→箱の51/D+（w11-07/pga-03 VERDE） */
    seg(X,316,X,356, sc.alt?'pga-03':'w11-07', false, WC.VERDE);
    label(X+12,336,'VERDE',WC.VERDE);
    label(X+12,350,'← il cavo da controllare col tester',WC.VERDE,null,11);

    if(sc.alt){
      /* ===== オルタネーター（3端子式＝D+/L端子式。レギュレータは別体でネジ止め＝絵では本体側にまとめてある。 */
      s.push('<rect x="48" y="356" width="124" height="74" rx="14" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
      s.push('<text x="110" y="382" font-size="12" fill="#fffdf8" text-anchor="middle">Alternatore</text>');
      s.push('<text x="110" y="398" font-size="10.5" fill="'+C.in_+'" text-anchor="middle">(a 3 morsetti)</text>');
      label(X-12,352,'D+',C.deep,'end',12); label(176,380,'B+',C.deep,null,12);
      s.push('<text x="110" y="418" font-size="10.5" fill="'+C.in_+'" text-anchor="middle">'+(pos.alternator==='RUN'?'In carica: D+ al livello di B+':'Fermo: D+ vicino a massa')+'</text>');
      /* 本体アース（pga-04）＝ブラケット接地。⚠️長さ32px以上（理由は w11-09 の注記） */
      seg(X,430,X,464,'pga-04',false,WC.NERO);
      ground(X,464,'Massa (telaio)');
      label(X+24,488,'Messo a massa tramite la staffa',C.sub,null,11);
      if(mode.suspect) k.suspect(30,322,212,168,514);
      if(mode.probes){
        k.probe(172,392,'①',36,34);
        k.probe(88,356,'②',-46,-20);
        label(8,514,'① B+ alternatore ↔ telaio   ② D+ ↔ telaio',C.sub,null,11.5);
      }
      return (mode.suspect||mode.probes)?524:500;
    }

    /* ===== レギュレータ＝51から下は素通し。接点（カットアウト）は30への枝 ===== */
    s.push('<rect x="44" y="356" width="124" height="64" rx="8" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
    s.push('<text x="52" y="372" font-size="10.5" fill="'+C.in_+'">Regolatore</text>');
    label(X-12,352,'51',C.deep,'end',12); label(172,380,'30',C.deep,null,12);
    /* 51→ダイナモへの素通しの道（接点が開いていてもここは常につながっている）。充電中はダイナモから上がってきた電気がここを通って接点→30へ抜ける＝流れを見せる */
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
    s.push('<text x="132" y="404" font-size="10" fill="'+C.in_+'" text-anchor="middle">Automatico '+(cut?'chiuso':'aperto')+'</text>');
    s.push('<text x="60" y="414" font-size="10" fill="'+C.in_+'" opacity=".85">Solo filo sotto il 51</text>');
    /* レギュレータのアース（w11-08）＝細い枝 */
    s.push('<path d="M62,420 L62,434" stroke="'+WC.NERO+'" stroke-width="3"/>');
    ground(62,434,'');

    /* 箱の51→ダイナモ51（w11-05 MARRONE太） */
    seg(X,420,X,458,'w11-05',true);
    label(X+12,446,'MARRONE, sezione grossa',WC.MARRONE);

    /* ===== ダイナモ（プーリーのある丸胴） ===== */
    s.push('<rect x="54" y="458" width="112" height="70" rx="26" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
    s.push('<text x="110" y="478" font-size="12" fill="#fffdf8" text-anchor="middle">Dinamo</text>');
    label(X-12,454,'51',C.deep,'end',12);
    var arm = pos.dynamo==='STOP';
    /* プーリー（ベルトが掛かる所）。回転中は回す */
    s.push('<g'+(arm?'':' class="spin"')+' style="transform-origin:184px 493px">'+
           '<circle cx="184" cy="493" r="15" fill="'+C.in_+'" stroke="'+C.deep+'" stroke-width="2.5"/>'+
           '<line x1="184" y1="481" x2="184" y2="505" stroke="'+C.deep+'" stroke-width="2"/></g>');
    s.push('<circle cx="184" cy="493" r="4.5" fill="'+C.deep+'"/>');
    label(176,462, arm?'Ferma':'In carica', arm?C.hi:C.ok, null, 12);
    label(176,522,'← girata dalla cinghia',C.sub,null,10.5);
    /* 中のコイルの道（止まっている間だけ 51→車体が通じる） */
    s.push('<circle cx="'+X+'" cy="492" r="3.4" fill="'+C.in_+'"/>');
    s.push('<circle cx="'+X+'" cy="510" r="3.4" fill="'+C.in_+'"/>');
    if(arm) s.push('<path d="M'+X+',492 L'+X+',510" stroke="'+C.in_+'" stroke-width="3.5"/>');
    else    s.push('<path d="M'+X+',492 L'+(X+11)+',503" stroke="'+C.in_+'" stroke-width="3.5"/>');
    s.push('<text x="'+(X-8)+'" y="505" font-size="10.5" fill="'+C.in_+'" text-anchor="end">Bobina</text>');
    s.push('<text x="110" y="524" font-size="10" fill="'+C.in_+'" text-anchor="middle">'+(arm?'Collegata quando è ferma':'Aperta quando gira')+'</text>');

    /* ダイナモ−→車体（w11-09） */
    /* ⚠️アース線は 32px 以上にする＝seg() の粒は両端に 6px と 26px の余白を取るので、
       31px 以下だと通電していても粒が1つも打てず「流れていない」ように見える（第8回の表示灯で指摘された。その111）。 */
    seg(X,528,X,562,'w11-09');
    ground(X,562,'Massa (telaio)');

    /* 容疑区間の囲み */
    if(mode.suspect) k.suspect(30,322,212,264,608);
    /* テスターのプローブ */
    if(mode.probes){
      k.probe(86,458,'①',-46,-20);
      k.probe(88,356,'②',-46,-20);
      label(8,608,'① 51 dinamo ↔ telaio   ② 51 regolatore ↔ 30',C.sub,null,11.5);
    }
    return (mode.suspect||mode.probes)?618:592;
  }

  /* ---- トグル（唯一の操作＝停止中↔回転中） ---- */
  var CAPS = ALT ? {
    STOP:'<b>Chiave su ON, motore fermo = accesa.</b> I puntini gialli mostrano dove scorre corrente ora. Batteria → commutatore di accensione → spia di carica → D+ dell’alternatore: il giro si chiude (da fermo D+ è vicino a massa), quindi la corrente scorre = accesa.',
    RUN:'<b>Motore in moto = spenta.</b> Quando inizia la carica, D+ sale allo stesso livello di B+ e la differenza di tensione ai capi della spia sparisce = nessuna corrente = spenta. Il ramo a destra è la corrente di carica che torna alla batteria.'
  } : {
    STOP:'<b>Chiave su ON, motore fermo = accesa.</b> I puntini gialli mostrano dove scorre corrente ora. Batteria → commutatore di accensione → spia di carica → regolatore (passa diritto) → bobina della dinamo → massa: il giro si chiude, quindi la corrente scorre = accesa.',
    RUN:'<b>Motore in moto = spenta.</b> Appena inizia la carica il contatto dell’interruttore automatico si chiude e la stessa tensione della parte alta arriva anche sotto la spia. Nessuna differenza ai capi = nessuna corrente = spenta. Il ramo a destra è la corrente di carica che torna alla batteria.'
  };

  /* ---- 検算（期待値は原典と実車から先に書いた・計算結果を写していない）。両ページで全7件を回す ---- */
  var CHECKS=[
    {label:'Chiave OFF, fermo',                          s:{alt:false,inputs:{key:'OFF',engine:'STOP'}},                                        expect:false},
    {label:'Chiave ON, fermo',                            s:{alt:false,inputs:{key:'ON',engine:'STOP'}},                                         expect:true },
    {label:'Motore in moto',                              s:{alt:false,inputs:{key:'ON',engine:'RUN'}},                                          expect:false},
    {label:'In moto, dinamo ferma (cinghia rotta)',       s:{alt:false,inputs:{key:'ON',engine:'RUN'},override:{dynamo:'STOP',regulator:'OFF'}}, expect:true },
    {label:'Fusibile F1 bruciato, chiave ON fermo',       s:{alt:false,inputs:{key:'ON',engine:'STOP',f1:'BLOWN'}},                              expect:true },
    {label:'Convertito ad alternatore, chiave ON fermo',  s:{alt:true,inputs:{key:'ON',engine:'STOP'}},                                          expect:true },
    {label:'Convertito ad alternatore, in moto',          s:{alt:true,inputs:{key:'ON',engine:'RUN'}},                                           expect:false}
  ];

  Journey.boot({
    lampId:'quadro.warn_charge',
    alt: ALT,
    /* 充電＝発電源が回っていて、B+ と導体だけで同じ成分（＝カットアウト/内蔵レギュが閉） */
    extra: function(sc){
      sc.charging = sc.alt
        ? (sc.pos.alternator==='RUN' && sc.r.comp['alternator.D+']===sc.r.comp['battery.+'])
        : (sc.pos.dynamo==='RUN' && sc.r.comp['dynamo.51']===sc.r.comp['battery.+']);
    },
    /* 点いているとき＝放電の向き（下へ）。充電中＝バッテリーへ戻る線だけ上へ */
    flow: function(sc, id){
      if(sc.lampOn) return 'down';
      if(sc.charging && (id==='w11-01'||id==='w11-03'||id==='pga-01'||id==='w11-05')) return 'up';
      return null;
    },
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function(scenario){
      var stop = ALT ? {alternator:'STOP'} : {dynamo:'STOP',regulator:'OFF'};
      return [
        {id:'j-fault', sc:scenario({inputs:{key:'ON',engine:'RUN'},override:stop}), mode:{suspect:true}},
        {id:'j-test',  sc:scenario({inputs:{key:'ON',engine:'RUN'},override:stop}), mode:{probes:true}},
        {id:'j-fixed', sc:scenario({inputs:{key:'ON',engine:'RUN'}}),               mode:{}}
      ];
    },
    carmap: function(){
      var marks = [{id:'dynamo', color:'#b8442e', label: ALT?'Alternatore':'Dinamo'}];
      if(!ALT) marks.push({id:'regulator', color:'#2c3a31', label:'Regolatore'});
      return {
        viewBox:'2330 540 665 640',
        marks: marks,
        legend:'<text x="2345" y="588" font-size="26" fill="#a49b87">← Anteriore</text>'+
               '<text x="2985" y="588" font-size="26" fill="#a49b87" text-anchor="end">Posteriore</text>'+
               '<text x="2662" y="1166" font-size="26" fill="#a49b87" text-anchor="middle">Vano motore dall’alto (il lato destro dell’auto è in alto)</text>'
      };
    }
  });
})();
