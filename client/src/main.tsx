import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      async fetch(input, init) {
        try {
          const res = await globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const rawText = await res.text().catch(() => "");
            let safeMsg = "The server is temporarily busy or reconnecting. Please wait a moment and try again.";
            if (res.status === 429) {
              safeMsg = "Too many requests. Please wait a moment and try again.";
            } else if (res.status === 502 || res.status === 503 || res.status === 504) {
              safeMsg = "The server took too long to respond or is restarting. Please try again shortly.";
            } else if (rawText && rawText.length < 150 && !rawText.includes("<html") && !rawText.includes("<!DOCTYPE")) {
              safeMsg = rawText.trim();
            }
            return new Response(
              JSON.stringify([
                {
                  error: {
                    json: {
                      message: safeMsg,
                      code: -32603,
                    },
                  },
                },
              ]),
              {
                status: res.status >= 400 ? res.status : 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          return res;
        } catch (err: unknown) {
          return new Response(
            JSON.stringify([
              {
                error: {
                  json: {
                    message: "Network connection lost. Please check your internet connection and try again.",
                    code: -32603,
                  },
                },
              },
            ]),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
