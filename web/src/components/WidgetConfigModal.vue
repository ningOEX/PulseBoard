<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  AggregateResult,
  Aggregation,
  ChartType,
  ConfigState,
  Dataset,
  WidgetAggregateParams,
  WidgetDraft,
} from '@/types';
import type { ThemeMode } from '@/composables/useTheme';
import { buildChartOption } from '@/utils/chartOption';
import ChartTypeIcon from './ChartTypeIcon.vue';
import ChartView from './ChartView.vue';
import AppSelect, { type SelectOption } from './AppSelect.vue';

const props = defineProps<{
  state: ConfigState | null;
  datasets: Dataset[];
  theme: ThemeMode;
  previewAggregate: (params: WidgetAggregateParams, gaugeType?: boolean) => Promise<AggregateResult & { total?: number }>;
}>();

const emit = defineEmits<{
  (e: 'save', draft: WidgetDraft): void;
  (e: 'close'): void;
}>();

const chartTypes: { type: ChartType; label: string }[] = [
  { type: 'line', label: '折线' },
  { type: 'bar', label: '柱状' },
  { type: 'pie', label: '饼图' },
  { type: 'scatter', label: '散点' },
  { type: 'radar', label: '雷达' },
  { type: 'gauge', label: '仪表' },
];

const aggregations: { value: Aggregation; label: string }[] = [
  { value: 'sum', label: '求和' },
  { value: 'avg', label: '平均' },
  { value: 'count', label: '计数' },
];

function emptyForm(): WidgetDraft {
  return {
    title: '',
    chartType: 'bar',
    datasetId: '',
    dimension: '',
    breakdown: '',
    metric: '',
    aggregation: 'sum',
    x: 0,
    y: 0,
    w: 6,
    h: 4,
  };
}

const form = ref<WidgetDraft>(emptyForm());
const previewResult = ref<AggregateResult | null>(null);
const previewLoading = ref(false);
const previewError = ref(false);

function chartLabel(type: ChartType | undefined): string {
  return chartTypes.find((item) => item.type === type)?.label ?? '柱状';
}

function firstField(dataset: Dataset | undefined, type: 'dimension' | 'measure'): string {
  return dataset?.fields.find((field) => field.type === type)?.key ?? '';
}

watch(
  () => props.state,
  (state) => {
    if (!state) return;
    const initialDataset =
      props.datasets.find((dataset) => dataset.id === state.widget.datasetId) ?? props.datasets[0];
    form.value = {
      id: state.mode === 'edit' ? state.widget.id : undefined,
      title: state.widget.title ?? `${chartLabel(state.widget.chartType)}图表`,
      chartType: state.widget.chartType ?? 'bar',
      datasetId: initialDataset?.id ?? '',
      dimension: state.widget.dimension || firstField(initialDataset, 'dimension'),
      breakdown: state.widget.breakdown ?? '',
      metric: state.widget.metric || firstField(initialDataset, 'measure'),
      aggregation: state.widget.aggregation ?? 'sum',
      x: state.widget.x,
      y: state.widget.y,
      w: state.widget.w,
      h: state.widget.h,
    };
    previewResult.value = null;
  },
  { immediate: true },
);

const database = computed(() => props.datasets.find((dataset) => dataset.id === form.value.datasetId));
const dimensionFields = computed(() => database.value?.fields.filter((field) => field.type === 'dimension') ?? []);
const measureFields = computed(() => database.value?.fields.filter((field) => field.type === 'measure') ?? []);

const datasetOptions = computed<SelectOption[]>(() =>
  props.datasets.map((dataset) => ({ value: dataset.id, label: dataset.name })),
);
const dimensionOptions = computed<SelectOption[]>(() =>
  dimensionFields.value.map((field) => ({ value: field.key, label: field.label })),
);
const breakdownOptions = computed<SelectOption[]>(() => [
  { value: '', label: '不分组' },
  ...dimensionFields.value
    .filter((field) => field.key !== form.value.dimension)
    .map((field) => ({ value: field.key, label: field.label })),
]);
const metricOptions = computed<SelectOption[]>(() =>
  measureFields.value.map((field) => ({ value: field.key, label: field.label })),
);

// 切换数据源时重置维度/指标（替代原 select 的 @change）
watch(
  () => form.value.datasetId,
  (newId, oldId) => {
    if (newId && newId !== oldId) onDatasetChange();
  },
);

// 表单字段变化 → 调用后端接口生成预览（防抖）
let previewTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  form,
  async (draft) => {
    if (!props.state) return;
    if (!draft.datasetId || !draft.metric) {
      previewResult.value = null;
      return;
    }
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      previewLoading.value = true;
      previewError.value = false;
      try {
        previewResult.value = await props.previewAggregate(
          {
            datasetId: draft.datasetId,
            dimension: draft.dimension,
            breakdown: draft.breakdown || undefined,
            metric: draft.metric,
            aggregation: draft.aggregation,
          },
          draft.chartType === 'gauge',
        );
      } catch {
        previewError.value = true;
        previewResult.value = null;
      } finally {
        previewLoading.value = false;
      }
    }, 150);
  },
  { deep: true },
);

