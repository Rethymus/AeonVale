#!/usr/bin/env python3
"""AI 美术资产多重审核 + 前沿 AI→像素管线（docs/13 §3.2/§3.4）。

用户指令：AI 可用，但须过自动化多重审核方可入库；prompt 须精准（付费 API）；参考前沿方案优化。

审核阶段（确定性、可复现）：
  fmt      — PNG 合法 + 尺寸符合类（sprite 精确 32x32；cg 大尺寸插画）
  palette  — 不透明像素到 16 色调色板的 Lab ΔE 贴合度（sprite 量化后应≈0；cg 仅记录）
  content  — 不透明率、唯一色数、单色洪泛检测，剔除废生成
  provenance — license=AI-Generated + source + checksum 由 manifest schema 强制
  vision   — 由 Read 工具人工判定（zai MCP 本环境 401 不可用）；本脚本留占位

quantize 子命令（应用调研结论）：
  AI 1024 图 → 去背景(角点洪水) → 预乘 alpha → 高斯 σ0.8 抗混叠 → LANCZOS 降到 32×32
  → 取消预乘 → alpha 二值化 → Lab 最近邻映射到 16 色【不抖动】→ 3×3 中值去噪
  → 连通域去孤立噪点(min 2) → 重新贴调色板 → 输出 RGBA PNG（打印 sha256）
  依据：LANCZOS>NEAREST；Lab 比准；Floyd-Steinberg 在 32px 上变噪点故不用。

用法：
  python3 tools/review-ai-art.py review <img> <cg|sprite> [--motif M] [--palette-max-d D]
  python3 tools/review-ai-art.py quantize <in.png> <out.png> <w> <h> [--bg-tol T] [--sigma S]
"""
import sys
import json
import math
import hashlib

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# 镜像 src/render/palette.ts 的 15 个可见色（idx 1-15）。
PALETTE = [
    (244, 236, 216), (26, 26, 31), (92, 107, 115), (122, 140, 90), (74, 140, 156),
    (181, 72, 47), (201, 161, 74), (168, 139, 92), (123, 108, 138), (232, 232, 224),
    (58, 106, 40), (107, 79, 42), (159, 182, 196), (217, 134, 65), (14, 14, 20),
]
_PAL_RGB = np.asarray(PALETTE, dtype=float)


def srgb_to_linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def rgb_to_lab(rgb):
    """rgb: (N,3) 0-255 → (N,3) Lab。D65。"""
    rgb = np.asarray(rgb, dtype=float)
    r = srgb_to_linear(rgb[:, 0]); g = srgb_to_linear(rgb[:, 1]); b = srgb_to_linear(rgb[:, 2])
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722)
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    def f(t):
        return np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16.0 / 116.0)
    fx, fy, fz = f(x), f(y), f(z)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], axis=-1)


_PAL_LAB = rgb_to_lab(_PAL_RGB)


def nearest_palette_indices(rgb_array):
    """(N,3) rgb → (N,) 调色板索引，按 Lab ΔE76 最近邻。"""
    lab = rgb_to_lab(rgb_array)
    d = np.linalg.norm(lab[:, None, :] - _PAL_LAB[None, :, :], axis=2)  # (N,15)
    return np.argmin(d, axis=1)


def palette_lab_distance(rgb_array):
    lab = rgb_to_lab(rgb_array)
    d = np.linalg.norm(lab[:, None, :] - _PAL_LAB[None, :, :], axis=2)
    return d.min(axis=1)


# ---------------- review ----------------

