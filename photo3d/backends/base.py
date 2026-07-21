"""バックエンド抽象（プラン§3・プラグイン式）.

B1 space-hy2mv / B2 local-hy21 / B3 vggt-sparse / B4 photogrammetry が
このインターフェースを実装する（Phase 2以降）。

Phase 2実装にあたり run() のシグネチャを具体化した（当初案の
project_dir->Path だと視点画像の割当（総当たりモード含む）を渡せない
ため、views辞書＋出力先パスを受け取り生成メタ情報dictを返す形にした）。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path


class Backend(ABC):
    """3D生成バックエンドの共通インターフェース."""

    name: str = "base"
    kind: str = "generative"  # generative（生成AI） / measured（実測）
    min_photos: int = 1
    max_photos: int = 4

    @abstractmethod
    def requirements_check(self) -> tuple[bool, str]:
        """実行可能かどうかと理由を返す（GPU/トークン/外部バイナリ等）."""

    @abstractmethod
    def run(self, views: dict[str, "Path | None"], out_path: Path, **kwargs) -> dict:
        """views（front/back/left/right -> 前処理済み画像パス）から候補GLBを
        生成し out_path に保存する。生成メタ情報（elapsed_sec等）のdictを返す。"""
