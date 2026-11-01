-- 2026-11-01 車名（model_display_c）の重複結合を防ぐ
-- 事例: 車種もグレードも「その他」で同じ文字列を入れると「X X」と2回並んだ（DOC_178）。
-- 規則: A と B が同じ → A だけ／A が「… B」で終わる → A だけ／B が「A …」で始まる → B だけ
--       （大文字小文字は区別しない。部分一致は使わない＝「FIAT ABARTH」+「F」を誤って落とさないため）

CREATE OR REPLACE FUNCTION public.handle_car_display_names()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  a text;
  b text;
BEGIN
  -- model_display_a の計算
  NEW.model_display_a := CASE WHEN NEW.model_select_a = 'その他' THEN NEW.model_text_a ELSE NEW.model_select_a END;

  -- model_display_b の計算
  NEW.model_display_b := CASE WHEN NEW.model_select_b = 'その他' THEN NEW.model_text_b ELSE NEW.model_select_b END;

  -- model_display_c の合体 (A + B)
  -- model_display_b が '標準' / '不明' のときは車名の一部ではないので結合しない
  -- A と B が重なるとき（同じ・片方の端にもう片方が丸ごと入る）は長いほうだけ
  a := TRIM(COALESCE(NEW.model_display_a, ''));
  b := TRIM(COALESCE(NEW.model_display_b, ''));
  NEW.model_display_c := CASE
    WHEN b = '' OR b IN ('標準', '不明') THEN a
    WHEN a = '' THEN b
    WHEN lower(a) = lower(b) THEN a
    WHEN right(lower(a), length(b) + 1) = ' ' || lower(b) THEN a
    WHEN left(lower(b), length(a) + 1) = lower(a) || ' ' THEN b
    ELSE a || ' ' || b
  END;

  -- engine_display の計算
  NEW.engine_display := CASE WHEN NEW.engine_type_select = 'その他' THEN NEW.engine_type_text ELSE NEW.engine_type_select END;

  RETURN NEW;
END;
$function$
;
