# Code Review — `client/`

All baseline checks pass (ESLint ✓, `tsc -b` ✓, 5/5 tests ✓, production build ✓). No blocking issues. A few things worth cleaning up:

---

## 1. Dead CSS — `client/src/index.css`

Several selectors and custom properties were carried over from the Vite React template and are not referenced anywhere in the source:

| What | Lines | Why it's dead |
|---|---|---|
| `--code-bg` (light + dark) | 6, 41 | No element uses `var(--code-bg)` |
| `--social-bg` (light + dark) | 10, 46 | No element uses `var(--social-bg)` |
| `#social .button-icon` rule | 47–49 | No `#social` element exists in any TSX |
| `code, .counter` block | 91–105 | Neither `code` nor `.counter` appears in JSX |

Safe to delete the `--code-bg`, `--social-bg` declarations and the three rule blocks.

---

## 2. Dead asset — `client/public/icons.svg`

`icons.svg` is not referenced by `index.html`, any CSS file, or any source file. It's a leftover from the Vite template. Safe to delete.

---

## 3. Generic `<title>` — `index.html`

```html
<title>Full-Stack Web App Template</title>
```

Should match the app, e.g. `<title>Movie &amp; TV Show Search</title>`.

---

## 4. `handleSearch` has no `AbortController`

The two mount-time `useEffect` blocks both create an `AbortController` and abort in cleanup. The user-triggered `handleSearch` fetch does not pass a signal:

```ts
// current
const res = await fetch(`/api/entertainment?q=${encodeURIComponent(trimmed)}`);
```

Low practical risk (user-initiated, no rapid re-submission loop), but it's inconsistent and the request would still land in state if the component unmounts mid-fetch. A minimal fix:

```ts
const controller = new AbortController();
try {
  const res = await fetch(url, { signal: controller.signal });
  ...
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return;
  setSearch('error');
}
```

Or skip it if the inconsistency doesn't bother you.

---

## 5. Empty web-sources renders `"sourced from ."`

When `/api/web-sources` returns 404 (unconfigured), the client silently sets `[]`, and the JSX produces:

```
Search for movies and TV shows sourced from .
```

A one-line fallback fixes it:

```tsx
{sourced from {webSources.length ? webSources.join(', ') : 'the server'}}.
```

---

## 6. Minor — `.search-form` uses `place-self: center` (no-op)

`place-self` is a grid/flex-item property. The parent `.App` is a plain block element with `text-align: center`, so `place-self: center` on `.search-form` has no effect. Harmless but misleading; remove it or change the parent to `display: flex`.

---

## What looks good

- Strict typing throughout — no `any`, explicit state types (`HealthState`, `SearchState`, `WebSources`)
- `AbortController` on both mount-time effects with proper `AbortError` filtering
- `Array.isArray` guard on `webSources` before storing (prevents `undefined.join()` crash)
- Tests cover happy path, error paths, abort-on-unmount, and URL encoding of the query param
- `index.css` `#root` wrapper with `min-height: 100svh` is correct for mobile viewports
- `setupTests.ts` is minimal and appropriate
