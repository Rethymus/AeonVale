/**
 * 动效皮肤（docs/29 §8/§9 P1）：集中注入的浮层入场动效层。
 *
 * 为什么是注入式：app.css 受设计纪律约束禁止 `animation:`（tests/unit/app-shell
 * 仅扫描 app.css），故沿用各 surface 模块的自注入 `<style>` 模式集中管理。
 *
 * 纪律（docs/29 §7）：
 *  - 只动 transform/opacity（合成器路径，不触 layout）；
 *  - `html[data-reduced-motion='true']` 时整体不生效（保留即时显隐降级）；
 *  - 仅入场动效；退场维持即时（避免与 appFlowView 的 hidden 断言/焦点语义耦合）。
 */

const SURFACE_IN_TARGETS = [
  '[data-app-surface="pause"]',
  '[data-app-surface="settings"]',
  '[data-app-surface="inventory"]',
  '[data-app-surface="map"]',
  '[data-app-surface="cultivation"]',
  '[data-app-surface="codex"]'
] as const;

const MOTION_GUARD = "html:not([data-reduced-motion='true'])";

export function installMotionSkin(): void {
  if (document.getElementById('aeon-motion-skin')) return;
  const style = document.createElement('style');
  style.id = 'aeon-motion-skin';
  const selector = SURFACE_IN_TARGETS.map(target => `${MOTION_GUARD} ${target} .flow-frame`).join(',');
  style.textContent = [
    '@keyframes aeon-surface-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}',
    // 0.28s / (0.32,0.72,0,1) ≈ Apple 无过冲滑入（docs/29 §8.1）；both 防首帧闪现。
    `${selector}{animation:aeon-surface-in .28s cubic-bezier(.32,.72,0,1) both;}`
  ].join('\n');
  document.head.appendChild(style);
}
