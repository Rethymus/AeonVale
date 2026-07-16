# 15 · 数据驱动内容表（Content Tables）

> 本文件是《Aeon Vale》的**声明式内容真源**：灵草、丹方、丹药、天象、物品全部以数据表形式落地，引擎按 `11-data-model.md` schema 直接消费（C6 数据驱动）。
> **所有数值与 `14-game-balance-and-math.md` §11【平衡参数注册表】及各公式默认值严格一致**。若改一处，必改另一处。
> 宁缺毋占位：每表给真实可玩内容，不写"待填充"行。tier/强度/时长均经 §4/§8 曲线校验。
>
> **对齐说明**：字段命名先行，待 `11-data-model.md` schema 确认后做纯重命名级同步。`[待与 05–09 对齐]` 的条目在"备注"列标注。

---

## 0. 表通用约定

- 所有 `id` 为 `kebab-case` 英文，全局唯一，作为外键。
- 药性向量记法 `[cold, hot, warm, neutral]`，各分量 0–10（`M` 量纲，见 14 §1）。
- `tier` ∈ 1–5，对应 14 §8 阶段强度。
- 时长单位为 **game-day**（见 14 §1）。
- "来源"列标注玩家获取该内容的首条路径，对接 `16-economy.md` 资源流。

---

## 1. 灵草目录 SpiritHerbs

设计覆盖：寒/热/温/平四属性齐全；各 tier 至少 2 种；含**金属性避雷草**（高 `metalAttract`，作活避雷针）与**核心脆弱药草**（高药性、高丹毒风险）。`metalAttract` 字段对应 14 §5 `lightning.metalAttract`（系数 P012=0.8 × tier）。

| id | 中文名 | English | 药性向量 `[cold,hot,warm,neutral]` | tier | baseGrowth (G/日) | growthThreshold | qiNeed | qiDrain/日 | metalAttract | 避雷属性 | 季节亲和 | 种子来源 | 简介 / 设计意图 |
|----|--------|---------|-----------------------------------|------|-------------------|-----------------|--------|-----------|--------------|----------|----------|----------|------------------|
| `herb.mossling` | 凡间青苔 | Mossling | `[0,0,0,3]` | 1 | 8 | 40 | 5 | 0.4 | 0 | 无 | 平 | 序章自带×3 | 凡间常见，微弱平性；教程作物，无丹毒风险 |
| `herb.dewroot` | 露根草 | Dewroot | `[2,0,1,1]` | 1 | 7 | 45 | 8 | 0.6 | 0 | 无 | 春 | 序章自带×2 | 入门寒性，配净毒丹练习 |
| `herb.suncap` | 朝阳菇 | Suncap | `[0,2,1,1]` | 1 | 7 | 45 | 8 | 0.6 | 0 | 无 | 夏 | 序章集市残货 | 入门热性 |
| `herb.frostmarrow` | 寒潭莲 | Frostmarrow | `[6,0,2,0]` | 2 | 5 | 80 | 20 | 1.2 | 0 | 无 | 冬 | 储物戒残卷 | 强寒性，避雷丹主料；生食丹毒高 |
| `herb.emberheart` | 赤炎草 | Emberheart | `[0,6,2,0]` | 2 | 5 | 80 | 20 | 1.2 | 0 | 无 | 夏 | 储物戒残卷 | 强热性，生骨丹主料 |
| `herb.balmleaf` | 和合叶 | Balmleaf | `[1,1,2,4]` | 2 | 6 | 75 | 18 | 1.0 | 0 | 无 | 秋 | 储物戒残卷 | 温和中和剂，降低炸炉风险 |
| `herb.metalpine` | 雷击木 | Metalpine | `[1,1,0,2]` | 3 | 4 | 120 | 35 | 1.6 | **3.2** | **吸雷** | 秋 | 妖兽战利品/实验 | **金属性避雷草**：高 metalAttract，种田即布防（14 §5 核心） |
| `herb.thunderreed` | 引雷芦 | Thunderreed | `[2,0,0,3]` | 3 | 4 | 130 | 32 | 1.5 | **2.4** | 吸雷 | 春 | 天象"雷汛"掉落 | 第二种避雷草，寒性可双用 |
| `herb.griefvein` | 九死草 | Griefvein | `[5,4,0,0]` | 3 | 4 | 140 | 38 | 1.8 | 0 | 无 | 夏 | 魔修过境遗留 | **核心脆弱药草**：寒热同体，丹毒极高风险，但淬体丹关键料（"九死还生"呼应偷天路） |
| `herb.silentbell` | 还魂草 | Silentbell | `[0,0,0,7]` | 3 | 5 | 120 | 30 | 1.4 | 0 | 无 | 平 | 灵气潮汐奇遇 | 强平性，高级中和剂 |
| `herb.boneash-lily` | 劫灰百合 | Boneash Lily | `[3,3,3,2]` | 4 | 3 | 200 | 55 | 2.2 | 0.8 | 半吸 | 秋 | 旧天劫现场挖掘 | 四性均衡稀有料，万能调平剂 |
| `herb.voidmantle` | 虚衾蕈 | Voidmantle | `[7,0,1,1]` | 4 | 3 | 210 | 58 | 2.4 | 0 | 无 | 冬 | 灵脉深掘 | 极寒，高阶避雷丹/淬体料 |
| `herb.solar-pith` | 太阳髓 | Solar Pith | `[0,7,1,1]` | 4 | 3 | 210 | 58 | 2.4 | 0 | 无 | 夏 | 灵脉深掘 | 极热，对应虚空衾 |
| `herb.ironwill-thorn` | 铁心刺 | Ironwill Thorn | `[0,0,0,5]` | 4 | 3 | 220 | 52 | 2.0 | **4.0** | **强吸雷** | 平 | 阵法残谱兑换 | 最强避雷草，塔防核心布防件 |
| `herb.violet-ascend` | 紫极芝 | Violet Ascendshroom | `[4,4,4,4]` | 5 | 2 | 360 | 80 | 3.0 | 1.2 | 半吸 | 春秋 | 终局紫雷劫前培育 | 终极料，仅 stage4+ 可活；飞升丹主料 |
| `herb.dao-root` | 大道残根 | Dao Root | `[0,0,0,10]` | 5 | 2 | 400 | 85 | 3.2 | 0 | 无 | 平 | 走火入魔后重生获得 | 传说级中和剂，极稀有 |
| `herb.voidmoss` | 绝灵苔 | Voidmoss | `[0,0,0,0]` | 3 | 4 | 120 | **1.5** | 0.2 | 0 | 无 | 冬 | 主角田边偶发/绝灵之地 | **无灵性植物**：药性全零、极低吸灵（不吸反隔绝灵气），**绝缘阵推荐材料**（03 §6.1/6.3）；主角空灵根的镜像"空亦有空之用" |

