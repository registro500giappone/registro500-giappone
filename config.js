// ============================================================
// Registro500 Giappone - 共通設定ファイル
// ============================================================

// GAS API URL (Backend)
const API_URL = "https://script.google.com/macros/s/AKfycbz0BJpaG-AcK3T6YYtav-nfd3gqGlkEWu3AvpW5uRT52N9jW8pBKLrpLSqvXqyD2ghwCA/exec";

// 画像設定
// 読み込みエラー時や画像なしの場合のプレースホルダー (Placehold.co)
const NO_IMAGE_URL = 'https://placehold.co/600x600/f3f4f6/9ca3af?text=No+Image';

// ロゴ画像URL
const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/registro500giappone-93f98.firebasestorage.app/o/assets%2Flogo_horizontal.png?alt=media&token=efab9298-5cbb-4dff-b6b8-aa4ab5863bbf";

// Firebase 設定 (edit.html用)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCNCNsu61S3DIQ2pcmK2Ic_vqCINlZB9nk",
  authDomain: "registro500giappone-93f98.firebaseapp.com",
  projectId: "registro500giappone-93f98",
  storageBucket: "registro500giappone-93f98.firebasestorage.app",
  messagingSenderId: "723005462978",
  appId: "1:723005462978:web:e967a16a278f54b278de5b",
  measurementId: "G-ZRBFX1V51B"
};
/* config.js の一番下に追記 */
const SUPABASE_URL = "https://ttlttclfovuzafvghvaq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt";

// ▼▼▼ ここから下を追加 ▼▼▼

// アプリ全体の計算・リンク設定
const CONFIG = {
    // 1. 為替レート設定（無料API）
    currency_api: "https://open.er-api.com/v6/latest/EUR",
    default_rate: 165, // APIエラー時の予備レート

    // 2. ショップごとのVAT（税）ルール定義
    shops: {
        "FD Ricambi": {
            is_price_ex_vat: true,  // DB価格は税抜きか？→はい
            vat_rate: 0.21,         // 計算用（予備）
            show_vat_inc: false     // 画面にVAT込みを表示するか？→いいえ
        },
        "Axel Gerstl": {
            is_price_ex_vat: false, // DB価格は税抜きか？→いいえ（税込み）
            vat_rate: 0.19, 
            show_vat_inc: true      // 画面にVAT込みを表示するか？→はい
        }
    },

    // 3. 外部検索用URL（一括取得していないサイト）
    external_links: [
        {
            id: "euroitalia",
            name: "Euro Italia 500",
            url_pattern: "https://euroitalia500-commerce.it/ricerca?controller=search&orderby=position&orderway=desc&search_query="
        },
        {
            id: "passione",
            name: "Passione 500",
            url_pattern: "https://passione500.it/?s="
        },
        {
            id: "dangelo",
            name: "D'Angelo Motori",
            url_pattern: "https://www.dangelomotori.it/en/?s="
        }
    ]
};
