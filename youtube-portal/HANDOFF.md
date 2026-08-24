# registro500 YouTube ポータル — Claude Code 引き継ぎ書

このドキュメントと `schema.sql` の2点で、実装に必要な確定事項がすべて揃っている。
Claude Code は本書を `CLAUDE.md` / `MEMORY.md` に取り込み、決定の経緯ごと保持すること。
実装の途中で迷ったら本書の確定事項に立ち返る。**確定済みの設計判断を勝手に変えない。**

---

## 0. 目的

registro500.com を クラシック FIAT 500 / 126 のポータルにする。
YouTube 動画を「整備箇所別・人気順・日本語」で見られるようにし、サイトの滞在価値を高める。
テキストや写真では分かりにくい整備（点火時期調整・タペット調整等）を、人気動画＋日本語解説で提供するのが主目的。

---

## 1. 確定仕様サマリ（全決定事項）

### カテゴリ
- 親カテゴリ6つ: 整備・修理 / レストア・板金 / チューニング・改造 / 走行・ツーリング / 歴史・カルチャー / イベント・購入
- 各親に中区分。親子は `categories` 1テーブルの自己参照（`parent_id`）で表現。
- 親・中区分とも**フェーズ2以降の分も最初に全部 insert** しておく（器を先に用意。後で範囲拡大時はキーワード追加だけで済む）。

### 主分類とタグ
- 動画の**主分類（category）は1つ**（`videos.category_id`）。
- **箇所タグ（part_tags）は複数**付与（`video_part_tags` 多対多）。
- 箇所タグは**整備/チューニング共通語彙**。これがクロスオーバー（チューニング動画を整備の一覧にも顔出しさせる）を実現する核。

### 車種
- **動画タグは大きく粗い粒度**。フェーズ1: FIAT 500 / Giardiniera / FIAT 126。
- **検索エイリアスは細かく**持つ（表記揺れ・通称・派生名を吸収）。「タグは大きく、エイリアスは細かく」。
- 派生車は `base_vehicle_id`（自己参照）でベース車に紐づける。
- **表示は通称**（FIAT 500、FIAT 126）。データ内部・registro連携では正式名（Nuova500）も保持。
- アバルトとジャンニーニは**別車種として分ける**（フェーズ2）。
- **クラシック期のみ**。現行アバルト（2008年〜の新型500ベース）等は足切りで除外。

### 評価（おすすめ1段階）
- ★5段階ではなく「**おすすめ1段階**」。押すか押さないか。
- 1ユーザー1動画1回（`recommendations` の PK で保証）。
- コメントは**任意**（おすすめ必須・コメント任意）。`comment` は NULL 許容。
- 書き込みは**既存 registro500 認証のログインオーナーのみ**。読み取りは全員。
- 初期は読む=全員 / 書く=ログインオーナーのみ。「最初は厳しめ、後で緩める」方針。

### 日本語化
- `title_original`（原題そのまま）と `title_ja`（要約的リライト見出し）を**両持ち**。
- `title_ja` は逐語翻訳ではなく「意味が伝わる日本語見出し」。原題は消さない（検索性・正確性のため）。
- `description_ja`（日本語ワンポイント解説）は **AI 自動生成・監修なし**（`commentary_source='ai'`）。
- 各解説に「**AI生成**」を小さく明示（「AI監修」等の人間監修を匂わす表現は使わない）。
- 全 AI 解説の末尾に定型注意書きを表示テンプレートで付与:
  「この解説はAIが動画情報から自動生成しています。実際の作業は元動画と整備書で必ず確認してください。」

### 再生
- 基本は**サイト内 YouTube 埋め込み再生**（③個別ページのプレーヤー）。
- `embeddable=false` の動画のみ「YouTubeで視聴」ボタンに自動で切替（API の `status.embeddable` を保存）。
- 全動画に小さく「YouTubeで開く」補助リンクを併設。

### ソートと表示本数
- 一次ソートは **YouTube 再生数（人気順）**。
- `view_history` で再生数履歴を残し、将来「直近で伸びてる動画」も算出可能に。
- サイト内おすすめ数は**二次情報**としてカードに小さく表示。
- 一覧の**初期表示は人気順 上位10本**、「もっと見る」でページング。
- 保存は広め（将来の控え含む）／一覧対象は1箇所40〜50本程度を上限／初期表示10本。

