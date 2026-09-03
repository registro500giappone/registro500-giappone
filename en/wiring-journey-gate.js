/* ============================================================================ English translation of /wiring-journey-gate.js — the gate that decides
   "who can read this now" for the weekly serial "Electrical Trouble Field Notes".
   Only 3 values: 'pre' (nobody yet, before early) / 'early' (registered owners only, before public)
   / 'open' (anyone, from public date on). Logic is identical to the Japanese original —
   only the user-facing strings are translated.
   ========================================================================== */
(function () {
  'use strict';

  var SUPA_URL = 'https://ttlttclfovuzafvghvaq.supabase.co';
  var SUPA_KEY = 'sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt';
  var SUPA_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.0';
  var SUPA_SRI = 'sha384-NFPmVbJvc91cC9zbheWJA+qZKj0Kod2IEMvGnxVKB5A7wLgRNA6Aobu8neZmQ19J';

  var PREVIEW = /[?&]preview=1/.test(location.search);

  var J = window.JOURNEY || {};
  var state = J.state || 'open';

  var isArticle = !!J.slug;
  if (isArticle && state !== 'open' && !PREVIEW) {
    var lock = document.createElement('style');
    lock.textContent = 'html.j-locked .col > :not(.j-gate){display:none}';
    (document.head || document.documentElement).appendChild(lock);
    document.documentElement.classList.add('j-locked');
  }

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
      s.onerror = function () { reject(new Error('Could not load supabase-js')); };
      (document.head || document.documentElement).appendChild(s);
    });
    return supaPromise;
  }
  var client = null;
  function mkClient() {
    if (!client) client = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    return client;
  }

  var lastQualify = null;
  function qualify() {
    if (PREVIEW) return Promise.resolve({ signedIn: true, owner: true });
    return supa().then(function (c) {
      return c.auth.getSession().then(function (r) {
        var session = r && r.data ? r.data.session : null;
        if (!session) return { signedIn: false, owner: false };
        return Promise.resolve(c.rpc('link_owner_car'))
          .catch(function () { return null; })
          .then(function () {
            return c.from('cars').select('document_id')
              .eq('owner_user_id', session.user.id).limit(1)
              .then(function (q) {
                if (q.error) return { signedIn: true, owner: true, degraded: true };
                return { signedIn: true, owner: !!(q.data && q.data.length) };
              });
          });
      });
    }).catch(function () {
      return { signedIn: false, owner: false, offline: true };
    }).then(function (v) { lastQualify = v; return v; });
  }

  var MODAL_CSS =
    '#jLoginModal{display:none;position:fixed;inset:0;background:#00000080;z-index:10000;' +
      'align-items:center;justify-content:center;padding:18px;' +
      'font-family:system-ui,-apple-system,"Segoe UI",sans-serif}' +
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
        '<h3>Log in</h3>' +
        '<p class="lead">We’ll send a code to your registered email to log you in</p>' +
        '<div class="step" id="jOtp1">' +
          '<input type="email" id="jOtpEmail" placeholder="Your registered email" autocomplete="email">' +
          '<button type="button" class="txt" id="jOtpClear" hidden>Use a different address</button>' +
          '<button type="button" class="pri" id="jOtpSend">Send confirmation code</button>' +
        '</div>' +
        '<div class="step" id="jOtp2" hidden>' +
          '<p class="sent">✅ Sent a 6-digit code to <b id="jOtpSentTo"></b>. Enter it below.</p>' +
          '<input type="text" id="jOtpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" class="code">' +
          '<button type="button" class="pri" id="jOtpVerify">Log in</button>' +
          '<button type="button" class="txt" id="jOtpResend">Resend the code</button>' +
        '</div>' +
        '<p class="err" id="jOtpErr" hidden></p>' +
        '<button type="button" class="txt close" id="jOtpClose">Close</button>' +
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
      if (!email) { err('Please enter your email address'); return; }
      var b = $('jOtpSend'); b.disabled = true; b.textContent = 'Sending…';
      supa().then(function (c) { return c.auth.signInWithOtp({ email: email }); })
        .then(function (r) {
          b.disabled = false; b.textContent = 'Send confirmation code';
          if (r.error) { err('Could not send it: ' + r.error.message); return; }
          otpEmail = email;
          localStorage.setItem('r500_login_email', email);
          $('jOtpSentTo').textContent = email;
          $('jOtp1').hidden = true; $('jOtp2').hidden = false;
          err('');
        }).catch(function () {
          b.disabled = false; b.textContent = 'Send confirmation code';
          err('Could not send it. Please check your connection.');
        });
    };
    $('jOtpVerify').onclick = function () {
      var code = $('jOtpCode').value.trim();
      if (!code) { err('Please enter the confirmation code'); return; }
      var b = $('jOtpVerify'); b.disabled = true; b.textContent = 'Verifying…';
      supa().then(function (c) { return c.auth.verifyOtp({ email: otpEmail, token: code, type: 'email' }); })
        .then(function (r) {
          b.disabled = false; b.textContent = 'Log in';
          if (r.error) { err('The code is wrong or has expired. Please try again.'); return; }
          m.style.display = 'none';
        }).catch(function () {
          b.disabled = false; b.textContent = 'Log in';
          err('Could not verify. Please check your connection.');
        });
    };
    $('jOtpResend').onclick = function () {
      if (!otpEmail) return;
      supa().then(function (c) { return c.auth.signInWithOtp({ email: otpEmail }); })
        .then(function (r) { err(r.error ? ('Could not resend it: ' + r.error.message) : ''); });
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

  var watching = false;
  function watchAuth(onChange) {
    if (watching) return;
    watching = true;
    supa().then(function (c) {
      c.auth.onAuthStateChange(function () { setTimeout(function () { qualify().then(onChange); }, 0); });
    }).catch(function () { });
  }

  /* ---- Article gate ------------------------------------------------------ */
  function enDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
  }

  function card(kind, q) {
    var el = document.createElement('div');
    el.className = 'j-gate';
    var kai = J.n ? ('Part ' + J.n) : 'This part';
    if (kind === 'pre') {
      el.innerHTML =
        '<h2>' + kai + ' isn’t published yet</h2>' +
        '<p>This series comes out once a week, every Friday. Published parts can be read from the index.</p>' +
        '<p class="j-gate-act"><a class="j-btn" href="/en/wiring-journey.html">Back to the index</a></p>';
      return el;
    }
    var why = q && q.offline
      ? '<p class="j-gate-note">We couldn’t check your login status right now. Please check your connection and reopen the page.</p>'
      : '';
    var when = J.pub ? 'This part opens to everyone on ' + enDate(J.pub) + '.'
                     : 'Please wait a little longer before this part opens to everyone.';
    el.innerHTML =
      '<h2>' + kai + ' is currently for registered owners only</h2>' +
      '<p>Registered owners get to read this series <b>one week early</b>. ' + when + '</p>' +
      '<p>If you’ve registered your car, log in with that email address to keep reading.</p>' +
      why +
      '<p class="j-gate-act">' +
        '<button type="button" class="j-btn" id="jGateLogin">Log in to read</button>' +
        '<a class="j-btn ghost" href="/en/wiring-journey.html">Back to the index</a>' +
      '</p>';
    return el;
  }

  function renderArticle(q) {
    var col = document.querySelector('.col');
    if (!col) return;
    var old = col.querySelector('.j-gate');
    if (old) old.remove();

    var pass = PREVIEW || (state === 'open') || (state === 'early' && q && q.owner);
    if (pass) {
      document.documentElement.classList.remove('j-locked');
      if (state === 'early' && !col.querySelector('.j-early')) {
        var s = document.createElement('p');
        s.className = 'j-early';
        s.innerHTML = '<b>Early access for registered owners.</b> ' +
          (J.pub ? 'This part opens to everyone on ' + enDate(J.pub) + '.' : '');
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
    if (state === 'open') return;
    if (PREVIEW) { renderArticle({ owner: true }); return; }
    if (state === 'pre') { renderArticle(null); return; }
    renderArticle({ owner: false });
    qualify().then(renderArticle);
    watchAuth(renderArticle);
  }

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
