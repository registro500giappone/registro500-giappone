# -*- coding: utf-8 -*-
"""
電装トラブルの旅手帳＝週次の告知メールを用意して、公開日の朝に news へ投入する。

なぜ2段構えか:
  send_digest.py は news を「sent_at IS NULL かつ created_at が14日以内」で拾う。
  ＝DBに入れた時点で翌朝の配信が確定し、「下書きのままDBに寝かせる」ことができない。
  そこで下書きの置き場を DB ではなくリポジトリのファイルにした。
    --draft   … 数日前に下書き wiring-simulator/announce/<公開日>.md を生成する
                （既にあれば触らない＝手で直した文面を上書きしない）
    --publish … 公開日の朝、その下書きを読んで news へ INSERT する
                （下書きが無い／skip: true の週は何もしない＝送らない）
  文面を直したいときはファイルを編集する。その週を送りたくなければ消すか skip: true。

呼ばれ方（.github/workflows/journey-publish.yml）
  publish_journey.py（記事を open にする）→ --draft → コミット・push → --publish
  ⚠️投入を push の後に置いているのは、push が失敗した週に告知だけ飛ぶのを防ぐため。
  ⚠️05:10 JST に投入すると 06:20 の朝ダイジェストに乗る（この70分差は意図的な設計）。

使い方
  python wiring-simulator/announce_journey.py --draft
  python wiring-simulator/announce_journey.py --draft --date 2026-10-16
  python wiring-simulator/announce_journey.py --publish --dry-run
  python wiring-simulator/announce_journey.py --publish
env (py/.env または環境変数): SUPABASE_URL / SUPABASE_SERVICE_KEY（無ければ SUPABASE_KEY）
"""

import argparse
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

# Windows のコンソールは既定が cp932＝日本語も⚠️も出せずに落ちる。
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE = os.path.join(ROOT, 'journey-schedule.json')
DRAFT_DIR = os.path.join(ROOT, 'wiring-simulator', 'announce')
BASE = 'https://www.registro500.com'
SEP = '---'

env = {}
ENV_FILE = os.path.join(ROOT, 'py', '.env')
if os.path.exists(ENV_FILE):
    for line in io.open(ENV_FILE, encoding='utf-8'):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v


def cfg(name):
    """py/.env を優先し、無ければ環境変数を見る（ローカル実行と CI の両対応）"""
    return env.get(name) or os.environ.get(name)


SUPA_URL = (cfg('SUPABASE_URL') or '').rstrip('/')
SUPA_KEY = cfg('SUPABASE_SERVICE_KEY') or cfg('SUPABASE_KEY')


def today_jst():
    return (datetime.now(timezone.utc) + timedelta(hours=9)).strftime('%Y-%m-%d')


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def md(date_str):
    """2026-09-11 → 9/11"""
    d = datetime.strptime(date_str, '%Y-%m-%d')
    return '%d/%d' % (d.month, d.day)


def url_of(slug):
    return '%s/wiring-journey-%s' % (BASE, slug)


def load_schedule():
    return json.loads(read(SCHEDULE))


def items_on(sch, date_str, field):
    """その日に field（early / public）を迎える回を、本編・別冊の順で返す。"""
    out = [dict(it, kind='issue') for it in sch['issues'] if it[field] == date_str]
    out += [dict(e, kind='extra', n=e['of']) for e in sch.get('extras', []) if e[field] == date_str]
    return out


def label(item):
    return '別冊' if item['kind'] == 'extra' else '第%d回' % item['n']