---

## 2. 画面構成（3画面）

1. **カテゴリ入口（ポータル）**: 親カテゴリ6つ＋検索バー。目的が明確な人は検索から直接飛べる。
2. **整備箇所の一覧（主役画面）**: 箇所タブで絞り込み → 人気順ソート＋「日本語解説/字幕/おすすめあり」フィルタ。
   カードに載る情報: サムネ / 動画長さ / タイトル(日本語) / 投稿者・再生数 / サイト内おすすめ数・コメント数 / 日本語解説バッジ・字幕バッジ。
3. **個別動画ページ**: YouTube 埋め込み → 直下に AI 日本語解説（「AI生成」表記＋定型注意書き）→ おすすめ/コメント投稿UI（ログインオーナーのみ）→ 同じ箇所タグの関連動画（カテゴリ横断）。

---

## 3. 初期マスタデータ

### vehicles（粗い粒度・通称表示・エイリアス豊富）

| slug | name_official | name_display | base_vehicle | search_aliases | フェーズ |
|---|---|---|---|---|---|
| fiat-500 | Nuova500 | FIAT 500 | (なし) | Fiat 500, fiat500, Cinquecento, 500 d'epoca, Nuova 500 | 1 |
| giardiniera | 500 Giardiniera | Giardiniera | fiat-500 | Giardiniera, 500 Giardiniera, Familiare, Belvedere | 1 |
| fiat-126 | Fiat 126 | FIAT 126 | (なし) | Fiat 126, 126p, Polski Fiat 126p, Maluch, Zastava 126, Steyr-Puch 126, FSM | 1 |
| abarth | Abarth (595/695) | アバルト | fiat-500 | Abarth 595, Abarth 695, 595 SS, 695 SS | 2 |
| giannini | Giannini | ジャンニーニ | fiat-500 | Giannini, Giannini 590, Giannini 126 GP | 2 |

注: 登録フォーム(edit.html)の細かいモデル区分は**車両登録用の正本**。動画ポータルの vehicles はそれを上表の粗い粒度に畳む。
両者は base_vehicle_id 的な対応で緩く紐づける。
**edit.html の最新区分を Claude Code が実環境で確認し、エイリアスに反映すること。**

【2026-08-10 追記】**500と126で区分の階層が違うのは正しい**。揃えようとしないこと。
- 500＝「シリーズ×グレード」の2階層（F/L/R は同時期に併存する仕様差なので2軸が実態に合う）。
- 126＝**時系列でモデル名そのものが変わる1階層**。日本語Wikipedia・旧車メディア（Nostalgic Hero）もこの並べ方で、
  日本の中古車サイト（みんカラ／グーネット／カーセンサー）に至っては126の名称管理自体が無い。
  一度126を2階層へ畳む改修を検討したが、**それこそが独自ルールになる**と分かったため撤回した。
- **Maluch は愛称ではなく1997年からの正式なモデル名**（旧車誌の表記は「マルチ」）。ポーランド製126全般の通称という理解は誤り。
  また**1992年に「ポルスキ」の名は消滅**しており、2000年前後の車を Polski Fiat 126p と呼ぶのは年代的に誤り。
- search_aliases に Maluch を残すのは正しい（エイリアスは細かく、が不変条件）。

### categories（親 › 中区分） — 緑=フェーズ1取得対象

整備・修理 (manutenzione): **エンジン[F1]** / **燃料・吸気[F1]** / **点火・電装[F1]** / 駆動・クラッチ・ミッション / 足回り・ブレーキ / ボディ・内装・電気小物 / 一般メンテ・油脂
  ※「冷却」は独立中区分にしない（空冷のため。ファンはダイナモと一体 → 点火・電装に内包）。

レストア・板金 (restauro): フルレストア記録 / 錆処理・防錆 / 板金・パネル交換 / 塗装 / 内装・幌・シート

チューニング・改造 (elaborazione): エンジン強化・腰上 / ヘッド・ビッグキャブ / 126エンジン換装 / 排気・マフラー / 電子化（点火・電装）

走行・ツーリング (on the road): ロードトリップ・紀行 / ラリー・走行イベント / 街乗り・試乗インプレ / サウンド・車載

歴史・カルチャー (storia): モデル史・系譜 / デザイン・ドキュメンタリー / 名車・著名個体 / 広告・カルチャー / チューナー・派生史（アバルト/ジャンニーニ）

