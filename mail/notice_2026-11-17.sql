-- 反応のお知らせ（工具の「わたしも使ってる」「参考になった」・整備の記録の「参考になった」・記事を紹介した知らせ）にも
-- 停止の札を付ける — 2026-11-17（312 と同じ形）
--   owner_notice … 送信スクリプトが宛先ごとに札を作るだけ（owner_digest と同じ扱い・申し込みの行は無い）。
-- Gmail などの「登録解除」は List-Unsubscribe ヘッダー → /api/unsubscribe → mail_unsubscribe(札) で、そのお知らせの種類だけ止まる。
alter table public.mail_subscriptions drop constraint if exists mail_subscriptions_list_check;
alter table public.mail_subscriptions add constraint mail_subscriptions_list_check
  check (list in ('weekly', 'owner_digest', 'owner_notice'));
