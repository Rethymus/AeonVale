# 11 · 数据模型与 Schema（Data Model）

> 本文件定义《Aeon Vale》所有核心实体的字段表、关系图、序列化与存档策略、内容驱动规范与确定性快照机制。
> 上游：`10-technical-architecture.md`（语言=TS、浮点纪律、PRNG 流、分层）。下游：`15-content-tables.md`（具体内容数据）、`17-testing-and-automation.md`（快照测试）。
> **本文档只产出 schema 设计与字段表，不含可运行游戏实现源码。**
> 字段名英文 `camelCase`/`PascalCase`；中文叙述。类型用 TS 标注示意，仅作 schema，非实现。

---

## 0. 总则

1. **C6 数据驱动**：所有可扩展内容（灵草/丹方/奇遇/物品/天劫定义）为**静态只读数据表**（`src/content/*.json` 或 `*.ts` 数据模块）。运行时状态（实例）与定义（def）严格分离。
2. **C3 确定性**：所有数值字段的类型选择遵循 `10-technical-architecture.md` §6.4 浮点纪律——经济/药性用整数或毫点；物理坐标用浮点但 ε 比较。
3. **ID 规范**：所有 `Def` 用 `string` ID（kebab-case，如 `"spirit-grass-low"`，人类可读、跨语言稳定）。实例 ID 用 `number`（自增）或 UUID v4 字符串（仅持久化对象）。
4. **不可变 Def / 可变 Instance**：`*Def` 是只读模板；`*Instance` 是运行时实体。例：`SpiritHerbDef`（灵草定义） vs `CropInstance`（地块上的具体作物实例）。

---

## 1. 核心实体字段表

> 字段顺序：`字段名 | 类型 | 含义 | 约束/默认`
> 类型标注：`int`=整数, `fp`=浮点, `str`=字符串, `bool`, `T[]`=T 数组, `T?`=可选, `Map<K,V>`=映射。

### 1.1 `Tile`（地块）

瓦片是世界的最小空间单元。详见机制 `08-farming-system.md`。

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `id` | int | 瓦片唯一 ID | 自增 |
| `x`, `y` | int | 网格坐标 | 非负，世界范围 0..W-1 / 0..H-1 |
| `soilType` | `SoilType` | 土壤类型 enum | `LOAM`/`SAND`/`CLAY`/`SPIRIT_LOAM`（灵壤）/`ROCK`/`WATER` |
| `fertility` | int | 肥力 0..1000（毫点，10=1%） | 默认 500 |
| `qiDensity` | int | 灵气密度 0..1000（毫点） | 默认随灵脉距离衰减 |
| `conductivity` | int | 导电倍率毫点 0..2000（1000=基准 1.0；100=绝缘垫 0.1；1800=水 1.8） | 默认随 `soilType`；见 `08` §3.3 / `20` R5 |
| `moisture` | int | 湿度 0..1000 | 默认 300 |
| `cropInstanceId` | int? | 占用此瓦片的作物实例 ID | null=空地 |
| `arrayId` | int? | 此瓦片所属阵法 ID | null=无 |
| `arrayRole` | `ArrayRole?` | 在阵法中的角色 | `NODE`/`CONDUCTOR`/`INSULATOR`/`CORE` |
| `tilled` | bool | 是否翻过 | false |
| `elevation` | int | 海拔（影响雷概率） | 0..10 |
| `blockType` | `BlockType` | 障碍类型 | `NONE`/`ROCK`/`TREE`/`BUILDING`/`WATER` |

### 1.2 `CropInstance`（作物实例）

地里正在长的一棵灵草。

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `id` | int | 实例 ID | 自增 |
| `defId` | str | 引用 `SpiritHerbDef.id` | 非空 |
| `tileId` | int | 所在瓦片 | 非空 |
| `growthProgress` | int | 生长进度 0..10000（毫点，10000=成熟） | 0 |
| `health` | int | 健康 0..1000 | 1000 |
| `currentProperty` | `PropertyVector` | 当前药性向量（受土壤/季节调制） | 来自 def.baseProperty |
| `plantedTick` | int | 种下时的 tick | - |
| `matureTick` | int | 预计成熟 tick | - |
| `stage` | `CropStage` | 阶段 | `SEED`/`SPROUT`/`GROWING`/`MATURE`/`WITHERED` |
| `tempered` | bool | 是否被雷淬过（影响药性变异） | false |
| `yieldBonus` | int | 收获加成毫点 | 0 |

