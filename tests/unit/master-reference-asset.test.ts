import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateManifest, type AssetManifest } from '../../src/io/assets';

const manifest: AssetManifest = validateManifest(JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf8')));
const refs = manifest.sprites.filter(entry => entry.id.startsWith('reference.master.'));

describe('Phase 1 master reference assets', () => {
  it('登记至少一个 master reference 候选图', () => {
    expect(refs.length).toBeGreaterThanOrEqual(1);
  });

  it('保留私有 provenance 字段而不伪造 human edits', () => {
    for (const ref of refs) {
      expect(ref.path.startsWith('references/')).toBe(true);
      expect(ref.license).toBe('AI-Generated');
      expect(ref.ai_disclosed).toBe(true);
      expect(ref.src?.prompt.length ?? 0).toBeGreaterThan(40);
      expect(Array.isArray(ref.src?.master_ref)).toBe(true);
      expect(Array.isArray(ref.src?.ref_imgs)).toBe(true);
      expect(Array.isArray(ref.human_edits)).toBe(true);
    }
  });

  it('每张 master reference 文件存在、为合法 PNG、checksum 匹配 manifest', () => {
    for (const ref of refs) {
      const filePath = resolve('assets', ref.path);
      expect(existsSync(filePath), `${ref.id} should exist on disk`).toBe(true);
      const buffer = readFileSync(filePath);
      expect(buffer[0]).toBe(0x89);
      expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
      const checksum = createHash('sha256').update(buffer).digest('hex');
      expect(checksum).toBe(ref.checksum);
    }
  });
});
