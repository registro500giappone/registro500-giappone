#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""締め付けトルク早見帳のデータを、外部提供用の英語 JSON 1本に書き出す。

用途＝Axel Gerstl 社チャットボットの知識ベースへの提供（torque-HANDOFF.md §13）。
⚠️ torque-data.json / en/torque-data-en.json は読むだけで書き換えない（§8 不変条件）。
⚠️ 出力は repo に置かない（公開ファイルになるため）。既定はスクラッチパッド。

  python build_torque_export.py [出力先パス]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JA = os.path.join(HERE, "torque-data.json")
EN = os.path.join(HERE, "en", "torque-data-en.json")
SITE = "https://www.registro500.com/en/torque"
DEFAULT_OUT = os.path.join(
    os.environ.get("TEMP", "/tmp"), "torque-export-en.json")

# 出典の補足（英語）。日本語の note をそのまま渡さず、外部に必要な分だけ英訳して持つ。
SOURCE_NOTES = {
    "wsm": "Figures are printed in lb.ft. Re-checked against the original PDF in Aug 2026.",
    "oem": "Figures are printed in mmkg (kgf.m x 1000). This is the primary source for the kgf.m values.",
    "a126": "Covers the 126.A (594 cc), i.e. the same engine as the 500 R. Primary source for the 126 figures.",
    "buch126": "Covers the 126.A1 (652 cc) only. Not a factory manual.",
    "haynes500": "Used for cross-checking only.",
    "haynes126": "Used for cross-checking only.",
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def nm(kgm):
    return round(kgm * 9.80665, 1) if isinstance(kgm, (int, float)) else None


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    ja, en = load(JA), load(EN)
    if en.get("for_version") != ja.get("version"):
        sys.exit("英訳ファイルの for_version がデータ版と違う: %s != %s"
                 % (en.get("for_version"), ja.get("version")))
    refs, en_items = en.get("refs", {}), en["items"]

    def ref(v):
        return refs.get(v, v) if isinstance(v, str) else v

    def applies_to(fits):
        if "engine" in fits:
            labels = [en["engines"][k]["label"] for k in fits["engine"]
                      if k in en["engines"]]
            return "Engine-side part - fits: " + ", ".join(labels)
        labels = [en["chassis"][k]["label"] for k in fits.get("chassis", [])
                  if k in en["chassis"]]
        return "Body-side part - fits: " + ", ".join(labels)

    items, n_nospec = [], 0
    for it in ja["items"]:
        t = en_items[it["id"]]
        src_id = it.get("source") or ""
        src_label = en["sources"].get(src_id, {}).get("label", "")
        page = ref(it.get("source_id") or "")
        no_spec = bool(it.get("no_spec"))
        if no_spec:
            n_nospec += 1
            attribution = (
                "No tightening torque is specified for this fastener in any of "
                "the six manuals consulted. Any figure quoted must be presented "
                "as a general value for the thread size, never as a Fiat "
                "specification. Checked and compiled by registro500 Japan - " + SITE)
        else:
            attribution = ("Torque figure from: %s%s. Compiled and cross-checked "
                           "by registro500 Japan - %s"
                           % (src_label, (", " + page) if page else "", SITE))

        row = {
            "id": it["id"],
            "name": t["name"],
            "aliases": t.get("aliases", []),
            "area": it["area"],
            "area_label": en["areas"][it["area"]]["label"],
            "applies_to": applies_to(it.get("fits", {})),
            "fits": it.get("fits", {}),
            "torque": {
                "kgm": it.get("kgm"), "kgm_max": it.get("kgm_max"),
                "lbft": it.get("lbft"), "lbft_max": it.get("lbft_max"),
                "nm": nm(it.get("kgm")), "nm_max": nm(it.get("kgm_max")),
            },
            "spec_type": ("none" if no_spec
                          else "procedure" if it.get("kgm") is None
                          and it.get("lbft") is None else "figure"),
            "no_factory_spec": no_spec,
            "safety_critical": bool(it.get("critical")),
            "notes": t.get("notes", []),
            "source": {"id": src_id, "title": src_label, "ref": page} if src_id else None,
            "attribution": attribution,
        }
        if no_spec and t.get("no_spec_note"):
            row["no_spec_note"] = t["no_spec_note"]
        if t.get("procedure"):
            row["procedure"] = t["procedure"]
        if it.get("cross"):
            row["cross_checks"] = [{
                "source": en["sources"].get(c["id"], {}).get("label", c["id"]),
                "ref": ref(c.get("ref", "")),
                "agrees": c.get("agree"),
                "note": (t.get("cross_notes") or {}).get(c["id"]),
            } for c in it["cross"]]
        if it.get("sequences"):
            seq_labels = t.get("seq_labels") or []
            row["tightening_sequence"] = [{
                "applies_to": seq_labels[i] if i < len(seq_labels) else None,
                "engines": s.get("engines"),
                "layout": s.get("layout"),
                "order_top_row": s.get("top"),
                "order_bottom_row": s.get("bottom"),
                "diagram_ref": "%s, %s" % (
                    en["sources"].get(s.get("source"), {}).get("label", ""),
                    ref(s.get("ref", ""))),
            } for i, s in enumerate(it["sequences"])]
        items.append(row)

    doc = {
        "meta": {
            "title": "FIAT 500 / 126 tightening torques",
            "compiled_by": "registro500 Japan (Registro Fiat 500 Giappone)",
            "source_page": SITE,
            "data_version": ja["version"],
            "exported_for": "Axel Gerstl e. Kfm. - chatbot knowledge base",
            "item_count": len(items),
            "items_with_factory_spec": len(items) - n_nospec,
            "items_without_factory_spec": n_nospec,
            "attribution_required": (
                "Please state the source of the figure and link to " + SITE +
                ". Every item carries its own ready-made 'attribution' string - "
                "quoting that line together with the figure is the simplest way "
                "to keep source and value from drifting apart."),
            "usage_notes": [
                "kgf.m values are taken from the Fiat factory manual (German), "
                "lb.ft values from the Autobooks English workshop manual. Both are "
                "reproduced as printed; 'nm' is converted (kgf.m x 9.80665) and "
                "rounded to one decimal.",
                "Where a figure has a range, the second value is in *_max.",
                "'spec_type' says what kind of specification the item has. 'figure' = a "
                "plain torque figure. 'procedure' = the manual gives no single figure; the "
                "fastener is set by a procedure (tighten, then back off by a given angle, "
                "or to a running preload) - the torque fields are null on purpose and the "
                "whole answer is in 'procedure'. Quoting one number out of that text "
                "without the rest of it will ruin the bearing, so please give the "
                "procedure in full. 'none' = no factory specification at all.",
                "'no_factory_spec': true means none of the six manuals gives a figure "
                "for that fastener. The torque fields are null on purpose. Do not fill "
                "them in from another car and do not present a general value as a Fiat "
                "specification - this matters most for the brake items "
                "(brake pipe unions, wheel cylinder, master cylinder).",
                "'source.ref' is where the figure sits in that book, exactly as the book "
                "numbers it: the Autobooks manuals use a chapter-section-item scheme "
                "(e.g. '1-17-1'), the other books are cited by page.",
                "'safety_critical': true marks fasteners where an incorrect figure can "
                "cause a failure with injury (brakes, steering, hubs, wheels).",
                "The generic thread table at the end is NOT Fiat data. It is the usual "
                "figure for the thread size and grade, for fasteners the manuals do not list.",
            ],
        },
        "references": [{
            "id": s["id"],
            "title": en["sources"].get(s["id"], {}).get("label", s["id"]),
            "note": SOURCE_NOTES.get(s["id"], ""),
        } for s in ja["sources"]],
        "items": items,
        "generic_thread_table": {
            "note": ("General figures for the thread size and grade (steel, coarse "
                     "thread, dry, friction coefficient around 0.14). NOT a Fiat "
                     "specification for any particular model. Values in N.m."),
            "grades": [g["id"] for g in ja["generic"]["grades"]],
            "table": ja["generic"]["table"],
        },
    }

    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("wrote %s (%d items, %d without factory spec)"
          % (out_path, len(items), n_nospec))


if __name__ == "__main__":
    main()
