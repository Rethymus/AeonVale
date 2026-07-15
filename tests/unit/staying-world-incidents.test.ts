import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, getCurrentStayingWorldIncident, greenhouseVisitFlag, hasResolvedStayingWorldIncidentForDay, placeArray, resolveStayingWorldIncident, type GameState, type SimContext } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';

function setup(seed = 41): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 state.player.stage = 7;
 state.postAscension.mode = 'stayed-in-world';
 state.postAscension.ascensionDay = state.day;
 return { state, ctx };
}

function firstOpenTileId(state: GameState): number {
 const tile = state.tiles.find((entry) => entry.blockType === 'none');
 if (!tile) throw new Error('expected at least one open tile');
 return tile.id;
}

describe('留世镇守事件', () => {
 it('事件按日确定性轮换', () => {
 const { state } = setup();
 const first = getCurrentStayingWorldIncident(state);
 expect(first?.id).toBe('incident.beast-trace');

state.day = 2;
 const second = getCurrentStayingWorldIncident(state);
 expect(second?.id).toBe('incident.array-fray');

state.day = 3;
 const third = getCurrentStayingWorldIncident(state);
 expect(third?.id).toBe('incident.herb-relief');

state.day = 4;
 const fourth = getCurrentStayingWorldIncident(state);
 expect(fourth?.id).toBe('incident.wanderer-aid');

state.day = 5;
 const fifth = getCurrentStayingWorldIncident(state);
 expect(fifth?.id).toBe('incident.seasonal-blight');

state.day = 6;
 const sixth = getCurrentStayingWorldIncident(state);
 expect(sixth?.id).toBe('incident.warden-commission');

state.day = 7;
 const seventh = getCurrentStayingWorldIncident(state);
 expect(seventh?.id).toBe('incident.spirit-vein-flare');

state.day = 8;
 const eighth = getCurrentStayingWorldIncident(state);
 expect(eighth?.id).toBe('incident.inner-demon-flare');

state.day = 9;
 const ninth = getCurrentStayingWorldIncident(state);
 expect(ninth?.id).toBe('incident.frost-blight');

state.day = 10;
 const tenth = getCurrentStayingWorldIncident(state);
 expect(tenth?.id).toBe('incident.lifespan-omen');

state.day = 11;
 const eleventh = getCurrentStayingWorldIncident(state);
 expect(eleventh?.id).toBe('incident.beast-tide-omen');

state.day = 12;
 const twelfth = getCurrentStayingWorldIncident(state);
 expect(twelfth?.id).toBe('incident.qi-drift');

state.day = 13;
 const thirteenth = getCurrentStayingWorldIncident(state);
 expect(thirteenth?.id).toBe('incident.wind-erosion');

state.day = 14;
 const fourteenth = getCurrentStayingWorldIncident(state);
 expect(fourteenth?.id).toBe('incident.miasma-seep');

state.day = 15;
 const fifteenth = getCurrentStayingWorldIncident(state);
 expect(fifteenth?.id).toBe('incident.spirit-stone-tribute');

state.day = 16;
 const sixteenth = getCurrentStayingWorldIncident(state);
 expect(sixteenth?.id).toBe('incident.merchant-caravan');

state.day = 17;
 const seventeenth = getCurrentStayingWorldIncident(state);
 expect(seventeenth?.id).toBe('incident.formation-collapse');

state.day = 18;
 const eighteenth = getCurrentStayingWorldIncident(state);
 expect(eighteenth?.id).toBe('incident.hermit-visit');

state.day = 19;
 const nineteenth = getCurrentStayingWorldIncident(state);
 expect(nineteenth?.id).toBe('incident.beast-core-bounty');

state.day = 20;
 const twentieth = getCurrentStayingWorldIncident(state);
 expect(twentieth?.id).toBe('incident.mistfern-ritual');

state.day = 21;
 const twentyfirst = getCurrentStayingWorldIncident(state);
 expect(twentyfirst?.id).toBe('incident.frostmarrow-ward');

state.day = 22;
 const twentysecond = getCurrentStayingWorldIncident(state);
 expect(twentysecond?.id).toBe('incident.compost-offering');

state.day = 23;
 const twentythird = getCurrentStayingWorldIncident(state);
 expect(twentythird?.id).toBe('incident.array-core-tribute');

state.day = 24;
 const twentyfourth = getCurrentStayingWorldIncident(state);
 expect(twentyfourth?.id).toBe('incident.sealed-tribute');

state.day = 25;
 const twentyfifth = getCurrentStayingWorldIncident(state);
 expect(twentyfifth?.id).toBe('incident.mossling-cleanup');

state.day = 26;
 const twentysixth = getCurrentStayingWorldIncident(state);
 expect(twentysixth?.id).toBe('incident.wine-offering');

state.day = 27;
 const twentyseventh = getCurrentStayingWorldIncident(state);
 expect(twentyseventh?.id).toBe('incident.poultice-stockpile');

state.day = 28;
 const twentyeighth = getCurrentStayingWorldIncident(state);
 expect(twentyeighth?.id).toBe('incident.dried-herb-stockpile');

state.day = 29;
 const twentyninth = getCurrentStayingWorldIncident(state);
 expect(twentyninth?.id).toBe('incident.guard-relief');

state.day = 30;
 const thirtieth = getCurrentStayingWorldIncident(state);
 expect(thirtieth?.id).toBe('incident.beast-pelt-tribute');

state.day = 31;
 const thirtyfirst = getCurrentStayingWorldIncident(state);
 expect(thirtyfirst?.id).toBe('incident.stonegrain-relief');

state.day = 32;
 const thirtysecond = getCurrentStayingWorldIncident(state);
 expect(thirtysecond?.id).toBe('incident.broken-talisman-tribute');

state.day = 33;
 const thirtythird = getCurrentStayingWorldIncident(state);
 expect(thirtythird?.id).toBe('incident.mistfern-feast');

state.day = 34;
 const thirtyfourth = getCurrentStayingWorldIncident(state);
 expect(thirtyfourth?.id).toBe('incident.compost-field-rite');

state.day = 35;
 const thirtyfifth = getCurrentStayingWorldIncident(state);
 expect(thirtyfifth?.id).toBe('incident.dewroot-tonic');

state.day = 36;
 const thirtysixth = getCurrentStayingWorldIncident(state);
 expect(thirtysixth?.id).toBe('incident.balmleaf-tonic');

state.day = 37;
 const thirtyseventh = getCurrentStayingWorldIncident(state);
 expect(thirtyseventh?.id).toBe('incident.suncap-feast');

state.day = 38;
 const thirtyeighth = getCurrentStayingWorldIncident(state);
 expect(thirtyeighth?.id).toBe('incident.stonegrain-feast');

state.day = 39;
 const thirtyninth = getCurrentStayingWorldIncident(state);
 expect(thirtyninth?.id).toBe('incident.recipe-archive');

state.day = 40;
 const fortieth = getCurrentStayingWorldIncident(state);
 expect(fortieth?.id).toBe('incident.array-core-stockpile');

state.day = 41;
 const fortyfirst = getCurrentStayingWorldIncident(state);
 expect(fortyfirst?.id).toBe('incident.sealed-archive');

state.day = 42;
 const fortysecond = getCurrentStayingWorldIncident(state);
 expect(fortysecond?.id).toBe('incident.wine-archive');

state.day = 43;
 const fortythird = getCurrentStayingWorldIncident(state);
 expect(fortythird?.id).toBe('incident.poultice-archive');

state.day = 44;
 const fortyfourth = getCurrentStayingWorldIncident(state);
 expect(fortyfourth?.id).toBe('incident.spirit-stone-festival');

state.day = 45;
 const fortyfifth = getCurrentStayingWorldIncident(state);
 expect(fortyfifth?.id).toBe('incident.talisman-forge');

state.day = 46;
 const fortysixth = getCurrentStayingWorldIncident(state);
 expect(fortysixth?.id).toBe('incident.beast-core-forge');

state.day = 47;
 const fortyseventh = getCurrentStayingWorldIncident(state);
 expect(fortyseventh?.id).toBe('incident.array-core-forge');

state.day = 48;
 const fortyeighth = getCurrentStayingWorldIncident(state);
 expect(fortyeighth?.id).toBe('incident.compost-forge');

state.day = 49;
 const fortyninth = getCurrentStayingWorldIncident(state);
 expect(fortyninth?.id).toBe('incident.sealed-forge');

state.day = 50;
 const fiftieth = getCurrentStayingWorldIncident(state);
 expect(fiftieth?.id).toBe('incident.dried-herb-forge');

state.day = 51;
 const fiftyfirst = getCurrentStayingWorldIncident(state);
 expect(fiftyfirst?.id).toBe('incident.wine-forge');

state.day = 52;
 const fiftysecond = getCurrentStayingWorldIncident(state);
 expect(fiftysecond?.id).toBe('incident.poultice-forge');

state.day = 53;
 const fiftythird = getCurrentStayingWorldIncident(state);
 expect(fiftythird?.id).toBe('incident.recipe-archive-bulk');

state.day = 54;
 const fiftyfourth = getCurrentStayingWorldIncident(state);
 expect(fiftyfourth?.id).toBe('incident.spirit-stone-tribute-bulk');

state.day = 55;
 const fiftyfifth = getCurrentStayingWorldIncident(state);
 expect(fiftyfifth?.id).toBe('incident.beast-core-bulk');

state.day = 56;
 const fiftysixth = getCurrentStayingWorldIncident(state);
 expect(fiftysixth?.id).toBe('incident.talisman-bulk');

state.day = 57;
 const fiftyseventh = getCurrentStayingWorldIncident(state);
 expect(fiftyseventh?.id).toBe('incident.mossling-bulk');

state.day = 58;
 const fiftyeighth = getCurrentStayingWorldIncident(state);
 expect(fiftyeighth?.id).toBe('incident.sealed-bulk');

state.day = 59;
 const fiftyninth = getCurrentStayingWorldIncident(state);
 expect(fiftyninth?.id).toBe('incident.dewroot-bulk');

state.day = 60;
 const sixtieth = getCurrentStayingWorldIncident(state);
 expect(sixtieth?.id).toBe('incident.suncap-bulk');

state.day = 61;
 const sixtyfirst = getCurrentStayingWorldIncident(state);
 expect(sixtyfirst?.id).toBe('incident.stonegrain-bulk');

state.day = 62;
 const sixtysecond = getCurrentStayingWorldIncident(state);
 expect(sixtysecond?.id).toBe('incident.balmleaf-bulk');

state.day = 63;
 const sixtythird = getCurrentStayingWorldIncident(state);
 expect(sixtythird?.id).toBe('incident.recipe-bulk');

state.day = 64;
 const sixtyfourth = getCurrentStayingWorldIncident(state);
 expect(sixtyfourth?.id).toBe('incident.wine-bulk');

state.day = 65;
 const sixtyfifth = getCurrentStayingWorldIncident(state);
 expect(sixtyfifth?.id).toBe('incident.poultice-bulk');

state.day = 66;
 const sixtysixth = getCurrentStayingWorldIncident(state);
 expect(sixtysixth?.id).toBe('incident.dried-herb-bulk');

state.day = 67;
 const sixtyseventh = getCurrentStayingWorldIncident(state);
 expect(sixtyseventh?.id).toBe('incident.array-core-bulk');

state.day = 68;
 const sixtyeighth = getCurrentStayingWorldIncident(state);
 expect(sixtyeighth?.id).toBe('incident.compost-bulk');

state.day = 69;
 const sixtyninth = getCurrentStayingWorldIncident(state);
 expect(sixtyninth?.id).toBe('incident.spirit-stone-grand');

state.day = 70;
 const seventieth = getCurrentStayingWorldIncident(state);
 expect(seventieth?.id).toBe('incident.beast-core-grand');

state.day = 71;
 const seventyfirst = getCurrentStayingWorldIncident(state);
 expect(seventyfirst?.id).toBe('incident.talisman-grand');

state.day = 72;
 const seventysecond = getCurrentStayingWorldIncident(state);
 expect(seventysecond?.id).toBe('incident.sealed-grand');

state.day = 73;
 const seventythird = getCurrentStayingWorldIncident(state);
 expect(seventythird?.id).toBe('incident.array-core-grand');

state.day = 74;
 const seventyfourth = getCurrentStayingWorldIncident(state);
 expect(seventyfourth?.id).toBe('incident.compost-grand');

state.day = 75;
 const seventyfifth = getCurrentStayingWorldIncident(state);
 expect(seventyfifth?.id).toBe('incident.dried-herb-grand');

state.day = 76;
 const seventysixth = getCurrentStayingWorldIncident(state);
 expect(seventysixth?.id).toBe('incident.wine-grand');

state.day = 77;
 const seventyseventh = getCurrentStayingWorldIncident(state);
 expect(seventyseventh?.id).toBe('incident.poultice-grand');

state.day = 78;
 const seventyeighth = getCurrentStayingWorldIncident(state);
 expect(seventyeighth?.id).toBe('incident.recipe-grand');

state.day = 79;
 const seventyninth = getCurrentStayingWorldIncident(state);
 expect(seventyninth?.id).toBe('incident.mossling-grand');

state.day = 80;
 const eightieth = getCurrentStayingWorldIncident(state);
 expect(eightieth?.id).toBe('incident.dewroot-grand');

state.day = 81;
 const eightyfirst = getCurrentStayingWorldIncident(state);
 expect(eightyfirst?.id).toBe('incident.suncap-grand');

state.day = 82;
 const eightysecond = getCurrentStayingWorldIncident(state);
 expect(eightysecond?.id).toBe('incident.stonegrain-grand');

state.day = 83;
 const eightythird = getCurrentStayingWorldIncident(state);
 expect(eightythird?.id).toBe('incident.balmleaf-grand');

state.day = 84;
 const eightyfourth = getCurrentStayingWorldIncident(state);
 expect(eightyfourth?.id).toBe('incident.mistfern-grand');

state.day = 85;
 const eightyfifth = getCurrentStayingWorldIncident(state);
 expect(eightyfifth?.id).toBe('incident.frostmarrow-grand');

state.day = 86;
 const eightysixth = getCurrentStayingWorldIncident(state);
 expect(eightysixth?.id).toBe('incident.spirit-stone-centennial');

state.day = 87;
 const eightyseventh = getCurrentStayingWorldIncident(state);
 expect(eightyseventh?.id).toBe('incident.beast-core-centennial');

state.day = 88;
 const eightyeighth = getCurrentStayingWorldIncident(state);
 expect(eightyeighth?.id).toBe('incident.talisman-centennial');

state.day = 89;
 const eightyninth = getCurrentStayingWorldIncident(state);
 expect(eightyninth?.id).toBe('incident.sealed-centennial');

state.day = 90;
 const ninetieth = getCurrentStayingWorldIncident(state);
 expect(ninetieth?.id).toBe('incident.dried-herb-centennial');

state.day = 91;
 const ninetyfirst = getCurrentStayingWorldIncident(state);
 expect(ninetyfirst?.id).toBe('incident.wine-centennial');

state.day = 92;
 const ninetysecond = getCurrentStayingWorldIncident(state);
 expect(ninetysecond?.id).toBe('incident.poultice-centennial');

state.day = 93;
 const ninetythird = getCurrentStayingWorldIncident(state);
 expect(ninetythird?.id).toBe('incident.recipe-centennial');

state.day = 94;
 const ninetyfourth = getCurrentStayingWorldIncident(state);
 expect(ninetyfourth?.id).toBe('incident.array-core-centennial');

state.day = 95;
 const ninetyfifth = getCurrentStayingWorldIncident(state);
 expect(ninetyfifth?.id).toBe('incident.compost-centennial');

state.day = 96;
 const ninetysixth = getCurrentStayingWorldIncident(state);
 expect(ninetysixth?.id).toBe('incident.spirit-stone-millennium');

state.day = 97;
 const ninetyseventh = getCurrentStayingWorldIncident(state);
 expect(ninetyseventh?.id).toBe('incident.beast-core-millennium');

state.day = 98;
 const ninetyeighth = getCurrentStayingWorldIncident(state);
 expect(ninetyeighth?.id).toBe('incident.talisman-millennium');

state.day = 99;
 const ninetyninth = getCurrentStayingWorldIncident(state);
 expect(ninetyninth?.id).toBe('incident.sealed-millennium');

state.day = 100;
 const hundredth = getCurrentStayingWorldIncident(state);
 expect(hundredth?.id).toBe('incident.dried-herb-millennium');

state.day = 101;
 const hundredfirst = getCurrentStayingWorldIncident(state);
 expect(hundredfirst?.id).toBe('incident.wine-millennium');

state.day = 102;
 const hundredsecond = getCurrentStayingWorldIncident(state);
 expect(hundredsecond?.id).toBe('incident.poultice-millennium');

state.day = 103;
 const hundredthird = getCurrentStayingWorldIncident(state);
 expect(hundredthird?.id).toBe('incident.recipe-millennium');

state.day = 104;
 const hundredfourth = getCurrentStayingWorldIncident(state);
 expect(hundredfourth?.id).toBe('incident.array-core-millennium');

state.day = 105;
 const hundredfifth = getCurrentStayingWorldIncident(state);
 expect(hundredfifth?.id).toBe('incident.compost-millennium');

state.day = 106;
 const hundredsixth = getCurrentStayingWorldIncident(state);
 expect(hundredsixth?.id).toBe('incident.spirit-stone-eternal');

state.day = 107;
 const hundredseventh = getCurrentStayingWorldIncident(state);
 expect(hundredseventh?.id).toBe('incident.beast-core-eternal');

state.day = 108;
 const hundredeighth = getCurrentStayingWorldIncident(state);
 expect(hundredeighth?.id).toBe('incident.talisman-eternal');

state.day = 109;
 const hundredninth = getCurrentStayingWorldIncident(state);
 expect(hundredninth?.id).toBe('incident.sealed-eternal');

state.day = 110;
 const hundredtenth = getCurrentStayingWorldIncident(state);
 expect(hundredtenth?.id).toBe('incident.dried-herb-eternal');

state.day = 111;
 const hundredeleventh = getCurrentStayingWorldIncident(state);
 expect(hundredeleventh?.id).toBe('incident.wine-eternal');

state.day = 112;
 const hundredtwelfth = getCurrentStayingWorldIncident(state);
 expect(hundredtwelfth?.id).toBe('incident.poultice-eternal');

state.day = 113;
 const hundredthirteenth = getCurrentStayingWorldIncident(state);
 expect(hundredthirteenth?.id).toBe('incident.recipe-eternal');

state.day = 114;
 const hundredfourteenth = getCurrentStayingWorldIncident(state);
 expect(hundredfourteenth?.id).toBe('incident.array-core-eternal');

state.day = 115;
 const hundredfifteenth = getCurrentStayingWorldIncident(state);
 expect(hundredfifteenth?.id).toBe('incident.compost-eternal');

state.day = 116;
 const hundredsixteenth = getCurrentStayingWorldIncident(state);
 expect(hundredsixteenth?.id).toBe('incident.spirit-stone-final');

state.day = 117;
 const hundredseventeenth = getCurrentStayingWorldIncident(state);
 expect(hundredseventeenth?.id).toBe('incident.beast-core-final');

state.day = 118;
 const hundredeighteenth = getCurrentStayingWorldIncident(state);
 expect(hundredeighteenth?.id).toBe('incident.talisman-final');

state.day = 119;
 const hundrednineteenth = getCurrentStayingWorldIncident(state);
 expect(hundrednineteenth?.id).toBe('incident.sealed-final');

state.day = 120;
 const hundredtwentieth = getCurrentStayingWorldIncident(state);
 expect(hundredtwentieth?.id).toBe('incident.dried-herb-final');

state.day = 121;
 const hundredtwentyfirst = getCurrentStayingWorldIncident(state);
 expect(hundredtwentyfirst?.id).toBe('incident.wine-final');

state.day = 122;
 const hundredtwentysecond = getCurrentStayingWorldIncident(state);
 expect(hundredtwentysecond?.id).toBe('incident.poultice-final');

state.day = 123;
 const hundredtwentythird = getCurrentStayingWorldIncident(state);
 expect(hundredtwentythird?.id).toBe('incident.recipe-final');

state.day = 124;
 const hundredtwentyfourth = getCurrentStayingWorldIncident(state);
 expect(hundredtwentyfourth?.id).toBe('incident.array-core-final');

state.day = 125;
 const hundredtwentyfifth = getCurrentStayingWorldIncident(state);
 expect(hundredtwentyfifth?.id).toBe('incident.compost-final');

state.day = 126;
 const hundredtwentysixth = getCurrentStayingWorldIncident(state);
 expect(hundredtwentysixth?.id).toBe('incident.spirit-stone-ultimate');

state.day = 127;
 const hundredtwentyseventh = getCurrentStayingWorldIncident(state);
 expect(hundredtwentyseventh?.id).toBe('incident.beast-core-ultimate');

state.day = 128;
 const hundredtwentyeighth = getCurrentStayingWorldIncident(state);
 expect(hundredtwentyeighth?.id).toBe('incident.talisman-ultimate');

state.day = 129;
 const hundredtwentyninth = getCurrentStayingWorldIncident(state);
 expect(hundredtwentyninth?.id).toBe('incident.sealed-ultimate');

state.day = 130;
 const hundredthirtieth = getCurrentStayingWorldIncident(state);
 expect(hundredthirtieth?.id).toBe('incident.dried-herb-ultimate');

state.day = 131;
 const hundredthirtyfirst = getCurrentStayingWorldIncident(state);
 expect(hundredthirtyfirst?.id).toBe('incident.wine-ultimate');

state.day = 132;
 const hundredthirtysecond = getCurrentStayingWorldIncident(state);
 expect(hundredthirtysecond?.id).toBe('incident.poultice-ultimate');

state.day = 133;
 const hundredthirtythird = getCurrentStayingWorldIncident(state);
 expect(hundredthirtythird?.id).toBe('incident.recipe-ultimate');

state.day = 134;
 const hundredthirtyfourth = getCurrentStayingWorldIncident(state);
 expect(hundredthirtyfourth?.id).toBe('incident.array-core-ultimate');

state.day = 135;
 const hundredthirtyfifth = getCurrentStayingWorldIncident(state);
 expect(hundredthirtyfifth?.id).toBe('incident.compost-ultimate');

state.day = 136;
 const hundredthirtysixth = getCurrentStayingWorldIncident(state);
 expect(hundredthirtysixth?.id).toBe('incident.spirit-stone-supreme');

state.day = 137;
 const hundredthirtyseventh = getCurrentStayingWorldIncident(state);
 expect(hundredthirtyseventh?.id).toBe('incident.beast-core-supreme');

state.day = 138;
 const hundredthirtyeighth = getCurrentStayingWorldIncident(state);
 expect(hundredthirtyeighth?.id).toBe('incident.talisman-supreme');

state.day = 139;
 const hundredthirtyninth = getCurrentStayingWorldIncident(state);
 expect(hundredthirtyninth?.id).toBe('incident.sealed-supreme');

state.day = 140;
 const hundredfortieth = getCurrentStayingWorldIncident(state);
 expect(hundredfortieth?.id).toBe('incident.dried-herb-supreme');

state.day = 141;
 const hundredfortyfirst = getCurrentStayingWorldIncident(state);
 expect(hundredfortyfirst?.id).toBe('incident.wine-supreme');

state.day = 142;
 const hundredfortysecond = getCurrentStayingWorldIncident(state);
 expect(hundredfortysecond?.id).toBe('incident.poultice-supreme');

state.day = 143;
 const hundredfortythird = getCurrentStayingWorldIncident(state);
 expect(hundredfortythird?.id).toBe('incident.recipe-supreme');

state.day = 144;
 const hundredfortyfourth = getCurrentStayingWorldIncident(state);
 expect(hundredfortyfourth?.id).toBe('incident.array-core-supreme');

state.day = 145;
 const hundredfortyfifth = getCurrentStayingWorldIncident(state);
 expect(hundredfortyfifth?.id).toBe('incident.compost-supreme');

state.day = 146;
 const hundredfortysixth = getCurrentStayingWorldIncident(state);
 expect(hundredfortysixth?.id).toBe('incident.spirit-stone-apex');

state.day = 147;
 const hundredfortyseventh = getCurrentStayingWorldIncident(state);
 expect(hundredfortyseventh?.id).toBe('incident.beast-core-apex');

state.day = 148;
 const hundredfortyeighth = getCurrentStayingWorldIncident(state);
 expect(hundredfortyeighth?.id).toBe('incident.talisman-apex');

state.day = 149;
 const hundredfortyninth = getCurrentStayingWorldIncident(state);
 expect(hundredfortyninth?.id).toBe('incident.sealed-apex');

state.day = 150;
 const hundredfiftieth = getCurrentStayingWorldIncident(state);
 expect(hundredfiftieth?.id).toBe('incident.dried-herb-apex');

state.day = 151;
 const hundredfiftyfirst = getCurrentStayingWorldIncident(state);
 expect(hundredfiftyfirst?.id).toBe('incident.wine-apex');

state.day = 152;
 const hundredfiftysecond = getCurrentStayingWorldIncident(state);
 expect(hundredfiftysecond?.id).toBe('incident.poultice-apex');

state.day = 153;
 const hundredfiftythird = getCurrentStayingWorldIncident(state);
 expect(hundredfiftythird?.id).toBe('incident.recipe-apex');

state.day = 154;
 const hundredfiftyfourth = getCurrentStayingWorldIncident(state);
 expect(hundredfiftyfourth?.id).toBe('incident.array-core-apex');

state.day = 155;
 const hundredfiftyfifth = getCurrentStayingWorldIncident(state);
 expect(hundredfiftyfifth?.id).toBe('incident.compost-apex');

state.day = 156;
 const hundredfiftysixth = getCurrentStayingWorldIncident(state);
 expect(hundredfiftysixth?.id).toBe('incident.spirit-stone-zenith');

state.day = 157;
 const hundredfiftyseventh = getCurrentStayingWorldIncident(state);
 expect(hundredfiftyseventh?.id).toBe('incident.beast-core-zenith');

state.day = 158;
 const hundredfiftyeighth = getCurrentStayingWorldIncident(state);
 expect(hundredfiftyeighth?.id).toBe('incident.talisman-zenith');

state.day = 159;
 const hundredfiftyninth = getCurrentStayingWorldIncident(state);
 expect(hundredfiftyninth?.id).toBe('incident.sealed-zenith');

state.day = 160;
 const hundredsixtieth = getCurrentStayingWorldIncident(state);
 expect(hundredsixtieth?.id).toBe('incident.dried-herb-zenith');

state.day = 161;
 const hundredsixtyfirst = getCurrentStayingWorldIncident(state);
 expect(hundredsixtyfirst?.id).toBe('incident.wine-zenith');

state.day = 162;
 const hundredsixtysecond = getCurrentStayingWorldIncident(state);
 expect(hundredsixtysecond?.id).toBe('incident.poultice-zenith');

state.day = 163;
 const hundredsixtythird = getCurrentStayingWorldIncident(state);
 expect(hundredsixtythird?.id).toBe('incident.recipe-zenith');

state.day = 164;
 const hundredsixtyfourth = getCurrentStayingWorldIncident(state);
 expect(hundredsixtyfourth?.id).toBe('incident.array-core-zenith');

state.day = 165;
 const hundredsixtyfifth = getCurrentStayingWorldIncident(state);
 expect(hundredsixtyfifth?.id).toBe('incident.compost-zenith');

state.day = 166;
 const hundredsixtysixth = getCurrentStayingWorldIncident(state);
 expect(hundredsixtysixth?.id).toBe('incident.spirit-stone-eternal-zenith');

state.day = 167;
 const hundredsixtyseventh = getCurrentStayingWorldIncident(state);
 expect(hundredsixtyseventh?.id).toBe('incident.beast-core-eternal-zenith');

state.day = 168;
 const hundredsixtyeighth = getCurrentStayingWorldIncident(state);
 expect(hundredsixtyeighth?.id).toBe('incident.talisman-eternal-zenith');

state.day = 169;
 const hundredsixtyninth = getCurrentStayingWorldIncident(state);
 expect(hundredsixtyninth?.id).toBe('incident.sealed-eternal-zenith');

state.day = 170;
 const hundredseventieth = getCurrentStayingWorldIncident(state);
 expect(hundredseventieth?.id).toBe('incident.dried-herb-eternal-zenith');

state.day = 171;
 const wrapped = getCurrentStayingWorldIncident(state);
 expect(wrapped?.id).toBe('incident.beast-trace');
 });

it('可消耗物资处置镇守事件并降低压力', () => {
 const { state, ctx } = setup();
 const incident = getCurrentStayingWorldIncident(state)!;
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(hasResolvedStayingWorldIncidentForDay(state, state.day)).toBe(true);
 expect(state.stayingWorld.wardingPressure).toBeLessThan(beforePressure);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { incidentId: incident.id } });
 });

