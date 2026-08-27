/* ============================================================================
   電装トラブルの旅手帳＝週刊連載の「いま誰が読めるか」を1か所で決める門番。

   ⚠️ 公開予定の正本は /journey-schedule.json （日付をここにもHTMLにも書かない）。
   ⚠️ 各記事HTMLの window.JOURNEY.state は wiring-simulator/publish_journey.py が
      毎日書き換える生成物＝手で編集しない。3つの値しか取らない：
        'pre'   … まだ誰も読めない（early 前）
        'early' … 登録オーナーだけ読める（early 以降・public 前）
        'open'  … 誰でも読める（public 以降）
      state を静的に持たせている理由＝公開済みの回で認証もfetchも走らせないため。
      公開後の記事は門番が即 return するので、読み込みは1ファイル増えるだけで済む。

   資格＝「ログイン済み かつ cars に自分の車がある人」（2026-08-25 ユーザー確定）。
      メールOTPはアドレスさえあれば誰でも通るので、ログインの有無だけでは
      「登録オーナーの特典」にならない。

   伏せ方＝画面で伏せる（2026-08-25 ユーザー確定）。HTMLソースを見れば本文は読める。
      これは機密ではなく「1週早く読める特典」なので、そこは割り切っている。
   ========================================================================== */
(function () {
  'use strict';

  var SUPA_URL = 'https://ttlttclfovuzafvghvaq.supabase.co';
  var SUPA_KEY = 'sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt';
  var SUPA_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.0';
  var SUPA_SRI = 'sha384-NFPmVbJvc91cC9zbheWJA+qZKj0Kod2IEMvGnxVKB5A7wLgRNA6Aobu8neZmQ19J';

  /* ⏳確認用＝?preview=1 を付けると門番を素通りできる（作業場での見た目確認用）。
     ⛔連載が本決まりになったら ?d= と一緒に消す。 */
  var PREVIEW = /[?&]preview=1/.test(location.search);

  var J = window.JOURNEY || {};
  var state = J.state || 'open';

  /* 記事ページでは、読ませてよいと分かるまで本文を伏せておく。
     ⚠️ここは同期実行＝<head> で読み込むこと。判定がついてから見せるのでは
        一度出た本文が消える形になり、読者には「取り上げられた」ように見える。
     ⚠️⚠️伏せる規則は共通CSSに置かず、この門番が自分で差し込む。
        Service Worker が CSS/JS を StaleWhileRevalidate で返す設計なので、
        共通CSSに置くと「古い版が1回返る＝先行中の本文が丸見え」が起こりうる。
        門番の挙動は門番のファイルの中だけで完結させる。 */
  var isArticle = !!J.slug;
  if (isArticle && state !== 'open' && !PREVIEW) {
    var lock = document.createElement('style');
    lock.textContent = 'html.j-locked .col > :not(.j-gate){display:none}';
    (document.head || document.documentElement).appendChild(lock);
    document.documentElement.classList.add('j-locked');
  }

  /* ---- Supabase は必要になったときだけ読む（公開済みの回では一切読まない） ---- */
  var supaPromise = null;
  function supa() {
    if (supaPromise) return supaPromise;
    supaPromise = new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve(mkClient());
      var s = document.createElement('script');
      s.src = SUPA_CDN;
      s.integrity = SUPA_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(mkClient()); };
      s.onerror = function () { reject(new Error('supabase-js を読み込めませんでした')); };
      (document.head || document.documentElement).appendChild(s);
    });
    return supaPromise;
  }
  var client = null;
  function mkClient() {
    if (!client) client = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    return client;
  }

  /* ---- 資格判定 --------------------------------------------------------- */
  var lastQualify = null;
  function qualify() {
    if (PREVIEW) return Promise.resolve({ signedIn: true, owner: true });
    return supa().then(function (c) {
      return c.auth.getSession().then(function (r) {
        var session = r && r.data ? r.data.session : null;
        if (!session) return { signedIn: false, owner: false };
        /* ⭐ログイン中のメールアドレスで cars を紐づけてから資格を見る（index.html 等と同型）。
           ⚠️これを呼ばないと、門番のモーダルからその場でログインした人は
           owner_user_id が埋まらず、「案内どおりログインしたのに読めない」状態になる（2026-08-27 修正）。
           紐づけ済みの人は 0 行更新で戻るだけ。失敗しても照会には進む。 */
        return Promise.resolve(c.rpc('link_owner_car'))
          .catch(function () { return null; })
          .then(function () {
            return c.from('cars').select('document_id')
              .eq('owner_user_id', session.user.id).limit(1)
              .then(function (q) {
                /* ⚠️問い合わせが失敗したときはログイン済みとして通す＝フェイルオープン。
                   1週間後には誰でも読める記事なので、「読めるはずの人が読めない」ほうが害が大きい。 */
                if (q.error) return { signedIn: true, owner: true, degraded: true };
                return { signedIn: true, owner: !!(q.data && q.data.length) };
              });
          });
      });
    }).catch(function () {
      /* supabase-js 自体が読めない（CDN 遮断・オフライン）。判定不能。 */
      return { signedIn: false, owner: false, offline: true };
    }).then(function (v) { lastQualify = v; return v; });
  }

  /* ---- ログインモーダル（イベントページ・video.html と同じメールOTP方式） --
     ⚠️見た目は CSS 変数に頼らずここで完結させる＝目次ページ（/wiring-journey.html）は
        共通CSS を読み込まない設計なので、変数を使うと目次側で色が落ちる。 */
  var MODAL_CSS =
    '#jLoginModal{display:none;position:fixed;inset:0;background:#00000080;z-index:10000;' +
      'align-items:center;justify-content:center;padding:18px;' +
      'font-family:system-ui,-apple-system,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif}' +
    '#jLoginModal .box{background:#fffdf8;color:#3a352c;border-radius:16px;padding:24px 20px;' +
      'max-width:340px;width:100%;text-align:center;box-shadow:0 12px 40px #00000038}' +
    '#jLoginModal h3{margin:0 0 6px;font-size:17px;color:#2c3a31}' +
    '#jLoginModal .lead{margin:0 0 16px;font-size:13px;color:#8d8574;line-height:1.7}' +
    '#jLoginModal .step{display:flex;flex-direction:column;gap:10px;text-align:left}' +
    '#jLoginModal .step[hidden]{display:none}' +
    '#jLoginModal input{padding:11px;border:1px solid #ddd5c4;border-radius:8px;font-size:15px;' +
      'font-family:inherit;background:#fff;color:#3a352c}' +
    '#jLoginModal input.code{font-size:22px;letter-spacing:8px;text-align:center}' +
    '#jLoginModal .pri{padding:12px;border:0;border-radius:8px;background:#2c3a31;color:#f7f2e4;' +
      'font-size:15px;font-weight:700;font-family:inherit;cursor:pointer}' +
    '#jLoginModal .txt{background:none;border:0;color:#2c3a31;font-size:13px;font-family:inherit;' +
      'cursor:pointer;padding:0;align-self:flex-start}' +
    '#jLoginModal .txt[hidden]{display:none}' +
    '#jLoginModal .txt.close{margin-top:16px;color:#8d8574;align-self:center}' +
    '#jLoginModal .sent{margin:0;font-size:13px;color:#2f7d4f;line-height:1.7}' +
    '#jLoginModal .err{margin:10px 0 0;font-size:13px;color:#b8442e;line-height:1.7}' +
    '#jLoginModal .err[hidden]{display:none}';

  var otpEmail = '';
  function modal() {
    var m = document.getElementById('jLoginModal');
    if (m) return m;
    var st = document.createElement('style');
    st.textContent = MODAL_CSS;
    document.head.appendChild(st);
    m = document.createElement('div');
    m.id = 'jLoginModal';
    m.innerHTML =
      '<div class="box">' +
        '<h3>ログイン</h3>' +
        '<p class="lead">登録したメールアドレスにコードを送ってログインします</p>' +
        '<div class="step" id="jOtp1">' +
          '<input type="email" id="jOtpEmail" placeholder="登録したメールアドレス" autocomplete="email">' +
          '<button type="button" class="txt" id="jOtpClear" hidden>別のアドレスを使う</button>' +
          '<button type="button" class="pri" id="jOtpSend">確認コードを送信</button>' +
        '</div>' +
        '<div class="step" id="jOtp2" hidden>' +
          '<p class="sent">✅ <b id="jOtpSentTo"></b> に6桁の確認コードを送信しました。届いたコードを入力してください。</p>' +
          '<input type="text" id="jOtpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" class="code">' +
          '<button type="button" class="pri" id="jOtpVerify">ログイン</button>' +
          '<button type="button" class="txt" id="jOtpResend">確認コードを再送する</button>' +
        '</div>' +
        '<p class="err" id="jOtpErr" hidden></p>' +
        '<button type="button" class="txt close" id="jOtpClose">閉じる</button>' +
      '</div>';
    document.body.appendChild(m);

    var $ = function (id) { return document.getElementById(id); };
    function err(msg) {
      var e = $('jOtpErr');
      if (!msg) { e.hidden = true; return; }
      e.textContent = msg; e.hidden = false;
    }
    $('jOtpClose').onclick = function () { m.style.display = 'none'; };
    m.onclick = function (ev) { if (ev.target === m) m.style.display = 'none'; };
    $('jOtpClear').onclick = function () {
      $('jOtpEmail').value = ''; $('jOtpEmail').focus();
      localStorage.removeItem('r500_login_email');
      $('jOtpClear').hidden = true;
    };
    $('jOtpSend').onclick = function () {
      var email = $('jOtpEmail').value.trim();
      if (!email) { err('メールアドレスを入力してください'); return; }
      var b = $('jOtpSend'); b.disabled = true; b.textContent = '送信中…';
      supa().then(function (c) { return c.auth.signInWithOtp({ email: email }); })
        .then(function (r) {
          b.disabled = false; b.textContent = '確認コードを送信';
          if (r.error) { err('送信に失敗しました：' + r.error.message); return; }
          otpEmail = email;
          localStorage.setItem('r500_login_email', email);
          $('jOtpSentTo').textContent = email;
          $('jOtp1').hidden = true; $('jOtp2').hidden = false;
          err('');
        }).catch(function () {
          b.disabled = false; b.textContent = '確認コードを送信';
          err('送信に失敗しました。通信の状態をご確認ください。');
        });
    };
    $('jOtpVerify').onclick = function () {
      var code = $('jOtpCode').value.trim();
      if (!code) { err('確認コードを入力してください'); return; }
      var b = $('jOtpVerify'); b.disabled = true; b.textContent = '確認中…';
      supa().then(function (c) { return c.auth.verifyOtp({ email: otpEmail, token: code, type: 'email' }); })
        .then(function (r) {
          b.disabled = false; b.textContent = 'ログイン';
          if (r.error) { err('コードが正しくないか、期限切れです。もう一度お試しください。'); return; }
          m.style.display = 'none';
          /* 成功 → onAuthStateChange が拾って画面を作り直す */
        }).catch(function () {
          b.disabled = false; b.textContent = 'ログイン';
          err('確認に失敗しました。通信の状態をご確認ください。');
        });
    };
    $('jOtpResend').onclick = function () {
      if (!otpEmail) return;
      supa().then(function (c) { return c.auth.signInWithOtp({ email: otpEmail }); })
        .then(function (r) { err(r.error ? ('再送に失敗しました：' + r.error.message) : ''); });
    };
    return m;
  }

  function openLogin() {
    var m = modal();
    m.style.display = 'flex';
    var inp = document.getElementById('jOtpEmail');
    var saved = localStorage.getItem('r500_login_email');
    if (saved && inp && !inp.value) {
      inp.value = saved;
      document.getElementById('jOtpClear').hidden = false;
    }
  }

  /* ログイン状態が変わったら、開いている画面を作り直す。
     ⚠️購読は supabase を読んだ後にしか張れない＝門番が動く場面でだけ張る。 */
  var watching = false;
  function watchAuth(onChange) {
    if (watching) return;
    watching = true;
    supa().then(function (c) {
      /* ⚠️onAuthStateChange のコールバック内で supabase を直接呼ぶと認証ロックで
         デッドロックする（index.html に同じ旨の注釈あり）。setTimeout で外へ逃がす。
         qualify() が rpc を呼ぶようになったため、この回避が必要になった。 */
      c.auth.onAuthStateChange(function () { setTimeout(function () { qualify().then(onChange); }, 0); });
    }).catch(function () { /* 判定不能のときは張らない */ });
  }

  /* ---- 記事ページの門 --------------------------------------------------- */
  function jaDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? (Number(m[2]) + '月' + Number(m[3]) + '日') : '';
  }

  function card(kind, q) {
    var el = document.createElement('div');
    el.className = 'j-gate';
    var kai = J.n ? ('第' + J.n + '回') : 'この回';
    if (kind === 'pre') {
      el.innerHTML =
        '<h2>' + kai + 'はまだ公開していません</h2>' +
        '<p>この連載は毎週金曜に1回ずつ出しています。公開ずみの回は目次から読めます。</p>' +
        '<p class="j-gate-act"><a class="j-btn" href="/wiring-journey.html">目次へ</a></p>';
      return el;
    }
    /* early＝登録オーナー先行 */
    var why = q && q.offline
      ? '<p class="j-gate-note">いまログインの状態を確認できませんでした。通信の状態をご確認のうえ、開き直してください。</p>'
      : '';
    var when = J.pub ? 'どなたでも読めるようになるのは' + jaDate(J.pub) + 'です。'
                     : 'どなたでも読めるようになるまで、もうしばらくお待ちください。';
    el.innerHTML =
      '<h2>' + kai + 'は、いま登録オーナーだけが読めます</h2>' +
      '<p>この連載は<b>登録オーナーが1週先に読めます</b>。' + when + '</p>' +
      '<p>車を登録している方は、登録したメールアドレスでログインするとこのまま読めます。</p>' +
      why +
      '<p class="j-gate-act">' +
        '<button type="button" class="j-btn" id="jGateLogin">ログインして読む</button>' +
        '<a class="j-btn ghost" href="/wiring-journey.html">目次へ</a>' +
      '</p>';
    return el;
  }

  function renderArticle(q) {
    var col = document.querySelector('.col');
    if (!col) return;
    var old = col.querySelector('.j-gate');
    if (old) old.remove();

    /* ⏳?preview=1 は state を問わず通す＝作業場で「先行中の見た目」ごと確かめられる */
    var pass = PREVIEW || (state === 'open') || (state === 'early' && q && q.owner);
    if (pass) {
      document.documentElement.classList.remove('j-locked');
      /* 先行中に読めている人には、なぜ読めているのかを本文の頭で1行言う */
      if (state === 'early' && !col.querySelector('.j-early')) {
        var s = document.createElement('p');
        s.className = 'j-early';
        s.innerHTML = '<b>登録オーナー先行</b>の回です。' +
          (J.pub ? 'どなたでも読めるようになるのは' + jaDate(J.pub) + 'です。' : '');
        col.insertBefore(s, col.firstChild);
      }
      return;
    }
    document.documentElement.classList.add('j-locked');
    col.insertBefore(card(state === 'pre' ? 'pre' : 'early', q), col.firstChild);
    var b = document.getElementById('jGateLogin');
    if (b) b.onclick = openLogin;
  }

  function bootArticle() {
    if (state === 'open') return;               /* 公開ずみ＝門番は何もしない */
    if (PREVIEW) { renderArticle({ owner: true }); return; }
    if (state === 'pre') { renderArticle(null); return; }  /* 認証を見るまでもない */
    renderArticle({ owner: false });            /* まず伏せる。判定がついたら開く */
    qualify().then(renderArticle);
    watchAuth(renderArticle);
  }

  /* ---- 外に出す（目次ページが使う） ------------------------------------- */
  window.JourneyGate = {
    qualify: qualify,
    openLogin: openLogin,
    watchAuth: watchAuth,
    preview: PREVIEW,
    last: function () { return lastQualify; }
  };

  if (isArticle) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootArticle);
    } else {
      bootArticle();
    }
  }
})();
