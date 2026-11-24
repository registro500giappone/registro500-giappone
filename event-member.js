// イベント参加者限定の共有（動画・写真）。イベント個別ページ（py/gen_event_pages.py の雛形）から読む。
// 見られるのは名簿 event_video_access に自分の車がある人と管理人だけ（RLS とバケットのポリシーで守る）。
// ページ側の supabaseClient・EVENT_ID・currentUser・openLoginModal を使う。
// ⚠️ このファイルを直したら雛形の ?v= を上げる（Service Worker が古い版を持ち続けるため）。
(function () {
  'use strict';
  const BUCKET = 'event-member-photos';
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  const FULL_PX = 1600, THUMB_PX = 400;
  let myCars = [];          // 名簿にある自分の車 [{car_id, handle_name}]
  let photos = [];          // 表示中の写真（署名つきURLつき）
  let busy = false;

  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    }
    if (text != null) n.textContent = text;
    return n;
  }

  // YouTube の各種URL（watch?v= / youtu.be / shorts / live / embed）から ID を取り出す
  function youtubeId(input) {
    const s = String(input || '').trim();
    if (YT_ID.test(s)) return s;
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(shorts|live|embed)\/([^/?#]+)/);
        if (m) id = m[2];
      }
    }
    return id && YT_ID.test(id) ? id : null;
  }

  // 写真をブラウザで縮めて JPEG に（位置情報などの EXIF もここで落ちる）
  async function resize(file, maxPx, quality) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    let src = bmp, w, h;
    if (bmp) { w = bmp.width; h = bmp.height; }
    else {
      src = await new Promise((ok, ng) => {
        const img = new Image();
        img.onload = () => ok(img); img.onerror = ng;
        img.src = URL.createObjectURL(file);
      });
      w = src.naturalWidth; h = src.naturalHeight;
    }
    const r = Math.min(1, maxPx / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * r); c.height = Math.round(h * r);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', quality));
  }

  function uuid() {
    return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  function canDelete(row) {
    return row.car_id && myCars.some((c) => c.car_id === row.car_id);
  }

  function renderVideos(box, vids) {
    if (!vids.length) return;
    box.appendChild(el('h3', null, '🎬 動画'));
    for (const v of vids) {
      if (!YT_ID.test(v.youtube_id || '')) continue;
      const item = el('div', { class: 'mv-item' });
      if (v.title) item.appendChild(el('p', { class: 'mv-title' }, v.title));
      const f = el('iframe', {
        src: 'https://www.youtube-nocookie.com/embed/' + v.youtube_id + '?rel=0',
        title: v.title || '参加者向けの動画', loading: 'lazy',
        allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen',
        allowfullscreen: ''
      });
      if (!v.vertical) f.className = 'wide';   // ショート以外は横長
      item.appendChild(f);
      if (v.handle_name || canDelete(v)) {
        const by = el('p', { class: 'mv-by' }, v.handle_name ? v.handle_name + ' さん' : '');
        if (canDelete(v)) {
          const b = el('button', { type: 'button' }, '削除');
          b.onclick = () => removeVideo(v);
          by.appendChild(document.createTextNode(' '));
          by.appendChild(b);
        }
        item.appendChild(by);
      }
      box.appendChild(item);
    }
  }

  async function renderPhotos(box, rows) {
    if (!rows.length) return;
    box.appendChild(el('h3', null, '📷 写真（' + rows.length + '枚）'));
    const paths = [];
    for (const r of rows) { paths.push(r.path.replace(/\.jpg$/, '_t.jpg')); paths.push(r.path); }
    const { data: signed } = await supabaseClient.storage.from(BUCKET).createSignedUrls(paths, 3600);
    const map = {};
    for (const s of signed || []) if (s.signedUrl) map[s.path] = s.signedUrl;
    photos = rows.map((r) => Object.assign({}, r, {
      thumb: map[r.path.replace(/\.jpg$/, '_t.jpg')] || map[r.path], full: map[r.path]
    })).filter((p) => p.full);
    const grid = el('div', { class: 'mv-grid' });
    photos.forEach((p, i) => {
      const a = el('a', { href: p.full });
      a.onclick = (ev) => { ev.preventDefault(); openViewer(i); };
      const img = el('img', { src: p.thumb, loading: 'lazy', alt: p.handle_name ? p.handle_name + ' さんの写真' : '写真' });
      a.appendChild(img);
      grid.appendChild(a);
    });
    box.appendChild(grid);
  }

  // 拡大表示（前後送り・投稿者・本人なら削除）
  let viewerIdx = 0;
  function openViewer(i) {
    let v = document.getElementById('mvViewer');
    if (!v) {
      v = el('div', { id: 'mvViewer' });
      v.innerHTML = '';
      v.appendChild(el('img', { alt: '' }));
      v.appendChild(el('p'));
      const bar = el('div');
      const prev = el('button', { type: 'button' }, '← 前');
      const next = el('button', { type: 'button' }, '次 →');
      const del = el('button', { type: 'button', 'data-del': '1' }, '削除');
      const close = el('button', { type: 'button' }, '閉じる');
      prev.onclick = (e) => { e.stopPropagation(); showViewer(viewerIdx - 1); };
      next.onclick = (e) => { e.stopPropagation(); showViewer(viewerIdx + 1); };
      del.onclick = (e) => { e.stopPropagation(); removePhoto(photos[viewerIdx]); };
      close.onclick = () => { v.style.display = 'none'; };
      bar.append(prev, next, del, close);
      v.appendChild(bar);
      v.onclick = (e) => { if (e.target === v) v.style.display = 'none'; };
      document.body.appendChild(v);
    }
    v.style.display = 'flex';
    showViewer(i);
  }
  function showViewer(i) {
    if (!photos.length) return;
    viewerIdx = (i + photos.length) % photos.length;
    const p = photos[viewerIdx];
    const v = document.getElementById('mvViewer');
    v.querySelector('img').src = p.full;
    v.querySelector('p').textContent = (viewerIdx + 1) + ' / ' + photos.length + (p.handle_name ? '　' + p.handle_name + ' さん' : '');
    v.querySelector('[data-del]').style.display = canDelete(p) ? '' : 'none';
  }

  function renderPostForm(box) {
    if (!myCars.length) return;   // 名簿に自分の車がない（管理人だけ等）なら投稿欄は出さない
    const car = myCars[0];
    const wrap = el('div', { class: 'mv-post' });
    wrap.appendChild(el('p', { class: 'join-hint' },
      '写真や動画を共有できます（参加した方だけに見えます）。' + (car.handle_name ? car.handle_name + ' さんとして投稿します。' : '')));

    const fileLabel = el('label', { class: 'btn-file' }, '📷 写真を選ぶ');
    const file = el('input', { type: 'file', accept: 'image/*', multiple: '' });
    fileLabel.appendChild(file);
    const row1 = el('div', { class: 'row' });
    row1.appendChild(fileLabel);
    wrap.appendChild(row1);

    const url = el('input', { type: 'url', placeholder: 'YouTube の URL（限定公開でもOK）', inputmode: 'url' });
    const addBtn = el('button', { type: 'button' }, '追加');
    const row2 = el('div', { class: 'row' });
    row2.append(url, addBtn);
    wrap.appendChild(row2);

    const msg = el('p', { class: 'mv-msg' });
    wrap.appendChild(msg);
    box.appendChild(wrap);

    file.onchange = async () => {
      const files = Array.from(file.files || []);
      file.value = '';
      if (!files.length || busy) return;
      busy = true;
      let ok = 0, ng = 0;
      for (let i = 0; i < files.length; i++) {
        msg.textContent = '送信中… ' + (i + 1) + ' / ' + files.length;
        try { await uploadOne(files[i], car); ok++; }
        catch (e) { console.error(e); ng++; if (e && e.code === 'P0001') { msg.textContent = e.message; break; } }
      }
      busy = false;
      msg.textContent = ok + '枚を共有しました' + (ng ? '（' + ng + '枚は失敗）' : '');
      await refreshMemberVideos(true);
    };

    addBtn.onclick = async () => {
      const id = youtubeId(url.value);
      const vertical = /\/shorts\//.test(url.value);
      if (!id) { msg.textContent = 'YouTube の URL を確かめてください。'; return; }
      addBtn.disabled = true;
      const { error } = await supabaseClient.from('event_member_videos').insert([
        { event_id: EVENT_ID, youtube_id: id, vertical: vertical, car_id: car.car_id, handle_name: car.handle_name, sort: 100 }
      ]);
      addBtn.disabled = false;
      if (error) { console.error(error); msg.textContent = error.code === 'P0001' ? error.message : '追加できませんでした（' + (error.code || '') + '）'; return; }
      url.value = '';
      msg.textContent = '動画を追加しました';
      await refreshMemberVideos(true);
    };
  }

  async function uploadOne(f, car) {
    const base = EVENT_ID + '/' + car.car_id + '/' + uuid();
    const full = await resize(f, FULL_PX, 0.82);
    const thumb = await resize(f, THUMB_PX, 0.75);
    if (!full || !thumb) throw new Error('resize');
    const st = supabaseClient.storage.from(BUCKET);
    let r = await st.upload(base + '.jpg', full, { contentType: 'image/jpeg', upsert: false });
    if (r.error) throw r.error;
    r = await st.upload(base + '_t.jpg', thumb, { contentType: 'image/jpeg', upsert: false });
    if (r.error) { await st.remove([base + '.jpg']); throw r.error; }
    const { error } = await supabaseClient.from('event_member_photos').insert([
      { event_id: EVENT_ID, car_id: car.car_id, handle_name: car.handle_name, path: base + '.jpg' }
    ]);
    if (error) { await st.remove([base + '.jpg', base + '_t.jpg']); throw error; }
  }

  async function removePhoto(p) {
    if (!p || !canDelete(p) || !confirm('この写真を削除しますか？')) return;
    const { error } = await supabaseClient.from('event_member_photos').delete().eq('id', p.id);
    if (error) { alert('削除できませんでした（' + (error.code || '') + '）'); return; }
    await supabaseClient.storage.from(BUCKET).remove([p.path, p.path.replace(/\.jpg$/, '_t.jpg')]);
    const v = document.getElementById('mvViewer');
    if (v) v.style.display = 'none';
    await refreshMemberVideos(true);
  }

  async function removeVideo(v) {
    if (!canDelete(v) || !confirm('この動画を一覧から外しますか？（YouTube の動画そのものは消えません）')) return;
    const { error } = await supabaseClient.from('event_member_videos').delete().eq('id', v.id);
    if (error) { alert('削除できませんでした（' + (error.code || '') + '）'); return; }
    await refreshMemberVideos(true);
  }

  // 未ログイン：件数だけ聞いて「ログインして見る」。ログイン済みで名簿にない人には何も出さない。
  window.refreshMemberVideos = async function (keepCars) {
    const box = document.getElementById('memberVideo');
    if (!box) return;
    const hide = () => { box.style.display = 'none'; box.innerHTML = ''; };
    try {
      if (!currentUser) {
        myCars = [];
        const { data: n, error } = await supabaseClient.rpc('event_member_video_count', { p_event: EVENT_ID });
        if (error || !n) return hide();
        box.innerHTML = '';
        box.appendChild(el('h2', null, '参加者の共有スペース'));
        box.appendChild(el('p', { class: 'join-hint' }, '当日参加した方は、登録したメールアドレスでログインすると動画や写真を見られます。'));
        const b = el('button', { type: 'button', class: 'btn-join' }, 'ログインして見る');
        b.onclick = openLoginModal;
        box.appendChild(b);
        box.style.display = 'block';
        return;
      }
      if (!keepCars) {
        const { data: cars } = await supabaseClient.rpc('my_event_roster_cars', { p_event: EVENT_ID });
        myCars = cars || [];
      }
      const [vr, pr] = await Promise.all([
        supabaseClient.from('event_member_videos').select('id, title, youtube_id, vertical, car_id, handle_name')
          .eq('event_id', EVENT_ID).order('sort', { ascending: true }).order('id', { ascending: true }),
        supabaseClient.from('event_member_photos').select('id, car_id, handle_name, path')
          .eq('event_id', EVENT_ID).order('created_at', { ascending: true })
      ]);
      const vids = vr.data || [], rows = pr.data || [];
      // 名簿にない人：RLS で何も返らない＋自分の車も無い → 何も出さない
      if (!myCars.length && !vids.length && !rows.length) return hide();
      box.innerHTML = '';
      box.appendChild(el('h2', null, '参加者の共有スペース'));
      box.appendChild(el('p', { class: 'join-hint' }, '当日参加した方だけに表示しています。外への転載はご遠慮ください。'));
      renderVideos(box, vids);
      await renderPhotos(box, rows);
      renderPostForm(box);
      box.style.display = 'block';
    } catch (e) { console.error(e); hide(); }
  };
})();
