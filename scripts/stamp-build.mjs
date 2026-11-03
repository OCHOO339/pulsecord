import { writeFile } from 'node:fs/promises';
import { sourceFingerprint } from './source-fingerprint.mjs';
await writeFile('upstream/equicord/dist/pulsecord-build.json', JSON.stringify({ sourceHash: sourceFingerprint() }, null, 2));
console.log('Recorded the source fingerprint of the successful PulseCord build.');
