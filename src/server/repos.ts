import { promises as fs } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';

export interface RepoEntry {
  name: string;
  path: string;
  branch?: string;
}

export function resolveReposRoot(reposRoot?: string): string {
  const root = reposRoot?.trim() || '~/Desktop/git';
  return resolve(root === '~' || root.startsWith('~/') ? join(homedir(), root.slice(1)) : root);
}

// Reads HEAD straight from disk (no git spawn). A worktree's `.git` is a file pointing at its gitdir.
async function readBranch(gitPath: string, isFile: boolean): Promise<string | undefined> {
  try {
    let gitDir = gitPath;
    if (isFile) {
      const pointer = (await fs.readFile(gitPath, 'utf-8')).match(/^gitdir:\s*(.+)$/m)?.[1];
      if (!pointer) return undefined;
      gitDir = resolve(dirname(gitPath), pointer.trim());
    }
    const head = (await fs.readFile(join(gitDir, 'HEAD'), 'utf-8')).trim();
    return head.startsWith('ref: ') ? head.replace(/^ref: refs\/heads\//, '') : head.slice(0, 7);
  } catch {
    return undefined;
  }
}

// Direct children of `root` that contain a `.git` directory or file (worktree).
export async function listRepos(root: string): Promise<RepoEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(root);
  } catch {
    return [];
  }

  const entries = await Promise.all(
    names
      .filter((name) => !name.startsWith('.'))
      .map(async (name): Promise<RepoEntry | null> => {
        const path = join(root, name);
        try {
          const gitStat = await fs.stat(join(path, '.git'));
          const branch = await readBranch(join(path, '.git'), gitStat.isFile());
          return { name, path, ...(branch ? { branch } : {}) };
        } catch {
          return null;
        }
      }),
  );

  return entries
    .filter((entry): entry is RepoEntry => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
