# 29 · Apple 动效与材质细节研究（操作手感向）

> 范围声明：只研究**交互与动效的实现细节**——弹簧/阻尼参数、按压反馈、滚动物理、
> 毛玻璃材质机制、转场范式、"丝滑"的工程面。**不含配色与视觉风格。**
> 本文档服务于 AeonVale 界面打磨：§9 给出逐界面映射与可直接采用的参数。

## 0. 证据分级

- **[A] Apple 公开 API 常量**：UIKit/SwiftUI 公开签名与默认值，稳定可考。
- **[B] WWDC 讲席与 HIG 原则**：原则性表述（无逐字参数处注明）。
- **[C] 社区测量/转录**：凭稳定社区共识给出，未经官方逐字核实处显式标注。
- **[W] Web 规范实证**：本轮 WebFetch 实读的 MDN/web.dev 条目（本轮已 fetch：
  MDN `backdrop-filter`、MDN `overscroll-behavior`、web.dev backdrop-filter）。

---

## 1. "丝滑"的第一性原理（WWDC18-803《Designing Fluid Interfaces》[B]）

Apple 手感的五条根原则——每条都是**细节纪律**而非风格：

1. **零延迟反馈**：视觉响应从 `pointerdown` 那一帧开始，而非 `click`/松手。
   手指接触的一瞬控件已有按压态；拖动的一瞬物体已在手下移动。
2. **100% 可中断**：任何动画进行中都可被新输入接管，用户永远不需要"等动画放完"。
   UIKit 的 `UIViewPropertyAnimator`、SwiftUI 的隐式动画都为此设计。
3. **速度交接（retargeting）**：中断时把**当前瞬时速度**作为新目标动画的初速度
   （UISpringTimingParameters 的 initialVelocity），能量不丢、不跳变。
   这是"物理感"与"播放感"的分水岭。
4. **空间连续性**：元素状态变化尽量发生在**同一实体**上（菜单从按钮"长出"、
   面板从边缘滑入），少用无因果的出现/消失。
5. **动画不阻塞输入**：hit-testing 在动画期间保持有效；等待即失败。

## 2. 弹簧参数体系——阻尼感的数学 [A/C]

### 2.1 三种等价参数化

| API | 参数 | 语义 |
|---|---|---|
| `UISpringTimingParameters` | `dampingRatio ζ`, `duration` | ζ=阻尼比；duration=感知时长 |
| SwiftUI `spring(response:dampingFraction:blendDuration:)` | `response T`, `dampingFraction ζ` | T≈"弹一下"的节奏长度（秒） |
| `CASpringAnimation` | `mass m`, `stiffness k`, `damping c` | 物理原件；ω=√(k/m)，ζ=c/(2√(km)) |

换算：`T ≈ 2π/ω`（无阻尼固有周期）；给定 ζ 与 T 可反解 k=（2π/T)²·m、c=2ζ√(km)。

### 2.2 实用数值表

| 场景 | 参数 | 级别 |
|---|---|---|
| SwiftUI 默认 `.spring()` | ζ≈0.825（一丝过冲） | [C] |
| `.interactiveSpring()` | T=0.15、m=0.15（跟手专用，高刚） | [A]（预设存在）/数值[C] |
| sheet/浮层呈现 | ζ=1.0（无过冲）、~0.45-0.5s | [C] |
| 控件按压回弹 | T≈0.12-0.18、ζ≈0.9-1.0（硬而不荡） | [C] |
| 大位移转场 | ζ≈0.8-0.9（过冲=物理存在感） | [C] |
| 拖放吸附对位 | ζ=1.0（精密，绝不 overshoot） | [C] |
| WWDC23 预设 `.smooth/.snappy/.bouncy` | bounce≈0/0.15/0.3、时长≈0.3s 量级 | [C]（转录，未逐字核实） |

### 2.3 阻尼感设计准则（本研究的核心结论）

阻尼感 = **三件套**，缺一即"廉价感"：

