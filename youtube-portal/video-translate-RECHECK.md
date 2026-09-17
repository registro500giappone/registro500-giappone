# video-translate.html 情報鮮度の再測手順（正本）

対象ページ：`/video-translate`（外国語動画を自分で正確に日本語化する道案内）
このページは**外部サービスの現状**を書いているため、放置すると必ず古くなる。
**目安＝3ヶ月ごと**（初回作成 2026-08-24 → 次回目安 **2026-11**）に以下を再測し、
ページ末尾の「このページの内容は YYYY年M月 に実測・確認したものです」を更新する。
再測①（AI吹き替えの対応範囲）が一番動く箇所なのでこの周期。**2回転ほど回して
変化が無ければ半年ごとに緩めてよい**（緩めたらこの行を書き換える）。

## 事前準備（数分）

```bash
# 使い捨ての仮想環境でよい（リポジトリ内に venv を作らない）
python -m venv %TEMP%\vt-recheck && %TEMP%\vt-recheck\Scripts\pip install yt-dlp
```

## 再測①｜YouTube AI吹き替えの対応範囲（方法Aの前提・一番動きそうな箇所）

イタリア語の FIAT 専門動画に日本語音声が付き始めたかを見る。

```bash
cd youtube-portal
%TEMP%\vt-recheck\Scripts\python recheck_audio_tracks.py FrAGcnjLiyo NhIGTKMIuKs ce_YZByHmEw xHyqua7c5ro l0UOIiNU6Ew IQiHGkIE5F0
# ↑ Donne in 500 / OldCars Palermo 等のイタリア語動画ID。audio_tracks.txt に結果が出る
```

- **判定**：`日本語音声: ★あり` がイタリア語動画に現れたら、方法Aの
  「イタリア語の FIAT 専門動画にはまだ少なく」の記述を実態に合わせて書き換える。
- 2026-08-24 の実測：人気12本中、日本語音声あり6本＝**すべて英語原語**。イタリア語原語は0本。

## 再測②｜YouTube 自動翻訳字幕の品質（ビフォーアフター例の鮮度）

ページに載せている誤訳例（sedi→「オフィス清掃」、cielo→「空模様」）が直っていないかを見る。

```bash
cd youtube-portal
%TEMP%\vt-recheck\Scripts\python -m yt_dlp --skip-download --write-auto-subs ^
  --sub-langs "it-orig,ja" --sub-format vtt --sleep-subtitles 20 ^
  -o "subs/%%(id)s.%%(ext)s" "https://www.youtube.com/watch?v=FrAGcnjLiyo"
%TEMP%\vt-recheck\Scripts\python recheck_vtt_compare.py subs/FrAGcnjLiyo.it-orig.vtt subs/FrAGcnjLiyo.ja.vtt compare.json
# compare.json で "sedi" "cielo" "fasce" の行の訳を見る
```

- **判定**：誤訳例が直っていたら、ページのビフォーアフター2枠を**現行の実例に差し替える**
  （直った例を載せ続けると読者に嘘をつくことになる）。断片切れ（文として閉じていない割合）も出るので併記を更新。
- 2026-08-24 の実測：85断片中58個（69%）が文の途中で切れ、専門用語は
  sedi→オフィス清掃／cielo→空模様／paglietta metallica→金属製のページ 等に崩れていた。
- ⚠️ `ja` 字幕はレート制限（HTTP 429）が出やすい。`--sleep-subtitles 20` でも落ちる場合は数分待って再実行。

## 再測③｜方法B・Cの前提リンク（手動・5分）

- [Google AI Studio の APIキー発行](https://aistudio.google.com/apikey) が無料のままか
- [Immersive Translate の Gemini 設定ドキュメント](https://immersivetranslate.com/docs/services/gemini/) が生きているか
- ページ内リンク（gemini.google.com / chatgpt.com / claude.ai / trancy.org）の生存

## 再測④｜スマホの操作手順（実機・1分）

iPhone の YouTube アプリで日本語音声のある動画（例 oDkVVL0CJqk）を開き、
**映像タップ → 右上⚙️ → 音声トラック** の導線が変わっていないか。
（2026-08-24 にユーザーの iPhone 実機で確認済み。この項目は日本語音声のある動画にしか出ない。）

## 書き換えるファイル

- `video-translate.html`（本番。鮮度表記の日付は必ず更新）
- ⚠️ ページの設計判断は変えない：**サイトは翻訳を提供しない（道案内に徹する）**／
  逐語字幕の生成・配信をサイト側で行わない（権利上の一線。経緯は 2026-08-24 のセッション）。