イベント・購入 (eventi/acquisto): ミーティング・旧車祭 / オークション・相場 / 購入前チェック・査定

### part_tags（箇所タグ・整備/チューニング共通） — 緑=フェーズ1

フェーズ1: 点火時期調整 / ポイント点検 / タペット調整 / キャブ調整 / キャブОH / プラグ / 配線・ダイナモ・ファンベルト
フェーズ2以降: オイル・シール / ヘッド・腰上 / クラッチ / ミッション / ブレーキ / サスペンション

---

## 4. フェーズ1 取得キーワード（広め・多言語・伊語本命）

各箇所、伊語を本命に英語を補助。`Fiat 500` 単独は現行車が混ざるため、伊語は `d'epoca`/`storica`、英語は `classic` を必ず添える。
同じ箇所に複数クエリを張り、結果を箇所タグに集約する。`order=viewCount`（人気順）で上位取得。
126 明示クエリ（例 `Fiat 126 registrazione punterie`）は**フェーズ2に回す**（フェーズ1の伊語クエリで 500/126 共通動画がかなり拾えるため。重複取得とAPI枠の節約）。

- 点火時期調整: `Fiat 500 messa in fase` / `Fiat 500 anticipo accensione` / `Fiat 500 d'epoca messa in fase` / `classic Fiat 500 ignition timing`
- ポイント点検: `Fiat 500 puntine platinate` / `Fiat 500 puntine condensatore` / `Fiat 500 contatti spinterogeno` / `classic Fiat 500 contact points`
- タペット調整: `Fiat 500 registrazione punterie` / `Fiat 500 gioco valvole` / `Fiat 500 d'epoca punterie` / `classic Fiat 500 valve clearance`
- キャブ調整: `Fiat 500 d'epoca carburatore regolazione` / `Fiat 500 regolazione minimo` / `classic Fiat 500 carburetor tuning`
- キャブОH: `Fiat 500 revisione carburatore Weber` / `Fiat 500 pulizia carburatore` / `classic Fiat 500 carburetor rebuild`
- プラグ: `Fiat 500 candele` / `classic Fiat 500 spark plugs`
- 配線・ダイナモ・ファンベルト: `Fiat 500 cinghia dinamo ventola` / `Fiat 500 impianto elettrico` / `Fiat 500 dinamo` / `classic Fiat 500 dynamo belt`

※キーワードは「広め」が方針。取りこぼしより、足切り（次項）でゴミを落とす設計。

---

## 5. 足切り基準（2段階）

### 機械的フィルタ（取得時・APIコストをかけずに落とす）
- **現行チンクエチェント除外**: タイトル/説明に `Abarth 595`(現行) / `TwinAir` / `1.2` / `Lounge` / `elettrica` / `500e` / 2008年以降を示す語 が含まれたら落とす。クラシックには無い語で安全に効く。
- **別車種除外**: 600 / 850 / Panda が主題のものは落とす。ただし **126 は除外せず車種タグで扱う**。500か126を含む串刺し動画（FD Ricambi 系「500|126|600|850」）は残す。
- **動画長さ下限**: 90秒以下（ショート）は落とす。上限は設けない（フルレストア等は長尺ほど価値が高い）。
- **再生数下限**: 低め（500〜1000再生程度）。強い足切りはしない（ニッチでも良質な整備動画を残す。人気順で自然に下位に沈む）。
- **embeddable=false** は落とさず「YouTubeで視聴」扱い。

### AI 判定（分類時・機械で弾けないものを落とす）
- 主題がクラシック 500/126 の整備・関連かを Claude が判定。キーワード一致だが内容無関係（キーホルダー紹介、ミニカー、BGMだけの走行クリップ等）は `relevant: false` で除外。

### 確信度の扱い
- AI が分類に自信を持てない動画は、**公開はするが箇所タグを付けず「未分類」**に置き、箇所別一覧には出さない。完全除外でも全公開でもない中間。`part_tag` が空＝未分類として自然に扱える（テーブル変更不要）。

### 除外語リスト
- **コード直書きせず設定ファイル（または Supabase の設定テーブル）で持ち、後から追加できる**ようにする。

---

## 6. 更新頻度（2層）

