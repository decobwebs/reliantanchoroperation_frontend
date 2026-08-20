"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // The operation detail page alone mounts 31 queries. With the
            // default refetchOnWindowFocus, every return to the tab refires
            // all of them at once — and on mobile "focus" fires constantly:
            // app switching, the keyboard opening, a notification banner.
            // That repeated 31-request stampede against a backend a round
            // trip away is the likeliest cause of mobile tabs being killed
            // ("This page couldn't load"). Freshness is unaffected: that page
            // already polls every 20s and notifications every 30s.
            refetchOnWindowFocus: false,
            // Bounded so results from pages the user has left are reclaimed
            // rather than sitting in memory (default is 5 minutes, which on a
            // heavy app accumulates well past what a phone tab can hold).
            gcTime: 120_000,
            retry: (failureCount, error: unknown) => {
              // Don't retry on 401/403/404
              const status = (error as { response?: { status?: number } })
                ?.response?.status;
              if (status === 401 || status === 403 || status === 404)
                return false;
              // One retry, not two: on a flaky mobile connection 31 failing
              // queries retrying twice is ~93 in-flight requests, which
              // compounds the very pressure that drops the tab.
              return failureCount < 1;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </AuthProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