it('玩家动作可接入镇守事件处置动作', () => {
 const { state, ctx } = setup();
 const incident = getCurrentStayingWorldIncident(state)!;
 mutateItem(state.player, incident.itemId, incident.count);

applyAction(state, { kind: 'resolve-staying-world-incident' }, ctx);

expect(hasResolvedStayingWorldIncidentForDay(state, state.day)).toBe(true);
 });

it('妖兽侵田痕可由巡守兽代为协防，免去内丹消耗并额外减压', () => {
 const { state, ctx } = setup();
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-trace');
 state.guardBeasts.push({ id: 7, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 7, vigor: 1, bond: 46, specialty: 'field-ward' }));
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: 0, beastId: 7, beastVigor: 1, beastBond: 46, beastBondGain: 6, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 },
 });
 });

it('守田专长会让妖兽侵田痕额外多缓解一档压力', () => {
 const { state, ctx } = setup();
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 17, vigor: 2, maxVigor: 3, bond: 40, specialty: 'field-ward' });
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 17, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 },
 });
 });

it('有多只巡守兽时优先由高羁绊者参与留世协防', () => {
 const { state, ctx } = setup();
 state.guardBeasts.push({ id: 9, vigor: 1, maxVigor: 3, bond: 20, specialty: null });
 state.guardBeasts.push({ id: 3, vigor: 2, maxVigor: 3, bond: 65, specialty: null });

resolveStayingWorldIncident(state, ctx);

expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 9, vigor: 1, bond: 20 }));
 expect(state.guardBeasts[1]).toEqual(expect.objectContaining({ id: 3, vigor: 1, bond: 71, specialty: 'field-ward' }));
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 3, beastBond: 71, beastBondGain: 6, beastSpecialty: 'field-ward' } });
 });

