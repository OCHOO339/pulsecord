import { spawnSync } from 'node:child_process';
import { resolve, delimiter } from 'node:path';
import { createRequire } from 'node:module';
import { prepareWindowsTools } from './windows-tools.mjs';
const require = createRequire(import.meta.url);
const assetEnv = { ...process.env }; delete assetEnv.ELECTRON_RUN_AS_NODE;
const assets = spawnSync(require('electron'), ['scripts/brand-assets.cjs'], { stdio: 'inherit', env: assetEnv, windowsHide: true });
if (assets.status !== 0) process.exit(assets.status ?? 1);
const cache = process.platform === 'win32' ? await prepareWindowsTools() : undefined;
function build(extra = []) {
    const result = spawnSync(process.execPath, ['node_modules/electron-builder/cli.js', '--config', 'packages/installer/builder.json', '--publish', 'never', ...extra], {
        stdio: 'inherit', env: { ...process.env, ...(cache ? { ELECTRON_BUILDER_CACHE: cache } : {}), PATH: resolve('scripts/bin') + delimiter + process.env.PATH }
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}
if (process.platform === 'darwin') {
    // Sign the final merged universal app, not the individual slices. No Apple
    // certificate is required for this explicit ad-hoc development signature.
    build(['--mac', '--universal', '--dir']);
    const application = resolve('release/mac-universal/PulseCord Installer.app');
    const signed = spawnSync('codesign', ['--force', '--deep', '--sign', '-', application], { stdio: 'inherit' });
    if (signed.error) throw signed.error;
    if (signed.status !== 0) process.exit(signed.status ?? 1);
    build(['--mac', 'dmg', '--universal', '--prepackaged', application]);
} else build();
