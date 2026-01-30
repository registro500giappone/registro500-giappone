// parts.js
// 検索ロジックとリスト計算のメインプログラム

// グローバル変数
let currentRate = CONFIG.default_rate; // 現在の為替レート
let compareList = []; // 検討リストの中身

// DOM読み込み完了時に実行
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Supabaseの初期化 (config.jsの変数がある前提ですが、直接キーを使う場合はここに記述)
    // ※今回は既存環境に合わせて window.supabase が既にあるか、
    // または下記のようにcreateClientする必要があります。
    // もし既存の共通jsで初期化されているならこの2行は不要です。
    // const { createClient } = supabase;
    // window.supabaseClient = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
    
    // ※引継書によるとVercel環境のようなので、環境変数が使えないHTML直書きの場合は
    // 以前の edit.html 等で使っている supabaseClient をそのまま使います。
    // ここでは「window.supabase」がロードされている前提で進めます。

    // 2. 為替レートの取得
    await fetchCurrencyRate();

    // 3. 保存されたリストの復元
    loadListFromStorage();

    // 4. イベントリスナーの設定
    document.getElementById('search-btn').addEventListener('click', executeSearch);
    
    // Enterキーでも検索できるようにする
    document.getElementById('keyword-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });
});

// --- 為替レート取得 ---
async function fetchCurrencyRate() {
    const rateEl = document.getElementById('current-rate');
    try {
        const response = await fetch(CONFIG.currency_api);
        const data = await response.json();
        // APIによって構造が違うが、open.er-api.comの場合は data.rates.JPY
        if (data && data.rates && data.rates.JPY) {
            currentRate = data.rates.JPY;
            rateEl.innerText = currentRate.toFixed(2);
            rateEl.style.color = "#000";
        } else {
            throw new Error("API Error");
        }
    } catch (e) {
        console.error("為替取得失敗:", e);
        currentRate = CONFIG.default_rate;
        rateEl.innerText = currentRate + " (手動設定)";
    }
    // リストの日本円を再計算
    renderList();
}

// --- 検索実行メイン処理 ---
async function executeSearch() {
    const keyword = document.getElementById('keyword-input').value.trim();
    const resultsArea = document.getElementById('results-area');
    
    // チェックボックスの取得
    const checkedCars = Array.from(document.querySelectorAll('input[name="car"]:checked')).map(c => c.value);
    const checkedShops = Array.from(document.querySelectorAll('input[name="shop"]:checked')).map(c => c.value);
    const useExternal = document.getElementById('use-external').checked;

    // バリデーション
    if (!keyword && checkedCars.length === 0) {
        alert("検索キーワードを入力するか、車種を選択してください。");
        return;
    }

    resultsArea.innerHTML = '<p style="padding:20px;">検索中...</p>';

    // 1. Supabaseから検索 (内部DB)
    let dbResults = [];
    if (checkedShops.length > 0) {
        // クエリ構築
        let query = window.supabaseClient // 既存のクライアント変数名に合わせてください(supabase または supabaseClient)
            .from('parts')
            .select('*');

        // ショップフィルタ
        // query = query.in('shop_name', checkedShops); // 完全一致のみだが、念のため
        // テキストフィルタで対応したほうが安全かもしれないが、一旦inで。
        
        // キーワード検索 (日本語名、英語名、OEM番号、品番)
        if (keyword) {
            // 複数のカラムをOR検索
            const searchPattern = `%${keyword}%`;
            query = query.or(`name_en.ilike.${searchPattern},name_jp.ilike.${searchPattern},oem_no.ilike.${searchPattern},product_no.ilike.${searchPattern}`);
        }

        // 車種フィルタ (target_cars カラムに含まれているか)
        // 複数選ばれている場合は「どれか一つでも含めばOK」とする
        if (checkedCars.length > 0) {
            // or条件を作る: target_cars.ilike.%500%,target_cars.ilike.%126% ...
            const carConditions = checkedCars.map(car => `target_cars.ilike.%${car}%`).join(',');
            query = query.or(carConditions);
        }
        
        // ショップ絞り込み
        if(checkedShops.length > 0){
             query = query.in('shop_name', checkedShops);
        }

        // 実行（最大100件）
        const { data, error } = await query.limit(100);
        
        if (error) {
            console.error(error);
            resultsArea.innerHTML = `<p style="color:red;">エラーが発生しました: ${error.message}</p>`;
            return;
        }
        dbResults = data || [];
    }

    // 2. 外部サイトを別タブで開く
    if (useExternal && keyword) {
        CONFIG.external_links.forEach(link => {
            window.open(link.url_pattern + encodeURIComponent(keyword), '_blank');
        });
    }

    // 3. 結果表示
    displayResults(dbResults);
}

