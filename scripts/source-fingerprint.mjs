import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
export function sourceFingerprint() {
    const names = ['brand.json', 'updates.json', 'upstream.lock.json', 'package.json', 'pnpm-lock.yaml', 'pulse.png', 'assets/pulsecord-inbox-banner.png'];
    function visit(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const file = `${dir}/${entry.name}`;
            if (file === 'packages/installer/assets' || file === 'packages/installer/loader.cjs') continue;
            if (entry.isDirectory()) visit(file); else if (entry.isFile()) names.push(file);
        }
    }
    visit('packages'); visit('scripts'); visit('assets/fonts');
    const hash = createHash('sha256');
    for (const name of names.sort()) hash.update(name + '\0').update(readFileSync(name)).update('\0');
    return hash.digest('hex');
}
