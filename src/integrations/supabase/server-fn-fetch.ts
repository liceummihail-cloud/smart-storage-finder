import { supabase } from "./client";

let installed = false;

/**
 * Monkey-patches window.fetch on the client so that requests to TanStack
 * server functions (`/_serverFn/...`) automatically carry the current
 * Supabase access token in the Authorization header. This lets server
 * functions guarded by `requireSupabaseAuth` work without manually wiring
 * headers at every call site.
 */
export function installServerFnAuth() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  let token: string | null = null;

  supabase.auth.getSession().then(({ data }) => {
    token = data.session?.access_token ?? null;
  });
  supabase.auth.onAuthStateChange((_evt, session) => {
    token = session?.access_token ?? null;
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes("/_serverFn/")) {
      // Refresh token if missing (e.g. very first call right after login)
      if (!token) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
      }
      if (token) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          headers.set("authorization", `Bearer ${token}`);
        }
        return originalFetch(input, { ...init, headers });
      }
    }

    return originalFetch(input, init);
  };
}