# =========================================================
# 下書きの生成
# =========================================================
def build_draft(sch, date_str):
    """その日の告知の下書き（title, content）を作る。公開される本編が無ければ None。"""
    opened = items_on(sch, date_str, 'public')
    if not any(it['kind'] == 'issue' for it in opened):
        return None
    early = items_on(sch, date_str, 'early')

    # ⭐主役は「登録オーナーが先に読める回」＝このメールの宛先は登録オーナー（2026-09-03 ユーザー指示）。
    #   その日に一般公開になった回は補足として後ろに置く。先行が無い最終回だけ主役が入れ替わる。
    head_item = next((it for it in early if it['kind'] == 'issue'), None)
    p = ['いつもありがとうございます。', '']

    if head_item:
        title = '電装トラブルの旅手帳 %s「%s」を先行公開しました' % (
            label(head_item), head_item['title'])
        p += ['■ %s「%s」を先行公開しました' % (label(head_item), head_item['title']), '',
              head_item['lead'],
              '登録オーナーの方はもうお読みいただけます。ログインしてご覧ください。',
              '一般公開は%s予定です。' % md(head_item['public']), '',
              '▼ %s %s' % (label(head_item), head_item['title']),
              url_of(head_item['slug']), '']
        for it in early:
            if it['kind'] != 'extra':
                continue
            p += ['■ 別冊「%s」も先行でお読みいただけます' % it['title'], '',
                  it['lead'], '',
                  '▼ 別冊 %s' % it['title'], url_of(it['slug']), '']

    for it in opened:
        if head_item:
            note = ('■ %s「%s」は一般公開になりました' % (label(it), it['title'])
                    if it['kind'] == 'issue'
                    else '■ 別冊「%s」も一般公開になりました' % it['title'])
            p += [note, '', it['lead'], '',
                  '▼ %s %s' % (label(it), it['title']), url_of(it['slug']), '']
        else:
            # 先行が無い＝在庫が尽きた最終回。この回自体が主役になる。
            note = ('■ %s「%s」を公開しました' % (label(it), it['title'])
                    if it['kind'] == 'issue'
                    else '■ 別冊「%s」も同時に公開しました' % it['title'])
            p += [note, '', it['lead'], '',
                  '▼ %s %s' % (label(it), it['title']), url_of(it['slug']), '']

    if not head_item:
        main = next(it for it in opened if it['kind'] == 'issue')
        title = '電装トラブルの旅手帳 %s「%s」を公開しました' % (label(main), main['title'])
        # 在庫が尽きた＝連載の完結（journey-schedule.json の policy と揃える）
        p += ['■ 連載はこれで完結です', '',
              '全%d回、おつきあいいただきありがとうございました。' % len(sch['issues']),
              '描いた絵はすべて目次に残ります。症状から引けるようにしてありますので、',
              'お困りのときにお使いください。', '',
              '▼ 電装トラブルの旅手帳 目次', '%s/wiring-journey' % BASE, '']

    p += ['■ お気づきの点がありましたら', '',
          '絵はすべて原典の配線図を元にしていますが、読み違えている箇所があるかもしれません。',
          'お気づきの点がありましたら、このメールにそのままご返信ください。',
          '原典と照らし合わせて確認し、適宜修正いたします。']

    return title, '\n'.join(p)


def draft_path(date_str):
    return os.path.join(DRAFT_DIR, '%s.md' % date_str)