- **週1回: 再生数の更新**。既存動画の `view_count` を最新化し `view_history` に追記。`videos.list` は1ユニット/回と激安、50件まとめて取得可。人気順ソートを最新に保つ。
- **月1回: 新着動画の発掘**。各キーワードで `search.list`（100ユニット/回と高コスト）。新規投稿は頻度が低いので月1で足りる。
- 初回のみ過去の人気動画を一括取得。
- 無料枠（1日10,000ユニット）に対し、週次は数十ユニット・月次でも数百〜千ユニット程度。枠は問題にならない。
- スケジューラは既存構成（GitHub Actions cron / Windows Task Scheduler 等）を流用。
- **【2026-07-01 決定】週次view更新は月次に集約（専用スクリプト不採用）**。月次 `youtube_fetch.py` が信頼chを playlistItems 全巡回で再upsert＝既存動画の `view_count` も最新化＋`view_history` 追記されるため、週次の独立実行を作らず頻度少なめ運用とする。
- **【2026-07-01 追加】経路②「管理者が手動追加」＝自動更新とは別の入口**：`py/youtube_add.py <URL> [--by 名前]`＋workflow `youtube-add-video.yml`（URL入力→add→classify即実行）。source_tier=0（手動追加＝最上位・classifyの `source_tier<3` 削除ガードで自動削除されない）。記名は `--by` 指定時のみ `videos.recommended_by_name` に格納。オーナー要望は videos.html の mailto 導線（宛先=ADMIN_EMAIL）で受け、管理者が②で掲載＝投稿テーブル・承認UI・RLSは持たない軽量方式。
- **【2026-08-21 記録】YouTube側で再生回数の数え方が変わる（2026-08-24〜）**：長尺・ライブも含む全フォーマットで「再生が開始された瞬間」からカウント（最低再生時間の要件が撤廃）。Data API の `viewCount` は**フィールド名も型も場所も不変＝コード修正は不要**。旧ロジックの数値は `engagedViews` として Analytics/Reporting API に残るが、**それはチャンネル所有者向け＝他人の動画を扱う当ポータルからは元から使えない**（調べ直さない）。影響は3点だけ：①`search.list(order=viewCount)` の並びが多少変わる（放置でよい）②`fetch_config.json` の `min_view_count: 500` が実質的に緩む＝**数字は動かさない**（元々低め設定＋ショートは `max_duration` 90秒以下で別途除外済み）③⚠️**`view_history` は 08-24 を境に数値の定義が変わり、遡って直らない段差になる**＝将来「再生数の伸び率」を出すときに **08-24 をまたぐ比較をしない**。なお 09-01 の月次実行後、974本中85本前後（35日以上更新されていない＝もう検索に出てこない動画）だけ旧ロジックの値が残り人気順が数%歪むが、**全件一括更新のワンショットは走らせない**（§167 の方針どおり。該当は人気順の下位に沈んだ古い動画で見え方が変わらないため＝ユーザー判断済み）。
- **【2026-07-01 追加】手順カード生成（AI要約・方法A）＝夜間バッチ**：`py/youtube_steps.py`＋workflow `youtube-steps.yml`（毎日JST02:00・limit30）。is_howto動画のみ対象で `videos.steps_ja` を生成。初回292本はバックフィル後、以後は新規howto動画のみ＝数本/月と安価（Geminiのみ・YouTube APIユニット消費なし）。

---

## 7. Claude Code 実装タスク

1. **スキーマ適用**: `schema.sql` を Supabase に適用（SQL Editor 貼付 or migration）。8テーブル＋集計ビュー＋RLS が構築される。
2. **初期マスタ投入**: 本書 §3 の categories（親＋全中区分、フェーズ2分も含む）/ part_tags / vehicles を insert。
   - edit.html（type=500 / type=126）の最新モデル区分を実環境で確認し、vehicles の search_aliases に反映。
3. **取得スクリプト（初回）**: §4 のフェーズ1キーワードで `search.list`（order=viewCount, 上位取得）→ `videos.list`（statistics, contentDetails, status）。
   - 保存項目: youtube_id, title_original, channel_name, duration_seconds(ISO8601→秒), thumbnail_url, published_at, view_count, has_captions, embeddable。
   - §5 の機械的フィルタを適用。除外語リストは設定ファイル化。
