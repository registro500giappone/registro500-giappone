#!/bin/bash
# Cloudflare Pages ビルド時に実行されるスクリプト。
# sw.js 内の __BUILD_VERSION__ プレースホルダを、コミットハッシュ（8文字）に置換する。
# これにより、コミット毎に Service Worker が自動的に新バージョン扱いとなり、
# 更新バナーが確実にユーザーへ表示される。

set -e

# Cloudflare Pages が提供する環境変数からコミットSHAを取得
VERSION="${CF_PAGES_COMMIT_SHA:0:8}"

# ローカル実行時等でSHAが取れない場合は日時にフォールバック
if [ -z "$VERSION" ]; then
  VERSION="dev-$(date +%Y%m%d%H%M%S)"
fi

# sw.js のプレースホルダを実際のバージョン文字列に置換
sed -i "s|__BUILD_VERSION__|${VERSION}|g" sw.js

echo "==========================================="
echo "  CACHE_VERSION -> ${VERSION}"
echo "==========================================="