1. **ζ 定性格**：0.6-0.7 活泼游戏化；0.8-0.85 iOS 默认手感；1.0 严肃工具。
   同一产品内 ζ 家族要一致（全局 2-3 档封顶）。
2. **时长定分量**：微交互 0.15-0.25s；浮层 0.3-0.4s；全屏 0.35-0.5s。
   <0.1s 看不清，>0.6s 有阻塞感。
3. **初速度继承定"尊重输入"**：从手势接管的动画必须带 v₀；
   播放型动画（无输入来源）才可从 0 速起。

**退场永远比进场快**（出现 0.3s → 消失 0.2s）：离开不该拖用户时间。[C]

## 3. 按压/操作反馈细节 [B/C]

- **按下**：当帧 `scale 0.96-0.98` + 高光变化（同帧，无过渡或 ≤0.08s linear）；
  **松手**：弹簧回 1.0（T≈0.15，ζ≈0.85-0.9，允许一丝过冲）。
- 系统控件高亮是"变暗/变亮"而非描边——描边改变布局感知重量。
- **峰值对齐**：动效最亮/最满的一帧 = 状态真正生效帧（web 无触觉时以此补偿
  iOS 的 haptic-motion 耦合：impact 震动与动画峰值同帧）。
- 命中区 ≥44pt；按下态可轻微放大命中感知。
- 菜单：从锚点 scale-in ≈0.1s + fade；沿调用方向展开。[C]

## 4. 滚动物理（iOS 手感的标志）[A/W]

- **decelerationRate 常量 [A]**：`normal=0.998`、`fast=0.99`——
  语义为**每毫秒保留的速度比例**，即指数衰减 `v(t)=v₀·r^t`。
  0.998/ms ≈ 每秒衰减到 0.998^1000≈13.5%——那条"长滑翔"的来源。
- **rubber-band**：越界拖动时位移经阻尼映射（常见实现：对超出量做
  每帧收敛/指数阻力——越拉越硬）；释放后以弹簧（ζ≈0.9-1.0、~0.35-0.4s）回弹。[C]
- **投影（projection）**：松手瞬间以当前速度外推最终停点，用于分页吸附判定
  ——翻页阈值看"速度外推是否过半页"，而非只看已拖位移。[B]
- **滚动归属唯一**：滚 A 时 B 绝不动（惯性锁定在单一容器）。
- **Web 等价 [W]**（MDN 实读）：
  - `overscroll-behavior: contain`——阻断滚动链但保留容器内原生回弹，并**天然
    禁用下拉刷新**；`none` 连回弹也取消。
  - **零溢出容器也生效**：`overflow:hidden` 的模态背景加 `contain` 即锁背景滚动
    （容器恒处于边界态）——模态防穿透的正规解。
  - `scroll-snap-type: proximity`（松吸附）/`mandatory`（强吸附）对应投影分页思想。

## 5. 毛玻璃/材质体系 [A/B/W]

### 5.1 Cupertino 材质（macOS/iOS 传统分级）[A]

`NSVisualEffectView`/`UIBlurEffect` 按**模糊半径 × 不透明度 × 饱和提升**三轴分级：
ultraThin / thin / regular / thick / ultraThick。经验分工 [C]：
工具栏与浮层用 thick（内容强分离、文字稳），大面积罩层用 ultraThin（保留底层色彩运动）。

### 5.2 Vibrancy [A]

标签文字走第二级渲染（比背景层更亮/更透、模糊强度不同）——**文字永远比底材
"浮"一级**，这是可读性而不是配色问题。

### 5.3 Liquid Glass（2025 · iOS 26 世代）[B]

从"平面模糊层"进化为"**折射透镜**"：内容经控件折射/透镜变形、镜面高光随设备
姿态与滚动动态移动、控件形状自适应内容、明暗环境自适应。官方描述性披露，
内部算法未公开——Web 端近期无需模拟，但其两个可迁移思想：
高光要**有来源方向**（随内容运动），材质要**回应环境**（滚动/悬停改变高光）。

