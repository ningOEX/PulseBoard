<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useIdentity } from '@/composables/useIdentity';
import { useDashboard } from '@/composables/useDashboard';
import { useTheme } from '@/composables/useTheme';
import type { ChartType, ConfigState, DashboardWidget, WidgetAggregateParams, WidgetDraft } from '@/types';
import { api } from '@/api';
import AppHeader from '@/components/AppHeader.vue';
import DashboardCanvas from '@/components/DashboardCanvas.vue';
import JoinDialog from '@/components/JoinDialog.vue';
import SidebarPanel from '@/components/SidebarPanel.vue';
import WidgetConfigModal from '@/components/WidgetConfigModal.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { useDialog } from '@/composables/useDialog';

const { identity, hasIdentity, saveIdentity } = useIdentity();
const { theme, toggleTheme } = useTheme();

const {
  connected,
  storeMode,
  dashboards,
  datasets,
  activeDashboard,
  widgets,
  presence,
  activities,
  focusedWidgetId,
  error,
  aggregateErrors,
  getAggregate,
  init,
  switchDashboard,
  refreshDatasets,
  createDashboard,
  deleteDashboard,
  createWidget,
  updateWidget,
  moveWidget,
  deleteWidget,
  focusWidget,
} = useDashboard(identity);

const config = ref<ConfigState | null>(null);
const sidebarOpen = ref(false);

const { state: dialogState, onConfirm, onCancel } = useDialog();

function hasAggregateError(widgetId: string): boolean {
  return aggregateErrors.value.has(widgetId);
}

async function previewAggregate(params: WidgetAggregateParams, gaugeType?: boolean) {
  if (gaugeType) {
    const { total } = await api.aggregateTotal(params.datasetId, params.metric, params.aggregation);
    return {
      categories: [],
      series: [{ name: params.metric, values: [total] }],
      metricLabel: params.metric,
      dimensionLabel: '',
      breakdownLabel: null,
      total,
    };
  }
  return api.aggregate(params);
}

async function boot(): Promise<void> {
  try {
    await init();
  } catch {
    // 错误信息已写入 error，可在界面上重试
  }
}

onMounted(boot);

async function handleJoin(payload: { name: string; color: string }): Promise<void> {
  saveIdentity(payload.name, payload.color);
  await boot();
}

async function handleCreateDashboard(name: string): Promise<void> {
  try {
    await createDashboard(name);
  } catch (err) {
    error.value = `新建看板失败：${(err as Error).message}`;
  }
}

async function handleDeleteDashboard(id: string): Promise<void> {
  try {
    await deleteDashboard(id);
  } catch (err) {
    error.value = `删除看板失败：${(err as Error).message}`;
  }
}

function openDraft(chartType: ChartType, layout: { x: number; y: number; w: number; h: number }): void {
  config.value = { mode: 'create', widget: { chartType, ...layout } };
}

function addChartType(chartType: ChartType): void {
  const maxY = widgets.value.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
  openDraft(chartType, { x: 0, y: maxY, w: 6, h: 4 });
  sidebarOpen.value = false;
}

function openEdit(widget: DashboardWidget): void {
  focusWidget(widget.id);
  config.value = { mode: 'edit', widget: { ...widget } };
}

function handleCanvasDraft(payload: { chartType: ChartType; layout: { x: number; y: number; w: number; h: number } }): void {
  openDraft(payload.chartType, payload.layout);
}

function handleSave(draft: WidgetDraft): void {
  if (config.value?.mode === 'edit') updateWidget(draft);
  else createWidget(draft);
  config.value = null;
}

function retry(): void {
  void boot();
}
</script>

<template>
  <JoinDialog v-if="!hasIdentity" @join="handleJoin" />

  <div v-else class="flex h-screen flex-col overflow-hidden bg-app">
    <AppHeader
      :dashboard-name="activeDashboard?.name ?? '实时协作数据看板'"
      :connected="connected"
      :presence="presence"
      :self="identity"
      :store-mode="storeMode"
      :theme="theme"
      @toggle-theme="toggleTheme"
    />

    <div class="relative flex min-h-0 flex-1">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-20 bg-overlay backdrop-blur-sm lg:hidden"
        @pointerdown="sidebarOpen = false"
      ></div>

      <div
        class="fixed inset-y-0 left-0 z-30 h-full transition-transform duration-200 lg:static lg:z-auto"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      >
        <SidebarPanel
          :dashboards="dashboards"
          :active-id="activeDashboard?.id ?? ''"
          :datasets="datasets"
          :activities="activities"
          :connected="connected"
          @switch-dashboard="switchDashboard"
          @create-dashboard="handleCreateDashboard"
          @delete-dashboard="handleDeleteDashboard"
          @add-chart="addChartType"
          @datasets-change="datasets = $event"
        />
      </div>

      <main class="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <button type="button" class="btn-ghost mb-3 lg:hidden" @click="sidebarOpen = true">
          看板与图表组件
        </button>

        <div
          v-if="error"
          class="mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200"
        >
          <span class="truncate">{{ error }}</span>
          <button type="button" class="shrink-0 underline decoration-rose-300/60" @click="retry">重试</button>
        </div>

        <DashboardCanvas
          :widgets="widgets"
          :datasets="datasets"
          :presence="presence"
          :self-id="identity.id"
          :focused-widget-id="focusedWidgetId"
          :connected="connected"
          :theme="theme"
          :get-aggregate="getAggregate"
          :has-aggregate-error="hasAggregateError"
          @select-widget="focusWidget"
          @edit-widget="openEdit"
          @delete-widget="deleteWidget"
          @move="(payload) => moveWidget(payload.id, payload.layout)"
          @draft="handleCanvasDraft"
          @focus="focusWidget"
        />
      </main>
    </div>

    <WidgetConfigModal
      :state="config"
      :datasets="datasets"
      :theme="theme"
      :preview-aggregate="previewAggregate"
      @save="handleSave"
      @close="config = null"
    />

    <!-- 全局确认弹窗 -->
    <ConfirmDialog
      v-model:open="dialogState.open"
      :options="dialogState.options"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>
