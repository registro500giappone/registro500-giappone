-- 車を手放した人への「お知らせだけ続けますか？」（1人1回だけ）— 2026-11-04
-- 送ったら mail_former_asks に1行＝二度と聞かない。読み書きは送信スクリプト（service role）と管理人だけ。
create table if not exists public.mail_former_asks (
  email     text primary key check (email = lower(email)),
  car_id    text,                                -- 手放した車（最後に手放したもの）
  asked_at  timestamptz not null default now()
);
alter table public.mail_former_asks enable row level security;
drop policy if exists mail_former_asks_admin on public.mail_former_asks;
create policy mail_former_asks_admin on public.mail_former_asks for select to authenticated
  using (public.is_admin());

-- 問いかけのリンク（/amici?from=former）から登録した人は、入口を former_owner として残す（それ以外は signup に固定）
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
    new.source := case when new.source = 'former_owner' then 'former_owner' else 'signup' end;
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
