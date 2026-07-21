#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'assets/map-sprites');
const manifestPath = resolve(root, 'assets/manifest.json');

const swatch = {
  black: '#000000',
  ink: '#1a1a1f',
  panel: '#12121c',
  paper: '#f4ecd8',
  paperMuted: '#d8d0ba',
  trueWhite: '#ffffff',
  mountain: '#5c6b73',
  frost: '#9fb6c4',
  soil: '#6b4f2a',
  soilDeep: '#4a3318',
  soilShadow: '#2a1a0a',
  soilHighlight: '#d8b070',
  water: '#2a4a6b',
  qiFlow: '#4a8c9c',
  qiBright: '#66ddff',
  moss: '#7a8c5a',
  leaf: '#4a9a30',
  success: '#7fe38b',
  danger: '#b5482f',
  ember: '#ff8a3a',
  gilt: '#c9a14a',
  giltBright: '#ffe066',
  purple: '#7b6c8a',
  purpleBright: '#b48cff'
};

const characters = [
  {
    id: 'map-sprite.player-v1',
    name: 'player',
    display: 'cultivator protagonist',
    robe: swatch.danger,
    trim: swatch.gilt,
    hair: swatch.ink,
    accent: swatch.giltBright,
    prop: 'hoe',
    stance: 'front'
  },
  {
    id: 'map-sprite.herb-gatherer-v1',
    name: 'herb-gatherer',
    display: 'herb gatherer',
    robe: swatch.moss,
    trim: swatch.success,
    hair: swatch.ink,
    accent: swatch.qiBright,
    prop: 'herb-basket',
    stance: 'front'
  },
  {
    id: 'map-sprite.array-smith-lu-v1',
    name: 'array-smith-lu',
    display: 'array smith Lu',
    robe: swatch.soilDeep,
    trim: swatch.gilt,
    hair: swatch.mountain,
    accent: swatch.giltBright,
    prop: 'compass',
    stance: 'front'
  },
  {
    id: 'map-sprite.liaochen-v1',
    name: 'liaochen',
    display: 'travelling trader Liaochen',
    robe: swatch.soil,
    trim: swatch.soilHighlight,
    hair: swatch.ink,
    accent: swatch.giltBright,
    prop: 'pack',
    stance: 'front'
  },
  {
    id: 'map-sprite.wangyan-elder-v1',
    name: 'wangyan-elder',
    display: 'elder Wangyan',
    robe: swatch.mountain,
    trim: swatch.paperMuted,
    hair: swatch.frost,
    accent: swatch.qiFlow,
    prop: 'staff',
    stance: 'front'
  },
  {
    id: 'map-sprite.xiao-wuji-v1',
    name: 'xiao-wuji',
    display: 'Xiao Wuji',
    robe: swatch.paper,
    trim: swatch.qiFlow,
    hair: swatch.ink,
    accent: swatch.purpleBright,
    prop: 'sword',
    stance: 'front'
  },
  {
    id: 'map-sprite.market-merchant-v1',
    name: 'market-merchant',
    display: 'market merchant',
    robe: swatch.soil,
    trim: swatch.gilt,
    hair: swatch.soilShadow,
    accent: swatch.giltBright,
    prop: 'pack',
    stance: 'front'
  },
  {
    id: 'map-sprite.tea-shed-elder-v1',
    name: 'tea-shed-elder',
    display: 'tea shed elder',
    robe: swatch.water,
    trim: swatch.paperMuted,
    hair: swatch.frost,
    accent: swatch.qiBright,
    prop: 'tea',
    stance: 'front'
  },
  {
    id: 'map-sprite.processing-artisan-v1',
    name: 'processing-artisan',
    display: 'processing artisan',
    robe: swatch.soilDeep,
    trim: swatch.moss,
    hair: swatch.ink,
    accent: swatch.ember,
    prop: 'tray',
    stance: 'front'
  },
  {
    id: 'map-sprite.patrol-guard-v1',
    name: 'patrol-guard',
    display: 'valley patrol guard',
    robe: swatch.ink,
    trim: swatch.water,
    hair: swatch.ink,
    accent: swatch.qiBright,
    prop: 'spear',
    stance: 'front'
  }
];

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function propSvg(c) {
  switch (c.prop) {
    case 'hoe':
      return `
        <g stroke="${swatch.soilShadow}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M74 91 L61 203"/>
          <path d="M51 96 L83 86"/>
        </g>
        <path d="M49 94 L83 84 L87 94 L55 105 Z" fill="${swatch.gilt}" opacity=".92"/>`;
    case 'herb-basket':
      return `
        <ellipse cx="82" cy="166" rx="23" ry="18" fill="${swatch.soil}" stroke="${swatch.soilShadow}" stroke-width="6"/>
        <path d="M64 157 C70 135 94 135 101 157" fill="none" stroke="${swatch.soilHighlight}" stroke-width="6" stroke-linecap="round"/>
        <path d="M72 145 C63 127 80 124 84 141 C91 124 111 131 96 148" fill="${swatch.success}" stroke="${swatch.leaf}" stroke-width="4"/>`;
    case 'compass':
      return `
        <circle cx="174" cy="158" r="25" fill="${swatch.panel}" stroke="${swatch.giltBright}" stroke-width="6"/>
        <circle cx="174" cy="158" r="12" fill="none" stroke="${swatch.qiBright}" stroke-width="4"/>
        <path d="M174 132 L184 158 L174 184 L164 158 Z" fill="${swatch.danger}" opacity=".92"/>`;
    case 'pack':
      return `
        <rect x="66" y="111" width="35" height="54" rx="12" fill="${swatch.soilDeep}" stroke="${swatch.soilHighlight}" stroke-width="5"/>
        <path d="M58 133 H107" stroke="${swatch.gilt}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="84" cy="148" r="10" fill="${swatch.giltBright}" stroke="${swatch.soilShadow}" stroke-width="4"/>`;
    case 'staff':
      return `
        <path d="M72 70 C50 119 56 165 47 220" fill="none" stroke="${swatch.soilShadow}" stroke-width="8" stroke-linecap="round"/>
        <circle cx="72" cy="70" r="10" fill="${swatch.qiBright}" opacity=".72"/>
        <path d="M64 65 C73 47 91 59 79 75" fill="none" stroke="${swatch.gilt}" stroke-width="5" stroke-linecap="round"/>`;
    case 'sword':
      return `
        <path d="M178 61 L196 184" stroke="${swatch.qiFlow}" stroke-width="7" stroke-linecap="round"/>
        <path d="M187 45 L202 88 L178 92 Z" fill="${swatch.paperMuted}" stroke="${swatch.mountain}" stroke-width="4"/>
        <path d="M171 118 L199 114" stroke="${swatch.gilt}" stroke-width="6" stroke-linecap="round"/>`;
    case 'tea':
      return `
        <ellipse cx="176" cy="159" rx="21" ry="12" fill="${swatch.paperMuted}" stroke="${swatch.water}" stroke-width="5"/>
        <path d="M158 157 C166 172 186 172 193 157" fill="${swatch.qiFlow}" opacity=".82"/>
        <path d="M174 132 C165 119 180 111 174 98" fill="none" stroke="${swatch.qiBright}" stroke-width="5" stroke-linecap="round" opacity=".7"/>`;
    case 'tray':
      return `
        <path d="M66 162 C88 151 113 152 135 162 L129 180 C110 188 91 187 72 180 Z" fill="${swatch.soilHighlight}" stroke="${swatch.soilShadow}" stroke-width="5"/>
        <circle cx="94" cy="161" r="8" fill="${swatch.ember}"/>
        <circle cx="115" cy="163" r="7" fill="${swatch.success}"/>`;
    case 'spear':
      return `
        <path d="M183 50 L174 220" stroke="${swatch.soilShadow}" stroke-width="7" stroke-linecap="round"/>
        <path d="M184 36 L199 68 L176 70 Z" fill="${swatch.qiBright}" stroke="${swatch.water}" stroke-width="4"/>
        <path d="M159 116 L190 112" stroke="${swatch.gilt}" stroke-width="5" stroke-linecap="round"/>`;
    default:
      return '';
  }
}

