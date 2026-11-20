<script lang="ts" setup>
// 1200x600 share card for the landing page. Rendered by satori: flexbox only, inline styles.
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: "",
    description: "",
  },
);

const ink = "#eaf6ef";
const dim = "#7f9c8c";
const accent = "#3ee38c";
const line = "rgba(62, 227, 140, 0.16)";

const rows = [
  { account: "Northwind", region: "EMEA", arr: "$754,250", growth: "+23%" },
  { account: "Contoso", region: "AMER", arr: "$1,182,900", growth: "+14%" },
  { account: "Initech", region: "APAC", arr: "$486,120", growth: "+31%" },
  { account: "Umbrella", region: "EMEA", arr: "$921,780", growth: "+9%" },
];
</script>

<template>
  <div
    class="flex flex-row"
    :style="{
      width: '100%',
      height: '100%',
      display: 'flex',
      position: 'relative',
      backgroundColor: '#06110c',
      fontFamily: 'OG Archivo',
      color: ink,
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
    <!-- left: brand + headline -->
    <div
      class="flex flex-col"
      :style="{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '640px',
        padding: '64px 0 60px 72px',
      }"
    >
      <img src="/wordmark-dark.svg" :style="{ height: '44px', width: '274px' }" />

      <div class="flex flex-col" :style="{ display: 'flex', flexDirection: 'column' }">
        <div
          class="flex flex-col font-extrabold"
          :style="{
            display: 'flex',
            flexDirection: 'column',
            fontSize: '68px',
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
          }"
        >
          <span>Type-safe Excel</span>
          <span>reports for</span>
          <span :style="{ color: accent }">TypeScript</span>
        </div>
        <div
          class="flex flex-row"
          :style="{
            display: 'flex',
            marginTop: '26px',
            fontSize: '24px',
            lineHeight: 1.4,
            color: dim,
            width: '520px',
          }"
        >
          Formulas, styles, native tables and streamed exports of millions of rows.
        </div>
      </div>

      <div
        class="flex flex-row"
        :style="{
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'OG Mono',
          fontSize: '22px',
          color: ink,
        }"
      >
        <span :style="{ color: accent, marginRight: '14px' }">$</span>
        <span>npm i typed-xlsx</span>
      </div>
    </div>

    <!-- right: a sheet with a typed schema bleeding off the edge -->
    <div
      class="flex flex-col"
      :style="{
        position: 'absolute',
        left: '680px',
        top: '92px',
        width: '470px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0b1c14',
        border: `1.5px solid ${line}`,
        borderRadius: '14px',
        fontFamily: 'OG Mono',
        fontSize: '17px',
      }"
    >
      <!-- formula bar -->
      <div
        class="flex flex-row"
        :style="{
          display: 'flex',
          alignItems: 'center',
          height: '50px',
          padding: '0 20px',
          borderBottom: `1.5px solid ${line}`,
          color: dim,
        }"
      >
        <span :style="{ color: accent, fontStyle: 'italic', marginRight: '18px' }">fx</span>
        <span :style="{ color: ink }">=SUM(C2:C5)</span>
      </div>
      <!-- header -->
      <div
        class="flex flex-row font-bold"
        :style="{
          display: 'flex',
          height: '50px',
          alignItems: 'center',
          backgroundColor: accent,
          color: '#04140b',
          fontWeight: 700,
        }"
      >
        <span :style="{ width: '150px', paddingLeft: '20px' }">account</span>
        <span :style="{ width: '90px' }">region</span>
        <span :style="{ width: '140px' }">arr</span>
        <span :style="{ width: '80px' }">growth</span>
      </div>
      <div
        class="flex flex-row"
        v-for="(r, i) in rows"
        :key="r.account"
        :style="{
          display: 'flex',
          height: '50px',
          alignItems: 'center',
          borderBottom: `1px solid ${line}`,
          backgroundColor: i % 2 ? 'rgba(62,227,140,0.03)' : 'transparent',
          color: ink,
        }"
      >
        <span :style="{ width: '150px', paddingLeft: '20px' }">{{ r.account }}</span>
        <span :style="{ width: '90px', color: dim }">{{ r.region }}</span>
        <span :style="{ width: '140px' }">{{ r.arr }}</span>
        <span :style="{ width: '80px', color: accent }">{{ r.growth }}</span>
      </div>
      <!-- total row -->
      <div
        class="flex flex-row font-bold"
        :style="{
          display: 'flex',
          height: '54px',
          alignItems: 'center',
          color: ink,
          fontWeight: 700,
        }"
      >
        <span :style="{ width: '240px', paddingLeft: '20px' }">Total</span>
        <span
          :style="{
            display: 'flex',
            alignItems: 'center',
            height: '40px',
            padding: '0 10px',
            border: `2px solid ${accent}`,
            borderRadius: '4px',
          }"
          >$3,345,050</span
        >
      </div>
      <!-- type hint -->
      <div
        class="flex flex-row"
        :style="{
          display: 'flex',
          padding: '18px 20px',
          borderTop: `1.5px solid ${line}`,
          color: dim,
          fontSize: '16px',
        }"
      >
        <span :style="{ color: '#5ee8a0', marginRight: '10px' }">accessor:</span>
        <span>(row: Account) =&gt; number</span>
      </div>
    </div>
  </div>
</template>
