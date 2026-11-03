import { spawnSync } from 'node:child_process';
import { resolve, delimiter } from 'node:path';
import { createRequire } from 'node:module';
import { prepareWindowsTools } from './windows-tools.mjs';
const require = createRequire(import.meta.url);
const assetEnv = { ...process.env }; delete assetEnv.ELECTRON_RUN_AS_NODE;
const assets = spawnSync(require('electron'), ['scripts/brand-assets.cjs'], { stdio: 'inherit', env: assetEnv, windowsHide: true });
if (assets.status !== 0) process.exit(assets.status ?? 1);
const cache = process.platform === 'win32' ? await prepareWindowsTools() : undefined;
const result = spawnSync(process.execPath, ['node_modules/electron-builder/cli.js', '--config', 'packages/installer/builder.json', '--publish', 'never'], {
    stdio: 'inherit', env: { ...process.env, ...(cache ? { ELECTRON_BUILDER_CACHE: cache } : {}), PATH: resolve('scripts/bin') + delimiter + process.env.PATH }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
