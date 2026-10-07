-- 新規投稿の通知（2026-10-07 ユーザー指示）
--   ① 管理人宛の即時メール＝ /api/tool-notify が admin_notified_at を立ててから送る（1件1回）
--   ② 登録オーナー宛の翌朝ダイジェスト＝ py/send_digest.py が notification_sent を見る
alter table public.owner_tools add column if not exists admin_notified_at timestamptz;
alter table public.owner_tools add column if not exists notification_sent boolean not null default false;

create or replace function public.owner_tools_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  -- 管理人（サイト上の管理アカウント）と、サーバー側の権限（postgres・service_role）は全列を書ける
  if public.is_admin() or current_user not in ('authenticated','anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.tool_key := null; new.amazon_url := null; new.is_hidden := false; new.source := 'post';
    new.consent_at := now(); new.admin_notified_at := null; new.notification_sent := false;
  else
    new.tool_key := old.tool_key; new.amazon_url := old.amazon_url;
    new.is_hidden := old.is_hidden; new.source := old.source;
    new.consent_at := old.consent_at; new.car_id := old.car_id; new.created_at := old.created_at;
    new.admin_notified_at := old.admin_notified_at; new.notification_sent := old.notification_sent;
  end if;
  return new;
end $$;
