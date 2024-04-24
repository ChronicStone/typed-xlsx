<script setup lang="ts">
import { NCard, NScrollbar, NTabPane, NTabs } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ fileKey: string }>()

const GITHUB_URL = 'https://github.com/ChronicStone/typed-xlsx/raw/main/examples/'
const iframeUrl = computed(() => `https://view.officeapps.live.com/op/embed.aspx?src=${GITHUB_URL}${props.fileKey}.xlsx`)
</script>

<template>
  <NCard content-class="flex items-center flex items-center flex-col lg:flex-row !p-0 h-80vh">
    <div class="w-1/2 h-full">
      <NTabs>
        <NTabPane v-if="$slots.schema" name="schema.ts">
          <NScrollbar>
            <slot name="schema" />
          </NScrollbar>
        </NTabPane>
        <NTabPane v-if="$slots.data" name="data.ts">
          <NScrollbar>
            <slot name="data" />
          </NScrollbar>
        </NTabPane>
        <NTabPane v-if="$slots.file" name="file.ts">
          <NScrollbar>
            <slot name="file" />
          </NScrollbar>
        </NTabPane>
      </NTabs>
    </div>
    <iframe :src="iframeUrl" class="w-1/2 h-full" />
  </NCard>
</template>
