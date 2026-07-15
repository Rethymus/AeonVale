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
 source: 'https://example.invalid/lxgw',
 },
 ],
 });
 return new AssetStore(manifest);
}

describe('preloadUiFont', () => {
 beforeEach(() => {
 vi.unstubAllGlobals();
 });

it('在字体尚未注册时，会先通过 FontFace 注册并等待 document.fonts.load', async () => {
 const add = vi.fn();
 const load = vi.fn(async () => []);
 const check = vi.fn(() => false);
 const faceLoad = vi.fn(async function (this: { family: string }) {
 return this;
 });

class MockFontFace {
 family: string;
 source: string;
 descriptors: FontFaceDescriptors | undefined;

constructor(family: string, source: string, descriptors?: FontFaceDescriptors) {
 this.family = family;
 this.source = source;
 this.descriptors = descriptors;
 }

load = faceLoad;
 }

vi.stubGlobal('document', {
 fonts: {
 add,
 load,
 check,
 },
 });
 vi.stubGlobal('FontFace', MockFontFace);

await preloadUiFont(createStore());

expect(check).toHaveBeenCalledWith(`1em "${UI_FONT_FAMILY}"`);
 expect(faceLoad).toHaveBeenCalledTimes(1);
 expect(add).toHaveBeenCalledTimes(1);
 expect(load).toHaveBeenCalledWith(`1em "${UI_FONT_FAMILY}"`);
 const loadedFace = add.mock.calls[0]?.[0] as MockFontFace;
 expect(loadedFace.family).toBe(UI_FONT_FAMILY);
 expect(loadedFace.source).toContain("fonts/lxgw-wenkai-regular.subset.woff2");
 expect(loadedFace.descriptors).toMatchObject({ weight: '400', style: 'normal', display: 'swap' });
 });

it('已注册时只等待 document.fonts.load，不重复构造 FontFace', async () => {
 const add = vi.fn();
 const load = vi.fn(async () => []);
 const check = vi.fn(() => true);
 const ctor = vi.fn();

vi.stubGlobal('document', {
 fonts: {
 add,
 load,
 check,
 },
 });
 vi.stubGlobal('FontFace', ctor);

await preloadUiFont(createStore());

expect(check).toHaveBeenCalledWith(`1em "${UI_FONT_FAMILY}"`);
 expect(ctor).not.toHaveBeenCalled();
 expect(add).not.toHaveBeenCalled();
 expect(load).toHaveBeenCalledWith(`1em "${UI_FONT_FAMILY}"`);
 });
});
