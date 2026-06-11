"""
Registro500 パーツデータ更新 統合スクリプト

このスクリプトは以下を自動実行します：
1. 全ショップのクローリング（9ショップ）- 並列実行
2. AI翻訳（Gemini API）
3. Supabase同期（現在は不要、各クローラーが直接同期）

使用方法:
    python run_all.py

実行時間: 約5-10時間（並列実行、最も遅いショップの時間）
"""

import subprocess
import time
import sys
import os
import signal
import atexit
from datetime import datetime
# 並列実行用（subprocess使用）

# グローバルなプロセス管理（孤児プロセス防止）
_active_processes = {}

def cleanup_processes():
    """全子プロセスを終了させるクリーンアップ関数"""
    if _active_processes:
        print_warning(f"\n子プロセス {len(_active_processes)} 件を終了中...")
        for shop_name, proc in list(_active_processes.items()):
            if proc.poll() is None:  # まだ実行中
                try:
                    proc.terminate()
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                except Exception:
                    pass
        _active_processes.clear()

atexit.register(cleanup_processes)

def _sigterm_handler(signum, frame):
    """SIGTERMハンドラ：子プロセスを終了してから自身も終了"""
    print_error("\nSIGTERMを受信しました。子プロセスを終了します...")
    cleanup_processes()
    sys.exit(128 + signal.SIGTERM)

signal.signal(signal.SIGTERM, _sigterm_handler)

