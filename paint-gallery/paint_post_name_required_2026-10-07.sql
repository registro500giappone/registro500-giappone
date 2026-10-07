-- みんなのお絵描き帳：ゲスト投稿（車に紐づけない投稿）は名前を必須にする（2026-10-07）
-- 車に紐づく投稿は登録のハンドルネームを使うので対象外。既存の名前なし投稿はそのまま（一覧では「ゲスト」と出る）
CREATE OR REPLACE FUNCTION public.paint_post_create(p_car_type text, p_design text, p_thumb_path text, p_comment text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_car_doc text DEFAULT NULL::text, p_delete_key text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_design text := coalesce(p_design, '');
  v_comment text := nullif(btrim(coalesce(p_comment,'')), '');
  v_name text := nullif(btrim(coalesce(p_name,'')), '');
begin
  if p_car_type not in ('500','126') then raise exception 'bad car_type'; end if;
  if char_length(v_design) > 3000 then raise exception 'bad design'; end if;
  if v_comment is not null and char_length(v_comment) > 40 then raise exception 'comment too long'; end if;
  if v_name is not null and char_length(v_name) > 20 then raise exception 'name too long'; end if;
  if p_thumb_path !~ ('^' || p_car_type || '/[0-9a-f-]{36}\.jpg$') then raise exception 'bad thumb'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'paint-thumbs' and name = p_thumb_path) then
    raise exception 'thumb missing';
  end if;
  if (select count(*) from paint_posts where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate limited';
  end if;
  if p_car_doc is not null then
    if v_uid is null or not exists (select 1 from cars where document_id = p_car_doc and owner_user_id = v_uid) then
      raise exception 'not your car';
    end if;
    insert into paint_posts (car_type, design, thumb_path, comment, car_doc, user_id)
    values (p_car_type, v_design, p_thumb_path, v_comment, p_car_doc, v_uid)
    returning id into v_id;
  else
    if p_delete_key is null or char_length(p_delete_key) < 32 then raise exception 'bad key'; end if;
    if v_name is null then raise exception 'name required'; end if;
    insert into paint_posts (car_type, design, thumb_path, comment, visitor_name, user_id, delete_key_hash)
    values (p_car_type, v_design, p_thumb_path, v_comment, v_name, v_uid,
            encode(sha256(convert_to(p_delete_key, 'UTF8')), 'hex'))
    returning id into v_id;
  end if;
  return v_id;
end $function$;
