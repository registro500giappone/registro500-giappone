// みんなのお絵描き帳への投稿（500・126 共通）
// 投稿するのは「設計図」＝URL の # 以降と、一覧に並べる縮小画像1枚だけ。動画は預からない
const SB_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.94.0';
const SB_SRI = 'sha384-NFPmVbJvc91cC9zbheWJA+qZKj0Kod2IEMvGnxVKB5A7wLgRNA6Aobu8neZmQ19J';
export const BUCKET = 'paint-thumbs';
const KEYS = 'paintPostKeys';

function loadScript(src, integrity){
  return new Promise((ok, ng) => {
    const s = document.createElement('script'); s.src = src;
    if(integrity){ s.integrity = integrity; s.crossOrigin = 'anonymous'; }
    s.onload = ok; s.onerror = () => ng(new Error('load ' + src)); document.head.appendChild(s);
  });
}
let sbP = null;
export function sb(){
  // config.js（SUPABASE_URL などの共通設定）と supabase-js は使うときに読む＝お絵描きだけの人に余計な通信をさせない
  return sbP ||= (async () => {
    if(typeof SUPABASE_URL === 'undefined') await loadScript('/config.js');
    if(!window.supabase) await loadScript(SB_JS, SB_SRI);
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  })();
}
// Google ログインから戻ると # がトークンに置き換わる＝描いた車（# の設計図）が消える。
// 出る前に # を預け、戻ったらお絵描き帳が readHash() する前（＝この import の時点）に書き戻す。トークンは後で setSession する
const RESUME = 'paintPostResume';
let backAuth = null;
try{
  const back = sessionStorage.getItem(RESUME);
  if(back !== null){
    sessionStorage.removeItem(RESUME);
    const h = new URLSearchParams(location.hash.slice(1));
    backAuth = h.has('access_token') ? { access_token: h.get('access_token'), refresh_token: h.get('refresh_token') } : { error: true };
    history.replaceState(null, '', location.pathname + location.search + back);
  }
}catch(e){}

export function thumbUrl(path){ return SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path; }

// ビジターの削除用の鍵＝投稿した端末にだけ残す（消えても管理者は消せる）
export function myKeys(){ try{ return JSON.parse(localStorage.getItem(KEYS) || '{}'); }catch(e){ return {}; } }
function saveKey(id, key){ try{ const k = myKeys(); k[id] = key; localStorage.setItem(KEYS, JSON.stringify(k)); }catch(e){} }
export function forgetKey(id){ try{ const k = myKeys(); delete k[id]; localStorage.setItem(KEYS, JSON.stringify(k)); }catch(e){} }

// 削除＝投稿を消してから、どこからも参照されなくなった縮小画像を片付ける
export async function deletePost(id){
  const c = await sb();
  const { data, error } = await c.rpc('paint_post_delete', { p_id: id, p_delete_key: myKeys()[id] || null });
  if(error) throw error;
  if(data) await c.storage.from(BUCKET).remove([data]);
  forgetKey(id);
}

// いまの画面を 4:3・640×480 の JPEG に（真ん中を切り出す）
function toThumb(canvas){
  const W = 640, H = 480, cw = canvas.width, ch = canvas.height;
  const s = Math.min(cw / W, ch / H), sw = W * s, sh = H * s;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').drawImage(canvas, (cw - sw) / 2, (ch - sh) / 2, sw, sh, 0, 0, W, H);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
}

