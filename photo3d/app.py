"""Photo3D — 数点の写真からリアル・精緻な3Dデータを作るローカルアプリ.

起動:
  cd photo3d
  .venv\\Scripts\\python -m uvicorn app:app --port 8420

構成はプラン（3d-fable-logical-parasol.md）§3-§4 のとおり。
Phase 1 時点の機能: プロジェクトCRUD / 写真アップロード / 前処理 / 視点割当。
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import time
from pathlib import Path

from typing import Annotated, Literal, Union

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("photo3d")

ROOT = Path(__file__).resolve().parent
PROJECTS_DIR = ROOT / "projects"
PROJECTS_DIR.mkdir(exist_ok=True)

VIEWS = ("front", "back", "left", "right", "other")
ROTATION_SLOTS = ("front", "right", "back", "left")  # 総当たりモードの巡回順
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

app = FastAPI(title="Photo3D")

# Phase 2/3: バックエンドレジストリ（プラグイン式・プラン§3）
from backends.space_hy2mv import SpaceHy2mvBackend  # noqa: E402
from backends.local_hy21 import LocalHy21Backend  # noqa: E402

BACKENDS = {
    "space_hy2mv": SpaceHy2mvBackend(),
    "local_hy21": LocalHy21Backend(),
}


# ---------------------------------------------------------------- helpers
def _safe_name(name: str) -> str:
    name = name.strip()
    if not re.fullmatch(r"[\w\-぀-ヿ一-鿿]{1,64}", name):
        raise HTTPException(400, "プロジェクト名は英数字・-・_・日本語のみ64文字まで")
    return name


def _proj_dir(name: str) -> Path:
    d = PROJECTS_DIR / _safe_name(name)
    if not d.is_dir():
        raise HTTPException(404, f"プロジェクトが無い: {name}")
    return d


def _load_meta(d: Path) -> dict:
    return json.loads((d / "project.json").read_text(encoding="utf-8"))


def _save_meta(d: Path, meta: dict) -> None:
    (d / "project.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8"
    )


# ---------------------------------------------------------------- models
class ProjectCreate(BaseModel):
    name: str


class ViewAssign(BaseModel):
    view: str  # front / back / left / right / other


class GenerateRequest(BaseModel):
    backend: str = "space_hy2mv"
    mode: str = "manual"  # manual（現在の視点割当を使う）/ all（総当たり4回転）
    steps: int = 5
    octree_resolution: int = 256
    # Phase 3(B2)向け追加オプション。Noneならbackend側の既定値を使う。
    num_chunks: int | None = None
    guidance_scale: float | None = None
    seed: int | None = None
    subfolder: str | None = None  # B2のみ: hunyuan3d-dit-v2-mv / -fast / -turbo
    mc_algo: str | None = None  # B2のみ: mc / dmc


class ExportRequest(BaseModel):
    preset: str = "raw"  # raw / wiring-viewer
    real_height_mm: float | None = None


# ---------------------------------------------------------------- project CRUD
@app.get("/api/projects")
def list_projects():
    out = []
    for d in sorted(PROJECTS_DIR.iterdir()):
        if d.is_dir() and (d / "project.json").exists():
            out.append(_load_meta(d))
    return out


@app.post("/api/projects")
def create_project(body: ProjectCreate):
    name = _safe_name(body.name)
    d = PROJECTS_DIR / name
    if d.exists():
        raise HTTPException(409, f"同名プロジェクトが既にある: {name}")
    (d / "original").mkdir(parents=True)
    meta = {"name": name, "created": time.strftime("%Y-%m-%d %H:%M:%S"), "photos": []}
    _save_meta(d, meta)
    return meta


@app.get("/api/projects/{name}")
def get_project(name: str):
    return _load_meta(_proj_dir(name))


@app.delete("/api/projects/{name}")
def delete_project(name: str):
    shutil.rmtree(_proj_dir(name))
    return {"deleted": name}


# ---------------------------------------------------------------- photos
@app.post("/api/projects/{name}/photos")
async def upload_photos(name: str, files: list[UploadFile]):
    d = _proj_dir(name)
    meta = _load_meta(d)
    added = []
    for f in files:
        ext = Path(f.filename or "x").suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"未対応拡張子: {f.filename}")
        pid = f"p{len(meta['photos']) + len(added) + 1:02d}"
        fname = f"{pid}{ext}"
        (d / "original" / fname).write_bytes(await f.read())
        added.append(
            {"id": pid, "filename": fname, "orig_name": f.filename,
             "view": None, "prep": None, "obj_h_px": None}
        )
    meta["photos"].extend(added)
    _save_meta(d, meta)
    log.info("upload: %s +%d photos", name, len(added))
    return meta


@app.post("/api/projects/{name}/photos/{pid}/view")
def assign_view(name: str, pid: str, body: ViewAssign):
    if body.view not in VIEWS:
        raise HTTPException(400, f"viewは{VIEWS}のどれか")
    d = _proj_dir(name)
    meta = _load_meta(d)
    for ph in meta["photos"]:
        if ph["id"] == pid:
            ph["view"] = body.view
            _save_meta(d, meta)
            return meta
    raise HTTPException(404, f"写真が無い: {pid}")


@app.delete("/api/projects/{name}/photos/{pid}")
def delete_photo(name: str, pid: str):
    d = _proj_dir(name)
    meta = _load_meta(d)
    keep = [p for p in meta["photos"] if p["id"] != pid]
    if len(keep) == len(meta["photos"]):
        raise HTTPException(404, f"写真が無い: {pid}")
    for ph in meta["photos"]:
        if ph["id"] == pid:
            (d / "original" / ph["filename"]).unlink(missing_ok=True)
            if ph.get("prep"):
                (d / "prep" / Path(ph["prep"]).name).unlink(missing_ok=True)
    meta["photos"] = keep
    _save_meta(d, meta)
    return meta


# ---------------------------------------------------------------- preprocess
def _apply_prep_result(meta: dict, result) -> None:
    """PrepResult を meta へ反映する（preprocess/erase 共通）.

    出力ファイル名は常に `<pid>_prep.png` に収束する（core.preprocess._place_on_canvas
    参照）ので、出力ファイル名のステムから "_prep" を取り除いた値を pid として突き合わせる。
    """
    by_pid = {Path(it.out).stem[: -len("_prep")]: it for it in result.items}
    for ph in meta["photos"]:
        it = by_pid.get(ph["id"])
        if it:
            ph["prep"] = Path(it.out).name
            ph["obj_h_px"] = it.obj_h_px
    meta["prep_summary"] = {
        "canvas": result.canvas,
        "target_h": result.target_h,
        "max_h_diff_pct": result.max_h_diff_pct,
        "pass_2pct": result.max_h_diff_pct <= 2.0,
        "ran": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


@app.post("/api/projects/{name}/preprocess")
def run_preprocess(name: str):
    """全写真を一括前処理（背景除去→スケール正規化→共通キャンバス）."""
    from core.preprocess import preprocess_group

    d = _proj_dir(name)
    meta = _load_meta(d)
    if not meta["photos"]:
        raise HTTPException(400, "写真が0枚")
    srcs = [d / "original" / ph["filename"] for ph in meta["photos"]]
    result = preprocess_group(srcs, d / "prep")
    _apply_prep_result(meta, result)
    _save_meta(d, meta)
    log.info("preprocess: %s max_h_diff=%.3f%%", name, result.max_h_diff_pct)
    return meta


class StrokeOp(BaseModel):
    """ブラシ消しゴム1ストローク（キャンバス画素座標の(x,y)点列）."""

    type: Literal["stroke"] = "stroke"
    path: list[list[float]]
    radius: int = 24


class FillOp(BaseModel):
    """同色領域消去1クリック（クリック点の画素座標＋色許容差）."""

    type: Literal["fill"] = "fill"
    x: float
    y: float
    tol: int = 24


class EraseRequest(BaseModel):
    # ブラシ／同色領域消去を記録順に並べたもの（順序が結果に影響するため単一リスト）
    ops: list[Annotated[Union[StrokeOp, FillOp], Field(discriminator="type")]]


@app.post("/api/projects/{name}/photos/{pid}/erase")
def erase_photo(name: str, pid: str, body: EraseRequest):
    """手動消しゴム: 指定写真のprep画像にブラシストローク／同色領域消去でアルファ0を
    書き込み、グループ全体のスケール正規化を再実行する（台車等の異物除去後の再基準化・
    パーツの隙間から覗く背景ポケット除去に対応）。rembgは再実行しない。
    """
    from PIL import Image

    from core.preprocess import apply_erase_ops, renormalize_group

    d = _proj_dir(name)
    meta = _load_meta(d)
    ph = _photo_by_id(meta, pid)
    if ph is None:
        raise HTTPException(404, f"写真が無い: {pid}")
    if not ph.get("prep"):
        raise HTTPException(400, "先に前処理を実行してから消しゴムを使う")
    if not body.ops:
        raise HTTPException(400, "消去操作が空")

    prep_path = d / "prep" / ph["prep"]
    with Image.open(prep_path) as im:
        rgba = im.convert("RGBA")
    ops = [op.model_dump() for op in body.ops]
    erased = apply_erase_ops(rgba, ops)
    erased.save(prep_path)
    log.info("erase: %s %s ops=%d", name, pid, len(ops))

    result = renormalize_group(d / "prep", meta["photos"])
    _apply_prep_result(meta, result)
    _save_meta(d, meta)
    log.info("erase+renormalize done: %s max_h_diff=%.3f%%", name, result.max_h_diff_pct)
    return meta


# ---------------------------------------------------------------- generate (Phase 2: B1)
def _photo_by_id(meta: dict, pid: str) -> dict | None:
    for ph in meta["photos"]:
        if ph["id"] == pid:
            return ph
    return None


def _prep_path(d: Path, ph: dict) -> Path | None:
    if not ph.get("prep"):
        return None
    return d / "prep" / ph["prep"]


@app.post("/api/projects/{name}/generate")
def generate_candidates(name: str, body: GenerateRequest):
    """プラン§5 Phase2-1: B1(space_hy2mv)で候補GLBを生成し4視点+上面をレンダする.

    mode=manual: 現在の視点割当(front/back/left/right)をそのまま使い1候補生成。
    mode=all: 前処理済み写真4枚を対象に、front→right→back→leftの巡回順で
      4通りに割当を回転させ4候補まとめて生成する（追記16の「総当たりモード」）。
    """
    from core.compare import render_candidate

    backend = BACKENDS.get(body.backend)
    if backend is None:
        raise HTTPException(400, f"未知のbackend: {body.backend}（利用可: {list(BACKENDS)}）")
    ok, why = backend.requirements_check()
    if not ok:
        raise HTTPException(400, f"backend準備未完了: {why}")

    d = _proj_dir(name)
    meta = _load_meta(d)
    prepped = [ph for ph in meta["photos"] if ph.get("prep")]
    if not prepped:
        raise HTTPException(400, "前処理済みの写真が0枚（先に前処理を実行）")

    meta.setdefault("candidates", [])
    cand_start = len(meta["candidates"])

    def next_cand_id(i: int) -> str:
        return f"c{cand_start + i + 1:02d}"

    view_sets: list[tuple[str, dict[str, Path | None]]] = []

    if body.mode == "manual":
        views = {v: None for v in ROTATION_SLOTS}
        for ph in meta["photos"]:
            if ph.get("view") in ROTATION_SLOTS and ph.get("prep"):
                views[ph["view"]] = _prep_path(d, ph)
        if not views["front"]:
            raise HTTPException(400, "front視点が未割当（先にUIで割当てる）")
        view_sets.append(("manual", views))
    elif body.mode == "all":
        if len(prepped) != 4:
            raise HTTPException(
                400, f"総当たりモードは前処理済み写真がちょうど4枚必要（現在{len(prepped)}枚）"
            )
        paths = [_prep_path(d, ph) for ph in prepped]
        for rot in range(4):
            rotated = paths[rot:] + paths[:rot]
            views = dict(zip(ROTATION_SLOTS, rotated))
            view_sets.append((f"rot{rot}", views))
    else:
        raise HTTPException(400, "modeはmanual/allのどちらか")

    cand_dir = d / "candidates"
    render_dir = cand_dir  # レンダPNGはglbと同じ階層に置く(ファイル配信のkindを単純にするため)
    new_candidates = []
    for i, (rot_label, views) in enumerate(view_sets):
        cand_id = next_cand_id(i)
        glb_path = cand_dir / f"{cand_id}.glb"
        log.info("generate: %s cand=%s rotation=%s views=%s", name, cand_id, rot_label,
                  {k: (Path(v).name if v else None) for k, v in views.items()})
        extra_kwargs = {
            k: v for k, v in (
                ("num_chunks", body.num_chunks),
                ("guidance_scale", body.guidance_scale),
                ("seed", body.seed),
                ("subfolder", body.subfolder),
                ("mc_algo", body.mc_algo),
            ) if v is not None
        }
        gen_meta = backend.run(
            views, glb_path, steps=body.steps, octree_resolution=body.octree_resolution, **extra_kwargs
        )
        render_result = render_candidate(glb_path, render_dir, cand_id)
        record = {
            "id": cand_id,
            "backend": body.backend,
            "rotation": rot_label,
            "views": {k: (Path(v).name if v else None) for k, v in views.items()},
            "glb": f"candidates/{cand_id}.glb",
            "renders": {k: f"candidates/{fn}" for k, fn in render_result.renders.items()},
            "n_vertices": render_result.n_vertices,
            "n_faces": render_result.n_faces,
            "bounds": render_result.bounds,
            "gen_meta": {k: v for k, v in gen_meta.items() if k != "mesh_stats"},
            "mesh_stats": gen_meta.get("mesh_stats"),
            "created": time.strftime("%Y-%m-%d %H:%M:%S"),
            "exports": [],
        }
        meta["candidates"].append(record)
        new_candidates.append(record)
        _save_meta(d, meta)  # 1候補ごとに保存（総当たり4回転の途中失敗でも既存分は残る）

    log.info("generate done: %s +%d candidates", name, len(new_candidates))
    return meta


# ---------------------------------------------------------------- export (Phase 2-3)
@app.post("/api/projects/{name}/candidates/{cid}/export")
def export_candidate_endpoint(name: str, cid: str, body: ExportRequest):
    from core.export import export_candidate

    d = _proj_dir(name)
    meta = _load_meta(d)
    cand = next((c for c in meta.get("candidates", []) if c["id"] == cid), None)
    if cand is None:
        raise HTTPException(404, f"候補が無い: {cid}")
    if body.preset not in ("raw", "wiring-viewer"):
        raise HTTPException(400, "presetはraw/wiring-viewerのどちらか")

    src_glb = d / cand["glb"]
    result = export_candidate(
        src_glb, d / "export", cid, body.preset, real_height_mm=body.real_height_mm
    )
    result["created"] = time.strftime("%Y-%m-%d %H:%M:%S")
    cand.setdefault("exports", []).append(result)
    _save_meta(d, meta)
    log.info(
        "export: %s cand=%s preset=%s %dB -> %dB",
        name, cid, body.preset, result["raw_size_bytes"], result["final_size_bytes"],
    )
    return meta


# ---------------------------------------------------------------- file serving
@app.get("/api/projects/{name}/files/{kind}/{fname}")
def get_file(name: str, kind: str, fname: str):
    if kind not in ("original", "prep", "export", "candidates"):
        raise HTTPException(400, "kindはoriginal/prep/export/candidatesのどれか")
    p = _proj_dir(name) / kind / Path(fname).name  # Path(...).name でトラバーサル防止
    if not p.is_file():
        raise HTTPException(404, fname)
    return FileResponse(p)


# ---------------------------------------------------------------- static UI
app.mount("/", StaticFiles(directory=ROOT / "static", html=True), name="static")


@app.exception_handler(Exception)
async def on_error(request, exc):
    log.exception("unhandled: %s", request.url)
    return JSONResponse(status_code=500, content={"detail": str(exc)})
