"""
wiring/index.html を外部依存ゼロの単一HTMLファイルへバンドルする(Artifact配布用)。

Artifactの実行環境はCSPで外部ネットワーク通信不可のため、GLBモデルと配線DB(f.json)を
base64/JSONとしてスクリプト内に埋め込む。three.js/OrbitControls/GLTFLoaderは
esbuild(--bundle --format=iife)で通常の非モジュールスクリプト1本に事前バンドルする。

なぜESモジュール+importmap(data: URL)方式をやめたか:
iOS Safari実機で「エラーは出ないが読み込みが永久に完了しない」症状が発生した。
data: URLをESモジュールとしてimportmapで解決する手法はWebKit実機での挙動が不安定な
ため、ブラウザ間で長年実績のある「classicスクリプト1本」方式に切り替えた。

使い方:
  python build_bundle.py <output.html> [--artifact]
"""
import argparse
import base64
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # wiring/
LIB = ROOT / 'lib'

MODULE_SCRIPT_OPEN = '<script type="module">\n'
MODULE_SCRIPT_CLOSE = '\n</script>'
IMPORTMAP_BLOCK = '''<script type="importmap">
{ "imports": { "three": "./lib/three.module.min.js" } }
</script>
'''


def safe(s):
    # HTMLパーサーが埋め込み文字列中の "</script" を終了タグと誤認しないようにする
    return s.replace('</', '<\\/')


def esbuild_bundle(entry_path):
    proc = subprocess.run(
        ['npx', '--yes', 'esbuild', str(entry_path), '--bundle', '--format=iife',
         f'--alias:three={LIB / "three.module.min.js"}'],
        cwd=str(ROOT), capture_output=True, encoding='utf-8', shell=True,
    )
    if proc.returncode != 0:
        raise SystemExit(f'esbuildによるバンドルに失敗しました:\n{proc.stderr}')
    return proc.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', help='出力先HTMLファイルパス')
    parser.add_argument('--artifact', action='store_true',
                         help='Artifact公開用に<!DOCTYPE>/<html>/<head>/<body>タグを除去する')
    args = parser.parse_args()

    index_html = (ROOT / 'index.html').read_text(encoding='utf-8')

    if IMPORTMAP_BLOCK not in index_html:
        raise SystemExit('importmapブロックが見つかりません。index.htmlの構造が変わっていないか確認してください。')
    if MODULE_SCRIPT_OPEN not in index_html or MODULE_SCRIPT_CLOSE not in index_html:
        raise SystemExit('モジュールスクリプトブロックが見つかりません。index.htmlの構造が変わっていないか確認してください。')

    before_importmap, rest = index_html.split(IMPORTMAP_BLOCK, 1)
    _, rest = rest.split(MODULE_SCRIPT_OPEN, 1)
    module_src, after_module = rest.split(MODULE_SCRIPT_CLOSE, 1)

    # GLBをdataB64として埋め込み(既存コードはdataB64があればurlより優先して使う)
    f_glb_b64 = base64.b64encode((ROOT / 'assets' / 'body_f_v2.glb').read_bytes()).decode('ascii')
    l_glb_b64 = base64.b64encode((ROOT / 'assets' / 'body_l_v2.glb').read_bytes()).decode('ascii')
    marker_f = "url: './assets/body_f_v2.glb',"
    marker_l = "url: './assets/body_l_v2.glb',"
    if marker_f not in module_src or marker_l not in module_src:
        raise SystemExit('MODEL_INFOのurl指定が見つかりません。index.htmlの構造が変わっていないか確認してください。')
    module_src = module_src.replace(marker_f, f"{marker_f} dataB64: '{f_glb_b64}',")
    module_src = module_src.replace(marker_l, f"{marker_l} dataB64: '{l_glb_b64}',")

    # 機械系ユニットGLB群(engine/drivetrain/front_parts/dashboard/lamps)は
    # 品質不足のため2026-07-11に全削除(EXTRA_GLBS=[])。埋め込み対象なし。

    # data/f.json の fetch をインライン埋め込みに置き換え
    f_json = json.loads((ROOT / 'data' / 'f.json').read_text(encoding='utf-8'))
    f_json_str = json.dumps(f_json, ensure_ascii=False)
    old_fetch = "fetch('./data/f.json', { cache: 'no-cache' }).then(r => r.json()).then((data) => {"
    if old_fetch not in module_src:
        raise SystemExit('f.jsonのfetch呼び出しが見つかりません。index.htmlの構造が変わっていないか確認してください。')
    module_src = module_src.replace(old_fetch, f"Promise.resolve({f_json_str}).then((data) => {{")

    # 上記で埋め込んだGLB/JSONを含んだ状態のスクリプトをesbuildでバンドルする
    # (先に埋め込んでからバンドルすることで、esbuildの出力整形に依存する文字列置換を避ける)
    entry_path = ROOT / '_bundle_entry.tmp.js'
    entry_path.write_text(module_src, encoding='utf-8')
    try:
        bundled_js = esbuild_bundle(entry_path)
    finally:
        entry_path.unlink(missing_ok=True)

    new_script = f'<script>\n{safe(bundled_js)}\n</script>'
    index_html = before_importmap + new_script + after_module

    if args.artifact:
        # Artifactツールは<!DOCTYPE>/<html>/<head>/<body>タグを自前で付与するため、
        # index.htmlの外殻タグを除去してtitle/style/bodyの中身だけを渡す。
        old_head_open = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n'
        old_head_close = '</head>\n<body>\n'
        old_tail = '</body>\n</html>'
        for marker in (old_head_open, old_head_close, old_tail):
            if marker not in index_html:
                raise SystemExit(f'Artifact用の外殻タグ除去に失敗: 見つからない箇所 -> {marker!r}')
        index_html = index_html.replace(old_head_open, '')
        index_html = index_html.replace(old_head_close, '')
        index_html = index_html.replace(old_tail, '')

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(index_html, encoding='utf-8')
    print(f'バンドル出力: {out_path} ({out_path.stat().st_size / 1024 / 1024:.1f} MB)')


if __name__ == '__main__':
    main()