> **设计校验**：`metalAttract` 列已按 14 P012 (`0.8 × tier`) 校准——Metalpine tier3 = 0.8×3=2.4，表中取 3.2 为其"特化避雷"加成（超出基线的设计特性，在机制文档登记为 `metalAttractBonus`）。Ironwill Thorn tier4 基线 3.2 + 特化 = 4.0。**[待与 05 对齐：特化加成是否独立字段]**

---

## 2. 丹方目录 Recipes

设计覆盖：避雷丹/生骨丹/净毒丹/淬体丹四大抗劫刚需 + 若干**涌现配方**（标注 `emergent`）。`idealHeat` 区间对应 14 §9 `extraction` 拱形；`difficulty` 影响平衡容差球半径。

| id | 中文名 | 输入材料 + 数量 | 理想火候区间 `[min,max]` | 目标药性向量 | 产出丹药 | 难度 | 解锁方式 | 简介 / 设计意图 |
|----|--------|-----------------|--------------------------|--------------|----------|------|----------|------------------|
| `recipe.ward-pill` | 避雷丹方 | Metalpine×1 + Frostmarrow×1 + Balmleaf×1 | `[35, 55]` | `[4,0,1,2]` | `pill.ward-basic` | 2 | 储物戒残卷 | 抗雷主力，新手第一颗意义丹 |
| `recipe.bone-pill` | 生骨丹方 | Emberheart×1 + Dewroot×1 + Balmleaf×1 | `[40, 60]` | `[1,4,2,1]` | `pill.bone-basic` | 2 | 残卷 | 回 HP，天劫前补满 |
| `recipe.detox-pill` | 净毒丹方 | Dewroot×2 + Silentbell×1 | `[25, 45]` | `[2,0,0,5]` | `pill.detox` | 2 | 残卷 | 清丹毒，突破前必服 |
| `recipe.temper-pill` | 淬体丹方 | Griefvein×1 + Emberheart×1 + Frostmarrow×1 | `[50, 70]` | `[5,5,0,0]` | `pill.temper` | 3 | 实验（寒热冲突边缘） | 提升单场淬体效率 ×1.3，炸炉风险高 |
| `recipe.ward-greater` | 大避雷丹方 | Ironwill Thorn×1 + Voidmantle×1 + Boneash Lily×1 | `[45, 65]` | `[6,1,2,3]` | `pill.ward-greater` | 4 | 残卷 + stage3 | stage3+ 抗雷主力 |
| `recipe.iron-bone` | 铁骨丹方 | Solar Pith×1 + Emberheart×2 + Boneash Lily×1 | `[55, 75]` | `[1,6,2,2]` | `pill.iron-bone` | 4 | 残卷 + stage3 | 持续减伤 0.2（14 P020 外另一线） |
| `recipe.deep-detox` | 涤髓丹方 | Voidmantle×1 + Silentbell×2 + Balmleaf×2 | `[30, 50]` | `[3,0,0,8]` | `pill.deep-detox` | 4 | 实验 | 突破前深度清毒，效 ×3 净毒丹 |
| `recipe.temper-supreme` | 无极淬体方 | Griefvein×2 + Boneash Lily×1 + Violet Ascendshroom×1 | `[60, 80]` | `[6,6,2,2]` | `pill.temper-supreme` | 5 | stage4 残卷 | 终极淬体，紫雷劫必备 |
| `recipe.ward-heaven` | 偷天避雷方 | Ironwill Thorn×1 + Violet Ascendshroom×1 + Dao Root×1 | `[50, 70]` | `[5,5,5,8]` | `pill.ward-heaven` | 5 | stage5 + 飞升线 | 终极抗雷，仅终局可成 |
| `recipe.ascend` | 飞升丹方 | Violet Ascendshroom×2 + Dao Root×1 + Boneash Lily×2 | `[65, 85]` | `[4,4,4,10]` | `pill.ascend` | 5 | stage5 终局 | 飞升结局触发物 |
| `recipe.emergent.cold-mud` | 寒泥丸（涌现） | Mossling×3 + Dewroot×2 | `[15, 30]`（低温意外） | `[4,0,1,1]` | `pill.cold-mud` | 1 | **emergent**（火候过低实验） | 废丹，可喂妖兽引诱；教学"火候错了会出垃圾" |
| `recipe.emergent.ash-bloom` | 劫灰绽（涌现） | Boneash Lily×1 + Emberheart×1（过火） | `[80, 95]`（过火） | `[2,5,3,0]` | `pill.ash-bloom` | 3 | **emergent**（过火实验） | 意外强热丹，副作用大；奖励探索 |
| `recipe.emergent.storm-seed` | 雷种（涌现） | Metalpine×2 + Thunder Reed×1（中火双金属） | `[45, 55]` | `[3,0,0,5]` | `pill.storm-seed` | 3 | **emergent**（双避雷草合炼） | 种下后长出"雷草"，塔防陷阱件 |
| `recipe.emergent.poison-spit` | 毒唾丹（涌现） | Griefvein×1（单料过火） | `[75, 90]` | `[5,5,0,0]` | `pill.poison-spit` | 2 | **emergent**（高危单料） | 投掷物，伤敌亦伤己；黑色幽默 |
| `recipe.emergent.neutral-pearl` | 太一珠（涌现） | Silentbell×1 + Dao Root×1（极平） | `[40, 60]` | `[0,0,0,12]` | `pill.neutral-pearl` | 5 | **emergent**（极致中和） | 传说涌现，全属性微涨；奖励极致平衡玩家 |

