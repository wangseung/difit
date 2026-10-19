import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import type { Server } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';

import { fetch } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startServer } from './server.js';

let repo: string;
let server: Server | undefined;

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

const commit = (file: string, content: string) => {
  writeFileSync(join(repo, file), content);
  git('add', '.');
  git('commit', '-q', '-m', `edit ${file}`);
  return git('rev-parse', '--short', 'HEAD');
};

describe('diff cache invalidation on ref movement (real git repo)', () => {
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'difit-cache-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@t.t');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    commit('a.txt', 'one\n');
  });

  afterEach(async () => {
    await new Promise((r) => (server ? server.close(r) : r(undefined)));
    server = undefined;
    rmSync(repo, { recursive: true, force: true });
  });

  it('serves the new commit after the target branch moves, with and without ignoreWhitespace', async () => {
    const base = git('rev-parse', 'HEAD');
    const first = commit('a.txt', 'one\ntwo\n');
    const s = await startServer({
      preferredPort: 4971,
      openBrowser: false,
      repoPath: repo,
      selection: { baseCommitish: base, targetCommitish: 'main' },
    });
    server = s.server;
    const get = async (qs: string) =>
      (await (await fetch(`http://localhost:${s.port}/api/diff?${qs}`)).json()) as {
        targetCommitish: string;
      };

    expect((await get('ignoreWhitespace=true')).targetCommitish).toBe(first);
    expect((await get('')).targetCommitish).toBe(first);

    const second = commit('a.txt', 'one\ntwo\nthree\n');
    expect(second).not.toBe(first);

    expect((await get('ignoreWhitespace=true')).targetCommitish).toBe(second);
    expect((await get('')).targetCommitish).toBe(second);
  });
});
