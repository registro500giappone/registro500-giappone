/**
 * rg-login.js — メールの確認コード（OTP）＋ Google のログイン欄を1か所に（S2-2）
 *
 * 使い方:
 *   <script src="/rg-login.js"></script> を、それを使うインライン <script> より前に置く（defer にしない）。
 *   ページ側には入れ物だけ置く:  <div id="rgLogin"></div>
 *   見出し（「〜するにはログインが必要です」）と、入れ物を出す・隠すのはページの仕事。
 *
 *   RG.login.mount(入れ物, {
 *     sb:            Supabase のクライアント（必須）
 *     google:        Google のボタンを出すか（既定 true）
 *     beforeGoogle:  Google へ飛ぶ直前に呼ぶ（下書きの保存など）
 *     redirectTo:    Google から戻る先（既定は今の URL）
 *     verifyLabel:   コード確認ボタンの文言（既定「ログイン」）
 *     beforeVerify:  コードを確かめる直前に呼ぶ
 *     onVerifyFail:  コードが通らなかったときに呼ぶ
 *     onVerified:    コードが通った直後に呼ぶ
 *   })
 *
 *   ログイン後の画面の切り替えは、これまでどおり各ページの onAuthStateChange が受け持つ。
 *   ログアウトとメールアドレスの変更（type:'email_change'）はここに入れない。
 *
 * 「1分以内に送信済み」: 同じ宛先へ続けて送ると Supabase が "… after N seconds" を返す。
 *   そのときは失敗にせず、コード入力へ進めて「少し前に送信済み」と伝える（届いているコードが使える）。
 */
