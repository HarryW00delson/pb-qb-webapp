import { useEffect, useState, type SubmitEventHandler } from 'react';
import './App.css';

type HealthState = 'loading' | 'ok' | 'error';
type WebSources = Array<string>;
type QueryState = string;

function App() {
  const [health, setHealth] = useState<HealthState>('loading');
  const [webSources, setWebSources] = useState<WebSources>([]);
  const [query, setQuery] = useState<QueryState>('');

  const handleSearch = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(query.trim());
  }

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
        setWebSources(data.webSources !== null ? data.webSources : []);
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
      <form className="search-form" onSubmit={handleSearch}>
        <input className="search-input" placeholder='Search for Movies and TV Shows' value={query} onChange={(e) => setQuery(e.target.value)}></input>
        <button className="search-button" type='submit'>Search</button>
      </form>
    </div>
  );
}

export default App;