const CSS = `
#postDlg{position:fixed;inset:0;background:rgba(0,0,0,.78);display:none;align-items:center;justify-content:center;z-index:11;padding:16px}
#postDlg .box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;width:100%;max-width:420px;max-height:92vh;overflow:auto}
#postDlg h2{font-size:16px;margin:0 0 8px;color:var(--deep)}
#postDlg img{width:100%;border-radius:10px;display:block;margin-bottom:10px;background:#cfc4ae}
#postDlg label{display:block;font-size:12px;color:var(--sub);margin:8px 0 4px}
#postDlg input[type=text],#postDlg select,#postDlg textarea{width:100%;font:inherit;font-size:14px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--chip);color:var(--ink)}
#postDlg .cnt{float:right}
#postDlg textarea{resize:none;line-height:1.5;display:block}
#postDlg .rule{font-size:12px;color:var(--sub);margin:10px 0;line-height:1.6}
#postDlg .btns{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
#postDlg .msg{font-size:13px;margin-top:8px;min-height:1em}
#postDlg .golist{display:inline-block;margin-top:6px;color:var(--deep);font-weight:600}
#postDlg [hidden]{display:none!important}
#postLogin{border-bottom:1px solid var(--line);margin-bottom:6px;padding-bottom:8px}
#postLogin .rule{margin:0 0 6px}
#postLogin input{width:100%;font:inherit;font-size:14px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--chip);color:var(--ink);margin-top:6px}
#postLogin .err{font-size:12px;color:#c0392b;margin:4px 0 0;min-height:1em}
#postLogin .wide{width:100%;margin-top:6px}
#postToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:13px;z-index:12;max-width:90vw;box-shadow:0 4px 16px rgba(0,0,0,.3)}
`;
const HTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="postTitle">
  <h2 id="postTitle">みんなのお絵描き帳に投稿</h2>
  <img id="postImg" alt="投稿する画像">
  <div id="postLogin" hidden>
    <p class="rule" id="postLoginNote">登録オーナーの方は、ログインすると自分の車に紐づけて投稿できます。</p>
    <div class="btns" id="postLoginOpen"><button id="postLoginBtn">ログイン</button></div>
    <div id="postLogin1" hidden>
      <input type="email" id="postMail" inputmode="email" autocomplete="email" placeholder="登録したメールアドレス">
      <p class="err" id="postErr1"></p>
      <div class="btns"><button id="postOtpSend" class="primary">コードを送る</button></div>
      <button id="postGoogle" class="wide">Googleでログイン</button>
    </div>
    <div id="postLogin2" hidden>
      <p class="rule">メールに届いた6桁のコードを入れてください。</p>
      <input type="text" id="postCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6桁のコード">
      <p class="err" id="postErr2"></p>
      <div class="btns"><button id="postResend">再送</button><button id="postVerify" class="primary">ログイン</button></div>
    </div>
  </div>
  <div id="postCarRow" hidden><label for="postCar">投稿する車</label><select id="postCar"></select></div>
  <div id="postNameRow"><label for="postName">お名前（任意・20字まで・空欄なら「ゲスト」）</label><input type="text" id="postName" maxlength="20" autocomplete="nickname"></div>
  <label for="postCmt">ひとこと（任意）<span class="cnt" id="postCnt">0/40</span></label><textarea id="postCmt" maxlength="40" rows="2" enterkeyhint="done"></textarea>
  <p class="rule">投稿は誰でも見られる一覧に載ります。不適切な内容は管理者が削除します。</p>
  <div class="btns"><button id="postCancel">やめる</button><button id="postSend" class="primary">投稿する</button></div>
  <p class="msg" id="postMsg" role="status"></p>