it('有巡逻指派时，妖兽侵田痕优先由被指派巡逻的巡守兽响应', () => {
 const { state, ctx } = setup();
 state.guardBeasts.push({ id: 9, vigor: 2, maxVigor: 3, bond: 20, specialty: null });
 state.guardBeasts.push({ id: 3, vigor: 2, maxVigor: 3, bond: 65, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };

applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 9, tileId: state.tiles[0]!.id }, ctx);
 resolveStayingWorldIncident(state, ctx);

expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 9, vigor: 1, bond: 26 }));
 expect(state.guardBeasts[1]).toEqual(expect.objectContaining({ id: 3, vigor: 2, bond: 65 }));
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 9, beastBond: 26, beastBondGain: 6 } });
 });

it('残脉阵脚松动可由驻守活跃阵法覆盖区的巡守兽协防，免去法宝碎件消耗', () => {
 const { state, ctx } = setup();
 state.day = 2;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-fray');

state.guardBeasts.push({ id: 4, vigor: 2, maxVigor: 3, bond: 35, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 const patrolTileId = firstOpenTileId(state);
 const patrolTile = state.tiles[patrolTileId]!;
 const insulation = placeArray(state, 'array.insulation', patrolTile.x, patrolTile.y, ctx, { free: true });
 expect(insulation.placed).toBe(true);

applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 4, tileId: patrolTileId }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 4, vigor: 1, bond: 41, specialty: 'array-warden' }));
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 3_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: 0, beastId: 4, beastVigor: 1, beastBond: 41, beastBondGain: 6, beastSpecialty: 'array-warden', patrolTileId, pressureReliefBonus: 3_000 },
 });
 });

