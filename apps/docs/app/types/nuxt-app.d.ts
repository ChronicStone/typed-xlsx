import type { PostHog } from "posthog-js";

// The part of PostHog the docs use. Calls made before posthog-js has loaded are buffered
// (see app/plugins/posthog.client.ts).
export interface DeferredPostHog {
  capture(...args: Parameters<PostHog["capture"]>): void;
  captureException(...args: Parameters<PostHog["captureException"]>): void;
}

declare module "#app" {
  interface NuxtApp {
    $posthog: DeferredPostHog | undefined;
  }
}