def write_draft(date_str, title, content):
    head = ['title: %s' % title, 'date: %s' % date_str, 'skip: false', SEP, '']
    text = '\n'.join(head) + content + '\n'
    if not os.path.isdir(DRAFT_DIR):
        os.makedirs(DRAFT_DIR)
    with io.open(draft_path(date_str), 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def cmd_draft(sch, today, days, dry):
    made = []
    for i in range(days + 1):
        d = (datetime.strptime(today, '%Y-%m-%d') + timedelta(days=i)).strftime('%Y-%m-%d')
        built = build_draft(sch, d)
        if not built:
            continue
        if os.path.exists(draft_path(d)):
            print('  %s の下書きは既にあります（手直しを上書きしないので触りません）' % d)
            continue
        title, content = built
        print('  %s の下書きを作りました: %s' % (d, title))
        if dry:
            print('\n' + content + '\n')
        else:
            write_draft(d, title, content)
            made.append(d)
    if not made and not dry:
        print('新しく作った下書きはありません')
    return made


# =========================================================
# 投入
# =========================================================
def parse_draft(path):
    src = read(path)
    if SEP not in src:
        raise SystemExit('%s に区切り行（%s）がありません' % (path, SEP))
    head, content = src.split('\n' + SEP + '\n', 1)
    meta = {}
    for line in head.splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip()
    if not meta.get('title'):
        raise SystemExit('%s に title がありません' % path)
    return meta, content.strip('\n')


def article_state(slug):
    """記事HTMLに publish_journey.py が書いた state を読む。"""
    path = os.path.join(ROOT, 'wiring-journey-%s.html' % slug)
    m = re.search(r'window\.JOURNEY=(\{.*?\});', read(path), flags=re.S)
    if not m:
        raise SystemExit('%s に JOURNEY ブロックがありません' % path)
    return json.loads(m.group(1))['state']


def sb_get(table, params):
    url = '%s/rest/v1/%s?%s' % (SUPA_URL, table, params)
    req = urllib.request.Request(url, headers={
        'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY})
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.loads(res.read().decode('utf-8'))


def sb_insert(table, row):
    url = '%s/rest/v1/%s' % (SUPA_URL, table)
    req = urllib.request.Request(
        url, data=json.dumps(row, ensure_ascii=False).encode('utf-8'),
        headers={'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY,
                 'Content-Type': 'application/json', 'Prefer': 'return=representation'},
        method='POST')
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.loads(res.read().decode('utf-8'))


def cmd_publish(sch, today, dry):
    path = draft_path(today)
    if not os.path.exists(path):
        print('%s の下書きはありません＝今日は告知しません' % today)
        return
    meta, content = parse_draft(path)
    if str(meta.get('skip', '')).lower() in ('true', 'yes', '1'):
        print('%s の下書きは skip: true ＝送りません' % today)
        return

    # 安全弁：記事が本当に公開されているか確かめてから告知する。
    # ⚠️2026-08-28 に「URLの載った告知が先に届き、記事は門番に伏せられたまま」を踏んでいる。
    for it in items_on(sch, today, 'public'):
        st = article_state(it['slug'])
        if st != 'open':
            raise SystemExit('⛔ %s がまだ公開されていません（state=%s）＝告知を中止します'
                             % (it['slug'], st))
    for it in items_on(sch, today, 'early'):
        st = article_state(it['slug'])
        if st == 'pre':
            raise SystemExit('⛔ %s がまだ先行公開されていません（state=%s）＝告知を中止します'
                             % (it['slug'], st))

    print('件名: %s' % meta['title'])
    if dry:
        print('\n' + content + '\n')
        print('（--dry-run のため投入していません）')
        return

    if not SUPA_URL or not SUPA_KEY:
        raise SystemExit('SUPABASE_URL / SUPABASE_SERVICE_KEY がありません')

    # 二重投入の防止＝同じ件名の行が既にあれば何もしない
    q = 'select=id,sent_at&title=eq.%s' % urllib.parse.quote(meta['title'], safe='')
    if sb_get('news', q):
        print('同じ件名の news が既にあります＝投入しません')
        return

    # ⚠️date は JST の今日を明示する。既定の CURRENT_DATE は UTC＝05:10 JST では前日になる。
    row = sb_insert('news', {'date': today, 'title': meta['title'], 'content': content,
                             'target_car_type': 'both'})
    print('news に投入しました: id=%s（今朝のダイジェストで配信されます）' % row[0]['id'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--draft', action='store_true', help='下書きを作る')
    ap.add_argument('--publish', action='store_true', help='今日の下書きを news へ投入する')
    ap.add_argument('--days', type=int, default=3, help='下書きを何日先まで作るか')
    ap.add_argument('--date', default=None, help='この日として処理する（確認用）')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    if not args.draft and not args.publish:
        raise SystemExit('--draft か --publish のどちらかを指定してください')

    today = args.date or today_jst()
    sch = load_schedule()
    print('基準日 %s（JST）' % today)
    if args.draft:
        cmd_draft(sch, today, args.days, args.dry_run)
    if args.publish:
        cmd_publish(sch, today, args.dry_run)


if __name__ == '__main__':
    main()
