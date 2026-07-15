import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config';

describe('Playwright 作品集产物配置', () => {
 it('keeps portfolio screenshots outside Playwright managed output cleanup', () => {
 expect(playwrightConfig.outputDir).toBe('test-results/playwright');
 expect(playwrightConfig.outputDir).not.toBe('test-results');
 });

 it('enables a readable WebGL canvas buffer for browser screenshots', () => {
 expect(playwrightConfig.webServer).toMatchObject({
 env: { VITE_PRESERVE_DRAWING_BUFFER: 'true' },
 });
 });
});