### 1.3 `SpiritHerbDef`（灵草定义）

声明式数据表，定义所有可种植灵草。详见 `15-content-tables.md`。

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `id` | str | 唯一 ID | kebab-case，如 `"spirit-grass-low"` |
| `displayName` | str | 中文名 | - |
| `tier` | int | 品阶 1..9 | - |
| `baseProperty` | `PropertyVector` | 基础药性（寒热温平 4 维，各 -1000..+1000） | - |
| `growthTicks` | int | 完整生长所需 tick 数 | 30 TPS 下换算天/季 |
| `conductivity` | int | 自身导电倍率毫点 0..2000 | 影响落雷权重；1000=基准 1.0 |
| `soilAffinity` | `Map<SoilType, int>` | 对各土壤的生长加成毫点 | - |
| `qiNeed` | int | 灵气需求阈值 | 不满足则生长停滞 |
| `yield` | `ItemDrop[]` | 收获产物（物品 ID + 数量） | - |
| `resistances` | `Resistances` | 承雷/抗寒/抗虫 | - |
| `mutations` | `MutationDef[]?` | 可能变异（被雷淬后） | - |
| `spiritualRoot` | `SpiritualRoot?` | 所需灵根（玩家无 → 全部禁） | null=凡草 |

### 1.4 `PropertyVector`（药性向量）—— 共享子结构

```ts
interface PropertyVector {
  cold: int;   // 寒  -1000..+1000
  hot: int;    // 热
  warm: int;   // 温
  neutral: int;// 平
}
// 内部四轴为炼丹真源；玩家面寒热投影 = hot - cold。
// 炸炉主判定用 |hot - cold|，丹方匹配与七情配伍使用完整四轴。
```

### 1.5 `PillDef`（丹药定义）

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `id` | str | - | `"lightning-ward-pill"` |
| `displayName` | str | - | "承雷丹" |
| `tier` | int | 品阶 | - |
| `effect` | `Effect[]` | 使用后效果（buff/伤害/治疗） | - |
| `toxicity` | int | 自身丹毒值 | 凡骨累积即死 |
| `stackable` | bool | 可堆叠 | true |
| `maxStack` | int | 堆叠上限 | 99 |
| `icon` | str | 图标资源 key | - |

### 1.6 `Recipe`（丹方）

详见 `06-mechanic-alchemy.md`。非线性：同材料不同火候出不同丹。

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `id` | str | - | - |
| `displayName` | str | - | "生骨丹方" |
| `inputs` | `RecipeInput[]` | 输入材料（物品 ID + 数量范围） | - |
| `idealHeatRange` | `[int, int]` | 理想火候区间（毫点 0..1000） | - |
| `idealProperty` | `PropertyVector` | 目标药性和 | - |
| `outputs` | `RecipeOutput[]` | 可能产出（按火候/药性偏移分桶） | 多个 → 涌现 |
| `difficulty` | int | 难度 1..10（影响容差） | - |
| `revealCondition` | `Condition?` | 解锁条件 | null=默认解锁 |
| `explosionThreshold` | int | 偏离此值即炸炉（毫点） | - |

### 1.7 `Furnace`（丹炉运行态）

```ts
interface Furnace {
  readonly id: int;
  slots: FurnaceSlot[];            // 槽位（4–9）
  heat: int;                       // 当前火候 0..1000（毫点）
  targetHeat: int;                 // 玩家设定目标
  fuelTicks: int;                  // 剩余燃料 tick
  currentProperty: PropertyVector; // 槽内材料和
  state: 'IDLE' | 'COOKING' | 'EXPLODING' | 'DONE';
  cookTicksElapsed: int;
  cookTicksTotal: int;             // 本方预期总时长
  recipeHints: str[];              // 当前匹配的丹方候选
}
```

### 1.8 `Inventory` / `StorageRing`（储物戒/背包）

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `slots` | `InventorySlot[]` | 槽位 | - |
| `capacity` | int | 槽数上限 | 凡人初始 16，升级后扩 |
| `sortedBy` | `SortKey?` | 排序键 | - |
| `filters` | `ItemFilter[]?` | 自动分类规则 | - |

```ts
interface InventorySlot {
  itemId: str;     // 引用 ItemDef / PillDef / SpiritHerbDef
  count: int;
  durability?: int;// 装备/工具
  metadata?: ItemMetadata; // 附魔、变异标记
}
```

### 1.9 `Player`（玩家）

