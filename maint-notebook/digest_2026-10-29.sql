-- マイ整備手帳の記録を朝のダイジェストに載せる（2026-10-29 ユーザー決裁「載せたい。1台1日1行でいい」）
-- digest_sent_at＝ダイジェストに載せた時刻（py/send_digest.py だけが書く）。本人は画面から変えられない。

alter table public.maint_records add column if not exists digest_sent_at timestamptz;

-- 公開前から有る記録は「載せた扱い」で埋める＝スイッチを入れた日に過去分が一度に流れないように
update public.maint_records set digest_sent_at = created_at where digest_sent_at is null;

create or replace function public.maint_records_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op = 'UPDATE' then new.updated_at := now(); end if;
    return new;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.author_user_id := auth.uid();
    new.created_at := now();
    new.digest_sent_at := null;
  else
    new.car_id := old.car_id;
    new.author_user_id := old.author_user_id;
    new.created_at := old.created_at;
    new.digest_sent_at := old.digest_sent_at;
  end if;
  return new;
end $$;

create index if not exists maint_records_digest_idx on public.maint_records (created_at) where digest_sent_at is null;