// --- 検索結果の描画 ---
function displayResults(parts) {
    const container = document.getElementById('results-area');
    container.innerHTML = "";

    if (parts.length === 0) {
        container.innerHTML = '<p style="padding:20px;">条件に合うパーツが見つかりませんでした。</p>';
        return;
    }

    parts.forEach(part => {
        // ショップ設定の取得
        const shopConfig = CONFIG.shops[part.shop_name] || { is_price_ex_vat: false, show_vat_inc: true };
        
        // 価格表示ロジック
        let displayPriceHtml = "";
        let priceForCalc = part.price_euro; // リストに追加する時の基準価格（VAT抜き推奨）

        if (shopConfig.is_price_ex_vat) {
            // データは「税抜き」。FD Ricambiパターン
            // そのまま表示。
            displayPriceHtml = `<div class="price-tag">€ ${part.price_euro.toFixed(2)} <span style="font-size:0.6em; color:#666;">(税抜)</span></div>`;
            priceForCalc = part.price_euro;
        } else {
            // データは「税込み」。Axel Gerstlパターン
            // 税込みを表示しつつ、税抜きも計算して表示したほうが親切かも？
            // ユーザー指示「VAT抜きで横並び比較したい」
            const exVat = part.price_euro / (1 + shopConfig.vat_rate);
            priceForCalc = exVat; // リストには税抜きを入れる

            displayPriceHtml = `
                <div class="price-tag">€ ${part.price_euro.toFixed(2)} <span style="font-size:0.6em; color:#666;">(税込)</span></div>
                <div style="font-size:0.8em; color:#888;">(税抜: € ${exVat.toFixed(2)})</div>
            `;
        }

        // 日本語名がある場合はそれをメインに、なければ英語名
        const title = part.name_jp && part.name_jp !== "nan" ? part.name_jp : part.name_en;
        const subTitle = part.name_jp && part.name_jp !== "nan" ? part.name_en : "";

        // カード生成
        const card = document.createElement('div');
        card.className = 'part-card';
        card.innerHTML = `
            <div>
                <img src="${part.image_url}" class="part-img" alt="no image" onerror="this.src='https://placehold.co/200x150?text=No+Image'">
                <div style="margin-top:10px; font-weight:bold;">${title}</div>
                <div style="font-size:0.8em; color:#666;">${subTitle}</div>
                <div style="font-size:0.8em; margin:5px 0;">
                    <span style="background:#eee; padding:2px 5px; border-radius:4px;">${part.shop_name}</span>
                    <span style="color:#666;">OEM: ${part.oem_no}</span>
                </div>
            </div>
            <div>
                ${displayPriceHtml}
                <button onclick="addToList('${part.id}', '${escapeHtml(title)}', '${part.shop_name}', ${priceForCalc}, '${part.page_url}')" 
                    style="width:100%; margin-top:10px; padding:8px; background:#007bff; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    リストに追加
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- 比較リスト（検討トレイ）の管理 ---

// 商品をリストに追加
function addToList(id, name, shop, priceExVat, url) {
    // 既にリストにあるかチェック
    // 同じIDでも複数個欲しい場合があるかもしれないが、今回は重複チェックなしで追加します
    
    const item = {
        uniqueId: Date.now(), // 削除用の一意キー
        originalId: id,
        name: name,
        shop: shop,
        basePrice: priceExVat, // DB上の価格(税抜計算後)
        userPrice: priceExVat, // ユーザーが修正する価格(初期値はDB価格)
        url: url
    };
    
    compareList.push(item);
    saveList();
    renderList();
    
    // トレイが開いていなければ開く
    const tray = document.getElementById('comparison-tray');
    if(tray.style.height !== '300px') {
        toggleTray();
    }
}

// リストの描画
function renderList() {
    const tbody = document.getElementById('compare-rows');
    tbody.innerHTML = "";
    
    let subTotalEur = 0;

    compareList.forEach((item, index) => {
        // 日本円概算
        const yen = Math.round(item.userPrice * currentRate);
        subTotalEur += parseFloat(item.userPrice);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><a href="${item.url}" target="_blank" style="text-decoration:none; color:#007bff;">${item.name}</a></td>
            <td>${item.shop}</td>
            <td>
                € <input type="number" step="0.01" value="${parseFloat(item.userPrice).toFixed(2)}" 
                onchange="updateItemPrice(${index}, this.value)" class="input-price">
            </td>
            <td>¥ ${yen.toLocaleString()}</td>
            <td><button onclick="removeFromList(${index})" style="color:red; border:none; background:none; cursor:pointer;">×</button></td>
        `;
        tbody.appendChild(row);
    });

    // 集計表示
    const shippingEur = parseFloat(document.getElementById('shipping-cost').value) || 0;
    const finalEur = subTotalEur + shippingEur;
    
    document.getElementById('tray-total-jpy').innerText = Math.round(finalEur * currentRate).toLocaleString();
    
    document.getElementById('subtotal-eur').innerText = subTotalEur.toFixed(2);
    document.getElementById('subtotal-jpy').innerText = "¥ " + Math.round(subTotalEur * currentRate).toLocaleString();
    
    document.getElementById('shipping-jpy').innerText = "¥ " + Math.round(shippingEur * currentRate).toLocaleString();
    
    document.getElementById('final-eur').innerText = "€ " + finalEur.toFixed(2);
    document.getElementById('final-jpy').innerText = "¥ " + Math.round(finalEur * currentRate).toLocaleString();
}

