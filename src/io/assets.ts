/**
 * 资产管线：manifest 校验 + AssetId 间接引用 + checksum 校验（docs/13 §5）。
 *
 * 设计要点：
 * - 纯数据层，无 PIXI/DOM 依赖，可在 Node 测试环境运行；实际二进制加载由渲染/音频层
 *   按 AssetId 取用（docs/13 §5.4「正式美术包接口预留」：render 层不直接 import 文件）。
 * - 强制版权留痕（docs/13 §4.4 禁令：来源不明资产禁止入库）：每条 entry 必须带 license + source。
 * - checksum 字段为 SHA-256 hex，供启动校验（§5.1/§5.2）；无 crypto 环境降级为不校验，
 *   由调用方决定是否阻断，保证 sim/io 层在 Node 不抛错（对齐 audio.ts 的 env-safe 风格）。
 */
import { z } from 'zod';

/** 允许的资产许可（docs/13 §4.4：仅 OFL/MIT/Apache 与 CC0/CC-BY；排除 NC 以免污染代码侧资产）。 */
export const ALLOWED_ASSET_LICENSES = [
  'OFL-1.1',
  'MIT',
  'Apache-2.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
] as const;

/** 允许的资产文件类型（docs/13 §5.1 AssetEntry.type）。 */
export const ALLOWED_ASSET_TYPES = [
  'png',
  'webp',
  'json',
  'wav',
  'mp3',
  'ogg',
  'ttf',
  'otf',
  'woff',
  'woff2',
  'glsl',
] as const;

export type AssetLicense = (typeof ALLOWED_ASSET_LICENSES)[number];
export type AssetFileType = (typeof ALLOWED_ASSET_TYPES)[number];
export type AssetKind = 'sprites' | 'audio' | 'fonts' | 'shaders';

/** 单条资产登记（docs/13 §5.1）。 */
export const assetEntrySchema = z.object({
  /** AssetId：引用键，如 'font.ark-pixel'、'sprite.herb.frostmarrow'。 */
  id: z.string().min(1),
  /** 相对 assets/ 的路径。 */
  path: z.string().min(1),
  type: z.enum(ALLOWED_ASSET_TYPES),
  /** SHA-256 hex（64 位），启动校验防损坏。 */
  checksum: z.string().regex(/^[0-9a-f]{64}$/i, 'checksum 必须是 SHA-256 hex（64 位）'),
  license: z.enum(ALLOWED_ASSET_LICENSES),
  /** 来源 URL 或取得说明，版权留痕。 */
  source: z.string().min(1),
});
export type AssetEntry = z.infer<typeof assetEntrySchema>;

/** 资产清单（docs/13 §5.1 AssetManifest）。 */
export const assetManifestSchema = z.object({
  version: z.number().int().nonnegative(),
  sprites: z.array(assetEntrySchema).default([]),
  audio: z.array(assetEntrySchema).default([]),
  fonts: z.array(assetEntrySchema).default([]),
  shaders: z.array(assetEntrySchema).default([]),
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;

/** AssetId 是字符串键；render/audio 层通过它间接取用，不直接 import 文件。 */
export type AssetId = string;

/** 校验并解析 manifest 原始数据；不符合 schema/license/checksum 格式则抛错。 */
export function validateManifest(raw: unknown): AssetManifest {
  return assetManifestSchema.parse(raw);
}

const ALL_KINDS: readonly AssetKind[] = ['sprites', 'audio', 'fonts', 'shaders'];

/**
 * AssetId → 条目索引。渲染/音频层只与此 store 打交道，资产替换只改 assets/ + manifest，
 * 不改代码（docs/13 §5.4）。重复 id 视为数据错误（抛错），避免静默覆盖。
 */
export class AssetStore {
  private readonly entries = new Map<AssetId, AssetEntry>();
  private readonly kindById = new Map<AssetId, AssetKind>();

  constructor(manifest: AssetManifest) {
    for (const kind of ALL_KINDS) {
      for (const entry of manifest[kind]) {
        if (this.entries.has(entry.id)) {
          throw new Error(`重复 AssetId：${entry.id}`);
        }
        this.entries.set(entry.id, entry);
        this.kindById.set(entry.id, kind);
      }
    }
  }

  get(id: AssetId): AssetEntry | undefined {
    return this.entries.get(id);
  }

  has(id: AssetId): boolean {
    return this.entries.has(id);
  }

  /** 该 id 所属类别（sprites/audio/fonts/shaders）。 */
  kindOf(id: AssetId): AssetKind | undefined {
    return this.kindById.get(id);
  }

  /** 列出某类（或全部）资产条目。 */
  list(kind?: AssetKind): AssetEntry[] {
    if (!kind) return [...this.entries.values()];
    return [...this.entries.entries()]
      .filter(([id]) => this.kindById.get(id) === kind)
      .map(([, entry]) => entry);
  }
}

/**
 * SHA-256 校验。env-safe：浏览器与 Node 20+ 都有 globalThis.crypto.subtle；
 * 无 crypto 时返回 false（降级，由调用方决定是否阻断），不抛错。
 */
export async function verifyChecksum(
  data: Uint8Array,
  expectedSha256: string,
): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;
  // 复制到全新 ArrayBuffer，规避 TS DOM lib 把 Uint8Array.buffer 推断为 ArrayBufferLike
  // （含 SharedArrayBuffer）而被 digest 拒绝的类型问题。
  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(data);
  const digest = await subtle.digest('SHA-256', buf);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === expectedSha256.toLowerCase();
}