(function () {
  var RG = window.RG = window.RG || {};
  var EMAIL_KEY = 'r500_login_email';

  var CSS = [
    '.rgl-col{display:flex;flex-direction:column;gap:10px;text-align:left}',
    '.rgl-hidden{display:none!important}',
    '.rgl-main{display:block;width:100%;text-align:center;background:var(--accent,#2e7d32);color:#fff;border:0;border-radius:10px;padding:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit}',
    '.rgl-main:disabled{opacity:.5;cursor:default}',
    '@media (prefers-color-scheme:dark){.rgl-main{color:#10261a}}',
    '.rgl-sub{width:100%;background:transparent;color:var(--accent,#2e7d32);border:1px solid var(--accent,#2e7d32);border-radius:8px;padding:12px;font-size:1rem;cursor:pointer;font-family:inherit}',
    '.rgl-link{background:none;border:0;padding:0;color:var(--accent,#2e7d32);font:inherit;font-size:.85rem;cursor:pointer}',
    '.rgl-link.rgl-clear{align-self:flex-start;color:var(--text-sub,#666);font-size:.78rem}',
    '.rgl-or{display:flex;align-items:center;gap:8px;color:var(--text-sub,#666);font-size:.78rem}',
    '.rgl-or span{flex:1;height:1px;background:var(--border-soft,#ddd)}',
    '.rgl-code{font-size:1.4rem!important;letter-spacing:8px;text-align:center}',
    '.rgl-msg{font-size:.88rem;margin:10px 0 0}',
    '.rgl-ok{color:var(--accent,#2e7d32)}',
    '.rgl-err{color:var(--danger,#c62828)}'
  ].join('\n');

  function addCss() {
    if (document.getElementById('rgl-css')) return;
    var st = document.createElement('style');
    st.id = 'rgl-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function html(google) {
    return '<div class="rgl-col">' +
      '<div class="rgl-col" data-rgl="step1">' +
        '<input type="email" data-rgl="email" placeholder="登録したメールアドレス" autocomplete="email">' +
        '<button type="button" class="rgl-link rgl-clear rgl-hidden" data-rgl="clear">別のアドレスを使う</button>' +
        '<button type="button" class="rgl-main" data-rgl="send">確認コードを送信</button>' +
        (google ?
          '<div class="rgl-or"><span></span>または<span></span></div>' +
          '<button type="button" class="rgl-sub" data-rgl="google">Googleでログイン（従来方式）</button>' : '') +
      '</div>' +
      '<div class="rgl-col rgl-hidden" data-rgl="step2">' +
        '<p class="rgl-msg rgl-ok">✅ <strong data-rgl="sent"></strong> に6桁の確認コードを送信しました。届いたコードを入力してください。</p>' +
        '<input type="text" class="rgl-code" data-rgl="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">' +
        '<button type="button" class="rgl-main" data-rgl="verify"></button>' +
        '<button type="button" class="rgl-link" data-rgl="resend">確認コードを再送する</button>' +
      '</div>' +
      '<p class="rgl-msg rgl-err rgl-hidden" data-rgl="error"></p>' +
    '</div>';
  }

  function mount(target, opts) {
    var box = typeof target === 'string' ? document.getElementById(target) : target;
    var o = opts || {};
    var sb = o.sb;
    if (!box || !sb) { console.error('RG.login.mount: 入れ物か sb が無い'); return null; }
    var google = o.google !== false;
    var verifyLabel = o.verifyLabel || 'ログイン';
    var call = function (fn) { if (typeof fn === 'function') return fn(); };

    addCss();
    box.innerHTML = html(google);
    var q = function (name) { return box.querySelector('[data-rgl="' + name + '"]'); };
    var show = function (name, on) { q(name).classList.toggle('rgl-hidden', !on); };
    var showError = function (msg) { q('error').textContent = msg || ''; show('error', !!msg); };
    q('verify').textContent = verifyLabel;

    var otpEmail = '';

    if (google) {
      q('google').addEventListener('click', function () {
        call(o.beforeGoogle);
        sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: o.redirectTo || location.href } });
      });
    }

    q('send').addEventListener('click', async function () {
      var email = q('email').value.trim();
      if (!email) { showError('メールアドレスを入力してください。'); return; }
      var btn = q('send');
      btn.disabled = true; btn.textContent = '送信中…';
      var res = await sb.auth.signInWithOtp({ email: email });
      var error = res.error;
      btn.disabled = false; btn.textContent = '確認コードを送信';
      var sentBefore = !!error && /after [0-9]+ seconds/.test(String(error.message));
      if (error && !sentBefore) {
        showError(error.status === 429 ? '送信が続いたため一時的に止まっています。数分おいてからお試しください。' : '送信に失敗しました：' + error.message);
        return;
      }
      otpEmail = email;
      try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
      q('sent').textContent = email;
      show('step1', false);
      show('step2', true);
      showError(sentBefore ? '確認コードは少し前に送信済みです。届いているメールの、いちばん新しいコードを入力してください。' : '');
    });

    q('verify').addEventListener('click', async function () {
      var code = q('code').value.trim();
      if (!code) { showError('確認コードを入力してください。'); return; }
      var btn = q('verify');
      btn.disabled = true; btn.textContent = '確認中…';
      call(o.beforeVerify);
      var res = await sb.auth.verifyOtp({ email: otpEmail, token: code, type: 'email' });
      btn.disabled = false; btn.textContent = verifyLabel;
      if (res.error) {
        call(o.onVerifyFail);
        showError('コードが正しくないか、期限切れです。何度か送信した場合は、いちばん新しいメールのコードを入力してください。');
        return;
      }
      showError('');
      call(o.onVerified);
    });

    q('resend').addEventListener('click', async function () {
      if (!otpEmail) return;
      var res = await sb.auth.signInWithOtp({ email: otpEmail });
      var error = res.error;
      showError(error ? (error.status === 429 ? '再送は1分ほど間をあけてからお試しください。直前に届いたコードはそのまま使えます。' : '再送に失敗しました：' + error.message) : '確認コードを再送しました。');
    });

    var saved = null;
    try { saved = localStorage.getItem(EMAIL_KEY); } catch (e) {}
    if (saved) { q('email').value = saved; show('clear', true); }
    q('clear').addEventListener('click', function () {
      q('email').value = '';
      show('clear', false);
      try { localStorage.removeItem(EMAIL_KEY); } catch (e) {}
      q('email').focus();
    });

    return {
      // コード入力の段からメール入力の段へ戻す（ログアウト後にもう一度出すとき用）
      reset: function () { otpEmail = ''; q('code').value = ''; show('step2', false); show('step1', true); showError(''); }
    };
  }

  RG.login = { mount: mount };
})();
