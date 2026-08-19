import { render, screen, waitFor } from '@testing-library/react';
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
