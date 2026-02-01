// parts.js (アップデート版)

// --- 簡易的な日英翻訳辞書 ---
const translationDict = {
    "ガスケット": "gasket",
    "ベアリング": "bearing",
    "フィルター": "filter",
    "オイルフィルター": "oil filter",
    "エアフィルター": "air filter",
    "ブレーキ": "brake",
    "ブレーキシュー": "brake shoe",
    "ブレーキパッド": "brake pad",
    "クラッチ": "clutch",
    "エンジン": "engine",
    "シリンダー": "cylinder",
    "ピストン": "piston",
    "ショックアブソーバー": "shock absorber",
    "サスペンション": "suspension",
    "タイヤ": "tire",
    "ホイール": "wheel",
    "ライト": "light",
    "ヘッドライト": "headlight",
    "テールライト": "taillight",
    "バンパー": "bumper",
    "ミラー": "mirror",
    "ドア": "door",
    "ウィンドウ": "window",
    "ワイパー": "wiper"
};

// --- 翻訳関数 ---
function translateKeyword(keyword) {
    // 完全一致、または前方一致で変換
    for (const [jp, en] of Object.entries(translationDict)) {
        if (keyword.toLowerCase().startsWith(jp)) {
            return keyword.toLowerCase().replace(jp, en);
        }
    }
    // 辞書にない場合はそのまま返す
    return keyword;
}

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

    // 車種チェックボックスの連動ロジック
    setupCarCheckboxes();
    
    // 初期状態で親がチェックされていたら子もチェックする
    const parent = document.getElementById('car-500-all');
    if(parent && parent.checked) {
        document.querySelectorAll('.car-sub').forEach(c => c.checked = true);
    }

    // 4. 検索条件の復元と自動実行
    loadSearchConditions();
});

// --- その他車種のトグル ---
function toggleOthers() {
    const area = document.getElementById('others-area');
    const btn = document.getElementById('toggle-others-btn');
    
    if (area.style.display === 'block') {
        area.style.display = 'none';
        btn.innerText = '+ その他の車種を表示';
    } else {
        area.style.display = 'block';
        btn.innerText = '- その他の車種を隠す';
    }
}

