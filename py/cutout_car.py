"""車両写真の背景を抜いて、シミュレーターの並走アニメ用のスプライト PNG を作る（オフライン工程）。

  python py/cutout_car.py <URL または ローカルパス> <出力.png> [--height 240] [--flip] [--shadow]

- 背景除去は rembg（u2net）。初回だけモデルを自動ダウンロードする。
- 余白を切り詰め、高さを --height に揃える（幅は比率のまま）。--flip で左右反転（進行方向を右向きに揃える）。
- --shadow で足元に薄い楕円の影を焼き込む（別レイヤーにしたければ付けない）。
- 出力先は呼び出し側が決める。公開 repo に置くのは掲載許可のある車両写真だけ（サイトに既に出ている写真＝可）。
"""
import argparse
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def load_image(src: str) -> Image.Image:
    if src.startswith("http://") or src.startswith("https://"):
        import requests

        r = requests.get(src, timeout=60)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGBA")
    return Image.open(src).convert("RGBA")


def remove_bg(img: Image.Image) -> Image.Image:
    from rembg import remove, new_session

    session = new_session("u2net")
    out = remove(img, session=session, alpha_matting=True, alpha_matting_foreground_threshold=240,
                 alpha_matting_background_threshold=10, alpha_matting_erode_size=10)
    return out.convert("RGBA")


def trim(img: Image.Image, pad: int = 4) -> Image.Image:
    a = np.array(img)[:, :, 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return img
    x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad, img.width - 1), max(ys.min() - pad, 0), min(ys.max() + pad, img.height - 1)
    return img.crop((x0, y0, x1 + 1, y1 + 1))


def add_shadow(img: Image.Image) -> Image.Image:
    w, h = img.size
    sh_h = max(int(h * 0.10), 6)
    canvas = Image.new("RGBA", (w + 20, h + sh_h // 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow)
    d.ellipse((6, h - sh_h // 2, w + 14, h + sh_h // 2), fill=(20, 20, 20, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(sh_h // 3))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(img, (10, 0))
    return canvas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--height", type=int, default=240)
    ap.add_argument("--flip", action="store_true")
    ap.add_argument("--shadow", action="store_true")
    a = ap.parse_args()

    img = load_image(a.src)
    img.thumbnail((1600, 1600))  # 処理時間と品質の折り合い
    cut = trim(remove_bg(img))
    if a.flip:
        cut = cut.transpose(Image.FLIP_LEFT_RIGHT)
    scale = a.height / cut.height
    cut = cut.resize((max(int(cut.width * scale), 1), a.height), Image.LANCZOS)
    if a.shadow:
        cut = add_shadow(cut)
    Path(a.dst).parent.mkdir(parents=True, exist_ok=True)
    cut.save(a.dst, optimize=True)
    print(f"saved {a.dst} {cut.width}x{cut.height}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
