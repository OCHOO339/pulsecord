// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash, verify } from 'node:crypto';
export const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
export function bundleId(files) {
    return createHash('sha256').update(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
}
export function versionParts(value) {
    if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) throw Error('Invalid release version');
    const parts = value.split('.').map(Number);
    if (!parts.every(Number.isSafeInteger)) throw Error('Invalid release version');
    return parts;
}
export function isOlder(candidate, installed) {
    const a = versionParts(candidate); const b = versionParts(installed);
    for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] < b[i]; }
    return false;
}
export function verifyRelease(envelope, key, platform, arch) {
    if (!envelope || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string' || envelope.payload.length > 128000) throw Error('Invalid update manifest');
    const payload = Buffer.from(envelope.payload, 'base64');
    if (!verify(null, payload, key, Buffer.from(envelope.signature, 'base64'))) throw Error('Update signature verification failed');
    const release = JSON.parse(payload.toString('utf8'));
    versionParts(release.version);
    if (release.format !== 1 || release.platform !== platform || release.arch !== arch) throw Error('This update is not compatible with this platform');
    if (!/^[a-f0-9]{64}$/.test(release.sha256) || !/^[a-f0-9]{64}$/.test(release.bundleId)) throw Error('Invalid release integrity data');
    if (!Number.isSafeInteger(release.size) || release.size < 1 || release.size > MAX_BUNDLE_BYTES) throw Error('Invalid update size');
    if (new URL(release.bundleUrl).protocol !== 'https:') throw Error('Update downloads require HTTPS');
    if (typeof release.changelog !== 'string' || release.changelog.length > 8000) throw Error('Invalid changelog');
    return release;
}
export function verifyDownload(bytes, release) {
    if (bytes.length !== release.size || createHash('sha256').update(bytes).digest('hex') !== release.sha256) throw Error('Downloaded update is corrupted');
}