4. **AI 分類・解説生成**: 取得動画ごとに Claude で
   - 主分類（category 1つ）＋箇所タグ（複数）＋車種（粗い粒度）を判定。確信度低→未分類（タグ空）。
   - `title_ja`（要約的リライト）と `description_ja`（3〜4行のAI解説）を生成。`commentary_source='ai'`。
   - 無関係動画は relevant:false で除外。
5. **再生数更新ジョブ（週1）**: 既存 video の view_count 更新＋ view_history 追記。
6. **新着探索ジョブ（月1）**: §4 キーワードで再 search、新規 youtube_id のみ取り込み→ §4→§5→タスク4 の流れ。
7. **フロント**: 3画面（§2）。一覧は人気順・初期10本・もっと見るページング。車種は通称表示・`?vehicle=126` 等の専用フィルタURL対応。AI解説に「AI生成」表記＋定型注意書き。embeddable で再生/誘導を出し分け。
8. **認証連携**: recommendations の user_id は既存 registro500 認証（Supabase Auth or 既存SSO）を参照。取り込みパイプラインは service_role キー（RLSバイパス）で書き込む。

### フェーズ2（初回ローンチ後）
- 整備の残り中区分（駆動/足回り・ブレーキ/ボディ/一般メンテ）、レストア・チューニング・走行・歴史・イベントの取得開始。
- 126 明示キーワード、アバルト/ジャンニーニ（クラシック期のみ、現行除外）。
- 「直近で伸びてる動画」ソート（view_history 活用）。

---

## 8. 不変条件（壊さないこと）

- 主分類は1つ・箇所タグは複数・タグは整備/チューニング共通。
- 車種タグは粗く、エイリアスは細かく。表示は通称。
- AI解説は監修なしだが「AI生成」明示＋定型注意書き必須。
- 書き込みはログインオーナーのみ・読み取りは全員（RLS）。
- クラシック期のみ。現行車は足切り。
- 原題（title_original）は消さない。

---

## 9. 実装ログ（Claude Code 追記）

- **2026-06-29 タスク1完了**: `schema.sql` を Supabase 本番に migration 適用（migration名 `youtube_portal_schema`）。8テーブル＋ビュー `video_reco_counts` ＋RLS構築。既存テーブル(cars/parts/news等)との名前衝突なし。
  - 原 schema.sql からの安全側の微調整2点（設計判断は不変）:
    1. ビュー `video_reco_counts` に `with (security_invoker = true)` を付与（Supabase の SECURITY DEFINER ビュー勧告を回避。recommendations は元々公開読み取りのため挙動不変）。
    2. `set_updated_at()` 関数に `set search_path = ''` を付与（function_search_path_mutable 勧告を解消。migration名 `youtube_portal_harden_set_updated_at`）。
  - get_advisors（security）で新規8テーブル・ビューに勧告ゼロを確認。
- **2026-06-29 タスク2完了**: 初期マスタ投入（`seed_master.sql` を service_role 接続で execute）。vehicles 5（fiat-500 / fiat-126 / giardiniera / abarth / giannini、派生3車種は base_vehicle_id=fiat-500）/ part_tags 13（フェーズ1+2全投入）/ categories 親6＋中区分29＝計35（フェーズ2分も器を全投入）。
  - edit.html の type=500/126 最新モデル区分を実環境確認（500: F/L/R/D/Giardiniera/Sport/N Normale/Prima Serie/595/595SS/695/695SS、126: 20種）し、`vehicles.search_aliases` に反映。
  - 投入は ID 直書きを避け slug 参照（中区分は親slug subselect・派生車は fiat-500 を subselect）。
