/**
 * R4′ meta 硬传承（docs/25 §4：掉境界、保知识残卷）。
 *
 * 跨周目 meta：渡劫失败（死亡）→ 掉境界（重爬）、保残卷知识（解锁的 lore 页 + 阶段可达性）。
 * transition 函数为纯逻辑（可单测）；load/save 是 localStorage 薄封装。
 * 红线：meta 属 app 层独占，不进 src/sim（确定性核心不持久化跨周目状态，引 docs/25 §8 / docs/22 §5）。
 */
export interface ScrollPage {
  readonly stage: number;
  readonly title: string;
  readonly body: string;
}

/**
 * 残卷页：每阶对应一页 lore，原典文本取自 Notion《永恒山谷：大道之歌》完整设定集（2026-07-18 正典审阅版）
 * 的"空灵根 / 神农 / 败者逆 / 天道 / 寿元 / 核心循环"节；《偷天换劫诀》口诀与六重淬体名见 docs/22 §4.5/§6。
 * 每页保持简短可读（UI 面板），既溯源正典、又服务 meta 滴灌叙事。
 */
export const SCROLL_PAGES: Readonly<Record<number, ScrollPage>> = {
  0: {
    stage: 0,
    title: '认劫 · 残卷首页',
    body: '「此诀非人所修。无灵根者，方可习之。以劫为薪，以骨为柴。偷天一线，换劫三生。习此诀者，已死。」——残卷首页。百万年前，第一位异世穿越者写下它，只记"怎么做"，把真正的理论嵌进了脚下的土地。'
  },
  1: {
    stage: 1,
    title: '察漏',
    body: '你不是没有灵根，是万古一遇的空灵根——吸灵天下第一，却一滴都留不住，测灵柱读数与废物无异。可泄漏的灵气进了土地，反成了灵田与肉身的反馈。漏洞，正是这条路的开端。'
  },
  2: {
    stage: 2,
    title: '引路',
    body: '先看水往哪里走。神农百万年前在这片田里下田报恩，发现灵草的排列能改变天劫落点。他没把理论写下，只嵌进土地——唯有亲手种田、观察灵气回流的人，才能读懂。'
  },
  3: {
    stage: 3,
    title: '借势',
    body: '以劫为薪，以骨为柴。主动引劫，就是主动向天道暴露自己。你布的阵是借天势的器具：引雷入体，凡骨方有重塑之机。药力像临时塞子，只够短时间封堵一部分漏洞。'
  },
  4: {
    stage: 4,
    title: '淬骨',
    body: '败者"逆"——另一位穿越者、空灵根、走在这条路上更远的人。他在高阶天劫力竭，被萧无极重创，化为劫灰。玉佩上只刻一个"逆"字，遗言只剩"勿……"，永远没说完。你脚下的田，他曾倒在那里。'
  },
  5: {
    stage: 5,
    title: '守我',
    body: '每偷天一阶，便要拿一段记忆或一点情感去当柴。初始寿元八百四十日，过一日少一日，突破一次只争回一百八十日。远方仙人百年闭关，你只有几十年——时间本身就是压迫。'
  },
  6: {
    stage: 6,
    title: '归一 · 紫雷终劫',
    body: '天道不是有脸的神，是秩序、世界的免疫与因果账本，以雷、大限、星象清算越界者。终局四选：飞升（漏洞全闭合）、留世、献身、或取代天道——屠龙者，是否只是想成为新的压迫者？'
  }
};

export const SCROLL_TOTAL: number = Object.keys(SCROLL_PAGES).length;

export interface SokobanMeta {
  readonly maxStageSolved: number; // 最高已通关阶（-1=从未通关）；决定可游玩上限
  readonly unlockedScrolls: readonly number[]; // 已得残卷页（stage 列表）
  readonly deathCount: number; // 灰烬传承次数
  readonly breakthroughs: number; // 总突破次数
}

export function emptyMeta(): SokobanMeta {
  return { maxStageSolved: -1, unlockedScrolls: [], deathCount: 0, breakthroughs: 0 };
}

/** 阶段是否可游玩：可重玩任何已通关阶，并在其上再探一阶。 */
export function isStageUnlocked(meta: SokobanMeta, stage: number): boolean {
  return stage >= 0 && stage <= meta.maxStageSolved + 1;
}

export interface MetaTransition {
  readonly meta: SokobanMeta;
  readonly unlockedScroll: ScrollPage | null; // 本次新解锁的残卷页（用于弹提示）；null=已得
}

/** 通关一阶：更新最高已解、解锁该阶残卷（首次）、突破计数+1。 */
export function recordBreakthrough(meta: SokobanMeta, stage: number): MetaTransition {
  const isNew = !meta.unlockedScrolls.includes(stage);
  return {
    meta: {
      maxStageSolved: Math.max(meta.maxStageSolved, stage),
      unlockedScrolls: isNew ? [...meta.unlockedScrolls, stage] : meta.unlockedScrolls,
      deathCount: meta.deathCount,
      breakthroughs: meta.breakthroughs + 1
    },
    unlockedScroll: isNew ? (SCROLL_PAGES[stage] ?? null) : null
  };
}

/**
 * 渡劫失败（死亡）：掉境界（调用方重置 stage=0 重爬），保残卷——把当阶 lore 作为"灰烬传承"解锁（首次）；
 * maxStageSolved 保留（硬传承：失败不锁进度，只是这趟白爬）；死亡计数+1。
 */
export function recordDeath(meta: SokobanMeta, stage: number): MetaTransition {
  const isNew = !meta.unlockedScrolls.includes(stage);
  return {
    meta: {
      maxStageSolved: meta.maxStageSolved,
      unlockedScrolls: isNew ? [...meta.unlockedScrolls, stage] : meta.unlockedScrolls,
      deathCount: meta.deathCount + 1,
      breakthroughs: meta.breakthroughs
    },
    unlockedScroll: isNew ? (SCROLL_PAGES[stage] ?? null) : null
  };
}

const STORAGE_KEY = 'aeonvale-sokoban-meta-v1';

export function loadMeta(): SokobanMeta {
  if (typeof localStorage === 'undefined') return emptyMeta();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw) as Partial<SokobanMeta>;
    return {
      maxStageSolved: typeof parsed.maxStageSolved === 'number' ? parsed.maxStageSolved : -1,
      unlockedScrolls: Array.isArray(parsed.unlockedScrolls) ? parsed.unlockedScrolls.filter((n): n is number => typeof n === 'number') : [],
      deathCount: typeof parsed.deathCount === 'number' ? parsed.deathCount : 0,
      breakthroughs: typeof parsed.breakthroughs === 'number' ? parsed.breakthroughs : 0
    };
  } catch {
    return emptyMeta();
  }
}

export function saveMeta(meta: SokobanMeta): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* 隐私模式 / 配额满：静默降级，不阻塞游玩 */
  }
}
