// parts.js - 5店舗パーツ価格比較ツール

// --- 日本語→英語・イタリア語 翻訳辞書 ---
const translationDict = {
    "ガスケット": ["gasket", "guarnizione"],
    "パッキン": ["gasket", "guarnizione"],
    "ベアリング": ["bearing", "cuscinetto"],
    "フィルター": ["filter", "filtro"],
    "オイルフィルター": ["oil filter", "filtro olio"],
    "エアフィルター": ["air filter", "filtro aria"],
    "ブレーキ": ["brake", "freno"],
    "ブレーキシュー": ["brake shoe", "ganascia freno"],
    "ブレーキパッド": ["brake pad", "pastiglia freno"],
    "クラッチ": ["clutch", "frizione"],
    "エンジン": ["engine", "motore"],
    "シリンダー": ["cylinder", "cilindro"],
    "ピストン": ["piston", "pistone"],
    "ショックアブソーバー": ["shock absorber", "ammortizzatore"],
    "サスペンション": ["suspension", "sospensione"],
    "タイヤ": ["tire", "pneumatico"],
    "ホイール": ["wheel", "ruota"],
    "ライト": ["light", "luce", "faro"],
    "ヘッドライト": ["headlight", "faro"],
    "テールライト": ["taillight", "fanale"],
    "バンパー": ["bumper", "paraurti"],
    "ミラー": ["mirror", "specchio"],
    "ドア": ["door", "porta"],
    "ウィンドウ": ["window", "vetro", "finestrino"],
    "ワイパー": ["wiper", "tergicristallo"],
    "キャブレター": ["carburetor", "carburatore"],
    "マフラー": ["muffler", "marmitta"],
    "ラジエーター": ["radiator", "radiatore"],
    "スターター": ["starter", "motorino"],
    "オルタネーター": ["alternator", "alternatore"],
    "ポンプ": ["pump", "pompa"],
    "ホース": ["hose", "tubo"],
    "ケーブル": ["cable", "cavo"],
    "シール": ["seal", "paraolio", "guarnizione"]
};

// --- 翻訳関数（複数言語対応） ---
function translateKeyword(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    for (const [jp, translations] of Object.entries(translationDict)) {
        if (lowerKeyword.includes(jp.toLowerCase())) {
            return translations; // 配列を返す
        }
    }
    return [keyword]; // 翻訳なしの場合は元のキーワードを配列で返す
}

// グローバル変数
let currentRate = CONFIG.default_rate;
let compareList = [];       // { uniqueId, partId, name, shop, priceExVat, pageUrl, imageUrl }
let shippingCosts = {};     // { shopName: number }
let currentOpenSection = null; // 現在開いているセクション
let currentViewMode = 'shop'; // 'shop' または 'oem'
let lastSearchResults = [];   // 最後の検索結果を保持（モード切替用）
let lastTargetShops = [];     // 最後の検索対象ショップ

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', async () => {
    // ショップチェックボックスを動的生成（リンク付き）
    renderShopCheckboxes();

    await fetchCurrencyRate();
    loadListFromStorage();

    document.getElementById('search-btn').addEventListener('click', executeSearch);
    document.getElementById('keyword-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });

    setupCarCheckboxes();

    const parent = document.getElementById('car-500-all');
    if (parent && parent.checked) {
        document.querySelectorAll('.car-sub').forEach(c => c.checked = true);
    }

    loadSearchConditions();
});

