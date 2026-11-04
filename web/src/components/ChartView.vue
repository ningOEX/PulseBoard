<script setup lang="ts">
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{ option: EChartsOption }>();

const host = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!host.value) return;
  chart = echarts.init(host.value, undefined, { renderer: 'canvas' });
  chart.setOption(props.option, true);
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(host.value);
});

watch(
  () => props.option,
  (option) => chart?.setOption(option, true),
  { deep: true },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="host" class="h-full w-full"></div>
</template>
