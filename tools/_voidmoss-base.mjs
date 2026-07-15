// Temporary helper: bake voidmoss procedural base (herb + seed) at 32px for AI refine input.
// element='neutral' to avoid cold-blue bias (voidmoss is ash-gray "void" moss, not frost).
import { generateHerbSprite, generateSeedSprite, toRgba, SPRITE_SIZE } from '../src/render/sprites';
import { writeFileSync } from 'node:fs';

const herb = generateHerbSprite({ id: 'herb.voidmoss', tier: 3, element: 'neutral' });
const seed = generateSeedSprite({ id: 'seed.voidmoss', element: 'neutral' });
writeFileSync('/tmp/vm-herb-base.rgba', Buffer.from(toRgba(herb)));
writeFileSync('/tmp/vm-seed-base.rgba', Buffer.from(toRgba(seed)));
console.log(`baked voidmoss herb+seed bases @ ${SPRITE_SIZE}x${SPRITE_SIZE} (element=neutral)`);