function hairSvg(c) {
  if (c.hair === swatch.frost) {
    return `
      <path d="M101 72 C105 39 151 39 157 72 C146 61 114 61 101 72 Z" fill="${c.hair}" stroke="${swatch.mountain}" stroke-width="5"/>
      <path d="M106 91 C114 125 145 125 152 91" fill="none" stroke="${c.hair}" stroke-width="10" stroke-linecap="round" opacity=".9"/>`;
  }

  return `
    <path d="M98 75 C101 36 153 36 158 75 C148 58 111 56 98 75 Z" fill="${c.hair}" stroke="${swatch.ink}" stroke-width="5"/>
    <path d="M103 88 C96 105 99 126 111 137" fill="none" stroke="${c.hair}" stroke-width="9" stroke-linecap="round" opacity=".9"/>
    <path d="M153 88 C162 107 158 128 145 139" fill="none" stroke="${c.hair}" stroke-width="8" stroke-linecap="round" opacity=".88"/>`;
}

function svg(c) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${esc(c.display)}">
  <defs>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="4" result="offset"/>
      <feComponentTransfer><feFuncA type="linear" slope=".28"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#softShadow)">
    <ellipse cx="128" cy="225" rx="55" ry="13" fill="${swatch.black}" opacity=".28"/>
    ${propSvg(c)}
    <path d="M102 184 C98 198 96 215 94 228" fill="none" stroke="${swatch.soilShadow}" stroke-width="12" stroke-linecap="round"/>
    <path d="M152 184 C158 199 161 215 162 228" fill="none" stroke="${swatch.soilShadow}" stroke-width="12" stroke-linecap="round"/>
    <path d="M88 105 C64 128 60 158 77 180 C91 170 95 145 104 122 Z" fill="${c.robe}" opacity=".94" stroke="${swatch.soilShadow}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M168 105 C193 129 197 159 179 181 C166 170 161 146 151 122 Z" fill="${c.robe}" opacity=".9" stroke="${swatch.soilShadow}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M99 97 C86 129 84 180 100 213 C117 226 140 226 158 213 C174 179 171 128 157 97 C141 108 116 108 99 97 Z" fill="${c.robe}" stroke="${swatch.soilShadow}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M103 103 C116 125 138 125 154 103" fill="none" stroke="${c.trim}" stroke-width="7" stroke-linecap="round"/>
    <path d="M126 111 C122 142 121 176 128 214" fill="none" stroke="${swatch.paperMuted}" stroke-width="5" stroke-linecap="round" opacity=".58"/>
    <path d="M96 154 C113 164 143 164 160 154" fill="none" stroke="${c.accent}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="128" cy="76" r="27" fill="${swatch.paper}" stroke="${swatch.soilShadow}" stroke-width="6"/>
    ${hairSvg(c)}
    <circle cx="118" cy="79" r="4" fill="${swatch.ink}"/>
    <circle cx="139" cy="79" r="4" fill="${swatch.ink}"/>
    <path d="M119 94 C126 101 136 100 142 94" fill="none" stroke="${swatch.soilShadow}" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    <circle cx="128" cy="43" r="9" fill="${c.accent}" opacity=".9"/>
    <circle cx="128" cy="43" r="4" fill="${swatch.trueWhite ?? '#ffffff'}" opacity=".55"/>
  </g>