// 価格の手動修正
function updateItemPrice(index, newPrice) {
    compareList[index].userPrice = parseFloat(newPrice);
    saveList();
    renderList();
}

// リストから削除
function removeFromList(index) {
    compareList.splice(index, 1);
    saveList();
    renderList();
}

// リスト全消去
function clearList() {
    if(confirm("リストを空にしますか？")) {
        compareList = [];
        saveList();
        renderList();
    }
}

// 手動アイテム追加フォーム（簡易版）
function showManualAddForm() {
    const name = prompt("商品名を入力:");
    if(!name) return;
    const price = prompt("価格(€)を入力:", "0");
    if(price === null) return;
    
    addToList("manual", name, "手動追加", parseFloat(price), "#");
}

// LocalStorageへの保存・読み出し
function saveList() {
    localStorage.setItem('fiat500_compare_list', JSON.stringify(compareList));
    // 送料も保存しておく
    localStorage.setItem('fiat500_shipping', document.getElementById('shipping-cost').value);
}

function loadListFromStorage() {
    const saved = localStorage.getItem('fiat500_compare_list');
    if (saved) {
        compareList = JSON.parse(saved);
    }
    const savedShipping = localStorage.getItem('fiat500_shipping');
    if (savedShipping) {
        document.getElementById('shipping-cost').value = savedShipping;
    }
    renderList();
}

// トレイ開閉関数
function toggleTray() {
    const tray = document.getElementById('comparison-tray');
    // 現在の高さをチェック（style属性が空の場合はCSSの初期値を参照できないため、computedStyleを見るか、フラグで管理）
    // HTML側でフラグ管理しているので、こちらはあくまで補助
    if(tray.style.height === '300px') {
        tray.style.height = '40px';
    } else {
        tray.style.height = '300px';
    }
}

// 文字列のエスケープ処理
function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}
