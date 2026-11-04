export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'radar' | 'gauge';
export type Aggregation = 'sum' | 'avg' | 'count';
export type StoreMode = 'mongo' | 'memory';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidget extends WidgetLayout {
  id: string;
  title: string;
  chartType: ChartType;
  datasetId: string;
  dimension: string;
  breakdown: string;
  metric: string;
  aggregation: Aggregation;
  updatedBy?: string;
  updatedAt?: string;
}

export interface DashboardSummary {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  widgetCount: number;
  isProtected?: boolean;
}

export interface DatasetField {
  key: string;
  label: string;
  type: 'dimension' | 'measure';
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  fields: DatasetField[];
  rows: Record<string, string | number>[];
}

export interface UserInfo {
  id: string;
  name: string;
  color: string;
}

export interface PresenceEntry {
  user: UserInfo;
  editingWidgetId: string | null;
  joinedAt: string;
}

export interface Activity {
  id: string;
  user: UserInfo;
  action: string;
  detail: string;
  at: string;
}

export interface WidgetDraft extends WidgetLayout {
  id?: string;
  title: string;
  chartType: ChartType;
  datasetId: string;
  dimension: string;
  breakdown: string;
  metric: string;
  aggregation: Aggregation;
}

export interface ConfigState {
  mode: 'create' | 'edit';
  widget: Partial<WidgetDraft> & WidgetLayout;
}

export interface WidgetAggregateParams {
  datasetId: string;
  dimension: string;
  breakdown?: string;
  metric: string;
  aggregation: Aggregation;
  topN?: number;
  filters?: Record<string, string>;
}

export interface AggregateSeries {
  name: string;
  values: number[];
}

export interface AggregateResult {
  categories: string[];
  series: AggregateSeries[];
  metricLabel: string;
  dimensionLabel: string;
  breakdownLabel: string | null;
}

export interface JoinResponse {
  ok: boolean;
  error?: string;
  dashboard?: {
    id: string;
    name: string;
    version: number;
    updatedAt: string;
    widgets: DashboardWidget[];
  };
  presence?: PresenceEntry[];
  activities?: Activity[];
}
