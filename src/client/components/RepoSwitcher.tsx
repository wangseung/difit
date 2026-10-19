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
import { ChevronDown, FolderGit2, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface RepoEntry {
  name: string;
  path: string;
  branch?: string;
}

interface ReposResponse {
  current: string;
  repos: RepoEntry[];
  favorites: string[];
}

export function RepoSwitcher() {
  const [data, setData] = useState<ReposResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/repos')
      .then((res) => (res.ok ? (res.json() as Promise<ReposResponse>) : null))
      .then((body) => setData(typeof body?.current === 'string' ? body : null))
      .catch(() => setData(null));
  }, []);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
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

  const { favorites, others } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (data?.repos ?? []).filter(
      (repo) =>
        repo.name.toLowerCase().includes(needle) || repo.branch?.toLowerCase().includes(needle),
    );
    const favoriteSet = new Set(data?.favorites);
    return {
      favorites: matches.filter((repo) => favoriteSet.has(repo.name)),
      others: matches.filter((repo) => !favoriteSet.has(repo.name)),
    };
  }, [data, query]);

  if (!data) return null;

  const switchTo = async (name: string) => {
    setIsOpen(false);
    if (name === data.current) return;
    const res = await fetch('/api/switch-repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    // Full reload: drops all per-repo client state and keeps `?repo=` for reload/bookmark
    if (res.ok) window.location.assign(`/?repo=${encodeURIComponent(name)}`);
  };

  const toggleFavorite = (name: string) => {
    const next = data.favorites.includes(name)
      ? data.favorites.filter((fav) => fav !== name)
      : [...data.favorites, name];
    setData({ ...data, favorites: next });
    void fetch('/api/user-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: { favoriteRepos: next } }),
    });
  };

  const renderRepo = (repo: RepoEntry) => (
    <div
      key={repo.name}
      className="flex items-center hover:bg-github-bg-tertiary focus-within:bg-github-bg-tertiary"
    >
      <button
        type="button"
        aria-label={`Toggle favorite ${repo.name}`}
        onClick={() => toggleFavorite(repo.name)}
        className="px-2 py-2 text-github-text-secondary hover:text-github-warning focus:outline-none"
      >
        <Star
          size={12}
          className={data.favorites.includes(repo.name) ? 'text-github-warning' : ''}
          fill={data.favorites.includes(repo.name) ? 'currentColor' : 'none'}
        />
      </button>
      <button
        type="button"
        onClick={() => void switchTo(repo.name)}
        className={`flex-1 min-w-0 text-left pr-3 py-2 text-xs focus:outline-none ${
          repo.name === data.current ? 'font-semibold' : ''
        }`}
      >
        <div className="truncate text-github-text-primary">{repo.name}</div>
        {repo.branch && <div className="truncate text-github-text-muted">{repo.branch}</div>}
      </button>
    </div>
  );

  const sectionTitle = (title: string) => (
    <div className="px-3 py-2 text-xs font-semibold text-github-text-secondary bg-github-bg-tertiary">
      {title}
    </div>
  );

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className="flex items-center gap-1.5 px-2 py-1 bg-github-bg-tertiary border border-github-border rounded hover:border-github-text-secondary transition-colors text-xs"
        aria-label={`Repository: ${data.current}`}
        title={data.current}
        {...getReferenceProps()}
      >
        <FolderGit2 size={14} className="text-github-text-secondary" />
        <span className="max-w-[160px] truncate text-github-text-primary">{data.current}</span>
        <ChevronDown size={12} className="text-github-text-secondary" />
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-github-bg-secondary border border-github-border rounded shadow-lg z-50 w-[320px] max-h-[440px] overflow-y-auto"
            {...getFloatingProps()}
          >
            <div className="sticky top-0 z-10 border-b border-github-border bg-github-bg-secondary p-2">
              <div className="flex items-center gap-2 rounded border border-github-border bg-github-bg-primary px-2 py-1.5 focus-within:border-blue-600">
                <Search size={12} className="shrink-0 text-github-text-secondary" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    const first = favorites[0] ?? others[0];
                    if (e.key === 'Enter' && first) void switchTo(first.name);
                  }}
                  placeholder="Filter repositories..."
                  aria-label="Filter repositories"
                  className="w-full bg-transparent text-xs text-github-text-primary placeholder:text-github-text-muted focus:outline-none"
                />
              </div>
            </div>
            {favorites.length > 0 && (
              <div className="border-b border-github-border">
                {sectionTitle('Favorites')}
                {favorites.map(renderRepo)}
              </div>
            )}
            {others.length > 0 && (
              <div>
                {sectionTitle('Repositories')}
                {others.map(renderRepo)}
              </div>
            )}
            {favorites.length === 0 && others.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-github-text-muted">
                No matching repositories
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