it('残脉阵脚松动会把高羁绊协防者固化为阵守专长，后续提供更高减压', () => {
 const { state, ctx } = setup();
 state.day = 2;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 24, vigor: 2, maxVigor: 3, bond: 35, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 const patrolTileId = firstOpenTileId(state);
 const patrolTile = state.tiles[patrolTileId]!;
 placeArray(state, 'array.insulation', patrolTile.x, patrolTile.y, ctx, { free: true });
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 24, tileId: patrolTileId }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 24, specialty: 'array-warden' }));
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 3_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 24, beastSpecialty: 'array-warden', pressureReliefBonus: 3_000 },
 });
 });

it('残脉阵脚松动若巡逻点不在活跃阵法覆盖内，仍需正常消耗法宝碎件', () => {
 const { state, ctx } = setup();
 state.day = 2;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-fray');

state.guardBeasts.push({ id: 4, vigor: 2, maxVigor: 3, bond: 35, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);

const unprotectedTileId = [...state.tiles].reverse().find((entry) => entry.blockType === 'none')!.id;
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 4, tileId: unprotectedTileId }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 4, vigor: 2, bond: 35 }));
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { count: incident.count, beastId: undefined, pressureReliefBonus: 0 } });
 });

it('村镇求援药包可由完成当日暖棚养护的巡守兽分担一份搬运，减少药草消耗并增长羁绊', () => {
 const { state, ctx } = setup();
 state.day = 3;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.herb-relief');

state.guardBeasts.push({ id: 8, vigor: 2, maxVigor: 3, bond: 28, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 state.flags.add(greenhouseVisitFlag(state.day));
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 8, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 8, vigor: 1, bond: 34 }));
 expect(state.player.inventory['herb.mossling']?.count).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 1_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: 1, beastId: 8, beastVigor: 1, beastBond: 34, beastBondGain: 6, pressureReliefBonus: 1_000 },
 });
 });

it('村镇求援药包会把高羁绊搬运者固化为递送专长，并进一步提升减压收益', () => {
 const { state, ctx } = setup();
 state.day = 3;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 18, vigor: 2, maxVigor: 3, bond: 30, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 state.flags.add(greenhouseVisitFlag(state.day));
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 18, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 18, specialty: 'courier' }));
 expect(state.player.inventory['herb.mossling']?.count).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 2_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 18, beastSpecialty: 'courier', pressureReliefBonus: 2_000 },
 });
 });

