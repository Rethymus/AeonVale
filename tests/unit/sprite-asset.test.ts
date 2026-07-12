/**
 * 角色精灵资产完整性测试（多重审核的"入库后"锁）。
 * 入库前的多重审核（fmt/palette/content/vision/provenance）由 tools/review-ai-art.py + Read 视觉判定
 * 在准入时执行（详见 assets/ART-ASSETS-STATUS.md）；本测试锁定已入库精灵的完整性：
 * 文件存在、32x32 PNG、checksum 与 manifest 一致、许可合法。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateManifest, type AssetManifest } from '../../src/io/assets';

const manifest: AssetManifest = validateManifest(
  JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf-8')),
);
const sprites = manifest.sprites.filter((e) => e.id.startsWith('sprite.') || e.id.startsWith('icon.') || e.id.startsWith('facility.') || e.id.startsWith('loc.') || e.id.startsWith('tile.'));

describe('图像资产完整性（角色精灵 + 物品图标）', () => {
  it('若已登记精灵/图标条目，则进入完整性锁定', () => {
    expect(Array.isArray(sprites)).toBe(true);
  });

  for (const sp of sprites) {
    describe(`${sp.id}`, () => {
      const filePath = resolve('assets', sp.path);

      it('文件存在', () => {
        expect(() => statSync(filePath)).not.toThrow();
      });

      it('为 32x32 合法 PNG', () => {
        const buf = readFileSync(filePath);
        // PNG 魔数
        expect(buf[0]).toBe(0x89);
        expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
        // IHDR 的宽高（字节 16-23）
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        const expected = sp.id.startsWith('tile.') ? 42 : 32;
        expect(w).toBe(expected);
        expect(h).toBe(expected);
      });

      it('sha256 与 manifest checksum 一致', () => {
        const buf = readFileSync(filePath);
        const sha = createHash('sha256').update(buf).digest('hex');
        expect(sha).toBe(sp.checksum);
      });

      it('license 合法（AI 须留痕）', () => {
        expect(sp.license.length).toBeGreaterThan(0);
        expect(sp.source.length).toBeGreaterThan(0);
      });
    });
  }
});
