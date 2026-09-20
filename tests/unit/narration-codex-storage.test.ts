/**
 * 灵韵叙录 · 跨周目表解码边界（TT-04，docs/23 §4 物理分层契约）。
 *
 * narrationCodex 的 readArray 是 localStorage 字符串数组解码的唯一路径：
 * 本周目表 / 跨周目表 / 结局表三张表存的是玩家不可再生的进度，坏档必须
 * 降级为空集而非抛错。storage 走公开注入缝（NarrationCodexStorage），
 * 纯 node 环境可测，无需 DOM。
 */
import { describe, expect, it } from 'vitest';

import {
  beginNewRun,
  readSeenEndings,
  recordEnding,
  recordSeenScene,
  type NarrationCodexStorage
} from '../../src/app/narrationCodex';

const ENDINGS_KEY = 'narration.codex.seenEndings';
const RUN_KEY = 'narration.codex.seenThisRun';
const EVER_KEY = 'narration.codex.seenScenesEver';

function fakeStorage(initial?: Record<string, string>): NarrationCodexStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    getItem(key: string): string | null {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      data.set(key, value);
    }
  };
}

describe('narration codex · readArray 解码边界（经 readSeenEndings 观测）', () => {
  it('空存储 → 空集；且键名稳定（改键名 = 静默丢玩家跨周目进度，此处报警）', () => {
    expect(readSeenEndings(fakeStorage())).toEqual(new Set());
    expect(readSeenEndings(fakeStorage({ [ENDINGS_KEY]: JSON.stringify(['ascension']) }))).toEqual(new Set(['ascension']));
  });

  it('畸形 JSON / JSON 非数组（对象、字符串、数字）→ 空集不抛', () => {
    expect(readSeenEndings(fakeStorage({ [ENDINGS_KEY]: '{not json' }))).toEqual(new Set());
    expect(readSeenEndings(fakeStorage({ [ENDINGS_KEY]: '{"0":"ascension"}' }))).toEqual(new Set());
    expect(readSeenEndings(fakeStorage({ [ENDINGS_KEY]: '"ascension"' }))).toEqual(new Set());
    expect(readSeenEndings(fakeStorage({ [ENDINGS_KEY]: '42' }))).toEqual(new Set());
  });

  it('混型数组 → 过滤保留字符串元素', () => {
    const storage = fakeStorage({ [ENDINGS_KEY]: JSON.stringify(['ascension', 42, null, 'e6-sacrifice', {}]) });
    expect(readSeenEndings(storage)).toEqual(new Set(['ascension', 'e6-sacrifice']));
  });
});

describe('narration codex · 写入与跨周目分层', () => {
  it('recordSeenScene 写本周目 + 跨周目两表，幂等不重复', () => {
    const storage = fakeStorage();
    recordSeenScene('act1.reveal', storage);
    recordSeenScene('act1.reveal', storage);
    expect(JSON.parse(storage.data.get(RUN_KEY)!)).toEqual(['act1.reveal']);
    expect(JSON.parse(storage.data.get(EVER_KEY)!)).toEqual(['act1.reveal']);

    recordSeenScene('act2.train', storage);
    expect(JSON.parse(storage.data.get(RUN_KEY)!)).toEqual(['act1.reveal', 'act2.train']);
  });

  it('recordEnding 写结局表且幂等', () => {
    const storage = fakeStorage();
    recordEnding('ascension', storage);
    recordEnding('ascension', storage);
    expect(JSON.parse(storage.data.get(ENDINGS_KEY)!)).toEqual(['ascension']);
    expect(readSeenEndings(storage)).toEqual(new Set(['ascension']));
  });

  it('beginNewRun 只清本周目表；跨周目表与结局表保留（防剧透物理分层契约）', () => {
    const storage = fakeStorage({
      [RUN_KEY]: JSON.stringify(['act1.reveal']),
      [EVER_KEY]: JSON.stringify(['act1.reveal', 'prologue.awaken']),
      [ENDINGS_KEY]: JSON.stringify(['ascension'])
    });
    beginNewRun(storage);
    expect(JSON.parse(storage.data.get(RUN_KEY)!)).toEqual([]);
    expect(JSON.parse(storage.data.get(EVER_KEY)!)).toEqual(['act1.reveal', 'prologue.awaken']);
    expect(JSON.parse(storage.data.get(ENDINGS_KEY)!)).toEqual(['ascension']);
  });
});
