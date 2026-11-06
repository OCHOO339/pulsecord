// Verify the public update exactly as a client would after a release is published.
import { readFile } from 'node:fs/promises';
import { verifyRelease, verifyDownload } from '../packages/updates/protocol.mjs';

const config = JSON.parse(await readFile('updates.json', 'utf8'));
const expected = verifyRelease(JSON.parse(await readFile('release/updates/pulsecord-update.json', 'utf8')), config.publicKey, process.platform, process.arch);
let lastError;
for (let attempt = 0; attempt < 15; attempt++) {
    try {
        const response = await fetch(config.manifestUrl, { headers: { 'User-Agent': 'PulseCord Publisher', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw Error(`Public manifest returned ${response.status}`);
        const release = verifyRelease(await response.json(), config.publicKey, process.platform, process.arch);
        if (release.bundleId !== expected.bundleId) throw Error('The public update does not match this build yet');
        const payload = await fetch(release.bundleUrl, { signal: AbortSignal.timeout(60000) });
        if (!payload.ok) throw Error(`Public bundle returned ${payload.status}`);
        verifyDownload(Buffer.from(await payload.arrayBuffer()), release);
        console.log(`Published update verified: ${release.bundleId}`);
        process.exit(0);
    } catch (error) { lastError = error; }
    if (attempt < 14) await new Promise(resolve => setTimeout(resolve, 2000));
}
throw new Error('Release published, but public update verification failed', { cause: lastError });
