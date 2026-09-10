-- ============================================================
-- 「この1台の歩み」年表: car_history テーブル + cars トリガー migration 起案
-- 状態: ✅適用済み（2026-09-10・migration `car_history_timeline_2026_09_10` ＋
--        `car_history_trigger_fn_revoke_execute`。検算＝registered 170／updated 59／sold 1）
-- 根拠: 計画 C:\Users\akayu\.claude\plans\pure-drifting-kite.md の Part A-1
--   （2026-09-10 ユーザー確定＝更新履歴はDBトリガーで car_history に貯め始める）
-- 決定:
--   ・行の種類は 'registered' | 'updated' | 'sold' | 'unsold' の4種
--   ・書き込みはトリガーのみ（anon/authenticated は insert/update/delete 不可）
--   ・SNS許諾・メール変更（edit.html:988, 1226）は対象外＝トリガー条件に入れない
--   ・cars は列レベルGRANTに切り替え済（risk-instructions.md:61-64）だが
--     トリガーは SECURITY DEFINER で動くため影響なし。新テーブルの GRANT は明示する
-- 対象外: fetchHistory 側の描画（Part A-2・detail.html）はこのSQLに含まない
-- 参考: edit.html:928-930（last_update_fields/last_update_date の保存経路）・
--       edit.html:1020-1022（is_sold/sold_at の直接UPDATE経路）
-- ============================================================

-- ------------------------------------------------------------
-- A. car_history テーブル
-- ------------------------------------------------------------
create table public.car_history (
  id bigint generated always as identity primary key,
  car_id text not null,                 -- cars.document_id（他テーブルと同じ参照方式）
  kind text not null,                   -- 'registered' | 'updated' | 'sold' | 'unsold'
  fields text,                          -- updated のとき cars.last_update_fields をそのまま
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index car_history_car_idx on public.car_history (car_id, occurred_at desc);

alter table public.car_history enable row level security;

create policy car_history_public_read on public.car_history
  for select using (true);
-- insert/update/delete のポリシーは作らない＝クライアントは書けない。書くのはトリガーだけ

grant select on public.car_history to anon, authenticated;
revoke insert, update, delete on public.car_history from anon, authenticated;

-- ------------------------------------------------------------
-- B. トリガー関数（SECURITY DEFINER・RLSを迂回して1行だけ挿入する意図的な設計）
-- ------------------------------------------------------------

-- B-1. 新規登録
create or replace function public.car_history_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.car_history (car_id, kind, occurred_at)
  values (new.document_id, 'registered', new.created_at);
  return new;
end;
$$;

drop trigger if exists car_history_after_insert on public.cars;
create trigger car_history_after_insert
  after insert on public.cars
  for each row
  execute function public.car_history_on_insert();

-- B-2. 更新・売却/売却取消
-- tr_set_doc_id は BEFORE INSERT なので、上のINSERTトリガー実行時には
-- new.document_id は採番済み（AFTER INSERTで動くため参照して問題ない）
create or replace function public.car_history_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_sold is distinct from old.is_sold then
    insert into public.car_history (car_id, kind, occurred_at)
    values (
      new.document_id,
      case when new.is_sold then 'sold' else 'unsold' end,
      coalesce(new.sold_at, now())
    );
  end if;

  if new.last_update_date is distinct from old.last_update_date
     and new.last_update_date is not null then
    insert into public.car_history (car_id, kind, fields, occurred_at)
    values (new.document_id, 'updated', new.last_update_fields, new.last_update_date);
  end if;

  return new;
end;
$$;

drop trigger if exists car_history_after_update on public.cars;
create trigger car_history_after_update
  after update on public.cars
  for each row
  execute function public.car_history_on_update();

-- B-3. トリガー関数は REST の /rpc から呼べる必要がない（get_advisors の指摘）。
--      トリガーとしての発火は EXECUTE 権限を要求しないので、取り上げても記録は止まらない
revoke execute on function public.car_history_on_insert() from public, anon, authenticated;
revoke execute on function public.car_history_on_update() from public, anon, authenticated;

-- ------------------------------------------------------------
-- C. バックフィル（このSQL内で1回だけ・冪等）
--    where not exists で二重投入を防ぐ＝このファイルを再実行しても増えない
-- ------------------------------------------------------------

-- C-1. 全車 → registered（created_at）
insert into public.car_history (car_id, kind, occurred_at)
select c.document_id, 'registered', c.created_at
from public.cars c
where not exists (
  select 1 from public.car_history h
  where h.car_id = c.document_id and h.kind = 'registered'
);

-- C-2. last_update_date が created_at より1日以上後の車 → updated 1件（fields付き）
insert into public.car_history (car_id, kind, fields, occurred_at)
select c.document_id, 'updated', c.last_update_fields, c.last_update_date
from public.cars c
where c.last_update_date is not null
  and c.last_update_date > c.created_at + interval '1 day'
  and not exists (
    select 1 from public.car_history h
    where h.car_id = c.document_id and h.kind = 'updated'
  );

-- C-3. is_sold = true の車 → sold（sold_at）
insert into public.car_history (car_id, kind, occurred_at)
select c.document_id, 'sold', coalesce(c.sold_at, now())
from public.cars c
where c.is_sold = true
  and not exists (
    select 1 from public.car_history h
    where h.car_id = c.document_id and h.kind = 'sold'
  );

-- ============================================================
-- 検算コメント
--   A. car_history 1テーブル・index 1本（car_id, occurred_at desc）・
--      RLS有効＋SELECT公開ポリシー1本・GRANT/REVOKEで書き込みは不可
--   B. トリガー関数2本（on_insert／on_update、いずれも SECURITY DEFINER・
--      search_path=public固定）＋ cars への AFTER INSERT/UPDATE トリガー各1本
--   C. バックフィル3本（registered 全車／updated は1日以上差がある車のみ／
--      sold は is_sold=true の車のみ）。すべて not exists ガード付き＝再実行安全
--   期待値の目安: registered ≒ cars の全行数／sold ≒ is_sold=true の行数／
--                 updated は last_update_date が created_at と近い車では0件
--   確認: select kind, count(*) from car_history group by 1;
--   get_advisors で新規の意図しない警告が出ていないか確認する
--   （SECURITY DEFINER 自体の警告は「トリガーの意図通り」として受容）
-- ロールバック:
--   drop trigger if exists car_history_after_insert on public.cars;
--   drop trigger if exists car_history_after_update on public.cars;
--   drop function if exists public.car_history_on_insert();
--   drop function if exists public.car_history_on_update();
--   drop table if exists public.car_history;
-- ============================================================
