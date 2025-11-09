import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ForumSearchProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

/**
 * Forum Search Component
 * 
 * Search bar with autocomplete and recent searches
 */
export function ForumSearch({ onSearch, placeholder = 'Search threads...' }: ForumSearchProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load recent searches from localStorage
    const stored = localStorage.getItem('forum-recent-searches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Save to recent searches
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('forum-recent-searches', JSON.stringify(updated));

    // Navigate to search results or call callback
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      navigate(`/community/search?q=${encodeURIComponent(searchQuery)}`);
    }

    setShowSuggestions(false);
    setQuery('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="forum-search">
      <form onSubmit={handleSubmit}>
        <div style={{ position: 'relative' }}>
          <span className="forum-search__icon">🔍</span>
          <input
            ref={inputRef}
            type="search"
            className="forum-search__input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(e.target.value.length > 0 || recentSearches.length > 0);
            }}
            onFocus={() => setShowSuggestions(query.length > 0 || recentSearches.length > 0)}
            onBlur={() => {
              // Delay to allow clicking on suggestions
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Search forum"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-controls="forum-search-suggestions"
            aria-autocomplete="list"
          />
        </div>
      </form>

      {showSuggestions && (query.length > 0 || recentSearches.length > 0) && (
        <div
          id="forum-search-suggestions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 'var(--spacing-2)',
            background: 'var(--forum-bg-card)',
            border: '1px solid var(--forum-border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--forum-shadow-card-hover)',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
          role="listbox"
          aria-label="Search suggestions"
        >
          {query.length > 0 && (
            <div
              style={{
                padding: 'var(--spacing-2)',
                borderBottom: '1px solid var(--forum-border-default)',
                cursor: 'pointer',
              }}
              onClick={() => handleSearch(query)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--forum-bg-input)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              role="option"
            >
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                Search for "{query}"
              </div>
            </div>
          )}

          {recentSearches.length > 0 && (
            <>
              <div
                style={{
                  padding: 'var(--spacing-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  fontWeight: 'var(--font-semibold)',
                  borderBottom: '1px solid var(--forum-border-default)',
                }}
              >
                Recent Searches
              </div>
              {recentSearches.map((search, index) => (
                <div
                  key={index}
                  style={{
                    padding: 'var(--spacing-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                  onClick={() => handleSearch(search)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--forum-bg-input)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  role="option"
                >
                  {search}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

