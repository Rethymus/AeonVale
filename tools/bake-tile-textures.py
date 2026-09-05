#!/usr/bin/env python
"""烘焙程序化瓦片纹理：noise + 调色板。

为 renderer 的 9 种 soilType 各烘焙一张无缝 42×42 纹理（正弦和噪声，周期=N → 天然无缝），
按该土壤基色 + 明/暗变体三色映射。替代当前的纯 hex 色块（G10）。

用法：python3 tools/bake-tile-textures.py
产出：assets/tiles/<type>.png + 打印 sha（供 manifest）。
许可：CC-BY-NC-4.0（程序化原创，非 AI）。
"""
import sys
import json
import hashlib
import numpy as np
from PIL import Image

N = 42  # 对齐 renderer TILE=42

# 镜像 src/render/renderer.ts SOIL_COLOR
SOIL = {
    'loam':       (107, 79, 42),
    'wet-loam':   (74, 53, 32),
    'dry-sand':   (155, 123, 63),
    'insulated':  (74, 74, 82),
    'scorched':   (42, 26, 10),
    'spirit-loam':(74, 106, 42),
    'rock':       (58, 58, 58),
    'water':      (42, 74, 107),
    'metal-ore':  (90, 90, 106),
}

def seamless_noise(seed, n):
    """正弦和噪声：任意整数频率 k 都使 sin(2π k x/n) 在 n 上周期 → 天然无缝。"""
    rng = np.random.default_rng(seed)
    yy, xx = np.meshgrid(np.arange(n), np.arange(n), indexing='ij')
    noise = np.zeros((n, n))
    for _ in range(5):
        kx = int(rng.integers(1, 5))
        ky = int(rng.integers(1, 5))
        phx = rng.uniform(0, 2 * np.pi)
        phy = rng.uniform(0, 2 * np.pi)
        amp = rng.uniform(0.3, 1.0)
        noise += amp * np.sin(2 * np.pi * kx * xx / n + phx) * np.sin(2 * np.pi * ky * yy / n + phy)
    noise = (noise - noise.min()) / (noise.max() - noise.min() + 1e-9)
    return noise

def bake(stype, base):
    seed = abs(hash(stype)) % (2**32)
    noise = seamless_noise(seed, N)
    dark = tuple(max(0, int(c * 0.65)) for c in base)
    light = tuple(min(255, int(c * 1.3)) for c in base)
    arr = np.zeros((N, N, 3), dtype=np.uint8)
    for c in range(3):
        # noise<0.4 → dark, 0.4-0.6 → base, >0.6 → light，平滑过渡
        layer = np.where(noise < 0.4, dark[c],
                np.where(noise < 0.6, base[c], light[c]))
        # 边界柔和：在阈值附近线性插值
        band = 0.08
        m1 = np.clip((noise - (0.4 - band)) / (2 * band), 0, 1)
        m2 = np.clip((noise - (0.6 - band)) / (2 * band), 0, 1)
        col = dark[c] * (1 - m1) + base[c] * m1
        col = col * (1 - m2) + light[c] * m2
        arr[:, :, c] = np.clip(col, 0, 255).astype(np.uint8)
    return arr

import re

import os
from pathlib import Path
os.makedirs('assets/tiles', exist_ok=True)
rows = []
for stype, base in SOIL.items():
    # 路径穿越防护：stype 仅允许小写字母与下划线，拼进路径前先行校验。
    if not re.fullmatch(r'[a-z_]+', stype):
        raise SystemExit(f'unexpected soil type: {stype!r}')
    arr = bake(stype, base)
    out = Path('assets/tiles') / f'{stype}.png'
    Image.fromarray(arr, 'RGB').save(out)
    sha = hashlib.sha256(out.read_bytes()).hexdigest()
    rows.append(('tile.' + stype, 'tiles/' + stype + '.png', sha))
    print('tile.' + stype + '|' + sha[:16])
# 行清单落盘到项目内暂存目录（该目录已被 git 忽略；避免使用系统级临时目录，
# 后者在 Windows 不可用且位于项目之外）。
staging_dir = Path('tmp')
staging_dir.mkdir(exist_ok=True)
manifest_path = staging_dir / 'tile_manifest_rows.json'
with manifest_path.open('w') as fh:
    json.dump(rows, fh)
print(f'baked {len(rows)} tile textures (seamless {N}x{N})')
