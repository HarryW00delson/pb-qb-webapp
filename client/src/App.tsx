import { useEffect, useState } from 'react';
import './App.css';

type HealthState = 'loading' | 'ok' | 'error';
type SearchState = 'idle' | 'loading' | 'ok' | 'error';
type WebSources = Array<string>;
type QueryState = string;

function App() {
  const [health, setHealth] = useState<HealthState>('loading');
  const [webSources, setWebSources] = useState<WebSources>([]);
  const [query, setQuery] = useState<QueryState>('');
  const [search, setSearch] = useState<SearchState>('idle');

  const handleSearch = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || search === 'loading') return;

    setSearch('loading');
    try {
      const res = await fetch(
        `/api/entertainment?q=${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) throw new Error(`Unexpected status ${res.status}`);
      const data = (await res.json()) as { status: string };
      setSearch(data.status === 'ok' ? 'ok' : 'error');
    } catch {
      setSearch('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Unexpected status ${res.status}`);
        return res.json() as Promise<{ status: string }>;
      })
      .then((data) => {
        setHealth(data.status === 'ok' ? 'ok' : 'error');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setHealth('error');
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/web-sources', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Unexpected status ${res.status}`);
        return res.json() as Promise<{ status: string, error: boolean, webSources: Array<string>, message: string }>;
      })
      .then((data) => {
        // Guard against a missing/malformed payload: storing undefined
        // here would crash webSources.join() below on the next render.
        setWebSources(Array.isArray(data.webSources) ? data.webSources : []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setWebSources([]);
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="App">
      <h1>Movie & TV Show Search</h1>
      <p>
        Server status:{' '}
        <span className={`status ${health}`}>
          {health === 'loading' ? 'checking…' : health}
        </span>
      </p>
      <p>Search for movies and TV shows sourced from {webSources.join(', ')}.</p>
      {search !== 'idle' && (
        <p>
          Search status:{' '}
          <span className={`status search-status ${search}`}>
            {search === 'loading' ? 'searching…' : search}
          </span>
        </p>
      )}
      <form className="search-form" onSubmit={handleSearch}>
        <input className="search-input" placeholder='Search for Movies and TV Shows' value={query} onChange={(e) => setQuery(e.target.value)}></input>
        <button className="search-button" type='submit'>Search</button>
      </form>
    </div>
  );
}

export default App;
