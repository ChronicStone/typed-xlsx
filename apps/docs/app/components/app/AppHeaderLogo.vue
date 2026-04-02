<script setup lang="ts">
const appConfig = useAppConfig();
const { hasLogo, headerLightUrl, headerDarkUrl, contextMenuItems } = useLogoAssets();
const lightSrc = computed(() => headerLightUrl.value || headerDarkUrl.value);
const darkSrc = computed(() => headerDarkUrl.value || headerLightUrl.value);
const hasDistinctModes = computed(
  () => lightSrc.value && darkSrc.value && lightSrc.value !== darkSrc.value,
);
</script>

<template>
  <UContextMenu v-if="hasLogo" :items="contextMenuItems">
    <template v-if="hasDistinctModes">
      <img
        :src="lightSrc"
        :alt="appConfig.header?.logo?.alt || appConfig.header?.title"
        :class="['h-6 w-auto shrink-0 dark:hidden', appConfig.header?.logo?.class]"
      />
      <img
        :src="darkSrc"
        :alt="appConfig.header?.logo?.alt || appConfig.header?.title"
        :class="['hidden h-6 w-auto shrink-0 dark:block', appConfig.header?.logo?.class]"
      />
    </template>
    <img
      v-else
      :src="lightSrc"
      :alt="appConfig.header?.logo?.alt || appConfig.header?.title"
      :class="['h-6 w-auto shrink-0', appConfig.header?.logo?.class]"
    />
  </UContextMenu>
  <span v-else>
    {{ appConfig.header?.title || "{appConfig.header.title}" }}
  </span>
</template>
