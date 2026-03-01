# RLS ポリシー バックアップ

**最終更新**: 2026-02-18
**状態**: edit.html 復旧後

---

## ⚠️ 重要な教訓

### 今回の失敗
1. セキュリティ修正前にポリシー定義をバックアップしなかった
2. Firebase Auth を使っているのに、Supabase Auth 用のポリシー（`auth.uid()`）を適用した
3. 既存機能（車両登録、スポット登録）が壊れた

### 今後の対策
1. **変更前に必ずバックアップを取る**（下記のSQLを実行）
2. **変更後は必ず動作確認する**
3. **段階的に修正する**（一度に全テーブルを変更しない）

---

## 📋 バックアップ手順

### Supabase SQL Editorで実行：

\`\`\`sql
-- すべてのポリシーのCREATE文を生成
SELECT
  'DROP POLICY IF EXISTS "' || policyname || '" ON ' || tablename || ';' || E'\\n' ||
  'CREATE POLICY "' || policyname || '" ON ' || tablename || E'\\n' ||
  '  FOR ' ||
  CASE cmd
    WHEN '*' THEN 'ALL'
    ELSE cmd
  END || E'\\n' ||
  CASE
    WHEN qual IS NOT NULL THEN '  USING (' || qual || ')' || E'\\n'
    ELSE ''
  END ||
  CASE
    WHEN with_check IS NOT NULL THEN '  WITH CHECK (' || with_check || ');'
    ELSE ';'
  END || E'\\n'
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
\`\`\`

**結果をコピーして、日付入りファイルに保存：**
- `policies_backup_YYYYMMDD.sql`

---

## 📊 現在のポリシー状態（2026-02-18 復旧後）

### cars テーブル
\`\`\`sql
CREATE POLICY "cars_select_policy" ON cars FOR SELECT USING (true);
CREATE POLICY "cars_insert_policy" ON cars FOR INSERT WITH CHECK (true);
CREATE POLICY "cars_update_policy" ON cars FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cars_delete_policy" ON cars FOR DELETE USING (true);
\`\`\`

### events テーブル
\`\`\`sql
CREATE POLICY "events_select_policy" ON events FOR SELECT USING (true);
CREATE POLICY "events_insert_policy" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "events_update_policy" ON events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "events_delete_policy" ON events FOR DELETE USING (true);
\`\`\`

### spots テーブル
\`\`\`sql
CREATE POLICY "spots_select_policy" ON spots FOR SELECT USING (true);
CREATE POLICY "spots_insert_policy" ON spots FOR INSERT WITH CHECK (true);
CREATE POLICY "spots_update_policy" ON spots FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "spots_delete_policy" ON spots FOR DELETE USING (true);
\`\`\`

**注**: 他のテーブルのポリシーは上記SQLで確認して追記してください。

---

## 🔍 削除された古いポリシー（参考）

### cars テーブルの旧ポリシー名
- "Enable insert access with validation"
- "Enable read access for everyone"
- "Enable update access based on email"

**定義は不明（バックアップなし）**

---

## 🚨 Security Advisor の警告について

### 現在の警告（2026-02-18 確認）
1. **function_search_path_mutable**: update_spot_registration_count 関数（1件）
2. **rls_policy_always_true**: cars/events/spots の INSERT/UPDATE/DELETE（9件）

### 対処方針（2026-02-18 決定）

#### ✅ 対処する警告
- **function_search_path_mutable**: 関数に `SET search_path = public, pg_temp` を追加

#### ⚠️ 許容する警告（9件）
- **cars/events/spots の INSERT/UPDATE/DELETE ポリシー**

**理由**:
1. **既存機能が UPDATE/DELETE を使用**
   - edit.html: `.upsert()` で車両編集
   - detail.html: `.delete()` で車両削除
   - UPDATE/DELETE を禁止すると、これらの機能が壊れる

2. **Supabase の `auth.uid()` は使えない**
   - Firebase Auth を使用しているため
   - Firebase Auth のトークンを Supabase に渡す実装がない
   - `auth.uid() IS NOT NULL` のポリシーは機能しない

3. **現状のセキュリティ**
   - UIレベルで Firebase Auth による認証を実装済み
   - 未認証ユーザーはフォームにアクセスできない
   - ただし、API を直接叩けば未認証でも操作可能（理論上のリスク）

### 将来的な改善案（優先度: 低〜中）

#### 短期的な改善
1. **GAS 経由への移行**
   - edit.html/detail.html を GAS 経由に書き換え
   - GAS では service_role key を使用して RLS をバイパス
   - フロントエンドの RLS ポリシーを厳格化
   - 実装コスト: 🔴 高

#### 長期的な改善
2. **Firebase Auth と Supabase の統合**
   - Firebase Auth のトークンを Supabase に渡す実装を追加
   - RLS ポリシーで `auth.uid()` を使用可能にする
   - Security Advisor の警告を完全に解消
   - 実装コスト: 🔴 非常に高

**判断**: 現状で機能しているため、無理に変更しない。警告は許容する。

---

## 📝 変更履歴

### 2026-02-18
- security_fix_v4.sql 実行 → 車両登録エラー発生
- `WITH CHECK (true)` に変更 → 復旧
- このドキュメント作成

---

**今後は変更前に必ずこのドキュメントを更新してください。**
