import type { PostHog } from "posthog-js";

declare module "#app" {
  interface NuxtApp {
    $posthog: PostHog | undefined;
  }
}

export {};
