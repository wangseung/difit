import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { ChevronDown, ChevronLeft, ChevronRight, GitBranch, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { type CommitInfo, type DiffSelection, type RevisionsResponse } from '../../types/diff';
import { createDiffSelection, diffSelectionsEqual } from '../../utils/diffSelection';

interface DiffNavBarProps {
  options: RevisionsResponse;
  selection: DiffSelection;
  onSelectDiff: (selection: DiffSelection) => void;
}

interface Range {
  base: string;
  target: string;
}

const NAV_BUTTON =
  'flex items-center gap-1 px-2 py-1 text-xs bg-github-bg-tertiary border border-github-border hover:border-github-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-github-border';

const SEGMENT_ACTIVE = 'bg-github-bg-primary text-github-text-primary border-github-text-secondary';

const commitSelection = (commit: CommitInfo) =>
  createDiffSelection(`${commit.shortHash}^`, commit.shortHash);

export function DiffNavBar({ options, selection, onSelectDiff }: DiffNavBarProps) {
  const currentBranch = options.branches.find((branch) => branch.current)?.name;
  const [range, setRange] = useState<Range>(() => ({
    base: options.originDefaultBranch ?? selection.baseCommitish,
    target: currentBranch ?? selection.targetCommitish,
  }));
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Follow merge-base selections made elsewhere (CLI args, detailed modal).
  // Commit selections are direct (`hash^..hash`), so stepping through commits never moves the range.
  useEffect(() => {
    if (selection.baseMode === 'merge-base') {
      setRange({ base: selection.baseCommitish, target: selection.targetCommitish });
    }
  }, [selection]);

  useEffect(() => {
    if (!range.base || !range.target) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ base: range.base, target: range.target });
    fetch(`/api/range-commits?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { commits: [] }))
      .then((data: { commits: CommitInfo[] }) => setCommits(data.commits ?? []))
      .catch(() => setCommits([]));
    return () => controller.abort();
  }, [range.base, range.target]);

  const allSelection = createDiffSelection(range.base, range.target, 'merge-base');
  const index = commits.findIndex((commit) =>
    diffSelectionsEqual(selection, commitSelection(commit)),
  );
  const activeCommit = commits[index];
  const isAll = diffSelectionsEqual(selection, allSelection);
  const isByCommit = index >= 0;

  const { refs, floatingStyles, context } = useFloating({
    open: isPickerOpen,
    onOpenChange: (open) => {
      setIsPickerOpen(open);
      if (!open) setQuery('');
    },
    placement: 'bottom-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'menu' }),
  ]);

  const baseCandidates = useMemo(() => {
    const names = [...(options.remoteBranches ?? []), ...options.branches.map((b) => b.name)];
    const needle = query.trim().toLowerCase();
    return names.filter((name) => name !== currentBranch && name.toLowerCase().includes(needle));
  }, [options, currentBranch, query]);

  const selectBase = (base: string) => {
    setIsPickerOpen(false);
    setQuery('');
    setRange({ ...range, base });
    onSelectDiff(createDiffSelection(base, range.target, 'merge-base'));
  };

  const goTo = (nextIndex: number) => {
    const next = commits[nextIndex];
    if (next) onSelectDiff(commitSelection(next));
  };

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 border-b border-github-border bg-github-bg-secondary text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <GitBranch size={14} className="shrink-0 text-github-text-secondary" />
        <button
          ref={refs.setReference}
          type="button"
          className="flex items-center gap-1 px-2 py-1 bg-github-bg-tertiary border border-github-border rounded hover:border-github-text-secondary transition-colors"
          aria-label={`Base branch: ${range.base}`}
          {...getReferenceProps()}
        >
          <code className="text-github-text-primary">{range.base}</code>
          <ChevronDown size={12} className="text-github-text-secondary" />
        </button>
        <span className="text-github-text-secondary">←</span>
        <code
          className="px-2 py-1 bg-github-bg-tertiary border border-github-border rounded text-github-text-primary truncate"
          title={currentBranch ?? range.target}
        >
          {currentBranch ?? range.target}
        </code>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <div className="flex shrink-0" role="group" aria-label="Diff scope">
          <button
            type="button"
            className={`${NAV_BUTTON} rounded-l ${isAll ? SEGMENT_ACTIVE : ''}`}
            aria-pressed={isAll}
            onClick={() => onSelectDiff(allSelection)}
          >
            All changes
          </button>
          <button
            type="button"
            className={`${NAV_BUTTON} rounded-r border-l-0 ${isByCommit ? SEGMENT_ACTIVE : ''}`}
            aria-pressed={isByCommit}
            disabled={commits.length === 0}
            onClick={() => !isByCommit && goTo(0)}
          >
            By commit
          </button>
        </div>
        {isByCommit && activeCommit ? (
          <>
            <div className="flex shrink-0">
              <button
                type="button"
                className={`${NAV_BUTTON} rounded-l`}
                aria-label="Previous commit"
                disabled={index <= 0}
                onClick={() => goTo(index - 1)}
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                type="button"
                className={`${NAV_BUTTON} rounded-r border-l-0`}
                aria-label="Next commit"
                disabled={index === commits.length - 1}
                onClick={() => goTo(index + 1)}
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
            <code className="shrink-0 text-github-text-primary">{activeCommit.shortHash}</code>
            <span className="truncate text-github-text-secondary" title={activeCommit.message}>
              {activeCommit.message}
            </span>
            <span className="shrink-0 text-github-text-muted">
              {index + 1} / {commits.length}
            </span>
          </>
        ) : (
          <span className="text-github-text-secondary">
            {isAll
              ? `${commits.length} ${commits.length === 1 ? 'commit' : 'commits'}`
              : 'Custom range'}
          </span>
        )}
      </div>

      {isPickerOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 w-[320px] max-h-[400px] overflow-y-auto"
            {...getFloatingProps()}
          >
            <div className="sticky top-0 border-b border-github-border bg-github-bg-secondary p-2">
              <div className="flex items-center gap-2 rounded border border-github-border bg-github-bg-primary px-2 py-1.5 focus-within:border-blue-600">
                <Search size={12} className="shrink-0 text-github-text-secondary" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && baseCandidates[0]) selectBase(baseCandidates[0]);
                  }}
                  placeholder="Filter base branches..."
                  aria-label="Filter base branches"
                  className="w-full bg-transparent text-xs text-github-text-primary placeholder:text-github-text-muted focus:outline-none"
                />
              </div>
            </div>
            {baseCandidates.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-github-text-muted">
                No matching branches
              </div>
            ) : (
              baseCandidates.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => selectBase(name)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-github-bg-tertiary focus:bg-github-bg-tertiary focus:outline-none ${
                    name === range.base ? 'font-semibold' : ''
                  }`}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
