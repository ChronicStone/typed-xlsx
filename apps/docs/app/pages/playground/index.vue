<script setup lang="ts">
import { getArtifactCatalog } from "../../data/artifactCatalog";

const artifacts = getArtifactCatalog();

useSeo({
  title: "Artifact Playground",
  description:
    "Explore generated xlsmith artifacts — source code, workbook output, and OOXML inspection.",
  type: "website",
});
</script>

<template>
  <main
    class="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
  >
    <!-- Header -->
    <section class="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:items-end">
      <div class="space-y-4">
        <UBadge
          color="primary"
          variant="subtle"
          class="w-fit rounded-full px-3 py-1 font-mono text-xs tracking-widest uppercase"
        >
          Playground
        </UBadge>
        <h1
          class="max-w-4xl text-balance text-4xl font-bold tracking-tight text-highlighted sm:text-5xl lg:text-6xl"
        >
          Browse artifacts,<br /><em class="not-italic text-primary">inspect the output.</em>
        </h1>
        <p class="max-w-2xl text-pretty text-lg leading-8 text-toned">
          Every artifact is a working xlsmith workbook with embedded source, an Excel preview, and
          OOXML inspection files. Pick one to explore.
        </p>
      </div>

      <div
        class="grid grid-cols-2 divide-x divide-default/40 overflow-hidden rounded-2xl border border-default/40 bg-elevated/40"
      >
        <div class="px-5 py-5">
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">Artifacts</p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-highlighted">
            {{ artifacts.length }}
          </p>
          <p class="mt-1 text-xs leading-5 text-toned">Generated workbooks</p>
        </div>
        <div class="px-5 py-5">
          <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/70">
            Per artifact
          </p>
          <p class="mt-2 text-3xl font-bold text-highlighted">3+</p>
          <p class="mt-1 text-xs leading-5 text-toned">Source, inspect, OOXML</p>
        </div>
      </div>
    </section>

    <!-- Artifact grid — full catalog, no CTA needed on this page -->
    <LandingArtifactExplorerPreview :show-cta="false" />
  </main>
</template>
