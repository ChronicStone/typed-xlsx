<script setup lang="ts">
import { Sandbox, sandboxProps } from 'vitepress-plugin-sandpack'

const props = defineProps(sandboxProps)
</script>

<template>
  <Sandbox
    :template="template"
    :light-theme="lightTheme"
    :dark-theme="darkTheme"
    :options="{
      ...props,
      coderHeight: 400,
      previewHeight: 400,
      showLineNumbers: true,
      resizablePanels: true,
    }"
    :custom-setup="{
      ...props,
      deps: {
        '@chronicstone/typed-xlsx': 'latest',
        'x-data-spreadsheet': 'latest',
        '@faker-js/faker': '^8.3.1',
        'xlsx': '0.18.5',
      },
    }"
    :code-options="codeOptions"
  >
    <slot />
  </Sandbox>
</template>
