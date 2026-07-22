import { describe, expect, it } from 'vitest';

import { enterScene, initialState, judgeFailState, nextState } from '@app/firstPersonView';
import { NARRATION_SCENES, NARRATION_SCENES_BY_ID } from '@app/narrationScenes';
import type { EndingId } from '@app/narrationTypes';

const TO_REVEAL_HELP = [
  'village', 'help', 'on', 'on', 'help', 'take', 'on', 'leave', 'farm',
  'hide', 'on', 'on', 'approach', 'try', 'open', 'on', 'on', 'reveal'
] as const;

const TO_REVEAL_HURRY = [
  'village', 'ask', 'on', 'on', 'hurry', 'on', 'leave', 'farm',
  'hide', 'on', 'on', 'approach', 'try', 'open', 'on', 'on', 'reveal'
] as const;

const CAVE_TO_PREPARATION = ['on', 'on', 'on', 'on', 'on'] as const;
const FINAL_TRIBULATION = ['on', 'on', 'on', 'on'] as const;

function play(choiceIds: readonly string[]): EndingId {
  const first = NARRATION_SCENES[0];
  if (!first) throw new Error('narration scene table is empty');

  let scene = first;
  let state = enterScene(initialState(), scene);
  for (const choiceId of choiceIds) {
    const result = nextState(state, scene, choiceId);
    state = result.state;
    if (result.ending) return result.ending;
    if (!result.nextSceneId) throw new Error(`path stopped at ${scene.id}.${choiceId}`);

    const nextScene = NARRATION_SCENES_BY_ID.get(result.nextSceneId);
    if (!nextScene) throw new Error(`missing scene ${result.nextSceneId}`);
    scene = nextScene;
    state = enterScene(state, scene);
    const failed = judgeFailState(state);
    if (failed) return failed;
  }

  if (scene.ends) return scene.ends;
  throw new Error(`path ended without an ending at ${scene.id}`);
}

const ROUTES: Readonly<Record<EndingId, readonly string[]>> = {
  'e0-mushroom': ['deep'],
  'lifespan-death': [...TO_REVEAL_HELP, 'seclude'],
  'poison-death': [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'overdose'
  ],
  madness: [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'back',
    'ditch', 'back', 'on', 'wanderer', 'help', 'on', 'share', 'break'
  ],
  'tribulation-death': [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'back',
    'ditch', 'back', 'on', 'xiao', 'fight'
  ],
  ascension: [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'back',
    'ditch', 'back', 'on', 'herbgirl', 'stand', 'on', 'share', 'on',
    ...CAVE_TO_PREPARATION, 'on', ...FINAL_TRIBULATION, 'answer'
  ],
  'e6-sacrifice': [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'force', 'force', 'save', 'force', 'seal',
    'ditch', 'back', 'force', 'herbgirl', 'deaf', 'force', 'share', 'force',
    ...CAVE_TO_PREPARATION, 'whistle', 'ditch', 'on', ...FINAL_TRIBULATION, 'e6'
  ],
  'e7-usurp': [
    ...TO_REVEAL_HURRY, 'practice', 'temper', 'force', 'force', 'abandon', 'force', 'seal',
    'market', 'back', 'force', 'herbgirl-cold', 'leave', 'force', 'keep', 'force',
    ...CAVE_TO_PREPARATION, 'on', ...FINAL_TRIBULATION, 'e7'
  ]
};

describe('灵韵叙录 · 状态级结局可达性', () => {
  for (const [ending, route] of Object.entries(ROUTES) as [EndingId, readonly string[]][]) {
    it(`${ending} 存在满足 requires、代价与失败态优先规则的真实路径`, () => {
      expect(play(route)).toBe(ending);
    });
  }
});
