import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.tsx';

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows ok status once the health check succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      }),
    );

    render(<App />);

    expect(screen.getByText(/checking/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });

  it('shows error status when the health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  it('submits the search query to /api/entertainment and shows ok', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).startsWith('/api/entertainment')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ status: 'ok', err: false, message: null }),
        });
      }
      // /api/health and /api/web-sources: keep App happy.
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<App />);
    const input = screen.getByPlaceholderText(
      /search for movies and tv shows/i,
    );
    fireEvent.change(input, { target: { value: 'dune' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(container.querySelector('.search-status')?.textContent).toBe(
        'ok',
      );
    });

    const entertainmentCall = fetchMock.mock.calls.find(([url]) =>
      String(url).startsWith('/api/entertainment'),
    );
    expect(entertainmentCall?.[0]).toBe('/api/entertainment?q=dune');
  });

  it('shows error status when the /api/entertainment search fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (String(url).startsWith('/api/entertainment')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }),
    );

    const { container } = render(<App />);
    const input = screen.getByPlaceholderText(
      /search for movies and tv shows/i,
    );
    fireEvent.change(input, { target: { value: 'dune' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(container.querySelector('.search-status')?.textContent).toBe(
        'error',
      );
    });
  });

  it('aborts the in-flight health check when unmounted', () => {
    const fetchMock = vi.fn(
      (_url: string, options?: { signal?: AbortSignal }) =>
        new Promise(() => {
          // Never resolves; we only care whether the signal aborts.
          options?.signal?.addEventListener('abort', () => {});
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<App />);
    const signal = (fetchMock.mock.calls[0]?.[1] as { signal?: AbortSignal })
      ?.signal;

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
