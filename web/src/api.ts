import type {
  AggregateResult,
  DashboardSummary,
  Dataset,
  StoreMode,
  WidgetAggregateParams,
} from '@/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败 (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; mode: StoreMode; datasetCount?: number; dashboardCount?: number }>('/board/api/health'),
  listDashboards: () => request<DashboardSummary[]>('/board/api/dashboards'),
  createDashboard: (name: string) =>
    request<{ id: string; name: string }>('/board/api/dashboards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteDashboard: (id: string) => request<{ ok: true }>(`/api/dashboards/${id}`, { method: 'DELETE' }),

  // 数据集
  listDatasets: () => request<Dataset[]>('/board/api/datasets'),
  getDataset: (id: string) => request<Dataset>(`/api/datasets/${id}`),
  createDataset: (body: Omit<Dataset, 'id'>) =>
    request<Dataset>('/board/api/datasets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDataset: (id: string, body: Partial<Dataset>) =>
    request<Dataset>(`/api/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteDataset: (id: string) => request<void>(`/api/datasets/${id}`, { method: 'DELETE' }),
  appendRows: (id: string, rows: Record<string, string | number>[]) =>
    request<{ rowCount: number; added: number }>(`/api/datasets/${id}/rows`, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
  replaceRows: (id: string, rows: Record<string, string | number>[]) =>
    request<{ rowCount: number }>(`/api/datasets/${id}/rows/replace`, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
  importCsv: (name: string, csv: string) =>
    request<Dataset>('/board/api/datasets/csv', {
      method: 'POST',
      body: JSON.stringify({ name, csv }),
    }),
  importExcel: (name: string, base64: string) =>
    request<Dataset>('/board/api/datasets/excel', {
      method: 'POST',
      body: JSON.stringify({ name, base64 }),
    }),

  // 聚合
  aggregate: (params: WidgetAggregateParams) =>
    request<AggregateResult>(`/api/datasets/${params.datasetId}/aggregate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  aggregateTotal: (datasetId: string, metric: string, aggregation: string) =>
    request<{ total: number }>(`/api/datasets/${datasetId}/aggregate-total`, {
      method: 'POST',
      body: JSON.stringify({ metric, aggregation }),
    }),
  overview: (datasetId: string) =>
    request<Record<string, number>>(`/api/datasets/${datasetId}/overview`, { method: 'POST' }),
};
