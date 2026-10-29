// オーナーの更新情報（/activity）の行を組み立てる。
// 一覧ページとトップの帯（500・126）の両方がこれを使う＝帯の1件は必ず一覧の1行目と同じものになる。
// 前提：グローバルに supabaseClient があること。
(function () {
  const DAY_MS = 24 * 60 * 60 * 1000;

  // detail.html の「この1台の歩み」と同じ対応表。更新された列から「（写真・こだわり）」を作る。
  // 対応表に無い列は出さない＝最大3語まで
  const FIELD_LABELS = [
    { test: c => c.indexOf('photo_') === 0, label: '写真' },
    { test: c => c === 'highlights', label: 'こだわり' },
    { test: c => c.indexOf('tire_') === 0, label: 'タイヤ' },
    { test: c => c === 'carburetor_name', label: 'キャブレター' },
    { test: c => c === 'engine_cc', label: '排気量' },
    { test: c => c === 'wheel', label: 'ホイール' },
    { test: c => c === 'body_color', label: 'ボディカラー' },
    { test: c => c === 'plug_name', label: 'プラグ' },
    { test: c => c === 'coil_name', label: 'コイル' },
    { test: c => c === 'year', label: '年式' }
  ];
  // オーナーの記事（ブログなど外部記事へのリンク・/my-articles で載せる）。正本 owner-articles/HANDOFF.md
  // 公開の準備が整うまで止めておく＝開いているページの URL に ?articles-preview を付けたときだけ出す（一覧・トップの帯とも）
  const ARTICLES_IN_FEED = false;
  const PHOTO_COLS = ['photo_main', 'photo_front', 'photo_side', 'photo_rear', 'photo_interior', 'photo_engine', 'photo_steering_cluster'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function jstDayKey(d) {
    const j = new Date(new Date(d).getTime() + 9 * 60 * 60 * 1000);
    return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${String(j.getUTCDate()).padStart(2, '0')}`;
  }
  function trim(s, n) {
    const flat = String(s || '').replace(/\s+/g, ' ').trim();
    return flat.length > n ? flat.slice(0, n) + '…' : flat;
  }

  // 直近 days 日の行を新しい順で返す
  async function load(days) {
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const sinceT = new Date(since).getTime();
    const articlesOn = ARTICLES_IN_FEED || new URLSearchParams(location.search).has('articles-preview');
    const [carsRes, histRes, recRes, expRes, epiRes, partRes, slugsRes, toolRes, artRes] = await Promise.allSettled([
      supabaseClient.from('cars').select('document_id, handle_name, car_type, year, model_display_c, is_sold, created_at, ' + PHOTO_COLS.join(', ')),
      supabaseClient.from('car_history').select('car_id, fields, occurred_at').eq('kind', 'updated').gte('occurred_at', since),
      // 公開されていて、車に紐づき、名前を伏せていない手帳だけ
      supabaseClient.from('equipment_records').select('vehicle_id, created_at, updated_at, is_anonymous')
        .eq('is_public', true).not('vehicle_id', 'is', null).or(`created_at.gte."${since}",updated_at.gte."${since}"`),
      supabaseClient.from('equipment_experiences').select('body, created_at, equipment_records!inner(vehicle_id, is_public, is_anonymous)')
        .eq('equipment_records.is_public', true).gte('created_at', since),
      // ログイン中は下書きまで読めてしまうので、公開済みの条件は必ず付ける
      supabaseClient.from('car_episodes').select('id, car_id, title, created_at').eq('is_published', true).gte('created_at', since),
      supabaseClient.from('event_participants').select('event_id, car_id, created_at').not('car_id', 'is', null).gte('created_at', since),
      fetch('/event-slugs.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}),
      // おすすめ工具の紹介（2026-10-22）。伏せた投稿は出さない。「参考になった」は数を伏せる約束なので出さない
      supabaseClient.from('owner_tools').select('car_id, name, created_at').eq('is_hidden', false).gte('created_at', since),
      // オーナーの記事は「貼った日」で並べる（ブログの投稿日で並べると、昔の記事を貼ったときに一覧の奥へ沈む）。
      // 伏せた行は本人にも RLS で返るので、ここで外す
      articlesOn ? supabaseClient.from('owner_articles').select('car_id, title, url, site_name, created_at')
        .eq('is_hidden', false).gte('created_at', since) : Promise.resolve({ data: [] })
    ]);
    const ok = r => (r.status === 'fulfilled' && r.value && !r.value.error && r.value.data) || [];

    const cars = new Map();
    ok(carsRes).forEach(c => cars.set(c.document_id, c));
    // 手放された車の動きは出さない
    const carOf = id => { const c = cars.get(id); return c && !c.is_sold ? c : null; };

    // 1台・1日・1種類で1行に畳む（同じ日に何度保存しても1行）
    const byKey = new Map();
    const add = (kind, carId, at, extra) => {
      const car = carOf(carId);
      if (!car || !at) return;
      const day = jstDayKey(at);
      const key = `${kind}|${carId}|${day}`;
      const row = byKey.get(key);
      if (row) {
        if (new Date(at) > new Date(row.at)) row.at = at;
        if (extra && extra.fields) extra.fields.forEach(f => { if (row.fields.indexOf(f) === -1) row.fields.push(f); });
        if (extra && extra.texts) extra.texts.forEach(t => row.texts.push(t));
        if (extra && extra.ids) extra.ids.forEach(i => row.ids.push(i));
        return;
      }
      byKey.set(key, Object.assign({ kind, car, day, at, fields: [], texts: [], ids: [] }, extra || {}));
    };

    ok(histRes).forEach(h => {
      const car = carOf(h.car_id);
      // 登録した日の保存は「新規登録」の一部なので出さない（トップの新着と重ねない）
      if (!car || (car.created_at && jstDayKey(car.created_at) === jstDayKey(h.occurred_at))) return;
      const fields = String(h.fields || '').split(',').map(s => s.trim()).filter(Boolean);
      add('updated', h.car_id, h.occurred_at, { fields });
    });

    ok(recRes).forEach(r => {
      if (r.is_anonymous) return;
      if (new Date(r.created_at).getTime() >= sinceT) add('notebook_new', r.vehicle_id, r.created_at);
      // 作った日のうちの保存し直しは「更新」にしない
      if (r.updated_at && new Date(r.updated_at).getTime() >= sinceT && new Date(r.updated_at) - new Date(r.created_at) >= DAY_MS) {
        add('notebook_upd', r.vehicle_id, r.updated_at);
      }
    });

    ok(expRes).forEach(e => {
      const rec = e.equipment_records;
      if (!rec || rec.is_anonymous || !rec.vehicle_id || !e.body) return;
      add('experience', rec.vehicle_id, e.created_at, { texts: [e.body] });
    });

    ok(epiRes).forEach(ep => add('story', ep.car_id, ep.created_at, { texts: [ep.title || ''], ids: [ep.id] }));

    ok(toolRes).forEach(t => add('tool', t.car_id, t.created_at, { texts: [t.name || ''] }));

    // ids に記事のURLを持つ（1本だけの行は記事へ直接飛ばすため）。サイト名は1本目のもの＝1本の行でだけ使う
    ok(artRes).forEach(a => add('article', a.car_id, a.created_at, { texts: [a.title || ''], ids: [a.url || ''], site: a.site_name || '' }));

    // イベント参加は開催名を引いてから。同じ日・同じイベントへの参加表明は1行にまとめ、
    // 「◯◯さんほか2人」と書く（1人ずつ並べると、募集中のイベントがあるだけで一覧が埋まる）
    const parts = ok(partRes);
    if (parts.length) {
      const ids = [...new Set(parts.map(p => p.event_id).filter(Boolean))];
      const events = new Map();
      try {
        const { data } = await supabaseClient.from('events').select('id, event_name').in('id', ids);
        (data || []).forEach(ev => events.set(ev.id, ev));
      } catch (e) { /* 開催名が取れなければ参加行は出さない */ }
      const slugs = (slugsRes.status === 'fulfilled' && slugsRes.value) || {};
      parts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(p => {
        const ev = events.get(p.event_id);
        const car = carOf(p.car_id);
        if (!ev || !car || !p.created_at) return;
        const key = `event|${ev.id}|${jstDayKey(p.created_at)}`;
        const row = byKey.get(key);
        if (row) {
          if (row.cars.indexOf(car) === -1) row.cars.push(car);
          if (new Date(p.created_at) > new Date(row.at)) row.at = p.created_at;
          return;
        }
        byKey.set(key, { kind: 'event', car, cars: [car], day: jstDayKey(p.created_at), at: p.created_at, fields: [], texts: [ev.event_name || 'イベント'], slug: slugs[ev.id] || null });
      });
    }

    return [...byKey.values()].sort((a, b) => new Date(b.at) - new Date(a.at));
  }

  // 1行の中身（HTMLエスケープ済み）。quoteLen は引用の長さ
  function describe(r, quoteLen) {
    const n = quoteLen || 60;
    const name = esc(r.car.handle_name || r.car.model_display_c || 'オーナー');
    let icon = '✏️', what = '', quote = '', hash = '', href = null, external = false;
    if (r.kind === 'updated') {
      const labels = [];
      r.fields.forEach(col => {
        const hit = FIELD_LABELS.find(f => f.test(col));
        if (hit && labels.indexOf(hit.label) === -1) labels.push(hit.label);
      });
      what = `${name}さんが愛車の記録を更新` + (labels.length ? `（${esc(labels.slice(0, 3).join('・'))}）` : '');
      // 押したら、見出しの先頭に出した欄へ飛ぶ（飛び先の解決は detail.html の jumpToHash）
      const first = r.fields.find(col => FIELD_LABELS.some(f => f.test(col))) || r.fields[0];
      if (first) hash = `#field-${encodeURIComponent(first)}`;
    } else if (r.kind === 'notebook_new') {
      icon = '🧰'; what = `${name}さんが車載手帳をつくりました`; hash = '#equipment-notebook';
    } else if (r.kind === 'notebook_upd') {
      icon = '🧰'; what = `${name}さんが車載手帳を更新`; hash = '#equipment-notebook';
    } else if (r.kind === 'experience') {
      icon = '🧰'; what = `${name}さんが車載手帳に経験談`; hash = '#equipment-notebook';
      quote = `「${esc(trim(r.texts[0], n))}」`;
    } else if (r.kind === 'story') {
      icon = '📖'; what = `${name}さんがストーリーを投稿`;
      quote = r.texts[0] ? `「${esc(trim(r.texts[0], n))}」` : '';
      // 1本ならそのストーリーを開く。同じ日に何本も書いた行は車ページの歩みへ
      if (r.ids.length === 1 && r.ids[0]) href = `/episode?ep=${encodeURIComponent(r.ids[0])}`;
      else hash = '#history';
    } else if (r.kind === 'tool') {
      // 同じ日に何件紹介しても1行（工具名を「・」でつなぐ）
      icon = '🔧'; what = `${name}さんがおすすめ工具・パーツを紹介`;
      quote = `「${esc(trim(r.texts.filter(Boolean).join('・'), n))}」`;
      hash = '#tools';  // 紹介した工具が並ぶ、その車ページの欄へ
    } else if (r.kind === 'article') {
      // 1本なら記事そのものへ（新しいタブ）。同じ日に何本も貼った行は車ページの歩みへ
      const one = r.ids.length === 1 && /^https:\/\//.test(r.ids[0]);
      icon = '📝'; what = `${name}さんがブログを更新` + (one && r.site ? `（${esc(r.site)}）` : '');
      quote = `「${esc(trim(r.texts.filter(Boolean).join('・'), n))}」`;
      if (one) { href = esc(r.ids[0]); external = true; } else hash = '#history';
    } else if (r.kind === 'event') {
      const others = r.cars.length - 1;
      icon = '🎪'; what = `${name}さん${others > 0 ? `ほか${others}人` : ''}が「${esc(r.texts[0])}」に参加表明`;
      if (r.slug) href = `/event/${encodeURIComponent(r.slug)}/`;
    }
    if (!href) href = `/detail?doc=${encodeURIComponent(r.car.document_id)}${hash}`;

    // 写真を更新した行は、その写真を出す。それ以外は車の代表写真
    const updatedPhoto = r.fields.find(f => PHOTO_COLS.indexOf(f) !== -1 && r.car[f]);
    const photo = (updatedPhoto && r.car[updatedPhoto]) || r.car.photo_main || '';
    return { icon, what, quote, href, photo, external };
  }

  window.ActivityFeed = { load, describe, jstDayKey, esc };
})();
