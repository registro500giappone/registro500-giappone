# -*- coding: utf-8 -*-
"""部品位置・配線ルートを PowerPoint 上で指定してもらうためのファイルを作る。

  紙に手書きする代わりに、パワポの図形をドラッグして置いてもらう。
  ⚠️こうする理由＝図形の座標(EMU)を読めば位置が数値で取れる。読み取りは read_pptx.py。
  ⚠️図の縮尺は「画像図形の実際の位置と大きさ」から逆算するので、
    ユーザーが図を動かしても拡大しても正しく読める（画像の名前に対応表を埋めてある）。
  ⚠️車体の線画そのものを描くのは carview.py（確認画像 make_layout_review.py と共通）。

  出力: _handwrite_FIAT500F.pptx（repo直下・git管理外の作業ファイル）
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation
from pptx.util import Mm, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from carview import render, PAPER_W, ROOT

DST = ROOT + '/_handwrite_FIAT500F.pptx'
IMGD = ROOT + '/wiring-simulator/ref/_pptx_img'


# 置いてもらう部品。id は wiring-net.json の parts と合わせてある
PARTS = [
    ('battery', 'バッテリー'), ('quadro', 'メーター'),
    ('ign_sw', 'キースイッチ'), ('starter_sw', '始動レバー'),
    ('starter', 'スターター'), ('dynamo', 'ダイナモ'),
    ('regulator', 'レギュレータ'), ('f1', 'ヒューズ箱'),
    ('oil_sender', '油圧センダ'), ('body', '車体アース'),
    ('free1', '（自由記入1）'), ('free2', '（自由記入2）'),
    ('free3', '（自由記入3）'), ('free4', '（自由記入4）'),
]

TXT = RGBColor(0x3a, 0x35, 0x2c)
SUB = RGBColor(0x8d, 0x85, 0x74)
ACC = RGBColor(0x2f, 0x5d, 0x50)


def tb(sl, x, y, w, h, s, size=10, bold=False, color=TXT):
    t = sl.shapes.add_textbox(Mm(x), Mm(y), Mm(w), Mm(h)).text_frame
    t.word_wrap = True
    t.margin_left = t.margin_right = t.margin_top = t.margin_bottom = 0
    for i, line in enumerate(s.split('\n')):
        p = t.paragraphs[0] if i == 0 else t.add_paragraph()
        r = p.add_run()
        r.text = line
        r.font.size, r.font.bold, r.font.color.rgb, r.font.name = Pt(size), bold, color, 'Meiryo'
    return t


def head(sl, title, sub):
    tb(sl, 10, 7, 200, 8, title, 15, True)
    tb(sl, 10, 16, 270, 6, sub, 9, False, SUB)


def put_view(sl, png, view, m0, m1, v0, v1, top_mm):
    """図を置く。名前に対応表を埋める＝読み取り側は動かされても正しく換算できる。"""
    path, pw_, ph_ = png
    h = PAPER_W * ph_ / pw_
    pic = sl.shapes.add_picture(path, Mm(8), Mm(top_mm), Mm(PAPER_W), Mm(h))
    pic.name = 'CARVIEW|%s|%.4f|%.4f|%.4f|%.4f' % (view, m0, m1, v0, v1)
    return top_mm + h


def palette(sl, y0, note):
    tb(sl, 10, y0, 277, 5, note, 8.5, False, SUB)
    w, hh, gx, gy = 19.0, 7.6, 1.4, 1.8
    for i, (pid, lab) in enumerate(PARTS):
        c, r = i % 7, i // 7
        s = sl.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                                Mm(10 + c * (w + gx)), Mm(y0 + 5.5 + r * (hh + gy)), Mm(w), Mm(hh))
        s.name = 'PART|%s' % pid
        s.fill.solid()
        s.fill.fore_color.rgb = RGBColor(0xff, 0xfd, 0xf6)
        s.line.color.rgb = SUB if pid.startswith('free') else ACC
        s.line.width = Pt(.9)
        s.shadow.inherit = False
        tf = s.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r_ = p.add_run()
        r_.text = lab
        r_.font.size, r_.font.color.rgb, r_.font.name = Pt(7.5), TXT, 'Meiryo'


if not os.path.isdir(IMGD):
    os.makedirs(IMGD)
IMG = {
    'top':  render('top', -0.05, 3.05, 0.80, -0.80, IMGD + '/top.png'),
    'side': render('side', -0.05, 3.05, 1.50, -0.10, IMGD + '/side.png'),
}

prs = Presentation()
prs.slide_width, prs.slide_height = Mm(297), Mm(210)
blank = prs.slide_layouts[6]

# 1枚目：使い方
sl = prs.slides.add_slide(blank)
head(sl, 'FIAT 500F｜部品の位置と配線の這わせ方 — 記入用',
     'A4横。図はどれも 1マス = 0.1m の実寸です。印刷して手書きしても、パワポ上で図形を動かしても構いません。')
tb(sl, 10, 30, 135, 100,
   '■ パワポ上で指定する場合（おすすめ）\n'
   '1. 各シート下の「部品」の角丸を、図の上の正しい位置へドラッグする。\n'
   '2. 大きさは変えなくてよい。位置は【図形の中央】で読み取る。\n'
   '3. 要らない部品は消す。足りない物は「自由記入」の文字を書き換えて使う。\n'
   '4. 配線は［挿入］→［図形］→［フリーフォーム：図形］で、部品から部品へ引く。\n'
   '　 端点にいちばん近い部品を自動で判定するので、線に名前は要らない。\n'
   '5. 上書き保存して .pptx のまま返す。座標をそのまま数値で読み取る。\n'
   '※ 図が小さければ Ctrl＋マウスホイールで画面を拡大してください（拡大シートは要りません）。', 10)
tb(sl, 152, 30, 135, 100,
   '■ 紙に手書きする場合\n'
   '・そのまま A4横で印刷する。方眼の数字を読めば位置が取れるので、\n'
   '　印刷の拡大率がずれていても問題ない。\n\n'
   '■ 座標の決まり\n'
   '・前後＝いつも「車の前端から何m」。前端が 0.0、後端が 2.97。\n'
   '・上から見た図の縦＝「中心線から左右に何m」。\n'
   '　＋が車の右＝紙の上／−が車の左＝紙の下。\n'
   '・横から見た図の縦＝「地面から何m」。下の太い線が高さ 0。\n'
   '・横から見た図は【車の左側面】を見ている。ノーズはどちらも左。\n\n'
   '■ 区画の目安\n'
   '・前トランク 0〜1.02m／室内 1.02〜2.05m／エンジンルーム 2.05〜2.97m', 10)
tb(sl, 10, 190, 277, 8,
   '※ この図は 3Dモデルの正射投影から起こした実寸線画。部品の位置と配線のルートだけが'
   '分かればよく、絵の細部は気にしなくて構いません。', 8.5, False, SUB)


def sheet(title, sub, img, view, m0, m1, v0, v1):
    """1つの面図につき1枚。部品と配線を同じ紙の上でやる＝配線を引くとき部品が見えている。"""
    sl = prs.slides.add_slide(blank)
    head(sl, title, sub)
    y = put_view(sl, img, view, m0, m1, v0, v1, 23) + 2.5
    palette(sl, y,
            '▼ ここの角丸を図の上へドラッグしてください（位置＝図形の中央）。'
            '要らない物は削除、足りない物は「自由記入」の文字を書き換えて使ってください。')
    tb(sl, 10, y + 24.5, 277, 10,
       '▼ 配線は［挿入］→［図形］→［フリーフォーム：図形］で、部品から部品へ引いてください'
       '（折れ点をクリックしていき、最後にダブルクリック）。線に名前は要りません――'
       '端点にいちばん近い部品を自動で判定します。', 9)


sheet('① 上から見た位置', '部品の前後・左右と、配線の這わせ方（全体）', IMG['top'], 'top', -0.05, 3.05, 0.80, -0.80)
sheet('② 横から見た高さ', '部品の高さと、配線の這わせ方（全体・車の左側面）', IMG['side'], 'side', -0.05, 3.05, 1.50, -0.10)

prs.save(DST)
print('%s (%.0f KB / %d 枚)' % (DST, os.path.getsize(DST) / 1024, len(prs.slides._sldIdLst)))
