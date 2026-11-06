import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitNotes, notesForPush } from '../scripts/release-notes.mjs';

test('release notes list each summary followed by its description', () => {
    assert.equal(commitNotes(['summary\n\ndescription']), '- summary\n- description\n');
    assert.equal(commitNotes(['summary1\n\ndescription1', 'summary2\n\ndescription2']), '- summary1\n- description1\n- summary2\n- description2\n');
    assert.equal(commitNotes(['summary\n']), '- summary\n');
    assert.equal(commitNotes(['summary\r\n\r\nline1\r\nline2']), '- summary\n- line1\n  line2\n');
});

test('push notes include only pushed commits in chronological order', async t => {
    const root = await mkdtemp(join(tmpdir(), 'pulsecord-notes-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
    git(['init', '-q']);
    git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.com']);
    const commit = message => { git(['-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', message]); return git(['rev-parse', 'HEAD']); };
    const before = commit('Existing release');
    const first = commit('summary1\n\ndescription1');
    const after = commit('summary2\n\ndescription2');
    assert.equal(notesForPush({ before, after }, root), '- summary1\n- description1\n- summary2\n- description2\n');
    assert.equal(notesForPush({ before: first, after }, root), '- summary2\n- description2\n');
    assert.equal(notesForPush({ after }, root), '- summary2\n- description2\n');
    assert.match(notesForPush({ before: '0'.repeat(40), after }, root), /^- Existing release\n- summary1/);
    assert.throws(() => notesForPush({ before: '--all', after }, root), /Invalid commit SHA/);
});
