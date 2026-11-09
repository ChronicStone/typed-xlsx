<script setup lang="ts">
import BpHero from "../landing/BpHero.vue";
import BpScale from "../landing/BpScale.vue";
import BpRender from "../landing/BpRender.vue";
import BpTypes from "../landing/BpTypes.vue";
import BpModular from "../landing/BpModular.vue";
import BpOutputs from "../landing/BpOutputs.vue";
import BpEngine from "../landing/BpEngine.vue";

useBlueprintPage();

// Tells search engines this page is a software library, not just a website.
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: "typed-xlsx",
        description:
          "TypeScript library that generates Excel .xlsx reports from typed schemas, with formulas, styles, native Excel tables and streaming exports.",
        url: "https://typed-xlsx.vercel.app",
        codeRepository: "https://github.com/ChronicStone/typed-xlsx",
        programmingLanguage: "TypeScript",
        runtimePlatform: ["Node.js", "Bun", "Deno", "Cloudflare Workers"],
        license: "https://opensource.org/licenses/MIT",
        keywords:
          "excel, xlsx, typescript, excel export, spreadsheet, report generator, streaming, node.js",
      }),
    },
  ],
});
</script>

<template>
  <div class="bp bp-land">
    <BpHero />
    <BpScale />
    <BpRender />
    <BpTypes />
    <BpModular />
    <BpOutputs />
    <BpEngine />
  </div>
</template>
