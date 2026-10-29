-- owner_articles_guard の修正 — 2026-10-29
-- is_admin() はサイトの管理アカウントのメールだけを見るので、ダイジェスト（py/send_digest.py・service_role）が
-- digest_sent_at を書いても元に戻されていた＝同じ記事が毎朝載り続ける。
-- 工具（owner-tools/notify_2026-10-07.sql）と同じく、サーバー側の権限（postgres・service_role）は全列を書けるようにする。

create or replace function public.owner_articles_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  trusted boolean := public.is_admin() or current_user not in ('authenticated', 'anon');
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if not trusted then
      new.author_user_id := auth.uid();
      new.is_hidden := false;
      new.digest_sent_at := null;
    end if;
    new.created_at := now();
  elsif not trusted then
    new.car_id := old.car_id;
    new.author_user_id := old.author_user_id;
    new.created_at := old.created_at;
    new.is_hidden := old.is_hidden;
    new.digest_sent_at := old.digest_sent_at;
  end if;
  return new;
end $$;