- **2026-06-29 タスク3＋4完了**（Plan mode で計画→実装→ローカル検証）。AI分類モデルは **Gemini 流用**（`gemini-flash-lite-latest`・無料枠）に決定。YouTube Data API v3 キーは新規発行し `py/.env` の `YOUTUBE_API_KEY` に登録（疎通確認済）。
  - 作成物: `youtube-portal/fetch_config.json`（§4キーワード・§5除外語・閾値の設定外出し）／`py/youtube_fetch.py`（タスク3: search.list[order=viewCount]→videos.list→機械フィルタ→videos upsert＋view_history追記。`--dry-run`/`--limit-queries`対応）／`py/youtube_classify.py`（タスク4: Geminiで主分類1+箇所タグ複数+車種複数+title_ja+description_ja生成。relevant=false削除・confidence<0.5は箇所タグ空＝未分類）／`.github/workflows/youtube-portal.yml`（workflow_dispatch＋月次cron、fetch→classify）。
  - 書込は service_role（`SUPABASE_SERVICE_KEY` 優先・無ければ anon フォールバック）。機械フィルタ強化: 現行エンジン名(FIRE/MultiAir/MultiJet/variatore/cinghia distribuzione=現行ベルト)・別車種(Vespa/Lancia/Jeep/Iveco等)を除外。空冷クラシックはタイミングベルト無し＝`cinghia distribuzione`は確実な現行 signal（`catena`=チェーンはクラシックも使うため除外しない）。
  - 初回ローカル実行実績: 25クエリ→ユニーク496件取得→機械フィルタ通過216件→videos upsert→Gemini分類で **無関係62件削除・残154件**（全件 title_ja/category_id/車種付与・箇所タグ付き124件/未分類30件・embeddable 152件）。view_history は videos の on delete cascade で154件に整合。日本語見出し・解説の品質は良好と目視確認。
  - **残: GitHub Secrets に `YOUTUBE_API_KEY` と `SUPABASE_SERVICE_KEY` の登録が必要**（Actions実行の前提・ユーザー手動）。次はタスク7（フロント3画面）/タスク5週次view更新の本実装/タスク8認証連携。
