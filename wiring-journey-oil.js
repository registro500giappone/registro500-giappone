/* 旅ページ第2号「油圧警告灯が消えない」の絵。journey_id: oil_lamp_on（URLと対＝変えない）
   共通の土台（場面の作り方・描画プリミティブ・共通部品・実車図・検算・起動）は /wiring-journey.js。
   ⚠️図の点灯・色・黄点はすべて wiring-sim.js（L1到達性）の solve() 結果＝絵に合わせて数字を作らない。

   第1号（チャージランプ）との関係:
     上半分（バッテリー→始動レバー節点→レギュレータ30→キースイッチ→警告灯）は同じ道を通る＝
     共通部品と同じ座標で描いている。違うのは警告灯から下＝「落とし先」だけ。
     原典でも計器盤の4灯はどれも INTER←AZZURRO で受けていて、反対側の落とし先だけが違う
     （GENERAT.=51→レギュレータ／OLIO=0→油圧センダ→アース）。この構造がそのまま絵になる。 */
(function(){
  'use strict';
  var WC = Journey.WC, C = Journey.C;
  var X = 100;

  function draw(k, mode){
    var sc=k.sc, pos=k.pos, s=k.s;
    function seg(a,b,c,d,e,f,g){ k.seg(a,b,c,d,e,f,g); }
    function label(x,y,t,col,anchor,size){ k.label(x,y,t,col,anchor,size); }

    /* ===== ここから下、警告灯までは第1号とまったく同じ道 ===== */
    k.battery(X);

    seg(X,62,X,100,'w11-01',true);
    label(X+12,88,'ROSSO 赤・太',WC.ROSSO);
    k.node(X,100);
    k.dashOut(X,100,X+78);
    label(X+12,116,'始動レバー・セルへ（この旅の外）',C.sub,null,11);

    seg(X,100,X,144,'w11-03',true);
    label(X+12,134,'MARRONE 茶・太',WC.MARRONE);
    k.node(X,144);
    k.dashOut(X,144,X+78);
    label(X+12,160,'発電系（ダイナモ・レギュレータ）へ',C.sub,null,11);

    /* J→キースイッチ（w10-01 ROSSO）。途中に F1 の枝＝この旅も通らない */
    seg(X,144,X,196,'w10-01');
    label(X+12,190,'ROSSO 赤',WC.ROSSO);
    k.dashOut(X,176,X-56);
    s.push('<rect x="'+(X-76)+'" y="168" width="18" height="16" rx="3" fill="none" stroke="'+C.out+'" stroke-width="2.5"/>');
    label(6,162,'ヒューズF1・ホーンへ',C.sub,null,11);
    label(2,196,'（この旅は通らない）',C.sub,null,11);

    k.keySwitch(X, 196, pos.ign_sw==='ON');

    /* キー→計器盤（w10-02 AZZURRO）。計器盤の中で分かれてチャージランプへも行く */
    seg(X,244,X,288,'w10-02');
    k.dashOut(X,262,X+92);
    label(X+12,256,'計器盤の中でチャージランプへ',C.sub,null,10.5);
    label(X+12,282,'AZZURRO 水色',WC.AZZURRO);

    /* ===== 油圧警告灯＝メーターの小窓と同じ顔 ===== */
    k.lampWindow(X, 288, 'OLIO', sc.lampOn, ['油圧警告灯','点いている','消えている'], 144);

    /* ===== ランプ→油圧センダ（w07-01 GRIGIO）。ここが第1号と分かれる所 ===== */
    if(mode.detach){
      /* 切り分けの手：センダの端子から線を外した状態。
         ⚠️これは接点の位置ではなく「線が1本無い」状態＝netlist から w07-01 を外して solve している。
         外した線はメーター側（quadro.0）にぶら下がったままなので、色はその端子の状態で塗る
         （＝負荷の先＝12Vは来ているが流れない）。 */
      var st = k.r.node['quadro.0'];
      var gc = (st==='off'||st===undefined) ? C.dim : WC.GRIGIO;
      s.push('<path d="M'+X+',316 L'+X+',356 L52,374" stroke="'+gc+'" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
      s.push('<circle cx="52" cy="374" r="6" fill="none" stroke="'+gc+'" stroke-width="3"/>');
      s.push('<circle cx="'+X+'" cy="392" r="4.5" fill="none" stroke="'+C.deep+'" stroke-width="2.5"/>');
      label(X+12,344,'GRIGIO 灰',WC.GRIGIO);
      label(6,364,'外した',C.hi,null,12);
    }else{
      seg(X,316,X,392,'w07-01');
      label(X+12,344,'GRIGIO 灰',WC.GRIGIO);
      if(mode.suspect) label(X+12,360,'←ここを外して切り分ける',WC.GRIGIO,null,11);
    }

    /* ===== 油圧センダ（エンジンブロックにねじ込まれた小さなスイッチ） ===== */
    var closed = pos.oil_sender==='LOW';
    s.push('<rect x="36" y="392" width="148" height="88" rx="10" fill="'+C.body+'" stroke="'+C.deep+'" stroke-width="2.5"/>');
    s.push('<text x="110" y="412" font-size="12" fill="#fffdf8" text-anchor="middle">油圧センダ</text>');
    s.push('<text x="110" y="427" font-size="10.5" fill="'+C.in_+'" text-anchor="middle">（油圧スイッチ）</text>');
    /* 接点：圧がゼロの間だけ閉じていて、ランプをアースに落とす */
    s.push('<circle cx="'+X+'" cy="440" r="3.8" fill="'+C.in_+'"/>');
    s.push('<circle cx="'+X+'" cy="458" r="3.8" fill="'+C.in_+'"/>');
    if(closed) s.push('<path d="M'+X+',440 L'+X+',458" stroke="'+C.in_+'" stroke-width="3.5"/>');
    else       s.push('<path d="M'+X+',440 L'+(X+11)+',451" stroke="'+C.in_+'" stroke-width="3.5"/>');
    s.push('<text x="144" y="453" font-size="10" fill="'+C.in_+'" text-anchor="middle">接点 '+(closed?'閉':'開')+'</text>');
    /* ⚠️「なぜ閉じているか」は電気では分からない（本当に圧が無い／固着／地絡）＝
       ここでは接点の事実と、しくみだけを言う */
    s.push('<text x="110" y="472" font-size="10" fill="'+C.in_+'" text-anchor="middle">'+(closed?'油圧が上がれば開く':'油圧が押し開けた')+'</text>');
    label(190,424,'←エンジンに',C.sub,null,10.5);
    label(190,438,'　ねじ込まれる',C.sub,null,10.5);

    /* センダ→車体（w07-02）。⚠️原典はアース記号だけで電線を描かない＝ねじ込み部がアースそのもの */
    seg(X,480,X,508,'w07-02');
    k.ground(X,508,'車体アース');
    label(6,546,'センダのねじ込み部が、そのままアースです',C.sub,null,11);

    if(mode.suspect){
      k.suspect(22,320,250,208,570);
      return 586;
    }
    if(mode.detach){
      label(8,570,'①外して消えた＝電気の道は無実',C.sub,null,11.5);
      return 586;
    }
    return 564;
  }

  /* ---- トグル（唯一の操作＝停止中↔回転中） ---- */
  var CAPS = {
    STOP:'<b>キーON・停止中＝点く。</b>黄色い点＝いま電気が流れている所。油圧はエンジンが回って初めて上がるので、止まっている間は圧ゼロ。センダの接点は閉じたままで、ランプの下側が車体アースに落ちている＝一周つながって流れる＝点く。',
    RUN:'<b>エンジン回転中＝消える。</b>油圧が上がるとセンダの接点が押し開かれ、ランプの下側が行き止まりになる。上側には12Vが来たままだが、行き先が無い＝流れない＝消える。<b>だから「消えた」は油圧が出ているという合図です。</b>'
  };

  /* ---- 検算（期待値は原典と実車の挙動から先に書いた・計算結果を写していない） ---- */
  function chargeLamp(sc){
    for(var i=0;i<sc.r.loads.length;i++) if(sc.r.loads[i].id==='quadro.warn_charge') return sc.r.loads[i].on;
    return false;
  }
  var CHECKS=[
    {label:'キーOFF・停止中',                s:{inputs:{key:'OFF',engine:'STOP'}},                                  expect:false},
    {label:'キーON・停止中',                 s:{inputs:{key:'ON',engine:'STOP'}},                                   expect:true },
    {label:'エンジン回転中',                 s:{inputs:{key:'ON',engine:'RUN'}},                                    expect:false},
    {label:'回転中・センダが閉じたまま（油圧ゼロ相当）', s:{inputs:{key:'ON',engine:'RUN'},override:{oil_sender:'LOW'}}, expect:true },
    {label:'ヒューズF1切れ・キーON停止中',    s:{inputs:{key:'ON',engine:'STOP',f1:'BLOWN'}},                        expect:true },
    {label:'オルタ換装・キーON停止中',        s:{alt:true,inputs:{key:'ON',engine:'STOP'}},                          expect:true },
    {label:'オルタ換装・回転中',              s:{alt:true,inputs:{key:'ON',engine:'RUN'}},                           expect:false},
    {label:'灰色の線を外した・キーON停止中（切り分けの手順①）',
     s:{inputs:{key:'ON',engine:'STOP'},ops:[{op:'removeWire',id:'w07-01'}]},          expect:false},
    {label:'同じ場面のチャージランプ（回転中・センダ閉じたまま）',
     s:{inputs:{key:'ON',engine:'RUN'},override:{oil_sender:'LOW'}}, expect:false, read:chargeLamp}
  ];

  Journey.boot({
    lampId:'quadro.warn_oil',
    alt:false,
    draw: draw,
    caps: CAPS,
    checks: CHECKS,
    scenes: function(scenario){
      return [
        /* 異常＝回転中なのにセンダの接点が閉じたまま。「本当に油圧が低い」も
           「センダの固着」も「灰色の線が車体に触れている」も、電気的には全部この同じ状態になる */
        {id:'j-fault', sc:scenario({inputs:{key:'ON',engine:'RUN'},override:{oil_sender:'LOW'}}), mode:{suspect:true}},
        /* 切り分け＝エンジンは止めたまま・キーONで、センダから線を1本外す。
           「外した」は接点の位置ではなく線が無い状態なので netlist から w07-01 を外して解く */
        {id:'j-test',  sc:scenario({inputs:{key:'ON',engine:'STOP'},ops:[{op:'removeWire',id:'w07-01'}]}), mode:{detach:true}},
        {id:'j-fixed', sc:scenario({inputs:{key:'ON',engine:'RUN'}}),                             mode:{}}
      ];
    },
    carmap: function(){
      return {
        viewBox:'2330 380 665 810',
        marks:[{id:'oil_sender', color:'#b8442e', label:'油圧センダ'},
               {id:'dynamo',     color:'#8d8574', label:'ダイナモ'}],
        legend:'<text x="2345" y="1072" font-size="26" fill="#a49b87">←車の前方</text>'+
               '<text x="2985" y="1072" font-size="26" fill="#a49b87" text-anchor="end">車の後ろ</text>'+
               '<text x="2662" y="1166" font-size="26" fill="#a49b87" text-anchor="middle">エンジンルームを上から（上が車の右側）</text>'
      };
    }
  });
})();
