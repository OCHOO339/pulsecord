import { createPrivateKey } from 'node:crypto';

export function readPublisherKey(value) {
    const pem = value.trim().replace(/^\uFEFF/, '').replace(/\\r\\n|\\n|\\r/g, '\n');
    let key;
    try { key = createPrivateKey(pem); }
    catch {
        throw Error('Invalid publisher private key. Set PULSECORD_UPDATE_KEY_PEM to the complete PEM file contents, including BEGIN PRIVATE KEY and END PRIVATE KEY, not a file path, public key or GitHub token.');
    }
    if (key.asymmetricKeyType !== 'ed25519') throw Error('The publisher private key must be an Ed25519 key matching updates.json.');
    return key;
}