- **2026-06-29〜30 タスク7（フロント）実装中・レビュー反映中**（画面構成は2ページ統合に変更＝ユーザー承認）。
  - 作成物: `videos.html`（/videos = 入口＋一覧統合：カテゴリ/検索/車種切替＋人気順10本＋もっと見る・URL駆動フィルタ・`?vehicle=126`対応）／`video.html`（/video?id= = 個別：プレーヤー・AI生成バッジ＋定型注意書き・原題併記・関連動画）。`index.html`メニューに「🎬 動画ガイド」追加・`sitemap.xml`に`/videos`追加。読み取りはanon(RLS public)。
  - レビュー反映: 字幕ありフィルタ＝デフォルトOFF（手動字幕は11本のみ・自動字幕はAPI非カウント）／日本語解説あり＝デフォルトON／おすすめフィルタは撤去（タスク8まで）／整備箇所チップ＝**車の系統順**（エンジン→燃料→点火電装→駆動→足回り）＋**選択中カテゴリ/車種に動画がある箇所だけ表示**（文脈連動）。プレーヤーは**クリック再生ポスター方式**＋標準`youtube.com/embed`（nocookieから変更）。
  - **再生エラーはローカル(http://127.0.0.1)特有とほぼ確定**（oEmbed全件200＝埋め込み許可・Playwrightでは正常描画）。本番httpsでの再生確認が未了（CFトークンにPages権限なくプレビューURL自動取得不可）。
  - **精度の厳格化（重要）**: 当初の relevant 判定が甘く「汎用キャブ動画(TUNE ANY CARB等)」「現行型500(1.2/FIRE等)」が混入。プロンプトを「クラシック500/126が**主題**の動画のみ true・汎用技術/他車種/現行型(リッター排気量1.x表記)は false・迷ったらfalse」に強化し、既存を**2回リセット再分類**。**216→154→115→113本**に収束（全件クラシック500/126・「1.2」等の現行型0件確認）。
  - **【方針転換の検討中・未決】** ユーザー指摘で、純・人気順だと汎用動画が上位に来て**FD Ricambi等のショップ解説や日本語チャンネルが埋もれる**問題が判明。→「**信頼チャンネルまるごと取得＋ソース優先ティア**（ショップ/日本語/専門→その他人気順）」へのキュレーション再設計を検討中。カテゴリ6分類の存続も再検討対象（113本規模で過剰の懸念）。**この再設計は未確定。決まり次第 Plan mode で計画化する。**
  - ショップ調査結果(YouTube解説チャンネル有無): **FD Ricambi 'Restore Your Fiat'=51本(英How-to・本命)** / Axel Gerstl=15本(独) / D'Angelo Motori=49本(伊チューニング) / Ricambio=12本(一部) / EuroItalia500・Passione500・AutoBella・Mr Fiat=チャンネル無し。DB既存の良質: The 500 Workshop(8)・OldCars Palermo(11)・Bamboo field🇯🇵(2)。ユーザー提供の追加ショップ群(PBP/Bigatti/Denitto/Motobambino/Pitstop等)は調査スクリプト用意済・未実行。
  - コードは未コミット→ブランチ `youtube-portal-frontend` に退避（main へは未マージ＝本番未公開）。

- **2026-07-01 運用機能追加（経路②＋③・ブランチ `youtube-portal-frontend`）**：情報更新の月次集約と、オーナー推薦の受付を実装。
  - **スキーマ**: `videos.recommended_by_name`（text・null=無記名）を1列追加（本番 migration `youtube_portal_videos_recommended_by`・schema.sql同期済）。投稿テーブル/承認UI/RLSは作らない方針（負担削減）。source_tier に 0=手動追加を追認（DDL変更不要・削除ガード `source_tier<3` で保護）。
  - **経路②（管理者手動追加）**: `py/youtube_add.py`（youtube_fetch.py の `_api_get`/`fetch_video_details`/`to_video_row` を import流用。URL/11桁ID両対応・`--by 名前`で記名・`--tier`既定0）＋ `.github/workflows/youtube-add-video.yml`（workflow_dispatch inputs=url/recommended_by → add→classify即実行でAI要約まで自動）。PC前なら Claude Code にローカル実行させる運用も可。
  - **経路③（オーナー要望）**: videos.html 下部に mailto 導線（宛先=config.js の ADMIN_EMAIL・件名/本文テンプレ入り）。テーブルもログインも持たない最軽量方式。
  - **フロント記名表示**: videos.html カードに「🙋 ○○さんの推薦」バッジ（select列に recommended_by_name 追加）／video.html メタ行に同表示（`select('*')`のため列追加不要）。
  - **前提（ユーザー手動・未実施）**: GitHub Secrets 登録（`YOUTUBE_API_KEY`/`SUPABASE_SERVICE_KEY`/`GEMINI_API_KEY`/`SUPABASE_URL`/`SUPABASE_KEY`）。未登録の間、②はローカル実行のみ動作。
  - **残**: 本番https再生確認／main マージで公開（本作業では未実施）。

- **2026-07-01 AI要約「手順カード」本実装（方法A・ブランチ `youtube-portal-frontend`）**：is_howto動画に「番号付きの日本語整備手順（原語併記・注意点付き）」を付け、動画と手順を1画面で見せる。承認済みモック `mock_steps_v2.html`（別セッションscratchpad・PC/スマホ縦/横の3表示検証済み）を移植。
  - **スキーマ**: `videos.steps_ja jsonb`（形式 `{"steps":[{"t":"見出し","d":"本文(専門用語=日本語+原語併記)"}...最大8],"caution":"注意点1行"}`・null=未生成or非対象）＋ `videos.has_steps boolean generated always as (steps_ja is not null) stored`（一覧を軽く保つバッジ用・is_categorizedと同型）を追加（本番 migration `youtube_portal_videos_steps_ja`・schema.sql同期済）。
  - **生成スクリプト**: `py/youtube_steps.py`（方法A本体）。`gemini_video_test.py` 実証の **YouTube URL直接入力**（`FileData(file_uri=...)`）を採用し、Gemini に動画を視聴させ整備手順JSONを生成。モデル/接続/429リトライは `youtube_classify.py` と統一（`gemini-flash-lite-latest`・service_role書込）。対象 `is_howto=true and steps_ja is null`（source_tier昇順→view_count降順）。`--limit N`（夜間バッチ）・`--dry-run`（1本表示・書込なし）。steps空（映像から起こせない）は書込せず skip＝次回再挑戦。字幕全文翻訳はせず映像からの手順要約＝安全側。
  - **夜間バッチ**: `.github/workflows/youtube-steps.yml`（`schedule cron '0 17 * * *'`=JST 02:00 ＋ `workflow_dispatch`〔limit入力・既定30〕）。292本を30本/日×約10日で初回バックフィル（Gemini無料枠のトークン上限回避）。以後は新規howtoのみ＝数本/月。
  - **video.html**: `render()` を拡張。`steps_ja.steps` 有→「AI要約」カードに番号付き `<ol class="steps">`（t太字＋d本文）＋赤ボックスの注意点＋`description_ja` を lead＋黄「AI生成」ピル＋定型注意書き。steps無→従来どおり `description_ja` 要約文のみ。**帯かぶり修正＋PC大画面**のCSSをモックから移植：`--nav-h:48px`／`.vp-nav{height:var(--nav-h)}`／`.player{position:sticky;top:calc(nav-h+gap)}`（帯に潜らない）／PC(min-width:900px)＝**グリッドは `#content` に適用**（video.htmlは player等が `.wrap` 直下でなく `#content` 直下のため）・`.wrap{max-width:1600px}`・動画左を大きく（`max-width:calc((100vh-nav-gap*2)*16/9)`）／min-width:1400px手順420px／スマホ横(landscape&max-height:600px)は動画高さ基準で画面内。**`content.style.display='block'`→`''` に変更**（inline displayがグリッドを潰すのを回避）。
  - **videos.html**: 無意味だった「AI要約あり」トグル（`#tglJa`/`state.ja`/`description_ja is not null` 絞り込み・URL同期）を全撤去（`.vp-toggles`は字幕のみ）。カードバッジ `if(description_ja)→AI要約`（321本でほぼ全部＝無意味）を `if(has_steps)→AI要約` に変更。`buildQuery` の select を `description_ja`→`has_steps` に置換（一覧を軽く保つ）。
  - **ローカル検証（Playwright・python http.server 8765）**: 少数生成2本（`3yfrWcDUuEM` 4手順／`S4IDbuWMPGM` 7手順）でsteps_jaのJSON構造・原語併記を確認。video.html を **PC1600（grid・動画幅1091px・手順7・注意点・スクロール後 player.top=60 ≥ nav.bottom=48＝帯に潜らない）／スマホ縦390（block・sticky・帯かぶり無）／スマホ横844x390（grid・動画高322で画面内・帯かぶり無）** で数値＋スクショ確認。videos.html は tglJa消滅・字幕トグルのみ・AI要約バッジは生成2本のみ・コンソールエラー0。
  - **残**: 全292本バックフィル（GitHub Secrets登録後に夜間cron運用、または未登録の間はローカル `youtube_steps.py --limit N`）／本番https再生確認／main マージで公開（いずれも本作業では未実施）。**スコープ外**: Phase2＝タイムスタンプ同期で「現在の手順」自動ハイライト＋自動スクロール（精度検証後・別途）。

---

- **【2026-08-22 記録】手順カード生成が3週間ほぼ空回りしていた（`472d380` で手当て済み・MEMORY.md から移設）**
  - **発覚**：「steps_ja は 08-11 に 100% 完了」という記録が現状と一致しなかった。**実測で未生成271本（うち `is_howto=true` が182本）**。
  - **原因＝2つの掛け算**：①`is_howto` の誤分類（手順動画でないものが対象に入る）②`youtube_steps.py` の「**steps が空なら書込まず skip＝次回再挑戦**」設計。対象の並び順が `source_tier` 昇順→`view_count` 降順で**固定**なので、**毎晩まったく同じ30本を呼び直す無限リトライ**になっていた（30本中27〜29本 SKIP・生成1〜3本/日・**1本あたり映像込み約17万トークン**）。
  - ⚠️**Gemini は動画を正しく視聴したうえで「手順なし」と答えていた＝モデル障害ではない**（同じ動画に `PROMPT_POINTS`（要点まとめ）を投げたら9項目の良質な要約が返った）。**プロンプトと対象選定の問題**。
  - **手当て（`472d380`）**：①空＋`is_howto` なら**要点まとめで1回だけ聞き直す**（実測3/3救済）②それでも空なら **`empty` 印を書いて `steps_ja IS NULL` の対象から外す**（状態を残す）③**対象5本以上で生成0件なら `exit 1`**（空回りを success で終わらせない）。
  - ⚠️**`is_howto` は表示順のキーなので書き換えない**＝救済は `kind` 側だけで行う。⚠️**プロンプトやモデルを直したときは `STEPS_VERSION` を上げれば `--regenerate` で再挑戦される**。
  - 💡**教訓**：**「毎回リトライして状態を残さない」設計は、対象の並び順が固定だと無限ループになる**／**Actions が success でも“中身の生成件数”を見ないと空回りに気づけない**（パーツクローラーで塞いだ穴と同型）。
  - 残271本は夜間バッチで**約9日かけて消化中**（記録時点）。
