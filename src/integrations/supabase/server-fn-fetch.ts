import { createIsomorphicFn } from "@tanstack/react-start";
import { supabase } from "./client";

let installed = false;

/**
 * Adds the current Supabase access token as an `Authorization: Bearer ...`
 * header to every `/_serverFn/...` request. No-op on the server.
 */
export const installServerFnAuth = createIsomorphicFn()
  .server(() => {})
  .client(() => {
    if (installed) return;
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
        if (!token) {
          const { data } = await supabase.auth.getSession();
          token = data.session?.access_token ?? null;
        }
        if (token) {
          const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          return originalFetch(input, { ...init, headers });
        }
      }

      return originalFetch(input, init);
    };
  });
