<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  findArtifactCatalogEntry,
  getArtifactCatalog,
  getArtifactGithubUrl,
  getArtifactPlaygroundSummary,
  getArtifactSourcePanes,
  getArtifactWorkbookUrl,
} from "../../data/artifactCatalog";
import PlaygroundCodeBlock from "../../components/content/PlaygroundCodeBlock.vue";
import XlsxSheet from "../../components/playground/XlsxSheet.vue";
import { esc, hlx } from "../../components/landing/bp";
import {
  colLetter,
  findColumnBlocks,
  formatXml,
  loadWorkbookPreview,
  mapBlocksToColumns,
  parseCellRef,
  parseRangeRef,
  schemaForSheet,
  type SchemaColumnBlock,
} from "../../components/playground/xlsx";

useBlueprintPage();

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const { $posthog } = useNuxtApp();
const artifactId = computed(() => String(route.params.id || ""));
const artifact = computed(() => findArtifactCatalogEntry(artifactId.value));
if (!artifact.value) {
  throw createError({ statusCode: 404, statusMessage: "Artifact not found", fatal: true });
}

const { data: preview } = await useAsyncData(
  () => `workbook-preview:${artifactId.value}`,
  () => loadWorkbookPreview(artifactId.value),
  { watch: [artifactId] },
);

/* ---------- catalog navigation ---------- */
const catalog = getArtifactCatalog();
const index = computed(() => catalog.findIndex((a) => a.id === artifactId.value));
const prevArtifact = computed(() => catalog[(index.value - 1 + catalog.length) % catalog.length]);
const nextArtifact = computed(() => catalog[(index.value + 1) % catalog.length]);