it('村镇求援药包若当日未养护暖棚，则巡守兽不会分担搬运', () => {
 const { state, ctx } = setup();
 state.day = 3;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.herb-relief');

state.guardBeasts.push({ id: 8, vigor: 2, maxVigor: 3, bond: 28, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 8, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 8, vigor: 2, bond: 28 }));
 expect(state.player.inventory['herb.mossling']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: incident.count, beastId: undefined, pressureReliefBonus: 0 },
 });
 });
});

describe('巡守兽专长精通协防 ', () => {
 it('精通层守田巡守兽处置妖兽侵田痕时，比专长层再额外缓解一档压力', () => {
 const { state, ctx } = setup();
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-trace');
 state.guardBeasts.push({ id: 88, vigor: 2, maxVigor: 3, bond: 80, specialty: 'field-ward' });
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 88, vigor: 1, bond: 86, specialty: 'field-ward' }));
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 5_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 88, beastBond: 86, beastBondGain: 6, beastSpecialty: 'field-ward', beastMastery: true, pressureReliefBonus: 5_000 },
 });
 });

it('精通层阵守巡守兽协防残脉阵脚松动时，提供更高减压', () => {
 const { state, ctx } = setup();
 state.day = 2;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-fray');
 state.guardBeasts.push({ id: 84, vigor: 2, maxVigor: 3, bond: 80, specialty: 'array-warden' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 const patrolTileId = firstOpenTileId(state);
 const patrolTile = state.tiles[patrolTileId]!;
 expect(placeArray(state, 'array.insulation', patrolTile.x, patrolTile.y, ctx, { free: true }).placed).toBe(true);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 84, tileId: patrolTileId }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 84, vigor: 1, bond: 86, specialty: 'array-warden' }));
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 84, beastSpecialty: 'array-warden', beastMastery: true, patrolTileId, pressureReliefBonus: 4_000 },
 });
 });

it('精通层递送巡守兽分担村镇求援药包时，提供更高减压', () => {
 const { state, ctx } = setup();
 state.day = 3;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.herb-relief');
 state.guardBeasts.push({ id: 86, vigor: 2, maxVigor: 3, bond: 80, specialty: 'courier' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 state.flags.add(greenhouseVisitFlag(state.day));
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 86, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['herb.mossling']?.count).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 3_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 86, beastSpecialty: 'courier', beastMastery: true, pressureReliefBonus: 3_000 },
 });
 });
});

describe('散修求援镇守事件 ', () => {
 it('可消耗晾晒灵草处置散修求援并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 4;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wanderer-aid');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: incident.count, beastId: undefined, pressureReliefBonus: 0 },
 });
 });

it('递送巡守兽可代为搬运晾晒灵草，免去消耗并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 4;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 9, vigor: 2, maxVigor: 3, bond: 28, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 9, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1); // 免消耗，仍保留 1
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 1_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: 0, beastId: 9, beastBondGain: 6 },
 });
 });

it('精通递送巡守兽提供更高减压', () => {
 const { state, ctx } = setup();
 state.day = 4;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 19, vigor: 2, maxVigor: 3, bond: 80, specialty: 'courier' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 19, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

resolveStayingWorldIncident(state, ctx);

expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 3_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 19, beastSpecialty: 'courier', beastMastery: true, pressureReliefBonus: 3_000 },
 });
 });
});

describe('节令灾异与巡守委托镇守事件 ', () => {
 it('节令灾异可消耗灵壤肥处置并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 5;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.seasonal-blight');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: incident.count, beastId: undefined, pressureReliefBonus: 0 },
 });
 });

it('暖棚微气候稳住时，巡逻巡守兽可代为护苗，免去灵壤肥消耗并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 5;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.stayingWorld!.greenhouseClimate = 60_000; // 60 * MILLI ≥ 50 阈值
 state.guardBeasts.push({ id: 31, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 31, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(1); // 免消耗，仍保留 1
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: 0, beastId: 31, beastVigor: 1, beastBond: 46, beastBondGain: 6, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 },
 });
 });

it('暖棚微气候未稳住时，节令灾异仍需正常消耗灵壤肥（巡守兽不代护苗）', () => {
 const { state, ctx } = setup();
 state.day = 5;
 const incident = getCurrentStayingWorldIncident(state)!;
 // greenhouseClimate 默认 42 < 50 阈值，即便有巡逻巡守兽也不会代护苗
 state.guardBeasts.push({ id: 31, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 31, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: incident.count, beastId: undefined, pressureReliefBonus: 0 },
 });
 });

it('精通层巡守兽处置节令灾异时，比专长层再额外缓解一档压力', () => {
 const { state, ctx } = setup();
 state.day = 5;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.stayingWorld!.greenhouseClimate = 60_000;
 state.guardBeasts.push({ id: 81, vigor: 2, maxVigor: 3, bond: 80, specialty: 'field-ward' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 81, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

resolveStayingWorldIncident(state, ctx);

expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 5_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 81, beastSpecialty: 'field-ward', beastMastery: true, pressureReliefBonus: 5_000 },
 });
 });

it('巡守委托可消耗灵石处置并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 6;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.warden-commission');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: incident.count, beastId: undefined, pressureReliefBonus: 0 },
 });
 });

it('巡逻巡守兽可带队夜巡，省下一份灵石酬金并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 6;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 41, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count); // 2 灵石
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 41, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1); // 2 → 1
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { incidentId: incident.id, count: 1, beastId: 41, beastVigor: 1, beastBond: 46, beastBondGain: 6, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 },
 });
 });

it('精通层巡守兽带队夜巡时，提供更高减压', () => {
 const { state, ctx } = setup();
 state.day = 6;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 91, vigor: 2, maxVigor: 3, bond: 80, specialty: 'field-ward' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 91, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

resolveStayingWorldIncident(state, ctx);

expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1); // 2 → 1
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 5_000);
 expect(state.events.at(-1)).toMatchObject({
 type: 'staying-world-incident-resolved',
 payload: { beastId: 91, beastSpecialty: 'field-ward', beastMastery: true, pressureReliefBonus: 5_000 },
 });
 });
});

describe('递送专长协防灵石酬谢 ', () => {
 it('精通递送巡守兽协防散修求援后，邻里以 2 灵石酬谢', () => {
 const { state, ctx } = setup();
 state.day = 4; // wanderer-aid（courier 协防事件）
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wanderer-aid');
 state.guardBeasts.push({ id: 19, vigor: 2, maxVigor: 3, bond: 80, specialty: 'courier' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 19, tileId: state.tiles[0]!.id }, ctx);

resolveStayingWorldIncident(state, ctx);

expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(2); // 精通递送酬谢 2
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { courierStipend: 2 } });
 });

it('递送专长非精通层协防，酬谢 1 灵石', () => {
 const { state, ctx } = setup();
 state.day = 3; // herb-relief（courier 协防事件）
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.herb-relief');
 state.guardBeasts.push({ id: 18, vigor: 2, maxVigor: 3, bond: 40, specialty: 'courier' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 state.flags.add(greenhouseVisitFlag(state.day));
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 18, tileId: state.tiles[0]!.id }, ctx);

resolveStayingWorldIncident(state, ctx);

expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1); // 非精通递送酬谢 1
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { courierStipend: 1 } });
 });

it('非递送专长（守田）协防不触发灵石酬谢', () => {
 const { state, ctx } = setup();
 const incident = getCurrentStayingWorldIncident(state)!; // beast-trace（field-ward）
 expect(incident.id).toBe('incident.beast-trace');
 state.guardBeasts.push({ id: 88, vigor: 2, maxVigor: 3, bond: 80, specialty: 'field-ward' });

resolveStayingWorldIncident(state, ctx);

expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(0); // 守田专长无酬谢
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { courierStipend: 0 } });
 });
});

describe('灵脉波动镇守事件 ', () => {
 it('可消耗残卷镇脉并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 7;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-vein-flare');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });

it('修为深厚（stage≥4）+ 巡逻巡守兽可合力稳脉，免去残卷消耗并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 7;
 const incident = getCurrentStayingWorldIncident(state)!;
 // setup sets stage 7 (≥4)
 state.guardBeasts.push({ id: 77, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 77, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(1); // 免消耗，仍保留 1
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 77, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 } });
 });

it('修为不足（stage<4）时巡守兽不会合力稳脉，仍需消耗残卷', () => {
 const { state, ctx } = setup();
 state.day = 7;
 state.player.stage = 3; // < 4
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 77, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 77, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0); // 残卷被消耗
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { pressureReliefBonus: 0 } });
 });
});

describe('心魔反扑镇守事件 ', () => {
 it('可消耗封藏灵草稳住神识并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 8;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.inner-demon-flare');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });

