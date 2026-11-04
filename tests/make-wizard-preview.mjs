import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
const target = 'dist/qa/wizard-preview';
await mkdir(target + '/assets', { recursive: true });
for (const name of ['ui.css', 'ui.js', 'wizard.js']) await copyFile('packages/installer/' + name, target + '/' + name);
await copyFile('pulse.png', target + '/assets/pulsecord-logo.png');
let html = await readFile('packages/installer/index.html', 'utf8');
html = html.replace('<script src="wizard.js">', '<script src="preview-bridge.js"></script><script src="wizard.js">');
await writeFile(target + '/installer.html', html);
const license = (await Promise.all(['packages/installer/license-notice.txt', 'LICENSE', 'NOTICE.md'].map(file => readFile(file, 'utf8')))).join('\n\n');
await writeFile(target + '/preview-bridge.js', `
let progressListener = () => {};
window.pulsecord = {
    list: async () => [
        { name: 'Discord 1.0.0 (exemple)', resources: 'C:/Exemple/Discord/app-1.0.0/resources' },
        { name: 'DiscordCanary 1.0.0 (exemple)', resources: 'C:/Exemple/DiscordCanary/app-1.0.0/resources' }
    ],
    choose: async () => window.pulsecord.list(),
    license: async () => ${JSON.stringify(license)},
    windowControl: async () => {},
    onProgress: listener => { progressListener = listener; return () => { progressListener = () => {}; }; },
    operateMany: async () => {
        progressListener({ label: 'Aperçu visuel uniquement : les opérations sont désactivées.', value: 0, level: 'info' });
        return { cancelled: false, ok: false, results: [] };
    }
};
`);
await writeFile(target + '/index.html', '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu PulseCord Installer</title><style>body{margin:0;padding:28px;background:#17181d;color:#bbb;font:13px system-ui;text-align:center}iframe{display:block;margin:24px auto;border:0;width:600px;height:440px;border-radius:8px}p{max-width:700px;margin:auto}</style></head><body><p>Aperçu de l’interface • données d’exemple • aucune installation n’est effectuée</p><iframe src="installer.html" title="Assistant PulseCord"></iframe></body></html>');
console.log('Read-only installer preview ready.');