/* ---------- title block ---------- */
const sourcePanes = computed(() => getArtifactSourcePanes(artifact.value!));
const inspectFiles = computed(() => {
  const files = (artifact.value?.inspectSummary?.inspectFiles ?? []).filter(
    (f) => !f.endsWith(".xlsx") && f !== "summary.json",
  );
  if (!files.includes("shared-strings.xml")) files.splice(3, 0, "shared-strings.xml");
  return files;
});
const builder = computed(() =>
  artifact.value!.features.includes("createWorkbookStream")
    ? "createWorkbookStream()"
    : "createWorkbook()",
);
const workbookUrl = computed(() => getArtifactWorkbookUrl(artifact.value!));
const githubUrl = computed(() => getArtifactGithubUrl(artifact.value!));
const officeUrl = computed(() => {
  const url = new URL(
    workbookUrl.value,
    runtimeConfig.public.siteUrl || "https://typed-xlsx.vercel.app",
  );
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url.toString())}`;
});

/* ---------- sheet state ---------- */
const sheetIndex = ref(Math.max(0, Number(route.query.sheet ?? 0) || 0));
const sheet = computed(() => preview.value?.sheets[sheetIndex.value] ?? null);
const selected = ref<string | null>(null);
const selectedCol = ref<number | null>(null);
const drawerOpen = ref(false);
const mode = ref<"split" | "code" | "sheet">("split");

const selectedCell = computed(() =>
  selected.value && sheet.value ? sheet.value.cells[selected.value] : undefined,
);
const formulaBar = computed(() => {
  const cell = selectedCell.value;
  if (!cell) return "";
  if (cell.f != null) return `=${cell.f}`;
  return cell.r ?? cell.v;
});
const usedRange = computed(() => {
  if (!sheet.value) return "";
  const s = sheet.value;
  const freeze = s.freeze ? `, frozen at ${colLetter(s.freeze.cols + 1)}${s.freeze.rows + 1}` : "";
  return `A1:${colLetter(s.cols)}${s.rows}${freeze}`;
});

/* ---------- files ---------- */
type FileKey = { kind: "source" | "inspect"; name: string };
const activeFile = ref<FileKey>({ kind: "source", name: sourcePanes.value[0]?.key ?? "schema.ts" });
const isActive = (f: FileKey) =>
  activeFile.value.kind === f.kind && activeFile.value.name === f.name;
const sheetFileLabel = (file: string) => {
  const s = preview.value?.sheets.find((x) => x.file === file);
  return s ? s.name : undefined;
};

const inspectCache = new Map<string, Promise<string>>();
function fetchInspect(file: string) {
  const url = `/generated/examples/showcase/${artifactId.value}/artifact/inspect/${file}`;
  let p = inspectCache.get(url);
  if (!p) {
    p = $fetch<string>(url, { responseType: "text" }).catch(() => "");
    inspectCache.set(url, p);
  }
  return p;
}
const xmlHtml = ref("");
const xmlLoading = ref(false);
watch(
  activeFile,
  async (f) => {
    if (f.kind !== "inspect") return;
    xmlLoading.value = true;
    const raw = await fetchInspect(f.name);
    const lines = formatXml(raw).split("\n");
    xmlHtml.value = lines
      .map((l, i) => `<span class="line" data-n="${i + 1}">${hlx(l) || " "}</span>`)
      .join("");
    xmlLoading.value = false;
  },
  { immediate: true },
);
function openFile(f: FileKey) {
  activeFile.value = f;
  $posthog?.capture("playground_file_opened", {
    artifact_id: artifactId.value,
    file_kind: f.kind,
  });
  if (f.kind === "inspect") {
    const i = preview.value?.sheets.findIndex((s) => s.file === f.name) ?? -1;
    if (i >= 0) sheetIndex.value = i;
  }
}

/* ---------- schema blocks ↔ sheet columns ---------- */
const codeBody = ref<HTMLElement | null>(null);
const blockByCol = ref(new Map<number, SchemaColumnBlock>());
const selectedBlock = computed(() =>
  selectedCol.value != null ? blockByCol.value.get(selectedCol.value) : undefined,
);
let lineEls: HTMLElement[] = [];

function annotateCode() {
  const body = codeBody.value;
  if (!body) return;
  lineEls = [...body.querySelectorAll<HTMLElement>("pre .line")];
  const isSchema = activeFile.value.kind === "source" && activeFile.value.name === "schema.ts";
  lineEls.forEach((el) => {
    el.removeAttribute("data-col");
    el.classList.remove("blk", "sel");
  });
  blockByCol.value = new Map();
  if (!isSchema || !sheet.value || !lineEls.length) return;
  const blocks = findColumnBlocks(lineEls.map((el) => el.textContent ?? ""));
  const workbookSrc =
    artifact.value!.sourceFiles["workbook.ts"] ?? artifact.value!.sourceFiles["stream.ts"] ?? "";
  const schema = schemaForSheet(workbookSrc, sheet.value.name);
  const mapped = mapBlocksToColumns(blocks, sheet.value.cells, schema);
  const byCol = new Map<number, SchemaColumnBlock>();
  for (const [block, col] of mapped) {
    if (!byCol.has(col)) byCol.set(col, block);
    for (let i = block.start; i <= block.end; i++) {
      lineEls[i]?.setAttribute("data-col", String(col));
      lineEls[i]?.classList.add("blk");
    }
  }
  blockByCol.value = byCol;
  paintSelection(false);
}
function paintSelection(scroll: boolean) {
  const block = selectedBlock.value;
  lineEls.forEach((el, i) =>
    el.classList.toggle("sel", !!block && i >= block.start && i <= block.end),
  );
  if (scroll && block && codeBody.value) {
    const first = lineEls[block.start];
    const body = codeBody.value;
    if (first) {
      const top = first.offsetTop - 60;
      if (top < body.scrollTop || top > body.scrollTop + body.clientHeight - 120)
        body.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }
  requestAnimationFrame(drawLink);
}
let observer: MutationObserver | null = null;
onMounted(() => {
  if (!codeBody.value) return;
  let pending = 0;
  observer = new MutationObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(annotateCode);
  });
  observer.observe(codeBody.value, { childList: true, subtree: true });
  annotateCode();
});
onBeforeUnmount(() => observer?.disconnect());
watch([sheetIndex, () => preview.value], () => nextTick(annotateCode));

function onCodeClick(e: MouseEvent) {
  const line = (e.target as HTMLElement).closest<HTMLElement>(".line[data-col]");
  if (line) selectColumn(Number(line.dataset.col), true);
}

/* ---------- selection ---------- */
const gscroll = ref<HTMLElement | null>(null);
function selectColumn(col: number, fromCode = false) {
  selectedCol.value = col;
  if (
    activeFile.value.name !== "schema.ts" &&
    blockByCol.value.size === 0 &&
    sourcePanes.value.some((p) => p.key === "schema.ts")
  ) {
    activeFile.value = { kind: "source", name: "schema.ts" };
  }
  nextTick(() => {
    paintSelection(!fromCode || true);
    const head = gscroll.value?.querySelector<HTMLElement>(`.colh[data-col="${col}"]`);
    const gs = gscroll.value;
    if (
      head &&
      gs &&
      (head.offsetLeft < gs.scrollLeft + 60 ||
        head.offsetLeft + head.offsetWidth > gs.scrollLeft + gs.clientWidth)
    ) {
      gs.scrollTo({ left: Math.max(0, head.offsetLeft - 240), behavior: "smooth" });
    }
  });
}
function selectCell(cellRef: string) {
  selected.value = cellRef;
  drawerOpen.value = true;
  $posthog?.capture("workbook_cell_inspected", {
    artifact_id: artifactId.value,
    sheet_name: sheet.value?.name,
  });
  const p = parseCellRef(cellRef);
  if (p && blockByCol.value.has(p.c)) selectColumn(p.c);
  else {
    selectedCol.value = null;
    paintSelection(false);
  }
}
watch(sheetIndex, () => {
  selected.value = null;
  selectedCol.value = null;
  drawerOpen.value = false;
});

/* ---------- cell inspector ---------- */
type InspectorRow = { k: string; html: string; col?: number };
const inspector = ref<InspectorRow[]>([]);
watch([selected, sheetIndex], async () => {
  const s = sheet.value;
  const cellRef = selected.value;
  if (!s || !cellRef) {
    inspector.value = [];
    return;
  }
  const rows: InspectorRow[] = [];
  const sheetXml = await fetchInspect(s.file);
  const cellXml = sheetXml.match(
    new RegExp(`<c r="${cellRef}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</c>)`),
  )?.[0];
  rows.push({
    k: s.file,
    html: cellXml
      ? hlx(cellXml)
      : '<span class="t-com">no &lt;c&gt; element: the cell is empty in the file</span>',
  });
  const link = s.links[cellRef];
  if (link) {
    const linkXml = sheetXml.match(new RegExp(`<hyperlink ref="${cellRef}"[^>]*/>`))?.[0];
    if (linkXml) rows.push({ k: s.file, html: hlx(linkXml) });
  }
  const merge = s.merges.find((m) => {
    const r = parseRangeRef(m);
    const p = parseCellRef(cellRef);
    return r && p && p.r >= r.r1 && p.r <= r.r2 && p.c >= r.c1 && p.c <= r.c2;
  });
  if (merge) rows.push({ k: s.file, html: hlx(`<mergeCell ref="${merge}"/>`) });
  const sIndex = cellXml?.match(/\ss="(\d+)"/)?.[1];
  if (sIndex != null) {
    const styles = await fetchInspect("styles.xml");
    const xfs = styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)?.[0] ?? "";
    const xf = xfs.match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)?.[Number(sIndex)];
    if (xf) rows.push({ k: `styles.xml  xf[${sIndex}]`, html: hlx(xf) });
  }
  if (/\st="s"/.test(cellXml ?? "")) {
    const si = cellXml?.match(/<v>(\d+)<\/v>/)?.[1];
    const shared = await fetchInspect("shared-strings.xml");
    const entry = si != null ? shared.match(/<si>[\s\S]*?<\/si>/g)?.[Number(si)] : undefined;
    if (entry) rows.push({ k: `shared-strings  si[${si}]`, html: hlx(entry) });
  }
  const cell = s.cells[cellRef];
  if (cell?.cf != null) {
    const cf = sheetXml
      .match(/<conditionalFormatting[\s\S]*?<\/conditionalFormatting>/g)
      ?.find((block) => {
        const sq = block.match(/sqref="([^"]+)"/)?.[1] ?? "";
        const p = parseCellRef(cellRef);
        return sq.split(" ").some((part) => {
          const r = parseRangeRef(part);
          return r && p && p.r >= r.r1 && p.r <= r.r2 && p.c >= r.c1 && p.c <= r.c2;
        });
      });
    if (cf)
      rows.push({
        k: "conditional format",
        html: hlx(cf.replace(/<conditionalFormatting[^>]*>|<\/conditionalFormatting>/g, "").trim()),
      });
  }
  const validation = s.validations.find((v) =>
    v.ref.split(/\s+/).some((part) => {
      const r = parseRangeRef(part);
      const p = parseCellRef(cellRef);
      return r && p && p.r >= r.r1 && p.r <= r.r2 && p.c >= r.c1 && p.c <= r.c2;
    }),
  );
  if (validation) {
    const rule = validation.list
      ? `list: ${validation.list.join(", ")}`
      : `${validation.type} ${validation.operator ?? ""} ${validation.f1 ?? ""}${validation.f2 ? ` and ${validation.f2}` : ""}`;
    rows.push({ k: "data validation", html: esc(rule) });
  }
  const p = parseCellRef(cellRef);
  const block = p ? blockByCol.value.get(p.c) : undefined;
  if (block && p)
    rows.push({ k: "schema.ts", html: `<a>.column("${esc(block.id)}")</a>`, col: p.c });
  if (selected.value === cellRef) inspector.value = rows;
});

