// parts.js (アップデート版)

let currentRate = CONFIG.default_rate;
let compareList = [];
let shippingCosts = {}; // ショップごとの送料保存用

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 為替レート取得
    await fetchCurrencyRate();

    // 2. 保存データの復元
    loadListFromStorage();

    // 3. イベントリスナー設定
    document.getElementById('search-btn').addEventListener('click', executeSearch);
    document.getElementById('keyword-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });

    // その他車種の表示切替
    document.getElementById('toggle-others-chk').addEventListener('change', (e) => {
        const container = document.getElementById('others-container');
        container.style.display = e.target.checked ? 'block' : 'none';
    });
});

// --- 為替レート取得 ---
async function fetchCurrencyRate() {
    const rateEl = document.getElementById('current-rate');
    try {
        const response = await fetch(CONFIG.currency_api);
        const data = await response.json();
        if (data && data.rates && data.rates.JPY) {
            currentRate = data.rates.JPY;
            rateEl.innerText = currentRate.toFixed(2);
        } else {
            throw new Error("API Error");
        }
    } catch (e) {
        currentRate = CONFIG.default_rate;
        rateEl.innerText = currentRate + " (手動設定)";
    }
    renderList(); // リスト再計算
}

// --- 検索実行 ---
async function executeSearch() {
    const keyword = document.getElementById('keyword-input').value.trim();
    const resultsArea = document.getElementById('results-area');
    
    // チェックボックス状態取得
    const checkedCars = Array.from(document.querySelectorAll('input[name="car"]:checked')).map(c => c.value);
    const checkedShops = Array.from(document.querySelectorAll('input[name="shop"]:checked')).map(c => c.value);
    const useExternal = document.getElementById('use-external').checked;

    if (!keyword && checkedCars.length === 0) {
        alert("検索キーワードを入力するか、車種を選択してください。");
        return;
    }

    resultsArea.innerHTML = '<p style="padding:20px;">検索中...</p>';

    // 1. DB検索
    let dbResults = [];
    if (checkedShops.length > 0) {
        let query = window.supabaseClient.from('parts').select('*');

        // キーワード検索 (OR条件)
        if (keyword) {
            const pattern = `%${keyword}%`;
            query = query.or(`name_en.ilike.${pattern},name_jp.ilike.${pattern},oem_no.ilike.${pattern},product_no.ilike.${pattern}`);
        }
        // 車種検索
        if (checkedCars.length > 0) {
            const carConditions = checkedCars.map(car => `target_cars.ilike.%${car}%`).join(',');
            query = query.or(carConditions);
        }
        // ショップ絞り込み
        query = query.in('shop_name', checkedShops);

        const { data, error } = await query.limit(100);
        if (error) {
            resultsArea.innerHTML = `<p style="color:red;">エラー: ${error.message}</p>`;
            return;
        }
        dbResults = data || [];
    }

    // 2. 外部サイトを開く
    if (useExternal && keyword) {
        CONFIG.external_links.forEach(link => {
            window.open(link.url_pattern + encodeURIComponent(keyword), '_blank');
        });
    }

    // 3. 表示処理 (ショップ別に分ける)
    displayResultsByShop(dbResults, checkedShops);
}

