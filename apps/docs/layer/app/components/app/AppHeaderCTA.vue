<script setup lang="ts">
const route = useRoute();

const isPlaygroundPage = computed(() => route.path.startsWith("/playground"));
</script>

<template>
  <UButton
    to="/playground"
    trailing-icon="i-lucide-arrow-right"
    color="primary"
    :variant="isPlaygroundPage ? 'soft' : 'solid'"
    size="sm"
    class="hidden md:inline-flex"
  >
    Playground
  </UButton>
</template>
