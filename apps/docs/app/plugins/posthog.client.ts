import posthog from "posthog-js";
import type { PostHog } from "posthog-js";

// PostHog product analytics for the docs: page views, the events captured in components
// (`$posthog?.capture(...)`), autocapture, session replay and browser errors.
// Off unless NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN and NUXT_PUBLIC_POSTHOG_HOST are set at build time,
// so local dev and forks send nothing. Production values are set in the Vercel project.
export default defineNuxtPlugin((nuxtApp) => {
  const { projectToken, host } = useRuntimeConfig().public.posthog;

  if (!projectToken || !host) {
    return { provide: { posthog: undefined } };
  }

  const posthogClient = posthog.init(projectToken, {
    api_host: host,
    // The docs are a single-page app: count client-side navigations as page views too.
    capture_pageview: "history_change",
    capture_pageleave: true,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  });

  nuxtApp.hook("vue:error", (error) => {
    posthogClient.captureException(error);
  });

  return {
    provide: {
      posthog: posthogClient as PostHog,
    },
  };
});
