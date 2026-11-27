-- 配信停止のあとの「任意の1問」と「週1のまとめに切り替える」（2026-11-27 ユーザー承認）
--   ・理由は選択肢だけ・誰の答えかは残さない（mail_unsub_reasons にメールアドレスも札も入れない）
--   ・同じ札で答えられるのは1回だけ（mail_subscriptions.followup_at）・停止から7日以内
--   ・切り替え＝朝のメール（owner_digest）を止めた人を週刊便り（weekly）に入れる。source='owner_switch'
--     （オーナーは登録時にポリシーへ同意済み＝Amici の申し込みのような同意の取り直しは求めない）
--   止める動作そのもの（public.mail_unsubscribe）は変えない。

alter table public.mail_subscriptions add column if not exists followup_at timestamptz;

alter table public.mail_subscriptions drop constraint mail_subscriptions_source_check;
alter table public.mail_subscriptions add constraint mail_subscriptions_source_check
  check (source = any (array['signup','former_owner','owner','owner_switch']));

alter table public.mail_subscriptions drop constraint mail_subscriptions_check;
alter table public.mail_subscriptions add constraint mail_subscriptions_check
  check (list <> 'weekly' or source = 'owner_switch'
         or (user_id is not null and consented_at is not null and policy_version is not null));

create table if not exists public.mail_unsub_reasons (
  id bigint generated always as identity primary key,
  list text not null,
  reason text not null check (reason in ('too_many', 'not_interested', 'timing', 'other')),
  created_at timestamptz not null default now()
);
alter table public.mail_unsub_reasons enable row level security;   -- ポリシーなし＝読めるのは管理人（service）だけ
revoke all on public.mail_unsub_reasons from anon, authenticated;

create or replace function public.mail_unsub_followup(p_token uuid, p_reason text default null, p_weekly boolean default false)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r public.mail_subscriptions;
  v_uid uuid;
  v_out text := 'ok';
begin
  select * into r from public.mail_subscriptions where unsub_token = p_token and unsubscribed_at is not null;
  if not found then return null; end if;          -- 札が違う・止めていない

  if p_reason is not null then
    if p_reason not in ('too_many', 'not_interested', 'timing', 'other') then return null; end if;
    if r.followup_at is null and r.unsubscribed_at > now() - interval '7 days' then
      insert into public.mail_unsub_reasons (list, reason) values (r.list, p_reason);
      update public.mail_subscriptions set followup_at = now() where id = r.id;
    end if;
  end if;

  if p_weekly and r.list = 'owner_digest' then
    select id into v_uid from auth.users where lower(email) = r.email limit 1;
    insert into public.mail_subscriptions (list, email, user_id, source, consented_at)
    values ('weekly', r.email, v_uid, 'owner_switch', now())
    on conflict (list, email) do update set unsubscribed_at = null, updated_at = now();
    v_out := 'weekly';
  end if;
  return v_out;
end $$;

revoke all on function public.mail_unsub_followup(uuid, text, boolean) from public;
grant execute on function public.mail_unsub_followup(uuid, text, boolean) to anon, authenticated;
