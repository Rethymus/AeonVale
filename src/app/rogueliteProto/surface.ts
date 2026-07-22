/**
 * D27-b 一世日课 → R4′ 布阵导流天劫的隔离原型 surface。
 *
 * 隔离：自有 2D canvas，回合解谜（redraw-on-move），驱动 @sim/sokoban 切片；不读不写 sim/GameState。
 * juice：音效（突破/死亡，经 audio.playSfx）+ ctx 粒子/震屏（自有 rAF，仅效果期间跑，reduced-motion 降级）+ 背景 BGM context。
 * 红线：app 层可用 DOM/Math.random（随机归效果，不进 sim）；HUD 每帧走 textContent，help 仅状态切换刷新。
 * factory 名 `createRogueliteProtoSurface` 保留（surface id 'roguelite-proto' 为 dev-only 不可见字符串）。
 */
import { applyPreparationToPuzzle, createPuzzle, createTribulationSession, herbsAliveOf, traceBeam, transitionTribulationSession } from '@sim/sokoban';
import type { Dir, PreparedPuzzlePlacement, SokobanState, TribulationSessionOutcome, TribulationSessionState } from '@sim/sokoban';
import {
  CULTIVATION_ACTIVITY_LABELS,
  CULTIVATION_FINAL_STAGE,
  CULTIVATION_INSIGHT_NODES,
  applyCultivationTribulationOutcome,
  createCultivationAshEpitaph,
  createCultivationRunState,
  cultivationRealmAt,
  deriveCultivationLegacyCandidates,
  deriveTribulationPreparation,
  interpretCultivationTribulationTags,
  transitionToHeir
} from '@sim/cultivation-run';
import type {
  CultivationActivityId,
  CultivationAshEpitaph,
  CultivationLegacyCandidates,
  CultivationLegacySelection,
  CultivationTribulationSettlement,
  TribulationPreparation
} from '@sim/cultivation-run';
import { ROGUELITE_PROTO_PALETTE } from '@render/ColorPalette';
import { assignCultivationActivity, clearSelectedCultivationActivity, createCultivationAgendaDraft, CULTIVATION_AGENDAS_BEFORE_TRIBULATION, cultivationActivityPresentations, cultivationAgendaErrorMessage, cultivationAgendaEstimatedDays, cultivationAgendaSuccessMessage, cultivationRunStats, filledCultivationAgendaSlots, selectCultivationAgendaSlot, toCultivationAgenda, type CultivationAgendaDraft } from '../cultivationRun/presenter';
import { createCultivationRunMachineState, transitionCultivationRunMachine, type CultivationRunMachineAction, type CultivationRunMachineState, type CultivationRunMachineTransition } from '../cultivationRun/machine';
import { createCultivationEventSurface } from '../cultivationRun/eventSurface';
import { createCultivationInsightSurface } from '../cultivationRun/insightSurface';
import { createCultivationAftermathSurface } from '../cultivationRun/aftermathSurface';
import { createCultivationEndingSurface } from '../cultivationRun/endingSurface';
import { createCultivationLegacySurface, type CultivationLegacySurface } from '../cultivationRun/legacySurface';
import { createCultivationLifeIntroSurface } from '../cultivationRun/lifeIntroSurface';
import { createCultivationOpeningSurface, type CultivationOpeningBeat } from '../cultivationRun/openingSurface';
import { createCultivationOmenSurface } from '../cultivationRun/omenSurface';
import { createCultivationResolutionSurface } from '../cultivationRun/resolutionSurface';
import { createCultivationTribulationChoiceSurface } from '../cultivationRun/tribulationChoiceSurface';
import type { CultivationStaticPhaseSurface } from '../cultivationRun/interludeSurfaceShared';
import type { CultivationRunPhaseSurface } from '../cultivationRun/surfaceShared';
import { isStageUnlocked, loadMeta, recordBreakthrough, recordDeath, saveMeta, SCROLL_TOTAL, type ScrollPage, type SokobanMeta } from './meta';
import { clearCultivationJourney, loadCultivationJourney, saveCultivationJourney } from './runSave';

export interface RogueliteProtoAudio {
  playSfx?(id: string): void;
  setMusicContext?(zone: 'farm' | 'tribulation', tension: 'calm' | 'tense'): void;
}

export interface RogueliteProtoSurfaceOptions {
  readonly root: HTMLElement;
  readonly onReturnToTitle: () => void;
  readonly startMode?: 'new' | 'continue';
  readonly onSaveAvailabilityChange?: (available: boolean) => void;
  readonly audio?: RogueliteProtoAudio;
  readonly reducedMotion?: boolean;
  readonly assetUrlForId?: (id: string) => string | undefined;
}

export interface RogueliteProtoSurface {
  start(): void;
  destroy(): void;
}

const TILE = 56;
const P = ROGUELITE_PROTO_PALETTE;
type RogueliteProtoPhase =
  | 'opening'
  | 'life-intro'
  | 'omen'
  | 'planning'
  | 'schedule-resolving'
  | 'event'
  | 'insight'
  | 'tribulation-choice'
  | 'tribulation'
  | 'aftermath'
  | 'legacy'
  | 'ending'
  | 'lifespan-ended';

const TERRAIN_FILL: Record<string, string> = {
  empty: P.floor,
  wall: P.wallStone,
  source: P.beamSource,
  body: P.goalBody,
  herb: P.herbGreen
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  color: string;
  size: number;
}

interface CultivationBrowserTestSnapshot {
  readonly phase: RogueliteProtoPhase;
  readonly machinePhase: CultivationRunMachineState['phase'];
  readonly outcome: TribulationSessionOutcome['result'] | null;
  readonly fatal: boolean;
  readonly deathPrevented: boolean;
  readonly settlementApplied: boolean;
  readonly runStatus: CultivationRunMachineState['runState']['status'];
  readonly herbs: number;
  readonly pills: number;
  readonly legacyReady: boolean;
  readonly generation: number;
  readonly stage: number;
  readonly settlementKind: CultivationTribulationSettlement['kind'] | null;
}

interface CultivationJourneySnapshot {
  readonly version: 1;
  readonly phase: RogueliteProtoPhase;
  readonly openingBeatIndex: number;
  readonly stage: number;
  readonly seedSalt: number;
  readonly state: SokobanState;
  readonly machineState: CultivationRunMachineState;
  readonly preparation: TribulationPreparation;
  readonly preparedPuzzle: PreparedPuzzlePlacement | null;
  readonly tribulationSession: TribulationSessionState | null;
  readonly tribulationOutcome: TribulationSessionOutcome | null;
  readonly agendaDraft: CultivationAgendaDraft;
  readonly agendaCycleStartIndex: number;
  readonly agendaTargetIndex: number;
  readonly pendingEpitaph: CultivationAshEpitaph | null;
  readonly pendingLegacyCandidates: CultivationLegacyCandidates | null;
  readonly generation: number;
  readonly settlementApplied: boolean;
  readonly lastSettlement: CultivationTribulationSettlement | null;
  readonly tribulationFeedback: string | null;
  readonly agendaFeedback: string;
  readonly agendaFeedbackTone: 'neutral' | 'success' | 'error';
  readonly lastScroll: ScrollPage | null;
  readonly deadRun: boolean;
}

interface CultivationBrowserTestApi {
  readonly [key: string]: unknown;
  readonly configureCultivationOverloadKeypoint?: (withWardPill?: boolean) => CultivationBrowserTestSnapshot;
  readonly configureCultivationPlanningKeypoint?: (mode?: 'default' | 'pressure') => CultivationBrowserTestSnapshot;
  readonly configureCultivationLifespanKeypoint?: () => CultivationBrowserTestSnapshot;
  readonly configureCultivationAscensionKeypoint?: () => CultivationBrowserTestSnapshot;
  readonly cultivationSnapshot?: () => CultivationBrowserTestSnapshot;
}

