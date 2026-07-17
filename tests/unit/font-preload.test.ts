import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetStore, validateManifest, type AssetManifest } from '../../src/io/assets';
import { preloadUiFont, UI_FONT_ASSET_ID, UI_FONT_FAMILY } from '../../src/app/fontPreload';

const CHECKSUM = 'a'.repeat(64);

function createStore(path = 'fonts/lxgw-wenkai-regular.subset.woff2'): AssetStore {
  const manifest: AssetManifest = validateManifest({
    version: 1,
    sprites: [],
    audio: [],
    shaders: [],
    fonts: [
      {
        id: UI_FONT_ASSET_ID,
        path,
        type: 'woff2',
        checksum: CHECKSUM,
        license: 'OFL-1.1',
        source: 'https://example.invalid/lxgw'
      }
    ]
  });
  return new AssetStore(manifest);
}

interface MockFace {
  family: string;
  source: string;
  descriptors: FontFaceDescriptors | undefined;
}

/** 可迭代的 FontFaceSet 替身：支持 add/load/check 与 for...of，用于覆盖 hasRegisteredFamily。 */
function makeFonts(initial: MockFace[] = []) {
  const faces = [...initial];
  return {
    add: vi.fn((f: MockFace) => {
      faces.push(f);
    }),
    load: vi.fn(async () => []),
    check: vi.fn(() => false),
    [Symbol.iterator]: () => faces.values()
  };
}

function makeFontFaceCtor(faceLoad: ReturnType<typeof vi.fn>) {
  return class MockFontFace {
    family: string;
    source: string;
    descriptors: FontFaceDescriptors | undefined;

    constructor(family: string, source: string, descriptors?: FontFaceDescriptors) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
    }

    load = faceLoad;
  };
}

describe('preloadUiFont', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('未注册时构造 FontFace、加载并注册到 document.fonts', async () => {
    const faceLoad = vi.fn(async function (this: MockFace) {
      return this;
    });
    const MockFontFace = makeFontFaceCtor(faceLoad);
    const fonts = makeFonts([]);

    vi.stubGlobal('document', { fonts });
    vi.stubGlobal('FontFace', MockFontFace);

    await preloadUiFont(createStore());

    expect(faceLoad).toHaveBeenCalledTimes(1);
    expect(fonts.add).toHaveBeenCalledTimes(1);
    expect(fonts.load).toHaveBeenCalledWith(`1em "${UI_FONT_FAMILY}"`);
    const loadedFace = fonts.add.mock.calls[0]?.[0] as MockFace;
    expect(loadedFace.family).toBe(UI_FONT_FAMILY);
    expect(loadedFace.source).toContain('fonts/lxgw-wenkai-regular.subset.woff2');
    expect(loadedFace.descriptors).toMatchObject({ weight: '400', style: 'normal', display: 'swap' });
  });

  it('check() 即使返回 true（假阳性），只要未真正注册仍会构造并加载 FontFace（线上回归保护）', async () => {
    // 这正是线上触发 bug 的语义：check()=true 但 document.fonts 里其实没有该 family。
    const faceLoad = vi.fn(async function (this: MockFace) {
      return this;
    });
    const MockFontFace = makeFontFaceCtor(faceLoad);
    const fonts = makeFonts([]); // 未注册
    fonts.check.mockReturnValue(true); // 规范级假阳性

    vi.stubGlobal('document', { fonts });
    vi.stubGlobal('FontFace', MockFontFace);

    await preloadUiFont(createStore());

    expect(faceLoad).toHaveBeenCalledTimes(1); // 关键：不能因为 check()=true 就跳过
    expect(fonts.add).toHaveBeenCalledTimes(1);
  });

  it('已真正注册（document.fonts 含该 family）时不重复构造 FontFace', async () => {
    const ctor = vi.fn();
    const fonts = makeFonts([{ family: UI_FONT_FAMILY, source: '', descriptors: undefined }]);

    vi.stubGlobal('document', { fonts });
    vi.stubGlobal('FontFace', ctor);

    await preloadUiFont(createStore());

    expect(ctor).not.toHaveBeenCalled();
    expect(fonts.add).not.toHaveBeenCalled();
    expect(fonts.load).toHaveBeenCalledWith(`1em "${UI_FONT_FAMILY}"`);
  });

  it('字体资源加载失败时不抛出，回退系统字体', async () => {
    const MockFontFace = class {
      load = vi.fn(async () => {
        throw new Error('network');
      });
    };
    const fonts = makeFonts([]);

    vi.stubGlobal('document', { fonts });
    vi.stubGlobal('FontFace', MockFontFace as unknown as typeof FontFace);

    await expect(preloadUiFont(createStore())).resolves.toBeUndefined();
    expect(fonts.add).not.toHaveBeenCalled();
  });
});
