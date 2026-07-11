/**
 * CJK 字体资产闭环测试（docs/13 §4.4 / §5）。
 * 锁定：manifest 登记 OFL 字体、字体文件在盘、sha256 与 manifest 一致（防漂移）、AssetStore 可索引。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateManifest, AssetStore, verifyChecksum, type AssetManifest } from '../../src/io/assets';

const manifest: AssetManifest = validateManifest(
  JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf-8')),
);
const fontEntry = manifest.fonts.find((e) => e.id === 'font.lxgw-wenkai');
const FONT_PATH = resolve('assets', fontEntry?.path ?? 'fonts/MISSING.woff2');

describe('CJK 字体资产闭环', () => {
  it('manifest 登记了 LXGW WenKai，许可 OFL-1.1，类型 woff2', () => {
    expect(fontEntry).toBeDefined();
    expect(fontEntry?.license).toBe('OFL-1.1');
    expect(fontEntry?.type).toBe('woff2');
    expect(fontEntry?.source).toMatch(/lxgw|LxgwWenKai/i);
  });

  it('字体文件存在于 assets/fonts/ 且为合法 woff2（魔数 wOF2）', () => {
    const buf = readFileSync(FONT_PATH);
    expect(buf.length).toBeGreaterThan(50_000); // 子集后仍应有数十 KB
    expect(buf.slice(0, 4).toString('ascii')).toBe('wOF2');
  });

  it('文件 sha256 与 manifest checksum 一致（资产漂移即报错）', async () => {
    const buf = readFileSync(FONT_PATH);
    await expect(verifyChecksum(new Uint8Array(buf), fontEntry!.checksum)).resolves.toBe(true);
  });

  it('AssetStore 按 AssetId 可索引字体条目', () => {
    const store = new AssetStore(manifest);
    expect(store.has('font.lxgw-wenkai')).toBe(true);
    expect(store.kindOf('font.lxgw-wenkai')).toBe('fonts');
  });
});
