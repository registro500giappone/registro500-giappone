-- daily_logins まわりの RPC を service_role 専用にする（2026-09-30 適用）
--
-- sync_daily_logins（auth.sessions を読んで daily_logins へ upsert）と
-- report_daily_logins（日別ログイン人数）は SECURITY DEFINER で、既定の EXECUTE 付与により
-- PUBLIC / anon / authenticated からも /rest/v1/rpc/ 経由で呼べる状態だった。
-- 呼び出し元は GitHub Actions（service_role キー）だけ：
--   .github/workflows/daily-login-collect.yml → py/collect_daily_logins.py
--   .github/workflows/weekly-report.yml       → py/gen_report.py
-- service_role への明示 GRANT は既にあるので、それ以外を剥がすだけで運用は変わらない。

revoke execute on function public.sync_daily_logins(date)      from public, anon, authenticated;
revoke execute on function public.report_daily_logins(integer) from public, anon, authenticated;
