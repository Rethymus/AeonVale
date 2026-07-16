import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config';

describe('Playwright 试玩验收产物配置', () => {
  it('keeps review screenshots outside Playwright managed output cleanup', () => {
    expect(playwrightConfig.outputDir).toBe('test-results/playwright');
    expect(playwrightConfig.outputDir).not.toBe('test-results');
  });

  it('enables a readable WebGL canvas buffer for browser screenshots', () => {
    expect(playwrightConfig.webServer).toMatchObject({
      env: { VITE_PRESERVE_DRAWING_BUFFER: 'true' }
    });
  });

  it('embeds a stable non-empty revision in local public builds', () => {
    expect(playwrightConfig.webServer).toMatchObject({
      env: { VITE_BUILD_REVISION: 'playwright-test' }
    });
  });

  it('serializes CI browser smoke to avoid overloading hosted Chromium', () => {
    expect(playwrightConfig.workers).toBe(process.env.CI ? 1 : undefined);
  });
});