it('定力深厚（willpower≥500）+ 巡逻巡守兽可镇住心神，免消耗并减压', () => {
 const { state, ctx } = setup();
 state.day = 8;
 state.player.willpower = 600;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 55, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 55, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(1); // 免消耗，仍保留 1
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 55, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 } });
 });

it('定力不足（willpower<500）时巡守兽不会镇心，仍需消耗封藏灵草', () => {
 const { state, ctx } = setup();
 state.day = 8;
 state.player.willpower = 400; // < 500
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 55, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 55, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0); // 封藏灵草被消耗
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
});

describe('霜害侵田镇守事件 ', () => {
 it('可消耗露根草覆根御寒并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 9;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.frost-blight');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['herb.dewroot']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });

it('巡逻巡守兽可连夜护田，省下一份露根草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 9;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 66, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count); // 2 露根草
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 66, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;

const result = resolveStayingWorldIncident(state, ctx);

expect(result.ok).toBe(true);
 expect(state.player.inventory['herb.dewroot']?.count ?? 0).toBe(1); // 2 → 1
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 66, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 } });
 });
});

describe('寿元警报镇守事件 ', () => {
 it('可消耗灵药酒固本培元并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 10;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.lifespan-omen');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巡逻巡守兽可夜守分忧，免去灵药酒消耗并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 10;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 71, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 71, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 71, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 } });
 });
});

describe('妖潮预兆镇守事件 ', () => {
 it('可消耗灵药膏备好疗伤底药并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 11;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-tide-omen');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巡逻巡守兽可提前布防，免去灵药膏消耗并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 11;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 72, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 72, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 72, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 } });
 });
});

describe('灵气涣散镇守事件 ', () => {
 it('可消耗阵核压稳灵脉并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 12;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.qi-drift');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巡逻巡守兽可巡田引气，免去阵核消耗并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 12;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 73, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 73, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 expect(state.events.at(-1)).toMatchObject({ type: 'staying-world-incident-resolved', payload: { beastId: 73, beastSpecialty: 'field-ward', pressureReliefBonus: 4_000 } });
 });
});

