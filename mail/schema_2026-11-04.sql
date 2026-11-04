-- お知らせメールの配信先と配信停止 — 2026-11-04
-- 配信の「申し込み」と「停止」を1つの表で持つ。宛先の種類（list）ごとに1行。
--   weekly       … 週1回のお知らせ（車なしでも受け取れる・確認コードでログインした本人が申し込む）。
--   owner_digest … 朝の新着情報のお知らせ（オーナー向け・py/send_digest.py）。
--                  申し込みの行は無く、送信スクリプトが宛先ごとに「停止用の札」を作るだけ。
-- 停止はメールのリンク（/unsubscribe?t=札）から、ログインなしで1回押すだけ（mail_unsubscribe(token)）。

create table if not exists public.mail_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  list            text not null check (list in ('weekly','owner_digest')),
  email           text not null check (email = lower(email) and position('@' in email) > 1),
  user_id         uuid references auth.users(id) on delete cascade,   -- weekly は必須・owner_digest は空でよい
  source          text not null check (source in ('signup','former_owner','owner')),
  consented_at    timestamptz,          -- weekly：確認コードを入れて申し込んだ日時（同意の記録）
  policy_version  text,                 -- weekly：同意したときのポリシーの版（改定日 'YYYY-MM-DD'）
  unsubscribed_at timestamptz,          -- 停止した日時（空＝配信中）
  unsub_token     uuid not null unique default gen_random_uuid(),       -- 停止リンクの札（推測不能）
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (list, email),
  check (list <> 'weekly' or (user_id is not null and consented_at is not null and policy_version is not null))
);

-- 申し込み・取り直しは本人だけ。メールアドレス・日時はサーバー側で決める（画面から偽れない）
create or replace function public.mail_subscriptions_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  -- 送信スクリプト（service role）・管理人・停止の関数（mail_unsubscribe＝security definer）はそのまま通す
  if auth.uid() is null or public.is_admin() or current_user not in ('authenticated', 'anon') then return new; end if;
  if new.list <> 'weekly' then raise exception 'not allowed'; end if;
  new.user_id := auth.uid();
  new.email := lower(auth.jwt() ->> 'email');                            -- ログインしたアドレスに固定
  if tg_op = 'INSERT' then
    new.source := 'signup';
    new.consented_at := now();
    new.unsubscribed_at := null;
    new.unsub_token := gen_random_uuid();
    new.created_at := now();
  else
    new.id := old.id; new.list := old.list; new.created_at := old.created_at;
    new.unsub_token := old.unsub_token; new.source := old.source;
    -- 再開＝停止を外すときだけ同意を取り直す（日時と版を更新）
    if old.unsubscribed_at is not null and new.unsubscribed_at is null then
      new.consented_at := now();
    else
      new.consented_at := old.consented_at;
      new.policy_version := old.policy_version;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists mail_subscriptions_guard on public.mail_subscriptions;
create trigger mail_subscriptions_guard before insert or update on public.mail_subscriptions
  for each row execute function public.mail_subscriptions_guard();

alter table public.mail_subscriptions enable row level security;

-- 読む：本人の行と管理人だけ（購読者の一覧は誰にも見せない）
drop policy if exists mail_subscriptions_read on public.mail_subscriptions;
create policy mail_subscriptions_read on public.mail_subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists mail_subscriptions_insert on public.mail_subscriptions;
create policy mail_subscriptions_insert on public.mail_subscriptions for insert to authenticated
  with check (list = 'weekly' or public.is_admin());

drop policy if exists mail_subscriptions_update on public.mail_subscriptions;
create policy mail_subscriptions_update on public.mail_subscriptions for update to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- 消す（delete）は作らない＝同意と停止の記録を残すため。退会（auth.users 削除）では cascade で消える。

-- 停止：メールのリンクから匿名で呼ぶ。札が合えば止める。何度押しても同じ結果。
create or replace function public.mail_unsubscribe(p_token uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_list text;
begin
  update public.mail_subscriptions
     set unsubscribed_at = coalesce(unsubscribed_at, now()), updated_at = now()
   where unsub_token = p_token
  returning list into v_list;
  return v_list;          -- 'weekly' / 'owner_digest' / null（札が違う）
end $$;
revoke all on function public.mail_unsubscribe(uuid) from public;
grant execute on function public.mail_unsubscribe(uuid) to anon, authenticated;