// --- 車種チェックボックスの連動 ---
function setupCarCheckboxes() {
    const parent = document.getElementById('car-500-all');
    const children = document.querySelectorAll('.car-sub');

    // 親 -> 子への反映
    parent.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        children.forEach(child => {
            child.checked = isChecked;
        });
    });

    // 子 -> 親への反映
    children.forEach(child => {
        child.addEventListener('change', () => {
            // 全ての子がチェックされているか確認
            const allChecked = Array.from(children).every(c => c.checked);
            // 一つでもチェックされているか確認（indeterminate用）
            const someChecked = Array.from(children).some(c => c.checked);

            parent.checked = allChecked;
            parent.indeterminate = someChecked && !allChecked;
        });
    });
}

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
    const resultCountEl = document.getElementById('result-count');
    
    // チェックボックス状態取得
    const checkedCars = Array.from(document.querySelectorAll('input[name="car"]:checked')).map(c => c.value);
    const checkedShops = Array.from(document.querySelectorAll('input[name="shop"]:checked')).map(c => c.value);
    const useExternal = document.getElementById('use-external').checked;
    const all500Checked = document.getElementById('car-500-all').checked;

    if (!keyword && checkedCars.length === 0 && !all500Checked) {
        alert("検索キーワードを入力するか、車種を選択してください。");
        return;
    }

    resultsArea.innerHTML = '<p style="padding:40px; text-align:center;">検索中...</p>';
    resultCountEl.innerText = "- 件";

    // 1. DB検索
    let dbResults = [];
    if (checkedShops.length > 0) {
        let query = window.supabaseClient.from('parts').select('*');

        // キーワード検索 (OR条件)
        if (keyword) {
            const pattern = `%${keyword}%`;
            // product_no が存在するか不明だが、エラーにはならないので含めておく
            query = query.or(`name_en.ilike.${pattern},name_jp.ilike.${pattern},oem_no.ilike.${pattern},product_no.ilike.${pattern}`);
        }
        
        // 車種検索
        // 「500」が選ばれている場合は、target_carsに「500」が含まれるものを探す
        // 個別の「500 F」などが選ばれている場合はそれらを探す
        if (checkedCars.length > 0 || all500Checked) {
            // ilike条件をORで繋ぐ: target_cars.ilike.%500%,target_cars.ilike.%500 F%,...
            let conditions = checkedCars.map(car => `target_cars.ilike.%${car}%`);
            
            // 親だけチェックされていて子がチェックされていない場合（ありえないはずだが念のため）
            // または親がチェックされている場合は "500" そのものも検索対象に含めるべきか？
            // ここではシンプルに checkedCars を使うが、もし checkedCars が空なら "500" を追加
            if (checkedCars.length === 0 && all500Checked) {
                conditions.push(`target_cars.ilike.%500%`);
            }
            
            if (conditions.length > 0) {
                query = query.or(conditions.join(','));
            }
        }
        
        // ショップ絞り込み
        query = query.in('shop_name', checkedShops);

        const { data, error } = await query.limit(100);
        if (error) {
            console.error(error);
            resultsArea.innerHTML = `<p style="color:red; padding:20px;">エラーが発生しました: ${error.message}</p>`;
            return;
        }
        dbResults = data || [];
    }

    // 2. 外部サイト検索 (変更: ポップアップではなくリンクを表示)
    let externalLinksHtml = "";
    if (useExternal) {
        let searchTerm = keyword;
        if (!searchTerm) {
             const all500Checked = document.getElementById('car-500-all').checked;
             if (all500Checked) {
                 searchTerm = "Fiat 500";
             } else if (checkedCars.length > 0) {
                 const car = checkedCars[0];
                 searchTerm = (car === "500") ? "Fiat 500" : `Fiat ${car}`;
             }
        }

        if (searchTerm) {
            const translatedSearchTerm = translateKeyword(searchTerm); // ★翻訳関数を呼び出す
            externalLinksHtml = `
                <div class="shop-section" style="border: 2px dashed #2856a8; background: #f0f9ff;">
                    <div class="shop-title" style="background:none; border:none; color:#2856a8;">
                        🌐 外部サイトで検索: "${escapeHtml(searchTerm)}" ${searchTerm !== translatedSearchTerm ? `(${escapeHtml(translatedSearchTerm)})` : ''}
                    </div>
                    <div style="padding: 0 20px 20px 20px; display:flex; flex-wrap:wrap; gap:12px;">
                        ${CONFIG.external_links.map(link => `
                            <a href="${link.url_pattern + encodeURIComponent(translatedSearchTerm)}" target="_blank" rel="noopener noreferrer"
                               style="padding:10px 16px; background:#fff; border:1px solid #2856a8; color:#2856a8; 
                                      text-decoration:none; border-radius:6px; font-weight:bold; display:flex; align-items:center;">
                                ${link.name} <span style="margin-left:6px;">↗</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    // 3. 表示処理
    resultCountEl.innerText = `${dbResults.length} 件`;
    
    // 外部サイトリンクを先に表示するか、後に表示するか。
    // ここでは「結果エリア」の先頭に追加する形にする。
    const container = document.getElementById('results-area');
    container.innerHTML = ""; // クリア

    if (externalLinksHtml) {
        container.innerHTML += externalLinksHtml;
    }

    displayResultsByShop(dbResults, checkedShops, container);

    // 4. 検索条件と結果の保存
    saveSearchConditions(keyword, checkedCars, checkedShops, useExternal, all500Checked, dbResults, container.innerHTML);
}

// --- 検索条件と結果の保存と復元 ---
function saveSearchConditions(keyword, cars, shops, useExternal, all500Checked, dbResults, resultsHtml) {
    const conditions = {
        keyword: keyword,
        cars: cars,
        shops: shops,
        useExternal: useExternal,
        all500Checked: all500Checked,
        dbResults: dbResults, // 検索結果の生データも保存
        resultsHtml: resultsHtml, // 検索結果のHTMLも保存
        timestamp: Date.now()
    };
    sessionStorage.setItem('fiat500_search_conditions', JSON.stringify(conditions));
}

function loadSearchConditions() {
    const json = sessionStorage.getItem('fiat500_search_conditions');
    if (!json) return;

    try {
        const conditions = JSON.parse(json);
        
        // 1時間以上前のデータなら破棄
        if (Date.now() - conditions.timestamp > 3600 * 1000) {
            sessionStorage.removeItem('fiat500_search_conditions');
            return;
        }

        // フォームへの反映
        const keywordInput = document.getElementById('keyword-input');
        if (keywordInput) keywordInput.value = conditions.keyword || "";
        
        const extCheck = document.getElementById('use-external');
        if (extCheck) extCheck.checked = !!conditions.useExternal;

        // 車種チェックボックス
        const allCars = document.querySelectorAll('input[name="car"]');
        let isOtherCarChecked = false;
        
        allCars.forEach(cb => {
            const shouldCheck = conditions.cars.includes(cb.value);
            cb.checked = shouldCheck;
            
            // その他エリアにあるか確認
            const parentDiv = cb.closest('#others-area');
            if (parentDiv && shouldCheck) {
                isOtherCarChecked = true;
            }
        });

        // その他エリアの表示状態を復元
        if (isOtherCarChecked) {
            const area = document.getElementById('others-area');
            const btn = document.getElementById('toggle-others-btn');
            if (area && btn) {
                area.style.display = 'block';
                btn.innerText = '- その他の車種を隠す';
            }
        }

        // 親チェックボックスの状態を更新
        const parent = document.getElementById('car-500-all');
        if (parent) {
            if (conditions.all500Checked) {
                parent.checked = true;
                document.querySelectorAll('.car-sub').forEach(c => c.checked = true);
            } else {
                const children = document.querySelectorAll('.car-sub');
                const allChecked = Array.from(children).every(c => c.checked);
                const someChecked = Array.from(children).some(c => c.checked);
                parent.checked = allChecked;
                parent.indeterminate = someChecked && !allChecked;
            }
        }

        // ショップチェックボックス
        if (conditions.shops && conditions.shops.length > 0) {
            conditions.shops.forEach(shopValue => {
                const shopCb = document.querySelector(`input[name="shop"][value="${shopValue}"]`);
                if (shopCb) shopCb.checked = true;
            });
        }

        // 検索結果の復元
        if (conditions.resultsHtml) {
            const resultsArea = document.getElementById('results-area');
            const resultCountEl = document.getElementById('result-count');
            if (resultsArea && resultCountEl) {
                resultsArea.innerHTML = conditions.resultsHtml;
                if (conditions.dbResults) {
                    resultCountEl.innerText = `${conditions.dbResults.length} 件`;
                }
            }
        }

    } catch (e) {
        console.error("Failed to load search conditions from sessionStorage", e);
        sessionStorage.removeItem('fiat500_search_conditions');
    }
}

// --- 結果表示 (ショップ別) ---
function displayResultsByShop(parts, targetShops, container) {
    // containerは既にクリアされているか、外部リンクが入っている前提
    // container.innerHTML = ""; // ここでクリアしてはいけない

    if (parts.length === 0) {
        // 外部リンクもなくて、パーツもない場合のみメッセージ
        if (!container.innerHTML) {
            container.innerHTML = '<p style="padding:40px; text-align:center; color:#6b7280;">条件に合うパーツが見つかりませんでした。</p>';
        }
        return;
    }

    // 指定されたショップごとにセクションを作る
    targetShops.forEach(shopName => {
        // そのショップのパーツだけ抽出
        const shopParts = parts.filter(p => p.shop_name === shopName);
        if (shopParts.length === 0) return;

        // セクション作成
        const section = document.createElement('div');
        section.className = 'shop-section';
        section.innerHTML = `<div class="shop-title">${shopName} (${shopParts.length}件)</div>`;
        
        // カードグリッド作成
        const grid = document.createElement('div');
        grid.className = 'parts-grid';

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
    
    // --- 1. 画像URLの補正 ---
    let finalImageUrl = "";
    let rawUrl = part.image_url ? String(part.image_url).replace(/^\s+|\s+$/g, '') : "";

    const isInvalid = !rawUrl || /^(nan|null|undefined)$/i.test(rawUrl) || rawUrl === "";

    if (isInvalid) {
        finalImageUrl = 'https://placehold.co/400x300/f3f4f6/9ca3af?text=No+Image';
    } else if (rawUrl.startsWith('http')) {
        finalImageUrl = rawUrl;
    } else {
        const domain = 'https://webshop.fiat500126.com';
        const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
        finalImageUrl = domain + cleanPath;
    }

    // --- 2. 価格計算 ---
    let displayPriceHtml = "";
    let priceForCalc = part.price_euro;
    
    // データが文字列で来る場合があるので数値化
    const rawPrice = parseFloat(part.price_euro);
    
    if (isNaN(rawPrice)) {
        displayPriceHtml = `<div class="price-jpy">価格不明</div>`;
        priceForCalc = 0;
    } else {
        if (shopConfig.is_price_ex_vat) {
            // DB価格が税抜きの場合
            priceForCalc = rawPrice;
            displayPriceHtml = `<div class="price-euro">€ ${rawPrice.toFixed(2)} <span style="font-size:0.7em; color:#6b7280; font-weight:normal;">(税抜)</span></div>`;
        } else {
            // DB価格が税込みの場合
            const exVat = rawPrice / (1 + (shopConfig.vat_rate || 0.19));
            priceForCalc = exVat; 
            displayPriceHtml = `
                <div class="price-euro">€ ${rawPrice.toFixed(2)} <span style="font-size:0.7em; color:#6b7280; font-weight:normal;">(税込)</span></div>
                <div class="price-jpy">(税抜: € ${exVat.toFixed(2)})</div>
            `;
        }
    }

    const title = part.name_jp && !/nan/i.test(part.name_jp) ? part.name_jp : (part.name_en || "No Title");
    const subtitleHtml = part.name_en ? `<div class="part-subtitle" title="${escapeHtml(part.name_en)}">${escapeHtml(part.name_en)}</div>` : '';
    const jpyApprox = Math.round(priceForCalc * currentRate).toLocaleString();

    // --- 3. HTMLの組み立て ---
    const div = document.createElement('div');
    div.className = 'part-card';
    div.innerHTML = `
        <a href="${part.page_url}" target="_blank" style="text-decoration:none; color:inherit; display:flex; flex-direction:column; flex-grow:1;">
            <div class="part-img-wrap">
                <img src="${finalImageUrl}" 
                     class="part-img" 
                     alt="img" 
                     referrerpolicy="no-referrer" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://placehold.co/400x300/f3f4f6/9ca3af?text=No+Image';">
            </div>
            <div class="part-body">
                <div class="part-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                ${subtitleHtml}
                <div class="part-meta">OEM: ${part.oem_no || '-'}</div>
                
                <div class="part-price-area">
                    ${displayPriceHtml}
                    <div class="price-jpy">約 ${jpyApprox} 円</div>
                </div>
            </div>
        </a>
        <div style="padding: 0 12px 12px 12px;">
            <button class="add-btn" onclick="addToList('${part.id}', '${escapeHtml(title)}', '${part.shop_name}', ${priceForCalc}, '${part.page_url}')">
                ＋ リストに追加
            </button>
        </div>
    `;
    return div;
}

// --- 比較リスト管理 ---

function addToList(id, name, shop, price, url) {
    compareList.push({
        uniqueId: Date.now(),
        name: name,
        shop: shop,
        price: parseFloat(price),
        url: url
    });
    saveList();
    renderList();
    
    // トレイを開く
    const tray = document.getElementById('comparison-tray');
    if(!tray.classList.contains('open')) toggleTray(true);
}

function renderList() {
    const tbody = document.getElementById('compare-rows');
    const countEl = document.getElementById('tray-count');
    tbody.innerHTML = "";
    
    countEl.innerText = compareList.length;

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
        headerRow.style.background = "#f9fafb";
        headerRow.innerHTML = `<td colspan="5" style="font-weight:bold; padding:8px 12px; color:#374151;">${shopName}</td>`;
        tbody.appendChild(headerRow);

        // 2. アイテム行
        items.forEach((item, idx) => {
            const itemPrice = parseFloat(item.price) || 0;
            shopSubtotal += itemPrice;
            const globalIdx = compareList.indexOf(item);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding-left:20px;">
                    <a href="${item.url}" target="_blank" style="color:#2856a8; text-decoration:none;">${item.name}</a>
                </td>
                <td style="font-size:0.85rem; color:#6b7280;">${shopName}</td>
                <td>
                    € <input type="number" step="0.01" value="${itemPrice.toFixed(2)}" 
                    onchange="updateItemPrice(${globalIdx}, this.value)" 
                    style="width:60px; padding:4px; border:1px solid #d1d5db; border-radius:4px;">
                </td>
                <td>¥ ${Math.round(itemPrice * currentRate).toLocaleString()}</td>
                <td style="text-align:center;">
                    <button onclick="removeFromList(${globalIdx})" style="color:#ef4444; border:none; background:none; cursor:pointer; font-size:1.2rem;">&times;</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // 3. 送料・小計行
        const shipping = parseFloat(shippingCosts[shopName]) || 0;
        const shopTotal = shopSubtotal + shipping;
        grandTotalEur += shopTotal;

        const summaryRow = document.createElement('tr');
        summaryRow.style.borderBottom = "2px solid #e5e7eb";
        summaryRow.innerHTML = `
            <td colspan="2" style="text-align:right; font-size:0.9rem; color:#6b7280;">
                小計: €${shopSubtotal.toFixed(2)} + 送料: 
                <input type="number" value="${shipping}" onchange="updateShipping('${shopName}', this.value)" 
                style="width:60px; padding:4px; border:1px solid #d1d5db; border-radius:4px; text-align:right;">
            </td>
            <td style="font-weight:bold; color:#111827;">€ ${shopTotal.toFixed(2)}</td>
            <td style="font-weight:bold; color:#111827;">¥ ${Math.round(shopTotal * currentRate).toLocaleString()}</td>
            <td></td>
        `;
        tbody.appendChild(summaryRow);
    });

    // 総合計表示
    document.getElementById('tray-total-jpy').innerText = Math.round(grandTotalEur * currentRate).toLocaleString();
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
        tray.classList.add('open');
    } else {
        tray.classList.toggle('open');
    }
}

function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}