describe('风蚀灵田镇守事件 ', () => {
 it('可消耗朝阳菇培土固根并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 13;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wind-erosion');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['herb.suncap']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巡逻巡守兽可挡风护苗，省下一份朝阳菇并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 13;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 74, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 74, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['herb.suncap']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('瘴气渗田镇守事件 ', () => {
 it('可消耗和合叶化浊解毒并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 14;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.miasma-seep');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['herb.balmleaf']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巡逻巡守兽可巡田驱瘴，省下一份和合叶并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 14;
 const incident = getCurrentStayingWorldIncident(state)!;
 state.guardBeasts.push({ id: 75, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 75, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 const result = resolveStayingWorldIncident(state, ctx);
 expect(result.ok).toBe(true);
 expect(state.player.inventory['herb.balmleaf']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('灵石献祭与商队过境镇守事件 ', () => {
 it('灵石献祭：可消耗灵石献祭并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 15;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-tribute');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('商队过境：巡逻巡守兽可代为押货，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 16;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.merchant-caravan');
 state.guardBeasts.push({ id: 76, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 76, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('阵势崩塌与隐士造访镇守事件 ', () => {
 it('阵势崩塌：可消耗破损法宝补阵并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 17;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.formation-collapse');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('隐士造访：巡逻巡守兽可引路护行，省下一份残卷并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 18;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.hermit-visit');
 state.guardBeasts.push({ id: 77, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 77, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('内丹悬赏与雾蕨祭礼镇守事件 ', () => {
 it('内丹悬赏：可消耗内丹应募并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 19;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-bounty');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('雾蕨祭礼：巡逻巡守兽可入山采办，省下一份雾蕨并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 20;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.mistfern-ritual');
 state.guardBeasts.push({ id: 78, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 78, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.mistfern']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('寒髓镇邪与灵壤供奉镇守事件 ', () => {
 it('寒髓镇邪：可消耗寒髓莲镇阴护场并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 21;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.frostmarrow-ward');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.frostmarrow']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('灵壤供奉：巡逻巡守兽可押运培土，省下一份灵壤肥并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 22;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-offering');
 state.guardBeasts.push({ id: 79, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 79, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('阵核供奉与封藏供奉镇守事件 ', () => {
 it('阵核供奉：可消耗阵核镇煞并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 23;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-tribute');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('封藏供奉：巡逻巡守兽可押运入库，省下一份封藏灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 24;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-tribute');
 state.guardBeasts.push({ id: 80, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 80, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('青苔清理与药酒供奉镇守事件 ', () => {
 it('青苔清理：可消耗青苔堆肥并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 25;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.mossling-cleanup');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.mossling']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('药酒供奉：巡逻巡守兽可押运奠酒，省下一份药酒并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 26;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-offering');
 state.guardBeasts.push({ id: 81, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 81, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('药膏备储与晾晒灵草备储镇守事件 ', () => {
 it('药膏备储：可消耗药膏备储并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 27;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-stockpile');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('晾晒灵草备储：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 28;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-stockpile');
 state.guardBeasts.push({ id: 82, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 82, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});

describe('守军劳军与兽皮供奉镇守事件 ', () => {
 it('守军劳军：可消耗灵石劳军并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 29;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.guard-relief');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('兽皮供奉：巡逻巡守兽可猎妖代缴，省下一份内丹并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 30;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-pelt-tribute');
 state.guardBeasts.push({ id: 83, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 83, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('粟石草济荒与法宝碎件供奉镇守事件 ', () => {
 it('粟石草济荒：可消耗粟石草接济并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 31;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.stonegrain-relief');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.stonegrain']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('法宝碎件供奉：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 32;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.broken-talisman-tribute');
 state.guardBeasts.push({ id: 84, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 84, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('雾蕨宴与灵壤肥田祭镇守事件 ', () => {
 it('雾蕨宴：可消耗雾蕨入菜待客并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 33;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.mistfern-feast');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.mistfern']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('灵壤肥田祭：巡逻巡守兽可押运培土，省下一份灵壤肥并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 34;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-field-rite');
 state.guardBeasts.push({ id: 85, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 85, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('露根草汤药与和合叶汤药镇守事件 ', () => {
 it('露根草汤药：可消耗露根草熬汤防疫并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 35;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dewroot-tonic');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.dewroot']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('和合叶汤药：巡逻巡守兽可入山采办，省下一份和合叶并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 36;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.balmleaf-tonic');
 state.guardBeasts.push({ id: 86, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 86, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.balmleaf']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('朝阳菇宴与粟石草宴镇守事件 ', () => {
 it('朝阳菇宴：可消耗朝阳菇入席并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 37;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.suncap-feast');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.suncap']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('粟石草宴：巡逻巡守兽可押粮，省下一份粟石草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 38;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.stonegrain-feast');
 state.guardBeasts.push({ id: 87, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 87, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.stonegrain']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('残卷归档与阵核备储镇守事件 ', () => {
 it('残卷归档：可消耗残卷归档并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 39;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-archive');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('阵核备储：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 40;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-stockpile');
 state.guardBeasts.push({ id: 88, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 88, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('封藏归档与药酒归档镇守事件 ', () => {
 it('封藏归档：可消耗封藏灵草归档并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 41;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-archive');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('药酒归档：巡逻巡守兽可押运入库，省下一份药酒并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 42;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-archive');
 state.guardBeasts.push({ id: 89, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 89, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('药膏归档与灵石节祭镇守事件 ', () => {
 it('药膏归档：可消耗药膏归档备灾并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 43;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-archive');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('灵石节祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 44;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-festival');
 state.guardBeasts.push({ id: 90, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 90, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('法宝铸坊与内丹铸坊镇守事件 ', () => {
 it('法宝铸坊：可消耗破损法宝批量熔炼并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 45;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-forge');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('内丹铸坊：巡逻巡守兽可猎妖代缴，省下一份内丹并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 46;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-forge');
 state.guardBeasts.push({ id: 91, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 91, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('阵核铸坊与灵壤堆坊镇守事件 ', () => {
 it('阵核铸坊：可消耗阵核批量铸阵并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 47;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-forge');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('灵壤堆坊：巡逻巡守兽可押运堆沤，省下一份灵壤肥并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 48;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-forge');
 state.guardBeasts.push({ id: 92, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 92, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('封藏铸坊与晾晒铸坊镇守事件 ', () => {
 it('封藏铸坊：可消耗封藏灵草批量炼材并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 49;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-forge');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('晾晒铸坊：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 50;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-forge');
 state.guardBeasts.push({ id: 93, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 93, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('药酒铸坊与药膏铸坊镇守事件 ', () => {
 it('药酒铸坊：可消耗药酒批量陈酿并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 51;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-forge');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('药膏铸坊：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 52;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-forge');
 state.guardBeasts.push({ id: 94, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 94, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('残卷大批归档与灵石大批献祭镇守事件 ', () => {
 it('残卷大批归档：可消耗残卷大批归档并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 53;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-archive-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('灵石大批献祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 54;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-tribute-bulk');
 state.guardBeasts.push({ id: 95, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 95, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('内丹大批与碎件大批镇守事件 ', () => {
 it('内丹大批：可消耗内丹大批炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 55;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('碎件大批：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 56;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-bulk');
 state.guardBeasts.push({ id: 96, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 96, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('青苔大批与封藏大批镇守事件 ', () => {
 it('青苔大批：可消耗青苔大批堆肥并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 57;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.mossling-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.mossling']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('封藏大批：巡逻巡守兽可押运入库，省下一份封藏灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 58;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-bulk');
 state.guardBeasts.push({ id: 97, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 97, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('露根草大批与朝阳菇大批镇守事件 ', () => {
 it('露根草大批：可消耗露根草大批储药并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 59;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dewroot-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.dewroot']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('朝阳菇大批：巡逻巡守兽可采办，省下一份朝阳菇并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 60;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.suncap-bulk');
 state.guardBeasts.push({ id: 98, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 98, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.suncap']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('粟石草大批与和合叶大批镇守事件 ', () => {
 it('粟石草大批：可消耗粟石草大批储粮并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 61;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.stonegrain-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.stonegrain']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('和合叶大批：巡逻巡守兽可入山采办，省下一份和合叶并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 62;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.balmleaf-bulk');
 state.guardBeasts.push({ id: 99, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 99, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.balmleaf']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('残卷大批与药酒大批镇守事件 ', () => {
 it('残卷大批：可消耗残卷大批归档并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 63;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('药酒大批：巡逻巡守兽可押运入库，省下一份药酒并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 64;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-bulk');
 state.guardBeasts.push({ id: 100, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 100, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('药膏大批与晾晒灵草大批镇守事件 ', () => {
 it('药膏大批：可消耗药膏大批熬制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 65;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('晾晒灵草大批：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 66;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-bulk');
 state.guardBeasts.push({ id: 101, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 101, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('阵核大批与灵壤肥大批镇守事件 ', () => {
 it('阵核大批：可消耗阵核大批铸阵并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 67;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-bulk');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('灵壤肥大批：巡逻巡守兽可押运堆沤，省下一份灵壤肥并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 68;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-bulk');
 state.guardBeasts.push({ id: 102, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 102, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('灵石大祭与内丹大祭镇守事件 ', () => {
 it('灵石大祭：可消耗灵石大祭镇场并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 69;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('内丹大祭：巡逻巡守兽可猎妖代缴，省下一份内丹并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 70;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-grand');
 state.guardBeasts.push({ id: 103, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 103, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('碎件大祭与封藏大祭镇守事件 ', () => {
 it('碎件大祭：可消耗碎件大祭熔炼并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 71;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('封藏大祭：巡逻巡守兽可押运入库，省下一份封藏灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 72;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-grand');
 state.guardBeasts.push({ id: 104, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 104, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('阵核大祭与灵壤肥大祭镇守事件 ', () => {
 it('阵核大祭：可消耗阵核大祭铸制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 73;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('灵壤肥大祭：巡逻巡守兽可押运培土，省下一份灵壤肥并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 74;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-grand');
 state.guardBeasts.push({ id: 105, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 105, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('晾晒灵草大祭与药酒大祭镇守事件 ', () => {
 it('晾晒灵草大祭：可消耗晾晒灵草大祭祭祖并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 75;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('药酒大祭：巡逻巡守兽可押运奠酒，省下一份药酒并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 76;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-grand');
 state.guardBeasts.push({ id: 106, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 106, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('药膏大祭与残卷大祭镇守事件 ', () => {
 it('药膏大祭：可消耗药膏大祭熬制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 77;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('残卷大祭：巡逻巡守兽可押运入库，省下一份残卷并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 78;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-grand');
 state.guardBeasts.push({ id: 107, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 107, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('青苔大祭与露根草大祭镇守事件 ', () => {
 it('青苔大祭：可消耗青苔大祭堆肥并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 79;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.mossling-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.mossling']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('露根草大祭：巡逻巡守兽可掘根采办，省下一份露根草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 80;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dewroot-grand');
 state.guardBeasts.push({ id: 108, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 108, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.dewroot']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('朝阳菇大祭与粟石草大祭镇守事件 ', () => {
 it('朝阳菇大祭：可消耗朝阳菇大祭入宴并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 81;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.suncap-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.suncap']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('粟石草大祭：巡逻巡守兽可押粮，省下一份粟石草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 82;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.stonegrain-grand');
 state.guardBeasts.push({ id: 109, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 109, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.stonegrain']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('和合叶大祭与雾蕨大祭镇守事件 ', () => {
 it('和合叶大祭：可消耗和合叶大祭熬汤并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 83;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.balmleaf-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.balmleaf']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('雾蕨大祭：巡逻巡守兽可入山采办，省下一份雾蕨并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 84;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.mistfern-grand');
 state.guardBeasts.push({ id: 110, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 110, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.mistfern']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('寒髓莲大祭与百年灵石祭镇守事件 ', () => {
 it('寒髓莲大祭：可消耗寒髓莲大祭镇阴护场并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 85;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.frostmarrow-grand');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['herb.frostmarrow']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('百年灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 86;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-centennial');
 state.guardBeasts.push({ id: 111, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 111, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('百年内丹祭与百年碎件祭镇守事件 ', () => {
 it('百年内丹祭：可消耗内丹大祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 87;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-centennial');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('百年碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 88;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-centennial');
 state.guardBeasts.push({ id: 112, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 112, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('百年封藏祭与百年晾晒祭镇守事件 ', () => {
 it('百年封藏祭：可消耗封藏灵草大祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 89;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-centennial');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('百年晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 90;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-centennial');
 state.guardBeasts.push({ id: 113, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 113, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('百年药酒祭与百年药膏祭镇守事件 ', () => {
 it('百年药酒祭：可消耗药酒大祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 91;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-centennial');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('百年药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 92;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-centennial');
 state.guardBeasts.push({ id: 114, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 114, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('百年残卷祭与百年阵核祭镇守事件 ', () => {
 it('百年残卷祭：可消耗残卷大祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 93;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-centennial');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('百年阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 94;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-centennial');
 state.guardBeasts.push({ id: 115, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 115, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('百年灵壤肥祭与千年纪元灵石祭镇守事件 ', () => {
 it('百年灵壤肥祭：可消耗灵壤肥大祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 95;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-centennial');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('千年纪元灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 96;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-millennium');
 state.guardBeasts.push({ id: 116, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 116, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('千年内丹祭与千年碎件祭镇守事件 ', () => {
 it('千年内丹祭：可消耗内丹千年祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 97;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-millennium');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('千年碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 98;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-millennium');
 state.guardBeasts.push({ id: 117, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 117, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('千年封藏祭与千年晾晒祭镇守事件 ', () => {
 it('千年封藏祭：可消耗封藏灵草千年祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 99;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-millennium');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('千年晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 100;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-millennium');
 state.guardBeasts.push({ id: 118, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 118, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('千年药酒祭与千年药膏祭镇守事件 ', () => {
 it('千年药酒祭：可消耗药酒千年祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 101;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-millennium');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('千年药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 102;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-millennium');
 state.guardBeasts.push({ id: 119, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 119, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('千年残卷祭与千年阵核祭镇守事件 ', () => {
 it('千年残卷祭：可消耗残卷千年祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 103;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-millennium');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('千年阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 104;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-millennium');
 state.guardBeasts.push({ id: 120, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 120, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('千年灵壤肥祭与万古灵石祭镇守事件 ', () => {
 it('千年灵壤肥祭：可消耗灵壤肥千年祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 105;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-millennium');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('万古灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 106;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-eternal');
 state.guardBeasts.push({ id: 121, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 121, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('万古内丹祭与万古碎件祭镇守事件 ', () => {
 it('万古内丹祭：可消耗内丹万古祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 107;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-eternal');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('万古碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 108;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-eternal');
 state.guardBeasts.push({ id: 122, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 122, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('万古封藏祭与万古晾晒祭镇守事件 ', () => {
 it('万古封藏祭：可消耗封藏灵草万古祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 109;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-eternal');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('万古晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 110;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-eternal');
 state.guardBeasts.push({ id: 123, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 123, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('万古药酒祭与万古药膏祭镇守事件 ', () => {
 it('万古药酒祭：可消耗药酒万古祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 111;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-eternal');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('万古药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 112;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-eternal');
 state.guardBeasts.push({ id: 124, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 124, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('万古残卷祭与万古阵核祭镇守事件 ', () => {
 it('万古残卷祭：可消耗残卷万古祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 113;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-eternal');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('万古阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 114;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-eternal');
 state.guardBeasts.push({ id: 125, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 125, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('万古灵壤肥祭与终焉灵石祭镇守事件 ', () => {
 it('万古灵壤肥祭：可消耗灵壤肥万古祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 115;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-eternal');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终焉灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 116;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-final');
 state.guardBeasts.push({ id: 126, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 126, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终焉内丹祭与终焉碎件祭镇守事件 ', () => {
 it('终焉内丹祭：可消耗内丹终焉祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 117;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-final');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终焉碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 118;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-final');
 state.guardBeasts.push({ id: 127, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 127, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终焉封藏祭与终焉晾晒祭镇守事件 ', () => {
 it('终焉封藏祭：可消耗封藏灵草终焉祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 119;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-final');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终焉晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 120;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-final');
 state.guardBeasts.push({ id: 128, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 128, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终焉药酒祭与终焉药膏祭镇守事件 ', () => {
 it('终焉药酒祭：可消耗药酒终焉祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 121;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-final');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终焉药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 122;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-final');
 state.guardBeasts.push({ id: 129, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 129, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终焉残卷祭与终焉阵核祭镇守事件 ', () => {
 it('终焉残卷祭：可消耗残卷终焉祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 123;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-final');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终焉阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 124;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-final');
 state.guardBeasts.push({ id: 130, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 130, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终焉灵壤肥祭与终极灵石祭镇守事件 ', () => {
 it('终焉灵壤肥祭：可消耗灵壤肥终焉祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 125;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-final');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终极灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 126;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-ultimate');
 state.guardBeasts.push({ id: 131, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 131, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终极内丹祭与终极碎件祭镇守事件 ', () => {
 it('终极内丹祭：可消耗内丹终极祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 127;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-ultimate');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终极碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 128;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-ultimate');
 state.guardBeasts.push({ id: 132, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 132, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终极封藏祭与终极晾晒祭镇守事件 ', () => {
 it('终极封藏祭：可消耗封藏灵草终极祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 129;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-ultimate');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终极晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 130;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-ultimate');
 state.guardBeasts.push({ id: 133, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 133, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终极药酒祭与终极药膏祭镇守事件 ', () => {
 it('终极药酒祭：可消耗药酒终极祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 131;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-ultimate');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终极药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 132;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-ultimate');
 state.guardBeasts.push({ id: 134, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 134, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终极残卷祭与终极阵核祭镇守事件 ', () => {
 it('终极残卷祭：可消耗残卷终极祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 133;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-ultimate');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('终极阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 134;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-ultimate');
 state.guardBeasts.push({ id: 135, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 135, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('终极灵壤肥祭与无上灵石祭镇守事件 ', () => {
 it('终极灵壤肥祭：可消耗灵壤肥终极祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 135;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-ultimate');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('无上灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 136;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-supreme');
 state.guardBeasts.push({ id: 136, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 136, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('无上内丹祭与无上碎件祭镇守事件 ', () => {
 it('无上内丹祭：可消耗内丹无上祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 137;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-supreme');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('无上碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 138;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-supreme');
 state.guardBeasts.push({ id: 137, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 137, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('无上封藏祭与无上晾晒祭镇守事件 ', () => {
 it('无上封藏祭：可消耗封藏灵草无上祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 139;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-supreme');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('无上晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 140;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-supreme');
 state.guardBeasts.push({ id: 138, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 138, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('无上药酒祭与无上药膏祭镇守事件 ', () => {
 it('无上药酒祭：可消耗药酒无上祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 141;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-supreme');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('无上药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 142;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-supreme');
 state.guardBeasts.push({ id: 139, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 139, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('无上残卷祭与无上阵核祭镇守事件 ', () => {
 it('无上残卷祭：可消耗残卷无上祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 143;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-supreme');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('无上阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 144;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-supreme');
 state.guardBeasts.push({ id: 140, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 140, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('无上灵壤肥祭与巅峰灵石祭镇守事件 ', () => {
 it('无上灵壤肥祭：可消耗灵壤肥无上祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 145;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-supreme');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巅峰灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 146;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-apex');
 state.guardBeasts.push({ id: 141, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 141, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('巅峰内丹祭与巅峰碎件祭镇守事件 ', () => {
 it('巅峰内丹祭：可消耗内丹巅峰祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 147;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-apex');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巅峰碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 148;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-apex');
 state.guardBeasts.push({ id: 142, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 142, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('巅峰封藏祭与巅峰晾晒祭镇守事件 ', () => {
 it('巅峰封藏祭：可消耗封藏灵草巅峰祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 149;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-apex');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巅峰晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 150;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-apex');
 state.guardBeasts.push({ id: 143, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 143, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('巅峰药酒祭与巅峰药膏祭镇守事件 ', () => {
 it('巅峰药酒祭：可消耗药酒巅峰祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 151;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-apex');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巅峰药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 152;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-apex');
 state.guardBeasts.push({ id: 144, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 144, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('巅峰残卷祭与巅峰阵核祭镇守事件 ', () => {
 it('巅峰残卷祭：可消耗残卷巅峰祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 153;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-apex');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('巅峰阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 154;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-apex');
 state.guardBeasts.push({ id: 145, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 145, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('巅峰灵壤肥祭与极巅灵石祭镇守事件 ', () => {
 it('巅峰灵壤肥祭：可消耗灵壤肥巅峰祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 155;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-apex');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('极巅灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 156;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-zenith');
 state.guardBeasts.push({ id: 146, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 146, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('极巅内丹祭与极巅碎件祭镇守事件 ', () => {
 it('极巅内丹祭：可消耗内丹极巅祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 157;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-zenith');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('极巅碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 158;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-zenith');
 state.guardBeasts.push({ id: 147, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 147, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('极巅封藏祭与极巅晾晒祭镇守事件 ', () => {
 it('极巅封藏祭：可消耗封藏灵草极巅祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 159;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-zenith');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('极巅晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 160;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-zenith');
 state.guardBeasts.push({ id: 148, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 148, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('极巅药酒祭与极巅药膏祭镇守事件 ', () => {
 it('极巅药酒祭：可消耗药酒极巅祭敬先并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 161;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.wine-zenith');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.herbal-wine']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('极巅药膏祭：巡逻巡守兽可押运入库，省下一份药膏并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 162;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.poultice-zenith');
 state.guardBeasts.push({ id: 149, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 149, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-poultice']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('极巅残卷祭与极巅阵核祭镇守事件 ', () => {
 it('极巅残卷祭：可消耗残卷极巅祭补全并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 163;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.recipe-zenith');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.recipe-fragment']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('极巅阵核祭：巡逻巡守兽可熔炼代缴，省下一份阵核并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 164;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.array-core-zenith');
 state.guardBeasts.push({ id: 150, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 150, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.array-core']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('极巅灵壤肥祭与永镇灵石祭镇守事件 ', () => {
 it('极巅灵壤肥祭：可消耗灵壤肥极巅祭祭土并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 165;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.compost-zenith');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-compost']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('永镇灵石祭：巡逻巡守兽可代为押运，省下一份灵石并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 166;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.spirit-stone-eternal-zenith');
 state.guardBeasts.push({ id: 151, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 151, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.spirit-stone']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('永镇内丹祭与永镇碎件祭镇守事件 ', () => {
 it('永镇内丹祭：可消耗内丹永镇祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 167;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.beast-core-eternal-zenith');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.beast-core']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('永镇碎件祭：巡逻巡守兽可拆解代缴，省下一份碎件并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 168;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.talisman-eternal-zenith');
 state.guardBeasts.push({ id: 152, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 152, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.broken-talisman']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});


describe('永镇封藏祭与永镇晾晒祭镇守事件 ', () => {
 it('永镇封藏祭：可消耗封藏灵草永镇祭炼制并降低压力', () => {
 const { state, ctx } = setup();
 state.day = 169;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.sealed-eternal-zenith');
 mutateItem(state.player, incident.itemId, incident.count);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.sealed-herb']?.count ?? 0).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief);
 });
 it('永镇晾晒祭：巡逻巡守兽可晒场翻理，省下一份晾晒灵草并额外减压', () => {
 const { state, ctx } = setup();
 state.day = 170;
 const incident = getCurrentStayingWorldIncident(state)!;
 expect(incident.id).toBe('incident.dried-herb-eternal-zenith');
 state.guardBeasts.push({ id: 153, vigor: 2, maxVigor: 3, bond: 40, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 mutateItem(state.player, incident.itemId, incident.count);
 applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 153, tileId: state.tiles[0]!.id }, ctx);
 const beforePressure = state.stayingWorld.wardingPressure;
 expect(resolveStayingWorldIncident(state, ctx).ok).toBe(true);
 expect(state.player.inventory['item.dried-herb']?.count ?? 0).toBe(1);
 expect(state.stayingWorld.wardingPressure).toBe(beforePressure - incident.pressureRelief - 4_000);
 });
});
