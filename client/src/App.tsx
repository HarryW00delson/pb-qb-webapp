import { useEffect, useState } from 'react';
import './App.css';

type HealthState = 'loading' | 'ok' | 'error';

function App() {
  const [health, setHealth] = useState<HealthState>('loading');

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

  return (
    <div className="App">
      <h1>Full-Stack Web App Template</h1>
      <p>React (Vite) client talking to the Express server via /api.</p>
      <p>
        Server status:{' '}
        <span className={`status ${health}`}>
          {health === 'loading' ? 'checking…' : health}
        </span>
      </p>
    </div>
  );
}

export default App;