```ts
interface Player {
  hp: int;                // 当前血 0..maxHp
  maxHp: int;             // 上限（凡骨初始 100）
  pillPoison: int;        // 丹毒 0..1000（满即暴毙）
  cultivation: int;       // 修为（毫点，进度推进偷天诀阶段）
  stage: TribulationStage;// 当前功法阶段 enum
  meridians: Meridian[];  // 经脉（解锁槽位、效果）
  buffs: BuffInstance[];  // 当前 buff（含劫雷淬体）
  inventoryId: str;       // 储物戒引用
  position: { x: fp; y: fp };
  facing: Direction;
  skills: Skill[];        // 已习得技能
  flags: Set<PlayerFlag>; // 解锁标记（首次炼丹/首次承雷…）
}
```

### 1.10 `TribulationDef`（天劫定义）

详见 `05-mechanic-tribulation.md`。

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `id` | str | - | `"tribulation-stage-3"` |
| `stage` | TribulationStage | 对应功法阶段 | - |
| `totalTicks` | int | 总时长 | - |
| `lightningSchedule` | `LightningSpawn[]` | 雷生成时间表（密度曲线） | - |
| `lightningPool` | `WeightedEntry<LightningDef>[]` | 雷类型权重池 | - |
| `beastSpawnSchedule` | `BeastSpawn[]?` | 妖兽生成（部分劫伴随） | - |
| `temperingReward` | int | 抗过此劫的修为奖励 | - |
| `failureDamage` | int | 失败惩罚（直接伤害） | - |

### 1.11 `Lightning`（雷实例）

```ts
interface Lightning {
  id: int;
  defId: str;             // 引用 LightningDef（雷类型：白/紫/分支）
  sourceTileId?: int;     // 云端生成位置
  targetTileId: int;      // 落点（已由 RNG 决定，确定性）
  spawnTick: int;         // 出现 tick
  strikeTick: int;        // 实际落下 tick（warn → strike 间隔）
  state: 'WARN' | 'STRIKE' | 'FADE';
  damage: int;
  conductivityPierced: int; // 穿透阵法的导电性
  branches: int;          // 分叉数（紫雷高）
}
```

### 1.12 `Array`（阵法实例）

| 字段 | 类型 | 含义 | 约束/默认 |
|------|------|------|----------|
| `id` | int | - | - |
| `defId` | str | 引用 `ArrayDef` | - |
| `tileIds` | int[] | 组成瓦片 | - |
| `coreTileId` | int | 阵眼 | - |
| `power` | int | 当前阵力（毫点） | 随时间/损伤衰减 |
| `active` | bool | 是否激活 | false |
| `cooldownTicks` | int | 冷却 | 0 |

### 1.13 `CelestialEvent`（天象事件运行态）

详见 `07-mechanic-celestial-events.md`。

```ts
interface CelestialEvent {
  id: int;
  defId: str;              // 引用 CelestialEventDef
  startTick: int;
  endTick: int;
  phase: 'INCOMING' | 'ACTIVE' | 'FADING'; // 预警 → 影响 → 余波
  effects: ActiveEffect[]; // 当前生效中的全局 modifier
  causeChainId?: str;      // 因果链 ID（追溯触发源）
  intensity: int;          // 0..1000 毫点
}
```

### 1.14 `World` / `GameState`（聚合根）

```ts
interface GameState {
  readonly version: int;          // 存档版本号
  readonly masterSeed: number;    // 主种子
  tick: int;                      // 当前逻辑步
  elapsedRealMs: int64;           // 累计真实时间（仅展示用，不参与逻辑）
  worldName: str;
  tiles: Tile[];                  // 一维数组，按 y*W+x 索引
  width: int; height: int;
  cropInstances: Map<int, CropInstance>;
  furnaces: Map<int, Furnace>;
  arrays: Map<int, Array>;
  lightnings: Lightning[];        // 活跃雷（短生命周期）
  activeBeasts: Map<int, Beast>;
  celestialEvents: CelestialEvent[];
  player: Player;
  inventories: Map<str, Inventory>;
  economy: EconomyState;          // 市场价格、汇率
  log: GameLogEntry[];            // 最近 N 条事件
  rngStreamState: RngStreamState; // 各 RNG 流当前状态（可序列化）
  flags: WorldFlags;              // 全局解锁/剧情标记
}
```

### 1.15 `SaveGame`（存档包装）

