<script lang="ts" setup>
// 1200x600 share card for docs pages. Rendered by satori: flexbox only, inline styles.
const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    headline?: string;
  }>(),
  {
    title: "",
    description: "",
  },
);

const rawTitle = props.title || "";
const cardTitle = rawTitle.length > 70 ? `${rawTitle.slice(0, 67).trimEnd()}…` : rawTitle;
const rawDescription = props.description || "";
const cardDescription =
  rawDescription.length > 190 ? `${rawDescription.slice(0, 187).trimEnd()}…` : rawDescription;
const titleSize = cardTitle.length > 34 ? "64px" : "80px";
</script>

<template>
  <div
    class="flex flex-col"
    :style="{
      width: '100%',
      height: '100%',
      display: 'flex',
      position: 'relative',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 72px 60px',
      backgroundColor: '#06110c',
      fontFamily: 'OG Archivo',
      color: '#eaf6ef',
    }"
  >
    <svg
      width="1200"
      height="630"
      :style="{ position: 'absolute', left: 0, top: 0 }"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="og-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M40 0H0V40"
            fill="none"
            stroke="#3ee38c"
            stroke-opacity="0.07"
            stroke-width="1"
          />
        </pattern>
      </defs>
      <rect width="1200" height="630" fill="url(#og-grid)" />
    </svg>
    <div
      class="flex flex-row"
      :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }"
    >
      <img src="/wordmark-dark.svg" :style="{ height: '40px', width: '249px' }" />
      <span :style="{ fontFamily: 'OG Mono', fontSize: '20px', color: '#7f9c8c' }"> docs </span>
    </div>

    <div
      class="flex flex-col"
      :style="{ display: 'flex', flexDirection: 'column', width: '980px' }"
    >
      <div
        class="flex flex-row"
        v-if="headline"
        :style="{
          display: 'flex',
          fontFamily: 'OG Mono',
          fontSize: '22px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#3ee38c',
          marginBottom: '22px',
        }"
      >
        {{ headline }}
      </div>
      <div
        class="flex flex-row font-extrabold"
        :style="{
          display: 'flex',
          fontSize: titleSize,
          fontWeight: 800,
          lineHeight: 1.04,
          letterSpacing: '-0.035em',
        }"
      >
        {{ cardTitle }}
      </div>
      <div
        class="flex flex-row"
        v-if="cardDescription"
        :style="{
          display: 'flex',
          marginTop: '26px',
          fontSize: '28px',
          lineHeight: 1.4,
          color: '#7f9c8c',
        }"
      >
        {{ cardDescription }}
      </div>
    </div>

    <div
      class="flex flex-row"
      :style="{
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'OG Mono',
        fontSize: '20px',
        color: '#7f9c8c',
      }"
    >
      typed-xlsx.chronicstone.dev
    </div>
  </div>
</template>