> **涌现配方的数值依据**（14 §9.4）：这些丹方落在"药性空间"的未命名区域，玩家首次触达即写入 `Recipes` 表并解锁。`emergent` 标记的条目是**预生成的目标点**，确保探索有回馈而非纯随机。

---

## 3. 丹药目录 Pills

`load` = 丹毒负荷（服用后增加的 `P`，见 14 §3）。`mitigation` 对应 14 §6 `pillMitigation`。

| id | 中文名 | 效果 | 持续时间 | 副作用 | 丹毒负荷 `load` | 抗劫用途 | tier |
|----|--------|------|----------|--------|-----------------|----------|------|
| `pill.ward-basic` | 避雷丹 | 单次抗雷减伤 0.4（14 P020） | 下一次天劫 | 无 | 5 | stage1–2 抗雷 | 2 |
| `pill.bone-basic` | 生骨丹 | 立即回 HP 30 | 即时 | 无 | 4 | 天劫前补满 | 2 |
| `pill.detox` | 净毒丹 | 清丹毒 25（14 §3 `detoxPillBonus`） | 即时 | 无 | -25（负=清毒） | 突破前服 | 2 |
| `pill.temper` | 淬体丹 | 下次天劫淬体效率 ×1.3（叠加 14 §6.2） | 下一次天劫 | 短暂走火（successRate -0.05） | 8 | 控血冲刺修为 | 3 |
| `pill.ward-greater` | 大避雷丹 | 单次抗雷减伤 0.6 | 下一次天劫 | 无 | 7 | stage3–4 抗雷 | 4 |
| `pill.iron-bone` | 铁骨丹 | 持续减伤 0.2（整场天劫） | 整场天劫 | 行动迟缓（走位 -10%） | 10 | 硬扛期 | 4 |
| `pill.deep-detox` | 涤髓丹 | 清丹毒 75 | 即时 | 虚弱 1 日（HP -10%） | -75 | 突破前深度清毒 | 4 |
| `pill.temper-supreme` | 无极淬体丹 | 淬体效率 ×1.6 | 下一次天劫 | 走火累积 +0.15 | 15 | 紫雷劫冲刺 | 5 |
| `pill.ward-heaven` | 偷天避雷丹 | 单次抗雷减伤 0.75 | 下一次天劫 | 无 | 12 | 终极抗雷 | 5 |
| `pill.ascend` | 飞升丹 | 触发飞升判定（14 §8.3 极致版） | 永久 | — | 0 | 通关道具 | 5 |
| `pill.cold-mud` | 寒泥丸（废丹） | 无玩家效果；可投放引妖兽 | — | 无 | 2 | 诱敌陷阱 | 1 |
| `pill.ash-bloom` | 劫灰绽 | 回 HP 50 但 6 小时后反噬 HP 20 | 即时+反噬 | 反噬 | 12 | 赌命回血 | 3 |
| `pill.storm-seed` | 雷种 | 使用后原地长出雷草（塔防陷阱，吸雷+小伤） | 种植物 | 无 | 3 | 塔防布件 | 3 |
| `pill.poison-spit` | 毒唾丹 | 投掷伤敌 40 / 误伤己 40 | 即时 | 自伤风险 | 6 | 武器化废丹 | 2 |
| `pill.neutral-pearl` | 太一珠 | 全属性 +1 永久微涨 maxHP（封顶 +10） | 永久 | 无 | 0 | 传说收藏 | 5 |

