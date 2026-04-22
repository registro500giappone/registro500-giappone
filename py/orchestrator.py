"""
orchestrator.py
Seleniumクローラー完了を監視 → Shopify → AI翻訳 まで自動実行（2026/02/21）

使い方:
  python orchestrator.py [pid1 pid2 ...]
"""
import sys
import os
import time
import subprocess
from datetime import datetime

script_dir = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(os.path.expanduser('~'), 'Desktop', 'orchestrator.log')


def log(msg):
    ts = datetime.now().strftime('%H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')


def is_pid_alive(pid):
    try:
        result = subprocess.run(
            ['wmic', 'process', 'where', f'ProcessId={pid}', 'get', 'ProcessId'],
            capture_output=True, text=True, timeout=10
        )
        return str(pid) in result.stdout
    except:
        return False


def wait_for_pids(pids, check_interval=30):
    log(f"監視対象PID: {pids}")
    remaining = list(pids)
    while remaining:
        done = [p for p in remaining if not is_pid_alive(p)]
        for p in done:
            log(f"  PID {p} 完了")
        remaining = [p for p in remaining if p not in done]
        if remaining:
            log(f"  残り稼働中: {remaining} ({len(remaining)}プロセス) → {check_interval}秒後に再確認")
            time.sleep(check_interval)
    log("全Seleniumクローラー完了！")


def run_shopify():
    log("="*50)
    log("Shopify API クロール開始（AutoBella / Ricambio / MrFiat）")
    log("="*50)
    shopify_log = open(os.path.join(os.path.expanduser('~'), 'Desktop', 'shopify_stage.log'), 'w', encoding='utf-8')
    result = subprocess.run(
        [sys.executable, '-u', os.path.join(script_dir, 'run_all_v2.py'), 'shopify'],
        stdout=shopify_log, stderr=shopify_log,
        cwd=script_dir
    )
    shopify_log.close()
    if result.returncode == 0:
        log("Shopify クロール 完了 [OK]")
    else:
        log(f"Shopify クロール 終了コード: {result.returncode} [NG]")


def run_ai():
    log("="*50)
    log("AI翻訳開始（ai_marathon_final_v9.py）")
    log("="*50)
    ai_log = open(os.path.join(os.path.expanduser('~'), 'Desktop', 'ai_translation.log'), 'w', encoding='utf-8')
    result = subprocess.run(
        [sys.executable, '-u', os.path.join(script_dir, 'ai_marathon_final_v9.py')],
        stdout=ai_log, stderr=ai_log,
        cwd=script_dir
    )
    ai_log.close()
    if result.returncode == 0:
        log("AI翻訳 完了 [OK]")
    else:
        log(f"AI翻訳 終了コード: {result.returncode} [NG]")


def main():
    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f"orchestrator.py 開始: {datetime.now()}\n")

    # 引数でPIDリストを受け取る
    if len(sys.argv) > 1:
        pids = [int(p) for p in sys.argv[1:]]
    else:
        pids = []

    start = time.time()
    log(f"オーケストレーター開始")

    # Step 1: Seleniumクローラー完了待ち
    if pids:
        wait_for_pids(pids)
    else:
        log("PID指定なし → Step 1スキップ")

    # Step 2: Shopify API
    run_shopify()

    # Step 3: AI翻訳
    run_ai()

    # 完了レポート
    elapsed = time.time() - start
    h = int(elapsed // 3600)
    m = int((elapsed % 3600) // 60)
    log("="*50)
    log(f"全工程完了！ 所要時間: {h}時間{m}分")
    log("="*50)
    log("Desktop の orchestrator.log / shopify_stage.log / ai_translation.log を確認してください")


if __name__ == '__main__':
    main()