</svg>`;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function renderPng(c) {
  const tmp = mkdtempSync(resolve(tmpdir(), 'aeon-map-character-'));
  const svgPath = resolve(tmp, `${c.name}.svg`);
  const outPath = resolve(outDir, `${c.id}.png`);
  writeFileSync(svgPath, svg(c), 'utf8');
  execFileSync('magick', ['-background', 'none', svgPath, '-resize', '64x64', outPath], { stdio: 'pipe' });
  return outPath;
}

function upsertManifest(entries) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const byId = new Map(manifest.sprites.map((entry, index) => [entry.id, { entry, index }]));
  const insertAt = Math.max(
    0,
    ...manifest.sprites.map((entry, index) => (entry.id.startsWith('map-sprite.') ? index + 1 : 0))
  );
  let cursor = insertAt;

  for (const row of entries) {
    const existing = byId.get(row.id);
    const next = {
      id: row.id,
      path: `map-sprites/${row.id}.png`,
      type: 'png',
      checksum: row.checksum,
      license: 'CC-BY-NC-4.0',
      source: `Procedural SVG character token generated by tools/gen-map-character-tokens.mjs; ${row.display}; AeonVale 2026-07 C2 readable world character pass`,
      human_edits: ['Palette-aligned vector silhouette; transparent 64px world marker; replaces opaque portrait crop or unreadable 32px pixel fallback.'],
      ai_disclosed: false
    };
    if (existing) {
      manifest.sprites[existing.index] = next;
    } else {
      manifest.sprites.splice(cursor, 0, next);
      cursor += 1;
    }
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`, 'utf8');
}

if (!existsSync(outDir)) {
  throw new Error(`Missing output directory: ${outDir}`);
}

const rows = characters.map(c => {
  const file = renderPng(c);
  return { id: c.id, display: c.display, checksum: sha256(file) };
});

if (process.argv.includes('--update-manifest')) {
  upsertManifest(rows);
}

for (const row of rows) {
  console.log(`${row.id} ${row.checksum}`);
}
