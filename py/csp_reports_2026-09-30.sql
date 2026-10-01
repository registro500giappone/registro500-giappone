-- CSP 違反レポートの集計表（2026-09-30 適用済み）
--
-- 流れ： _headers の Content-Security-Policy-Report-Only（report-uri /api/csp-report）
--        → functions/api/csp-report.js が受けて csp_report_log() を呼ぶ → この表で（ページ・ディレクティブ・ブロック先）ごとに数える
-- 読み方： select page, directive, blocked, hits, last_seen from csp_reports order by hits desc;
--
-- 書き込みは Pages Function（service_role の secret key）だけ。anon / authenticated には表も関数も見せない。

create table public.csp_reports (
  id          bigint generated always as identity primary key,
  page        text not null,                 -- 違反が起きたページのパス（クエリ無し）
  directive   text not null,                 -- effective-directive（例: script-src-elem）
  blocked     text not null,                 -- blocked-uri（先頭300字。inline / eval / URL）
  source_file text,                          -- 違反を起こしたスクリプト等（先頭300字）
  line_no     integer,
  sample_ua   text,                          -- 最後に報告してきた User-Agent（先頭200字）
  hits        integer not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  unique (page, directive, blocked)
);
comment on table public.csp_reports is 'CSP Report-Only の違反を（page, directive, blocked）で束ねて数える。書き込みは /api/csp-report（service_role）だけ。';

alter table public.csp_reports enable row level security;
-- ポリシーは作らない（誰にも見せない）。さらに権限そのものも剥がしておく。
revoke all on table public.csp_reports from public, anon, authenticated;

create or replace function public.csp_report_log(
  p_page text, p_directive text, p_blocked text, p_source text, p_line integer, p_ua text
) returns void
language sql
set search_path = public
as $$
  insert into public.csp_reports (page, directive, blocked, source_file, line_no, sample_ua)
  values (left(p_page, 300), left(p_directive, 60), left(coalesce(p_blocked, ''), 300), left(p_source, 300), p_line, left(p_ua, 200))
  on conflict (page, directive, blocked) do update
    set hits        = csp_reports.hits + 1,
        last_seen   = now(),
        source_file = coalesce(excluded.source_file, csp_reports.source_file),
        line_no     = coalesce(excluded.line_no, csp_reports.line_no),
        sample_ua   = coalesce(excluded.sample_ua, csp_reports.sample_ua);
$$;
comment on function public.csp_report_log(text, text, text, text, integer, text) is 'CSP 違反を1件 csp_reports に足す（同じ組は hits +1）。service_role 専用。';

revoke execute on function public.csp_report_log(text, text, text, text, integer, text) from public, anon, authenticated;
grant  execute on function public.csp_report_log(text, text, text, text, integer, text) to service_role;
