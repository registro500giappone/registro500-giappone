# 信頼チャンネル昇格候補リスト（Tier3発掘・保存版）

> 生成日: 2026-06-30（DB実値スナップショット）。
> 目的: キーワード検索（Tier3）で**2本以上**ヒットした＝「実力で複数回引っかかった」優良個人/ガレージを記録。
> 現状これらは**検索で拾えた数本しかDBに入っていない**。`fetch_config.json` の `trusted_channels` に追加すれば
> playlistItems でチャンネルまるごと取得でき、各10〜50本級の優良How-toが入る可能性が高い。
> **追加は別途検討（このリストは保存のみ・まだ昇格していない）**。承認時に tier(1/2) を付けて config へ転記する。

## 昇格候補（Tier3で複数ヒット・howto率高い順を考慮）

| 候補ch | channel_id | 拾えた本数 | How-to | 平均再生 | 最高再生 | メモ |
|---|---|---|---|---|---|---|
| The 500 Workshop | UCQUiso_9iuRnFuCgZ72POkw | 10 | 10 | 2,736 | 9,434 | 英・個人ガレージ。全件How-to＝質が安定。本命候補 |
| OldCars Palermo | UCsgNq_Ro-Hgumh6-tPTNEpA | 9 | 9 | 97,647 | 220,272 | 伊・レストア工房。再生数も高い。本命候補 |
| Fox Speedshop | UCBvLQPaCzswf_esv6jvETwg | 5 | 5 | 7,459 | 16,588 | 改造/レストア |
| Aircooled Project | UCsAz8XwQcahj38QeNPGxD1g | 4 | 4 | 23,053 | 34,705 | 空冷専門 |
| Fiat 500 Club Italia | UCwRjMyj3ZNHKMlyF_giS7RQ | 4 | 4 | 21,728 | 27,616 | クラブ公式 |
| Making, Cooking, Fixing | UCYKPGghDIwYxDoa1RmipHqQ | 4 | 4 | 4,601 | 9,536 | DIY |
| sonoandrea | UCDHlAaD_5RZefRMBSRB18fg | 3 | 3 | 4,722 | 9,273 | 個人 |
| Maxwell Conticelli | UCBw6m7okp8pSs7DZ759pv1A | 3 | 3 | 3,218 | 5,742 | 個人 |
| Nanna's Garage | UCSHKVrrIN1nv_ynDuwjJgAA | 2 | 2 | 109,655 | 160,289 | 再生数突出。要中身確認 |
| rosa malangone | UCnimzooukcaU_9NQFjOKcow | 2 | 2 | 56,790 | 59,724 | 高再生 |
| Una passione per sempre | UChom5r8JARnUOoXt9doU0dg | 2 | 2 | 53,347 | 63,703 | 高再生 |
| Berghem Garage | UCVtZcl0CPMyM-Bav-gLDVCw | 2 | 2 | 32,060 | 49,158 | ガレージ |
| Giovanni Corrao (gio.500) | UCsMf6T5ZYLSEAtd80Lk6tMg | 2 | 2 | 24,036 | 37,052 | 個人 |
| max monkey garage oliena | UCqtLUQ7gtV83xZA2-P_wBMw | 2 | 2 | 8,335 | 15,824 | ガレージ |
| Vergaseronkel | UCH142Knh51GhDyK4z5OAucQ | 2 | 2 | 3,531 | 3,632 | 独・キャブ系か（要確認） |

## 抽出の仕組み（発見ループ・帰宅後にPlan mode化予定）
1. キーワード検索（Tier3）で広く網を張る ＝ 既に稼働
2. **Tier3を集計し「2本以上ヒット × How-to率 × 再生数」で昇格候補を自動リストアップ**（＝この表の生成クエリ）
3. 目視承認 → 承認chを `fetch_config.json` に tier付きで追加 → playlistItems でまるごと取得
4. 次回検索でまた新しい個人が浮かぶ → 2へ（芋づる式）

### 候補昇格時の検討事項（メモ）
- 再生数が突出するch（Nanna's/rosa malangone等）は「整備How-to」か「走行/イベント」かを中身確認してから tier 決定。
- 言語バランス（伊が厚い・英/日が薄い）を見て、英・日寄りを優先昇格すると多様性が出る。
- 現行型500/126混入は分類ガード（youtube_classify）が落とすが、まるごと取得は母数が増えるので除外語の効きを再確認。

### 再生用クエリ（このリストの再生成）
```sql
select channel_name, channel_id, count(*) hits,
  count(*) filter (where is_howto) howto,
  round(avg(view_count)) avg_views, max(view_count) top_views
from videos where source_tier=3 and channel_id is not null
group by channel_name, channel_id having count(*) >= 2
order by hits desc, avg_views desc;
```
