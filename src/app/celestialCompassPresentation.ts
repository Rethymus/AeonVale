/**
 * 天象因果链罗盘（P2-3）：把「远方天象 → 农庄后果 → 近期预兆」压缩成常驻小卡。
 *
 * 纯展示层：只吃 activeEvent / beastSurge / upcoming calendar 的已派生原语，
 * 不新增 sim 字段、不改随机、不影响存档/回放。
 */
import type { CelestialType } from '@content/defs';

export type CelestialCompassTone = 'calm' | 'opportunity' | 'warning' | 'critical';

export interface CelestialCompassEventInput {
  id: string;
  displayName: string;
  type?: CelestialType;
  daysLeft: number;
  growthMod: number;
  qiMod: number;
  desc?: string;
}

export interface CelestialCompassUpcomingInput {
  id: string;
  title: string;
  daysFromNow?: number;
  kind: string;
  description?: string;
}

export interface CelestialCompassBeastInput {
  beastsRemaining: number;
  daysLeft: number;
}

export interface CelestialCompassInput {
  activeEvent: CelestialCompassEventInput | null;
  beastSurge: CelestialCompassBeastInput | null;
  upcoming: CelestialCompassUpcomingInput | null;
}

export interface CelestialCompassPresentation {
  title: string;
  primary: string;
  causal: string;
  upcoming: string;
  tone: CelestialCompassTone;
}

function daysText(days: number | undefined): string {
  if (!Number.isFinite(days)) return '时日未明';
  const d = Math.max(0, Math.floor(days ?? 0));
  return d === 0 ? '今日' : `${d}日后`;
}

function activeEventCausalLine(event: CelestialCompassEventInput): string {
  switch (event.id) {
    case 'event.qi-tide':
      return '因果：灵草疯长 → 妖兽或随潮窥田';
    case 'event.demonic-pass':
      return '因果：正魔遁光掠境 → 田地或损，战后可拾残物';
    case 'event.purple-omen':
      return '因果：紫雷劫池渐成 → 备丹布阵，勿贪一日';
    case 'event.blood-moon':
      return '因果：血月催狂 → 走火翻倍，宜静守少炼';
    case 'event.demon-seed-rain':
      return '因果：魔种坠田 → 异种可得，风险伴生';
    default:
      if (event.qiMod > 1 || event.growthMod > 1) return '因果：灵机上扬 → 抢种抢收，留意后患';
      if (event.type === 'crisis') return '因果：灾象压境 → 先守田，再求机缘';
      if (event.type === 'opportunity') return '因果：机缘入谷 → 量力取用，莫忘备劫';
      return event.desc ? `因果：${event.desc}` : '因果：风平，按农时经营';
  }
}

function toneFor(event: CelestialCompassEventInput | null, beast: CelestialCompassBeastInput | null): CelestialCompassTone {
  if (beast && beast.beastsRemaining > 0) return 'critical';
  if (!event) return 'calm';
  if (event.id === 'event.purple-omen' || event.type === 'crisis') return 'warning';
  if (event.type === 'opportunity' || event.type === 'joy') return 'opportunity';
  return 'calm';
}

export function celestialCompassPresentation(input: CelestialCompassInput): CelestialCompassPresentation {
  const { activeEvent, beastSurge, upcoming } = input;
  const tone = toneFor(activeEvent, beastSurge);

  if (beastSurge && beastSurge.beastsRemaining > 0) {
    return {
      title: '天象罗盘',
      primary: `妖兽潮：${beastSurge.beastsRemaining}只窥田｜余${Math.max(0, beastSurge.daysLeft)}日`,
      causal: '因果：灵气诱兽 → 成熟灵草最易被啃食',
      upcoming: upcoming ? `后兆：${daysText(upcoming.daysFromNow)} · ${upcoming.title}` : '后兆：先清妖潮，再观天象',
      tone
    };
  }

  if (activeEvent) {
    return {
      title: '天象罗盘',
      primary: `${activeEvent.displayName}｜余${Math.max(0, activeEvent.daysLeft)}日`,
      causal: activeEventCausalLine(activeEvent),
      upcoming: upcoming ? `后兆：${daysText(upcoming.daysFromNow)} · ${upcoming.title}` : '后兆：七日内无定期节令',
      tone
    };
  }

  return {
    title: '天象罗盘',
    primary: '天象平稳',
    causal: '因果：无大势压境，正宜补种、炼丹、布阵',
    upcoming: upcoming ? `后兆：${daysText(upcoming.daysFromNow)} · ${upcoming.title}` : '后兆：七日内无定期节令',
    tone
  };
}
