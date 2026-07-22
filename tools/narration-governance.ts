/**
 * 灵韵叙录 CI 护栏（docs/23 §7 可执行契约）。
 *
 * 由 tools/governance-check.mjs 经 tsx 调起（governance:check 脚本链的一环）。任何一项
 * 失败即以非零码退出，整体 governance:check 随之失败。
 *
 * 五项检查：
 *  1. 结局可达性：解析 src/app/narrationScenes.ts 的 NARRATION_SCENES（import 后 introspect，
 *     该模块是纯数据、零 sim/IO 依赖，导入安全），建图（scene id=节点，choice.goto=边，
 *     choice.ends / scene.ends=终态），BFS 验证：8 个 EndingId 全可达；无孤儿 scene
 *     （从开场不可达且非开场）；无 dangling goto（goto 指向不存在的 scene id）；无死锁
 *     （可达 scene 存在到结局的路径，否则成环无出口）。
 *  2. 打字机文本无空键：每 NarrationChoice 有非空 label + (goto 或 ends 至少一个) + 非空 id；
 *     每 NarrationScene lines 非空（除非纯 ending scene，即 scene.ends 存在）。
 *  3. 运行时无 AI/fetch：静态扫 src/app + src/render，禁外部 API 主机 fetch( 与 AI SDK 关键字
 *     （openai/anthropic/grok/qwen/tongyi/@chatanywhere 等，docs/23 §0）。白名单：相对路径 fetch /
 *     manifest 资源 / 本地 dev server。MEDIUM9：非字面量 fetch（变量/模板拼接）保守告警
 *     让人审确认（无法静态判 host）。
 *  4. manifest 完整性：assets/manifest.json 中所有 cg.first-person.* 条目——checksum 与文件
 *     实际 sha256 一致、ai_disclosed:true、license 非空、status 属合法 AssetStatus 枚举。
 *     draft 允许（占位图），但在报告中计数（后续美术升 -v2 改 published）。
 *  5. 叙事一致性：approved 状态、长文本无无意精确重复、循环 storylet 必须 once 或回到
 *     choices-only hub、梗词预算不过量（防人工测试指出的重复段落/生硬梗回归）。
 *
 * 红线：本脚本只读 src/app/narrationScenes 纯数据 + manifest + 静态文本扫描；不引重依赖，
 * 仅 Node 标准库（node:crypto / node:fs）+ 项目既有 tsx。
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NARRATION_SCENES } from '../src/app/narrationScenes';
import { ENDING_IDS, type EndingId, type NarrationScene } from '../src/app/narrationTypes';

const here = typeof __dirname !== 'undefined' ? __dirname : resolve(fileURLToPath(import.meta.url), '..');
const repoRoot = resolve(here, '..');

interface CheckResult {
  readonly ok: boolean;
  readonly messages: readonly string[];
  readonly report?: string;
}

function fail(messages: readonly string[]): CheckResult {
  return { ok: false, messages };
}

function pass(messages: readonly string[] = [], report?: string): CheckResult {
  return { ok: true, messages, report };
}

// ── 检查 1：结局可达性（BFS 建图） ────────────────────────────────────────────

function checkReachability(): CheckResult {
  const messages: string[] = [];
  if (NARRATION_SCENES.length === 0) {
    messages.push('NARRATION_SCENES 为空：Wave 3 必须填充四幕场景。');
    return fail(messages);
  }

  const ids = new Set<string>(NARRATION_SCENES.map(s => s.id));
  const byId = new Map<string, NarrationScene>(NARRATION_SCENES.map(s => [s.id, s]));
  const startId = NARRATION_SCENES[0]!.id;

  // 收集 dangling goto（指向不存在的 scene id）。
  for (const scene of NARRATION_SCENES) {
    for (const choice of scene.choices ?? []) {
      if (choice.goto && !ids.has(choice.goto)) {
        messages.push(`dangling goto：scene ${scene.id} choice ${choice.id} → 不存在的 scene ${choice.goto}`);
      }
    }
  }

  // BFS 从开场 scene 出发，沿 choice.goto 走遍全图。
  const visited = new Set<string>();
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const scene = byId.get(id);
    if (!scene) continue;
    for (const choice of scene.choices ?? []) {
      if (choice.goto && ids.has(choice.goto) && !visited.has(choice.goto)) {
        queue.push(choice.goto);
      }
    }
  }

  // 孤儿 scene：表中存在但从开场不可达。
  for (const scene of NARRATION_SCENES) {
    if (!visited.has(scene.id)) {
      messages.push(`孤儿 scene：${scene.id} 从开场 ${startId} 不可达`);
    }
  }

  // 收集可达终点（结局）：沿 BFS 访问过的 scene，汇总 scene.ends + choice.ends。
  const reachableEndings = new Set<EndingId>();
  for (const id of visited) {
    const scene = byId.get(id);
    if (!scene) continue;
    if (scene.ends) reachableEndings.add(scene.ends);
    for (const choice of scene.choices ?? []) {
      if (choice.ends) reachableEndings.add(choice.ends);
    }
  }

  // 8 个 EndingId 全可达。
  const missing = ENDING_IDS.filter(e => !reachableEndings.has(e));
  for (const ending of missing) {
    messages.push(`结局不可达：${ending} 在图中无路径到达（docs/22 §7 八结局必须全可达）`);
  }

  // 死锁检测：每个可达 scene 必须存在到「结局终点」的路径。终点 = scene.ends 存在 / 任一
  // choice.ends 存在 / 无 choices（叶节点，运行时由 judgeEnding/scene.ends 收束）。反向闭包
  // 求能到达终点的 scene 集合，可达 scene 不在该集合即死锁（成环无出口）。
  const isTerminal = (scene: NarrationScene): boolean => {
    if (scene.ends) return true;
    if ((scene.choices ?? []).length === 0) return true; // 叶节点
    return (scene.choices ?? []).some(c => c.ends !== undefined);
  };
  const canEnd = new Set<string>();
  // 不动点迭代：终态 scene 入集；若 scene 任一 goto 指向 canEnd 中的 scene，则该 scene 也入集。
  let changed = true;
  for (const scene of NARRATION_SCENES) {
    if (isTerminal(scene)) canEnd.add(scene.id);
  }
  while (changed) {
    changed = false;
    for (const scene of NARRATION_SCENES) {
      if (canEnd.has(scene.id)) continue;
      const exits = (scene.choices ?? []).some(c => c.goto !== undefined && ids.has(c.goto) && canEnd.has(c.goto));
      if (exits) {
        canEnd.add(scene.id);
        changed = true;
      }
    }
  }
  for (const id of visited) {
    if (!canEnd.has(id)) {
      messages.push(`死锁 scene：${id} 可达但无任何到结局的路径（goto 成环无出口）`);
    }
  }

  if (messages.length > 0) return fail(messages);
  const endingList = ENDING_IDS.map(e => `${e}:${reachableEndings.has(e) ? '✓' : '✗'}`).join('  ');
  return pass([], `结局可达 ${reachableEndings.size}/${ENDING_IDS.length}（${endingList}）；scene ${visited.size}/${NARRATION_SCENES.length} 可达；无孤儿/dangling/死锁。`);
}

// ── 检查 2：打字机文本无空键 ──────────────────────────────────────────────────

function checkTypewriterKeys(): CheckResult {
  const messages: string[] = [];
  for (const scene of NARRATION_SCENES) {
    // lines 非空，除非纯 ending scene（scene.ends 存在）。
    if (scene.lines.length === 0 && !scene.ends) {
      messages.push(`空 lines：scene ${scene.id} 既无 lines 也无 ends（打字机无内容可演）`);
    }
    for (const line of scene.lines) {
      if (!line.text || line.text.trim().length === 0) {
        messages.push(`空行文本：scene ${scene.id} 含空 text 行`);
      }
    }
    for (const choice of scene.choices ?? []) {
      if (!choice.id || choice.id.trim().length === 0) {
        messages.push(`空 choice id：scene ${scene.id} 有选项缺 id`);
      }
      if (!choice.label || choice.label.trim().length === 0) {
        messages.push(`空 choice label：scene ${scene.id} choice ${choice.id}`);
      }
      if (!choice.goto && !choice.ends) {
        messages.push(`空 choice 去向：scene ${scene.id} choice ${choice.id} 既无 goto 也无 ends（打字机空键）`);
      }
      for (const [index, line] of (choice.responseLines ?? []).entries()) {
        if (!line.text || line.text.trim().length === 0) {
          messages.push(`空回应文本：scene ${scene.id} choice ${choice.id} responseLines[${index}]`);
        }
      }
    }
  }
  if (messages.length > 0) return fail(messages);
  return pass([], `打字机文本无空键：${NARRATION_SCENES.length} scene 全检通过。`);
}

// ── 检查 3：叙事一致性（重复/循环/梗预算） ───────────────────────────────────

function normalizeNarrativeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\s，。！？；：、—…,.!?;:'"“”‘’（）()《》「」]/g, '')
    .toLowerCase();
}

function sceneDisplayTexts(scene: NarrationScene): readonly { readonly key: string; readonly text: string }[] {
  const out: { key: string; text: string }[] = scene.lines.map((line, index) => ({
    key: `${scene.id}:line:${index}`,
    text: line.text
  }));
  for (const choice of scene.choices ?? []) {
    out.push({ key: `${scene.id}:choice:${choice.id}:label`, text: choice.label });
    if (choice.response) out.push({ key: `${scene.id}:choice:${choice.id}:response`, text: choice.response });
    for (const [index, line] of (choice.responseLines ?? []).entries()) {
      out.push({ key: `${scene.id}:choice:${choice.id}:response-line:${index}`, text: line.text });
    }
  }
  if (scene.converge) out.push({ key: `${scene.id}:converge`, text: scene.converge });
  return out;
}

function checkNarrativeIntegrity(): CheckResult {
  const messages: string[] = [];
  const byId = new Map<string, NarrationScene>(NARRATION_SCENES.map(scene => [scene.id, scene]));

  for (const scene of NARRATION_SCENES) {
    if (scene.status !== 'approved') {
      messages.push(`未批准 scene：${scene.id} status=${scene.status}`);
    }
  }

  // 长文本精确重复：短口令/按钮允许复用；≥24 个归一化字符的正文必须独立书写。
  const occurrences = new Map<string, string[]>();
  for (const scene of NARRATION_SCENES) {
    for (const entry of sceneDisplayTexts(scene)) {
      const normalized = normalizeNarrativeText(entry.text);
      if (normalized.length < 24) continue;
      const keys = occurrences.get(normalized) ?? [];
      keys.push(entry.key);
      occurrences.set(normalized, keys);
    }
  }
  for (const keys of occurrences.values()) {
    if (keys.length > 1) messages.push(`长文本重复：${keys.join(' ↔ ')}`);
  }

  // 若 target 能走回 source，它就是循环入口：内容节点必须 once；导航 hub 则声明 choices-only，
  // 让回访直接列选项而不重播开场。
  const canReach = (from: string, target: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === target) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const scene = byId.get(id);
      if (!scene) continue;
      for (const choice of scene.choices ?? []) {
        if (choice.goto && !seen.has(choice.goto)) stack.push(choice.goto);
      }
    }
    return false;
  };
  for (const source of NARRATION_SCENES) {
    for (const choice of source.choices ?? []) {
      if (!choice.goto) continue;
      const target = byId.get(choice.goto);
      if (!target || !canReach(target.id, source.id)) continue;
      const safeStorylet = choice.once === true;
      const safeHub = target.revisitMode === 'choices-only';
      if (!safeStorylet && !safeHub) {
        messages.push(`可重复内容环：${source.id}.${choice.id} → ${target.id}（需 once 或 target.revisitMode='choices-only'）`);
      }
    }
  }

  // 人工测试明确指出的生硬梗建立硬预算；扫描实际展示文本，不扫描注释。
  const allText = NARRATION_SCENES.flatMap(scene => sceneDisplayTexts(scene).map(entry => entry.text)).join('\n');
  const motifBudgets: readonly { readonly phrase: string; readonly max: number }[] = [
    { phrase: '八百本小说', max: 0 },
    { phrase: '老爷爷', max: 0 },
    { phrase: '物业', max: 0 },
    { phrase: '房东', max: 0 },
    { phrase: '垃圾回收', max: 0 },
    { phrase: '电路板', max: 0 },
    { phrase: '水管', max: 0 },
    { phrase: '红伞伞', max: 1 },
    { phrase: '系统', max: 2 },
    { phrase: '勿独扛', max: 3 }
  ];
  for (const budget of motifBudgets) {
    const count = allText.split(budget.phrase).length - 1;
    if (count > budget.max) {
      messages.push(`梗词超预算：「${budget.phrase}」出现 ${count} 次，最多 ${budget.max} 次`);
    }
  }

  if (messages.length > 0) return fail(messages);
  return pass([], `叙事一致性：${NARRATION_SCENES.length} scene approved；长文本零重复；循环节点均一次性/回访直达；梗词预算通过。`);
}

// ── 检查 4：运行时无 AI/fetch（静态扫 src/app + src/render） ──────────────────

const AI_SDK_PATTERNS: readonly RegExp[] = [
  // MEDIUM8：通义千问 Qwen 的官方/社区 SDK 前缀为 @chatanywhere/openai-api、tongyi、qwen。
  // 原 'qianxing' 是误拼（与 OpenAICom Qianxing 客户端同形，但 docs/23 §0 真正要拦的是
  // 通义千问 Qwen 系）。补 qwen / tongyi / @chatanywhere，保留 qianxing 防回退。
  /(?:from|import|require)\s*\(?\s*['"](?:openai|@openai\/ai-sdk|@openai|anthropic|@anthropic-ai\/sdk|@anthropic-ai|groq|grok-sdk|@xai\/[^'"]+|qianxing|qwen|@chatanywhere\/[^'"]+|tongyi)['"]/,
  /\bnew\s+(?:OpenAI|Anthropic|Groq|Grok|Qianxing|Qwen|Tongyi)\s*\(/
];

// 命中 fetch( 且首参为字符串字面量；再判 host 是否外部。
const FETCH_LITERAL = /fetch\s*\(\s*(['"`])([^'"`]+)\1/g;

// 定位所有 fetch( 调用位置（首参任意），用于 MEDIUM9 非字面量 fetch 告警的扫描起点。
const FETCH_ANY = /\bfetch\s*\(\s*/g;

