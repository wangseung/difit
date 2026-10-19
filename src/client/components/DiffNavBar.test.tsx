import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommitInfo, DiffSelection, RevisionsResponse } from '../../types/diff';
import { createDiffSelection } from '../../utils/diffSelection';

import { DiffNavBar } from './DiffNavBar';

const commits: CommitInfo[] = ['c1', 'c2', 'c3'].map((hash) => ({
  hash: `${hash}0000000`,
  shortHash: hash,
  message: `commit ${hash}`,
}));

const options = {
  specialOptions: [],
  branches: [{ name: 'feature', current: true }],
  remoteBranches: ['origin/develop'],
  commits: [],
  originDefaultBranch: 'origin/develop',
} as unknown as RevisionsResponse;

function Harness() {
  const [selection, setSelection] = useState<DiffSelection>(
    createDiffSelection('origin/develop', 'HEAD', 'merge-base'),
  );
  return <DiffNavBar options={options} selection={selection} onSelectDiff={setSelection} />;
}

describe('DiffNavBar', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ commits }) } as Response),
    );
  });

  it('keeps the branch range fixed while stepping through commits', async () => {
    render(<Harness />);
    expect(await screen.findByText('3 commits')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next commit' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'By commit' }));
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous commit' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next commit' }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next commit' }));
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next commit' })).toBeDisabled();

    // range-commits is only ever queried for the branch range, never for a single commit
    for (const [url] of vi.mocked(global.fetch).mock.calls) {
      expect(String(url)).toContain('base=origin%2Fdevelop');
    }

    fireEvent.click(screen.getByRole('button', { name: 'All changes' }));
    await waitFor(() => expect(screen.getByText('3 commits')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Next commit' })).not.toBeInTheDocument();
  });
});
