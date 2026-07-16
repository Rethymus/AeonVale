export const POST_LOOP_CULTIVATION_HANDOFF = '修行接力：炼丹备避雷丹、布引雷/绝缘阵、淬体满后按 T 主动引劫。';

export const POST_LOOP_PROCESSING_FOCUS = '首轮农务已成，回农庄按 Shift+M 把余货先排进加工，再接炼丹、阵法与备劫。';

export const POST_LOOP_MILESTONE = '里程碑：首轮农务闭环已跑通，按 Shift+M 把余货接入加工、阵法与备劫。';

export function postLoopProcessingServiceMessage(confirmHint: string): string {
 return `加工：余货先晾晒，封藏稳药性，备避雷丹与炉料，再把熔炼阵核接炼丹与阵法｜Tab切换到农庄加工项·${confirmHint}`;
}

export function postLoopArraysServiceMessage(confirmHint: string): string {
 return `阵法：布设引雷阵与绝缘阵，把农庄产出转成备劫防线；淬体满后按 T 主动引劫｜${confirmHint}`;
}

export function postLoopFarmWorkServiceMessage(confirmHint: string): string {
 return `农事：翻地、补种、浇水、收获与出货从这里收口，先稳住修行资源循环，再转炼丹、阵法与主动引劫｜数字键/滚轮切热栏·${confirmHint}`;
}
