/**
 * The single place the in-memory access token lives (spec 002 AC41: never
 * localStorage, sessionStorage, or a non-HttpOnly cookie). A plain module-level
 * store (not React state) so non-component code — `api-client.ts`'s fetch
 * wrapper in particular — can read/write the current token without needing a
 * React context reference threaded through every call site. `<AuthProvider>`
 * subscribes to this store via `useSyncExternalStore` to re-render on change.
 */

type Listener = () => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToAccessToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