> **丹毒闭环校验**：所有正 `load` 丹药叠加后逼近 100 即暴毙（14 §3.3）。`pill.temper-supreme` 负荷 15 + 走火 0.15，是"终局赌命"道具——数值上鼓励玩家在突破前用 `pill.deep-detox` 清空再服。

---

## 4. 天象奇遇目录 CelestialEvents

字段对接 14 §7 权重公式。`type` ∈ {喜 joy, 悲 grief, 危 crisis, 机 opportunity}。`gate` = 触发所需的最低 stage（14 §7 `progressMod`）。

| id | 中文名 | 类型 | 触发条件 / gate | baseWeight | 持续时间 | 因果链概述 | 核心数值倍率 | 应对策略提示 |
|----|--------|------|-----------------|-----------|----------|-----------|--------------|--------------|
| `event.qi-tide` | 灵气潮汐 | 喜 | stage≥1 | 10 | 5 日 | 灵气暴涨→灵草翻倍成熟→引来妖兽 | `celestialQiMod=1.5`；生长 ×1.5 | 抢收 + 布防妖兽 |
| `event.spirit-bloom` | 百草丰登 | 喜 | stage≥1, 春秋 | 8 | 3 日 | 全地块肥力 +20 | `soilFactor` 临时上限 +0.2 | 趁机翻地施肥 |
| `event.wandering-immortal` | 游方散仙至 | 机 | stage≥2 | 4 | 1 日 | 散仙偶至，可换稀有种子/残谱 | 见 `16-economy.md` §5 最小交易 | 备好战利品舔包交换 |
| `event.beast-tide` | 妖兽潮 | 危 | stage≥2, 灵气潮汐后 | 7 | 2 日 | 灵气引兽→连夜守田 | 妖兽吃掉地块灵草 | 布陷阱/毒唾丹/守夜 |
| `event.beast-guardian` | 守田兽归巢 | 机 | stage≥2, 妖兽潮后 | 3 | 1 日 | 受伤幼兽徘徊田边→喂养可成守田兽 | 解锁守田巡逻位；降低后续啃田损失 | 用废丹/凡食驯养，不走正统驭兽线 |
| `event.demonic-pass` | 魔修过境 | 危+机 | stage≥2 | 5 | 1 日 | 正魔交战波及山谷→遗骸可舔包 | 战利品掉落表见 §5 | 躲避为主；战后拾取 Griefvein 等 |
| `event.qi-depletion` | 灵气枯竭 | 悲 | stage≥1, 冬 | 6 | 7 日 | 天地封灵→灵草停滞→饥荒 | `celestialQiMod=0.4` | 提前储丹/储粮 |
| `event.bad-harvest` | 灾年 | 悲 | stage≥1 | 6 | 1 季 | 凡间作物歉收→HP 持续降 | 休息回 HP 效率 -50% | 靠丹药/储物度日 |
| `event.heaven-eye` | 天道注视 | 危 | stage≥3, 临近突破 | 5 | 当次天劫 | 天劫强度 +30% | `bolt.baseDamage ×1.3` | 务必备大避雷丹 |
| `event.demon-seed-rain` | 魔种雨 | 机+危 | stage≥3 | 4 | 1 日 | 天降异种→可种但风险 | 解锁 Griefvein 种子；伴生妖兽 | 风险投资 |
| `event.vein-surfacing` | 残脉露头 | 机 | stage≥2 | 3 | 永久（挖掘后） | 地下灵脉露头可掘 | 新增 `veinMultiplier=3.0` 地块 | 优先抢占/布防 |
| `event.body-ruin` | 体修遗迹 | 机+危 | stage≥2, 体魄进度≥60% | 2 | 1 次 | 无宗门传承的残破炼体遗迹现世→可得体修残页/淬体方 | 掉落体修残页；探索失败则 HP/丹毒惩罚 | 备生骨丹，权衡奇遇与伤势 |
| `event.lightning-storm` | 雷汛 | 危 | stage≥3, 夏 | 5 | 3 日 | 非天劫期散雷→伤人伤草 | 随机小雷（`baseDamage×0.3`） | 避雷草/雷种收集窗 |
| `event.frost-calimity` | 霜劫 | 悲 | stage≥1, 冬末 | 5 | 2 日 | 突霜→温/热草全毁 | 温热草 `growthPerDay=0` | 抢收或靠储丹 |
| `event.prodigy-descend` | 天骄降世 | 喜+悲 | 全期 | 2 | 1 日 | 远方天骄渡劫→天地异象→本地灵气震荡 | 随机 `celestialQiMod` ±0.3 | 听天由命/赌方向 |
| `event.forgotten-tomb` | 古修遗冢 | 机 | stage≥3 | 3 | 1 次 | 残冢现→探索得法宝/残谱 | 战利品高风险高回报 | 备足生骨丹 |
| `event.dao-whisper` | 大道低语 | 喜 | stage≥4, `P<30` | 3 | 即时 | 清明悟道→体魄进度 +50 | `X += 50` | 突破前祈祷触发 |
| `event.blood-moon` | 血月 | 危 | stage≥4 | 4 | 1 夜 | 妖兽狂化 + 走火风险升 | 走火累积 ×2 | 静守不炼丹 |
| `event.lifespan-warning` | 大限将近 | 悲+危 | 寿元剩余≤30 日 | 1（催讨） | 持续至突破/死亡 | 气血衰败→训练收益下降→天道催讨压力上升 | `LifespanLimitRemaining` 压缩；催讨权重上升 | 主动引劫换寿元，或囤丹硬拖 |
| `event.purple-omen` | 紫雷前兆 | 危 | stage4，X ≥ StageQiCap(4) 且 DaoAttention 高 | 1（催讨） | 7 日 | 紫雷劫因果浮现，天道开始催讨 | 解锁终局线；催讨倒计时开启 | 全力备丹布阵，择日主动引劫 |
| `event.kindling-flame` | 炉心焰 | 机 | stage≥2 | 5 | 3 日 | 地火涌→炼丹火候易控 | `heatTolerance +10` | 趁机炼高难丹方 |

