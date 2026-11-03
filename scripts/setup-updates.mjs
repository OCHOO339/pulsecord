import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const config = JSON.parse(await readFile('updates.json', 'utf8'));
if (new URL(config.manifestUrl).protocol !== 'https:') throw Error('Update feed must use HTTPS');
await mkdir('.pulsecord-publisher', { recursive: true });
let key;
try { key = createPrivateKey(await readFile('.pulsecord-publisher/private-key.pem')); }
catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (config.publicKey) throw Error('The existing publisher key is missing. Restore its private backup instead of generating a new identity.');
    const pair = generateKeyPairSync('ed25519'); key = pair.privateKey;
    await writeFile('.pulsecord-publisher/private-key.pem', key.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
}
const publicKey = createPublicKey(key).export({ type: 'spki', format: 'pem' });
if (config.publicKey && config.publicKey !== publicKey) throw Error('This private key does not match the public key already trusted by PulseCord');
config.publicKey = publicKey;
await writeFile('updates.json', JSON.stringify(config, null, 2) + '\n');
console.log('Public update key configured. Keep .pulsecord-publisher/private-key.pem private and backed up.');
