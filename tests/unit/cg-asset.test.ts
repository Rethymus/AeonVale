/**
  * 结局 CG 资产测试。
  * 锁定：manifest 登记 CG、每张图都有可追溯 provenance、文件为合法 PNG、checksum 匹配。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateManifest, verifyChecksum, type AssetManifest } from '../../src/io/assets';

const manifest: AssetManifest = validateManifest(
 JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf-8')),
);
const all = [...manifest.sprites, ...manifest.audio, ...manifest.fonts, ...manifest.shaders];
const cgs = all.filter((e) => e.id.startsWith('cg.'));

describe('结局 CG 资产（§1.3 AI 例外）', () => {
 it('至少登记了 3 张结局 CG（ascension / lifespan-death / poison-death）', () => {
 expect(cgs.length).toBeGreaterThanOrEqual(3);
 });

it('所有 CG 条目使用受允许许可且 source 非空（provenance 留痕）', () => {
 for (const cg of cgs) {
 expect(['AI-Generated', 'CC-BY-NC-4.0', 'CC-BY-4.0', 'CC0-1.0']).toContain(cg.license);
 expect(cg.source.length).toBeGreaterThan(0);
 }
 });

it('每张 CG 文件存在、为合法 PNG、sha256 与 manifest 一致', async () => {
 expect(cgs.length).toBeGreaterThan(0);
 for (const cg of cgs) {
 const buf = readFileSync(resolve('assets', cg.path));
 expect(buf.length).toBeGreaterThan(20_000); // CG 应有足够细节
 // PNG 魔数：89 50 4E 47 0D 0A 1A 0A
 expect(buf[0]).toBe(0x89);
 expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
 await expect(verifyChecksum(new Uint8Array(buf), cg.checksum)).resolves.toBe(true);
 }
 });
});
