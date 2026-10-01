#!/usr/bin/env python3
"""
本番DB（public スキーマ）の写しを database_schema.sql に書き出す。

`supabase db dump --schema-only` の代替（このプロジェクトは Supabase CLI をローカルに置いていない）。
DB 側の関数 schema_snapshot()（py/schema_snapshot_fn_2026-09-30.sql）が pg_catalog から
DDL 相当のテキストを組み立て、ここでは受け取って保存するだけ。DB は変更しない。

使い方（py/.env に SUPABASE_URL と SUPABASE_SERVICE_KEY があること）:
    python py/dump_schema.py            # ../database_schema.sql を上書き
    python py/dump_schema.py --stdout   # 標準出力へ

いつ回すか＝migration を当てたあと（テーブル・関数・ポリシーが変わったとき）。
"""
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from common import require, sb_rpc

require("SUPABASE_URL", "SUPABASE_SERVICE_KEY")

OUT = Path(__file__).resolve().parent.parent / "database_schema.sql"


def main():
    body = sb_rpc("schema_snapshot")
    if not isinstance(body, str) or not body.strip():
        raise SystemExit("schema_snapshot() が空を返しました")
    jst = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M JST")
    header = (
        "-- database_schema.sql ―― 本番 Supabase（public スキーマ）の写し\n"
        f"-- 生成: {jst}  by py/dump_schema.py（DB 関数 schema_snapshot() の出力）\n"
        "-- ⚠️ 手で編集しない。スキーマを変えたら migration を当ててから再生成する。\n"
        "-- ⚠️ そのまま流して復元する用途ではない（依存順・GRANT・storage/auth スキーマは含まない）。読むための資料。\n"
        "\n"
    )
    text = header + body
    if "--stdout" in sys.argv:
        sys.stdout.write(text)
        return
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"OK {OUT} ({len(text):,} chars)")


if __name__ == "__main__":
    main()
