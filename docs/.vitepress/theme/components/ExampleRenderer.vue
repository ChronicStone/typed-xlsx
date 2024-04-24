<script setup lang="ts">
import { useData } from 'vitepress'
import { NCard, NConfigProvider, NScrollbar, NSplit, NTabPane, NTabs, darkTheme } from 'naive-ui'
import { nextTick, onMounted, ref, watch } from 'vue'
import { codeToHtml } from 'shiki'
import { transformerTwoslash } from '@shikijs/twoslash'
import { THEME_OVERRIDES } from '../config/themeVars'

const props = defineProps<{ fileKey: string }>()
const { isDark } = useData()
const GITHUB_URL = 'https://github.com/ChronicStone/typed-xlsx/raw/main/examples/'
const iframeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${GITHUB_URL}${props.fileKey}.xlsx`

const splitRef = ref<InstanceType<typeof NSplit> | null>(null)

const loading = ref(true)
const file = ref<string | null>(null)
const schema = ref<string | null>(null)
const data = ref<string | null>(null)

const parsedFile = ref<string | null>(null)
const parsedSchema = ref<string | null>(null)
const parsedData = ref<string | null>(null)

async function loadTemplates() {
  schema.value = await import(`../../../.examples/${props.fileKey}/schema.ts?raw`).then(data => data.default).catch(() => null)
  data.value = await import(`../../../.examples/${props.fileKey}/data.ts?raw`).then(data => data.default).catch(() => null)
  file.value = await import(`../../../.examples/${props.fileKey}/file.ts?raw`).then(data => data.default).catch(() => null)
}

async function parseTemplates() {
  await nextTick()
  if (file.value)
    parsedFile.value = await renderCode(file.value)
  if (schema.value)
    parsedSchema.value = await renderCode(schema.value)
  if (data.value)
    parsedData.value = await renderCode(data.value)
}

onMounted(async () => {
  try {
    await loadTemplates()
    await parseTemplates()
  }
  catch (e) {
    console.error(e)
  }
  finally {
    loading.value = false
  }
})

function renderCode(code: string) {
  return codeToHtml(code, {
    lang: 'ts',
    theme: isDark.value ? 'github-dark' : 'github-light',
    // transformers: [
    //   transformerTwoslash(), // <-- here
    // ],
  })
}

watch(() => isDark.value, () => parseTemplates())
</script>

<template>
  <NConfigProvider v-if="!loading" :theme="isDark ? darkTheme : undefined" :theme-overrides="THEME_OVERRIDES">
    <NCard class="mt-20" content-class="flex items-center flex items-center flex-col lg:flex-row !p-0 " style="height: 80vh">
      <NSplit ref="splitRef" direction="horizontal">
        <template #1>
          <NTabs type="line" animated>
            <NTabPane v-if="file" name="schema.ts">
              <template #tab>
                <div class="px-2">
                  schema.ts
                </div>
              </template>
              <NScrollbar class="max-h-[75vh]">
                <div v-html="parsedSchema" />
              </NScrollbar>
            </NTabPane>
            <NTabPane v-if="data" name="data.ts">
              <NScrollbar>
                <div v-html="parsedData" />
              </NScrollbar>
            </NTabPane>
            <NTabPane v-if="file" name="file.ts">
              <NScrollbar>
                <div v-html="parsedFile" />
              </NScrollbar>
            </NTabPane>
          </NTabs>
        </template>
        <template #2>
          <div class="w-full h-full">
            <iframe v-show="!splitRef?.isDragging" :src="iframeUrl" class="w-full h-full" />
          </div>
        </template>
      </NSplit>
    </NCard>
  </NConfigProvider>
</template>