</div>`;

const ERR = {
  'rate limited':'いま投稿が混み合っています。少し時間をおいてお試しください。',
  'comment too long':'ひとことは40字までです。', 'name too long':'お名前は20字までです。',
  'not your car':'この車では投稿できませんでした。ログインし直してお試しください。'
};

// carType＝'500' か '126'／snap()＝いまの画面を描いた canvas を返す
export function mountPost({ carType, snap }){
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const dlg = document.createElement('div'); dlg.id = 'postDlg'; dlg.innerHTML = HTML; document.body.appendChild(dlg);
  const $ = id => document.getElementById(id);
  let blob = null, url = null, busy = false, done = false;

  const close = () => { dlg.style.display = 'none'; if(url){ URL.revokeObjectURL(url); url = null; } };
  $('postCancel').onclick = close;
  dlg.addEventListener('click', e => { if(e.target === dlg && !busy) close(); });
  // ひとことは1行の文＝折り返して全文を見せるが、改行は入れさせない
  $('postCmt').oninput = () => { const v = $('postCmt').value.replace(/[\r\n]+/g, ' '); if(v !== $('postCmt').value) $('postCmt').value = v; $('postCnt').textContent = [...v].length + '/40';
    $('postCmt').style.height = 'auto'; $('postCmt').style.height = $('postCmt').scrollHeight + 2 + 'px'; };
  $('postCmt').onkeydown = e => { if(e.key === 'Enter' && !e.isComposing){ e.preventDefault(); $('postCmt').blur(); } };
  $('postCar').onchange = () => { $('postNameRow').hidden = $('postCar').value !== ''; };

  async function open(){
    done = false; busy = false;
    $('postMsg').textContent = ''; $('postSend').disabled = false; $('postSend').textContent = '投稿する'; $('postCancel').hidden = false;
    $('postCmt').value = ''; $('postCnt').textContent = '0/40'; $('postCmt').style.height = '';
    blob = await toThumb(snap()); url = URL.createObjectURL(blob); $('postImg').src = url;
    dlg.style.display = 'flex';
    await refreshOwner();
  }

  // ログイン中のオーナー＝同じ型式の自分の車を選べる（無ければゲストとして投稿）。未ログインならログイン欄を出す
  async function refreshOwner(){
    $('postCarRow').hidden = true; $('postNameRow').hidden = false; $('postLogin').hidden = true;
    try{
      const c = await sb(); const { data: { session } } = await c.auth.getSession();
      if(!session){
        $('postLoginNote').textContent = '登録オーナーの方は、ログインすると自分の車に紐づけて投稿できます。';
        $('postLoginOpen').hidden = false; $('postLogin1').hidden = true; $('postLogin2').hidden = true;
        $('postErr1').textContent = ''; $('postErr2').textContent = '';
        $('postLogin').hidden = false;
        return;
      }
      // 他ページと同じく、メールが一致する未紐づけの車をここで自分のアカウントへ紐づける
      await Promise.resolve(c.rpc('link_owner_car')).catch(() => null);
      const { data: cars } = await c.from('cars').select('document_id,handle_name,model_display_c')
        .eq('owner_user_id', session.user.id).eq('car_type', carType).order('document_id');
      if(cars && cars.length){
        $('postCar').innerHTML = '';
        // 一覧に出るのはハンドルネームだけ＝選ぶ欄もそれに揃える（同じ名前の車が2台あるときだけ車種を添えて見分ける）
        const dup = n => cars.filter(r => (r.handle_name || 'オーナー') === n).length > 1;
        cars.forEach(r => { const o = document.createElement('option'); o.value = r.document_id; const n = r.handle_name || 'オーナー';
          o.textContent = dup(n) ? n + '（' + (r.model_display_c || 'FIAT ' + carType) + '）' : n; $('postCar').appendChild(o); });
        const g = document.createElement('option'); g.value = ''; g.textContent = 'ゲストとして投稿（車に紐づけない）'; $('postCar').appendChild(g);
        $('postCarRow').hidden = false; $('postNameRow').hidden = true;
      }else{
        $('postLoginNote').textContent = 'ログイン中ですが、このアカウントに FIAT ' + carType + ' の登録が見つからないため、ゲストとして投稿します。';
        $('postLoginOpen').hidden = true; $('postLogin1').hidden = true; $('postLogin2').hidden = true;
        $('postLogin').hidden = false;
      }
    }catch(e){ /* 読めなくてもゲストとして投稿できる */ }
  }

  // ログイン（メールのコード／Google）＝壁紙・イベントページと同じ Supabase Auth
  let otpMail = '';
  $('postLoginBtn').onclick = () => {
    $('postLoginOpen').hidden = true; $('postLogin1').hidden = false;
    try{ const m = localStorage.getItem('r500_login_email'); if(m && !$('postMail').value) $('postMail').value = m; }catch(e){}
  };
  $('postOtpSend').onclick = async () => {
    const m = $('postMail').value.trim();
    if(!/.+@.+\..+/.test(m)){ $('postErr1').textContent = 'メールアドレスをご確認ください。'; return; }
    $('postErr1').textContent = ''; $('postOtpSend').disabled = true;
    try{
      const { error } = await (await sb()).auth.signInWithOtp({ email: m });
      const sentBefore = !!error && /after [0-9]+ seconds/.test(String(error.message));  // 1分以内に送信済み＝届いたコードが使える
      if(error && !sentBefore){ $('postErr1').textContent = error.status === 429 ? '送信が続いたため一時的に止まっています。数分おいてからお試しください。' : '送信できませんでした：' + error.message; return; }
      $('postErr2').textContent = sentBefore ? '確認コードは少し前に送信済みです。届いているメールの、いちばん新しいコードを入力してください。' : '';
      otpMail = m; try{ localStorage.setItem('r500_login_email', m); }catch(e){}
      $('postLogin1').hidden = true; $('postLogin2').hidden = false; $('postCode').focus();
    }catch(e){ $('postErr1').textContent = '通信に失敗しました。'; }
    finally{ $('postOtpSend').disabled = false; }
  };
  $('postResend').onclick = async () => {
    try{ const { error } = await (await sb()).auth.signInWithOtp({ email: otpMail });
      $('postErr2').textContent = error ? (error.status === 429 ? '再送は1分ほど間をあけてからお試しください。直前に届いたコードはそのまま使えます。' : '再送に失敗しました。') : 'コードを送り直しました。'; }
    catch(e){ $('postErr2').textContent = '通信に失敗しました。'; }
  };
  $('postVerify').onclick = async () => {
    const code = $('postCode').value.trim();
    if(!/^\d{6}$/.test(code)){ $('postErr2').textContent = '6桁の数字を入れてください。'; return; }
    $('postVerify').disabled = true;
    try{
      const { error } = await (await sb()).auth.verifyOtp({ email: otpMail, token: code, type: 'email' });
      if(error){ $('postErr2').textContent = 'コードが違うようです。何度か送信した場合は、いちばん新しいメールのコードを入力してください。'; return; }
      $('postCode').value = ''; await refreshOwner();
    }catch(e){ $('postErr2').textContent = '通信に失敗しました。'; }
    finally{ $('postVerify').disabled = false; }
  };
  $('postGoogle').onclick = async () => {
    try{
      sessionStorage.setItem(RESUME, location.hash);
      const { error } = await (await sb()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + location.search } });
      if(error){ sessionStorage.removeItem(RESUME); $('postErr1').textContent = 'Google ログインを開始できませんでした：' + error.message; }
    }catch(e){ try{ sessionStorage.removeItem(RESUME); }catch(_){} $('postErr1').textContent = '通信に失敗しました。'; }
  };

  // Google から戻ったとき＝トークンを渡してログインを済ませ、もう一度「投稿」を押してもらう
  // （自動で開かないのは、車の読み込みが終わる前に写すと空の画像になるため）
  if(backAuth){
    const toast = t => { const d = document.createElement('div'); d.id = 'postToast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 6000); };
    if(backAuth.access_token){
      sb().then(c => c.auth.setSession(backAuth)).then(({ error }) => toast(error ? 'ログインできませんでした。もう一度お試しください。' : 'ログインしました。もう一度「投稿」を押してください。'))
        .catch(() => toast('ログインできませんでした。もう一度お試しください。'));
    }else toast('ログインできませんでした。もう一度お試しください。');
  }

  async function send(){
    if(busy) return;
    if(done){ close(); return; }
    busy = true; $('postSend').disabled = true; $('postMsg').textContent = '送っています…';
    const c = await sb().catch(() => null);
    if(!c){ $('postMsg').textContent = '接続できませんでした。電波の良い所でもう一度お試しください。'; busy = false; $('postSend').disabled = false; return; }
    const path = carType + '/' + crypto.randomUUID() + '.jpg';
    const carDoc = $('postCarRow').hidden ? null : ($('postCar').value || null);
    const key = carDoc ? null : Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
    try{
      const up = await c.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if(up.error) throw up.error;
      const { data: id, error } = await c.rpc('paint_post_create', {
        p_car_type: carType, p_design: location.hash.replace(/^#/, ''), p_thumb_path: path,
        p_comment: $('postCmt').value, p_name: carDoc ? null : $('postName').value,
        p_car_doc: carDoc, p_delete_key: key });
      if(error){ await c.storage.from(BUCKET).remove([path]); throw error; }
      if(key) saveKey(id, key);
      done = true;
      $('postMsg').textContent = carDoc ? '投稿しました。' : '投稿しました。この端末からなら、あとで削除できます。';
      const go = document.createElement('a'); go.href = '/paint-notebook/gallery'; go.textContent = 'みんなのお絵描き帳を見る →'; go.className = 'golist';
      $('postMsg').append(document.createElement('br'), go);
      $('postSend').textContent = '閉じる'; $('postSend').disabled = false; $('postCancel').hidden = true;
      if(window.gtag) gtag('event', 'paint_post', { car_type: carType, owner: carDoc ? 1 : 0 });
    }catch(e){
      const m = (e && e.message) || '';
      $('postMsg').textContent = ERR[m] || '投稿できませんでした。時間をおいてもう一度お試しください。';
      $('postSend').disabled = false;
    }
    busy = false;
  }
  $('postSend').onclick = send;
  return open;
}
