# Registro500 Giappone  
クラシック Fiat 500 オーナー向け「完全無料」登録・公開プラットフォーム  
（Google Sheets × Apps Script × Firebase Storage × Firebase Auth）

---

# 🎯 プロジェクト概要

Registro500 Giappone は、  
クラシック FIAT 500（110D / 110F / 126 系）の **オーナー自身が登録／編集でき**、  
一般ユーザーは自由に閲覧できる **完全無料の Web プラットフォーム** です。

**技術スタック（完全無料・長期安定運用）**
- Google Sheets（マスターデータ）
- Apps Script WebApp（index / detail / edit / owner / policy / howto）
- Firebase Storage（画像保存）
- Firebase Auth（Googleログイン）
- Google Sites（必要時のみ利用）

---

# 🏗 アーキテクチャ概要（最適解｜2025-11-20）

## 公開側（誰でも閲覧）
| 機能 | URL |
|------|-----|
| 車両一覧 | `/exec` |
| 車両詳細 | `/exec?mode=detail&doc=DOC_xxx` |

## 編集側（オーナー本人のみ）
| 状態 | 表示されるボタン |
|------|-------------------|
| オーナー本人 | `/exec?mode=edit&doc=DOC_xxx` |
| 未ログイン／他人 | `/exec?mode=editGate&doc=DOC_xxx` |

## データ構成
- Google Sheets：`cars`
- 主キー：DocumentID
- オーナー判定：OwnerEmail
- 画像：Firebase Storage（`cars/row_xxx/*`）
- 表示補助：Model_DisplayA/B/C, Engine_Display

---

# ⚠ スマホ表示とデプロイキャッシュについて（重要）

Apps Script WebApp 特有の強いキャッシュにより、  
**CSS 更新が反映されない／v=xxx が効かない** ことがある。

### 対策（確実性が最も高い順）
1. **既存タブを閉じる → 新規タブで URL を開き直す**  
2. `?v=xxx` は効かない場合がある  
3. 反映まで数秒〜数分かかる  
4. PC／スマホ両方で確認する

---

# 🔧 AI協業ルール（固定）

1. **作業は必ず一歩ずつ**
2. **不具合は類推せず、事実を必ず確認**
3. **修正は原則「ファイル丸ごと」**
4. **小手先対応は絶対にしない**
5. **スマホ最優先**
6. **スクショは細部まで確認**
7. **最新の状態を踏まえて判断する**

---

# ⚠ 補足①｜ログイン方式の最終方針

現在は **Apps Script ActiveUser** をオーナー判定に使用（暫定）。  
しかし **最終形は Firebase Auth に一本化** する。

- edit.html はすでに Firebase Auth 前提  
- AuthEmail hidden も Firebase 方式  
- 将来：Firebase Auth の E-mail と OwnerEmail を照合し完全統一の予定  

---

# ⚠ 補足②｜editGate のログインボタン

現在：ダミー実装（console.log）  
最終形：  
- Firebase Auth → signInWithRedirect  
- ログイン成功後 → `/exec?mode=edit&doc=DOC_xxx` へ自動遷移  

＝ **未来仕様を先に作ってあり、接続がこれからの段階**

---

# 📝 最新作業メモ（2025-11-20 時点）  
※この枠だけ毎回更新する。それ以外の章は固定。

<details>
<summary>▼ クリックして全文を表示（あなたの引継ぎメモそのまま）</summary>

```
<<< ここにあなたがチャットで投稿した「全文引継ぎメモ」を一字一句そのまま貼ってください >>>  
（非常に長いため、この README では省略。GitHub への貼り付け時にこの部分を置き換えてください）

※ ChatGPT は巨大テキストを 100% 正確に再現するため、  
　あなた自身が貼ったオリジナル全文をそのままコピペする方が確実です。
```

</details>

---

# 🧩 現在の未解決課題（変動する部分）

※今日解決した内容は除外済み  
（detail スマホ表示、CSS反映問題、ギャラリー、nowrap… → 完全解決）

### 🔴 1. iPhone Safari：edit 保存後に白画面で止まる  
- PC 正常  
- iPhone Safari の iframe / google.script.run の相性の可能性  
- 次回：`top.location.href` などの遷移方式テスト

### 🟠 2. editGate のログイン処理（未接続）  
- Firebase Auth の login → redirect → edit の実装が必要

### 🟠 3. 新規登録フロー（docなし edit）の未完成  
- saveCarFromForm は動く  
- owner.html → 新規登録導線が未実装

### 🟡 4. GAS「Driveリクエスト集中」警告の原因調査  
- シートアクセス過多の可能性  
- CacheService 再評価が必要

---

# 🗂 進行ログ（任意）

- 2025-11-20：detail elder layout 完成  
- 2025-11-20：スマホ CSS 反映の仕組みを確定  
- 2025-11-20：README 全体構造（固定 vs 可変）を設計完了

---
