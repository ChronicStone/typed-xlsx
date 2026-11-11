import type { PostHog } from "posthog-js";
import type { DeferredPostHog } from "../types/nuxt-app";

// PostHog product analytics for the docs: page views, the events captured in components
// (`$posthog?.capture(...)`), autocapture, session replay and browser errors.
// Off unless NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN and NUXT_PUBLIC_POSTHOG_HOST are set at build time,
// so local dev and forks send nothing. Production values are set in the Vercel project.
//
// posthog-js (with session replay) is large, so it loads in its own chunk once the page has
// mounted and the browser is idle. Until then `$posthog` buffers `capture` and `captureException`
// calls and replays them in order after `init`. PostHog records the first page view on init.
type PendingCall = (client: PostHog) => void;

const IDLE_TIMEOUT_MS = 3000;

function whenIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(callback, 1);
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const { projectToken, host } = useRuntimeConfig().public.posthog;

  if (!projectToken || !host) {
    return { provide: { posthog: undefined as DeferredPostHog | undefined } };
  }

  let client: PostHog | undefined;
  let pending: PendingCall[] = [];

  function run(call: PendingCall) {
    if (client) {
      call(client);
    } else {
      pending.push(call);
    }
  }

  const deferred: DeferredPostHog = {
    capture(...args) {
      run((posthog) => {
        posthog.capture(...args);
      });
    },
    captureException(...args) {
      run((posthog) => {
        posthog.captureException(...args);
      });
    },
  };

  async function load() {
    try {
      const { default: posthog } = await import("posthog-js");
      const initialised = posthog.init(projectToken, {
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
      client = initialised;
      const calls = pending;
      pending = [];
      for (const call of calls) {
        call(initialised);
      }
    } catch {
      // Analytics must never break the docs: drop the buffered events if the chunk fails to load.
      pending = [];
    }
  }

  nuxtApp.hook("app:mounted", () => {
    whenIdle(() => {
      void load();
    });
  });

  nuxtApp.hook("vue:error", (error) => {
    deferred.captureException(error);
  });

  return {
    provide: {
      posthog: deferred as DeferredPostHog | undefined,
    },
  };
});
