#!/usr/bin/env python3
"""主世界角色精灵后处理。

把 1024 级 AI 原图裁成稳定的 96x96 透明 PNG：
- 若已有 alpha，按 alpha 裁切；否则按四角背景色洪水去底。
- 保留全身比例，把人物落到画布下方，便于脚底贴地图。
- 做轻量去 AI 味：有限色、硬化 alpha、最近邻微像素化。

用法：
  python3 tools/postprocess-world-character-art.py <raw-dir> <out-dir>
  python3 tools/postprocess-world-character-art.py <raw.png> <out.png>
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter
from scipy import ndimage


CANVAS = 96
MAX_BODY_W = 70
MAX_BODY_H = 88


def remove_background(img: Image.Image, tolerance: float = 42.0) -> Image.Image:
    rgba = np.asarray(img.convert("RGBA"), dtype=np.uint8).copy()
    h, w, _ = rgba.shape
    edge_alpha = np.concatenate([rgba[0, :, 3], rgba[-1, :, 3], rgba[:, 0, 3], rgba[:, -1, 3]])
    if (edge_alpha < 32).mean() > 0.4:
        rgba[:, :, 3] = np.where(rgba[:, :, 3] < 80, 0, rgba[:, :, 3])
        return Image.fromarray(rgba, "RGBA")

    corners = np.array([rgba[0, 0, :3], rgba[0, -1, :3], rgba[-1, 0, :3], rgba[-1, -1, :3]], dtype=float)
    bg = corners.mean(axis=0)
    dist = np.linalg.norm(rgba[:, :, :3].astype(float) - bg, axis=2)
    bg_match = dist < tolerance
    labels, _ = ndimage.label(bg_match)
    border_labels = set(labels[0, :].tolist())
    border_labels.update(labels[-1, :].tolist())
    border_labels.update(labels[:, 0].tolist())
    border_labels.update(labels[:, -1].tolist())
    border_labels.discard(0)
    if border_labels:
        is_bg = np.isin(labels, list(border_labels))
        rgba[is_bg, 3] = 0
    rgba[:, :, 3] = np.where(rgba[:, :, 3] < 80, 0, rgba[:, :, 3])
    return Image.fromarray(rgba, "RGBA")


def trim_to_alpha(img: Image.Image) -> Image.Image:
    alpha = img.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 24 else 0).getbbox()
    if not bbox:
        return img
    pad = max(8, int(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 0.08))
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(img.width, bbox[2] + pad)
    bottom = min(img.height, bbox[3] + pad)
    return img.crop((left, top, right, bottom))


def harden_alpha(img: Image.Image) -> Image.Image:
    rgba = np.asarray(img.convert("RGBA"), dtype=np.uint8).copy()
    a = rgba[:, :, 3]
    rgba[:, :, 3] = np.where(a < 32, 0, 255)
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def quantize_rgba(img: Image.Image, colors: int = 40) -> Image.Image:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(rgba.convert("RGB"), mask=alpha)
    # FASTOCTREE handles RGBA-derived pixel art without forcing the old global 15-color palette.
    pal = rgb.quantize(colors=colors, method=Image.Quantize.FASTOCTREE).convert("RGB")
    out = Image.merge("RGBA", (*pal.split(), alpha))
    return harden_alpha(out)


def add_ink_outline(img: Image.Image) -> Image.Image:
    rgba = np.asarray(img.convert("RGBA"), dtype=np.uint8).copy()
    opaque = rgba[:, :, 3] > 0
    dilated = ndimage.binary_dilation(opaque, iterations=1)
    outline = dilated & ~opaque
    rgba[outline] = (26, 26, 31, 255)
    return Image.fromarray(rgba, "RGBA")


def process_one(src: Path, dst: Path) -> dict[str, object]:
    img = Image.open(src).convert("RGBA")
    img = remove_background(img)
    img = trim_to_alpha(img)

    scale = min(MAX_BODY_W / img.width, MAX_BODY_H / img.height)
    target_w = max(1, int(round(img.width * scale)))
    target_h = max(1, int(round(img.height * scale)))
    resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    # 先小幅像素化再回到目标尺寸，减少 AI 绘画式羽化边。
    mid_w = max(1, target_w // 2)
    mid_h = max(1, target_h // 2)
    resized = resized.resize((mid_w, mid_h), Image.Resampling.LANCZOS).resize((target_w, target_h), Image.Resampling.NEAREST)
    resized = resized.filter(ImageFilter.UnsharpMask(radius=0.6, percent=120, threshold=2))
    resized = quantize_rgba(resized)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - target_w) // 2
    y = CANVAS - target_h - 4
    canvas.alpha_composite(resized, (x, y))
    canvas = harden_alpha(canvas)
    canvas = add_ink_outline(canvas)

    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, "PNG", optimize=True)
    data = dst.read_bytes()
    canvas_rgba = np.asarray(canvas)
    alpha = canvas_rgba[:, :, 3]
    return {
        "src": str(src),
        "out": str(dst),
        "w": CANVAS,
        "h": CANVAS,
        "sha256": hashlib.sha256(data).hexdigest(),
        "opaque_ratio": round(float((alpha > 0).sum()) / (CANVAS * CANVAS), 3),
        "unique_rgba": int(np.unique(canvas_rgba.reshape(-1, 4), axis=0).shape[0]),
    }


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        results = [process_one(path, dst / path.name) for path in sorted(src.glob("*.png"))]
    else:
        results = [process_one(src, dst)]
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if not results:
        return 2
    bad = [r for r in results if not (0.08 <= float(r["opaque_ratio"]) <= 0.72)]
    if bad:
        print(json.dumps({"warning": "opaque ratio outside expected range", "bad": bad}, ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