// --- ショップチェックボックスを本サイトリンク付きで生成 ---
function renderShopCheckboxes() {
    const container = document.getElementById('shop-checkboxes');
    if (!container) return;

    container.innerHTML = '';
    Object.keys(CONFIG.shops).forEach(shopName => {
        const shopConfig = CONFIG.shops[shopName];
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
            <input type="checkbox" name="shop" value="${shopName}" checked>
            <a href="${shopConfig.base_url}" target="_blank" rel="noopener noreferrer" class="shop-link" onclick="event.stopPropagation();">${shopName}</a>
        `;
        container.appendChild(label);
    });
}

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

    parent.addEventListener('change', (e) => {
        children.forEach(child => child.checked = e.target.checked);
    });

    children.forEach(child => {
        child.addEventListener('change', () => {
            const allChecked = Array.from(children).every(c => c.checked);
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
    renderCompareList();
}

// --- 税抜き価格を計算 ---
function getPriceExVat(rawPrice, shopName) {
    const shopConfig = CONFIG.shops[shopName];
    if (!shopConfig) return rawPrice;

    if (shopConfig.is_price_ex_vat) {
        return rawPrice; // 既に税抜き
    } else {
        return rawPrice / (1 + (shopConfig.vat_rate || 0));
    }
}

// --- 検索実行 ---
async function executeSearch() {
    const keyword = document.getElementById('keyword-input').value.trim();
    const resultsArea = document.getElementById('results-area');
    const resultCountEl = document.getElementById('result-count');

    const checkedCars = Array.from(document.querySelectorAll('input[name="car"]:checked')).map(c => c.value);
    const checkedShops = Array.from(document.querySelectorAll('input[name="shop"]:checked')).map(c => c.value);
    const all500Checked = document.getElementById('car-500-all').checked;

    if (!keyword && checkedCars.length === 0 && !all500Checked) {
        alert("検索キーワードを入力するか、車種を選択してください。");
        return;
    }

    if (checkedShops.length === 0) {
        alert("少なくとも1つのショップを選択してください。");
        return;
    }

    resultsArea.innerHTML = '<p style="padding:40px; text-align:center;">検索中...</p>';
    resultCountEl.innerText = "- 件";

    // DB検索（各ショップごとに並列でクエリを実行）
    let dbResults = [];

    // 検索条件を構築
    let searchConditions = [];
    if (keyword) {
        const translations = translateKeyword(keyword);

        // 翻訳された各キーワードで検索（英語・イタリア語）
        translations.forEach(translated => {
            const translatedPattern = `%${translated}%`;
            searchConditions.push(`name_en.ilike.${translatedPattern}`);
            searchConditions.push(`name_jp.ilike.${translatedPattern}`);
        });

        // 元のキーワードでも検索（OEM番号、品番）
        const pattern = `%${keyword}%`;
        searchConditions.push(`oem_no.ilike.${pattern}`);
        searchConditions.push(`product_no.ilike.${pattern}`);

        // 翻訳がなかった場合は元のキーワードでname_en/name_jpも検索
        if (translations.length === 1 && translations[0] === keyword) {
            searchConditions.push(`name_en.ilike.${pattern}`);
            searchConditions.push(`name_jp.ilike.${pattern}`);
        }
    }

    // 車種条件を構築
    let carConditions = [];
    if (checkedCars.length > 0 || all500Checked) {
        if (all500Checked) {
            carConditions.push(`target_cars.ilike.%500%`);
        }
        checkedCars.forEach(car => {
            if (!car.startsWith('500')) {
                carConditions.push(`target_cars.ilike.%${car}%`);
            }
        });
    }


    // 各ショップごとに並列でクエリを実行（各ショップ最大500件）
    const LIMIT_PER_SHOP = 500;
    const shopQueries = checkedShops.map(async (shopName) => {
        let query = window.supabaseClient.from('parts').select('*');

        // キーワード条件
        if (searchConditions.length > 0) {
            query = query.or(searchConditions.join(','));
        }

        // 車種条件
        if (carConditions.length > 0) {
            query = query.or(carConditions.join(','));
        }

        // ショップ絞り込み
        query = query.eq('shop_name', shopName);

        const { data, error } = await query.limit(LIMIT_PER_SHOP);
        if (error) {
            console.error(`${shopName}のクエリエラー:`, error);
            return [];
        }
        return data || [];
    });

    // 全ショップの結果を待機してマージ
    const results = await Promise.all(shopQueries);
    dbResults = results.flat();

    // 結果を保存（モード切替用）
    lastSearchResults = dbResults;
    lastTargetShops = checkedShops;

    // 表示処理
    const totalCount = dbResults.length;
    resultCountEl.innerText = `${totalCount} 件`;

    resultsArea.innerHTML = "";

    // 現在のモードに応じて表示
    if (currentViewMode === 'oem') {
        displayResultsByOem(dbResults, resultsArea);
    } else {
        displayResultsByShop(dbResults, checkedShops, resultsArea);
    }

    // 検索条件の保存
    saveSearchConditions(keyword, checkedCars, checkedShops, all500Checked, dbResults);
}

// --- 検索条件の保存と復元 ---
function saveSearchConditions(keyword, cars, shops, all500Checked, dbResults) {
    const conditions = {
        keyword, cars, shops, all500Checked, dbResults,
        timestamp: Date.now()
    };
    sessionStorage.setItem('fiat500_search_conditions', JSON.stringify(conditions));
}

function loadSearchConditions() {
    const json = sessionStorage.getItem('fiat500_search_conditions');
    if (!json) return;

    try {
        const conditions = JSON.parse(json);

        if (Date.now() - conditions.timestamp > 3600 * 1000) {
            sessionStorage.removeItem('fiat500_search_conditions');
            return;
        }

        const keywordInput = document.getElementById('keyword-input');
        if (keywordInput) keywordInput.value = conditions.keyword || "";

        // 車種チェックボックス
        const allCars = document.querySelectorAll('input[name="car"]');
        let isOtherCarChecked = false;

        allCars.forEach(cb => {
            const shouldCheck = conditions.cars.includes(cb.value);
            cb.checked = shouldCheck;
            const parentDiv = cb.closest('#others-area');
            if (parentDiv && shouldCheck) isOtherCarChecked = true;
        });

        if (isOtherCarChecked) {
            const area = document.getElementById('others-area');
            const btn = document.getElementById('toggle-others-btn');
            if (area && btn) {
                area.style.display = 'block';
                btn.innerText = '- その他の車種を隠す';
            }
        }

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

        // ショップチェックボックス（全て一旦外してから復元）
        document.querySelectorAll('input[name="shop"]').forEach(cb => cb.checked = false);
        if (conditions.shops && conditions.shops.length > 0) {
            conditions.shops.forEach(shopValue => {
                const shopCb = document.querySelector(`input[name="shop"][value="${shopValue}"]`);
                if (shopCb) shopCb.checked = true;
            });
        }

        // 検索結果の復元
        if (conditions.dbResults && conditions.dbResults.length > 0) {
            lastSearchResults = conditions.dbResults;
            lastTargetShops = conditions.shops;

            const resultsArea = document.getElementById('results-area');
            const resultCountEl = document.getElementById('result-count');
            if (resultsArea && resultCountEl) {
                resultCountEl.innerText = `${conditions.dbResults.length} 件`;

                // 現在のモードに応じて表示
                if (currentViewMode === 'oem') {
                    displayResultsByOem(conditions.dbResults, resultsArea);
                } else {
                    displayResultsByShop(conditions.dbResults, conditions.shops, resultsArea);
                }
            }
        }

    } catch (e) {
        console.error("Failed to load search conditions", e);
        sessionStorage.removeItem('fiat500_search_conditions');
    }
}

// --- 結果表示 (ショップ別アコーディオン) ---
function displayResultsByShop(parts, targetShops, container) {
    container.innerHTML = "";

    if (parts.length === 0) {
        container.innerHTML = '<p style="padding:40px; text-align:center; color:#6b7280;">条件に合うパーツが見つかりませんでした。</p>';
        return;
    }

    targetShops.forEach(shopName => {
        const shopParts = parts.filter(p => p.shop_name === shopName);

        const section = document.createElement('div');
        section.className = 'shop-section';
        section.dataset.shop = shopName;

        // ヘッダー（件数のみ表示、クリックで開閉）
        const header = document.createElement('div');
        header.className = 'shop-header';
        header.innerHTML = `
            <div class="shop-name">
                <span>${shopName}</span>
                <span class="shop-count">(${shopParts.length}件)</span>
            </div>
            <span class="accordion-icon">▶</span>
        `;
        header.onclick = () => toggleShopSection(section);
        section.appendChild(header);

        // コンテンツ（カードグリッド）
        const content = document.createElement('div');
        content.className = 'shop-content';

        if (shopParts.length === 0) {
            content.innerHTML = '<p style="color:#6b7280; text-align:center;">該当なし</p>';
        } else {
            const grid = document.createElement('div');
            grid.className = 'parts-grid';
            shopParts.forEach(part => grid.appendChild(createPartCard(part)));
            content.appendChild(grid);

            // たたむボタンを追加
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'collapse-btn';
            collapseBtn.innerHTML = '▲ たたむ';
            collapseBtn.onclick = (e) => {
                e.stopPropagation();
                section.classList.remove('open');
                currentOpenSection = null;
                document.getElementById('floating-collapse-btn').classList.remove('visible');
                // セクションの上部にスクロール
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            content.appendChild(collapseBtn);
        }

        section.appendChild(content);
        container.appendChild(section);
    });
}

// === 表示モード切替 ===

function switchViewMode(mode) {
    if (currentViewMode === mode) return;

    currentViewMode = mode;

    // ボタンのactive状態を更新
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // フローティングボタンをリセット
    currentOpenSection = null;
    document.getElementById('floating-collapse-btn').classList.remove('visible');

    // 検索結果があれば再表示
    if (lastSearchResults.length > 0) {
        const resultsArea = document.getElementById('results-area');
        resultsArea.innerHTML = "";

        if (mode === 'oem') {
            displayResultsByOem(lastSearchResults, resultsArea);
        } else {
            displayResultsByShop(lastSearchResults, lastTargetShops, resultsArea);
        }
    }
}

// === OEM番号正規化 ===
function normalizeOemNumber(oem) {
    if (!oem) return null;
    const trimmed = String(oem).trim();

    // 無効な値をチェック
    if (trimmed === '' ||
        trimmed === '-' ||
        /^(nan|n\/a|na|null|undefined|none|なし|無し)$/i.test(trimmed)) {
        return null;
    }

    // 長すぎる文字列は説明文の可能性が高い（OEM番号は通常20文字以内）
    if (trimmed.length > 25) return null;

    // 英語の説明文パターンを除外
    if (/^(this|the|for|fits|product|model|suitable|compatible)/i.test(trimmed)) {
        return null;
    }

    // スペースが3つ以上ある場合は説明文の可能性
    if ((trimmed.match(/\s/g) || []).length >= 3) return null;

    // スペース、ハイフン、ピリオドを除去して大文字に
    return trimmed.replace(/[\s\-\.]/g, '').toUpperCase();
}

// === 部品別（OEMグループ）表示 ===
function displayResultsByOem(parts, container) {
    container.innerHTML = "";

    if (parts.length === 0) {
        container.innerHTML = '<p style="padding:40px; text-align:center; color:#6b7280;">条件に合うパーツが見つかりませんでした。</p>';
        return;
    }

    // OEM番号でグループ化
    const oemGroups = {};
    const noOemParts = [];

    parts.forEach(part => {
        const normalizedOem = normalizeOemNumber(part.oem_no);
        if (normalizedOem) {
            if (!oemGroups[normalizedOem]) {
                oemGroups[normalizedOem] = {
                    originalOem: part.oem_no,
                    parts: []
                };
            }
            oemGroups[normalizedOem].parts.push(part);
        } else {
            noOemParts.push(part);
        }
    });

    // OEMグループをソート（部品数が多い順）
    const sortedOemKeys = Object.keys(oemGroups).sort((a, b) => {
        return oemGroups[b].parts.length - oemGroups[a].parts.length;
    });

    // 複数店舗で扱っているグループ（比較価値が高い）を先に表示
    const multiShopGroups = sortedOemKeys.filter(key => {
        const shops = new Set(oemGroups[key].parts.map(p => p.shop_name));
        return shops.size > 1;
    });
    const singleShopGroups = sortedOemKeys.filter(key => {
        const shops = new Set(oemGroups[key].parts.map(p => p.shop_name));
        return shops.size === 1;
    });

    // 複数店舗のグループを表示
    if (multiShopGroups.length > 0) {
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'padding: 12px 16px; background: #dcfce7; border-radius: 8px; margin-bottom: 16px; font-weight: 600; color: #166534;';
        headerDiv.innerHTML = `複数店舗で比較可能な部品 (${multiShopGroups.length}グループ)`;
        container.appendChild(headerDiv);

        multiShopGroups.forEach(oemKey => {
            container.appendChild(createOemSection(oemKey, oemGroups[oemKey]));
        });
    }

    // 単一店舗のグループを表示
    if (singleShopGroups.length > 0) {
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'padding: 12px 16px; background: #f3f4f6; border-radius: 8px; margin-bottom: 16px; margin-top: 24px; font-weight: 600; color: #6b7280;';
        headerDiv.innerHTML = `1店舗のみの部品 (${singleShopGroups.length}グループ)`;
        container.appendChild(headerDiv);

        singleShopGroups.forEach(oemKey => {
            container.appendChild(createOemSection(oemKey, oemGroups[oemKey]));
        });
    }

    // 統計サマリー（上部に表示）
    const oemCount = Object.keys(oemGroups).length;
    const totalOemParts = Object.values(oemGroups).reduce((sum, g) => sum + g.parts.length, 0);

    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'padding: 12px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; color: #6b7280;';
    summaryDiv.innerHTML = `
        <span style="color: #111827; font-weight: 600;">OEM番号あり: ${totalOemParts}件 (${oemCount}グループ)</span>
        ${noOemParts.length > 0 ? `<span style="margin-left: 16px;">OEM番号なし: ${noOemParts.length}件 → <a href="#" onclick="switchViewMode('shop'); return false;" style="color: #2856a8;">店舗別表示で確認</a></span>` : ''}
    `;
    container.insertBefore(summaryDiv, container.firstChild);
}

// OEMセクション生成（比較テーブル付き）
function createOemSection(oemKey, group) {
    const section = document.createElement('div');
    section.className = 'oem-section';

    // 代表的な商品名を取得（日本語優先）
    let representativeName = '';
    for (const part of group.parts) {
        if (part.name_jp && !/nan/i.test(part.name_jp)) {
            representativeName = part.name_jp;
            break;
        }
    }
    if (!representativeName) {
        representativeName = group.parts[0].name_en || 'Unknown Part';
    }

    // 価格順にソート（安い順）
    const sortedParts = [...group.parts].sort((a, b) => {
        const priceA = getPriceExVat(parseFloat(a.price_euro) || 0, a.shop_name);
        const priceB = getPriceExVat(parseFloat(b.price_euro) || 0, b.shop_name);
        return priceA - priceB;
    });

    const cheapestPrice = getPriceExVat(parseFloat(sortedParts[0].price_euro) || 0, sortedParts[0].shop_name);

    section.innerHTML = `
        <div class="oem-header">
            <div class="oem-title">${escapeHtml(representativeName)}</div>
            <div class="oem-number">OEM: ${group.originalOem}</div>
        </div>
        <div class="oem-content">
            <table class="shop-compare-table">
                <thead>
                    <tr>
                        <th style="width:50px;"></th>
                        <th>ショップ</th>
                        <th>商品名</th>
                        <th style="text-align:right;">価格 (税抜)</th>
                        <th style="text-align:right;">操作</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;

    const tbody = section.querySelector('tbody');

    sortedParts.forEach((part, index) => {
        const shopConfig = CONFIG.shops[part.shop_name] || { is_price_ex_vat: true, vat_rate: 0 };
        const rawPrice = parseFloat(part.price_euro);
        const priceExVat = isNaN(rawPrice) ? 0 : getPriceExVat(rawPrice, part.shop_name);
        const jpyApprox = Math.round(priceExVat * currentRate).toLocaleString();

        const isCheapest = index === 0 && sortedParts.length > 1;
        const isAdded = compareList.some(item => item.partId === part.id);

        // 画像URL処理
        let finalImageUrl = "";
        let rawUrl = part.image_url ? String(part.image_url).replace(/^\s+|\s+$/g, '') : "";
        const isInvalid = !rawUrl || /^(nan|null|undefined)$/i.test(rawUrl) || rawUrl === "";
        if (isInvalid) {
            finalImageUrl = 'https://placehold.co/50x50/f3f4f6/9ca3af?text=No';
        } else if (rawUrl.startsWith('http')) {
            finalImageUrl = rawUrl;
        } else {
            const baseUrl = shopConfig.base_url || 'https://webshop.fiat500126.com';
            finalImageUrl = baseUrl + (rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl);
        }

        const title = part.name_jp && !/nan/i.test(part.name_jp) ? part.name_jp : (part.name_en || "No Title");
        const productNo = part.product_no && !/nan/i.test(part.product_no) ? part.product_no : '';

        const row = document.createElement('tr');
        row.className = isCheapest ? 'cheapest' : '';
        row.dataset.partId = part.id;
        row.innerHTML = `
            <td>
                <img src="${finalImageUrl}" class="part-thumb" alt=""
                     onerror="this.src='https://placehold.co/50x50/f3f4f6/9ca3af?text=No'"
                     referrerpolicy="no-referrer">
            </td>
            <td class="shop-name-cell">
                ${part.shop_name}
                ${isCheapest ? '<span class="cheapest-badge">最安</span>' : ''}
            </td>
            <td>
                <div>${escapeHtml(title)}</div>
                ${productNo ? `<div class="product-no">品番: ${escapeHtml(productNo)}</div>` : ''}
            </td>
            <td class="price-cell">
                <div class="price-main">€${priceExVat.toFixed(2)}</div>
                <div class="price-jpy">約 ${jpyApprox}円</div>
            </td>
            <td class="actions-cell">
                <a href="${part.page_url}" target="_blank" rel="noopener noreferrer" title="本サイトで見る">↗ 詳細</a>
                <button class="${isAdded ? 'added' : ''}" data-part-id="${part.id}"
                    onclick="toggleListItemFromTable('${part.id}', '${escapeHtml(title)}', '${part.shop_name}', ${priceExVat}, '${part.page_url}', '${finalImageUrl}', this)">
                    ${isAdded ? '✓ 追加済' : '＋ 追加'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    return section;
}

// テーブルからのリスト追加/削除
function toggleListItemFromTable(partId, name, shop, priceExVat, pageUrl, imageUrl, buttonEl) {
    toggleListItem(partId, name, shop, priceExVat, pageUrl, imageUrl);

    // ボタン状態を即座に更新
    const isAdded = compareList.some(item => item.partId === partId);
    if (isAdded) {
        buttonEl.classList.add('added');
        buttonEl.textContent = '✓ 追加済';
    } else {
        buttonEl.classList.remove('added');
        buttonEl.textContent = '＋ 追加';
    }
}

// アコーディオン開閉
function toggleShopSection(section) {
    const wasOpen = section.classList.contains('open');
    section.classList.toggle('open');

    // フローティングボタンの表示制御
    const floatingBtn = document.getElementById('floating-collapse-btn');
    if (section.classList.contains('open')) {
        currentOpenSection = section;
        floatingBtn.classList.add('visible');
    } else {
        currentOpenSection = null;
        floatingBtn.classList.remove('visible');
    }
}

// フローティングたたむボタンのクリック処理
function collapseCurrentSection() {
    if (currentOpenSection) {
        currentOpenSection.classList.remove('open');
        currentOpenSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentOpenSection = null;
        document.getElementById('floating-collapse-btn').classList.remove('visible');
    }
}

// --- パーツカード生成 ---
function createPartCard(part) {
    const shopConfig = CONFIG.shops[part.shop_name] || { is_price_ex_vat: true, vat_rate: 0 };

    // 画像URL処理
    let finalImageUrl = "";
    let rawUrl = part.image_url ? String(part.image_url).replace(/^\s+|\s+$/g, '') : "";
    const isInvalid = !rawUrl || /^(nan|null|undefined)$/i.test(rawUrl) || rawUrl === "";

    if (isInvalid) {
        finalImageUrl = 'https://placehold.co/400x300/f3f4f6/9ca3af?text=No+Image';
    } else if (rawUrl.startsWith('http')) {
        finalImageUrl = rawUrl;
    } else {
        const baseUrl = shopConfig.base_url || 'https://webshop.fiat500126.com';
        const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
        finalImageUrl = baseUrl + cleanPath;
    }

    // 価格計算（税抜き統一）
    const rawPrice = parseFloat(part.price_euro);
    let priceExVat = 0;
    let displayPriceHtml = "";

    if (isNaN(rawPrice)) {
        displayPriceHtml = `<div class="price-jpy">価格不明</div>`;
    } else {
        priceExVat = getPriceExVat(rawPrice, part.shop_name);
        displayPriceHtml = `
            <div class="price-euro">€ ${priceExVat.toFixed(2)} <span style="font-size:0.7em; color:#6b7280; font-weight:normal;">(税抜)</span></div>
        `;
    }

    const title = part.name_jp && !/nan/i.test(part.name_jp) ? part.name_jp : (part.name_en || "No Title");
    const subtitleHtml = part.name_en ? `<div class="part-subtitle" title="${escapeHtml(part.name_en)}">${escapeHtml(part.name_en)}</div>` : '';
    const jpyApprox = Math.round(priceExVat * currentRate).toLocaleString();

    // 追加済みかチェック
    const isAdded = compareList.some(item => item.partId === part.id);
    const btnClass = isAdded ? 'add-btn added' : 'add-btn';
    const btnText = isAdded ? '✓ 追加済み' : '＋ リストに追加';

    const div = document.createElement('div');
    div.className = 'part-card';
    div.dataset.partId = part.id;
    div.innerHTML = `
        <a href="${part.page_url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:inherit; display:flex; flex-direction:column; flex-grow:1;">
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
            <button class="${btnClass}" data-part-id="${part.id}" onclick="event.preventDefault(); toggleListItem('${part.id}', '${escapeHtml(title)}', '${part.shop_name}', ${priceExVat}, '${part.page_url}', '${finalImageUrl}')">
                ${btnText}
            </button>
        </div>
    `;
    return div;
}

// --- 比較リスト管理 ---

// リストへの追加/削除トグル
function toggleListItem(partId, name, shop, priceExVat, pageUrl, imageUrl) {
    const existingIndex = compareList.findIndex(item => item.partId === partId);

    if (existingIndex >= 0) {
        // 削除
        compareList.splice(existingIndex, 1);
    } else {
        // 追加
        compareList.push({
            uniqueId: Date.now(),
            partId: partId,
            name: name,
            shop: shop,
            priceExVat: parseFloat(priceExVat),
            pageUrl: pageUrl,
            imageUrl: imageUrl
        });
    }

    saveList();
    renderCompareList();
    updateCardButtons();

    // トレイが閉じていたら開く
    const tray = document.getElementById('comparison-tray');
    if (tray.classList.contains('collapsed') && compareList.length > 0) {
        toggleTray(true);
    }
}

// カードのボタン状態を更新（両モード対応）
function updateCardButtons() {
    // カードモード（店舗別表示）
    document.querySelectorAll('.part-card').forEach(card => {
        const partId = card.dataset.partId;
        const btn = card.querySelector('.add-btn');
        if (!btn) return;

        const isAdded = compareList.some(item => item.partId === partId);
        if (isAdded) {
            btn.classList.add('added');
            btn.textContent = '✓ 追加済み';
        } else {
            btn.classList.remove('added');
            btn.textContent = '＋ リストに追加';
        }
    });

    // テーブルモード（部品別表示）
    document.querySelectorAll('.shop-compare-table tbody tr').forEach(row => {
        const partId = row.dataset.partId;
        if (!partId) return;
        const btn = row.querySelector('button[data-part-id]');
        if (!btn) return;

        const isAdded = compareList.some(item => item.partId === partId);
        if (isAdded) {
            btn.classList.add('added');
            btn.textContent = '✓ 追加済';
        } else {
            btn.classList.remove('added');
            btn.textContent = '＋ 追加';
        }
    });
}

// 比較リスト表示（店舗別グループ化）
function renderCompareList() {
    const container = document.getElementById('compare-content');
    const countEl = document.getElementById('tray-count');
    const totalEurEl = document.getElementById('tray-total-eur');
    const totalJpyEl = document.getElementById('tray-total-jpy');

    countEl.innerText = compareList.length;
    container.innerHTML = "";

    if (compareList.length === 0) {
        container.innerHTML = '<p style="color:#6b7280; text-align:center; padding:40px;">リストは空です。検索結果から「＋ リストに追加」で商品を追加してください。</p>';
        totalEurEl.innerText = '€0';
        totalJpyEl.innerText = '¥0';
        return;
    }

    // ショップごとにグループ化
    const grouped = {};
    compareList.forEach(item => {
        if (!grouped[item.shop]) grouped[item.shop] = [];
        grouped[item.shop].push(item);
    });

    let grandTotalEur = 0;

    Object.keys(grouped).forEach(shopName => {
        const items = grouped[shopName];
        let shopSubtotal = items.reduce((sum, item) => sum + (item.priceExVat || 0), 0);
        const shipping = parseFloat(shippingCosts[shopName]) || 0;
        const shopTotal = shopSubtotal + shipping;
        grandTotalEur += shopTotal;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'compare-shop-group';

        // ショップヘッダー
        groupDiv.innerHTML = `<div class="compare-shop-header"><span>${shopName}</span><span>${items.length}点</span></div>`;

        // アイテム一覧
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'compare-item';
            itemDiv.innerHTML = `
                <img src="${item.imageUrl || 'https://placehold.co/50x50/f3f4f6/9ca3af?text=No'}"
                     class="compare-item-thumb"
                     onerror="this.src='https://placehold.co/50x50/f3f4f6/9ca3af?text=No'">
                <div class="compare-item-info">
                    <div class="compare-item-name">${item.name}</div>
                    <div class="compare-item-price">€${item.priceExVat.toFixed(2)} ≒ ¥${Math.round(item.priceExVat * currentRate).toLocaleString()}</div>
                </div>
                <div class="compare-item-actions">
                    <a href="${item.pageUrl}" target="_blank" rel="noopener noreferrer" title="本サイトで見る">↗</a>
                    <button onclick="removeFromList('${item.uniqueId}')" title="削除">×</button>
                </div>
            `;
            groupDiv.appendChild(itemDiv);
        });

        // 送料・小計
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'compare-shop-summary';
        summaryDiv.innerHTML = `
            <div>
                小計: €${shopSubtotal.toFixed(2)} + 送料: €<input type="number" class="shipping-input" value="${shipping}" onchange="updateShipping('${shopName}', this.value)" step="0.01" min="0">
            </div>
            <div style="font-weight:700;">
                €${shopTotal.toFixed(2)} ≒ ¥${Math.round(shopTotal * currentRate).toLocaleString()}
            </div>
        `;
        groupDiv.appendChild(summaryDiv);

        container.appendChild(groupDiv);
    });

    // 総合計
    const grandTotalDiv = document.createElement('div');
    grandTotalDiv.className = 'compare-grand-total';
    grandTotalDiv.innerHTML = `
        <span>総合計</span>
        <span>€${grandTotalEur.toFixed(2)} ≒ ¥${Math.round(grandTotalEur * currentRate).toLocaleString()}</span>
    `;
    container.appendChild(grandTotalDiv);

    // ヘッダーの総合計も更新
    totalEurEl.innerText = `€${grandTotalEur.toFixed(2)}`;
    totalJpyEl.innerText = `¥${Math.round(grandTotalEur * currentRate).toLocaleString()}`;
}

// 送料更新
function updateShipping(shopName, val) {
    shippingCosts[shopName] = parseFloat(val) || 0;
    saveList();
    renderCompareList();
}

// リストから削除
function removeFromList(uniqueId) {
    const index = compareList.findIndex(item => item.uniqueId == uniqueId);
    if (index >= 0) {
        compareList.splice(index, 1);
        saveList();
        renderCompareList();
        updateCardButtons();
    }
}

// リストクリア
function clearList() {
    if (confirm("リストを空にしますか？")) {
        compareList = [];
        shippingCosts = {};
        saveList();
        renderCompareList();
        updateCardButtons();
    }
}

// 手動追加フォーム
function showManualAddForm() {
    const name = prompt("商品名:");
    if (!name) return;
    const shop = prompt("ショップ名:", "Manual");
    const price = prompt("価格(€ 税抜き):", "0");

    compareList.push({
        uniqueId: Date.now(),
        partId: "manual_" + Date.now(),
        name: name,
        shop: shop || "Manual",
        priceExVat: parseFloat(price) || 0,
        pageUrl: "#",
        imageUrl: ""
    });

    saveList();
    renderCompareList();
}

// ローカルストレージ保存/読込
function saveList() {
    localStorage.setItem('fiat500_compare_list', JSON.stringify(compareList));
    localStorage.setItem('fiat500_shipping_costs', JSON.stringify(shippingCosts));
}

function loadListFromStorage() {
    const list = localStorage.getItem('fiat500_compare_list');
    if (list) {
        try {
            compareList = JSON.parse(list);
        } catch (e) {
            compareList = [];
        }
    }

    const ship = localStorage.getItem('fiat500_shipping_costs');
    if (ship) {
        try {
            shippingCosts = JSON.parse(ship);
        } catch (e) {
            shippingCosts = {};
        }
    }

    renderCompareList();
}

// トレイ開閉（デフォルトは開いた状態、クリックで閉じる）
function toggleTray(forceOpen = false) {
    const tray = document.getElementById('comparison-tray');

    if (forceOpen) {
        tray.classList.remove('collapsed');
        document.body.classList.remove('tray-collapsed');
    } else {
        tray.classList.toggle('collapsed');
        document.body.classList.toggle('tray-collapsed');
    }
}

// HTMLエスケープ
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

// ===== 全画面モーダル機能 =====

function openCompareModal() {
    const modal = document.getElementById('compare-modal');
    modal.classList.add('open');
    renderModalCompareList();
    renderOptimizationSection();
    renderSavedLists();
    document.body.style.overflow = 'hidden'; // 背景スクロール防止
}

function closeCompareModal() {
    const modal = document.getElementById('compare-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

// モーダル内の比較リスト表示
function renderModalCompareList() {
    const container = document.getElementById('modal-compare-content');
    const totalEurEl = document.getElementById('modal-total-eur');
    const totalJpyEl = document.getElementById('modal-total-jpy');

    container.innerHTML = "";

    if (compareList.length === 0) {
        container.innerHTML = '<p style="color:#6b7280; text-align:center; padding:40px;">リストは空です。</p>';
        totalEurEl.innerText = '€0';
        totalJpyEl.innerText = '¥0';
        return;
    }

    // ショップごとにグループ化
    const grouped = {};
    compareList.forEach(item => {
        if (!grouped[item.shop]) grouped[item.shop] = [];
        grouped[item.shop].push(item);
    });

    let grandTotalEur = 0;

    Object.keys(grouped).forEach(shopName => {
        const items = grouped[shopName];
        let shopSubtotal = items.reduce((sum, item) => sum + (item.priceExVat || 0), 0);
        const shipping = parseFloat(shippingCosts[shopName]) || 0;
        const shopTotal = shopSubtotal + shipping;
        grandTotalEur += shopTotal;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'compare-shop-group';

        groupDiv.innerHTML = `<div class="compare-shop-header"><span>${shopName}</span><span>${items.length}点</span></div>`;

        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'compare-item';
            itemDiv.innerHTML = `
                <img src="${item.imageUrl || 'https://placehold.co/50x50/f3f4f6/9ca3af?text=No'}"
                     class="compare-item-thumb"
                     onerror="this.src='https://placehold.co/50x50/f3f4f6/9ca3af?text=No'">
                <div class="compare-item-info">
                    <div class="compare-item-name">${item.name}</div>
                    <div class="compare-item-price">€${item.priceExVat.toFixed(2)} ≒ ¥${Math.round(item.priceExVat * currentRate).toLocaleString()}</div>
                </div>
                <div class="compare-item-actions">
                    <a href="${item.pageUrl}" target="_blank" rel="noopener noreferrer" title="本サイトで見る">↗</a>
                    <button onclick="removeFromListModal('${item.uniqueId}')" title="削除">×</button>
                </div>
            `;
            groupDiv.appendChild(itemDiv);
        });

        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'compare-shop-summary';
        summaryDiv.innerHTML = `
            <div>
                小計: €${shopSubtotal.toFixed(2)} + 送料: €<input type="number" class="shipping-input" value="${shipping}" onchange="updateShippingModal('${shopName}', this.value)" step="0.01" min="0">
            </div>
            <div style="font-weight:700;">
                €${shopTotal.toFixed(2)} ≒ ¥${Math.round(shopTotal * currentRate).toLocaleString()}
            </div>
        `;
        groupDiv.appendChild(summaryDiv);

        container.appendChild(groupDiv);
    });

    const grandTotalDiv = document.createElement('div');
    grandTotalDiv.className = 'compare-grand-total';
    grandTotalDiv.innerHTML = `
        <span>総合計</span>
        <span>€${grandTotalEur.toFixed(2)} ≒ ¥${Math.round(grandTotalEur * currentRate).toLocaleString()}</span>
    `;
    container.appendChild(grandTotalDiv);

    totalEurEl.innerText = `€${grandTotalEur.toFixed(2)}`;
    totalJpyEl.innerText = `¥${Math.round(grandTotalEur * currentRate).toLocaleString()}`;
}

// モーダル用の削除・送料更新
function removeFromListModal(uniqueId) {
    removeFromList(uniqueId);
    renderModalCompareList();
    renderOptimizationSection();
}

function updateShippingModal(shopName, val) {
    updateShipping(shopName, val);
    renderModalCompareList();
    renderOptimizationSection();
}

// ===== リスト保存/読み込み機能 =====

const SAVED_LISTS_KEY = 'fiat500_saved_lists';

function getSavedLists() {
    const data = localStorage.getItem(SAVED_LISTS_KEY);
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveListWithName() {
    const nameInput = document.getElementById('save-list-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert('リスト名を入力してください。');
        return;
    }

    if (compareList.length === 0) {
        alert('保存するアイテムがありません。');
        return;
    }

    const savedLists = getSavedLists();

    // 同名のリストがある場合は上書き確認
    if (savedLists[name]) {
        if (!confirm(`「${name}」は既に存在します。上書きしますか？`)) {
            return;
        }
    }

    savedLists[name] = {
        items: compareList,
        shipping: shippingCosts,
        savedAt: new Date().toISOString()
    };

    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
    nameInput.value = '';
    renderSavedLists();
    alert(`「${name}」を保存しました。`);
}

async function loadSavedList(name) {
    const savedLists = getSavedLists();
    const saved = savedLists[name];

    if (!saved) {
        alert('リストが見つかりません。');
        return;
    }

    if (compareList.length > 0) {
        if (!confirm('現在のリストを上書きしますか？')) {
            return;
        }
    }

    const savedItems = saved.items || [];
    shippingCosts = saved.shipping || {};

    // DBから最新の価格情報を取得
    const partIds = savedItems.filter(item => !item.partId.startsWith('manual_')).map(item => item.partId);

    if (partIds.length > 0) {
        try {
            const { data, error } = await window.supabaseClient
                .from('parts')
                .select('*')
                .in('id', partIds);

            if (!error && data) {
                // 最新価格で更新
                const priceMap = {};
                data.forEach(part => {
                    const rawPrice = parseFloat(part.price_euro);
                    const priceExVat = getPriceExVat(rawPrice, part.shop_name);
                    priceMap[part.id] = {
                        priceExVat: priceExVat,
                        pageUrl: part.page_url,
                        imageUrl: part.image_url,
                        name: part.name_jp && !/nan/i.test(part.name_jp) ? part.name_jp : (part.name_en || "No Title")
                    };
                });

                // 保存されたアイテムを最新情報で更新
                compareList = savedItems.map(item => {
                    if (item.partId.startsWith('manual_')) {
                        return item; // 手動追加はそのまま
                    }
                    const updated = priceMap[item.partId];
                    if (updated) {
                        return {
                            ...item,
                            priceExVat: updated.priceExVat,
                            pageUrl: updated.pageUrl || item.pageUrl,
                            name: updated.name || item.name
                        };
                    }
                    return item; // 見つからない場合は保存時のまま
                });
            } else {
                compareList = savedItems;
            }
        } catch (e) {
            console.error('Failed to refresh prices:', e);
            compareList = savedItems;
        }
    } else {
        compareList = savedItems;
    }

    saveList();
    renderCompareList();
    renderModalCompareList();
    renderOptimizationSection();
    updateCardButtons();
    alert(`「${name}」を読み込みました（価格は最新情報に更新済み）。`);
}

function deleteSavedList(name) {
    if (!confirm(`「${name}」を削除しますか？`)) {
        return;
    }

    const savedLists = getSavedLists();
    delete savedLists[name];
    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
    renderSavedLists();
}

function renderSavedLists() {
    const container = document.getElementById('saved-lists-area');
    if (!container) return;

    const savedLists = getSavedLists();
    const names = Object.keys(savedLists);

    if (names.length === 0) {
        container.innerHTML = '<span style="color:#9ca3af; font-size:0.85rem;">保存されたリストはありません</span>';
        return;
    }

    container.innerHTML = '';
    names.forEach(name => {
        const saved = savedLists[name];
        const itemCount = saved.items ? saved.items.length : 0;
        const savedDate = saved.savedAt ? new Date(saved.savedAt).toLocaleDateString('ja-JP') : '';

        const itemDiv = document.createElement('div');
        itemDiv.className = 'saved-list-item';
        itemDiv.innerHTML = `
            <span><strong>${escapeHtml(name)}</strong> (${itemCount}点) <span style="color:#9ca3af; font-size:0.75rem;">${savedDate}</span></span>
            <button class="load-btn" onclick="loadSavedList('${escapeHtml(name)}')">読込</button>
            <button class="delete-saved-btn" onclick="deleteSavedList('${escapeHtml(name)}')">削除</button>
        `;
        container.appendChild(itemDiv);
    });
}

// === まとめ買い最適化分析 ===

function renderOptimizationSection() {
    const section = document.getElementById('optimization-section');
    if (!section) return;

    // リストが2つ以上のショップを含む場合のみ表示
    const shops = [...new Set(compareList.map(item => item.shop))];
    if (shops.length < 2 || compareList.length < 2) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // 各ショップごとの分析
    const shopAnalysis = {};
    shops.forEach(shopName => {
        const items = compareList.filter(item => item.shop === shopName);
        const subtotal = items.reduce((sum, item) => sum + (item.priceExVat || 0), 0);
        const shipping = parseFloat(shippingCosts[shopName]) || 0;

        shopAnalysis[shopName] = {
            items: items,
            subtotal: subtotal,
            shipping: shipping,
            total: subtotal + shipping
        };
    });

    // 最安ショップを特定（送料込み）
    let bestShop = null;
    let bestTotal = Infinity;
    Object.keys(shopAnalysis).forEach(shop => {
        if (shopAnalysis[shop].total < bestTotal) {
            bestTotal = shopAnalysis[shop].total;
            bestShop = shop;
        }
    });

    // 全体の現在の合計
    const currentTotal = Object.values(shopAnalysis).reduce((sum, a) => sum + a.total, 0);

    // OEM番号で同一部品をグループ化して代替を探す
    const alternatives = findAlternatives();

    // レンダリング
    let html = `
        <h4>まとめ買い最適化</h4>
        <div class="optimization-summary">
    `;

    // ショップごとのカード
    Object.keys(shopAnalysis).sort((a, b) => shopAnalysis[a].total - shopAnalysis[b].total).forEach(shopName => {
        const analysis = shopAnalysis[shopName];
        const isBest = shopName === bestShop;
        const itemsList = analysis.items.map(i => i.name.substring(0, 20)).join(', ');

        html += `
            <div class="optimization-card ${isBest ? 'best' : ''}">
                <div class="shop-name">
                    ${shopName}
                    ${isBest ? '<span class="best-badge">最安</span>' : ''}
                </div>
                <div class="items-count">${analysis.items.length}点</div>
                <div class="items-list" title="${escapeHtml(itemsList)}">${escapeHtml(itemsList)}</div>
                <div class="price-total">
                    €${analysis.total.toFixed(2)}
                    <span class="jpy">≒ ¥${Math.round(analysis.total * currentRate).toLocaleString()}</span>
                </div>
                <div class="shipping-note">
                    商品: €${analysis.subtotal.toFixed(2)} + 送料: €${analysis.shipping.toFixed(2)}
                </div>
            </div>
        `;
    });

    html += `</div>`;

    // 代替提案
    if (alternatives.length > 0) {
        html += `
            <div class="optimization-tip">
                <strong>同一部品の代替案</strong>
                ${alternatives.map(alt => `
                    <div style="margin-top:8px;">
                        「${escapeHtml(alt.partName)}」を <strong>${alt.currentShop}</strong> (€${alt.currentPrice.toFixed(2)}) から
                        <strong>${alt.altShop}</strong> (€${alt.altPrice.toFixed(2)}) に変更すると
                        <strong style="color:#059669;">€${(alt.currentPrice - alt.altPrice).toFixed(2)} 節約</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 送料未設定の警告
    const shopsWithoutShipping = shops.filter(s => !shippingCosts[s] || shippingCosts[s] === 0);
    if (shopsWithoutShipping.length > 0) {
        html += `
            <div style="margin-top:12px; font-size:0.85rem; color:#6b7280;">
                ※ ${shopsWithoutShipping.join('、')} の送料が未設定です。正確な比較のため各店舗の送料を入力してください。
            </div>
        `;
    }

    section.innerHTML = html;
}

// 同一OEMの代替部品を探す
function findAlternatives() {
    const alternatives = [];

    // 現在リストにある部品のOEM番号を収集
    const listOems = {};
    compareList.forEach(item => {
        // partIdからDBの部品情報を探す
        const part = lastSearchResults.find(p => p.id === item.partId);
        if (part && part.oem_no) {
            const normalized = normalizeOemNumber(part.oem_no);
            if (normalized) {
                listOems[normalized] = {
                    item: item,
                    part: part
                };
            }
        }
    });

    // 検索結果から同一OEMでより安い代替を探す
    Object.keys(listOems).forEach(oemKey => {
        const current = listOems[oemKey];
        const currentPriceExVat = current.item.priceExVat;

        lastSearchResults.forEach(part => {
            if (part.id === current.item.partId) return; // 同じ部品はスキップ
            if (compareList.some(i => i.partId === part.id)) return; // 既にリストにある

            const partOem = normalizeOemNumber(part.oem_no);
            if (partOem !== oemKey) return;

            const altPriceExVat = getPriceExVat(parseFloat(part.price_euro) || 0, part.shop_name);

            // より安い場合のみ提案
            if (altPriceExVat < currentPriceExVat) {
                alternatives.push({
                    partName: current.item.name,
                    currentShop: current.item.shop,
                    currentPrice: currentPriceExVat,
                    altShop: part.shop_name,
                    altPrice: altPriceExVat,
                    savings: currentPriceExVat - altPriceExVat
                });
            }
        });
    });

    // 節約額が大きい順にソート
    alternatives.sort((a, b) => b.savings - a.savings);

    // 上位3件まで
    return alternatives.slice(0, 3);
}

// Escキーでモーダルを閉じる
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('compare-modal');
        if (modal && modal.classList.contains('open')) {
            closeCompareModal();
        }
    }
});

// モーダル背景クリックで閉じる
document.addEventListener('click', (e) => {
    const modal = document.getElementById('compare-modal');
    if (e.target === modal) {
        closeCompareModal();
    }
});