/* ---------- schema ↔ column link ---------- */
const main = ref<HTMLElement | null>(null);
const linkPath = ref("");
const linkDots = ref<Array<{ x: number; y: number }>>([]);
function drawLink() {
  const m = main.value;
  const block = selectedBlock.value;
  if (
    !m ||
    !block ||
    mode.value !== "split" ||
    innerWidth <= 900 ||
    activeFile.value.name !== "schema.ts"
  ) {
    linkPath.value = "";
    linkDots.value = [];
    return;
  }
  const line = lineEls[block.start];
  const head = gscroll.value?.querySelector<HTMLElement>(`.colh[data-col="${selectedCol.value}"]`);
  const sheetPane = m.querySelector<HTMLElement>(".wb-sheet");
  if (!line || !head || !codeBody.value || !gscroll.value || !sheetPane) {
    linkPath.value = "";
    return;
  }
  const mr = m.getBoundingClientRect();
  const cb = codeBody.value.getBoundingClientRect();
  const lr = line.getBoundingClientRect();
  const hr = head.getBoundingClientRect();
  const gs = gscroll.value.getBoundingClientRect();
  const sheetLeft = sheetPane.getBoundingClientRect().left - mr.left;
  const textRight = Math.max(
    ...[...line.querySelectorAll("span")].map((s) => s.getBoundingClientRect().right),
    lr.left + 40,
  );
  let x1 = Math.min(textRight - mr.left + 10, sheetLeft - 26);
  let y1 = lr.top - mr.top + lr.height / 2;
  y1 = Math.max(cb.top - mr.top + 8, Math.min(y1, cb.bottom - mr.top - 8));
  x1 = Math.max(x1, cb.left - mr.left + 60);
  let x2 = hr.left - mr.left + hr.width / 2;
  const y2 = hr.top - mr.top - 1;
  x2 = Math.max(gs.left - mr.left + 50, Math.min(x2, gs.right - mr.left - 20));
  const yTop = Math.min(y2 - 14, y1);
  const xm = sheetLeft - 14;
  linkPath.value = `M${x1} ${y1} H${xm} V${yTop} H${x2} V${y2}`;
  linkDots.value = [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ];
}
onMounted(() => {
  addEventListener("resize", drawLink);
  if (innerWidth <= 900) mode.value = "sheet";
});
onBeforeUnmount(() => removeEventListener("resize", drawLink));
watch([mode, drawerOpen], () => setTimeout(drawLink, 480));

