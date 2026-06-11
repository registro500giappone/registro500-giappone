"""
クローラー実行タイマー＆通知スクリプト

機能:
1. 実行時間の自動計測
2. 完了時にデスクトップに通知ファイル作成
3. ログファイル自動生成
4. Windowsトースト通知（オプション）

使い方:
    python run_with_notification.py axel_full_search.py
"""

import sys
import subprocess
import time
import os
from datetime import datetime, timedelta

def format_duration(seconds):
    """秒を時間:分:秒に変換"""
    return str(timedelta(seconds=int(seconds)))

def send_windows_notification(title, message):
    """Windowsトースト通知を送信（オプション）"""
    try:
        from win10toast import ToastNotifier
        toaster = ToastNotifier()
        toaster.show_toast(title, message, duration=10, threaded=True)
    except ImportError:
        # win10toastがインストールされていない場合はスキップ
        pass

def main():
    if len(sys.argv) < 2:
        print("使い方: python run_with_notification.py <スクリプト名>")
        print("例: python run_with_notification.py axel_full_search.py")
        sys.exit(1)

    script_name = sys.argv[1]

    if not os.path.exists(script_name):
        print(f"エラー: {script_name} が見つかりません")
        sys.exit(1)

    # ログファイル名
    log_file = script_name.replace('.py', '_log.txt')

    print("=" * 60)
    print(f"スクリプト実行タイマー")
    print("=" * 60)
    print(f"\nスクリプト: {script_name}")
    print(f"ログファイル: {log_file}")

    # 開始時刻
    start_time = time.time()
    start_datetime = datetime.now()

    print(f"\n開始時刻: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n実行中... (PCから離れてOK)")
    print("=" * 60)
    print()

    # スクリプト実行（ログファイルに出力）
    try:
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"=" * 60 + "\n")
            f.write(f"実行開始: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"スクリプト: {script_name}\n")
            f.write(f"=" * 60 + "\n\n")

        # リアルタイムでログに追記しながら実行
        with open(log_file, 'a', encoding='utf-8') as f:
            process = subprocess.Popen(
                [sys.executable, script_name],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # リアルタイムで出力を表示＆ログに記録
            for line in process.stdout:
                print(line, end='')
                f.write(line)
                f.flush()

            process.wait()
            return_code = process.returncode

    except KeyboardInterrupt:
        print("\n\n中断されました")
        return_code = 130
    except Exception as e:
        print(f"\n\nエラー: {e}")
        return_code = 1

    # 終了時刻
    end_time = time.time()
    end_datetime = datetime.now()
    elapsed_seconds = end_time - start_time

    # ログファイルに終了情報を追記
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"\n\n" + "=" * 60 + "\n")
        f.write(f"実行終了: {end_datetime.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"実行時間: {format_duration(elapsed_seconds)}\n")
        f.write(f"終了コード: {return_code}\n")
        f.write("=" * 60 + "\n")

    # コンソールに結果表示
    print("\n" + "=" * 60)
    print("実行完了")
    print("=" * 60)
    print(f"\n開始: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"終了: {end_datetime.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n実行時間: {format_duration(elapsed_seconds)}")
    print(f"終了コード: {return_code}")
    print(f"\nログファイル: {log_file}")

    # デスクトップに完了通知ファイルを作成
    desktop_path = os.path.join(os.path.expanduser('~'), 'Desktop')
    notification_file = os.path.join(
        desktop_path,
        f"クローラー完了_{script_name.replace('.py', '')}_{end_datetime.strftime('%Y%m%d_%H%M')}.txt"
    )

    try:
        with open(notification_file, 'w', encoding='utf-8') as f:
            f.write(f"{script_name} が完了しました！\n\n")
            f.write(f"開始: {start_datetime.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"終了: {end_datetime.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"実行時間: {format_duration(elapsed_seconds)}\n")
            f.write(f"終了コード: {return_code}\n\n")
            f.write(f"詳細: {os.path.abspath(log_file)}\n")

        print(f"\n✅ 完了通知をデスクトップに作成しました")
        print(f"   {notification_file}")

    except Exception as e:
        print(f"\n⚠️  完了通知の作成に失敗: {e}")

    # Windowsトースト通知（オプション）
    if return_code == 0:
        send_windows_notification(
            "クローラー完了",
            f"{script_name} が正常に完了しました（{format_duration(elapsed_seconds)}）"
        )
    else:
        send_windows_notification(
            "クローラーエラー",
            f"{script_name} がエラーで終了しました"
        )

    print("\n" + "=" * 60)
    return return_code

if __name__ == "__main__":
    sys.exit(main())
