<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { AggregateResult, ChartType, DashboardWidget, Dataset, PresenceEntry, WidgetLayout } from '@/types';
import type { ThemeMode } from '@/composables/useTheme';
import WidgetCard from './WidgetCard.vue';

const props = defineProps<{
  widgets: DashboardWidget[];
  datasets: Dataset[];
  presence: PresenceEntry[];
  selfId: string;
  focusedWidgetId: string | null;
  connected: boolean;
  theme: ThemeMode;
  getAggregate: (widgetId: string) => AggregateResult | null;
  hasAggregateError: (widgetId: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'select-widget', id: string): void;
  (e: 'edit-widget', widget: DashboardWidget): void;
  (e: 'delete-widget', id: string): void;
  (e: 'move', payload: { id: string; layout: WidgetLayout }): void;
  (e: 'draft', payload: { chartType: ChartType; layout: WidgetLayout }): void;
  (e: 'focus', id: string | null): void;
}>();

const COLS = 12;
const ROW_HEIGHT = 64;
const GAP = 12;
const PITCH = ROW_HEIGHT + GAP;

const canvas = ref<HTMLDivElement | null>(null);
const width = ref(960);
let observer: ResizeObserver | null = null;

const colWidth = computed(() => Math.max(36, (width.value - GAP * (COLS - 1)) / COLS));

onMounted(() => {
  if (!canvas.value) return;
  width.value = canvas.value.clientWidth;
  observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) width.value = entry.contentRect.width;
  });
  observer.observe(canvas.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  origin: WidgetLayout;
  current: WidgetLayout;
  moved: boolean;
}

const drag = ref<DragState | null>(null);

function beginDrag(event: PointerEvent, widget: DashboardWidget, mode: 'move' | 'resize'): void {
  if (event.button !== 0) return;
  event.preventDefault();
  emit('select-widget', widget.id);
  drag.value = {
    id: widget.id,
    mode,
    startX: event.clientX,
    startY: event.clientY,
    origin: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
    current: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
    moved: false,
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(event: PointerEvent): void {
  const state = drag.value;
  if (!state) return;
  const rawDx = event.clientX - state.startX;
  const rawDy = event.clientY - state.startY;
  if (!state.moved && Math.abs(rawDx) < 4 && Math.abs(rawDy) < 4) return;

  state.moved = true;
  const dx = Math.round(rawDx / (colWidth.value + GAP));
  const dy = Math.round(rawDy / PITCH);

  if (state.mode === 'move') {
    state.current.x = clamp(state.origin.x + dx, 0, COLS - state.origin.w);
    state.current.y = Math.max(0, state.origin.y + dy);
  } else {
    state.current.w = clamp(state.origin.w + dx, 2, COLS - state.origin.x);
    state.current.h = clamp(state.origin.h + dy, 2, 14);
  }
}

function onPointerUp(): void {
  const state = drag.value;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  if (state?.moved) {
    emit('move', { id: state.id, layout: { ...state.current } });
  }
  drag.value = null;
}

function layoutOf(widget: DashboardWidget): WidgetLayout {
  const state = drag.value;
  return state && state.id === widget.id ? state.current : { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
}

function cardStyle(widget: DashboardWidget): Record<string, string> {
  const layout = layoutOf(widget);
  return {
    left: `${layout.x * (colWidth.value + GAP)}px`,
    top: `${layout.y * PITCH}px`,
    width: `${layout.w * colWidth.value + (layout.w - 1) * GAP}px`,
    height: `${layout.h * PITCH - GAP}px`,
  };
}

const canvasHeight = computed(() => {
  const maxRow = props.widgets.reduce((max, widget) => Math.max(max, layoutOf(widget).y + layoutOf(widget).h), 0);
  return Math.max(6, maxRow) * PITCH - GAP + 8;
});

const editorsByWidget = computed<Record<string, PresenceEntry>>(() => {
  const map: Record<string, PresenceEntry> = {};
  for (const entry of props.presence) {
    if (entry.editingWidgetId && entry.user.id !== props.selfId) {
      map[entry.editingWidgetId] = entry;
    }
  }
  return map;
});

function datasetOf(widget: DashboardWidget): Dataset | undefined {
  return props.datasets.find((dataset) => dataset.id === widget.datasetId);
}

const dragDepth = ref(0);
const isDragOver = computed(() => dragDepth.value > 0);

function onDragEnter(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes('text/plain')) return;
  event.preventDefault();
  dragDepth.value += 1;
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault();
  dragDepth.value = Math.max(0, dragDepth.value - 1);
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  dragDepth.value = 0;
  const raw = event.dataTransfer?.getData('text/plain') ?? '';
  if (!raw.startsWith('chart:')) return;
  const chartType = raw.slice(6) as ChartType;
  const rect = canvas.value?.getBoundingClientRect();
  if (!rect) return;
  emit('draft', {
    chartType,
    layout: {
      x: clamp(Math.round((event.clientX - rect.left) / (colWidth.value + GAP)), 0, COLS - 6),
      y: Math.max(0, Math.round((event.clientY - rect.top) / PITCH)),
      w: 6,
      h: 4,
    },
  });
}
</script>

<template>
  <div class="min-w-0">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-subtle">
      <div class="flex items-center gap-2">
        <span class="rounded-full border border-app bg-card-2 px-2 py-1 text-soft">
          {{ props.widgets.length }} 个图表
        </span>
        <span>拖动标题栏移动 · 右下角缩放 · 左侧拖入新图表</span>
      </div>
      <span
        v-if="drag || isDragOver"
        class="rounded-full bg-violet-500/10 px-2 py-1 text-violet-300"
      >
        {{ isDragOver ? '松开以添加图表' : '对齐网格中…' }}
      </span>
    </div>

    <div
      ref="canvas"
      class="canvas-grid relative w-full rounded-2xl border transition-colors"
      :class="isDragOver ? 'border-violet-400/60 bg-violet-500/[0.04]' : 'border-soft bg-card-3'"
      :style="{ height: `${canvasHeight}px` }"
      @pointerdown.self="emit('focus', null)"
      @dragenter="onDragEnter"
      @dragover.prevent
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <WidgetCard
        v-for="widget in props.widgets"
        :key="widget.id"
        :widget="widget"
        :aggregate-result="props.getAggregate(widget.id)"
        :aggregate-error="props.hasAggregateError(widget.id)"
        :editor="editorsByWidget[widget.id]"
        :selected="props.focusedWidgetId === widget.id"
        :theme="props.theme"
        :style-object="cardStyle(widget)"
        @select="emit('select-widget', widget.id)"
        @grab="(event, mode) => beginDrag(event, widget, mode)"
        @edit="emit('edit-widget', widget)"
        @delete="emit('delete-widget', widget.id)"
      />

      <div
        v-if="!props.widgets.length"
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
      >
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-app bg-card-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-7 w-7 text-subtle">
            <path d="M4 6h16M4 12h10M4 18h6" stroke-linecap="round" />
            <path d="M17 14v6m-3-3h6" />
          </svg>
        </div>
        <div>
          <p class="text-sm text-app">画布还是空的</p>
          <p class="mt-1 text-[11px] text-subtle">从左侧拖入图表组件，或点击组件快速添加</p>
        </div>
      </div>
    </div>
  </div>
</template>
