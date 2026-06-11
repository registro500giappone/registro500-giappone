"""
py/ の健全性チェックスクリプト（ネットワークアクセスなし）

実行内容:
1. py/ 配下の全Pythonファイルの構文チェック（compileall）
2. .github/workflows/*.yml が参照する py/*.py の存在チェック
3. run_all.py の crawlers リストに記載されたスクリプトの存在チェック

使用方法:
    python py/check_all.py   （リポジトリルートから）
    python check_all.py      （py/ から）

終了コード: 0=全チェック成功 / 1=いずれか失敗
"""

import compileall
import os
import re
import sys

PY_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(PY_DIR)
WORKFLOWS_DIR = os.path.join(REPO_ROOT, ".github", "workflows")


def check_syntax():
    """py/ 配下（archive/ 含む）の全 .py を構文チェック"""
    print("=== 1. 構文チェック (compileall) ===")
    ok = compileall.compile_dir(PY_DIR, quiet=1, force=False)
    print("OK" if ok else "NG: 構文エラーあり（上記出力参照）")
    return bool(ok)


def check_workflow_refs():
    """workflows が参照する py/*.py が存在するか"""
    print("\n=== 2. GitHub Actions 参照スクリプトの存在チェック ===")
    if not os.path.isdir(WORKFLOWS_DIR):
        print(f"NG: workflows ディレクトリが見つかりません: {WORKFLOWS_DIR}")
        return False
    pattern = re.compile(r"py/([A-Za-z0-9_]+\.py)")
    ok = True
    for fname in sorted(os.listdir(WORKFLOWS_DIR)):
        if not fname.endswith((".yml", ".yaml")):
            continue
        path = os.path.join(WORKFLOWS_DIR, fname)
        with open(path, encoding="utf-8") as f:
            scripts = sorted(set(pattern.findall(f.read())))
        for script in scripts:
            exists = os.path.isfile(os.path.join(PY_DIR, script))
            mark = "OK" if exists else "NG"
            print(f"  [{mark}] {fname} -> py/{script}")
            ok = ok and exists
    return ok


def check_run_all_crawlers():
    """run_all.py の crawlers リストのスクリプトが存在するか"""
    print("\n=== 3. run_all.py crawlers リストの存在チェック ===")
    run_all_path = os.path.join(PY_DIR, "run_all.py")
    if not os.path.isfile(run_all_path):
        print("NG: run_all.py が見つかりません")
        return False
    with open(run_all_path, encoding="utf-8") as f:
        src = f.read()
    # ("xxx.py", "Shop Name") 形式のタプルを抽出
    scripts = re.findall(r'\(\s*"([A-Za-z0-9_]+\.py)"\s*,', src)
    if not scripts:
        print("NG: crawlers リストを検出できませんでした")
        return False
    ok = True
    for script in scripts:
        exists = os.path.isfile(os.path.join(PY_DIR, script))
        mark = "OK" if exists else "NG"
        print(f"  [{mark}] py/{script}")
        ok = ok and exists
    return ok


def main():
    results = [check_syntax(), check_workflow_refs(), check_run_all_crawlers()]
    print("\n=== 結果 ===")
    if all(results):
        print("全チェック成功")
        return 0
    print("失敗あり（上記 NG を確認してください）")
    return 1


if __name__ == "__main__":
    sys.exit(main())
