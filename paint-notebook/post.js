// みんなのお絵描き手帳への投稿（500・126 共通）
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
#postDlg input[type=text],#postDlg select{width:100%;font:inherit;font-size:14px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--chip);color:var(--ink)}
#postDlg .cnt{float:right}
#postDlg .rule{font-size:12px;color:var(--sub);margin:10px 0;line-height:1.6}
#postDlg .btns{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
#postDlg .msg{font-size:13px;margin-top:8px;min-height:1em}
`;
const HTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="postTitle">
  <h2 id="postTitle">みんなのお絵描き手帳に投稿</h2>
  <img id="postImg" alt="投稿する画像">
  <div id="postCarRow" hidden><label for="postCar">投稿する車</label><select id="postCar"></select></div>
  <div id="postNameRow"><label for="postName">お名前（任意・20字まで・空欄なら「ゲスト」）</label><input type="text" id="postName" maxlength="20" autocomplete="nickname"></div>
  <label for="postCmt">ひとこと（任意）<span class="cnt" id="postCnt">0/40</span></label><input type="text" id="postCmt" maxlength="40">
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
  $('postCmt').oninput = () => { $('postCnt').textContent = [...$('postCmt').value].length + '/40'; };
  $('postCar').onchange = () => { $('postNameRow').hidden = $('postCar').value !== ''; };

  async function open(){
    done = false; busy = false;
    $('postMsg').textContent = ''; $('postSend').disabled = false; $('postSend').textContent = '投稿する'; $('postCancel').hidden = false;
    $('postCmt').value = ''; $('postCnt').textContent = '0/40';
    blob = await toThumb(snap()); url = URL.createObjectURL(blob); $('postImg').src = url;
    dlg.style.display = 'flex';
    // ログイン中のオーナー＝同じ型式の自分の車を選べる（無ければゲストとして投稿）
    $('postCarRow').hidden = true; $('postNameRow').hidden = false;
    try{
      const c = await sb(); const { data: { session } } = await c.auth.getSession();
      if(session){
        const { data: cars } = await c.from('cars').select('document_id,handle_name,model_display_c')
          .eq('owner_user_id', session.user.id).eq('car_type', carType).order('document_id');
        if(cars && cars.length){
          $('postCar').innerHTML = '';
          cars.forEach(r => { const o = document.createElement('option'); o.value = r.document_id;
            o.textContent = (r.handle_name || 'オーナー') + '（' + (r.model_display_c || 'FIAT ' + carType) + '）'; $('postCar').appendChild(o); });
          const g = document.createElement('option'); g.value = ''; g.textContent = 'ゲストとして投稿（車に紐づけない）'; $('postCar').appendChild(g);
          $('postCarRow').hidden = false; $('postNameRow').hidden = true;
        }
      }
    }catch(e){ /* 読めなくてもゲストとして投稿できる */ }
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