def review(path, cls, motif, palette_max_d):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    arr = np.asarray(img).reshape(-1, 4)
    rgb = arr[:, :3].astype(float)
    alpha = arr[:, 3]

    if cls == 'sprite':
        fmt_ok = (w == 32 and h == 32)
    elif cls == 'cg':
        fmt_ok = (900 <= w <= 2048 and 900 <= h <= 2048)
    else:
        fmt_ok = True

    opaque = alpha >= 128
    total = w * h
    opaque_n = int(opaque.sum())
    opaque_ratio = opaque_n / total if total else 0.0
    opaque_rgb = rgb[opaque]
    unique = len({tuple(c) for c in opaque_rgb.reshape(-1, 3).tolist()}) if opaque_n else 0
    if opaque_n:
        mean_d = float(palette_lab_distance(opaque_rgb).mean())
        # 主色占比
        idx = nearest_palette_indices(opaque_rgb)
        bins = np.bincount(idx, minlength=len(PALETTE))
        top_ratio = float(bins.max() / opaque_n)
    else:
        mean_d, top_ratio = 999.0, 0.0

    if cls == 'sprite':
        content_ok = (0.05 <= opaque_ratio <= 0.95) and unique >= 3 and top_ratio < 0.98
        palette_ok = mean_d <= palette_max_d
    else:
        content_ok = opaque_ratio >= 0.10 and unique >= 8
        palette_ok = True

    stages = {
        'fmt': {'pass': fmt_ok, 'w': w, 'h': h, 'class': cls},
        'palette': {'pass': palette_ok, 'mean_lab_dist': round(mean_d, 2),
                    'threshold': palette_max_d if cls == 'sprite' else None,
                    'note': '量化后应≈0' if cls == 'sprite' else 'CG 自然色，仅记录'},
        'content': {'pass': content_ok, 'opaque_ratio': round(opaque_ratio, 3),
                    'unique_colors': unique, 'top_color_ratio': round(top_ratio, 3)},
    }
    return {'asset': path, 'class': cls, 'motif': motif,
            'pass': all(s['pass'] for s in stages.values()), 'stages': stages,
            'vision': {'pass': False, 'note': '待 Read 工具视觉判定'}}


# ---------------- quantize (前沿管线) ----------------

def remove_background(arr_rgba, tol):
    """去背景：若原图已有透明边框则信任之；否则按四角色洪水连通到边界者视为背景。"""
    h, w, _ = arr_rgba.shape
    edges_alpha = np.concatenate([
        arr_rgba[0, :, 3], arr_rgba[-1, :, 3], arr_rgba[:, 0, 3], arr_rgba[:, -1, 3]])
    if (edges_alpha < 128).mean() > 0.5:
        # API 已返回透明背景：仅清半透明 fringe，不动主体
        arr_rgba = arr_rgba.copy()
        arr_rgba[arr_rgba[:, :, 3] < 128, 3] = 0
        return arr_rgba
    # 角点色洪水
    corners = np.array([arr_rgba[0, 0, :3], arr_rgba[0, -1, :3],
                        arr_rgba[-1, 0, :3], arr_rgba[-1, -1, :3]], dtype=float)
    bg = corners.mean(axis=0)
    dist = np.linalg.norm(arr_rgba[:, :, :3].astype(float) - bg, axis=2)
    bg_match = dist < tol  # 与背景色接近
    # 只保留连通到边界的背景分量（内部同色洞归属主体）
    lab, n = ndimage.label(bg_match)
    border_labels = set()
    border_labels.update(lab[0, :].tolist()); border_labels.update(lab[-1, :].tolist())
    border_labels.update(lab[:, 0].tolist()); border_labels.update(lab[:, -1].tolist())
    border_labels.discard(0)
    is_bg = np.isin(lab, list(border_labels))
    arr_rgba = arr_rgba.copy()
    arr_rgba[is_bg, 3] = 0
    return arr_rgba


