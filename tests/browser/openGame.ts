import type { Page } from '@playwright/test';

export interface CanvasPaintStats {
 sampled: number;
 painted: number;
 colors: number;
}

export interface CanvasPngSnapshot {
 dataUrl: string;
 width: number;
 height: number;
}

export interface AeonDebugSnapshot {
 hotbarIdx?: number;
 hotbarSlotKind?: string;
 hotbarSeedId?: string | null;
 locationIdx?: number;
 locationServiceIdx?: number;
 locationSelectionActive?: boolean;
 interactionPanelKind?: string;
 farmActionKind?: string;
 dialogueBeatId?: string | null;
 selectedLocationId?: string | null;
 selectedLocationServiceCommand?: string | null;
 postAscensionMode?: string;
 paused?: boolean;
 inventoryVisible?: boolean;
 cultivationPanelVisible?: boolean;
 shopIdx?: number;
 tradeIdx?: number;
 day?: number;
 season?: string;
 seasonDay?: number;
 playerHp?: number;
 playerStamina?: number;
 playerX?: number;
 playerY?: number;
 playerFacing?: string;
 frontTileX?: number;
 frontTileY?: number;
 frontTileTilled?: boolean;
 frontTileCropId?: string | number | null;
 frontTileCropStage?: string | null;
 frontTileCropGrowth?: number;
 frontTileWateredToday?: boolean;
 frontTileMoisture?: number;
 onboardingObjectiveId?: string | null;
 helpText?: string;
 todayBriefingTitle?: string;
 todayBriefingBody?: string;
 todayBriefingAssetId?: string | null;
 starterMosslingSeedCount?: number;
 starterDewrootSeedCount?: number;
 starterMosslingHerbCount?: number;
 starterDewrootHerbCount?: number;
 starterSpiritStoneCount?: number;
 inventoryItemCount?: number;
 shippingItemId?: string | null;
 shippingBinItemCount?: number;
}

export function gameEntryPath(): string {
 const basePath = process.env.PLAYWRIGHT_GAME_BASE_PATH ?? '/';
 return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

export async function openGame(page: Page): Promise<void> {
 await page.goto(gameEntryPath());
 const canvas = page.locator('canvas');
 await canvas.waitFor({ state: 'visible' });
 await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: unknown }).__AEON_DEBUG__ != null);
 await canvas.click({ position: { x: 10, y: 10 } });
}

export async function gameDebugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
 return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}

export async function clearIntroDialogue(page: Page): Promise<void> {
 await page.waitForTimeout(80);
 for (let i = 0; i < 6; i += 1) {
 const debug = await gameDebugSnapshot(page);
 if (debug.dialogueBeatId == null) return;
 await page.keyboard.press('Enter');
 await page.waitForTimeout(60);
 }
 await page.waitForFunction(() => {
 const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
 return debug?.dialogueBeatId == null;
 });
}

export async function canvasPaintStats(page: Page): Promise<CanvasPaintStats> {
 const snapshot = await canvasPngSnapshot(page);
 if (!snapshot) return { sampled: 0, painted: 0, colors: 0 };
 return paintStatsFromDataUrl(page, snapshot.dataUrl);
}

export async function canvasPngSnapshot(page: Page): Promise<CanvasPngSnapshot | null> {
 const direct = await page.evaluate((): CanvasPngSnapshot | null => {
 const canvas = document.querySelector('canvas');
 if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) return null;
 try {
 return {
 dataUrl: canvas.toDataURL('image/png'),
 width: canvas.width,
 height: canvas.height,
 };
 } catch {
 return null;
 }
 });
 if (direct?.dataUrl.startsWith('data:image/png;base64,')) {
 const directStats = await paintStatsFromDataUrl(page, direct.dataUrl);
 if (directStats.colors > 16) return direct;
 }

 const box = await page.evaluate(() => {
 const canvas = document.querySelector('canvas');
 if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) return null;
 const rect = canvas.getBoundingClientRect();
 return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
 });
 if (!box) return null;
 const screenshot = await page.locator('canvas').screenshot({ animations: 'disabled' });
 return {
 dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
 width: Math.round(box.width),
 height: Math.round(box.height),
 };
}

export async function paintStatsFromDataUrl(page: Page, dataUrl: string): Promise<CanvasPaintStats> {
 return page.evaluate(async (src): Promise<CanvasPaintStats> => {
 const image = new Image();
 image.src = src;
 await new Promise<void>((resolve, reject) => {
 image.onload = () => resolve();
 image.onerror = () => reject(new Error('canvas screenshot failed to load'));
 });

const canvas = document.createElement('canvas');
 canvas.width = image.naturalWidth;
 canvas.height = image.naturalHeight;
 const ctx = canvas.getContext('2d');
 if (!ctx) return { sampled: 0, painted: 0, colors: 0 };

ctx.drawImage(image, 0, 0);
 const { width, height } = canvas;
 const data = ctx.getImageData(0, 0, width, height).data;
 const colors = new Set<string>();
 let sampled = 0;
 let painted = 0;
 const step = Math.max(6, Math.floor(Math.min(width, height) / 64));

for (let y = 0; y < height; y += step) {
 for (let x = 0; x < width; x += step) {
 const index = (y * width + x) * 4;
 const alpha = data[index + 3] ?? 0;
 sampled += 1;
 if (alpha > 16) {
 painted += 1;
 colors.add(`${data[index]},${data[index + 1]},${data[index + 2]},${alpha}`);
 }
 }
 }

return { sampled, painted, colors: colors.size };
 }, dataUrl);
}