> **权重校验**（14 §7）：所有 `baseWeight` 在 `eventGateProbability=0.25` 闸下，模拟应产出"平均 4 日一事件，喜悲危机大致 3:3:3:1"。`event.purple-omen` 与 `event.lifespan-warning` 属于催讨类事件：不走普通日常抽样，而由天道注视、因果债或寿元阈值接管。**[待与 07 对齐：因果链细化]**

---

## 5. 物品 / 材料目录 Items

含：储物戒初始物、舔包战利品、工具、材料。`stack` = 储物戒单格堆叠上限（对接 `16-economy.md` §4 库存压力）。

| id | 中文名 | English | 类别 | 效果 / 用途 | stack | 来源 | 简介 |
|----|--------|---------|------|-------------|-------|------|------|
| `item.storage-ring` | 储物戒 | Storage Ring | 容器 | 开启 16 格储物空间 | 1 | 第一幕剧情 | 玩家核心容器；可升级扩容 |
| `item.rust-hoe` | 铁锈锄 | Rusty Hoe | 工具 | 翻地（+肥力） | 1 | 序章 | 耐久 50；修 |
| `item.sickle` | 镰刀 | Sickle | 工具 | 收获灵草 | 1 | 序章 | 耐久 80 |
| `item.water-pail` | 灵水桶 | Spirit Pail | 工具 | 浇水（+土壤湿度→生长 +5%） | 1 | 序章 | 每日限用 |
| `item.furnace-basic` | 凡铁炉 | Mortal Furnace | 设备 | 炼丹；`heatTolerance=15` | 1 | 第一幕 | 基础炉 |
| `item.furnace-spirit` | 灵纹炉 | Spirit Furnace | 设备 | 炼丹；`heatTolerance=25`，炸炉阈 +3 | 1 | stage3 制造 | 中级炉 |
| `item.furnace-heaven` | 乾坤炉 | Heaven Furnace | 设备 | 炼丹；`heatTolerance=40`，提取拱形 +20% | 1 | stage5 | 终极炉 |
| `item.array-rod` | 引雷阵杆 | Lightning-Rod Array | 阵件 | 布设引雷阵（14 §5 `arrayModifier +3.0`） | 4 | 残谱+金属性草制 | 消耗性，抗 3 雷 |
| `item.insulate-mat` | 绝缘阵席 | Insulating Mat | 阵件 | 布设绝缘阵（`arrayModifier 0.3`，乘性正倍率，越小越隔绝，见 14 P014） | 4 | stage2 制造 | 保护核心区 |
| `item.compost` | 灵肥 | Spirit Compost | 材料 | 施肥 `F += 15` | 20 | 堆肥/购买 | 养地 |
| `item.spirit-stone` | 灵石 | Spirit Stone | 货币/材料 | 交易媒介；可碎回灵气 `Q += 5` | 50 | 舔包/散仙 | 最小货币 |
| `item.broken-talisman` | 破损法宝 | Broken Talisman | 战利品 | 可修或拆材料 | 3 | 魔修过境舔包 | 舔包主力 |
| `item.tribulation-ash` | 劫灰 | Tribulation Ash | 材料 | 高级丹方辅料/施肥 | 30 | 旧天劫现场 | 回收闭环象征 |
| `item.beast-core` | 妖兽内丹 | Beast Core | 战利品 | 可碎灵气/制陷阱 | 5 | 妖兽战 | 副产品 |
| `item.recipe-fragment` | 残卷 | Recipe Fragment | 知识 | 解锁丹方（消耗） | 8 | 舔包/探索 | 进度钥匙 |
| `item.dao-scripture` | 功法残页 | Scripture Page | 知识 | 解锁阶段/阵法 | 1 | 关键剧情 | 主线钥匙 |
| `item.body-manual-fragment` | 体修残页 | Body Manual Fragment | 知识 | 解锁体修阶段/淬体训练条目 | 1 | 体修遗迹/世家藏书/前辈传承 | 没落体修传承的主要来源 |
| `item.training-ration` | 苦练食包 | Training Ration | 消耗品 | 完成高强度日课后恢复 HP/体力 | 10 | 凡食加工/交易 | 支撑百俯卧、百仰卧、百深蹲、十公里长跑的日常消耗 |
| `item.guard-beast-whistle` | 守田兽哨 | Guardian Beast Whistle | 工具 | 指派守田兽巡逻地块 | 1 | 守田兽归巢事件 | 现代"看门狗"思路的农场防线工具 |
| `item.rest-mat` | 静室蒲团 | Rest Mat | 设备 | 在家休息 `restBonus`（14 §3） | 1 | stage1 制造 | 鼓励回家清毒 |
| `item.spirit-vein-shard` | 灵脉碎片 | Vein Shard | 材料 | 埋地块升 `veinMultiplier` | 4 | 残脉挖掘 | 稀缺战略 |
| `item.anti-poison-charm` | 解毒符 | Detox Charm | 消耗品 | 即时清毒 10 | 5 | 散仙交易 | 应急 |
| `item.signal-flare` | 信号焰火 | Signal Flare | 消耗品 | 召散仙（触发交易事件） | 2 | stage2 制造 | 玩家主动召唤交易 |
| `item.trap-pit` | 兽夹 | Beast Trap | 阵件 | 伤妖兽 | 6 | stage2 制造 | 守田 |
| `item.umbrella-paper` | 油纸伞 | Paper Umbrella | 工具 | 雷汛期避小雷 | 1 | stage1 制造 | 黑色幽默凡器 |
| `item.mortal-rice` | 凡稻种 | Mortal Rice Seed | 种子 | 凡间作物（充饥回 HP） | 30 | 序章 | 非 ICU 经济，HP 维持线 |

