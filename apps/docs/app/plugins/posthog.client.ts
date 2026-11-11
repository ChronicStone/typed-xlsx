import posthog from "posthog-js";
import type { PostHog } from "posthog-js";

export default defineNuxtPlugin((nuxtApp) => {
  const { projectToken, host } = useRuntimeConfig().public.posthog;

  if (!projectToken || !host) {
    if (import.meta.dev) {
      console.error(
        `${!projectToken ? "NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN" : "NUXT_PUBLIC_POSTHOG_HOST"} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${!projectToken ? "NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN" : "NUXT_PUBLIC_POSTHOG_HOST"} is configured`,
      );
    }

    return { provide: { posthog: undefined } };
  }

  const posthogClient = posthog.init(projectToken, {
    api_host: host,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    logs: {
      serviceName: "typed-xlsx-docs",
      environment: import.meta.env.MODE,
    },
  });

  posthogClient.logger.info("documentation client initialized", {
    application: "typed-xlsx-docs",
    runtime: "browser",
  });

  nuxtApp.hook("vue:error", (error) => {
    posthogClient.captureException(error);
    posthogClient.logger.error("vue rendering error", {
      error_type: error instanceof Error ? error.name : typeof error,
    });
  });

  return {
    provide: {
      posthog: posthogClient as PostHog,
    },
  };
});
