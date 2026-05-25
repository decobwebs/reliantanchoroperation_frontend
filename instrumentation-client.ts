if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then(({ init }) => {
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.2,
      sendDefaultPii: false,
    });
  });
}
