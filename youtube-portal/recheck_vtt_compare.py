# -*- coding: utf-8 -*-
"""YouTube自動字幕のVTTを読み、断片(キュー)単位で原文と訳文を突き合わせる。

YouTubeの自動字幕VTTは「ローリング表示」のため同じ行が何度も出る。
実際に翻訳の単位になっているのは、インラインのタイムタグ付きで
新しく現れる行（＝新規発話の断片）なので、それだけを取り出す。
"""
import re, sys, json

TAG = re.compile(r'<\d\d:\d\d:\d\d\.\d\d\d>|</?c[^>]*>')
CUE = re.compile(r'^(\d\d:\d\d:\d\d\.\d\d\d) --> (\d\d:\d\d:\d\d\.\d\d\d)')


def parse(path):
    """(開始秒, テキスト) の並びを返す。ローリングの重複は落とす。"""
    out, seen = [], set()
    start = None
    with open(path, encoding='utf-8') as f:
        lines = f.read().splitlines()
    for i, ln in enumerate(lines):
        m = CUE.match(ln)
        if m:
            start = m.group(1)
            continue
        if start is None:
            continue
        # インラインタイムタグを含む行＝その場で新しく発話された断片
        if '<' in ln and TAG.search(ln):
            text = TAG.sub('', ln).strip()
            if text and text not in seen:
                seen.add(text)
                out.append((start, text))
    return out


def secs(t):
    h, m, s = t.split(':')
    return int(h) * 3600 + int(m) * 60 + float(s)


def main():
    src = parse(sys.argv[1])
    dst = parse(sys.argv[2])
    # 開始時刻でマッチ（同じ断片には同じ開始時刻が振られる）
    dmap = {}
    for t, x in dst:
        dmap.setdefault(round(secs(t), 1), x)

    rows = []
    for t, x in src:
        rows.append({'t': t, 'src': x, 'dst': dmap.get(round(secs(t), 1), '(対応なし)')})

    print(f'原文の断片数: {len(src)} / 訳文の断片数: {len(dst)} / 突合できた数: '
          f'{sum(1 for r in rows if r["dst"] != "(対応なし)")}')
    with open(sys.argv[3], 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)

    # 断片が文として閉じているかを測る（終止符で終わる断片の割合）
    closed = sum(1 for r in rows if r['src'].rstrip().endswith(('.', '!', '?', ':')))
    print(f'原文の断片のうち、文として閉じているもの: {closed}/{len(rows)} '
          f'= {closed*100//max(len(rows),1)}%')
    print(f'→ 残り {len(rows)-closed} 個 ({100-closed*100//max(len(rows),1)}%) は文の途中で切れている')


if __name__ == '__main__':
    main()
