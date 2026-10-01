-- parts_snapshots を「変化した日だけ残す」形に間引き、以後もその形で記録する（2026-09-30 適用）
--
-- 背景：Free プランの DB 上限 0.5GB を超えた（0.552GB）。うち 460MB が parts_snapshots
-- （parts 約3.3万点を毎日全件＝89日で294万行）。約7割は前日と同値、残りも大半は
-- ユーロ以外の通貨の店（Ricambio / AutoBella / Mr Fiat）の為替換算の端数の揺れだった。
-- 画面からの参照は無い（内部分析用・service_role のみ）。
--
-- 1) 既存データ：同じ部品で前日の行と価格・在庫とも完全一致する行を消す（情報は失わない＝
--    「次の行まで同じ値だった」と読めばよい）。消した後は VACUUM FULL で容量を返す。
-- 2) 記録関数：初めて見た部品／在庫が変わった／価格が前回記録から 2% 以上動いた、の
--    どれかのときだけ1行書く。為替の小さな揺れは記録しない。
--    ⚠️ 読むときは「行が無い日＝直前の行と同じ（為替の揺れ ±2% 未満を含む）」と解釈する。

-- ⚠️ 294万行を1文で消すと statement timeout で落ちる（migration は丸ごと取り消された）。
--    実際は statement_timeout を延ばし、日付を15日ずつ【新しい方から】消した
--    （古い方から消すと、比較相手の前日行が先に消えてしまう）。データは毎日欠けなく
--    全件あったので「前の行＝前日の行」。結果 886,962 行＝事前に lag で数えた
--    初出 33,163＋変化 853,799 と一致。460MB → VACUUM FULL 後 130MB（DB 全体 182MB）。
--    VACUUM は execute_sql に単独の1文で渡す（set 等と並べるとトランザクション扱いで拒否）。
set statement_timeout = '10min';
delete from public.parts_snapshots s using public.parts_snapshots p
 where s.snapshot_date between '2026-09-15' and '2026-09-29'   -- 以下 08-31〜09-14, 08-16〜08-30,
   and p.snapshot_date = s.snapshot_date - 1                    -- 08-01〜08-15, 07-17〜07-31,
   and p.part_id = s.part_id                                     -- 07-04〜07-16 の順に同じ文
   and s.price_euro   is not distinct from p.price_euro
   and s.stock_status is not distinct from p.stock_status;

create or replace function public.take_parts_snapshot()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  inserted_count integer;
begin
  with last as (
    select distinct on (part_id) part_id, price_euro, stock_status
      from public.parts_snapshots
     order by part_id, snapshot_date desc
  )
  insert into public.parts_snapshots (snapshot_date, part_id, shop_name, price_euro, stock_status)
  select current_date, p.id, p.shop_name, p.price_euro, p.stock_status
    from public.parts p
    left join last l on l.part_id = p.id
   where l.part_id is null
      or p.stock_status is distinct from l.stock_status
      or (p.price_euro is distinct from l.price_euro
          and (p.price_euro is null or l.price_euro is null or l.price_euro = 0
               or abs(p.price_euro - l.price_euro) / abs(l.price_euro) >= 0.02))
  on conflict (snapshot_date, part_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$function$;

comment on table public.parts_snapshots is
  '内部分析用: parts の価格・在庫の変化点だけを記録する時系列（2026-09-30 から）。初出・在庫変化・価格が前回記録から2%以上動いた日にだけ行がある。行が無い日＝直前の行と同じ（±2%未満の為替の揺れを含む）。2026-09-29 以前は完全一致の日だけ間引いた。RLS有効・公開ポリシーなし（service_roleのみ）。';

-- 適用後に別途実行（トランザクション外で）: vacuum full public.parts_snapshots;
