<script setup lang="ts">
const route = useRoute();

const isDocsPage = computed(() => route.path.startsWith("/getting-started"));
</script>

<template>
  <UButton
    to="/getting-started/key-benefits-and-why"
    trailing-icon="i-lucide-arrow-right"
    color="primary"
    :variant="isDocsPage ? 'soft' : 'solid'"
    size="sm"
    class="hidden md:inline-flex"
  >
    Get Started
  </UButton>
</template>
