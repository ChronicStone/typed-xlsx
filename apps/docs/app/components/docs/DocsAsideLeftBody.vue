<script setup lang="ts">
const { sidebarNavigation } = useSubNavigation();
</script>

<template>
  <UContentNavigation
    highlight
    type="single"
    :default-open="true"
    :navigation="sidebarNavigation"
  />
</template>
