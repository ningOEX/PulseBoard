import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { Store } from './store';
import type {
  Activity,
  Aggregation,
  ChartType,
  DashboardRecord,
  DashboardWidget,
  PresenceEntry,
  UserInfo,
  WidgetLayout,
} from './types';

const CHART_TYPES: ChartType[] = ['line', 'bar', 'pie', 'scatter', 'radar', 'gauge'];
const AGGREGATIONS: Aggregation[] = ['sum', 'avg', 'count'];

interface SocketData {
  dashboardId?: string;
  user?: UserInfo;
}

interface RoomPresence extends PresenceEntry {
  socketId: string;
}

type Ack = (response: unknown) => void;

const roomOf = (dashboardId: string): string => `dashboard:${dashboardId}`;
const now = (): string => new Date().toISOString();

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

function normalizeUser(input: Partial<UserInfo> | undefined, socketId: string): UserInfo {
  const name = String(input?.name ?? '').trim().slice(0, 16);
  return {
    id: String(input?.id ?? socketId).slice(0, 64),
    name: name || `访客${socketId.slice(0, 4)}`,
    color: /^#[0-9a-fA-F]{6}$/.test(String(input?.color)) ? String(input?.color) : '#8b5cf6',
  };
}

function normalizeWidget(input: Partial<DashboardWidget>): Omit<DashboardWidget, 'id' | 'updatedBy' | 'updatedAt'> {
  return {
    title: String(input.title || '未命名图表').trim().slice(0, 40),
    chartType: CHART_TYPES.includes(input.chartType as ChartType) ? (input.chartType as ChartType) : 'bar',
    datasetId: String(input.datasetId || 'sales'),
    dimension: String(input.dimension || 'month'),
    breakdown: String(input.breakdown || ''),
    metric: String(input.metric || 'revenue'),
    aggregation: AGGREGATIONS.includes(input.aggregation as Aggregation)
      ? (input.aggregation as Aggregation)
      : 'sum',
    x: clampNumber(input.x, 0, 11, 0),
    y: clampNumber(input.y, 0, 400, 0),
    w: clampNumber(input.w, 2, 12, 6),
    h: clampNumber(input.h, 2, 14, 4),
  };
}

function normalizeLayout(input: Partial<WidgetLayout>): WidgetLayout {
  const w = clampNumber(input.w, 2, 12, 6);
  const x = clampNumber(input.x, 0, 12 - w, 0);
  return {
    x,
    y: clampNumber(input.y, 0, 400, 0),
    w,
    h: clampNumber(input.h, 2, 14, 4),
  };
}

