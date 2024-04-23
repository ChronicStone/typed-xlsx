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
      ...props, // do not forget it
      hideEditor: true,
      showLineNumbers: true,
    }"
    :hide-editor="true"
    :custom-setup="{
      ...props, // do not forget it
      deps: {
        '@chronicstone/typed-xlsx': 'latest',
        'x-data-spreadsheet': 'latest',
      },
    }"
    :code-options="codeOptions"
  >
    <slot />
  </Sandbox>
</template>
