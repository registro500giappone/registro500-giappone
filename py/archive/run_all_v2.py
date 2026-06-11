"""
run_all_v2.py
8ショップ全件クロール + AI翻訳を最短で完了させる司令塔（2026/02/21）

実行戦略:
  Stage 1: Shopify API 3サイト（AutoBella / Ricambio / MrFiat）→ 並列3プロセス
  Stage 2: Selenium 5サイト → 各ショップを並列分割でクロール
           - Passione 500: 4並列
           - FD Ricambi  : 3並列
           - EuroItalia500: 3並列（Phase1完了後）
           - D'Angelo Motori: 2並列（Phase1完了後）
           - Axel Gerstl : 2並列
  Stage 3: AI翻訳（ai_marathon_final_v9.py）

推定所要時間: 1〜1.5時間（従来 8〜16時間 → 約90%短縮）
"""
import subprocess
import sys
import os
import time
import multiprocessing
import atexit
import signal
from datetime import datetime

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

# 起動したサブプロセスを管理
_procs = []

def cleanup():
    for p in _procs:
        if isinstance(p, subprocess.Popen):
            try:
                p.terminate()
            except:
                pass
        elif isinstance(p, multiprocessing.Process):
            try:
                p.terminate()
            except:
                pass

atexit.register(cleanup)

def sig_handler(signum, frame):
    print("\n中断シグナルを受信。全プロセスを終了します...")
    cleanup()
    sys.exit(1)

try:
    signal.signal(signal.SIGTERM, sig_handler)
    signal.signal(signal.SIGINT, sig_handler)
except:
    pass


def run_shopify_stage():
    """Stage 1: Shopify API 3サイトを並列実行"""
    print("\n" + "="*60)
    print("Stage 1: Shopify API 3サイト（AutoBella / Ricambio / MrFiat）")
    print("="*60)

    scripts = ["autobella_crawler.py", "ricambio_crawler.py", "mrfiat_crawler.py"]
    procs = []
    for script in scripts:
        path = os.path.join(script_dir, script)
        if not os.path.exists(path):
            print(f"  [SKIP] {script} が見つかりません")
            continue
        log = open(os.path.join(script_dir, f"log_{script.replace('.py','')}.txt"), "w")
        p = subprocess.Popen(
            [sys.executable, "-u", path],
            stdout=log, stderr=log,
            cwd=script_dir
        )
        procs.append((p, script, log))
        _procs.append(p)
        print(f"  [起動] {script} (PID: {p.pid})")

    # 完了待ち
    for p, script, log in procs:
        p.wait()
        log.close()
        status = "[OK]" if p.returncode == 0 else f"[NG] 終了コード {p.returncode}"
        print(f"  {status}: {script}")

    print("Stage 1 完了\n")


def run_selenium_stage():
    """Stage 2: Selenium 5サイトを並列分割でクロール"""
    from run_parallel import run_parallel

    shops = ["passione", "fd", "axel", "euro", "dangelo"]

    for shop in shops:
        print(f"\n{'='*60}")
        print(f"Stage 2: {shop} クロール")
        print(f"{'='*60}")
        # 各ショップを別プロセスで実行（multiprocessingではなくsubprocess）
        run_parallel(shop)

    print("\nStage 2 完了\n")


def run_ai_translation():
    """Stage 3: AI翻訳"""
    print("\n" + "="*60)
    print("Stage 3: AI翻訳（ai_marathon_final_v9.py）")
    print("="*60)

    ai_script = os.path.join(script_dir, "ai_marathon_final_v9.py")
    if not os.path.exists(ai_script):
        print("  [SKIP] ai_marathon_final_v9.py が見つかりません")
        return

    result = subprocess.run(
        [sys.executable, "-u", ai_script],
        cwd=script_dir
    )
    status = "[OK]" if result.returncode == 0 else f"[NG] 終了コード {result.returncode}"
    print(f"AI翻訳 {status}\n")


def main():
    start = time.time()
    print("="*60)
    print("run_all_v2.py: 8ショップ最速クロール")
    print(f"開始: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    stages = sys.argv[1:] if len(sys.argv) > 1 else ["shopify", "selenium", "ai"]

    if "shopify" in stages:
        run_shopify_stage()

    if "selenium" in stages:
        run_selenium_stage()

    if "ai" in stages:
        run_ai_translation()

    elapsed = time.time() - start
    h = int(elapsed // 3600)
    m = int((elapsed % 3600) // 60)
    print(f"\n{'='*60}")
    print(f"全工程完了！ 所要時間: {h}時間{m}分")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
