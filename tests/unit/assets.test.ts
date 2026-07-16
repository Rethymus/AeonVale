/**
 * 资产管线单测。
 * 覆盖：manifest schema 校验（含 license/checksum/source 强制）、AssetStore 索引、checksum 校验。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateManifest, AssetStore, assetPublicUrl, assetUrlForId, verifyChecksum, type AssetEntry, type AssetManifest } from '../../src/io/assets';

const GOOD_CHECKSUM = 'a'.repeat(64);

function entry(over: Partial<AssetEntry> = {}): AssetEntry {
  return {
    id: 'font.test',
    path: 'fonts/test.woff2',
    type: 'woff2',
    checksum: GOOD_CHECKSUM,
    license: 'OFL-1.1',
    source: 'https://example.invalid/test',
    ...over
  };
}

function manifest(fonts: AssetEntry[] = [], over: Partial<AssetManifest> = {}): unknown {
  return { version: 1, sprites: [], audio: [], fonts, shaders: [], ...over };
}

describe('资产 manifest 校验', () => {
  it('空清单合法（数组默认）', () => {
    const m = validateManifest({ version: 1 });
    expect(m.fonts).toEqual([]);
    expect(m.sprites).toEqual([]);
  });

  it('合法 OFL 字体条目通过', () => {
    const m = validateManifest(manifest([entry()]));
    expect(m.fonts[0]?.id).toBe('font.test');
  });

  it('允许项目自有原创资产使用 CC-BY-NC-4.0', () => {
    expect(validateManifest(manifest([entry({ license: 'CC-BY-NC-4.0' })])).fonts[0]?.license).toBe('CC-BY-NC-4.0');
  });

  it('拒绝非 SHA-256 checksum', () => {
    expect(() => validateManifest(manifest([entry({ checksum: 'not-hex' })]))).toThrow;
    expect(() => validateManifest(manifest([entry({ checksum: 'a'.repeat(63) })]))).toThrow;
  });

  it('拒绝缺 source（版权来源不明，§4.4 禁令）', () => {
    expect(() => validateManifest(manifest([entry({ source: '' })]))).toThrow;
  });

  it('允许白名单内许可', () => {
    for (const license of ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-NC-4.0', 'MIT', 'Apache-2.0', 'AI-Generated'] as const) {
      expect(validateManifest(manifest([entry({ id: `x.${license}`, license })])).fonts[0]?.license).toBe(license);
    }
  });
});

describe('AssetStore 索引', () => {
  it('跨类别重复 id 抛错', () => {
    const m = manifest([entry({ id: 'dup.1' })], { sprites: [entry({ id: 'dup.1', type: 'png' })] });
    expect(() => new AssetStore(validateManifest(m))).toThrow(/重复 AssetId/);
  });

  it('get/has/kindOf/list 正确分桶', () => {
    const m = validateManifest(manifest([entry({ id: 'font.a' }), entry({ id: 'font.b' })], { sprites: [entry({ id: 'sprite.a', type: 'png' })] }));
    const store = new AssetStore(m);
    expect(store.has('font.a')).toBe(true);
    expect(store.has('nope')).toBe(false);
    expect(store.get('sprite.a')?.type).toBe('png');
    expect(store.kindOf('font.a')).toBe('fonts');
    expect(store.kindOf('sprite.a')).toBe('sprites');
    expect(store.list('fonts')).toHaveLength(2);
    expect(store.list()).toHaveLength(3);
  });

  it('可将 AssetId 解析为运行时公共 URL', () => {
    const m = validateManifest(
      manifest([], {
        sprites: [entry({ id: 'sprite.player', type: 'png', path: 'sprites/player.png' })]
      })
    );
    const store = new AssetStore(m);
    expect(assetUrlForId(store, 'sprite.player')).toBe('sprites/player.png');
    expect(assetUrlForId(store, 'missing.asset')).toBeUndefined;
  });
});

describe('资产公共 URL', () => {
  it('会标准化为 publicDir 根下的相对路径', () => {
    expect(assetPublicUrl('sprites/player.png')).toBe('sprites/player.png');
    expect(assetPublicUrl('/sprites/player.png')).toBe('sprites/player.png');
  });
});

describe('checksum 校验', () => {
  // 'hello' 的 SHA-256
  const HELLO_SHA = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

  it('匹配的摘要返回 true', async () => {
    const bytes = new TextEncoder().encode('hello');
    await expect(verifyChecksum(bytes, HELLO_SHA)).resolves.toBe(true);
  });

  it('不匹配返回 false（不抛错）', async () => {
    const bytes = new TextEncoder().encode('hello');
    await expect(verifyChecksum(bytes, '0'.repeat(64))).resolves.toBe(false);
  });
});

describe('真实 manifest.json', () => {
  it('仓库内 manifest 合法', () => {
    const raw = JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf-8'));
    const m = validateManifest(raw);
    expect(m.version).toBe(1);
  });
});