export function setupRealtime(io: Server, store: Store): void {
  const presenceRooms = new Map<string, Map<string, RoomPresence>>();
  const activityRooms = new Map<string, Activity[]>();
  const dashboardCache = new Map<string, DashboardRecord>();

  async function loadDashboard(id: string): Promise<DashboardRecord | null> {
    const cached = dashboardCache.get(id);
    if (cached) return cached;
    const dashboard = await store.getDashboard(id);
    if (dashboard) dashboardCache.set(id, dashboard);
    return dashboard;
  }

  async function persist(dashboard: DashboardRecord): Promise<void> {
    dashboard.updatedAt = now();
    await store.saveDashboard(dashboard);
    dashboardCache.set(dashboard.id, dashboard);
  }

  function presenceList(dashboardId: string): PresenceEntry[] {
    return [...(presenceRooms.get(dashboardId)?.values() ?? [])].map(({ socketId, ...entry }) => entry);
  }

  function broadcastPresence(dashboardId: string): void {
    io.to(roomOf(dashboardId)).emit('presence:update', presenceList(dashboardId));
  }

  function pushActivity(dashboardId: string, user: UserInfo, action: string, detail: string): void {
    const list = activityRooms.get(dashboardId) ?? [];
    const activity: Activity = { id: randomUUID(), user, action, detail, at: now() };
    list.unshift(activity);
    activityRooms.set(dashboardId, list.slice(0, 30));
    io.to(roomOf(dashboardId)).emit('activity', activity);
  }

  function touchWidget(widget: DashboardWidget, user: UserInfo): void {
    widget.updatedBy = user.name;
    widget.updatedAt = now();
  }

  function findWidget(dashboard: DashboardRecord, widgetId: string): DashboardWidget | undefined {
    return dashboard.widgets.find((item) => item.id === widgetId);
  }

  function requireContext(socket: Socket): { dashboardId: string; user: UserInfo } | null {
    const data = socket.data as SocketData;
    if (!data.dashboardId || !data.user) return null;
    return { dashboardId: data.dashboardId, user: data.user };
  }

  async function leaveCurrentRoom(socket: Socket): Promise<void> {
    const data = socket.data as SocketData;
    if (!data.dashboardId || !data.user) return;
    const { dashboardId, user } = data;
    const room = presenceRooms.get(dashboardId);
    room?.delete(socket.id);
    if (room && room.size === 0) presenceRooms.delete(dashboardId);
    socket.leave(roomOf(dashboardId));
    broadcastPresence(dashboardId);
    pushActivity(dashboardId, user, '离开了看板', '');
    data.dashboardId = undefined;
    data.user = undefined;
  }

  io.on('connection', (socket: Socket) => {
    socket.on(
      'dashboard:join',
      async (payload: { dashboardId?: string; user?: Partial<UserInfo> } | undefined, ack?: Ack) => {
        const dashboardId = String(payload?.dashboardId ?? '');
        const dashboard = await loadDashboard(dashboardId);
        if (!dashboard) {
          ack?.({ ok: false, error: '看板不存在' });
          return;
        }

        await leaveCurrentRoom(socket);
        const user = normalizeUser(payload?.user, socket.id);
        const data = socket.data as SocketData;
        data.dashboardId = dashboardId;
        data.user = user;
        socket.join(roomOf(dashboardId));

        const room = presenceRooms.get(dashboardId) ?? new Map<string, RoomPresence>();
        room.set(socket.id, { socketId: socket.id, user, editingWidgetId: null, joinedAt: now() });
        presenceRooms.set(dashboardId, room);

        ack?.({
          ok: true,
          dashboard,
          presence: presenceList(dashboardId),
          activities: activityRooms.get(dashboardId) ?? [],
        });
        broadcastPresence(dashboardId);
        pushActivity(dashboardId, user, '加入了看板', '');
      },
    );

    socket.on('widget:create', async (payload: Partial<DashboardWidget> | undefined, ack?: Ack) => {
      const context = requireContext(socket);
      if (!context) return;
      const dashboard = await loadDashboard(context.dashboardId);
      if (!dashboard) return;

      const widget: DashboardWidget = {
        id: randomUUID(),
        ...normalizeWidget(payload ?? {}),
        updatedBy: context.user.name,
        updatedAt: now(),
      };
      dashboard.widgets.push(widget);
      dashboard.version += 1;
      await persist(dashboard);

      io.to(roomOf(dashboard.id)).emit('widget:created', widget);
      pushActivity(dashboard.id, context.user, '新增了图表', widget.title);
      ack?.({ ok: true, widget });
    });

    socket.on(
      'widget:update',
      async (
        payload: { widgetId?: string; patch?: Partial<DashboardWidget> } | undefined,
        ack?: Ack,
      ) => {
        const context = requireContext(socket);
        if (!context) return;
        const dashboard = await loadDashboard(context.dashboardId);
        const widget = dashboard && payload?.widgetId ? findWidget(dashboard, payload.widgetId) : undefined;
        if (!dashboard || !widget) {
          ack?.({ ok: false, error: '图表不存在' });
          return;
        }

        const patch = payload?.patch ?? {};
        const next = normalizeWidget({ ...widget, ...patch });
        Object.assign(widget, next);
        touchWidget(widget, context.user);
        dashboard.version += 1;
        await persist(dashboard);

        io.to(roomOf(dashboard.id)).emit('widget:updated', widget);
        pushActivity(dashboard.id, context.user, '更新了图表', widget.title);
        ack?.({ ok: true, widget });
      },
    );

    socket.on(
      'widget:move',
      async (payload: { widgetId?: string; layout?: Partial<WidgetLayout> } | undefined, ack?: Ack) => {
        const context = requireContext(socket);
        if (!context) return;
        const dashboard = await loadDashboard(context.dashboardId);
        const widget = dashboard && payload?.widgetId ? findWidget(dashboard, payload.widgetId) : undefined;
        if (!dashboard || !widget) return;

        Object.assign(widget, normalizeLayout(payload?.layout ?? {}));
        touchWidget(widget, context.user);
        dashboard.version += 1;
        await persist(dashboard);

        io.to(roomOf(dashboard.id)).emit('widget:moved', {
          id: widget.id,
          layout: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
          by: context.user.name,
        });
      },
    );

    socket.on('widget:delete', async (payload: { widgetId?: string } | undefined, ack?: Ack) => {
      const context = requireContext(socket);
      if (!context) return;
      const dashboard = await loadDashboard(context.dashboardId);
      const widget = dashboard && payload?.widgetId ? findWidget(dashboard, payload.widgetId) : undefined;
      if (!dashboard || !widget) return;

      dashboard.widgets = dashboard.widgets.filter((item) => item.id !== widget.id);
      dashboard.version += 1;
      await persist(dashboard);

      io.to(roomOf(dashboard.id)).emit('widget:deleted', { id: widget.id, by: context.user.name });
      pushActivity(dashboard.id, context.user, '删除了图表', widget.title);
      ack?.({ ok: true });
    });

    socket.on('widget:focus', (payload: { widgetId?: string | null } | undefined) => {
      const context = requireContext(socket);
      if (!context) return;
      const room = presenceRooms.get(context.dashboardId);
      const entry = room?.get(socket.id);
      if (!entry) return;
      entry.editingWidgetId = payload?.widgetId ? String(payload.widgetId) : null;
      broadcastPresence(context.dashboardId);
    });

    socket.on('user:update', (payload: Partial<UserInfo> | undefined) => {
      const context = requireContext(socket);
      if (!context) return;
      const room = presenceRooms.get(context.dashboardId);
      const entry = room?.get(socket.id);
      if (!entry) return;
      entry.user = normalizeUser({ ...entry.user, ...payload }, entry.user.id);
      const data = socket.data as SocketData;
      data.user = entry.user;
      broadcastPresence(context.dashboardId);
    });

    socket.on('dashboard:leave', async () => {
      await leaveCurrentRoom(socket);
    });

    socket.on('disconnect', async () => {
      await leaveCurrentRoom(socket);
    });
  });
}
