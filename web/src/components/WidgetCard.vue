<script setup lang="ts">
import { computed } from 'vue';
import type { AggregateResult, DashboardWidget, PresenceEntry } from '@/types';
import type { ThemeMode } from '@/composables/useTheme';
import { buildChartOption, formatNumber } from '@/utils/chartOption';
import ChartTypeIcon from './ChartTypeIcon.vue';
import ChartView from './ChartView.vue';

const props = defineProps<{
  widget: DashboardWidget;
  aggregateResult: AggregateResult | null;
  aggregateError: boolean;
  editor?: PresenceEntry;
  selected: boolean;
  theme: ThemeMode;
  styleObject: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'grab', event: PointerEvent, mode: 'move' | 'resize'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
}>();

const option = computed(() => buildChartOption(props.widget, props.aggregateResult, props.theme));

const meta = computed(() => {
  const metric = props.aggregateResult?.metricLabel ?? props.widget.metric;
  const dimension = props.aggregateResult?.dimensionLabel ?? props.widget.dimension;
  const breakdown = props.aggregateResult?.breakdownLabel;
  const parts = [metric, dimension];
  if (breakdown) parts.push(`× ${breakdown}`);
  return parts.join(' · ');
});

const summary = computed(() => {
  if (!props.aggregateResult) return '';
  const firstSeries = props.aggregateResult.series[0];
  if (!firstSeries?.values?.length) return '';
  const sum = firstSeries.values.reduce((a, b) => a + b, 0);
  const avg = sum / firstSeries.values.length;
  return `合计 ${formatNumber(sum)} · 均值 ${formatNumber(avg)}`;
});

const cardStyle = computed(() => {
  const base: Record<string, string> = { ...props.styleObject };
  if (props.editor) {
    base.borderColor = props.editor.user.color;
    base.boxShadow = `0 0 0 1px ${props.editor.user.color}66, 0 12px 40px -18px ${props.editor.user.color}`;
  } else if (props.selected) {
    base.borderColor = 'rgba(139, 92, 246, 0.65)';
    base.boxShadow = '0 0 0 1px rgba(139, 92, 246, 0.35), 0 12px 40px -18px rgba(139, 92, 246, 0.6)';
  }
  return base;
});
</script>

<template>
  <article
    class="group absolute flex flex-col overflow-hidden rounded-2xl border bg-card shadow-lg shadow-black/10 backdrop-blur transition-colors"
    :style="cardStyle"
    @pointerdown="emit('select')"
  >
    <header
      class="flex shrink-0 cursor-grab items-center gap-2 border-b border-soft px-3 py-2 active:cursor-grabbing"
      @pointerdown.stop="emit('grab', $event, 'move')"
    >
      <div class="h-4 w-4 shrink-0 text-subtle">
        <ChartTypeIcon :type="props.widget.chartType" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-[13px] font-medium text-app">{{ props.widget.title }}</h3>
        <p class="truncate text-[10px] text-subtle">
          {{ meta }}<template v-if="summary"> · <span class="text-soft">{{ summary }}</span></template>
        </p>
      </div>

      <span
        v-if="props.editor"
        class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
        :style="{ backgroundColor: `${props.editor.user.color}22`, color: props.editor.user.color }"
      >
        <span class="h-1.5 w-1.5 animate-pulse rounded-full" :style="{ backgroundColor: props.editor.user.color }"></span>
        {{ props.editor.user.name }}
      </span>

      <div class="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-md text-soft transition hover:bg-hover hover:text-app"
          title="编辑配置"
          @pointerdown.stop
          @click.stop="emit('edit')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-3.5 w-3.5">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-md text-soft transition hover:bg-rose-500/20 hover:text-rose-300"
          title="删除图表"
          @pointerdown.stop
          @click.stop="emit('delete')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-3.5 w-3.5">
            <path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" />
          </svg>
        </button>
      </div>
    </header>

    <div class="relative min-h-0 flex-1 px-1 pb-1 pt-1">
      <ChartView v-if="!props.aggregateError" :option="option" />
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center text-center text-[11px] text-rose-300/80"
      >
        聚合请求失败
      </div>
    </div>

    <div
      class="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
      title="拖拽缩放"
      @pointerdown.stop="emit('grab', $event, 'resize')"
    >
      <div class="absolute bottom-1 right-1 h-2 w-2 rounded-sm bg-violet-400/50 transition group-hover:bg-violet-400/80"></div>
    </div>
  </article>
</template>
