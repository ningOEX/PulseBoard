export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'radar' | 'gauge';
export type Aggregation = 'sum' | 'avg' | 'count';

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

export interface DashboardRecord {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  version: number;
  updatedAt: string;
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
