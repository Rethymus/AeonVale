/**
 * 开场视觉小说控制器。
 *
 * 对外仍保留 createPrologueVN 入口，内部改为复用通用 storyVN：
 * 序章负责“误判无灵根 → 归谷认命”，第一幕负责“斗法毁田 → 拾戒得卷 → 引雷淬体立誓”。
 * 这样新档在灵草教程前必须先经历关键动机转折。
 */
import { ACT1_SCENES } from '@content/act1Scenes';
import { PROLOGUE_SCENES } from '@content/prologueScenes';
import { createStoryVN, type StoryScene, type StoryVNController } from './storyVN';

export interface PrologueVNOptions {
  readonly root: HTMLElement;
  readonly onFinish: () => void;
  readonly onSkip: () => void;
  /** 减少动态效果时为 true：文字瞬时浮现，不做逐字演出。 */
  readonly reducedMotion: boolean;
  /** manifest AssetId → 运行时 URL。缺失时 CG 退化为水墨氛围层。 */
  readonly assetUrlForId?: (assetId: string) => string | undefined;
}

export type PrologueVNController = StoryVNController;

function assetUrl(assetUrlForId: ((assetId: string) => string | undefined) | undefined, assetId: string | undefined): string | undefined {
  if (!assetId) return undefined;
  return assetUrlForId?.(assetId);
}

function openingScenes(assetUrlForId: ((assetId: string) => string | undefined) | undefined): StoryScene[] {
  return [
    ...PROLOGUE_SCENES.map(
      (scene): StoryScene => ({
        id: `prologue-${scene.id}`,
        cg: assetUrl(assetUrlForId, scene.cgAssetId),
        lines: scene.lines,
        choices: scene.choices?.map(choice => ({
          label: choice.label,
          response: choice.response,
          cg: assetUrl(assetUrlForId, choice.cgAssetId ?? scene.cgAssetId)
        })),
        converge: scene.converge
      })
    ),
    ...ACT1_SCENES.map(
      (scene): StoryScene => ({
        id: `act1-${scene.id}`,
        cg: assetUrl(assetUrlForId, scene.cgAssetId) ?? scene.cg,
        lines: scene.lines,
        choices: scene.choices?.map(choice => ({
          label: choice.label,
          response: choice.response,
          cg: assetUrl(assetUrlForId, choice.cgAssetId ?? scene.cgAssetId) ?? choice.cg ?? scene.cg
        })),
        converge: scene.converge
      })
    )
  ];
}

export function createPrologueVN(options: PrologueVNOptions): PrologueVNController {
  return createStoryVN({
    root: options.root,
    scenes: openingScenes(options.assetUrlForId),
    onFinish: options.onFinish,
    onSkip: options.onSkip,
    reducedMotion: options.reducedMotion,
    stageId: 'prologue-vn-stage',
    stageLabel: '开场叙事舞台：按 Enter 或点击继续',
    skipControlId: 'flow-prologue-skip',
    skipLabel: '跳过开场'
  });
}
