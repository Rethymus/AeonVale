import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

describe('Vite 作品集构建配置', () => {
 it('保持 Pixi 分包警告阈值克制，避免 GitHub Pages 构建输出噪声', () => {
 expect(viteConfig.build?.chunkSizeWarningLimit).toBeGreaterThanOrEqual(600);
 expect(viteConfig.build?.chunkSizeWarningLimit).toBeLessThanOrEqual(700);
 });
});