const previewOption = computed(() => buildChartOption(
  { ...form.value, id: 'preview' },
  previewResult.value,
  props.theme,
));

function fieldLabel(key: string | undefined): string {
  if (!key) return '';
  return database.value?.fields.find((f) => f.key === key)?.label ?? key;
}

function onDatasetChange(): void {
  form.value.dimension = firstField(database.value, 'dimension');
  form.value.breakdown = '';
  form.value.metric = firstField(database.value, 'measure');
}

function save(): void {
  const title = form.value.title.trim() || `${chartLabel(form.value.chartType)} · ${database.value?.name ?? '图表'}`;
  emit('save', { ...form.value, title: title.slice(0, 40) });
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.state"
      class="fixed inset-0 z-40 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
      @pointerdown.self="emit('close')"
    >
      <div class="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-app bg-card shadow-2xl">
        <header class="flex items-center justify-between border-b border-soft px-5 py-3.5">
          <div>
            <h2 class="text-sm font-semibold text-app">
              {{ props.state.mode === 'create' ? '添加图表' : '编辑图表配置' }}
            </h2>
            <p class="mt-0.5 text-[11px] text-subtle">配置会通过 Socket.io 实时同步给所有协作者</p>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-soft transition hover:bg-hover hover:text-app"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
              <path d="M6 6l12 12M18 6l-12 12" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.05fr,1fr]">
          <div class="space-y-4 p-5">
            <div>
              <label class="label">图表标题</label>
              <input v-model="form.title" class="field" maxlength="40" placeholder="给图表起个名字" />
            </div>

            <div>
              <label class="label">图表类型</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="item in chartTypes"
                  :key="item.type"
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] transition"
                  :class="form.chartType === item.type ? 'border-violet-400/60 bg-violet-500/15 text-violet-200' : 'border-app bg-card-3 text-soft hover:text-app'"
                  @click="form.chartType = item.type"
                >
                  <span class="h-4 w-4"><ChartTypeIcon :type="item.type" /></span>
                  {{ item.label }}
                </button>
              </div>
            </div>

            <div>
              <label class="label">数据源</label>
              <AppSelect v-model="form.datasetId" :options="datasetOptions" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">分类维度</label>
                <AppSelect v-model="form.dimension" :options="dimensionOptions" />
              </div>
              <div>
                <label class="label">分组维度</label>
                <AppSelect v-model="form.breakdown" :options="breakdownOptions" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">指标</label>
                <AppSelect v-model="form.metric" :options="metricOptions" />
              </div>
              <div>
                <label class="label">聚合方式</label>
                <div class="flex rounded-lg border border-app bg-card-3 p-1">
                  <button
                    v-for="item in aggregations"
                    :key="item.value"
                    type="button"
                    class="flex-1 rounded-md px-2 py-1.5 text-[11px] transition"
                    :class="form.aggregation === item.value ? 'bg-violet-500/25 text-violet-200' : 'text-soft hover:text-app'"
                    @click="form.aggregation = item.value"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </div>
            </div>

            <p class="rounded-lg border border-soft bg-card-3 px-3 py-2 text-[10px] leading-relaxed text-subtle">
              当前映射：{{ database?.name ?? '数据源' }} · 按
              <span class="text-cyan-500">{{ fieldLabel(form.dimension) }}</span>
              <span v-if="form.breakdown"> / <span class="text-cyan-500">{{ fieldLabel(form.breakdown) }}</span></span>
              分组，统计 <span class="text-amber-500">{{ fieldLabel(form.metric) }}</span>
            </p>
          </div>

          <div class="flex flex-col border-t border-soft p-5 lg:border-l lg:border-t-0">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-[11px] font-semibold uppercase tracking-widest text-subtle">实时预览</p>
              <span class="flex items-center gap-1 text-[10px]">
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="previewLoading ? 'animate-pulse bg-violet-400' : previewError ? 'bg-rose-400' : 'bg-emerald-400'"
                ></span>
                <span :class="previewError ? 'text-rose-300' : 'text-subtle'">
                  {{ previewLoading ? '后端计算中…' : previewError ? '预览失败' : '聚合接口 · ECharts' }}
                </span>
              </span>
            </div>
            <div class="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-soft bg-card-3">
              <ChartView :option="previewOption" />
              <div
                v-if="previewLoading"
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-overlay/40"
              >
                <div class="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/50 border-t-violet-400"></div>
              </div>
            </div>
            <p class="mt-2 text-[10px] text-subtle">
              图表尺寸可在画布中拖拽右下角调整，位置拖动标题栏即可对齐网格。
            </p>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-soft px-5 py-3.5">
          <button type="button" class="btn-ghost" @click="emit('close')">取消</button>
          <button type="button" class="btn-primary" @click="save">
            {{ props.state.mode === 'create' ? '添加到看板' : '保存配置' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