function isExternalHost(url: string): boolean {
  const match = /^https?:\/\/([^/:]+)/i.exec(url);
  if (!match) return false;
  const host = match[1]!.toLowerCase();
  // 白名单：本地 dev server。
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0' && !host.endsWith('.local');
}

/**
 * MEDIUM9：非字面量 fetch 调用告警。fetch(`${...}`) / fetch(url) / fetch('lit' + var)
 * 等首参非纯字面量时，无法静态判定 host 白名单——保守告警，让人审确认是相对路径/manifest 资源。
 * 已知白名单：纯字面量且 host 为 localhost/相对路径（FETCH_LITERAL 已处理）。
 */
function findNonLiteralFetch(content: string, rel: string): string[] {
  const out: string[] = [];
  FETCH_ANY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FETCH_ANY.exec(content)) !== null) {
    const after = content.slice(m.index + m[0].length);
    // 首字符即字符串字面量起始（' " `）→ 由 FETCH_LITERAL 处理，跳过。
    const first = after[0];
    if (first === "'" || first === '"' || first === '`') continue;
    // 取首参 token（到 , 或 )）供告警展示。
    const argEnd = after.search(/[),]/);
    const token = argEnd === -1 ? after.slice(0, 40) : after.slice(0, Math.min(argEnd, 60));
    out.push(`非字面量 fetch：${rel} 调用 fetch(${token.trim()})（docs/23 §0 运行时禁外部 API；如为相对路径/manifest 资源请改用字面量或显式白名单）`);
  }
  return out;
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(cur, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile() && /\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
  }
  return out;
}

