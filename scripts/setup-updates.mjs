import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readPublisherKey } from './publisher-key.mjs';
const config = JSON.parse(await readFile('updates.json', 'utf8'));
if (new URL(config.manifestUrl).protocol !== 'https:') throw Error('Update feed must use HTTPS');
await mkdir('.pulsecord-publisher', { recursive: true });
let key;
const secret = process.env.PULSECORD_UPDATE_KEY_PEM;
if (secret !== undefined) {
    if (!secret.trim()) throw Error('Configure the PULSECORD_UPDATE_KEY_PEM repository secret with the existing publisher private key.');
    key = readPublisherKey(secret);
} else {
    try { key = readPublisherKey(await readFile('.pulsecord-publisher/private-key.pem', 'utf8')); }
    catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (config.publicKey) throw Error('The existing publisher key is missing. Restore its private backup instead of generating a new identity.');
        const pair = generateKeyPairSync('ed25519'); key = pair.privateKey;
        await writeFile('.pulsecord-publisher/private-key.pem', key.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
    }
}
const publicKey = createPublicKey(key).export({ type: 'spki', format: 'pem' });
if (config.publicKey && config.publicKey !== publicKey) throw Error('This private key does not match the public key already trusted by PulseCord');
if (secret !== undefined) await writeFile('.pulsecord-publisher/private-key.pem', key.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
config.publicKey = publicKey;
await writeFile('updates.json', JSON.stringify(config, null, 2) + '\n');
console.log('Public update key configured. Keep .pulsecord-publisher/private-key.pem private and backed up.');
