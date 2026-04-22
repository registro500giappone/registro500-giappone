"""
ChromeDriverのキャッシュパスを直接指定して起動するラッパー。
webdriver_managerのダウンロード処理をスキップし、ファイルロック競合を回避する。
使い方: python run_with_cache.py euro_search
        python run_with_cache.py dangelo_recon
"""
import sys
import os

CHROMEDRIVER_PATH = r"C:\Users\akayu\.wdm\drivers\chromedriver\win64\144.0.7559.133\chromedriver.exe"

# webdriver_managerをモンキーパッチ（ダウンロードをスキップ）
try:
    import webdriver_manager.chrome as wdm_chrome
    wdm_chrome.ChromeDriverManager.install = lambda self: CHROMEDRIVER_PATH
except Exception as e:
    print(f"[WARN] パッチ失敗: {e}")

# 対象スクリプトを実行
if len(sys.argv) < 2:
    print("使い方: python run_with_cache.py <スクリプト名（.py不要）>")
    sys.exit(1)

target = sys.argv[1]
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

if target == "euro_search":
    import euro_search
    euro_search.main()
elif target == "dangelo_recon":
    import dangelo_recon
    dangelo_recon.main()
elif target == "passione_recon":
    import passione_recon
    passione_recon.main()
else:
    print(f"未対応のスクリプト: {target}")
    sys.exit(1)