function checkNoRuntimeFetchOrAI(): CheckResult {
  const messages: string[] = [];
  const dirs = ['src/app', 'src/render'];
  let scanned = 0;
  for (const dir of dirs) {
    const absDir = resolve(repoRoot, dir);
    for (const file of listTsFiles(absDir)) {
      scanned += 1;
      const content = readFileSync(file, 'utf8');
      const rel = relative(repoRoot, file);
      for (const pattern of AI_SDK_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(content)) {
          messages.push(`AI SDK 命中：${rel} 含外部模型引用（docs/23 §0 运行时禁调 AI）`);
        }
      }
      FETCH_LITERAL.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = FETCH_LITERAL.exec(content)) !== null) {
        const url = m[2]!;
        if (isExternalHost(url)) {
          messages.push(`外部 fetch：${rel} 调用 fetch(${url})（docs/23 §0 运行时禁外部 API）`);
        }
      }
      // MEDIUM9：非字面量 fetch（变量/模板拼接）保守告警，让人审确认非外部 API。
      for (const warning of findNonLiteralFetch(content, rel)) {
        messages.push(warning);
      }
    }
  }
  if (messages.length > 0) return fail(messages);
  return pass([], `运行时无 AI/fetch：扫描 ${dirs.join(' + ')} 共 ${scanned} 个 ts 文件，零外部 API/AI SDK。`);
}

