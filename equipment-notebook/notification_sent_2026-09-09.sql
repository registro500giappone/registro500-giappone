-- 車載手帳（equipment_records）を朝ダイジェストの配信対象に加えるための列。
-- 2026-09-09: 公開（2026-08-06）以来、手帳の新規登録を知らせる経路が
-- どこにも無かった（send_digest.py / Actions / DBトリガー / Edge Function のいずれにも無し）。
-- cars・events・car_episodes と同じ「二重送信防止フラグ」方式で揃える。

alter table public.equipment_records
  add column if not exists notification_sent boolean not null default false;

comment on column public.equipment_records.notification_sent is
  '朝ダイジェスト（py/send_digest.py）で新着として配信済みか。false かつ is_public=true かつ作成14日以内が配信対象。';

-- 既存4冊はいずれも未通知。2026-09-09 ユーザー確定＝
-- 直前（2026-09-08 作成）の1冊だけを次回配信に載せ、それ以前は通知済み扱いにする。
update public.equipment_records
   set notification_sent = true
 where created_at < '2026-09-08T00:00:00Z';
