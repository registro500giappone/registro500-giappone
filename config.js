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
const SUPABASE_URL = "https://ttlttclfovuzafvghvaq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_YMQjADUCrD6BytxvcMm-lQ_7n8LMEAt";

// アプリ全体の計算・リンク設定
const CONFIG = {
    // 1. 為替レート設定（無料API）
    currency_api: "https://open.er-api.com/v6/latest/EUR",
    default_rate: 165, // APIエラー時の予備レート

    // 2. ショップごとのVAT（税）ルール定義
    // is_price_ex_vat: DB価格が税抜きかどうか
    // vat_rate: VAT率（税込み店舗の場合に税抜き計算で使用）
    shops: {
        "FD Ricambi": {
            is_price_ex_vat: true,   // 税抜き価格
            vat_rate: 0,
            base_url: "https://fdricambi.com"
        },
        "Axel Gerstl": {
            is_price_ex_vat: false,  // 税込み価格
            vat_rate: 0.19,          // ドイツVAT 19%
            base_url: "https://webshop.fiat500126.com"
        },
        "EuroItalia500": {
            is_price_ex_vat: false,  // 税込み価格
            vat_rate: 0.22,          // イタリアVAT 22%
            base_url: "https://euroitalia500-commerce.it"
        },
        "Passione 500": {
            is_price_ex_vat: false,  // 税込み価格
            vat_rate: 0.22,          // イタリアVAT 22%
            base_url: "https://passione500.it"
        },
        "D'Angelo Motori": {
            is_price_ex_vat: true,   // 税抜き価格
            vat_rate: 0,
            base_url: "https://www.dangelomotori.it"
        }
    }
};
