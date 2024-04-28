<script setup lang="ts">
import { useData } from 'vitepress'
import { darkTheme } from 'naive-ui'
import { computed, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { THEME_OVERRIDES } from '../config/themeVars'
// @ts-expect-error missing types
import { data } from '../data/examples.data'

const props = defineProps<{ fileKey: string }>()
const { isDark } = useData()
const GITHUB_URL = 'https://github.com/ChronicStone/typed-xlsx/raw/main/examples/'
const iframeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${GITHUB_URL}${props.fileKey}.xlsx&action=embedview&zoom=0.5`

const splitRef = ref<any>(null)
const loading = ref(false)

const theme = computed(() => isDark.value ? 'dark' : 'light')
const example = (data as any).find(e => e.key === props.fileKey)

const { width } = useWindowSize()
const isSmallScreen = computed(() => width.value < 768)
</script>

<template>
  <NConfigProvider v-if="!loading" :theme="isDark ? darkTheme : undefined" :theme-overrides="THEME_OVERRIDES">
    <NCard class="mt-20 xlsx-example !h-full" content-class="flex items-center flex items-center flex-col lg:flex-row !p-0 " style="height: 80vh">
      <NSplit ref="splitRef" :direction="isSmallScreen ? 'vertical' : 'horizontal'" :resize-trigger-size="10" :default-size="0.5">
        <template #1>
          <NTabs type="line" animated>
            <NTabPane v-if="example?.schema" name="schema.ts">
              <template #tab>
                <div class="px-2">
                  schema.ts
                </div>
              </template>
              <NScrollbar :class="!isSmallScreen ? 'max-h-[75vh]' : 'max-h-[50vh]'">
                <div v-html="example?.schema[theme]" />
              </NScrollbar>
            </NTabPane>
            <NTabPane v-if="example?.data" name="data.ts">
              <NScrollbar :class="!isSmallScreen ? 'max-h-[75vh]' : 'max-h-[50vh]'">
                <div v-html="example?.data[theme]" />
              </NScrollbar>
            </NTabPane>
            <NTabPane v-if="example?.file" name="file.ts">
              <NScrollbar :class="!isSmallScreen ? 'max-h-[75vh]' : 'max-h-[50vh]'">
                <div v-html="example?.file[theme]" />
              </NScrollbar>
            </NTabPane>
          </NTabs>
        </template>
        <template #2>
          <iframe v-show="!splitRef?.isDragging" :src="iframeUrl" class="w-full h-full" :class="!isSmallScreen ? '' : '!h-[50vh]'" />
        </template>
      </NSplit>
    </NCard>
  </NConfigProvider>
</template>

<style scoped>
.xlsx-example:deep() .github-dark {
  background-color: transparent !important;
}

.xlsx-example:deep() .shiki {
  padding-left: 1em !important;
  padding-top: 0 !important;
}
</style>