function trackWorkbookDownload(location: "header" | "file_sidebar") {
  $posthog?.capture("workbook_downloaded", {
    artifact_id: artifactId.value,
    location,
  });
}

function onInspectorClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest("a");
  const row = a?.closest<HTMLElement>("[data-col]");
  if (row) selectColumn(Number(row.dataset.col));
}

useSeo({
  title: computed(() => `${artifact.value?.title ?? "Artifact"} Playground`),
  description: computed(
    () => artifact.value?.description ?? "Generated typed-xlsx artifact playground.",
  ),
  type: "website",
});
</script>

<template>
  <div v-if="artifact" class="bp bp-pg">
    <div class="wb">
      <div class="wb-top">
        <nav class="crumbs" aria-label="Breadcrumb">
          <NuxtLink to="/playground">Playground</NuxtLink>
          <UIcon name="i-lucide-chevron-right" class="ic" />
          <span>{{ artifact.title }}</span>
        </nav>
        <div class="wb-actions">
          <NuxtLink
            v-if="prevArtifact"
            class="icon-btn"
            :to="`/playground/${prevArtifact.id}`"
            :aria-label="`Previous workbook: ${prevArtifact.title}`"
            ><UIcon name="i-lucide-chevron-left" class="ic"
          /></NuxtLink>
          <NuxtLink
            v-if="nextArtifact"
            class="icon-btn"
            :to="`/playground/${nextArtifact.id}`"
            :aria-label="`Next workbook: ${nextArtifact.title}`"
            ><UIcon name="i-lucide-chevron-right" class="ic"
          /></NuxtLink>
          <a class="btn btn-ghost sm hide-sm" :href="officeUrl" target="_blank" rel="noopener"
            ><UIcon name="i-lucide-external-link" class="ic" />Office Online</a
          >
          <a class="btn btn-ghost sm" :href="githubUrl" target="_blank" rel="noopener"
            ><UIcon name="i-simple-icons-github" class="ic" />Source</a
          >
          <a class="btn btn-primary sm" :href="workbookUrl" download @click="trackWorkbookDownload('header')"
            ><UIcon name="i-lucide-download" class="ic" />Download .xlsx</a
          >
        </div>
      </div>

      <div class="wb-tb">
        <div>
          <span>WORKBOOK</span><b>{{ artifact.title.toUpperCase() }}</b>
        </div>
        <div>
          <span>BUILDER</span><code class="ac">{{ builder }}</code>
        </div>
        <div>
          <span>SHEETS</span
          ><code>{{
            preview?.sheets.length ?? artifact.inspectSummary?.sheetNames.length ?? 0
          }}</code>
        </div>
        <div>
          <span>OOXML PARTS</span><code>{{ inspectFiles.length }} files</code>
        </div>
        <div>
          <span>FEATURES</span><code>{{ artifact.features.length }}</code>
        </div>
        <div>
          <span>DATASET</span><code>{{ artifact.datasetProfile }}</code>
        </div>
      </div>
      <p class="wb-sum">{{ getArtifactPlaygroundSummary(artifact) }}</p>

      <div ref="main" class="wb-main" :data-mode="mode">
        <aside class="wb-files" aria-label="Files">
          <h4>SOURCE</h4>
          <button
            v-for="pane in sourcePanes"
            :key="pane.key"
            type="button"
            class="fi"
            :class="{ on: isActive({ kind: 'source', name: pane.key }) }"
            @click="openFile({ kind: 'source', name: pane.key })"
          >
            <UIcon name="i-lucide-file-code-2" class="ic" /><span>{{ pane.key }}</span>
          </button>
          <h4>OUTPUT</h4>
          <a class="fi" :href="workbookUrl" download @click="trackWorkbookDownload('file_sidebar')"
            ><UIcon name="i-lucide-sheet" class="ic" /><span>{{
              artifact.artifactFile.split("/").pop()
            }}</span></a
          >
          <h4>OOXML PARTS</h4>
          <button
            v-for="file in inspectFiles"
            :key="file"
            type="button"
            class="fi"
            :class="{ on: isActive({ kind: 'inspect', name: file }) }"
            @click="openFile({ kind: 'inspect', name: file })"
          >
            <UIcon name="i-lucide-file-code" class="ic" /><span>{{ file }}</span
            ><small v-if="sheetFileLabel(file)">{{ sheetFileLabel(file) }}</small>
          </button>
        </aside>

        <section class="wb-code">
          <div class="pane-h">
            <div class="fname">
              <UIcon name="i-lucide-file-code-2" class="ic" /><b>{{ activeFile.name }}</b
              ><span v-if="activeFile.kind === 'source' && blockByCol.size"
                >click a .column() block</span
              ><span v-else-if="activeFile.kind === 'inspect'">{{
                sheetFileLabel(activeFile.name) ?? "OOXML part"
              }}</span>
            </div>
            <div class="seg" role="group" aria-label="Layout">
              <button
                v-for="m in ['split', 'code', 'sheet'] as const"
                :key="m"
                type="button"
                :class="{ on: mode === m }"
                @click="mode = m"
              >
                {{ m[0]!.toUpperCase() + m.slice(1) }}
              </button>
            </div>
          </div>
          <div ref="codeBody" class="code-body" @click="onCodeClick" @scroll.passive="drawLink">
            <ClientOnly v-if="activeFile.kind === 'source'">
              <PlaygroundCodeBlock
                :artifact-id="artifact.id"
                :pane-key="activeFile.name"
                theme="vitesse-dark"
              />
            </ClientOnly>
            <div v-else-if="xmlLoading" class="code-loading">Loading {{ activeFile.name }}…</div>
            <pre v-else class="xml-pre"><code v-html="xmlHtml" /></pre>
          </div>
        </section>

        <section class="wb-sheet">
          <div class="pane-h">
            <div class="fname">
              <UIcon name="i-lucide-table" class="ic" /><b>{{ sheet?.name }}</b
              ><span>{{ usedRange }}</span>
            </div>
            <span class="hint"
              ><UIcon name="i-lucide-mouse-pointer-click" class="ic" />click a cell to inspect
              it</span
            >
            <div class="seg mseg" role="group" aria-label="Pane">
              <button type="button" :class="{ on: mode === 'code' }" @click="mode = 'code'">
                Code
              </button>
              <button type="button" :class="{ on: mode !== 'code' }" @click="mode = 'sheet'">
                Sheet
              </button>
            </div>
          </div>
          <div class="sfb">
            <span class="ref">{{ selected ?? "" }}</span
            ><span class="fxs">fx</span><span class="val">{{ formulaBar }}</span>
          </div>
          <div ref="gscroll" class="gscroll" @scroll.passive="drawLink">
            <XlsxSheet
              v-if="sheet && preview"
              :sheet="sheet"
              :styles="preview.styles"
              :dxfs="preview.dxfs"
              interactive
              :zoom="0.9"
              :extra-rows="14"
              :extra-cols="3"
              :selected="selected"
              :selected-col="selectedCol"
              @select-cell="selectCell"
              @select-col="selectColumn($event)"
            />
            <div v-else class="code-loading">Loading workbook…</div>
          </div>
          <div class="drawer" :class="{ open: drawerOpen && inspector.length }">
            <div class="dr-h">
              <span
                >Cell <b>{{ selected }}</b> in the file</span
              >
              <button type="button" aria-label="Close inspector" @click="drawerOpen = false">
                <UIcon name="i-lucide-x" class="ic" />
              </button>
            </div>
            <div class="dr-b" @click="onInspectorClick">
              <template v-for="(row, i) in inspector" :key="i">
                <span class="k">{{ row.k }}</span>
                <span class="v" :data-col="row.col" v-html="row.html" />
              </template>
            </div>
          </div>
          <div class="xtabs" role="tablist">
            <button
              v-for="(s, i) in preview?.sheets ?? []"
              :key="s.name"
              type="button"
              role="tab"
              :aria-selected="i === sheetIndex"
              :class="{ on: i === sheetIndex }"
              @click="sheetIndex = i"
            >
              {{ s.name }}
            </button>
          </div>
        </section>
        <svg class="wb-link" aria-hidden="true">
          <path v-if="linkPath" :d="linkPath" />
          <circle v-for="(d, i) in linkDots" :key="i" :cx="d.x" :cy="d.y" r="3" />
        </svg>
      </div>
    </div>
  </div>
</template>