export function createRogueliteProtoSurface(opts: RogueliteProtoSurfaceOptions): RogueliteProtoSurface {
  const { root, onReturnToTitle, audio, assetUrlForId } = opts;
  const reduceFx = opts.reducedMotion === true;

  let stage = 0;
  let openingBeatIndex = 0;
  let seedSalt = 0;
  let state: SokobanState = createPuzzle(stage, seedSalt);
  let machineState: CultivationRunMachineState = createCultivationRunMachineState();
  let preparation: TribulationPreparation = deriveTribulationPreparation(machineState.runState);
  let preparedPuzzle: PreparedPuzzlePlacement | null = null;
  let tribulationSession: TribulationSessionState | null = null;
  let tribulationOutcome: TribulationSessionOutcome | null = null;
  let agendaDraft: CultivationAgendaDraft = createCultivationAgendaDraft();
  let agendaCycleStartIndex = 0;
  let agendaTargetIndex = CULTIVATION_AGENDAS_BEFORE_TRIBULATION;
  let phase: RogueliteProtoPhase = 'planning';
  let phaseSurface: CultivationRunPhaseSurface | null = null;
  let interludeSurface: CultivationStaticPhaseSurface | null = null;
  let legacySurface: CultivationLegacySurface | null = null;
  let pendingEpitaph: CultivationAshEpitaph | null = null;
  let pendingLegacyCandidates: CultivationLegacyCandidates | null = null;
  let generation = 1;
  let settlementApplied = false;
  let lastSettlement: CultivationTribulationSettlement | null = null;
  let tribulationFeedback: string | null = null;
  let agendaFeedback = '先选中一格，再把活动写入竹简。活动会按从左到右的顺序结算。';
  let agendaFeedbackTone: 'neutral' | 'success' | 'error' = 'neutral';
  let meta: SokobanMeta = loadMeta();
  let lastScroll: ScrollPage | null = null;
  let deadRun = false;
  let destroyed = false;

  // juice 效果状态（自有 rAF，仅效果期间跑）
  let particles: Particle[] = [];
  let shakeMag = 0;
  let shakeTtl = 0;
  let effectsRaf = 0;

  root.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = [
    `.rp-wrap{width:100%;max-width:1440px;margin:0 auto;display:flex;flex-direction:column;align-items:stretch;gap:12px;padding:clamp(8px,1.2vw,16px);font-family:"LXGW WenKai","Noto Sans CJK SC",system-ui,sans-serif;color:${P.text};}`,
    '.rp-wrap,.rp-wrap *{box-sizing:border-box;}',
    '.rp-planning,.rp-phase-host,.rp-tribulation{width:100%;}',
    '.rp-planning[hidden],.rp-phase-host[hidden],.rp-tribulation[hidden]{display:none!important;}',
    `.rp-phase-host{min-height:360px;background:${P.boardBg};border:1px solid ${P.boardBorder};}`,
    `.rp-planning{display:grid;grid-template-rows:auto minmax(0,1fr);gap:16px;padding:clamp(14px,2vw,24px);background:${P.boardBg};border:1px solid ${P.boardBorder};}`,
    '.rp-plan-head{min-width:0;display:flex;align-items:end;justify-content:space-between;gap:18px;}',
    '.rp-plan-head>div:first-child{min-width:0;}',
    '.rp-plan-title{margin:0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(22px,4vw,34px);font-weight:600;letter-spacing:.12em;}',
    `.rp-plan-lede{max-width:50rem;margin:4px 0 0;color:${P.helpText};font-size:14px;line-height:1.65;}`,
    `.rp-round-seal{justify-self:start;max-width:100%;border:1px solid ${P.primaryBorder};background:${P.primaryBg};color:${P.accent};padding:8px 12px;font-size:13px;letter-spacing:.08em;}`,
    `.rp-planning-body{min-width:0;display:grid;grid-template-columns:minmax(210px,.72fr) minmax(520px,2fr) minmax(270px,.92fr);gap:14px;align-items:stretch;}`,
    `.rp-status-panel,.rp-schedule-panel,.rp-causal-panel{min-width:0;border:1px solid ${P.boardBorder};background:${P.floor};}`,
    '.rp-status-panel,.rp-causal-panel{display:flex;flex-direction:column;padding:16px;}',
    '.rp-schedule-panel{display:grid;grid-template-rows:auto auto auto 1fr;gap:12px;padding:14px 16px;}',
    `.rp-panel-kicker{margin:0 0 6px;color:${P.accent};font-size:12px;letter-spacing:.16em;}`,
    '.rp-identity-name,.rp-causal-title{margin:0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:22px;font-weight:600;letter-spacing:.08em;}',
    `.rp-identity-stage{margin:5px 0 16px;color:${P.helpText};font-size:13px;}`,
    `.rp-run-stats{min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;margin:0;padding:2px;background:${P.boardBorder};}`,
    `.rp-run-stat{min-width:0;background:${P.btnBg};padding:10px 6px;text-align:center;}`,
    `.rp-run-stat dt{margin:0;color:${P.helpText};font-size:12px;letter-spacing:.08em;}`,
    '.rp-run-stat dd{margin:3px 0 0;font-variant-numeric:tabular-nums;font-size:14px;}',
    `.rp-agenda-meta{min-width:0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-block:2px;color:${P.helpText};font-size:14px;}`,
    '.rp-agenda-scroll{min-width:0;width:100%;position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;list-style:none;margin:0;padding:10px 0;isolation:isolate;}',
    `.rp-agenda-scroll::before,.rp-agenda-scroll::after{content:"";position:absolute;left:0;right:0;height:4px;background:${P.btnBorder};z-index:-1;}`,
    '.rp-agenda-scroll::before{top:30px}.rp-agenda-scroll::after{bottom:30px}',
    '.rp-agenda-scroll>li{min-width:0;}',
    `.rp-agenda-slot{min-width:0;width:100%;min-height:132px;display:grid;grid-template-rows:auto 1fr auto;justify-items:center;gap:8px;padding:10px 6px;background:linear-gradient(90deg,${P.floor},${P.soilFill.loam} 48%,${P.floor});color:${P.text};border:1px solid ${P.btnBorder};border-radius:3px;box-shadow:inset 3px 0 rgba(0,0,0,.18),inset -3px 0 rgba(0,0,0,.18);cursor:pointer;transition:transform .16s ease,border-color .16s ease;}`,
    `.rp-agenda-slot:hover{border-color:${P.accent};}`,
    `.rp-agenda-slot[aria-pressed="true"]{transform:translateY(-5px);border-color:${P.accent};box-shadow:0 7px 0 rgba(0,0,0,.2),inset 3px 0 rgba(0,0,0,.18),inset -3px 0 rgba(0,0,0,.18);}`,
    `.rp-slot-index{color:${P.accent};font-size:12px;font-variant-numeric:tabular-nums;}`,
    '.rp-slot-label{align-self:center;text-align:center;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:20px;letter-spacing:.14em;writing-mode:vertical-rl;}',
    `.rp-slot-label.is-empty{color:${P.helpText};font-size:14px;letter-spacing:.08em;}`,
    `.rp-slot-time{color:${P.helpText};font-size:12px;}`,
    `.rp-activity-fieldset{min-width:0;display:grid;gap:10px;border:0;border-block-start:1px solid ${P.boardBorder};margin:0;padding:12px 0 0;}`,
    `.rp-activity-fieldset legend{padding:0 12px 0 0;color:${P.text};font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:18px;}`,
    '.rp-activity-grid{min-width:0;width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}',
    `.rp-activity-btn{min-width:0;min-block-size:76px;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"key name" "key note";column-gap:10px;align-content:center;text-align:left;padding:10px 12px;background:${P.btnBg};color:${P.text};border:1px solid ${P.btnBorder};border-radius:5px;cursor:pointer;touch-action:manipulation;}`,
    `.rp-activity-btn:hover,.rp-activity-btn[data-selected="true"]{border-color:${P.accent};}`,
    `.rp-activity-key{grid-area:key;align-self:center;display:grid;place-items:center;inline-size:28px;block-size:28px;border:1px solid ${P.btnBorder};color:${P.accent};font:12px/1 system-ui,sans-serif;}`,
    '.rp-activity-name{grid-area:name;font-weight:700;}',
    `.rp-activity-note{grid-area:note;min-width:0;color:${P.helpText};font-size:13px;line-height:1.45;white-space:normal;overflow-wrap:anywhere;}`,
    `.rp-plan-feedback{min-height:1.5em;margin:0;padding:8px 10px;border-left:3px solid ${P.btnBorder};color:${P.helpText};font-size:13px;line-height:1.5;align-self:end;}`,
    `.rp-plan-feedback[data-tone="error"]{border-color:${P.badText};color:${P.badText};background:${P.badBg};}`,
    `.rp-plan-feedback[data-tone="success"]{border-color:${P.okText};color:${P.okText};background:${P.okBg};}`,
    `.rp-causal-safe{margin:9px 0 16px;padding:11px 12px;border-inline-start:3px solid ${P.boltViolet};background:${P.btnBg};color:${P.text};font-size:14px;line-height:1.55;}`,
    `.rp-causal-heading{margin:0 0 9px;color:${P.helpText};font-size:13px;font-weight:600;}`,
    '.rp-causal-chain{display:grid;gap:7px;margin:0;padding:0;list-style:none;}',
    `.rp-causal-chain li{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px;padding-block-end:7px;border-block-end:1px solid ${P.boardBorder};font-size:12px;line-height:1.45;}`,
    `.rp-causal-chain strong{color:${P.accent};}`,
    `.rp-causal-chain span{color:${P.helpText};}`,
    `.rp-plan-actions{display:flex;justify-content:flex-end;align-items:stretch;gap:12px;flex-direction:column;margin-top:auto;border-block-start:1px solid ${P.boardBorder};padding-block-start:14px;}`,
    `.rp-plan-help{margin:0;color:${P.helpText};font-size:12px;}`,
    '.rp-plan-buttons{display:grid;grid-template-columns:1fr;gap:8px;}',
    `.rp-tribulation{display:grid;grid-template-columns:minmax(420px,1.4fr) minmax(300px,.8fr);grid-template-areas:"canvas hud" "canvas help" "canvas dpad" "canvas actions";align-items:start;gap:12px;padding:clamp(12px,2vw,22px);background:${P.boardBg};border:1px solid ${P.boardBorder};color:${P.text};}`,
    `.rp-hud{grid-area:hud;width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;padding:2px;background:${P.boardBorder};font-size:14px;font-variant-numeric:tabular-nums;}`,
    `.rp-hud-item{min-width:0;padding:8px 10px;background:${P.btnBg};color:${P.text};line-height:1.45;}`,
    `.rp-hud-stage{color:${P.accent};font-family:"Noto Serif CJK SC","Songti SC",serif;font-weight:700;}`,
    `.rp-hud-preparation{grid-column:1/-1;border-inline-start:3px solid ${P.boltViolet};font-size:15px;}`,
    `.rp-hud-meta{grid-column:1/-1;color:${P.helpText};font-size:13px;}`,
    '.rp-hud-outcome:empty{display:none;}',
    `.rp-canvas{grid-area:canvas;display:block;max-width:100%;height:auto;justify-self:center;background:${P.boardBg};border:1px solid ${P.boardBorder};border-radius:8px;touch-action:none;}`,
    `.rp-help{grid-area:help;font-size:13px;color:${P.helpText};max-width:480px;text-align:left;line-height:1.6;}`,
    `.rp-help kbd{background:${P.btnBg};border:1px solid ${P.btnBorder};border-radius:3px;padding:0 5px;color:${P.accent};}`,
    '.rp-actions{grid-area:actions;display:flex;gap:8px;flex-wrap:wrap;}',
    '.rp-dpad{grid-area:dpad;display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px);gap:6px;justify-content:start;}',
    '.rp-dpad .rp-btn{min-width:44px;padding:8px;}',
    '.rp-dpad-up{grid-column:2}.rp-dpad-left{grid-column:1;grid-row:2}.rp-dpad-down{grid-column:2;grid-row:2}.rp-dpad-right{grid-column:3;grid-row:2}',
    `.rp-btn{min-inline-size:44px;min-block-size:44px;background:${P.btnBg};color:${P.text};border:1px solid ${P.btnBorder};border-radius:6px;padding:10px 14px;cursor:pointer;font-size:14px;line-height:1.2;touch-action:manipulation;}`,
    `.rp-btn-primary{background:${P.primaryBg};border-color:${P.primaryBorder};color:${P.accent};font-weight:700;}`,
    '.rp-btn:disabled{opacity:.4;cursor:default;}',
    `.rp-btn:focus-visible,.rp-agenda-slot:focus-visible,.rp-activity-btn:focus-visible{outline:3px solid ${P.accent};outline-offset:3px;}`,
    '.rp-outcome{font-size:18px;font-weight:bold;padding:6px 12px;border-radius:8px;}',
    `.rp-outcome.ok{background:${P.okBg};color:${P.okText};}`,
    `.rp-outcome.bad{background:${P.badBg};color:${P.badText};}`,
    '@media(min-width:1200px) and (max-height:820px){.rp-wrap{gap:8px;padding:6px}.rp-planning{gap:9px;padding:10px 12px}.rp-plan-head{gap:12px}.rp-plan-title{font-size:24px}.rp-plan-lede{margin-top:2px;font-size:12px;line-height:1.35}.rp-round-seal{padding:6px 10px;font-size:12px}.rp-planning-body{gap:10px}.rp-status-panel,.rp-causal-panel{padding:10px}.rp-schedule-panel{gap:7px;padding:9px 10px}.rp-panel-kicker{margin-bottom:3px;font-size:11px}.rp-identity-name,.rp-causal-title{font-size:18px}.rp-identity-stage{margin:3px 0 8px;font-size:11px}.rp-run-stat{padding:6px 4px}.rp-run-stat dt{font-size:10px}.rp-run-stat dd{font-size:12px}.rp-agenda-meta{font-size:12px}.rp-agenda-scroll{gap:6px;padding:4px 0}.rp-agenda-scroll::before{top:24px}.rp-agenda-scroll::after{bottom:24px}.rp-agenda-slot{min-height:82px;gap:4px;padding:6px 4px}.rp-slot-index,.rp-slot-time{font-size:10px}.rp-slot-label,.rp-slot-label.is-empty{font-size:15px;letter-spacing:.05em;writing-mode:horizontal-tb}.rp-activity-fieldset{gap:6px;padding-top:7px}.rp-activity-fieldset legend{font-size:15px}.rp-activity-grid{gap:6px}.rp-activity-btn{min-block-size:56px;column-gap:6px;padding:6px 8px}.rp-activity-key{inline-size:24px;block-size:24px}.rp-activity-name{font-size:13px}.rp-activity-note{font-size:11px;line-height:1.25}.rp-plan-feedback{min-height:1.35em;padding:5px 8px;font-size:11px;line-height:1.35}.rp-causal-safe{margin:6px 0 8px;padding:8px 9px;font-size:12px;line-height:1.4}.rp-causal-heading{margin-bottom:5px;font-size:11px}.rp-causal-chain{gap:3px}.rp-causal-chain li{gap:6px;padding-block-end:4px;font-size:10.5px;line-height:1.3}.rp-plan-actions{gap:6px;padding-block-start:8px}.rp-plan-help{font-size:10px}.rp-plan-buttons{gap:6px}.rp-btn{padding:8px 10px;font-size:12px}}',
    '@media(max-width:1120px){.rp-planning-body{grid-template-columns:minmax(190px,.7fr) minmax(480px,1.8fr)}.rp-causal-panel{grid-column:1/-1;display:grid;grid-template-columns:minmax(190px,.7fr) minmax(0,1.8fr);gap:10px 18px}.rp-causal-panel>.rp-panel-kicker,.rp-causal-panel>.rp-causal-title,.rp-causal-panel>.rp-causal-safe{grid-column:1}.rp-causal-heading,.rp-causal-chain{grid-column:2}.rp-causal-heading{grid-row:1}.rp-causal-chain{grid-row:2/5}.rp-plan-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr auto}.rp-plan-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media(max-width:760px){.rp-wrap{padding:8px}.rp-planning{display:grid}.rp-plan-head{display:grid}.rp-planning-body{grid-template-columns:1fr}.rp-status-panel,.rp-causal-panel{display:flex;grid-column:auto}.rp-schedule-panel{padding:12px}.rp-run-stats{grid-template-columns:repeat(4,1fr)}.rp-agenda-scroll{grid-template-columns:repeat(3,1fr);padding:10px 0}.rp-agenda-scroll::before,.rp-agenda-scroll::after{display:none}.rp-agenda-slot{min-height:104px}.rp-slot-label{writing-mode:horizontal-tb;font-size:18px}.rp-activity-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-plan-actions{display:flex}.rp-plan-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-tribulation{display:flex;flex-direction:column;align-items:center}.rp-hud{grid-template-columns:repeat(2,minmax(0,1fr))}.rp-hud-preparation,.rp-hud-meta{grid-column:1/-1}.rp-help{text-align:center}.rp-dpad{justify-content:center}}',
    '@media(max-width:460px){.rp-round-seal{justify-self:start}.rp-run-stats{grid-template-columns:repeat(2,1fr)}.rp-agenda-scroll{gap:6px}.rp-activity-grid{grid-template-columns:1fr}.rp-plan-actions{align-items:stretch}.rp-plan-buttons{width:100%;grid-template-columns:1fr}}',
    '@media(prefers-reduced-motion:reduce){.rp-agenda-slot{transition:none}.rp-agenda-slot[aria-pressed="true"]{transform:none}}',
    '.rp-reduce-motion .rp-agenda-slot{transition:none}.rp-reduce-motion .rp-agenda-slot[aria-pressed="true"]{transform:none}'
  ].join('\n');
  root.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = reduceFx ? 'rp-wrap rp-reduce-motion' : 'rp-wrap';
  root.appendChild(wrap);

  const planning = document.createElement('section');
  planning.className = 'rp-planning';
  planning.setAttribute('aria-labelledby', 'rp-agenda-heading');
  wrap.appendChild(planning);

  const planHead = document.createElement('div');
  planHead.className = 'rp-plan-head';
  planning.appendChild(planHead);
  const planTitleGroup = document.createElement('div');
  planHead.appendChild(planTitleGroup);
  const planTitle = document.createElement('h2');
  planTitle.id = 'rp-agenda-heading';
  planTitle.className = 'rp-plan-title';
  planTitle.textContent = '一世日课';
  planTitleGroup.appendChild(planTitle);
  const planLede = document.createElement('p');
  planLede.className = 'rp-plan-lede';
  planLede.textContent = '本步：填满六格日课。它们按先后结算——先得资源，后续活动才能用；心压越界，后面的收益会立刻衰减。';
  planTitleGroup.appendChild(planLede);
  const roundSeal = document.createElement('div');
  roundSeal.className = 'rp-round-seal';
  planHead.appendChild(roundSeal);

  const planningBody = document.createElement('div');
  planningBody.className = 'rp-planning-body';
  planning.appendChild(planningBody);

  const statusPanel = document.createElement('aside');
  statusPanel.className = 'rp-status-panel';
  statusPanel.setAttribute('aria-label', '这一世的身份与状态');
  planningBody.appendChild(statusPanel);
  const identityKicker = document.createElement('p');
  identityKicker.className = 'rp-panel-kicker';
  identityKicker.textContent = '这一世';
  const identityNameEl = document.createElement('h3');
  identityNameEl.className = 'rp-identity-name';
  const identityStageEl = document.createElement('p');
  identityStageEl.className = 'rp-identity-stage';
  statusPanel.append(identityKicker, identityNameEl, identityStageEl);

  const runStats = document.createElement('dl');
  runStats.className = 'rp-run-stats';
  runStats.setAttribute('aria-label', '当前一世状态');
  statusPanel.appendChild(runStats);

  const schedulePanel = document.createElement('div');
  schedulePanel.className = 'rp-schedule-panel';
  planningBody.appendChild(schedulePanel);

  const agendaMeta = document.createElement('div');
  agendaMeta.className = 'rp-agenda-meta';
  schedulePanel.appendChild(agendaMeta);
  const filledMeta = document.createElement('span');
  const daysMeta = document.createElement('span');
  agendaMeta.append(filledMeta, daysMeta);

  const agendaList = document.createElement('ol');
  agendaList.className = 'rp-agenda-scroll';
  agendaList.setAttribute('aria-label', '六格日程，按从左到右顺序结算');
  schedulePanel.appendChild(agendaList);
  const slotButtons: HTMLButtonElement[] = [];
  const slotLabelEls: HTMLSpanElement[] = [];
  const slotTimeEls: HTMLSpanElement[] = [];
  for (let slotIndex = 0; slotIndex < 6; slotIndex++) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-agenda-slot';
    button.dataset.slotIndex = String(slotIndex);
    button.addEventListener('click', () => {
      agendaDraft = selectCultivationAgendaSlot(agendaDraft, slotIndex);
      renderPlanning();
    });
    const indexEl = document.createElement('span');
    indexEl.className = 'rp-slot-index';
    indexEl.textContent = `第 ${slotIndex + 1} 格`;
    const labelEl = document.createElement('span');
    labelEl.className = 'rp-slot-label is-empty';
    const timeEl = document.createElement('span');
    timeEl.className = 'rp-slot-time';
    button.append(indexEl, labelEl, timeEl);
    item.appendChild(button);
    agendaList.appendChild(item);
    slotButtons.push(button);
    slotLabelEls.push(labelEl);
    slotTimeEls.push(timeEl);
  }

  const activityFieldset = document.createElement('fieldset');
  activityFieldset.className = 'rp-activity-fieldset';
  schedulePanel.appendChild(activityFieldset);
  const activityLegend = document.createElement('legend');
  activityLegend.textContent = '写入所选竹简';
  activityFieldset.appendChild(activityLegend);
  const activityGrid = document.createElement('div');
  activityGrid.className = 'rp-activity-grid';
  activityFieldset.appendChild(activityGrid);
  const activityButtons = new Map<CultivationActivityId, HTMLButtonElement>();
  const activityPresentations = cultivationActivityPresentations();
  for (const activity of activityPresentations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rp-activity-btn';
    button.setAttribute('aria-keyshortcuts', activity.shortcut);
    button.setAttribute('aria-label', `${activity.label}，${activity.timeCostDays} 日，${activity.summary}，快捷键 ${activity.shortcut}`);
    const key = document.createElement('span');
    key.className = 'rp-activity-key';
    key.setAttribute('aria-hidden', 'true');
    key.textContent = activity.shortcut;
    const name = document.createElement('span');
    name.className = 'rp-activity-name';
    name.textContent = `${activity.label} · ${activity.timeCostDays} 日`;
    const note = document.createElement('span');
    note.className = 'rp-activity-note';
    note.textContent = activity.summary;
    button.append(key, name, note);
    button.addEventListener('click', () => chooseActivity(activity.id));
    activityGrid.appendChild(button);
    activityButtons.set(activity.id, button);
  }

  const planFeedback = document.createElement('p');
  planFeedback.id = 'rp-plan-feedback';
  planFeedback.className = 'rp-plan-feedback';
  planFeedback.setAttribute('role', 'status');
  planFeedback.setAttribute('aria-live', 'polite');
  schedulePanel.appendChild(planFeedback);

  const causalPanel = document.createElement('aside');
  causalPanel.className = 'rp-causal-panel';
  causalPanel.setAttribute('aria-label', '下一劫与修行因果');
  planningBody.appendChild(causalPanel);
  const causalKicker = document.createElement('p');
  causalKicker.className = 'rp-panel-kicker';
  causalKicker.textContent = '下一场大考';
  const causalTribulationEl = document.createElement('h3');
  causalTribulationEl.className = 'rp-causal-title';
  const causalSafeEl = document.createElement('p');
  causalSafeEl.className = 'rp-causal-safe';
  causalPanel.append(causalKicker, causalTribulationEl, causalSafeEl);
  const causalHeading = document.createElement('h4');
  causalHeading.className = 'rp-causal-heading';
  causalHeading.textContent = '这轮日课如何抵达天劫';
  const causalChain = document.createElement('ol');
  causalChain.className = 'rp-causal-chain';
  for (const [label, detail] of [
    ['灵田', '产出灵草与食物，养活后续苦练并把护田资源带进劫盘。'],
    ['炼丹', '把灵草换成撤步与护脉，让一次判断失误不必直接断送此世。'],
    ['苦练', '把食物换成体魄、耐力与意志，抬高真正可承受的雷威。'],
    ['参悟', '用灵石换劫兆与残卷批注，逐步看清甜蜜雷威区间。'],
    ['谋生 / 歇息', '补灵石、压心压、养伤，让生态链不会因单一最优解而断裂。']
  ] as const) {
    const item = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = label;
    const text = document.createElement('span');
    text.textContent = detail;
    item.append(strong, text);
    causalChain.appendChild(item);
  }
  causalPanel.append(causalHeading, causalChain);

  const planActions = document.createElement('div');
  planActions.className = 'rp-plan-actions';
  causalPanel.appendChild(planActions);
  const planHelp = document.createElement('p');
  planHelp.id = 'rp-plan-help';
  planHelp.className = 'rp-plan-help';
  planHelp.textContent = '快捷键：1–6 写入活动；方向键切换竹简；Delete 清空所选格。';
  planActions.appendChild(planHelp);
  const planButtons = document.createElement('div');
  planButtons.className = 'rp-plan-buttons';
  planActions.appendChild(planButtons);
  const planReturnBtn = document.createElement('button');
  planReturnBtn.className = 'rp-btn';
  planReturnBtn.type = 'button';
  planReturnBtn.textContent = '返回标题';
  planReturnBtn.addEventListener('click', () => onReturnToTitle());
  const confirmAgendaBtn = document.createElement('button');
  confirmAgendaBtn.className = 'rp-btn rp-btn-primary';
  confirmAgendaBtn.type = 'button';
  confirmAgendaBtn.setAttribute('aria-describedby', 'rp-plan-help rp-plan-feedback');
  confirmAgendaBtn.addEventListener('click', () => settleAgenda());
  const concludeLifeBtn = document.createElement('button');
  concludeLifeBtn.className = 'rp-btn';
  concludeLifeBtn.type = 'button';
  concludeLifeBtn.textContent = '余寿不足 · 封卷归灰';
  concludeLifeBtn.hidden = true;
  concludeLifeBtn.addEventListener('click', () => concludeLifespan());
  planButtons.append(planReturnBtn, concludeLifeBtn, confirmAgendaBtn);

  const phaseHost = document.createElement('section');
  phaseHost.className = 'rp-phase-host';
  phaseHost.hidden = true;
  phaseHost.setAttribute('aria-live', 'polite');
  wrap.appendChild(phaseHost);

  const tribulation = document.createElement('section');
  tribulation.className = 'rp-tribulation';
  tribulation.hidden = true;
  tribulation.setAttribute('aria-label', '天劫布阵');
  wrap.appendChild(tribulation);

  const hud = document.createElement('div');
  hud.className = 'rp-hud';
  hud.setAttribute('role', 'status');
  hud.setAttribute('aria-live', 'polite');
  tribulation.appendChild(hud);
  const stageEl = document.createElement('span');
  const movesEl = document.createElement('span');
  const herbsEl = document.createElement('span');
  const metaEl = document.createElement('span');
  const preparationEl = document.createElement('span');
  const statusEl = document.createElement('span');
  stageEl.className = 'rp-hud-item rp-hud-stage';
  movesEl.className = 'rp-hud-item';
  herbsEl.className = 'rp-hud-item';
  preparationEl.className = 'rp-hud-item rp-hud-preparation';
  metaEl.className = 'rp-hud-item rp-hud-meta';
  statusEl.className = 'rp-hud-outcome';
  for (const el of [stageEl, movesEl, herbsEl, preparationEl, metaEl, statusEl]) hud.appendChild(el);

  const canvas = document.createElement('canvas');
  canvas.className = 'rp-canvas';
  canvas.width = state.board.width * TILE;
  canvas.height = state.board.height * TILE;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', '布阵导流灵田：推阵石把雷光折射进身体');
  tribulation.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const help = document.createElement('div');
  help.className = 'rp-help';
  help.id = 'rp-tribulation-help';
  help.setAttribute('aria-live', 'polite');
  tribulation.appendChild(help);
  canvas.setAttribute('aria-describedby', help.id);

  const dpad = document.createElement('div');
  dpad.className = 'rp-dpad';
  dpad.setAttribute('role', 'group');
  dpad.setAttribute('aria-label', '移动方向');
  tribulation.appendChild(dpad);
  const dpadButtons: ReadonlyArray<{ readonly dir: Dir; readonly label: string; readonly className: string }> = [
    { dir: 'up', label: '向上', className: 'rp-dpad-up' },
    { dir: 'left', label: '向左', className: 'rp-dpad-left' },
    { dir: 'down', label: '向下', className: 'rp-dpad-down' },
    { dir: 'right', label: '向右', className: 'rp-dpad-right' }
  ];
  for (const item of dpadButtons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rp-btn ${item.className}`;
    button.textContent = item.dir === 'up' ? '↑' : item.dir === 'down' ? '↓' : item.dir === 'left' ? '←' : '→';
    button.setAttribute('aria-label', item.label);
    button.addEventListener('click', () => tryMove(item.dir));
    dpad.appendChild(button);
  }

  const actions = document.createElement('div');
  actions.className = 'rp-actions';
  tribulation.appendChild(actions);

  const retryBtn = document.createElement('button');
  retryBtn.className = 'rp-btn';
  retryBtn.type = 'button';
  retryBtn.textContent = '撤步';
  retryBtn.addEventListener('click', () => useUndo());

  const rerollBtn = document.createElement('button');
  rerollBtn.className = 'rp-btn';
  rerollBtn.type = 'button';
  rerollBtn.textContent = '护脉丹：未启用';
  rerollBtn.addEventListener('click', () => toggleWard());

  const nextBtn = document.createElement('button');
  nextBtn.className = 'rp-btn';
  nextBtn.type = 'button';
  nextBtn.textContent = '下一阶 →';
  nextBtn.addEventListener('click', () => {
    advanceAfterTribulation();
  });

  const returnBtn = document.createElement('button');
  returnBtn.className = 'rp-btn';
  returnBtn.type = 'button';
  returnBtn.textContent = '返回标题';
  returnBtn.addEventListener('click', () => onReturnToTitle());

  actions.appendChild(retryBtn);
  actions.appendChild(rerollBtn);
  actions.appendChild(nextBtn);
  actions.appendChild(returnBtn);

  function destroyPhaseSurfaces(): void {
    phaseSurface?.destroy();
    phaseSurface = null;
    interludeSurface?.destroy();
    interludeSurface = null;
    legacySurface?.destroy();
    legacySurface = null;
  }

  function currentLifeIdentity(): { readonly name: string; readonly portraitId: string } {
    return {
      name: generation === 1 ? '沈砚' : `后来人·第${generation}世`,
      portraitId: 'portrait.player-default-v1'
    };
  }

  function cultivationStageLabel(stageValue: number): string {
    const realm = cultivationRealmAt(stageValue);
    return realm ? `第 ${realm.stage} 境 · ${realm.name}` : '凡骨 · 认劫';
  }

  function nextTribulationLabel(stageValue: number): string {
    if (stageValue >= CULTIVATION_FINAL_STAGE) return '归一 · 紫雷终劫';
    const nextRealm = cultivationRealmAt(stageValue + 1);
    return nextRealm ? `第 ${nextRealm.stage} 劫 · ${nextRealm.name}` : '第一劫 · 察漏';
  }

  function tribulationResultLabel(result: TribulationSessionOutcome['result']): string {
    switch (result) {
      case 'perfect': return '完美淬体';
      case 'survived': return '带伤承雷';
      case 'insufficient': return '劫力不足';
      case 'overload': return '雷威过载';
      case 'timeout': return '步数耗尽';
      case 'unreached': return '尚未触身';
    }
  }

  function currentJourneySnapshot(): CultivationJourneySnapshot {
    return {
      version: 1,
      phase,
      openingBeatIndex,
      stage,
      seedSalt,
      state,
      machineState,
      preparation,
      preparedPuzzle,
      tribulationSession,
      tribulationOutcome,
      agendaDraft,
      agendaCycleStartIndex,
      agendaTargetIndex,
      pendingEpitaph,
      pendingLegacyCandidates,
      generation,
      settlementApplied,
      lastSettlement,
      tribulationFeedback,
      agendaFeedback,
      agendaFeedbackTone,
      lastScroll,
      deadRun
    };
  }

  function persistJourney(): void {
    if (destroyed) return;
    const available = saveCultivationJourney(currentJourneySnapshot());
    opts.onSaveAvailabilityChange?.(available);
  }

  function isJourneySnapshot(value: unknown): value is CultivationJourneySnapshot {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<CultivationJourneySnapshot>;
    return candidate.version === 1
      && typeof candidate.phase === 'string'
      && typeof candidate.openingBeatIndex === 'number'
      && typeof candidate.stage === 'number'
      && typeof candidate.seedSalt === 'number'
      && typeof candidate.generation === 'number'
      && Boolean(candidate.state && typeof candidate.state === 'object')
      && Boolean(candidate.machineState && typeof candidate.machineState === 'object')
      && Boolean(candidate.preparation && typeof candidate.preparation === 'object')
      && Boolean(candidate.agendaDraft && typeof candidate.agendaDraft === 'object');
  }

  function restoreJourney(snapshot: CultivationJourneySnapshot): void {
    phase = snapshot.phase;
    openingBeatIndex = snapshot.openingBeatIndex;
    stage = snapshot.stage;
    seedSalt = snapshot.seedSalt;
    state = snapshot.state;
    machineState = snapshot.machineState;
    preparation = snapshot.preparation;
    preparedPuzzle = snapshot.preparedPuzzle;
    tribulationSession = snapshot.tribulationSession;
    tribulationOutcome = snapshot.tribulationOutcome;
    agendaDraft = snapshot.agendaDraft;
    agendaCycleStartIndex = snapshot.agendaCycleStartIndex;
    agendaTargetIndex = snapshot.agendaTargetIndex;
    pendingEpitaph = snapshot.pendingEpitaph;
    pendingLegacyCandidates = snapshot.pendingLegacyCandidates;
    generation = snapshot.generation;
    settlementApplied = snapshot.settlementApplied;
    lastSettlement = snapshot.lastSettlement;
    tribulationFeedback = snapshot.tribulationFeedback;
    agendaFeedback = snapshot.agendaFeedback;
    agendaFeedbackTone = snapshot.agendaFeedbackTone;
    lastScroll = snapshot.lastScroll;
    deadRun = snapshot.deadRun;
    resizeCanvasForState();

    switch (phase) {
      case 'opening':
        showOpening();
        break;
      case 'life-intro':
        showLifeIntro();
        break;
      case 'omen':
        showOmen();
        break;
      case 'planning':
        showPlanning(false);
        break;
      case 'schedule-resolving':
      case 'event':
      case 'insight':
      case 'tribulation-choice':
        routeMachinePhase();
        break;
      case 'tribulation':
        showTribulationBoard();
        break;
      case 'aftermath':
        showAftermath();
        break;
      case 'legacy':
      case 'lifespan-ended':
        showLegacy();
        break;
      case 'ending':
        showCultivationEnding();
        break;
    }
  }

  function mountInterlude(nextPhase: RogueliteProtoPhase, createSurface: () => CultivationStaticPhaseSurface): void {
    destroyPhaseSurfaces();
    phase = nextPhase;
    planning.hidden = true;
    phaseHost.hidden = false;
    tribulation.hidden = true;
    interludeSurface = createSurface();
    interludeSurface.focusInitial();
    persistJourney();
  }

  function openingBeats(): readonly CultivationOpeningBeat[] {
    return [
      {
        mark: '醒',
        kicker: '入世录之一 · 异乡醒来',
        title: '没有系统，也没有人来救你',
        body: [
          '你在永恒山谷外的湿林里醒来，记得原来的世界，却不记得自己如何死去。袖中没有法宝，脑海里也没有会替你报数的声音。',
          '谷民把你捡回去，只给了一碗粥和一个名字：沈砚。往后的每一天，都要用真实会老、会伤的身体去换。'
        ],
        consequence: '第一条规则：余寿不是倒计时装饰。日课、受伤与天劫都会把它写进结局。',
        assetId: 'cg.prologue.awakening-v1',
        artworkUrl: assetUrlForId?.('cg.prologue.awakening-v1'),
        artworkAlt: '沈砚在永恒山谷外的破屋中醒来',
        artworkCaption: '陌生的雨声停在檐外，身体先于答案醒来'
      },
      {
        mark: '田',
        kicker: '入世录之二 · 归谷执锄',
        title: '测不出的灵根，先学看水往哪里走',
        body: [
          '太一门的测灵石没有给出一条可走的路。你回到谷里，老人没有安慰，也没有羞辱，只把一柄旧锄塞进手中。',
          '“先看水往哪里走。”于是你从灵田学会第一件事：修行不是凭空涨出的数字，身体要吃，丹炉要草，草要地与时日。'
        ],
        consequence: '灵田 → 食物与灵草 → 苦练与炼丹。每一份资源都要在生态里找到来处和去处。',
        assetId: 'cg.prologue.return-valley-v1',
        artworkUrl: assetUrlForId?.('cg.prologue.return-valley-v1'),
        artworkAlt: '沈砚扛着旧锄回到永恒山谷的灵田',
        artworkCaption: '老人没有讲大道，只让你先认清一畦水势'
      },
      {
        mark: '灰',
        kicker: '入世录之三 · 灰落灵田',
        title: '仙人斗法时，凡人的田先碎了',
        body: [
          '两名修士从云上打进山谷。护田阵像纸一样裂开，作物、屋瓦和来不及逃的人一同被雷火卷走。',
          '那个只留下一个“逆”字的陌生人死在田埂上，化作灰。无主储物戒在你掌心打开，里面没有答案，只有奇种、残炉和一册破得不能再破的手稿。'
        ],
        consequence: '第二条规则：天劫不是独立小游戏。田里保下的草、炼出的丹和练成的身体，都会被带上劫盘结算。',
        assetId: 'cg.first-person.scene.ni-ash-v2',
        artworkUrl: assetUrlForId?.('cg.first-person.scene.ni-ash-v2'),
        artworkAlt: '雷火后的灵田与名为逆的修士留下的劫灰',
        artworkCaption: '灰落进田土，储物戒里只剩一条未走完的路'
      },
      {
        mark: '劫',
        kicker: '入世录之四 · 残卷立誓',
        title: '以劫为薪，以骨为柴',
        body: [
          '残卷上的字属于你原来的世界：无灵根者，方可习之。所谓空无，不是没有灵气，而是来得快、漏得更快。',
          '灵田放大吞吐，丹药暂堵漏隙，雷劫把每一次裂口烧成身体的一部分。失败的人化灰，后来人只继承真正被此世证明过的一页批注与一件旧物。'
        ],
        consequence: '日课准备 → 主动引劫 → 肉身结算 → 劫灰传承。今天排下的六格，就是这条因果链的第一笔。',
        assetId: 'cg.first-person.act1.script-v2',
        artworkUrl: assetUrlForId?.('cg.first-person.act1.script-v2'),
        artworkAlt: '写着偷天换劫诀的残卷在丹炉旁展开',
        artworkCaption: '此诀非人所修。习此诀者，已死'
      }
    ];
  }

  function showOpening(): void {
    mountInterlude('opening', () => createCultivationOpeningSurface({
      root: phaseHost,
      beats: openingBeats(),
      initialBeat: openingBeatIndex,
      onBeatChange: beatIndex => {
        openingBeatIndex = beatIndex;
        persistJourney();
      },
      onContinue: showLifeIntro
    }));
  }

  function showLifeIntro(): void {
    const identity = currentLifeIdentity();
    const inheritedMarks = machineState.insightNodeIds.length > 0
      ? [{ label: '前人批注', value: `已认得 ${machineState.insightNodeIds.length} 页残卷` }]
      : [];
    mountInterlude('life-intro', () => createCultivationLifeIntroSurface({
      root: phaseHost,
      view: {
        identityName: identity.name,
        generation,
        stageLabel: cultivationStageLabel(machineState.runState.stage),
        lifespanRemainingDays: machineState.runState.lifespanRemainingDays,
        premise: generation === 1
          ? '你只有一副会老、会伤、会被雷劈碎的凡人身体。每一格日课都在用余寿换取下一场天劫的答案。'
          : '前人的身体已经归灰；留下来的只有一页真正读懂的批注、一件旧物，以及这一次仍会耗尽的余寿。',
        inheritedMarks
      },
      artwork: {
        assetId: 'cg.prologue.awakening-v1',
        url: assetUrlForId?.('cg.prologue.awakening-v1'),
        alt: `${identity.name}在破屋中醒来，准备翻开这一世的日课`,
        caption: '凡骨仍轻，旧愿已经压在手中'
      },
      onContinue: showOmen
    }));
  }

  function showOmen(): void {
    const runState = machineState.runState;
    const currentPreparation = deriveTribulationPreparation(runState);
    const pressureSeverity = runState.pressure >= 75 ? 'danger' : runState.pressure >= 50 ? 'warning' : 'known';
    mountInterlude('omen', () => createCultivationOmenSurface({
      root: phaseHost,
      view: {
        stageLabel: cultivationStageLabel(runState.stage),
        tribulationName: nextTribulationLabel(runState.stage),
        objective: '先完成一轮日课即可主动引劫；若再准备一轮，天道随后强制催讨。',
        lifespanRemainingDays: runState.lifespanRemainingDays,
        knownSigns: [
          `当前最多可承受雷威 ${currentPreparation.maxSurvivablePower}，甜蜜区间 ${currentPreparation.sweetSpotMinPower}–${currentPreparation.sweetSpotMaxPower}。`,
          currentPreparation.previewLevel > 0 ? `残卷让你能预见 ${currentPreparation.previewLevel} 层劫盘信息。` : '劫盘尚无额外预见，只能按肉身上限保守准备。'
        ],
        risks: [
          {
            label: '心压与凡心',
            detail: `心压 ${runState.pressure}/100，凡心 ${runState.mortalHeart}/100；失衡会压低后续日课效率。`,
            severity: pressureSeverity
          },
          {
            label: '护持库存',
            detail: runState.pills > 0 ? `现有 ${runState.pills} 枚丹药，可在劫中撤步或护脉。` : '尚无丹药；致命过载将直接结束这一世。',
            severity: runState.pills > 0 ? 'known' : 'danger'
          }
        ]
      },
      artwork: {
        assetId: 'cg.first-person.scene.purple-sky-v2',
        url: assetUrlForId?.('cg.first-person.scene.purple-sky-v2'),
        alt: `${nextTribulationLabel(runState.stage)}的紫色劫云正在远天聚拢`,
        caption: '劫云尚远，准备已经开始计入结果',
        objectPosition: 'center 38%'
      },
      onContinue: () => showPlanning()
    }));
  }

  function showPlanning(focus = true): void {
    destroyPhaseSurfaces();
    phase = 'planning';
    planning.hidden = false;
    phaseHost.hidden = true;
    tribulation.hidden = true;
    audio?.setMusicContext?.('farm', 'calm');
    renderPlanning();
    planning.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    if (focus) slotButtons[agendaDraft.selectedSlot]?.focus({ preventScroll: true });
  }

  function mountMachinePhaseSurface(createSurface: (dispatch: typeof dispatchMachine) => CultivationRunPhaseSurface): void {
    destroyPhaseSurfaces();
    phase = machineState.phase;
    planning.hidden = true;
    phaseHost.hidden = false;
    tribulation.hidden = true;
    phaseSurface = createSurface(dispatchMachine);
    phaseSurface.focusInitial();
  }

  function routeMachinePhase(previousPhase?: CultivationRunMachineState['phase']): void {
    switch (machineState.phase) {
      case 'planning':
        agendaDraft = createCultivationAgendaDraft();
        if (previousPhase === 'insight') {
          agendaFeedback = `${cultivationAgendaSuccessMessage(machineState.runState)} 继续安排下一轮。`;
          agendaFeedbackTone = 'success';
        }
        showPlanning();
        break;
      case 'schedule-resolving':
        mountMachinePhaseSurface(dispatch =>
          createCultivationResolutionSurface({
            root: phaseHost,
            state: machineState,
            dispatch
          })
        );
        break;
      case 'event':
        mountMachinePhaseSurface(dispatch =>
          createCultivationEventSurface({
            root: phaseHost,
            state: machineState,
            dispatch
          })
        );
        break;
      case 'insight':
        mountMachinePhaseSurface(dispatch =>
          createCultivationInsightSurface({
            root: phaseHost,
            state: machineState,
            dispatch
          })
        );
        break;
      case 'tribulation-choice':
        mountMachinePhaseSurface(dispatch =>
          createCultivationTribulationChoiceSurface({
            root: phaseHost,
            state: machineState,
            dispatch,
            artwork: {
              assetId: 'cg.first-person.tribulation.purple-v2',
              url: assetUrlForId?.('cg.first-person.tribulation.purple-v2'),
              alt: '紫色天劫在灵田上空聚拢，等待玩家决定何时引落',
              caption: '这一问决定准备到此为止，还是再押上一轮余寿',
              objectPosition: 'center 42%'
            }
          })
        );
        break;
      case 'tribulation':
        enterTribulation();
        break;
      case 'lifespan-ended':
        prepareLifespanLegacy();
        showLegacy();
        break;
    }
  }

  function dispatchMachine(action: CultivationRunMachineAction): CultivationRunMachineTransition {
    const previousPhase = machineState.phase;
    const result = transitionCultivationRunMachine(machineState, action);
    machineState = result.state;
    if (result.ok) {
      if (machineState.phase === previousPhase) {
        phaseSurface?.update(machineState);
        persistJourney();
      } else routeMachinePhase(previousPhase);
    }
    return result;
  }

  function renderPlanning(): void {
    const agendasThisCycle = Math.max(1, agendaTargetIndex - agendaCycleStartIndex);
    const runState = machineState.runState;
    const identity = currentLifeIdentity();
    const currentPreparation = deriveTribulationPreparation(runState);
    identityNameEl.textContent = identity.name;
    identityStageEl.textContent = `第 ${generation} 世 · ${cultivationStageLabel(runState.stage)}`;
    causalTribulationEl.textContent = nextTribulationLabel(runState.stage);
    causalSafeEl.textContent = currentPreparation.previewLevel > 0
      ? `现可预见：存活上限 ${currentPreparation.maxSurvivablePower}，甜蜜雷威 ${currentPreparation.sweetSpotMinPower}–${currentPreparation.sweetSpotMaxPower}。`
      : `劫兆仍模糊。当前肉身最多承受雷威 ${currentPreparation.maxSurvivablePower}；参悟会逐步揭开甜蜜区间。`;
    const stats = cultivationRunStats(runState, agendasThisCycle, agendaCycleStartIndex);
    runStats.replaceChildren(
      ...stats.map(stat => {
        const item = document.createElement('div');
        item.className = 'rp-run-stat';
        const term = document.createElement('dt');
        term.textContent = stat.label;
        const value = document.createElement('dd');
        value.textContent = stat.value;
        item.append(term, value);
        return item;
      })
    );
    const cycleRound = Math.min(runState.agendaIndex - agendaCycleStartIndex + 1, agendasThisCycle);
    roundSeal.textContent = `第 ${cycleRound} 轮 · 劫前日课`;
    const filled = filledCultivationAgendaSlots(agendaDraft);
    filledMeta.textContent = `已排 ${filled}/${agendaDraft.slots.length}`;
    daysMeta.textContent = `预计耗时 ${cultivationAgendaEstimatedDays(agendaDraft)} 日`;

    for (let slotIndex = 0; slotIndex < agendaDraft.slots.length; slotIndex++) {
      const activity = agendaDraft.slots[slotIndex] ?? null;
      const selected = slotIndex === agendaDraft.selectedSlot;
      const button = slotButtons[slotIndex];
      const label = slotLabelEls[slotIndex];
      const time = slotTimeEls[slotIndex];
      if (!button || !label || !time) continue;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', activity === null ? `第 ${slotIndex + 1} 格，空白${selected ? '，当前选中' : ''}` : `第 ${slotIndex + 1} 格，${CULTIVATION_ACTIVITY_LABELS[activity]}${selected ? '，当前选中' : ''}`);
      label.textContent = activity === null ? '待安排' : CULTIVATION_ACTIVITY_LABELS[activity];
      label.classList.toggle('is-empty', activity === null);
      time.textContent = activity === null ? '选择活动' : `${activityPresentations.find(item => item.id === activity)?.timeCostDays ?? 0} 日`;
    }

    const selectedActivity = agendaDraft.slots[agendaDraft.selectedSlot] ?? null;
    for (const [activity, button] of activityButtons) {
      button.dataset.selected = String(activity === selectedActivity);
    }
    planFeedback.textContent = agendaFeedback;
    planFeedback.dataset.tone = agendaFeedbackTone;
    const remaining = agendaDraft.slots.length - filled;
    const minimumAgendaDays = Math.min(...activityPresentations.map(activity => activity.timeCostDays)) * agendaDraft.slots.length;
    const canPlanFullAgenda = runState.lifespanRemainingDays >= minimumAgendaDays;
    confirmAgendaBtn.disabled = !canPlanFullAgenda;
    concludeLifeBtn.hidden = canPlanFullAgenda;
    concludeLifeBtn.disabled = canPlanFullAgenda;
    confirmAgendaBtn.textContent = remaining > 0 ? `结算本轮（还差 ${remaining} 格）` : runState.agendaIndex + 1 >= agendaTargetIndex ? '结清本轮并引劫' : '结清本轮日课';
    if (!canPlanFullAgenda) {
      agendaFeedback = `余寿只剩 ${runState.lifespanRemainingDays} 日，已不足排满最短的一轮日课。可以封卷，让后来人接续。`;
      agendaFeedbackTone = 'error';
      planFeedback.textContent = agendaFeedback;
      planFeedback.dataset.tone = agendaFeedbackTone;
    }
    persistJourney();
  }

  function chooseActivity(activity: CultivationActivityId): void {
    agendaDraft = assignCultivationActivity(agendaDraft, activity);
    agendaFeedback = `已写入「${CULTIVATION_ACTIVITY_LABELS[activity]}」。可选中任一竹简继续替换。`;
    agendaFeedbackTone = 'neutral';
    renderPlanning();
  }

  function settleAgenda(): void {
    const agenda = toCultivationAgenda(agendaDraft);
    if (!agenda) {
      agendaFeedback = '日程必须排满六格。请继续选择活动。';
      agendaFeedbackTone = 'error';
      renderPlanning();
      slotButtons[agendaDraft.selectedSlot]?.focus({ preventScroll: true });
      return;
    }

    const draftResult = dispatchMachine({ type: 'set-agenda-draft', slots: agenda.slots });
    if (!draftResult.ok) {
      agendaFeedback = '当前步骤已经改变，请按新的修行步骤继续。';
      agendaFeedbackTone = 'error';
      renderPlanning();
      slotButtons[agendaDraft.selectedSlot]?.focus({ preventScroll: true });
      return;
    }
    const result = dispatchMachine({ type: 'submit-agenda' });
    if (result.ok) return;
    const agendaError = result.error.cause?.system === 'agenda' ? result.error.cause.error : null;
    agendaFeedback = agendaError ? cultivationAgendaErrorMessage(agendaError) : '日程结算未完成，请检查当前安排。';
    agendaFeedbackTone = 'error';
    if (agendaError?.slotIndex !== null && agendaError?.slotIndex !== undefined) {
      agendaDraft = selectCultivationAgendaSlot(agendaDraft, agendaError.slotIndex);
    }
    renderPlanning();
    slotButtons[agendaDraft.selectedSlot]?.focus({ preventScroll: true });
  }

  function concludeLifespan(): void {
    const result = dispatchMachine({ type: 'conclude-lifespan' });
    if (result.ok) return;
    agendaFeedback = result.error.code === 'lifespan-still-sufficient'
      ? '余寿尚能排满一轮最短日课；先把这一轮活完。'
      : '当前步骤已经改变，请按新的修行步骤继续。';
    agendaFeedbackTone = 'error';
    renderPlanning();
  }

  function enterTribulation(): void {
    destroyPhaseSurfaces();
    const interpretation = interpretCultivationTribulationTags([...machineState.tribulationTags, ...machineState.insightEffectTags]);
    preparation = deriveTribulationPreparation(machineState.runState, interpretation.preparationModifiers);
    const basePuzzle = createPuzzle(machineState.runState.stage, seedSalt);
    const prepared = applyPreparationToPuzzle(basePuzzle, preparation, interpretation.boardModifierTags);
    const puzzle = {
      ...prepared.state,
      moveBudget: prepared.state.moveBudget + preparation.moveBudgetBonus
    };
    preparedPuzzle = { ...prepared, state: puzzle };
    tribulationSession = createTribulationSession(puzzle, preparation);
    state = tribulationSession.puzzle;
    stage = machineState.runState.stage;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    tribulationFeedback = null;
    phase = 'tribulation';
    planning.hidden = true;
    phaseHost.hidden = true;
    tribulation.hidden = false;
    deadRun = false;
    lastScroll = null;
    showTribulationBoard();
  }

  function showTribulationBoard(): void {
    destroyPhaseSurfaces();
    phase = 'tribulation';
    planning.hidden = true;
    phaseHost.hidden = true;
    tribulation.hidden = false;
    audio?.setMusicContext?.('tribulation', 'tense');
    resizeCanvasForState();
    draw();
    syncHud();
    canvas.focus({ preventScroll: true });
  }

  function beginCultivationRun(salt: number): void {
    stage = 0;
    seedSalt = salt;
    state = createPuzzle(stage, seedSalt);
    const runState = createCultivationRunState({ seed: salt + 1 });
    machineState = createCultivationRunMachineState(runState);
    preparation = deriveTribulationPreparation(runState);
    preparedPuzzle = null;
    tribulationSession = null;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    tribulationFeedback = null;
    agendaDraft = createCultivationAgendaDraft();
    agendaCycleStartIndex = runState.agendaIndex;
    agendaTargetIndex = agendaCycleStartIndex + CULTIVATION_AGENDAS_BEFORE_TRIBULATION;
    machineState = { ...machineState, tribulationAgendaTarget: agendaTargetIndex };
    agendaFeedback = '先选中一格，再把活动写入竹简。活动会按从左到右的顺序结算。';
    agendaFeedbackTone = 'neutral';
    deadRun = false;
    lastScroll = null;
    pendingEpitaph = null;
    pendingLegacyCandidates = null;
    particles = [];
    shakeMag = 0;
    shakeTtl = 0;
    resizeCanvasForState();
    if (generation === 1) showOpening();
    else showLifeIntro();
  }

  function beginStagePlanning(nextStage: number, agendas = CULTIVATION_AGENDAS_BEFORE_TRIBULATION): void {
    stage = Math.max(0, nextStage);
    const runState = { ...machineState.runState, stage, status: 'active' as const };
    state = createPuzzle(stage, seedSalt);
    preparation = deriveTribulationPreparation(runState);
    preparedPuzzle = null;
    tribulationSession = null;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    tribulationFeedback = null;
    agendaDraft = createCultivationAgendaDraft();
    agendaCycleStartIndex = runState.agendaIndex;
    agendaTargetIndex = agendaCycleStartIndex + Math.max(1, agendas);
    machineState = {
      ...machineState,
      phase: 'planning',
      runState,
      agendaDraft: [],
      tribulationAgendaTarget: agendaTargetIndex,
      currentEvent: null,
      lastAgendaSlots: [],
      eventResolution: null,
      insightBudget: {
        ...machineState.insightBudget,
        agendaIndex: runState.agendaIndex,
        unlockedThisAgenda: 0
      }
    };
    deadRun = false;
    lastScroll = null;
    resizeCanvasForState();
    agendaFeedback = agendas === 1 ? '雷威已入体却不足以破境。你保住了性命，再补一轮日课后重新引劫。' : `第 ${stage + 1} 阶劫兆已至。先完成两轮日课，再引雷入体。`;
    agendaFeedbackTone = agendas === 1 ? 'error' : 'neutral';
    showOmen();
  }

  function resizeCanvasForState(): void {
    canvas.width = state.board.width * TILE;
    canvas.height = state.board.height * TILE;
  }

  function oneMoveOverloadPuzzle(): SokobanState {
    const width = 5;
    const height = 5;
    const terrain = new Array<SokobanState['board']['terrain'][number]>(width * height).fill('empty');
    const blocks = new Array<SokobanState['board']['blocks'][number]>(width * height).fill('none');
    terrain[0] = 'source';
    terrain[9] = 'herb';
    terrain[24] = 'body';
    blocks[3] = 'mirror';
    blocks[9] = 'conductor';
    blocks[14] = 'conductor';
    blocks[19] = 'conductor';
    const board: SokobanState['board'] = {
      width,
      height,
      terrain,
      blocks,
      sourcePos: { x: 0, y: 0 },
      sourceDir: 'right'
    };
    return {
      stage: 0,
      board,
      player: { x: 2, y: 0 },
      beam: traceBeam(board),
      scorched: new Array<boolean>(width * height).fill(false),
      herbsTotal: 1,
      moveBudget: 5,
      movesUsed: 0,
      status: 'playing'
    };
  }

  function cultivationBrowserTestSnapshot(): CultivationBrowserTestSnapshot {
    return {
      phase,
      machinePhase: machineState.phase,
      outcome: tribulationOutcome?.result ?? null,
      fatal: tribulationOutcome?.fatal ?? false,
      deathPrevented: tribulationOutcome?.deathPrevented ?? false,
      settlementApplied,
      runStatus: machineState.runState.status,
      herbs: machineState.runState.herbs,
      pills: machineState.runState.pills,
      legacyReady: pendingEpitaph !== null && pendingLegacyCandidates !== null,
      generation,
      stage: machineState.runState.stage,
      settlementKind: lastSettlement?.kind ?? null
    };
  }

  function configureCultivationOverloadKeypoint(withWardPill = false): CultivationBrowserTestSnapshot {
    const runState = createCultivationRunState({
      seed: 27_001,
      overrides: {
        lifespanRemainingDays: 720,
        bodyFoundation: 0,
        endurance: 0,
        willpower: 0,
        pillPoison: 0,
        heavenDebt: 0,
        daoAttention: 0,
        pressure: 0,
        mortalHeart: 0,
        insight: 0,
        injury: 0,
        herbs: 1,
        food: 1,
        spiritStones: 0,
        pills: withWardPill ? 1 : 0
      }
    });
    machineState = {
      ...createCultivationRunMachineState(runState),
      phase: 'tribulation',
      tribulationAgendaTarget: 0
    };
    stage = 0;
    preparation = deriveTribulationPreparation(runState);
    const puzzle = oneMoveOverloadPuzzle();
    preparedPuzzle = {
      state: puzzle,
      preparedHerbIndices: [9],
      inventoryHerbIndices: [9],
      eventHerbIndices: [],
      placedBlockKinds: [],
      appliedBoardModifierTags: [],
      ignoredBoardModifierTags: []
    };
    tribulationSession = createTribulationSession(puzzle, preparation);
    state = tribulationSession.puzzle;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    tribulationFeedback = null;
    pendingEpitaph = null;
    pendingLegacyCandidates = null;
    deadRun = false;
    lastScroll = null;
    destroyPhaseSurfaces();
    phase = 'tribulation';
    planning.hidden = true;
    phaseHost.hidden = true;
    tribulation.hidden = false;
    audio?.setMusicContext?.('tribulation', 'tense');
    resizeCanvasForState();
    draw();
    syncHud();
    canvas.focus({ preventScroll: true });
    return cultivationBrowserTestSnapshot();
  }

  function configureCultivationPlanningKeypoint(mode: 'default' | 'pressure' = 'default'): CultivationBrowserTestSnapshot {
    stage = 0;
    seedSalt = 0;
    const runState = createCultivationRunState({
      seed: 27_002,
      ...(mode === 'pressure' ? { overrides: { pressure: 79, mortalHeart: 30 } } : {})
    });
    machineState = createCultivationRunMachineState(runState);
    agendaCycleStartIndex = runState.agendaIndex;
    agendaTargetIndex = agendaCycleStartIndex + CULTIVATION_AGENDAS_BEFORE_TRIBULATION;
    machineState = { ...machineState, tribulationAgendaTarget: agendaTargetIndex };
    state = createPuzzle(stage, seedSalt);
    preparation = deriveTribulationPreparation(runState);
    preparedPuzzle = null;
    tribulationSession = null;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    tribulationFeedback = null;
    pendingEpitaph = null;
    pendingLegacyCandidates = null;
    deadRun = false;
    lastScroll = null;
    agendaDraft = createCultivationAgendaDraft();
    agendaFeedback = mode === 'pressure' ? '心压已逼近临界。安排顺序会立即改变后续格效率。' : '测试同一开局下的日程顺序。';
    agendaFeedbackTone = 'neutral';
    resizeCanvasForState();
    showPlanning();
    return cultivationBrowserTestSnapshot();
  }

  function configureCultivationLifespanKeypoint(): CultivationBrowserTestSnapshot {
    stage = 2;
    seedSalt = 0;
    const runState = createCultivationRunState({
      seed: 27_003,
      overrides: {
        stage,
        lifespanRemainingDays: 41,
        herbs: 2,
        food: 2,
        insight: 4
      }
    });
    machineState = createCultivationRunMachineState(runState);
    agendaCycleStartIndex = runState.agendaIndex;
    agendaTargetIndex = agendaCycleStartIndex + CULTIVATION_AGENDAS_BEFORE_TRIBULATION;
    machineState = { ...machineState, tribulationAgendaTarget: agendaTargetIndex };
    state = createPuzzle(stage, seedSalt);
    preparation = deriveTribulationPreparation(runState);
    preparedPuzzle = null;
    tribulationSession = null;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    pendingEpitaph = null;
    pendingLegacyCandidates = null;
    deadRun = false;
    lastScroll = null;
    agendaDraft = createCultivationAgendaDraft();
    agendaFeedback = '余寿已不足再排满一轮；此世只能封卷。';
    agendaFeedbackTone = 'error';
    resizeCanvasForState();
    showPlanning();
    return cultivationBrowserTestSnapshot();
  }

  function configureCultivationAscensionKeypoint(): CultivationBrowserTestSnapshot {
    stage = CULTIVATION_FINAL_STAGE;
    seedSalt = 0;
    const runState = createCultivationRunState({
      seed: 27_004,
      overrides: {
        stage,
        lifespanRemainingDays: 360,
        bodyFoundation: 10_000,
        endurance: 10_000,
        willpower: 0,
        pressure: 0,
        mortalHeart: 80,
        herbs: 1,
        food: 1,
        pills: 0
      }
    });
    machineState = {
      ...createCultivationRunMachineState(runState),
      phase: 'tribulation',
      tribulationAgendaTarget: 0,
      settledAgendaCount: 12
    };
    const basePreparation = deriveTribulationPreparation(runState);
    preparation = {
      ...basePreparation,
      minTemperingPower: 0,
      maxSurvivablePower: 10_000,
      sweetSpotMinPower: 0,
      sweetSpotMaxPower: 10_000
    };
    const basePuzzle = oneMoveOverloadPuzzle();
    const puzzle = { ...basePuzzle, stage };
    preparedPuzzle = {
      state: puzzle,
      preparedHerbIndices: [9],
      inventoryHerbIndices: [9],
      eventHerbIndices: [],
      placedBlockKinds: [],
      appliedBoardModifierTags: [],
      ignoredBoardModifierTags: []
    };
    tribulationSession = createTribulationSession(puzzle, preparation);
    state = tribulationSession.puzzle;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    pendingEpitaph = null;
    pendingLegacyCandidates = null;
    deadRun = false;
    lastScroll = null;
    destroyPhaseSurfaces();
    phase = 'tribulation';
    planning.hidden = true;
    phaseHost.hidden = true;
    tribulation.hidden = false;
    audio?.setMusicContext?.('tribulation', 'tense');
    resizeCanvasForState();
    draw();
    syncHud();
    canvas.focus({ preventScroll: true });
    return cultivationBrowserTestSnapshot();
  }

  const browserTestTarget = window as typeof window & {
    __AEON_TEST__?: CultivationBrowserTestApi;
  };

  function installCultivationBrowserTestHooks(): void {
    if (import.meta.env.VITE_PRESERVE_DRAWING_BUFFER !== 'true') return;
    browserTestTarget.__AEON_TEST__ = {
      ...(browserTestTarget.__AEON_TEST__ ?? {}),
      configureCultivationOverloadKeypoint,
      configureCultivationPlanningKeypoint,
      configureCultivationLifespanKeypoint,
      configureCultivationAscensionKeypoint,
      cultivationSnapshot: cultivationBrowserTestSnapshot
    };
  }

  function uninstallCultivationBrowserTestHooks(): void {
    const current = browserTestTarget.__AEON_TEST__;
    if (!current) return;
    const next = { ...current } as Record<string, unknown>;
    if (next.configureCultivationOverloadKeypoint === configureCultivationOverloadKeypoint) {
      delete next.configureCultivationOverloadKeypoint;
    }
    if (next.configureCultivationPlanningKeypoint === configureCultivationPlanningKeypoint) {
      delete next.configureCultivationPlanningKeypoint;
    }
    if (next.configureCultivationLifespanKeypoint === configureCultivationLifespanKeypoint) {
      delete next.configureCultivationLifespanKeypoint;
    }
    if (next.configureCultivationAscensionKeypoint === configureCultivationAscensionKeypoint) {
      delete next.configureCultivationAscensionKeypoint;
    }
    if (next.cultivationSnapshot === cultivationBrowserTestSnapshot) {
      delete next.cultivationSnapshot;
    }
    browserTestTarget.__AEON_TEST__ = next;
  }

  function center(x: number, y: number): { cx: number; cy: number } {
    return { cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 };
  }

  function bodyCenter(): { cx: number; cy: number } {
    const b = state.board;
    const i = b.terrain.findIndex(t => t === 'body');
    if (i < 0) return center(state.player.x, state.player.y);
    return center(i % b.width, Math.floor(i / b.width));
  }

  // —— P3 stand-in 精灵：异步加载，加载到即 redraw 替换色块（失败/未到则回退色块，不阻断）——
  const sprites: { floor: HTMLImageElement | null; wall: HTMLImageElement | null; herb: HTMLImageElement | null; mirror: HTMLImageElement | null } = {
    floor: null,
    wall: null,
    herb: null,
    mirror: null
  };
  function loadSprite(key: 'floor' | 'wall' | 'herb' | 'mirror', id: string): void {
    const url = assetUrlForId?.(id);
    if (!url) return;
    const img = new Image();
    img.onload = (): void => {
      sprites[key] = img;
      draw();
    };
    img.onerror = (): void => {
      sprites[key] = null;
    };
    img.src = url;
  }
  function drawTileSprite(img: HTMLImageElement | null, px: number, py: number, fallback: string): void {
    if (img && ctx) ctx.drawImage(img, px, py, TILE, TILE);
    else if (ctx) {
      ctx.fillStyle = fallback;
      ctx.fillRect(px, py, TILE, TILE);
    }
  }

  // —— juice：粒子 + 震屏（reduced-motion 降级）——
  function spawnBurst(cx: number, cy: number, colors: readonly string[], count: number): void {
    if (reduceFx) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.5,
        ttl: 30 + Math.floor(Math.random() * 22),
        color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0]!,
        size: 2 + Math.random() * 2.5
      });
    }
    ensureEffectsRaf();
  }

  function triggerShake(mag: number): void {
    if (reduceFx) return;
    shakeMag = Math.max(shakeMag, mag);
    shakeTtl = Math.max(shakeTtl, 12);
    ensureEffectsRaf();
  }

  function ensureEffectsRaf(): void {
    if (!effectsRaf && !destroyed) effectsRaf = window.requestAnimationFrame(effectsFrame);
  }

  function effectsFrame(): void {
    effectsRaf = 0;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.vx *= 0.96;
      p.ttl -= 1;
    }
    particles = particles.filter(p => p.ttl > 0);
    if (shakeTtl > 0) {
      shakeTtl -= 1;
      if (shakeTtl === 0) shakeMag = 0;
    }
    draw();
    if (particles.length > 0 || shakeTtl > 0) ensureEffectsRaf();
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 先清全幅（不偏移），再 save+平移画内容，震屏时露出底色
    ctx.save();
    if (shakeTtl > 0 && shakeMag > 0) {
      ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    }
    const b = state.board;

    // 地形
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const i = y * b.width + x;
        const terrain = b.terrain[i] ?? 'empty';
        const px = x * TILE;
        const py = y * TILE;
        drawTileSprite(terrain === 'wall' ? sprites.wall : sprites.floor, px, py, TERRAIN_FILL[terrain] ?? P.floor);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        if (terrain === 'source') {
          const { cx, cy } = center(x, y);
          ctx.fillStyle = P.beamGlow;
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (terrain === 'body') {
          const { cx, cy } = center(x, y);
          ctx.strokeStyle = P.goalBody;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, TILE * 0.28, 0, Math.PI * 2);
          ctx.stroke();
        } else if (terrain === 'herb') {
          const { cx, cy } = center(x, y);
          if (sprites.herb && ctx) {
            const s = TILE * 0.7;
            ctx.drawImage(sprites.herb, cx - s / 2, cy - s / 2, s, s);
          } else {
            ctx.fillStyle = P.herbLight;
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (state.scorched[i]) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }

    // 雷光路径：青蓝外辉光 + 暖白核心线，避免与黄褐棋盘及金阵石混淆。
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = P.boltBlue;
    for (const c of state.beam.cells) {
      ctx.fillRect(c.x * TILE, c.y * TILE, TILE, TILE);
    }
    ctx.restore();
    if (state.beam.cells.length > 0) {
      ctx.strokeStyle = P.boltBlue;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.shadowColor = P.boltBlue;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const src = center(b.sourcePos.x, b.sourcePos.y);
      ctx.moveTo(src.cx, src.cy);
      for (const c of state.beam.cells) {
        const m = center(c.x, c.y);
        ctx.lineTo(m.cx, m.cy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = P.bodyAlive;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 可推阵石
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const block = b.blocks[y * b.width + x] ?? 'none';
        if (block === 'none') continue;
        const { cx, cy } = center(x, y);
        const half = TILE * 0.28;
        if (block === 'mirror') {
          if (sprites.mirror && ctx) {
            const s = half * 2;
            ctx.drawImage(sprites.mirror, cx - half, cy - half, s, s);
          } else {
            ctx.fillStyle = P.mirrorGold;
            ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
            ctx.strokeStyle = P.bodyStroke;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - half, cy - half);
            ctx.lineTo(cx + half, cy + half);
            ctx.stroke();
          }
        } else if (block === 'conductor') {
          ctx.fillStyle = P.conductorBlue;
          ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
        } else if (block === 'insulator') {
          ctx.fillStyle = P.insulatorPurple;
          ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
          ctx.strokeStyle = P.bodyStroke;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - half, cy - half);
          ctx.lineTo(cx + half, cy + half);
          ctx.moveTo(cx + half, cy - half);
          ctx.lineTo(cx - half, cy + half);
          ctx.stroke();
        }
      }
    }

    // 玩家
    const { cx: pcx, cy: pcy } = center(state.player.x, state.player.y);
    ctx.fillStyle = state.status === 'lost' ? P.bodyDead : P.bodyAlive;
    ctx.beginPath();
    ctx.arc(pcx, pcy, TILE * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.bodyStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 粒子（juice）
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / 30));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function helpText(): string {
    if (tribulationFeedback) return tribulationFeedback;
    if (tribulationOutcome) {
      const suffix = lastScroll ? `<br>📜 <b>${lastScroll.title}</b><br>${lastScroll.body}` : '';
      if (tribulationOutcome.deathPrevented) {
        return `<b>护脉丹在最后一刻护住了性命。</b>此劫未能破境，补修一轮后再来。${suffix}`;
      }
      switch (tribulationOutcome.result) {
        case 'insufficient':
          return `<b>雷光入体，却不足以破境。</b>你保住了性命，可以补修一轮后再来。雷威 ${tribulationOutcome.beamPower}。`;
        case 'perfect':
          return lastSettlement?.kind === 'ascended'
            ? `<b>终劫归一，凡骨没有化灰。</b>雷威 ${tribulationOutcome.beamPower}。${suffix}`
            : `<b>雷威正落甜蜜区，完美淬体！</b>雷威 ${tribulationOutcome.beamPower}。${suffix}`;
        case 'survived':
          return `<b>勉强承住雷威，带伤突破。</b>雷威 ${tribulationOutcome.beamPower}，伤势 ${tribulationOutcome.bodyDamage}。${suffix}`;
        case 'overload':
          return `<b>雷威越过肉身上限，灰飞烟灭。</b>雷威 ${tribulationOutcome.beamPower}，安全上限 ${preparation.maxSurvivablePower}。${suffix}`;
        case 'timeout':
          return `<b>步数耗尽，天道强制落雷。</b>这一世化作劫灰。${suffix}`;
        case 'unreached':
          break;
      }
    }
    switch (state.status) {
      case 'playing':
        return '推 <b>金阵石(金)</b> 折射雷光、<b>绝缘石(紫)</b> 阻断、<b>水阵石(蓝)</b> 直通。把雷光导进 <b>身体(青环)</b> 即渡劫；别烧到 <b>灵草(绿)</b>。<kbd>方向键/WASD</kbd> 推、<kbd>R</kbd> 消耗丹药撤步，必要时先启用护脉丹。';
      case 'won':
        return `<b>雷光入体，淬体突破！</b>${lastScroll ? `<br>📜 <b>${lastScroll.title}</b><br>${lastScroll.body}` : ''}`;
      case 'lost':
        return `<b>灰飞烟灭——逆之灰烬传承，境界归零，残卷犹在。</b>${lastScroll ? `<br>📜 <b>${lastScroll.title}</b><br>${lastScroll.body}` : ''}`;
      default:
        return '';
    }
  }

  let lastStatus: SokobanState['status'] | null = null;
  let lastOutcomeResult: TribulationSessionOutcome['result'] | null = null;
  function syncHud(): void {
    stageEl.textContent = cultivationStageLabel(stage);
    movesEl.textContent = `步数 ${state.movesUsed}/${state.moveBudget}`;
    herbsEl.textContent = `灵草 ${herbsAliveOf(state)}/${state.herbsTotal}`;
    const session = tribulationSession;
    const intel = preparation.previewLevel <= 0 ? '劫兆未明' : preparation.previewLevel === 1 ? `存活上限 ≤${preparation.maxSurvivablePower}` : preparation.previewLevel === 2 ? `安全雷威 ${preparation.minTemperingPower}–${preparation.maxSurvivablePower}` : `甜蜜雷威 ${preparation.sweetSpotMinPower}–${preparation.sweetSpotMaxPower}`;
    preparationEl.textContent = `${intel} · 预见 ${preparation.previewLevel} · 护持 ${session?.wardChargesRemaining ?? 0} · 撤步 ${session?.undoChargesRemaining ?? 0}`;
    metaEl.textContent = `残卷 ${meta.unlockedScrolls.length}/${SCROLL_TOTAL} · 灰烬 ${meta.deathCount} · 突破 ${meta.breakthroughs}`;
    const outcomeLabel = lastSettlement?.kind === 'ascended' ? { label: '归一飞升', cls: 'ok' } : tribulationOutcome?.deathPrevented ? { label: '护脉保命', cls: 'ok' } : tribulationOutcome?.result === 'perfect' ? { label: '完美淬体', cls: 'ok' } : tribulationOutcome?.result === 'survived' ? { label: '带伤突破', cls: 'ok' } : tribulationOutcome?.result === 'insufficient' ? { label: '劫力不足', cls: 'bad' } : tribulationOutcome?.result === 'overload' ? { label: '雷威过载', cls: 'bad' } : tribulationOutcome?.result === 'timeout' ? { label: '步数耗尽', cls: 'bad' } : null;
    if (!outcomeLabel && state.status === 'playing') {
      statusEl.textContent = '';
    } else if (outcomeLabel) {
      statusEl.innerHTML = `<span class="rp-outcome ${outcomeLabel.cls}">${outcomeLabel.label}</span>`;
    }
    if (state.status !== lastStatus || tribulationOutcome?.result !== lastOutcomeResult) {
      lastStatus = state.status;
      lastOutcomeResult = tribulationOutcome?.result ?? null;
      help.innerHTML = helpText();
    }
    retryBtn.disabled = Boolean(!session || session.outcome || session.undoChargesRemaining <= 0 || session.undoSnapshots.length === 0);
    rerollBtn.disabled = Boolean(!session || session.outcome || session.wardChargesRemaining <= 0);
    rerollBtn.textContent = session?.wardEnabled ? '护脉丹：已启用' : '护脉丹：未启用';
    if (deadRun) {
      nextBtn.textContent = '立劫灰碑记 →';
      nextBtn.disabled = !settlementApplied;
    } else if (lastSettlement?.kind === 'ascended') {
      nextBtn.textContent = '查看归一终局 →';
      nextBtn.disabled = !settlementApplied;
    } else if (tribulationOutcome?.deathPrevented) {
      nextBtn.textContent = '护脉保命·补修一轮';
      nextBtn.disabled = !settlementApplied;
    } else if (tribulationOutcome?.result === 'insufficient') {
      nextBtn.textContent = '劫力不足·补修一轮';
      nextBtn.disabled = !settlementApplied;
    } else if (tribulationOutcome?.result === 'perfect' || tribulationOutcome?.result === 'survived') {
      nextBtn.textContent = '下一阶·先修日课 →';
      nextBtn.disabled = !settlementApplied || !isStageUnlocked(meta, stage + 1);
    } else {
      nextBtn.textContent = '下一阶 →';
      nextBtn.disabled = true;
    }
    persistJourney();
  }

  function preparedInventoryHerbsScorched(): number {
    if (!preparedPuzzle) return 0;
    return preparedPuzzle.inventoryHerbIndices.reduce((sum, index) => sum + (state.scorched[index] ? 1 : 0), 0);
  }

  function settleTribulationOutcome(): void {
    if (!tribulationOutcome || settlementApplied) return;
    const herbLoss = preparedInventoryHerbsScorched();
    const result = applyCultivationTribulationOutcome({
      state: machineState.runState,
      outcome: tribulationOutcome,
      preparedHerbsScorched: herbLoss
    });
    if (!result.ok) {
      tribulationFeedback = '<b>天劫结算未能回写。</b>请返回标题后重新进入，避免污染这一世的记录。';
      return;
    }
    settlementApplied = true;
    lastSettlement = result.settlement;
    machineState = { ...machineState, runState: result.state };
    deadRun = result.settlement.kind === 'death';

    if (result.settlement.kind === 'breakthrough' || result.settlement.kind === 'ascended') {
      const r = recordBreakthrough(meta, state.stage);
      meta = r.meta;
      saveMeta(meta);
      lastScroll = r.unlockedScroll;
      audio?.playSfx?.('breakthrough');
      const bc = bodyCenter();
      spawnBurst(bc.cx, bc.cy, [P.beamGlow, P.goalBody, P.accent], 26);
      triggerShake(4);
    } else if (result.settlement.kind === 'death') {
      state.status = 'lost';
      const r = recordDeath(meta, state.stage);
      meta = r.meta;
      saveMeta(meta);
      lastScroll = r.unlockedScroll;
      audio?.playSfx?.('explosion');
      const pc = center(state.player.x, state.player.y);
      spawnBurst(pc.cx, pc.cy, [P.bodyDead, P.badText], 30);
      triggerShake(7);
      pendingEpitaph = createCultivationAshEpitaph({
        identity: currentLifeIdentity(),
        highestStage: stage,
        conclusion: {
          kind: 'death',
          cause: tribulationOutcome.result === 'timeout' ? 'tribulation-timeout' : 'tribulation-overload'
        },
        activityCounts: machineState.activityCounts,
        eventHistoryTags: machineState.eventHistoryTags,
        unlockedKnowledgeNodeIds: machineState.insightNodeIds,
        herbsScorched: herbLoss,
        herbsPreserved: machineState.runState.herbs,
        representativeHerb: machineState.runState.herbs > 0 ? '引雷草' : null
      });
      pendingLegacyCandidates = deriveCultivationLegacyCandidates(pendingEpitaph);
    } else {
      audio?.playSfx?.('ui-confirm');
    }
  }

  function syncTribulationSession(nextSession: TribulationSessionState): void {
    const hadOutcome = tribulationOutcome !== null;
    tribulationSession = nextSession;
    tribulationOutcome = nextSession.outcome;
    state = tribulationOutcome?.fatal ? { ...nextSession.puzzle, status: 'lost' } : tribulationOutcome?.deathPrevented ? { ...nextSession.puzzle, status: 'won' } : nextSession.puzzle;
    tribulationFeedback = null;
    if (!hadOutcome && tribulationOutcome) settleTribulationOutcome();
    draw();
    syncHud();
  }

  function tryMove(dir: Dir): void {
    if (phase !== 'tribulation' || !tribulationSession || tribulationSession.outcome) return;
    const result = transitionTribulationSession(tribulationSession, { type: 'move', dir });
    if (!result.ok) {
      tribulationFeedback = result.error.code === 'move-rejected' ? '这个方向走不通，换一条路。' : '天劫已经结算，不能继续移动。';
      help.innerHTML = helpText();
      return;
    }
    syncTribulationSession(result.state);
  }

  function useUndo(): void {
    if (!tribulationSession) return;
    const result = transitionTribulationSession(tribulationSession, { type: 'undo' });
    if (!result.ok) {
      tribulationFeedback = result.error.code === 'no-undo-snapshot' ? '还没有可撤回的一步。' : '撤步丹药已经用尽。';
      help.innerHTML = helpText();
      return;
    }
    syncTribulationSession(result.state);
    canvas.focus({ preventScroll: true });
  }

  function toggleWard(): void {
    if (!tribulationSession) return;
    const result = transitionTribulationSession(tribulationSession, {
      type: 'set-ward',
      enabled: !tribulationSession.wardEnabled
    });
    if (!result.ok) {
      tribulationFeedback = '没有可用的护脉丹。';
      help.innerHTML = helpText();
      return;
    }
    syncTribulationSession(result.state);
    canvas.focus({ preventScroll: true });
  }

  function inheritedEffectTags(nodeIds: readonly string[]): CultivationRunMachineState['insightEffectTags'] {
    const inherited = new Set(nodeIds);
    return CULTIVATION_INSIGHT_NODES.flatMap(node => (inherited.has(node.id) ? [...node.effectTags] : []));
  }

  function acceptLegacy(selection: CultivationLegacySelection): void {
    if (!pendingEpitaph) return;
    const heirSeed = seedSalt + 2;
    const result = transitionToHeir({
      previousState: machineState.runState,
      epitaph: pendingEpitaph,
      selection,
      heirIdentity: {
        name: `后来人·第${generation + 1}世`,
        portraitId: 'portrait.player-default-v1'
      },
      heirSeed
    });
    if (!result.ok) return;

    generation += 1;
    seedSalt += 1;
    stage = 0;
    state = createPuzzle(stage, seedSalt);
    const nextMachine = createCultivationRunMachineState(result.state);
    machineState = {
      ...nextMachine,
      insightNodeIds: [...result.legacy.inheritedKnowledgeNodeIds],
      insightEffectTags: inheritedEffectTags(result.legacy.inheritedKnowledgeNodeIds)
    };
    preparation = deriveTribulationPreparation(result.state);
    preparedPuzzle = null;
    tribulationSession = null;
    tribulationOutcome = null;
    settlementApplied = false;
    lastSettlement = null;
    pendingEpitaph = null;
    pendingLegacyCandidates = null;
    agendaDraft = createCultivationAgendaDraft();
    agendaCycleStartIndex = result.state.agendaIndex;
    agendaTargetIndex = agendaCycleStartIndex + CULTIVATION_AGENDAS_BEFORE_TRIBULATION;
    machineState = { ...machineState, tribulationAgendaTarget: agendaTargetIndex };
    agendaFeedback = '前人的一页批注与一件旧物已经交到手中。请写下这一世的第一轮日课。';
    agendaFeedbackTone = 'success';
    deadRun = false;
    lastScroll = null;
    resizeCanvasForState();
    showLifeIntro();
  }

  function prepareLifespanLegacy(): void {
    if (pendingEpitaph && pendingLegacyCandidates) return;
    pendingEpitaph = createCultivationAshEpitaph({
      identity: currentLifeIdentity(),
      highestStage: machineState.runState.stage,
      conclusion: { kind: 'death', cause: 'lifespan-ended' },
      activityCounts: machineState.activityCounts,
      eventHistoryTags: machineState.eventHistoryTags,
      unlockedKnowledgeNodeIds: machineState.insightNodeIds,
      herbsScorched: 0,
      herbsPreserved: machineState.runState.herbs,
      representativeHerb: machineState.runState.herbs > 0 ? '引雷草' : null
    });
    pendingLegacyCandidates = deriveCultivationLegacyCandidates(pendingEpitaph);
    deadRun = true;
  }

  function showLegacy(): void {
    if (!pendingEpitaph || !pendingLegacyCandidates) return;
    destroyPhaseSurfaces();
    phase = 'legacy';
    planning.hidden = true;
    tribulation.hidden = true;
    phaseHost.hidden = false;
    const lifespanDeath = pendingEpitaph.conclusion.kind === 'death'
      && pendingEpitaph.conclusion.cause === 'lifespan-ended';
    legacySurface = createCultivationLegacySurface({
      root: phaseHost,
      epitaph: pendingEpitaph,
      candidates: pendingLegacyCandidates,
      portraitUrl: assetUrlForId?.(pendingEpitaph.identity.portraitId),
      epitaphArtUrl: assetUrlForId?.(lifespanDeath
        ? 'cg.first-person.ending.lifespan-death-v2'
        : 'cg.first-person.ending.tribulation-death-v2'),
      onConfirm: acceptLegacy
    });
    legacySurface.focusInitial();
    persistJourney();
  }

  function showCultivationEnding(): void {
    const identity = currentLifeIdentity();
    mountInterlude('ending', () => createCultivationEndingSurface({
      root: phaseHost,
      view: {
        kind: 'ascended',
        identityName: identity.name,
        title: '一世日课，终于留下了没有化灰的身体',
        epilogue: '察漏、引路、借势、淬骨、守我、归一。你不是把凡人的一生抹去，而是让每一格用余寿换来的选择都随身体一起越过了天门。',
        records: [
          { label: '传承世代', value: `第 ${generation} 世` },
          { label: '最高境阶', value: cultivationStageLabel(machineState.runState.stage), tone: 'good' },
          { label: '结局余寿', value: `${machineState.runState.lifespanRemainingDays} 日`, tone: 'warning' },
          { label: '日课总轮', value: `${machineState.settledAgendaCount} 轮` }
        ],
        closingLines: [
          '第一次，劫灰碑没有等到新的名字。',
          '雷声之外的人间并未消失；它被完整地带到了天门另一边。'
        ]
      },
      artwork: {
        assetId: 'cg.first-person.ending.ascension-v2',
        url: assetUrlForId?.('cg.first-person.ending.ascension-v2'),
        alt: `${identity.name}穿过紫雷后的飞升留影`,
        caption: '这一回，身体与道统一同越过了天门'
      },
      onReturnToTitle,
      onBeginAnotherLife: () => {
        generation += 1;
        seedSalt += 1;
        beginCultivationRun(seedSalt);
      }
    }));
  }

  function showAftermath(): void {
    if (!lastSettlement || !tribulationOutcome) return;
    const settlement = lastSettlement;
    const outcome = tribulationOutcome;
    if (settlement.kind === 'death') {
      showLegacy();
      return;
    }

    const isAscension = settlement.kind === 'ascended';
    const isBreakthrough = settlement.kind === 'breakthrough' || isAscension;
    const kind = isBreakthrough
      ? 'breakthrough'
      : settlement.kind === 'death-prevented'
        ? 'recovery'
        : 'repelled';
    const title = isAscension
      ? '归一境成，凡骨没有化灰'
      : settlement.kind === 'breakthrough'
        ? `破入${cultivationStageLabel(settlement.stageAfter)}`
        : settlement.kind === 'death-prevented'
          ? '护脉留住了这一世'
          : '雷威退去，境界仍在原处';
    const detail = isAscension
      ? '终劫已经结算：身体、记忆与未尽的人间牵挂都留了下来。'
      : settlement.kind === 'breakthrough'
        ? '成功不是清零。伤势、丹毒与库存损耗仍会进入下一境的第一轮日课。'
        : settlement.kind === 'death-prevented'
          ? '护持替你挡住了致命一刻，但伤势和消耗都是真的；下一轮必须为活下来付账。'
          : '这次雷威不足以破境。已得的淬体与已失的资源都不会回滚。';
    const nextActionLabel = isAscension
      ? '越过天门，见证终局'
      : settlement.kind === 'breakthrough'
        ? '读取下一境劫兆'
        : '带着结果补修一轮';

    mountInterlude('aftermath', () => createCultivationAftermathSurface({
      root: phaseHost,
      view: {
        kind,
        stageLabel: cultivationStageLabel(settlement.stageAfter),
        title,
        detail,
        consequences: [
          { label: '雷威结果', value: `${outcome.beamPower} · ${tribulationResultLabel(outcome.result)}` },
          { label: '境阶变化', value: isAscension ? `${cultivationStageLabel(settlement.stageBefore)} → 飞升` : `${cultivationStageLabel(settlement.stageBefore)} → ${cultivationStageLabel(settlement.stageAfter)}`, tone: isBreakthrough ? 'good' : 'neutral' },
          { label: '身体代价', value: `伤势 +${settlement.injuryGained} · 淬体 +${settlement.temperingGained}`, tone: settlement.injuryGained > 0 ? 'warning' : 'good' },
          { label: '库存代价', value: `灵草 −${settlement.herbsLost} · 丹药 −${settlement.pillsConsumed}` },
          { label: '争回余寿', value: `+${settlement.lifespanGained} 日`, tone: settlement.lifespanGained > 0 ? 'good' : 'neutral' }
        ],
        rememberedMoments: lastScroll ? [`残卷新解：「${lastScroll.title}」`] : [],
        nextActionLabel
      },
      artwork: {
        assetId: isAscension ? 'cg.first-person.ending.ascension-v2' : kind === 'breakthrough' ? 'cg.first-person.tribulation.purple-v2' : kind === 'recovery' ? 'cg.first-person.scene.spirit-farm-v2' : 'cg.first-person.scene.farm-autumn-v2',
        url: assetUrlForId?.(isAscension ? 'cg.first-person.ending.ascension-v2' : kind === 'breakthrough' ? 'cg.first-person.tribulation.purple-v2' : kind === 'recovery' ? 'cg.first-person.scene.spirit-farm-v2' : 'cg.first-person.scene.farm-autumn-v2'),
        alt: `${title}后的劫场余景`,
        caption: isAscension ? '雷光尽处，这一次没有留下劫灰' : '结算写下的每一笔都会进入下一轮'
      },
      onContinue: () => {
        if (isAscension) {
          showCultivationEnding();
          return;
        }
        beginStagePlanning(machineState.runState.stage, settlement.kind === 'breakthrough' ? CULTIVATION_AGENDAS_BEFORE_TRIBULATION : 1);
      }
    }));
  }

  function advanceAfterTribulation(): void {
    if (!settlementApplied) return;
    showAftermath();
  }

  const onPlanningKeyDown = (event: KeyboardEvent): void => {
    if (phase !== 'planning' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^[1-6]$/.test(event.key)) {
      const activity = activityPresentations[Number(event.key) - 1];
      if (activity) {
        event.preventDefault();
        chooseActivity(activity.id);
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      agendaDraft = clearSelectedCultivationActivity(agendaDraft);
      agendaFeedback = `第 ${agendaDraft.selectedSlot + 1} 格已清空。`;
      agendaFeedbackTone = 'neutral';
      renderPlanning();
      slotButtons[agendaDraft.selectedSlot]?.focus({ preventScroll: true });
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('.rp-agenda-slot') : null;
    if (!target) return;
    const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const forwards = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    if (!backwards && !forwards) return;
    event.preventDefault();
    const delta = backwards ? -1 : 1;
    const next = (agendaDraft.selectedSlot + delta + agendaDraft.slots.length) % agendaDraft.slots.length;
    agendaDraft = selectCultivationAgendaSlot(agendaDraft, next);
    renderPlanning();
    slotButtons[next]?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const k = event.key;
    if (k === 'r' || k === 'R') {
      event.preventDefault();
      useUndo();
      return;
    }
    if (tribulationOutcome && (k === ' ' || k === 'Enter')) {
      event.preventDefault();
      advanceAfterTribulation();
      return;
    }
    if (phase !== 'tribulation' || state.status !== 'playing') return;
    switch (k) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        event.preventDefault();
        tryMove('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        event.preventDefault();
        tryMove('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        event.preventDefault();
        tryMove('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        event.preventDefault();
        tryMove('right');
        break;
      default:
        break;
    }
  };

  function start(): void {
    canvas.addEventListener('keydown', onKeyDown);
    planning.addEventListener('keydown', onPlanningKeyDown);
    installCultivationBrowserTestHooks();
    loadSprite('floor', 'tile.loam');
    loadSprite('wall', 'tile.rock');
    loadSprite('herb', 'inventory-icon.herb.balmleaf-v1');
    loadSprite('mirror', 'icon.item.array-core');
    if (opts.startMode === 'continue') {
      const saved = loadCultivationJourney<unknown>();
      if (isJourneySnapshot(saved)) {
        restoreJourney(saved);
        return;
      }
    }
    clearCultivationJourney();
    opts.onSaveAvailabilityChange?.(false);
    openingBeatIndex = 0;
    generation = 1;
    beginCultivationRun(seedSalt);
  }

  function destroy(): void {
    if (destroyed) return;
    persistJourney();
    destroyed = true;
    if (effectsRaf) window.cancelAnimationFrame(effectsRaf);
    effectsRaf = 0;
    destroyPhaseSurfaces();
    canvas.removeEventListener('keydown', onKeyDown);
    planning.removeEventListener('keydown', onPlanningKeyDown);
    uninstallCultivationBrowserTestHooks();
    root.innerHTML = '';
  }

  return { start, destroy };
}
