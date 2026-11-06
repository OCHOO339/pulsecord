import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function commitNotes(messages) {
    return messages.flatMap(message => {
        const [summary, ...body] = message.trim().replaceAll('\r\n', '\n').split('\n');
        const description = body.join('\n').trim();
        return [summary && `- ${summary}`, description && `- ${description.replaceAll('\n', '\n  ')}`].filter(Boolean);
    }).join('\n') + '\n';
}

export function notesForPush(event, cwd = process.cwd()) {
    const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
    const after = event.after || process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']);
    const before = event.before;
    for (const sha of [before, after].filter(Boolean)) {
        if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sha)) throw Error('Invalid commit SHA in release event');
    }
    let commits;
    if (before) {
        if (!/^0+$/.test(before)) {
            // A force push can remove the previous head from the fetched history.
            try { git(['cat-file', '-e', `${before}^{commit}`]); }
            catch { git(['fetch', '--no-tags', 'origin', before]); }
        }
        commits = git(['rev-list', '--reverse', '--topo-order', /^0+$/.test(before) ? after : `${before}..${after}`]).split('\n').filter(Boolean);
    } else {
        // Manual dispatch publishes the selected commit's message.
        commits = [after];
    }
    if (!commits.length) throw Error('No commits found for release notes');
    return commitNotes(commits.map(sha => git(['show', '-s', '--format=%B', sha])));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
    const target = process.env.PULSECORD_RELEASE_NOTES || '.cache/release-notes.md';
    const notes = notesForPush(event);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, notes);
    console.log(`Release notes written to ${target}`);
}
