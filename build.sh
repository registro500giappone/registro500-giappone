#!/bin/bash
# Cloudflare Pages ビルド時に実行されるスクリプト。
# sw.js 内の __BUILD_VERSION__ プレースホルダを、コミットハッシュ（8文字）に置換する。
# これにより、コミット毎に Service Worker が自動的に新バージョン扱いとなり、
# 旧バージョンのキャッシュが activate 時に確実に破棄される（更新は無音・バナーなし）。

set -e

# Cloudflare Pages が提供する環境変数からコミットSHAを取得
VERSION="${CF_PAGES_COMMIT_SHA:0:8}"

# ローカル実行時等でSHAが取れない場合は日時にフォールバック
if [ -z "$VERSION" ]; then
  VERSION="dev-$(date +%Y%m%d%H%M%S)"
fi

# sw.js のプレースホルダを実際のバージョン文字列に置換
sed -i "s|__BUILD_VERSION__|${VERSION}|g" sw.js

# 共通CSS/JS の参照にも同じバージョンを ?v= で付ける（2026-09-30 棚卸しで追加）。
# sw.js は自サイトの CSS/JS を StaleWhileRevalidate で返すので、URL が変わらないと
# デプロイ直後の初回表示が「新しいHTML＋古いCSS/JS」になる（旅手帳は手で ?v=<hash> を付けていた）。
# HTML は素のまま書き、ビルドで付与する。対象は style.css / fab-nav.js / rg-join-cta.js の3つだけ。
# 置換は「拡張子の直後が閉じ引用符」の参照にしか当たらないので、すでに ?v= 付きの参照は二重にならない。
find . -name '*.html' -not -path './.git/*' -print0 \
  | xargs -0 sed -i -E \
      -e "s|(href=\"[./]*style\.css)\"|\1?v=${VERSION}\"|g" \
      -e "s|(src=\"/?fab-nav\.js)\"|\1?v=${VERSION}\"|g" \
      -e "s|(src=\"/?rg-join-cta\.js)\"|\1?v=${VERSION}\"|g"

echo "==========================================="
echo "  CACHE_VERSION -> ${VERSION}"
echo "==========================================="