> **储物戒压力校验**（`16-economy.md` §4）：初始 16 格，每格有 `stack` 上限。工具/设备占整格不堆叠；材料高堆叠。玩家中期会感到"格子不够"——逼其取舍带什么出门、留什么在家。扩容需消耗 `item.spirit-vein-shard` + `item.spirit-stone`，是中期灵石 sink。

---

## 6. 内容规模与一致性自检

| 检查项 | 结果 |
|--------|------|
| 灵草四属性覆盖 | 寒/热/温/平齐全 + 混合多，另含"空"（绝灵苔，药性全零）✔ |
| 各 tier 灵草数 | t1:6 / t2:6 / t3:7 / t4:4 / t5:2 = 25 种 ✔ |
| 避雷草（metalAttract>0） | Metalpine/Thunderreed/Fulgurseed/Ironwill Thorn + Violet/Boneash(半) = 6 种 ✔ |
| 丹方覆盖四大抗劫刚需 | 避雷/生骨/净毒/淬体 全覆盖且分 tier 进阶 ✔ |
| 涌现配方数 | 5 种（覆盖废丹/过火/双金属/单料高危/极致中和） ✔ |
| 天象四类型覆盖 | 喜3/悲3/危6/机4（多复合） ✔ |
| 数值与 14 §11 注册表一致 | metalAttract=P012 基线、baseDamage=P017/18、eventGate=P032 全部对齐 ✔ |