```ts
interface SaveGame {
  formatVersion: int;             // SaveFormat 版本
  gameVersion: str;               // 游戏语义版本（SemVer）
  createdAt: int64;               // ISO epoch ms
  schemaHash: str;                // 内容表指纹（用于检测 mod/版本漂移）
  state: GameState;
  // 派生态（位置插值、动画进度、粒子）不存
  derivedStateExcluded: true;
  // 缩略图（最近一帧的代表性 hash）
  thumbHash: str;
}
```

---

## 2. 实体关系（ER）

```
                    ┌──────────────┐
                    │  GameState   │ 聚合根
                    └──────┬───────┘
        ┌─────────┬────────┼────────┬────────────┬────────────┐
        ▼         ▼        ▼        ▼            ▼            ▼
   ┌────────┐ ┌──────┐ ┌────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐
   │ Player │ │ Tile │ │ Furnace│ │ Celestial│ │ Economy │ │  Log   │
   └───┬────┘ └──┬───┘ └────┬───┘ │ Event    │ └─────────┘ └────────┘
       │         │          │     └──────────┘
       │ owns    │ contains │ cooks
       ▼         ▼          ▼
  ┌──────────┐ ┌────────────┐ ┌──────────┐
  │Inventory │ │CropInstance│ │ Recipe   │ (static def)
  └────┬─────┘ └─────┬──────┘ └──────────┘
       │ items       │ def ref
       │             ▼
       │        ┌──────────────┐
       │        │ SpiritHerbDef│ (static)
       │        └──────────────┘
       │ ref
       ▼
  ┌──────────┐  ┌──────────┐  ┌──────────────┐
  │ PillDef  │  │ ItemDef  │  │TribulationDef│ (static)
  └──────────┘  └──────────┘  └──────┬───────┘
                                     │ spawns
                                     ▼
                              ┌────────────┐
                              │ Lightning  │ (runtime, transient)
                              └────────────┘

  Tile ──(mayBelongTo)──▶ Array ──(coreTile)──▶ Tile
  CelestialEvent ──(causes)──▶ Beast / Lightning / CropGrowthMod
```

**基数要点**：
- `GameState 1—* Tile`（W×H 个）
- `Tile 0..1—1 CropInstance`（空地或一作物）
- `Tile 0..*—0..1 Array`（一阵跨多瓦片）
- `Player 1—1 Inventory`
- `Furnace *—* SpiritHerbDef`（经槽位间接）
- `TribulationDef 1—* Lightning`（一次劫生成多雷）

---

## 3. 存档与序列化

### 3.1 格式选择

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **JSON（人类可读）** | 调试友好、Zod 校验、迁移简单 | 体积大、解析慢 | **主选**（首版） |
| 二进制（MessagePack / Protobuf） | 体积小、解析快 | 不可读、迁移复杂 | 仅当存档 > 5MB 或频繁存时切换 |
| SQLite | 查询强 | 过度工程 | 不选 |