// ── 检查 5：manifest 完整性（cg.first-person.*） ────────────────────────────────

const ASSET_STATUSES = new Set(['draft', 'generated', 'vision_passed', 'human_signed', 'published']);
const ALLOWED_LICENSES = new Set(['OFL-1.1', 'MIT', 'Apache-2.0', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'AI-Generated']);

interface ManifestSprite {
  readonly id: string;
  readonly path: string;
  readonly checksum: string;
  readonly license: string;
  readonly status: string;
  readonly ai_disclosed?: boolean;
  readonly source?: string;
}

function checkManifestIntegrity(): CheckResult {
  const messages: string[] = [];
  const manifestPath = resolve(repoRoot, 'assets/manifest.json');
  if (!existsSync(manifestPath)) {
    return fail(['assets/manifest.json 不存在']);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { sprites?: readonly ManifestSprite[] };
  const sprites = (manifest.sprites ?? []).filter(s => typeof s.id === 'string' && s.id.startsWith('cg.first-person.'));

  if (sprites.length === 0) {
    messages.push('manifest 无 cg.first-person.* 条目：Wave 1 占位 CG 缺失。');
    return fail(messages);
  }

  let draftCount = 0;
  let publishedCount = 0;
  for (const sprite of sprites) {
    const filePath = resolve(repoRoot, 'assets', sprite.path);
    if (!existsSync(filePath)) {
      messages.push(`manifest 文件缺失：${sprite.id} → assets/${sprite.path}`);
      continue;
    }
    const buf = readFileSync(filePath);
    const actual = createHash('sha256').update(buf).digest('hex');
    if (actual !== String(sprite.checksum).toLowerCase()) {
      messages.push(`checksum 不匹配：${sprite.id}（manifest=${sprite.checksum.slice(0, 12)}… 实际=${actual.slice(0, 12)}…）`);
    }
    if (sprite.ai_disclosed !== true) {
      messages.push(`ai_disclosed 未披露：${sprite.id}（docs/23 §0 必须 ai_disclosed:true）`);
    }
    if (!sprite.license || !ALLOWED_LICENSES.has(sprite.license)) {
      messages.push(`license 非法或缺失：${sprite.id} license=${String(sprite.license)}`);
    }
    if (!sprite.status || !ASSET_STATUSES.has(sprite.status)) {
      messages.push(`status 非法：${sprite.id} status=${String(sprite.status)}（合法：${[...ASSET_STATUSES].join('|')}）`);
    }
    if (sprite.status === 'draft') draftCount += 1;
    else publishedCount += 1;
  }

  if (messages.length > 0) return fail(messages);
  return pass([], `manifest cg.first-person.* 完整：${sprites.length} 条全过 checksum/ai_disclosed/license/status；draft=${draftCount}（占位，后续升 -v2 改 published）、非 draft=${publishedCount}。`);
}

// ── 主流程 ─────────────────────────────────────────────────────────────────

function main(): void {
  const checks: readonly { readonly label: string; readonly run: () => CheckResult }[] = [
    { label: '结局可达性', run: checkReachability },
    { label: '打字机无空键', run: checkTypewriterKeys },
    { label: '叙事一致性', run: checkNarrativeIntegrity },
    { label: '运行时无 AI/fetch', run: checkNoRuntimeFetchOrAI },
    { label: 'manifest 完整性', run: checkManifestIntegrity }
  ];

  const failures: string[] = [];
  console.log('— narration governance —');
  for (const check of checks) {
    const result = check.run();
    if (result.ok) {
      const report = result.report ?? '通过';
      console.log(`  [PASS] ${check.label}：${report}`);
    } else {
      console.log(`  [FAIL] ${check.label}`);
      for (const msg of result.messages) console.log(`         · ${msg}`);
      failures.push(...result.messages.map(m => `${check.label}: ${m}`));
    }
  }

  if (failures.length > 0) {
    console.error(`\nnarration governance: ${failures.length} 项失败。`);
    process.exit(1);
  }
  console.log('narration governance: 全部通过。');
}

main();
