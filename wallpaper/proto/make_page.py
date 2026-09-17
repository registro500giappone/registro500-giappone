# -*- coding: utf-8 -*-
"""検版ページ: 確定仕様と4通りのバリエーション"""
import os, base64, io
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
PH = os.path.join(BASE, "out", "phone")
OUT = os.path.join(BASE, "out")
DEST = os.path.join(BASE, "atlas.html")


def _emb(im, w, q):
    if im.width != w:
        im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
    b = io.BytesIO()
    im.convert("RGB").save(b, "JPEG", quality=q, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


def uri(path, w, q=78):
    return _emb(Image.open(path), w, q)


TPL = r"""<title>169台のタイル図鑑</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500&display=swap">
<style>
:root{
  --ground:#e8e6e1; --surface:#f6f5f2; --ink:#23231f; --muted:#6d6b64;
  --line:#cfccc4; --accent:#b3261e; --stage:#8a8a8a; --ok:#3f6b46; --warn:#8a6d1f;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#1a1a1c; --surface:#242427; --ink:#eceae5; --muted:#9b998f;
    --line:#35353a; --accent:#e0503f; --stage:#8a8a8a; --ok:#7fae86; --warn:#d0ac52;
  }
}
:root[data-theme="dark"]{
  --ground:#1a1a1c; --surface:#242427; --ink:#eceae5; --muted:#9b998f;
  --line:#35353a; --accent:#e0503f; --stage:#8a8a8a; --ok:#7fae86; --warn:#d0ac52;
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);
  font-family:"Noto Sans JP",system-ui,sans-serif;font-size:15px;line-height:1.75;
  margin:0;padding:0 20px 80px}
.wrap{max-width:1180px;margin:0 auto}
header{padding:56px 0 34px;border-bottom:1px solid var(--line)}
h1{font-family:Archivo,"Noto Sans JP",sans-serif;font-weight:700;
   font-size:clamp(30px,4.2vw,46px);line-height:1.1;letter-spacing:-.02em;
   margin:0 0 14px;text-wrap:balance}
.lede{max-width:64ch;color:var(--muted);margin:0}
.spec{display:flex;flex-wrap:wrap;gap:7px;margin-top:24px}
.spec span{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.04em;
  border:1px solid var(--accent);border-radius:2px;padding:5px 11px;color:var(--accent)}
section{padding:52px 0 14px;border-bottom:1px solid var(--line)}
section:last-of-type{border-bottom:0}
h2{font-family:Archivo,"Noto Sans JP",sans-serif;font-weight:700;font-size:24px;
   letter-spacing:-.01em;margin:0 0 6px}
.sub{color:var(--muted);margin:0 0 30px;max-width:70ch}

/* 4通り */
.vars{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
@media(max-width:860px){.vars{grid-template-columns:repeat(2,1fr)}}
.v{margin:0}
.v .stage{background:var(--stage);padding:5px;border-radius:2px}
.v img{display:block;width:100%;height:auto}
.v .who{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.08em;
  color:var(--accent);display:block;margin:11px 0 2px}
.v h3{font-family:Archivo,"Noto Sans JP",sans-serif;font-size:14.5px;font-weight:500;margin:0}
.v p{margin:5px 0 0;color:var(--muted);font-size:12.5px;line-height:1.62}

.wide{margin-top:36px}
.wide img{display:block;width:100%;height:auto;background:var(--stage)}
.wide figcaption{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.05em;
  color:var(--muted);margin-top:9px}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:36px}
@media(max-width:640px){.duo{grid-template-columns:1fr}}
.duo figure{margin:0}
.duo img{display:block;width:100%;height:auto;background:var(--stage)}
.duo figcaption{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.05em;
  color:var(--muted);margin-top:9px}

/* 抜け */
ol.gaps{margin:0;padding-left:0;list-style:none;counter-reset:g}
ol.gaps li{counter-increment:g;padding:20px 0 20px 52px;position:relative;
  border-top:1px solid var(--line);max-width:72ch}
ol.gaps li:first-child{border-top:0;padding-top:0}
ol.gaps li::before{content:counter(g);position:absolute;left:0;top:20px;
  font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--accent);
  border:1px solid var(--accent);width:28px;height:28px;display:grid;place-items:center;border-radius:50%}
ol.gaps li:first-child::before{top:0}
ol.gaps h3{font-family:Archivo,"Noto Sans JP",sans-serif;font-size:16px;font-weight:500;margin:0 0 5px}
ol.gaps p{margin:0 0 8px}
ol.gaps .num{font-family:"IBM Plex Mono",monospace;color:var(--accent);font-size:13px}
.verdict{max-width:74ch}
dl.tr{margin:0;display:grid;grid-template-columns:auto 1fr;gap:9px 18px;align-items:baseline}
dl.tr dt{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--muted);
  letter-spacing:.05em;white-space:nowrap}
dl.tr dd{margin:0;font-size:14px}
footer{padding-top:30px;color:var(--muted);font-size:13px}
</style>

<div class="wrap">
<header>
  <h1>169台のタイル図鑑</h1>
  <p class="lede">絵の仕様が固まりました。組み合わせは4通りで合っています——ただし実装で必要な分岐が3つ、実データから出てきました。</p>
  <div class="spec">
    <span>1179×2556</span><span>カラー</span><span>500 先頭 / 126 末尾</span>
    <span>ロゴも22%</span><span>最終行は左詰め</span><span>ハイライト 2×2・センター固定</span>
    <span>色順は案3・1つおき反転</span>
  </div>
</header>

<section>
  <h2>4通り</h2>
  <p class="sub">ログイン時にハイライトを外せば未ログイン版と同じ絵になるので、<b>絵として存在するのは4種類</b>です。ハイライトが無い時は全体を沈めないので、V1・V2 は色が濃く出ます。ロゴも同じ扱いで、沈めるのはハイライトがある時だけ。</p>
  <div class="vars">
    <figure class="v"><div class="stage"><img src="__V1__" alt="V1"></div>
      <span class="who">一般公開</span><h3>登録順</h3>
      <p>170台目に向かって時系列に並ぶ。沈めないので全タイルが等価。</p></figure>
    <figure class="v"><div class="stage"><img src="__V2__" alt="V2"></div>
      <span class="who">一般公開</span><h3>色順</h3>
      <p>白から黄緑へひと続き。沈めないぶん、色の帯が最も強く出る。</p></figure>
    <figure class="v"><div class="stage"><img src="__V3__" alt="V3"></div>
      <span class="who">ログイン</span><h3>登録順＋自分の1台</h3>
      <p>周りを22%沈め、自分の車だけ2×2で等倍のまま。</p></figure>
    <figure class="v"><div class="stage"><img src="__V4__" alt="V4"></div>
      <span class="who">ログイン</span><h3>色順＋自分の1台</h3>
      <p>同じ色の群れの中に自分がいる、という見え方になる。</p></figure>
  </div>

  <figure class="wide"><img src="__HIZ__" alt="ハイライト">
    <figcaption>ハイライト部分（V4）— 囲みも影もなく、周りより濃いだけ。他の車は1台も隠れていない</figcaption></figure>

  <div class="duo">
    <figure><img src="__T1__" alt="登録順の先頭">
      <figcaption>登録順の先頭 — 500ロゴ。並びが白から始まらないので、色順ほどは紛れない</figcaption></figure>
    <figure><img src="__B1__" alt="登録順の末尾">
      <figcaption>登録順の末尾 — 126ロゴ。左詰めのまま最後に置かれる</figcaption></figure>
  </div>
</section>

<section>
  <h2>実データから出た分岐</h2>
  <p class="sub">DBを見たところ、組み合わせの表には現れない場合分けが3つありました。いずれも人数は少ないものの、その人には必ず起きます。</p>
  <ol class="gaps">
    <li>
      <h3>2台以上を登録しているオーナーが <span class="num">3人</span></h3>
      <p>いずれも2台ずつ。ハイライトは1台ぶんしか置けないので、<b>どちらを指すか選ばせる必要があります</b>。2つ置くと2×2が2箇所になり、「自分の1台」という意味が崩れます。</p>
      <p>選ばせる場所は、ジェネレータ側にドロップダウンを1つ足すのが素直です。</p>
    </li>
    <li>
      <h3>自分の車が図鑑に載っていないオーナーが <span class="num">1人</span></h3>
      <p>SNS掲載をオフ（<code>sns_share_optout</code>）にしているため、そもそもタイルに入っていません。この人がログインしてハイライトを選ぼうとすると、指す相手がいない。</p>
      <p><b>黙って失敗させず、理由を伝える必要があります</b>——「SNS掲載をオフにしているため図鑑に載っていません」と、設定への導線を1つ。写真未登録の車は現時点で0台ですが、同じ扱いになります。</p>
    </li>
    <li>
      <h3>画面サイズが端末ごとに違う</h3>
      <p>1179×2556 は iPhone の Pro 系です。SE も Android も比率が違うので、この1枚を保存すると引き伸ばされるか切られます。</p>
      <p>ただし<b>ブラウザで生成する以上、その端末の実サイズで組める</b>——ここが今回の設計の効くところです。台数から列数を選ぶ仕組みなので、画面が変われば格子も自動で追随します。<b>「見ている端末の画面サイズで作る」を既定にするか、代表サイズから選ばせるか</b>が決めどころです。</p>
    </li>
  </ol>
</section>

<section>
  <h2>まだ決めていないこと</h2>
  <div class="verdict">
    <dl class="tr">
      <dt>126だけの図鑑</dt><dd>126は6台。図鑑として成立しないので不要と考えていますが、126サイト側から使う想定があるなら別です</dd>
      <dt>車が写っていない写真</dt><dd>鍵・ステッカー・イラスト・鎧兜などがメイン写真の車がいます。機械的に外さない方針で提案済み（外すと「載らない人」が生まれるため）</dd>
      <dt>横倒しの3台</dt><dd>壁紙側は補正表で回してあります。元写真そのものが傾いているので、車両ページでも横倒しのはず。根本の直し方は別の判断</dd>
      <dt>導線</dt><dd>付けません（指示があるまで）</dd>
    </dl>
  </div>
</section>

<footer>段1（絵の設計）の最終シート。原寸JPEGは registro500-notes\wallpaper-mock\phone\ に置いてある。</footer>
</div>
"""

html = TPL
for k, fn in {"__V1__": "V1_未ログイン_登録順.jpg", "__V2__": "V2_未ログイン_色順.jpg",
              "__V3__": "V3_ログイン_登録順.jpg", "__V4__": "V4_ログイン_色順.jpg"}.items():
    html = html.replace(k, uri(os.path.join(PH, fn), 270, 76))
html = html.replace("__HIZ__", uri(os.path.join(OUT, "hi_zoom.jpg"), 900, 80))
html = html.replace("__T1__", uri(os.path.join(OUT, "v1_top.jpg"), 540, 80))
html = html.replace("__B1__", uri(os.path.join(OUT, "v1_bot.jpg"), 540, 80))

with open(DEST, "w", encoding="utf-8") as f:
    f.write(html)
print(f"{DEST}  {os.path.getsize(DEST)/1024/1024:.2f} MB")