**结论**：JSON 起步（参考 [Strategies for persisting data with schema changes](https://discussions.unity.com/t/strategies-for-persisting-data-that-supports-schema-changes/722041)）。`GameState` 典型大小预计 200KB–2MB（瓦片数据主导），JSON 完全可接受。后续可用 gzip 压缩（.save.gz）。

### 3.2 版本号与迁移

**三层版本**：
1. `SaveGame.formatVersion`：序列化容器格式（字段布局）。
2. `SaveGame.gameVersion`：游戏语义版本（SemVer）。
3. `GameState.schemaHash`：内容表（herb/recipe/event）指纹，检测 mod/版本漂移。

**迁移管道**（参考 [Stack Overflow: auto-migrate JSON to newest schema](https://stackoverflow.com/questions/70875281/automatically-migrate-json-data-to-newest-version-of-json-schema)）：

```ts
type Migration = (raw: unknown) => unknown;
const migrations: Map<int, Migration> = new Map([
  [1, migrate_v1_to_v2],
  [2, migrate_v2_to_v3],
  // ...
]);

function loadSave(raw): SaveGame {
  let data = raw;
  let v = raw.formatVersion;
  while (v < CURRENT_FORMAT_VERSION) {
    data = migrations.get(v)!(data);
    v++;
  }
  return SaveGameSchema.parse(data); // 最终用 Zod 校验
}
```

**迁移函数规则**：
- 纯函数、可重放、单元测试覆盖（每个 migration 一组「旧 → 新」fixture）。
- 不允许「丢字段静默」——重命名必须显式，删除字段必须留下 `deprecated_*` 标记至少一个大版本。
- Zod schema 提供 `.default()` / `.catch()` 兜底新字段（参考 [Migrating to Zod 4 Guide](https://dev.to/pockit_tools/migrating-to-zod-4-the-complete-guide-to-breaking-changes-performance-gains-and-new-features-3ll0)）。

### 3.3 防损坏

1. **原子写**：先写 `.tmp` → `fsync` → `rename` 覆盖目标。中断时 `.tmp` 残留可清理，目标文件不受损。
2. **校验和**：存档末尾附 SHA-256 of payload；加载时验证。
3. **备份轮转**：每次存档前滚动备份 `save.bak.1` … `save.bak.5`；玩家暴毙后可回滚。
4. **Schema 校验**：Zod 在 `parse` 时失败 → 拒绝加载 + 提示用备份。
5. **派生态剔除**：粒子位置、动画帧、UI 焦点等不存——重启时从核心 state 重算（参考 [Reddit: savegame version migration](https://www.reddit.com/r/gamedev/comments/1abir3m/how_do_you_implement_savegame_version_migration/) 强调"只持久化不变化结构的数据"）。

### 3.4 派生态（可重算，不存）

| 字段 | 重算来源 |
|------|----------|
| `currentProperty` of Crop | def.baseProperty × soil/season modifier |
| 阵力 `power` | def × 损伤历史（但损伤历史要存） |
| 玩家 buff 剩余 tick | 必须存（不可重算） |
| 粒子位置 | 渲染层自治 |
| 动画帧索引 | 渲染层自治 |
| 经济价格 | basePrice × 全局 modifier（modifier 要存） |

---

## 4. 数据驱动内容

### 4.1 为何是声明式数据表而非硬编码

1. **C6**：策划/AI 加新灵草/丹方不改代码。
2. **C2**：内容与逻辑解耦，sim 函数只读 def。
3. **热重载**：Vite HMR 改 JSON 立刻生效，迭代快。
4. **AI 友好**：LLM 生成 JSON 比生成机制代码安全得多（错了也只错一条数据）。
5. **可校验**：Zod schema 在 `parse` 时拦截脏数据，进 CI。

### 4.2 内容文件组织

```
src/content/
  herbs/
    base.json          # 凡草
    tier1.json         # 一阶灵草
    tier2.json
    ...
  recipes/
    foundation.json    # 基础丹方
    tribulation.json   # 备劫丹方
  pills/
  items/
  tribulations/
  celestial-events/
  arrays/
  beasts/
  index.ts             // 加载 + 校验 + 导出 ContentRegistry
```

每个 `.json` 文件是一个数组：

```json
[
  {
    "id": "spirit-grass-low",
    "displayName": "下品灵草",
    "tier": 1,
    "baseProperty": { "cold": -100, "hot": 0, "warm": 100, "neutral": 0 },
    "growthTicks": 5400,
    "conductivity": 50,
    ...
  }
]
```

### 4.3 Schema 校验

参考 [Why JSON Schema Is the Most Underrated Tool (2025)](https://peterhrynkow.com/ai/architecture/2025/02/01/schema-driven-platforms.html) + [Zod JSON Schema](https://zod.dev/json-schema)。

- 用 Zod 写每个 Def 的 schema（同时是运行时校验器）。
- `ContentRegistry.load()` 在启动时一次性 parse 全部内容，失败即拒启动 + 报错位置。
- CI 跑 `pnpm content:lint` 显式校验 + 跨引用检查（如 Recipe.inputs 引用的 herb id 必须存在）。
- 后续若需给非程序员编辑器，可用 [Charon](https://github.com/gamedevware/charon) 等可视化工具，导出 JSON。

### 4.4 ID 规范细则

- 形式：`<category>-<tier?>-<descriptiver>`，全 kebab-case。
  - `herb-1-spirit-grass`、`pill-lightning-ward`、`recipe-bone-forging`、`event-qi-tide`、`tribulation-stage-3`。
- **稳定**：发布后不可改 ID（只可改内容），否则破坏存档引用。
- **命名空间**：mod/扩展用前缀 `modname:`（如 `mymod:herb-custom`）。

### 4.5 热重载思路

- Vite dev server 监听 `src/content/**/*.json` → 改动触发 `ContentRegistry.reload()` → 通知 sim 重建受影响的 def 缓存。
- **存档兼容**：热重载不破坏存档——已生成的实例保留旧 defId 引用，新 defId 不存在时降级为 `unknown` 占位。

---

## 5. 确定性快照（C3 / 回放测试）

### 5.1 三种「快照」用途对比

| 形式 | 大小 | 用途 |
|------|------|------|
| 完整 `GameState` JSON | 100KB–2MB | 玩家存档 |
| **种子 + 输入流** (`Replay`) | < 10KB | **CI 回放 / 平衡回归** |
| `hash(canonicalSerialize(state))` | 64 字节 | 跨版本回归对比 |

### 5.2 Replay 格式

```ts
interface Replay {
  formatVersion: int;
  gameVersion: str;
  schemaHash: str;
  masterSeed: number;
  rngStreamSeeds: RngStreamSeeds; // 各子流初始种子
  inputs: InputFrame[];           // 离散化的每 tick 输入
  expectedFinalHash: str;         // canonicalSerialize 末状态哈希
  notes?: str;
}
```

**回放验证**：

```ts
function verifyReplay(replay: Replay): boolean {
  const world = createWorld({
    seed: replay.masterSeed,
    streams: replay.rngStreamSeeds,
    contentVersion: replay.schemaHash,
  });
  for (const input of replay.inputs) world.step(input);
  const actualHash = hash(world.snapshot());
  return actualHash === replay.expectedFinalHash;
}
```

**用途**：
- CI 跑全套回放，任一哈希漂移即 fail（检测「意外的非确定性」）。
- 平衡调参后跑历史回放对比经济/通关率分布（详见 `17-testing-and-automation.md`）。

### 5.3 Canonical Serialization（哈希稳定性）

**坑**：JS 对象 key 顺序不保证 → JSON.stringify 哈希不稳定。
**对策**：自写 `canonicalSerialize`：
- 递归排序 key（按字典序）。
- 浮点保留 6 位小数四舍五入。
- 数组保持原序（数组本身有序）。

```ts
function canonicalSerialize(obj: unknown): str {
  if (Array.isArray(obj)) return `[${obj.map(canonicalSerialize).join(",")}]`;
  if (typeof obj === "object" && obj !== null) {
    const keys = Object.keys(obj).sort();
    return `{${keys.map(k => `"${k}":${canonicalSerialize(obj[k])}`).join(",")}}`;
  }
  if (typeof obj === "number") return (Math.round(obj * 1e6) / 1e6).toString();
  return JSON.stringify(obj);
}
```

---

## 6. 开放问题

| # | 问题 | 倾向 |
|---|------|------|
| Q1 | `Map` vs 对象数组在序列化中的取舍 | 内部 Map，序列化为 `{id: value}` 对象 |
| Q2 | 是否需要 diff-based 增量存档（每 N tick 一份） | 首版全量，后续考虑 |
| Q3 | 内容表是否支持 mod 覆盖（同 ID 后加载覆盖） | 留接口（`loadOrder`），不实现 |
| Q4 | 跨大版本存档兼容承诺窗口 | 最近 2 个 minor，再旧则提示「不兼容」 |

---

## 参考资料

- [Strategies for persisting data that supports schema changes? (Unity Discussions)](https://discussions.unity.com/t/strategies-for-persisting-data-that-supports-schema-changes/722041)
- [How do you implement savegame version migration support? (r/gamedev)](https://www.reddit.com/r/gamedev/comments/1abir3m/how_do_you_implement_savegame_version_migration/)
- [Automatically migrate JSON data to newest version of JSON schema (Stack Overflow)](https://stackoverflow.com/questions/70875281/automatically-migrate-json-data-to-newest-version-of-json-schema)
- [Zod JSON Schema docs](https://zod.dev/json-schema)
- [Migrating to Zod 4: The Complete Guide](https://dev.to/pockit_tools/migrating-to-zod-4-the-complete-guide-to-breaking-changes-performance-gains-and-new-features-3ll0)
- [Why JSON Schema Is the Most Underrated Tool in Your Stack (2025)](https://peterhrynkow.com/ai/architecture/2025/02/01/schema-driven-platforms.html)
- [Charon — Game Development Data Modeling Tool](https://github.com/gamedevware/charon)
- [Floating-Point Determinism — Bruce Dawson](https://randomascii.wordpress.com/2013/07/16/floating-point-determinism/)
- [Cross-Platform RTS Synchronization and Floating Point Indeterminism](https://www.gamedeveloper.com/programming/cross-platform-rts-synchronization-and-floating-point-indeterminism)
- [Data-Driven Design: Leveraging Lessons from Game Development](https://dev.to/methodox/data-driven-design-leveraging-lessons-from-game-development-in-everyday-software-5512)