def quantize(inp, outp, w, h, bg_tol, sigma):
    img = Image.open(inp).convert('RGBA')
    rgba = np.asarray(img, dtype=np.uint8)
    rgba = remove_background(rgba, bg_tol)

    # 预乘 alpha（防透明边沿渗色）
    a = rgba[:, :, 3:4].astype(float) / 255.0
    premult = rgba[:, :, :3].astype(float) * a
    premult = np.concatenate([premult, rgba[:, :, 3:None].astype(float)], axis=2)
    pim = Image.fromarray(premult.astype(np.uint8), 'RGBA')

    # 高斯抗混叠预滤波 + LANCZOS 降采样
    if sigma > 0:
        pim = pim.filter(ImageFilter.GaussianBlur(radius=sigma))
    small = pim.resize((w, h), Image.LANCZOS)
    sarr = np.asarray(small, dtype=float)

    # 取消预乘 + alpha 二值化
    sa = sarr[:, :, 3:4] / 255.0
    sa = np.where(sa > 0, sa, 1e-6)
    rgb_lin = sarr[:, :, :3] / np.maximum(sa, 1e-6)
    rgb_lin = np.clip(rgb_lin, 0, 255)
    alpha_bin = (sarr[:, :, 3] >= 128).astype(np.uint8) * 255

    # Lab 最近邻贴 16 色（不抖动）
    flat = rgb_lin.reshape(-1, 3)
    idx = nearest_palette_indices(flat)
    # reshape 顺序与 flat 行优先一致：h×w×3
    out_rgb = _PAL_RGB[idx].reshape(h, w, 3).astype(np.uint8)

    # 中值去噪（按通道）
    out_img = Image.fromarray(out_rgb, 'RGB').filter(ImageFilter.MedianFilter(size=3))
    out_rgb = np.asarray(out_img)
    flat = out_rgb.reshape(-1, 3).astype(float)
    idx2 = nearest_palette_indices(flat)
    out_rgb = _PAL_RGB[idx2].reshape(h, w, 3).astype(np.uint8)

    # 连通域去孤立噪点（< min_size 的不透明小色块并入背景）
    opaque = alpha_bin > 0
    inv = ~opaque
    lab, n = ndimage.label(inv)
    if n:
        sizes = ndimage.sum(np.ones_like(inv), lab, range(1, n + 1))
        small_holes = np.isin(lab, np.where(sizes < 2)[0] + 1)  # <2 像素的透明洞 → 填为不透明
        opaque = opaque | small_holes
    # 不透明像素的孤立单点 → 去除
    lab2, n2 = ndimage.label(opaque)
    if n2:
        sizes2 = ndimage.sum(np.ones_like(opaque), lab2, range(1, n2 + 1))
        stray = np.isin(lab2, np.where(sizes2 < 2)[0] + 1)
        opaque = opaque & ~stray
    alpha_final = opaque.astype(np.uint8) * 255

    # 组装 RGBA（透明像素清零）+ 最终再贴一次色板
    final = np.zeros((h, w, 4), dtype=np.uint8)
    op_mask = opaque
    final_rgb = out_rgb.copy()
    final_rgb[~op_mask] = 0
    flat3 = final_rgb[op_mask].astype(float).reshape(-1, 3)
    idx3 = nearest_palette_indices(flat3)
    final_rgb[op_mask] = _PAL_RGB[idx3].astype(np.uint8)
    final[:, :, :3] = final_rgb
    final[:, :, 3] = alpha_final

    Image.fromarray(final, 'RGBA').save(outp, 'PNG')
    sha = hashlib.sha256(open(outp, 'rb').read()).hexdigest()
    print(json.dumps({'out': outp, 'w': w, 'h': h, 'sha256': sha,
                      'opaque_ratio': round(float(opaque.sum()) / (w * h), 3)}))


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(1)
    cmd = args[0]
    if cmd == 'review':
        path = args[1]; cls = args[2] if len(args) > 2 else 'cg'
        motif = ''; palette_max_d = 8.0; i = 3
        while i < len(args):
            if args[i] == '--motif' and i + 1 < len(args): motif = args[i + 1]; i += 2
            elif args[i] == '--palette-max-d' and i + 1 < len(args): palette_max_d = float(args[i + 1]); i += 2
            else: i += 1
        print(json.dumps(review(path, cls, motif, palette_max_d), ensure_ascii=False, indent=2))
    elif cmd == 'quantize':
        inp, outp, w, h = args[1], args[2], int(args[3]), int(args[4])
        bg_tol, sigma = 44.0, 0.8
        if '--bg-tol' in args: bg_tol = float(args[args.index('--bg-tol') + 1])
        if '--sigma' in args: sigma = float(args[args.index('--sigma') + 1])
        quantize(inp, outp, w, h, bg_tol, sigma)
    else:
        print(f'未知子命令: {cmd}', file=sys.stderr); sys.exit(2)


if __name__ == '__main__':
    main()