### 5.4 Web 落地配方 [W]

```css
.glass {
  background: rgb(255 255 255 / 0.45);        /* 或深色 rgb(17 20 28 / 0.55) */
  backdrop-filter: blur(14px) saturate(170%); /* 模糊+饱和双轴 */
  -webkit-backdrop-filter: blur(14px) saturate(170%);
}
```

- **backdrop root 陷阱（本轮 MDN 实证，最重要的坑）**：祖先若满足
  `opacity<1` / `filter≠none` / `mask` / `clip-path` / `will-change` 等，
  即成为 **backdrop root**——子元素的 backdrop-filter **只模糊该祖先以内**的内容，
  表现为"代码对但没效果"。AeonVale 的 surface 容器普遍半透明，**玻璃层必须直接
  挂在无透明祖先的节点上**，或把模糊与半透明合并在同一元素。
- 性能：backdrop-filter 每帧重采样背后内容——**只用在静止层**（HUD/浮层/菜单），
  避免盖在持续重绘的画布上大面积使用；会新建 stacking context（层叠语义变化）。
- 不支持时的降级：`@supports not (backdrop-filter: blur(1px))` 提高背景不透明度。

## 6. 转场与导航范式 [B/C]

- **iOS push**：新旧页**视差速度差**（新页快、旧页慢约 30%）+ 手势可逆
  （拖到一半松手按投影决定进/退）。**macOS**：cross-fade ~0.2s、无位移
  ——平台分量感不同。
- sheet 从锚点/边缘生长；detent（半展开档位）用投影吸附。
- 消失比出现快（§2.3）。
- **因果性**：面板从哪来回哪去（关闭=入场的逆向，而非 fade 掉）。

## 7. "丝滑"的工程面（帧预算）[B/W]

1. **只动 `transform` 与 `opacity`**（合成器路径）；动 layout 属性=掉帧之源。
2. JS 驱动动画用 rAF + 半隐式欧拉积分（§8.2），状态在闭包/对象上，不每帧分配。
3. 按压态监听 `pointerdown` 而非 `click`（零延迟原则的 Web 形态）。
4. `prefers-reduced-motion`：位移类降级为 crossfade；反馈类（按压）保留。
5. 帧对齐：时长尽量取帧的整数倍（60Hz：0.15/0.2/0.25/0.3/0.4/0.5）。

## 8. Web/PixiJS 可直接采用的配方

### 8.1 CSS 弹簧近似曲线（代替 cubic-bezier 猜调）

| 手感 | cubic-bezier | 对应 ζ 感 |
|---|---|---|
| Apple 无过冲滑入 | `(0.32, 0.72, 0, 1)` | ζ≈1 |
| 轻过冲（iOS 默认） | `(0.34, 1.56, 0.64, 1)` | ζ≈0.8 |
| 快出缓停 | `(0.25, 0.1, 0.25, 1)` | 传统 ease |

按压反馈对（入场硬、回弹软）：

```css
.press { transition: transform 0.08s linear; }
.press:active { transform: scale(0.97); }
.press:not(:active) { transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
```

### 8.2 JS 弹簧积分器（半隐式欧拉，12 行，速度可继承）

```ts
// x/v 就地更新；dt 秒；T=响应时长，z=阻尼比，v0 允许手势速度交接
function springStep(x: number, v: number, target: number, T: number, z: number, dt: number): [number, number] {
  const omega = (2 * Math.PI) / T;          // ω
  const k = omega * omega;                  // stiffness（m=1）
  const c = 2 * z * omega;                  // damping
  const a = -k * (x - target) - c * v;      // 加速度
  v += a * dt;                              // 半隐式：先更速度
  x += v * dt;                              // 再更位移（无条件稳定）
  return [x, v];
}
// rAF 循环里对每个动画量调一次；中断=用当前 v 作为新动画初速（retargeting）
```

