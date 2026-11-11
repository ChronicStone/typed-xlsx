<script setup lang="ts">
import { ref } from "vue";
import { copyText, revealOnScroll, useWidget } from "./bp";

const root = ref<HTMLElement | null>(null);
const copied = ref(false);
const { $posthog } = useNuxtApp();

const FILES: Array<[string, string]> = [
  ["report.xlsx", ""],
  [
    "[Content_Types].xml",
    '<Override PartName="/xl/workbook.xml"\n  ContentType="...sheet.main+xml"/>',
  ],
  ["xl/workbook.xml", '<sheets>\n  <sheet name="Invoices" sheetId="1"/>\n</sheets>'],
  ["xl/styles.xml", '<numFmt numFmtId="164"\n  formatCode="&quot;$&quot;#,##0.00"/>'],
  ["xl/sharedStrings.xml", "<si><t>Halvorsen Freight</t></si>\n<si><t>Okapi Health</t></si>"],
  [
    "xl/worksheets/sheet1.xml",
    '<c r="D2"><f>ROUND(B2*C2,2)</f></c>\n<c r="D3"><f>ROUND(B3*C3,2)</f></c>',
  ],
];

function onCopy() {
  copyText("npm i typed-xlsx");
  $posthog?.capture("install_command_copied", { location: "engine" });
  copied.value = true;
  setTimeout(() => (copied.value = false), 1300);
}

useWidget(root, (s) => revealOnScroll(s));
</script>

<template>
  <section id="engine" ref="root" class="sec">
    <div class="wrap engine">
      <div>
        <h2 class="h2 reveal">
          Zero dependencies.<br /><span class="accent">Its own XLSX engine.</span>
        </h2>
        <p class="lede reveal">
          No SheetJS, no ExcelJS. typed-xlsx writes the OOXML parts and the ZIP container itself, so
          there is nothing else to audit or patch.
        </p>
        <div class="install reveal">
          <span><span class="prompt">$</span>npm i typed-xlsx</span>
          <button type="button" aria-label="Copy install command" @click="onCopy">
            <UIcon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="ic" />
          </button>
        </div>
        <div class="ctas reveal">
          <NuxtLink class="btn btn-primary" to="/getting-started/introduction"
            >Get started <UIcon name="i-lucide-arrow-right" class="ic"
          /></NuxtLink>
          <a class="btn btn-ghost" href="https://github.com/ChronicStone/typed-xlsx"
            ><UIcon name="i-simple-icons-github" class="ic" /> Star on GitHub</a
          >
        </div>
      </div>
      <div class="arch" aria-hidden="true">
        <div class="arch-iso">
          <div class="ground" />
          <div
            v-for="(f, i) in FILES"
            :key="f[0]"
            class="fs"
            :class="{ zip: i === 0 }"
            :style="{ '--i': i === 0 ? -0.6 : i }"
          >
            <i class="edge edge-b" /><i class="edge edge-l" />
            <div class="face">
              <div class="path">{{ f[0] }}</div>
              <div v-if="f[1]" class="xml">{{ f[1] }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