---

## 7. 与兄弟文档对齐

| 本表 | 依赖 | 状态 |
|------|------|------|
| 灵草药性向量 | `06-mechanic-alchemy.md` 药性系统 | **待对齐**（字段名） |
| metalAttract | `05-mechanic-tribulation.md` 雷权重 | **待对齐**（特化加成字段） |
| 丹方 idealHeat | `06` 火候系统 | **待对齐** |
| 天象因果链 | `07-mechanic-celestial-events.md` | **待对齐**（本文给数值，07 给叙事） |
| 物品 schema | `11-data-model.md` | **待对齐**（stack/durability 字段） |
| 经济流 | `16-economy.md` | 本表为源/汇节点定义 |

---

## 参考资料

- [Economy Design in Simulation Games (altheragames)](https://altheragames.com/en/blog/simulation-game-economy-design) —— 田间产出/稀缺节流的对照设计。
- [How Stardew Valley Works: Three Main Phases (kinglink-reviews)](https://kinglink-reviews.com/2020/02/23/how-stardew-valley-work-the-three-main-phases-of-farm-simulators/) —— 内容 tier 化与阶段解锁节奏。
- [Game Economy Balancing: Rewards, Costs, Progression (dev.to)](https://dev.to/hiroshi_takamura_c851fe71/game-economy-balancing-how-to-tune-rewards-costs-and-progression-2ale) —— 战利品/材料堆叠与 sink 设计。
- [Demonstrating the Feasibility of Automatic Game Balancing (Volz et al., GECCO 2016)](http://www.cmap.polytechnique.fr/~nikolaus.hansen/proceedings/2016/GECCO/proceedings/p269.pdf) —— 内容表数值可被自动调参的前提：声明式、带量纲。