### 8.3 模态/浮层入场（玻璃 + 弹簧）

`opacity 0→1` + `scale 0.96→1`（transform-origin 在锚点侧）+ 背景 `backdrop-filter:
blur(14px) saturate(170%)`，时长 0.28s、曲线 `(0.32,0.72,0,1)`；退场 0.2s 反向。
注意 §5.4 backdrop root：玻璃层直接挂在 surface 根，勿嵌在半透明父层内。

### 8.4 PixiJS

棋子/面板位移用 8.2 积分器驱动 `position/scale`（ticker 内推进）；
推石成功抖动把现有线性 `shakeTtl` 衰减改为**指数衰减**（§4 的 deceleration 思想：
`shakeMag *= 0.85` 每帧）——阻尼感直接对应"每毫秒保留比例"。

---

## 9. AeonVale 映射表（优先级 + 精确参数）

> 现状依据：`rogueliteProto/surface.ts`（slot transition .16s ease、按钮仅 border hover）、
> `app.css`（面板瞬时出现；`.cr-event__choices` 已有 `overscroll-behavior:contain`）、
> 已有全局 `prefers-reduced-motion` 钩子。

### P1 手感核心（小改动大感知）

| 界面元素 | 现状 | 改法（参数） |
|---|---|---|
| 活动按钮/事件选项按下 | 仅 hover 边框 | §8.1 按压对：`scale(0.97)` 0.08s + 回弹 0.22s ζ0.85；disabled 不动 |
| 竹简槽选中 | translateY(-5px)/.16s ease | 曲线改 `(0.34,1.56,0.64,1)`（轻过冲）；按下同上 |
| 浮层（山河图/修行/行囊/暂停/图鉴） | 瞬时出现/消失 | 入场 opacity+scale 0.96→1 0.28s `(0.32,0.72,0,1)`；退场 0.2s 反向；origin 在触发侧 |
| 雷阵推石 shake | 线性 ttl 衰减 | 指数衰减 `mag*=0.85/frame`（§8.4） |
| toast | 瞬时 | 底部弹簧滑入 0.3s ζ0.8；退场 fade 0.2s |

### P2 材质与节奏

- 快捷菜单/图鉴/暂停玻璃化：§8.3（先排 backdrop root 陷阱——surface 链半透明节点多）。
- 叙录选项出现 stagger 30ms；打字机 blip 已有节奏可保留。
- 数字滚动（寿元/灵石变化）用 8.2 积分器缓动 0.3s——数值变化的可感知性。

### P3 体验一致性

- 全局统一两档 ζ 家族：交互 0.85 / 呈现 1.0（§2.3 纪律）。
- 所有新动效接入既有 `prefers-reduced-motion` 降级（位移→crossfade）。
- 浮层打开时背景滚动锁：背景层 `overscroll-behavior: contain`（零溢出容器语义，[W]）。

## 10. 结论

**阻尼感** = ζ（性格）× 时长（分量）× 初速度继承（尊重输入）。
**材质感** = 模糊+饱和+亮度的分层，且玻璃层必须避开 backdrop root。
**丝滑** = 零延迟 + 可中断 + 只动合成器属性 + 退场快于进场。
——三者全是可测参数，不是玄学；上表参数可直接进入实现。

## 附：源

- [A] Apple API：`UISpringTimingParameters`/`spring(response:dampingFraction:)`/
  `UIScrollView.decelerationRate(.normal=0.998/.fast=0.99)`/BlurEffect 材质分级。
- [B] WWDC18-803《Designing Fluid Interfaces》、HIG Motion/Materials、
  Apple 新闻稿（Liquid Glass，2025-06）。
- [W] 本轮实读：[MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)、
  [MDN overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)、
  [web.dev backdrop-filter](https://web.dev/articles/backdrop-filter)。
- [C] 社区共识数值（SwiftUI 默认 ζ≈0.825、WWDC23 预设等）——标注待逐字核实的部分。
