# この1台の歩み — 引き継ぎ書（正本）

## 目的

車両ページ（`detail.html`）の各セクションは静止画で、戻っても何も変わらない。
**既にDBにある出来事（登録・更新・イベント参加・車載手帳・ストーリー）を1本の時間軸に
並べ直し**、入力ゼロで全169台に「歩み」を立てる。既存の「出来事タイムライン」
（ストーリー投稿）と1本に統合する（別セクションにしない）。

正本の分担：DB側（`car_history`・トリガー）と `detail.html` 側の描画仕様の両方をここに置く。

## 描画仕様（`detail.html`・`fetchHistory`）

- 既存の `episodesSection`（id は据え置き・見出しだけ「この1台の歩み」）を**常に表示**し、
  `fetchEpisodes` の末尾から `fetchHistory(carDocId)` を呼んで `episodesList` を年表で描き直す。
- 出典4本を `Promise.allSettled` で並列取得（1本失敗しても他は出す）：
  `car_history`／`event_participants`→`events`（`in()`）＋`/event-slugs.json`／
  `equipment_records`（公開分）／`currentEpisodes`（入手も含む・日付未記入は `created_at` で並べる）。
- `car_history` が空・失敗なら `currentCar.created_at` から登録行だけ作る（フォールバック）。
- 行の文言：🏁 Registro500 に登録されました／✏️ 情報を更新しました（写真・こだわり…最大3語・
  対応表 `HISTORY_FIELD_LABELS` に無い列は出さない）／🎪 「◯◯」に参加／🧰 車載手帳を
  つくりました・更新しました／🔑 手放しました。`unsold` は出さない。
- 自動行の CSS は `.rg-history-item`（ストーリー行は既存 `renderEpisodeTimelineItem` のまま）。

## 行の種類と出典テーブル

| kind | 出典 | 発生タイミング | 備考 |
|---|---|---|---|
| `registered` | `cars`（AFTER INSERT トリガー） | `created_at` | 全車に必ず1行ある |
| `updated` | `cars`（AFTER UPDATE トリガー） | `last_update_date` | `fields` に `last_update_fields` を保持 |
| `sold` / `unsold` | `cars`（AFTER UPDATE トリガー） | `sold_at`（無ければ `now()`） | `is_sold` の変化を拾う |
| イベント参加 | `event_participants` → `events.event_date` | 表明日ではなく開催日 | リンクは `event-slugs.json` から `/event/<slug>/` |
| 車載手帳 | `equipment_records`（`is_public=true`） | `created_at` / `updated_at` | リンクは `#equipment-notebook` |
| ストーリー | 既存エピソード（`fetchEpisodes`） | 投稿日 | 見た目は既存 `renderEpisodeTimelineItem` を流用 |

書き込みは `car_history` テーブルへトリガーのみが行う（`anon`/`authenticated` は
INSERT/UPDATE/DELETE 不可・GRANTで明示）。ソースSQL＝`car_history_2026-09-10.sql`。

## 畳み込みルール（detail.html 側の描画で適用）

- **同じ日の `updated` は1行に畳む**
- **登録日と同日の `updated` は出さない**（登録直後の初期保存を二重に見せない）
- 新しい順にソートし、**8行まで表示**・超過は「もっと見る」でクライアント側展開

## 禁忌（3つ）

1. **行数・「活動度」・順位を出さない**（比較指標は成長戦略で不採用と決めている）
2. **「まだ出来事がありません」等の空欄指摘を書かない**（`registered` 行が必ずあるので
   セクション自体は空にならない）
3. **表示文言・コメントに「台帳」という語を使わない**（サイト全体のルール。CTA・年表の
   行・HTMLコメントすべて）

## SNS許諾・メール変更を年表に出さない理由

`edit.html:988`（SNS掲載許諾）・`edit.html:1226`（メール変更）は `cars` の更新だが、
オーナー本人にしか意味のない設定変更であり、**車の「歩み」ではない**。トリガーの
`updated` 条件は `last_update_date` の変化だけを見ており、この2つの保存経路は
`last_update_date` を更新しないため自然に対象外（意図的に条件へ入れていない）。

## 将来案（未着手・指示があれば検討）

- 「マイ壁紙に登場」行（壁紙ジェネレータでその車がタイルに使われた記録）
- スクリーンセーバー・Instagramリールなど他の派生機能に登場した記録も同様に追加できる
  余地はあるが、いずれも**出典テーブル側にログが無ければ追加しない**（無から作らない）