# ログ出力用の装飾
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(message):
    """ヘッダー表示"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def print_success(message):
    """成功メッセージ"""
    print(f"{Colors.OKGREEN}[OK] {message}{Colors.ENDC}")

def print_error(message):
    """エラーメッセージ"""
    print(f"{Colors.FAIL}[ERROR] {message}{Colors.ENDC}")

def print_info(message):
    """情報メッセージ"""
    print(f"{Colors.OKCYAN}[INFO] {message}{Colors.ENDC}")

def print_warning(message):
    """警告メッセージ"""
    print(f"{Colors.WARNING}[WARN] {message}{Colors.ENDC}")

def run_script(script_name, description, timeout=1800):
    """
    Pythonスクリプトを実行

    Args:
        script_name: 実行するスクリプト名
        description: スクリプトの説明
        timeout: タイムアウト秒数（デフォルト30分）

    Returns:
        tuple: (description, success, elapsed_time)
    """
    start_time = time.time()

    try:
        # Pythonスクリプトを実行
        result = subprocess.run(
            [sys.executable, script_name],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            timeout=timeout,
            capture_output=True,  # 並列実行のため出力をキャプチャ
            text=True
        )

        elapsed_time = time.time() - start_time

        if result.returncode == 0:
            return (description, True, elapsed_time)
        else:
            return (description, False, elapsed_time)

    except subprocess.TimeoutExpired:
        elapsed_time = time.time() - start_time
        return (description, False, elapsed_time)
    except FileNotFoundError:
        return (description, False, 0)
    except Exception as e:
        elapsed_time = time.time() - start_time
        return (description, False, elapsed_time)

def main():
    """メイン処理"""
    print_header("Registro500 パーツデータ更新 開始")

    # ログディレクトリ準備
    script_dir = os.path.dirname(os.path.abspath(__file__))
    log_dir = os.path.join(script_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    run_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # サマリーログファイル
    summary_log_path = os.path.join(log_dir, f"run_all_{run_timestamp}.log")
    summary_log = open(summary_log_path, 'w', encoding='utf-8')

    def log(message):
        """コンソールとサマリーログ両方に出力"""
        print(message)
        summary_log.write(message + '\n')
        summary_log.flush()

    log(f"開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"サマリーログ: {summary_log_path}")

    overall_start = time.time()

    # 実行結果を記録
    results = {}
    log_paths = {}

    # =========================================
    # Step 1: 全ショップクローリング（並列実行）
    # =========================================
    log("\n" + "="*60)
    log("Step 1/2: 全ショップクローリング（並列実行）")
    log("="*60)

    crawlers = [
        ("axel_full_search.py", "Axel Gerstl"),
        ("parts_search_v2.py", "FD Ricambi"),
        ("dangelo_recon.py", "D'Angelo Motori"),
        ("euro_search.py", "EuroItalia500"),
        ("passione_recon.py", "Passione 500"),
        ("autobella_crawler.py", "AutoBella Parts"),
        ("ricambio_crawler.py", "Ricambio"),
        ("mrfiat_crawler.py", "Mr Fiat"),
        ("500line_crawler.py", "500Line")
    ]

    log(f"\n9ショップを並列で実行します...\n")

    # subprocess並列実行
    processes = {}
    start_times = {}
    log_handles = {}  # ショップ別ログファイルハンドル

    # 全クローラーを起動
    for script, shop_name in crawlers:
        # ショップ別ログファイル
        safe_name = shop_name.replace(' ', '_').replace("'", '')
        log_path = os.path.join(log_dir, f"{safe_name}_{run_timestamp}.log")
        log_paths[shop_name] = log_path
        log_handle = open(log_path, 'w', encoding='utf-8')
        log_handle.write(f"=== {shop_name} クローラーログ ===\n")
        log_handle.write(f"開始: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        log_handle.write(f"スクリプト: {script}\n\n")
        log_handle.flush()
        log_handles[shop_name] = log_handle

        start_times[shop_name] = time.time()
        proc = subprocess.Popen(
            [sys.executable, script],
            cwd=script_dir,
            stdout=log_handle,
            stderr=log_handle
        )
        processes[shop_name] = proc
        _active_processes[shop_name] = proc
        log(f"[INFO] {shop_name} 起動（PID: {proc.pid}） → ログ: logs/{safe_name}_{run_timestamp}.log")

    log(f"\n[INFO] 全ショップ起動完了。完了を待機中...\n")

    # 完了を待機
    while processes:
        for shop_name in list(processes.keys()):
            proc = processes[shop_name]
            retcode = proc.poll()

            if retcode is not None:  # 完了
                elapsed_time = time.time() - start_times[shop_name]
                del processes[shop_name]
                _active_processes.pop(shop_name, None)

                # ログファイルに終了情報を追記してクローズ
                handle = log_handles.pop(shop_name, None)
                if handle:
                    handle.write(f"\n=== 終了 ===\n")
                    handle.write(f"終了コード: {retcode}\n")
                    handle.write(f"実行時間: {elapsed_time/60:.1f}分\n")
                    handle.close()

                if retcode == 0:
                    results[shop_name] = True
                    log(f"[OK] {shop_name} 完了 ({elapsed_time/60:.1f}分)")
                else:
                    results[shop_name] = False
                    log(f"[ERROR] {shop_name} 失敗（終了コード: {retcode}、{elapsed_time/60:.1f}分）")
                    log(f"[WARN]  ログ確認: {log_paths[shop_name]}")

        if processes:
            time.sleep(5)

    # =========================================
    # Step 2: AI翻訳
    # =========================================
    log("\n" + "="*60)
    log("Step 2/2: AI翻訳（Gemini API）")
    log("="*60 + "\n")

    ai_log_path = os.path.join(log_dir, f"AI_translation_{run_timestamp}.log")
    log_paths["AI翻訳"] = ai_log_path

    ai_start = time.time()
    try:
        with open(ai_log_path, 'w', encoding='utf-8') as ai_log:
            ai_log.write(f"=== AI翻訳ログ ===\n開始: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            ai_proc = subprocess.run(
                [sys.executable, "ai_marathon_final_v9.py"],
                cwd=script_dir,
                stdout=ai_log,
                stderr=ai_log,
                timeout=3600
            )
            ai_elapsed = time.time() - ai_start
            ai_log.write(f"\n終了コード: {ai_proc.returncode}\n実行時間: {ai_elapsed/60:.1f}分\n")
            ai_success = ai_proc.returncode == 0
    except subprocess.TimeoutExpired:
        ai_elapsed = time.time() - ai_start
        ai_success = False
        log(f"[ERROR] AI翻訳 タイムアウト（{ai_elapsed/60:.1f}分）")
    except Exception as e:
        ai_elapsed = time.time() - ai_start
        ai_success = False
        log(f"[ERROR] AI翻訳 エラー: {e}")

    results["AI翻訳"] = ai_success
    if ai_success:
        log(f"[OK] AI翻訳 完了 ({ai_elapsed/60:.1f}分)")
    else:
        log(f"[ERROR] AI翻訳 失敗 → ログ確認: {ai_log_path}")

    # =========================================
    # 完了サマリー
    # =========================================
    overall_elapsed = time.time() - overall_start

    log("\n" + "="*60)
    log("実行結果サマリー")
    log("="*60)

    success_count = sum(1 for v in results.values() if v)
    total_count = len(results)

    log(f"\n総実行時間: {overall_elapsed/60:.1f}分\n")

    for task_name, success in results.items():
        status = "[OK] 成功" if success else "[FAIL] 失敗"
        log(f"  {status}  {task_name}")

    log(f"\n成功: {success_count}/{total_count}")

    if success_count < total_count:
        log(f"\n失敗したショップのログ:")
        for task_name, success in results.items():
            if not success:
                log(f"  → {log_paths.get(task_name, '不明')}")

    summary_log.close()
    log(f"\nサマリーログ保存: {summary_log_path}")

    if success_count == total_count:
        print_success("\n全タスクが正常に完了しました！")
        return 0
    else:
        print_warning(f"\n{total_count - success_count}個のタスクが失敗しました。上記ログを確認してください。")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print_error("\n\nユーザーによって中断されました。子プロセスを終了します...")
        cleanup_processes()
        sys.exit(130)
    except Exception as e:
        print_error(f"\n予期しないエラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
