import { computed, ref, watch, type Ref } from 'vue';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { api } from '@/api';
import type {
  Activity,
  AggregateResult,
  DashboardSummary,
  DashboardWidget,
  Dataset,
  JoinResponse,
  PresenceEntry,
  StoreMode,
  UserInfo,
  WidgetAggregateParams,
  WidgetDraft,
  WidgetLayout,
} from '@/types';

export function useDashboard(identity: Ref<UserInfo>) {
  const connected = ref(false);
  const storeMode = ref<StoreMode | 'unknown'>('unknown');
  const dashboards = ref<DashboardSummary[]>([]);
  const datasets = ref<Dataset[]>([]);
  const activeId = ref('');
  const widgets = ref<DashboardWidget[]>([]);
  const presence = ref<PresenceEntry[]>([]);
  const activities = ref<Activity[]>([]);
  const focusedWidgetId = ref<string | null>(null);
  const error = ref('');

  // 每个 widget 的聚合结果，key = `${widgetId}:${dimension}:${metric}:${aggregation}:${breakdown}`
  const aggregates = ref<Map<string, AggregateResult>>(new Map());
  const aggregateErrors = ref<Set<string>>(new Set());

  const activeDashboard = computed(
    () => dashboards.value.find((item) => item.id === activeId.value) ?? null,
  );

  let socket: Socket | null = null;
  let booting = false;
  let booted = false;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  function aggregateKey(widget: DashboardWidget): string {
    return `${widget.id}:${widget.datasetId}:${widget.dimension}:${widget.metric}:${widget.aggregation}:${widget.breakdown ?? ''}`;
  }

  async function fetchAggregate(params: WidgetAggregateParams & { gaugeTotal?: boolean }): Promise<AggregateResult> {
    if (params.gaugeTotal) {
      const { total } = await api.aggregateTotal(params.datasetId, params.metric, params.aggregation);
      const dataset = datasets.value.find((d) => d.id === params.datasetId);
      const metricLabel = dataset?.fields.find((f) => f.key === params.metric)?.label ?? params.metric;
      return {
        categories: [],
        series: [{ name: metricLabel, values: [total] }],
        metricLabel,
        dimensionLabel: '',
        breakdownLabel: null,
      };
    }
    return api.aggregate(params);
  }

  /** 给单个 widget 拉取并缓存聚合结果 */
  async function loadWidgetAggregate(widget: DashboardWidget): Promise<void> {
    const key = aggregateKey(widget);
    try {
      let result: AggregateResult;
      if (widget.chartType === 'gauge') {
        result = await fetchAggregate({
          datasetId: widget.datasetId,
          dimension: widget.dimension,
          breakdown: widget.breakdown || undefined,
          metric: widget.metric,
          aggregation: widget.aggregation,
          gaugeTotal: true,
        });
      } else {
        result = await fetchAggregate({
          datasetId: widget.datasetId,
          dimension: widget.dimension,
          breakdown: widget.breakdown || undefined,
          metric: widget.metric,
          aggregation: widget.aggregation,
        });
      }
      aggregates.value.set(key, result);
      aggregateErrors.value.delete(widget.id);
    } catch {
      aggregateErrors.value.add(widget.id);
    }
  }

  /** 批量刷新所有 widget 的聚合结果（防抖 120ms） */
  function reloadAllAggregates(): void {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      // 先清掉旧 widget 的缓存
      const validKeys = new Set(widgets.value.map((w) => aggregateKey(w)));
      for (const key of [...aggregates.value.keys()]) {
        if (!validKeys.has(key)) aggregates.value.delete(key);
      }
      // 拉取当前所有 widget
      for (const widget of widgets.value) {
        void loadWidgetAggregate(widget);
      }
    }, 120);
  }

  function getAggregate(widgetId: string): AggregateResult | null {
    const widget = widgets.value.find((w) => w.id === widgetId);
    if (!widget) return null;
    return aggregates.value.get(aggregateKey(widget)) ?? null;
  }

  // widget 列表或配置变化 → 重新聚合
  watch(
    widgets,
    () => {
      reloadAllAggregates();
    },
    { deep: true },
  );

  // datasets 变化（刷新列表后新数据源）
  watch(datasets, () => {
    reloadAllAggregates();
  });

  function joinActive(): void {
    if (!socket || !activeId.value) return;
    socket.emit(
      'dashboard:join',
      { dashboardId: activeId.value, user: identity.value },
      (response: JoinResponse) => {
        if (!response?.ok || !response.dashboard) {
          error.value = response?.error ?? '加入看板失败';
          return;
        }
        widgets.value = response.dashboard.widgets;
        presence.value = response.presence ?? [];
        activities.value = response.activities ?? [];
        const summary = dashboards.value.find((item) => item.id === response.dashboard?.id);
        if (summary && response.dashboard) {
          summary.name = response.dashboard.name;
          summary.version = response.dashboard.version;
          summary.widgetCount = response.dashboard.widgets.length;
        }
      },
    );
  }

  function bindSocket(): void {
    if (socket) return;
    socket = io({ path: '/board/socket.io' });

    socket.on('connect', () => {
      connected.value = true;
      error.value = '';
      joinActive();
    });
    socket.on('disconnect', () => {
      connected.value = false;
    });
    socket.on('connect_error', () => {
      connected.value = false;
    });

    socket.on('presence:update', (list: PresenceEntry[]) => {
      presence.value = list;
    });
    socket.on('activity', (activity: Activity) => {
      activities.value = [activity, ...activities.value.filter((item) => item.id !== activity.id)].slice(0, 30);
    });
    socket.on('widget:created', (widget: DashboardWidget) => {
      if (!widgets.value.some((item) => item.id === widget.id)) {
        widgets.value = [...widgets.value, widget];
      }
    });
    socket.on('widget:updated', (widget: DashboardWidget) => {
      widgets.value = widgets.value.map((item) => (item.id === widget.id ? widget : item));
    });
    socket.on('widget:moved', (payload: { id: string; layout: WidgetLayout }) => {
      widgets.value = widgets.value.map((item) =>
        item.id === payload.id ? { ...item, ...payload.layout } : item,
      );
    });
    socket.on('widget:deleted', (payload: { id: string }) => {
      widgets.value = widgets.value.filter((item) => item.id !== payload.id);
      if (focusedWidgetId.value === payload.id) focusedWidgetId.value = null;
    });
  }

  async function init(): Promise<void> {
    if (booting || booted) return;
    booting = true;
    try {
      const [health, list, datasetList] = await Promise.all([
        api.health(),
        api.listDashboards(),
        api.listDatasets(),
      ]);
      storeMode.value = health.mode;
      dashboards.value = list;
      datasets.value = datasetList;
      if (!activeId.value) activeId.value = list[0]?.id ?? '';
      bindSocket();
      booted = true;
      error.value = '';
    } catch (err) {
      error.value = `无法连接后端服务：${(err as Error).message}`;
      throw err;
    } finally {
      booting = false;
    }
  }

  async function refreshDatasets(): Promise<void> {
    datasets.value = await api.listDatasets();
  }

  function switchDashboard(id: string): void {
    if (id === activeId.value) return;
    activeId.value = id;
    widgets.value = [];
    presence.value = [];
    activities.value = [];
    focusedWidgetId.value = null;
    aggregates.value.clear();
    joinActive();
  }

  async function createDashboard(name: string): Promise<void> {
    const created = await api.createDashboard(name);
    dashboards.value = await api.listDashboards();
    switchDashboard(created.id);
  }

  async function deleteDashboard(id: string): Promise<void> {
    const currentId = activeDashboard.value?.id;
    await api.deleteDashboard(id);
    dashboards.value = await api.listDashboards();
    if (currentId === id) {
      // 如果删的是当前看板，切到第一个
      const next = dashboards.value[0];
      if (next) switchDashboard(next.id);
    }
  }

  function createWidget(draft: WidgetDraft): void {
    socket?.emit('widget:create', { ...draft, id: undefined }, (response?: { ok: boolean; error?: string }) => {
      if (!response?.ok) error.value = response?.error ?? '创建图表失败';
    });
  }

  function updateWidget(draft: WidgetDraft): void {
    if (!draft.id) return;
    const patch: Partial<DashboardWidget> = {
      title: draft.title,
      chartType: draft.chartType,
      datasetId: draft.datasetId,
      dimension: draft.dimension,
      breakdown: draft.breakdown,
      metric: draft.metric,
      aggregation: draft.aggregation,
      x: draft.x,
      y: draft.y,
      w: draft.w,
      h: draft.h,
    };
    socket?.emit('widget:update', { widgetId: draft.id, patch }, (response?: { ok: boolean; error?: string }) => {
      if (!response?.ok) error.value = response?.error ?? '更新图表失败';
    });
  }

  function moveWidget(id: string, layout: WidgetLayout): void {
    widgets.value = widgets.value.map((item) => (item.id === id ? { ...item, ...layout } : item));
    socket?.emit('widget:move', { widgetId: id, layout });
  }

  function deleteWidget(id: string): void {
    socket?.emit('widget:delete', { widgetId: id });
  }

  function focusWidget(id: string | null): void {
    if (focusedWidgetId.value === id) return;
    focusedWidgetId.value = id;
    socket?.emit('widget:focus', { widgetId: id });
  }

  return {
    connected,
    storeMode,
    dashboards,
    datasets,
    activeId,
    activeDashboard,
    widgets,
    presence,
    activities,
    focusedWidgetId,
    error,
    aggregates,
    aggregateErrors,
    getAggregate,
    loadWidgetAggregate,
    reloadAllAggregates,
    init,
    rejoin: joinActive,
    switchDashboard,
    refreshDatasets,
    createDashboard,
    deleteDashboard,
    createWidget,
    updateWidget,
    moveWidget,
    deleteWidget,
    focusWidget,
  };
}
