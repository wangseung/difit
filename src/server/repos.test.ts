import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { listRepos } from './repos';

describe('listRepos', () => {
  let root = '';

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('lists direct children with .git (directory or worktree file) and their branch', async () => {
    root = mkdtempSync(join(tmpdir(), 'difit-repos-'));
    mkdirSync(join(root, 'plain', '.git'), { recursive: true });
    writeFileSync(join(root, 'plain', '.git', 'HEAD'), 'ref: refs/heads/feature/x\n');
    mkdirSync(join(root, 'wt-gitdir'));
    writeFileSync(join(root, 'wt-gitdir', 'HEAD'), 'abcdef1234567\n');
    mkdirSync(join(root, 'wt'));
    writeFileSync(join(root, 'wt', '.git'), `gitdir: ${join(root, 'wt-gitdir')}\n`);
    mkdirSync(join(root, 'not-a-repo'));
    mkdirSync(join(root, '.hidden', '.git'), { recursive: true });

    const repos = await listRepos(root);

    expect(repos.map((r) => [r.name, r.branch])).toEqual([
      ['plain', 'feature/x'],
      ['wt', 'abcdef1'],
    ]);
  });

  it('returns an empty list when the root does not exist', async () => {
    root = join(tmpdir(), 'difit-missing-root');
    await expect(listRepos(root)).resolves.toEqual([]);
  });
});