// --- 結果表示 (ショップ別) ---
function displayResultsByShop(parts, targetShops) {
    const container = document.getElementById('results-area');
    container.innerHTML = "";

    if (parts.length === 0) {
        container.innerHTML = '<p style="padding:20px;">条件に合うパーツが見つかりませんでした。</p>';
        return;
    }

    // 指定されたショップごとにセクションを作る
    targetShops.forEach(shopName => {
        // そのショップのパーツだけ抽出
        const shopParts = parts.filter(p => p.shop_name === shopName);
        if (shopParts.length === 0) return;

        // セクション作成
        const section = document.createElement('div');
        section.style.marginBottom = "30px";
        section.innerHTML = `<h3 style="background:#eee; padding:10px; border-left:5px solid #333;">${shopName} (${shopParts.length}件)</h3>`;
        
        // カードグリッド作成
        const grid = document.createElement('div');
        grid.className = 'results-grid'; // CSSでgrid定義が必要ならstyleタグに追加、今回はinlineで
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(200px, 1fr))";
        grid.style.gap = "15px";
        grid.style.padding = "10px";

        shopParts.forEach(part => {
            grid.appendChild(createPartCard(part));
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

// カード生成用関数
function createPartCard(part) {
    const shopConfig = CONFIG.shops[part.shop_name] || { is_price_ex_vat: false, show_vat_inc: true, vat_rate: 0.19 };
    
    // --- 1. 画像URLの補正 (目に見えない文字を完全に除去する最強版) ---
    let finalImageUrl = "";
    
    // データを文字列化し、前後の空白、改行などを完全に除去
    let rawUrl = part.image_url ? String(part.image_url).replace(/^\s+|\s+$/g, '') : "";

    // 判定：空、null、undefined、または「nan」という単語が含まれている場合は画像なし
    // /nan/i.test() を使うことで、"nan ", " NAN", "nan\n" などすべてを検知して弾きます
    const isInvalid = !rawUrl || 
                      /^(nan|null|undefined)$/i.test(rawUrl) || 
                      rawUrl === "";

    if (isInvalid) {
        finalImageUrl = 'https://placehold.co/200x150?text=No+Image';
    } else if (rawUrl.startsWith('http')) {
        finalImageUrl = rawUrl;
    } else {
        const domain = 'https://webshop.fiat500126.com';
        // スラッシュの有無を正規化
        const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
        finalImageUrl = domain + cleanPath;
    }

    // --- 2. 価格計算 (既存ロジック) ---
    let displayPriceHtml = "";
    let priceForCalc = part.price_euro;
    if (shopConfig.is_price_ex_vat) {
        priceForCalc = part.price_euro;
        displayPriceHtml = `<div class="price-tag">€ ${part.price_euro.toFixed(2)} <small>(税抜)</small></div>`;
    } else {
        const exVat = part.price_euro / (1 + (shopConfig.vat_rate || 0.19));
        priceForCalc = exVat; 
        displayPriceHtml = `
            <div class="price-tag">€ ${part.price_euro.toFixed(2)} <small>(税込)</small></div>
            <div style="font-size:0.8em; color:#888;">(税抜: € ${exVat.toFixed(2)})</div>
        `;
    }

    const title = part.name_jp && !/nan/i.test(part.name_jp) ? part.name_jp : (part.name_en || "No Title");

    // --- 3. HTMLの組み立て ---
    const div = document.createElement('div');
    div.className = 'part-card';
    div.innerHTML = `
        <a href="${part.page_url}" target="_blank" style="text-decoration:none; color:inherit; display:block;">
            <div style="position:relative;">
                <img src="${finalImageUrl}" class="part-img" alt="img" 
                     onerror="this.onerror=null; this.src='https://placehold.co/200x150?text=No+Image';">
                <span style="position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.6); color:#fff; font-size:0.7em; padding:2px 5px;">別タブで開く &#x2197;</span>
            </div>
            <div style="margin-top:10px; font-weight:bold; min-height:3em;">${escapeHtml(title)}</div>
        </a>
        <div style="font-size:0.8em; color:#666; margin-bottom:5px;">OEM: ${part.oem_no}</div>
        
        <div style="margin-top:auto;">
            ${displayPriceHtml}
            <button onclick="addToList('${part.id}', '${escapeHtml(title)}', '${part.shop_name}', ${priceForCalc}, '${part.page_url}')" 
                style="width:100%; margin-top:10px; padding:8px; background:#007bff; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                リストに追加
            </button>
        </div>
    `;
    return div;
}

// --- 比較リスト管理（ショップ別集計） ---

function addToList(id, name, shop, price, url) {
    compareList.push({
        uniqueId: Date.now(),
        name: name,
        shop: shop,
        price: parseFloat(price), // ユーザー編集用
        url: url
    });
    saveList();
    renderList();
    
    // トレイを開く
    const tray = document.getElementById('comparison-tray');
    if(tray.style.height !== '400px') toggleTray(true);
}

function renderList() {
    const tbody = document.getElementById('compare-rows');
    tbody.innerHTML = "";
    
    // ショップごとにグループ化
    const grouped = {};
    compareList.forEach(item => {
        if (!grouped[item.shop]) grouped[item.shop] = [];
        grouped[item.shop].push(item);
    });

    let grandTotalEur = 0;

    // ショップごとのブロックを描画
    Object.keys(grouped).forEach(shopName => {
        const items = grouped[shopName];
        let shopSubtotal = 0;

        // 1. ショップヘッダー行
        const headerRow = document.createElement('tr');
        headerRow.style.background = "#f0f0f0";
        headerRow.innerHTML = `<td colspan="5" style="font-weight:bold; padding:8px;">${shopName}</td>`;
        tbody.appendChild(headerRow);

// 2. アイテム行
        items.forEach((item, idx) => {
            // 安全策：価格が未定義なら0にする
            const itemPrice = parseFloat(item.price) || 0;
            shopSubtotal += itemPrice;
            const globalIdx = compareList.indexOf(item); // 削除用インデックス
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding-left:20px;"><a href="${item.url}" target="_blank">${item.name}</a></td>
                <td><small>${shopName}</small></td>
                <td>€ <input type="number" step="0.01" value="${itemPrice.toFixed(2)}" 
                    onchange="updateItemPrice(${globalIdx}, this.value)" class="input-price" style="width:60px;"></td>
                <td>¥ ${Math.round(itemPrice * currentRate).toLocaleString()}</td>
                <td><button onclick="removeFromList(${globalIdx})" style="color:red; border:none; background:none;">×</button></td>
            `;
            tbody.appendChild(row);
        });

        
// 3. 送料・小計行
        const shipping = parseFloat(shippingCosts[shopName]) || 0;
        const shopTotal = shopSubtotal + shipping;
        grandTotalEur += shopTotal;

        const summaryRow = document.createElement('tr');
        summaryRow.style.borderBottom = "2px solid #ccc";
        summaryRow.innerHTML = `
            <td colspan="2" style="text-align:right; font-size:0.9em;">
                小計: €${shopSubtotal.toFixed(2)} + 送料: 
                <input type="number" value="${shipping}" onchange="updateShipping('${shopName}', this.value)" 
                style="width:50px; text-align:right;">
            </td>
            <td style="font-weight:bold;">€ ${shopTotal.toFixed(2)}</td>
            <td style="font-weight:bold;">¥ ${Math.round(shopTotal * currentRate).toLocaleString()}</td>
            <td></td>
        `;
        tbody.appendChild(summaryRow);
    });

    // 総合計表示
    document.getElementById('tray-total-jpy').innerText = Math.round(grandTotalEur * currentRate).toLocaleString();
    
    // フッター更新（総合計）
    const tfootHtml = `
        <tr class="total-row" style="background: #333; color: #fff;">
            <td colspan="2" style="text-align: right; padding:10px;">全ショップ総合計:</td>
            <td style="font-size:1.2em;">€ ${grandTotalEur.toFixed(2)}</td>
            <td style="font-size:1.2em; color:#ffeb3b;">¥ ${Math.round(grandTotalEur * currentRate).toLocaleString()}</td>
            <td></td>
        </tr>
    `;
    // HTML構造上、tfootの中身を書き換えるか、tbodyの最後に追加するか
    // ここではtbodyの最後に追加します
    const totalRow = document.createElement('tr');
    totalRow.innerHTML = tfootHtml;
    tbody.appendChild(totalRow);
    
    // 送料欄の既存ID処理（エラー防止のため隠すか無効化）
    const oldShippingInput = document.getElementById('shipping-cost');
    if(oldShippingInput) oldShippingInput.parentElement.parentElement.style.display = 'none';
}

// データの更新系
function updateItemPrice(index, val) {
    compareList[index].price = parseFloat(val);
    saveList();
    renderList();
}

function updateShipping(shopName, val) {
    shippingCosts[shopName] = parseFloat(val);
    saveList();
    renderList();
}

function removeFromList(index) {
    compareList.splice(index, 1);
    saveList();
    renderList();
}

function clearList() {
    if(confirm("リストを空にしますか？")) {
        compareList = [];
        shippingCosts = {};
        saveList();
        renderList();
    }
}

function showManualAddForm() {
    const name = prompt("商品名:");
    if(!name) return;
    const shop = prompt("ショップ名(FD Ricambi, eBay等):", "Manual");
    const price = prompt("価格(€):", "0");
    addToList("manual", name, shop, price, "#");
}

function saveList() {
    localStorage.setItem('fiat500_compare_list', JSON.stringify(compareList));
    localStorage.setItem('fiat500_shipping_costs', JSON.stringify(shippingCosts));
}

function loadListFromStorage() {
    const list = localStorage.getItem('fiat500_compare_list');
    if (list) compareList = JSON.parse(list);
    
    const ship = localStorage.getItem('fiat500_shipping_costs');
    if (ship) shippingCosts = JSON.parse(ship);
    
    renderList();
}

function toggleTray(forceOpen = false) {
    const tray = document.getElementById('comparison-tray');
    if (forceOpen) {
        tray.style.height = '400px';
    } else {
        tray.style.height = (tray.style.height === '400px') ? '40px' : '400px';
    }
}

function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}
