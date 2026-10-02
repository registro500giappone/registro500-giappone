-- owns_car() を定義者権限で動かす（2026-10-02 適用）
--
-- 症状：イベントの参加表明が「通信エラーが発生しました」で失敗する（POST event_participants → 403 / 42501）。
-- 原因：owns_car()（rls_owner_scope_2026-09-30.sql）は cars.owner_email を読むが、authenticated には
--   owner_email 列の SELECT 権限が無い（個人情報保護のため列単位で外してある）。呼び出し元の権限で動く
--   関数だったため、持ち主本人でも判定そのものが "permission denied for table cars" で落ちていた。
--   影響＝owns_car を使う書込ポリシー全部（events / event_participants / car_episodes の持ち主操作）。
-- 対処：返すのは真偽値だけなので、定義者権限で動かしても列の中身は漏れない。search_path は固定済み。

alter function public.owns_car(text) security definer;
revoke all on function public.owns_car(text) from public;
grant execute on function public.owns_car(text) to anon, authenticated;
