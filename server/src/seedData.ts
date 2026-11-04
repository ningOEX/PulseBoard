import type { DashboardRecord, Dataset, DashboardWidget } from './types';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** 固定种子的伪随机数，保证每次启动数据一致 */
function createRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const REGION_BASE: Record<string, number> = { 华东: 1.35, 华南: 1.12, 华北: 1, 西南: 0.78 };
const CHANNEL_BASE: Record<string, number> = { 直营: 1.18, 线上: 1.42, 伙伴: 0.86 };

function buildSalesRows(): Record<string, string | number>[] {
  const regions = Object.keys(REGION_BASE);
  const channels = Object.keys(CHANNEL_BASE);
  const products = ['旗舰版', '标准版'];
  const rows: Record<string, string | number>[] = [];
  let seed = 7;

  MONTHS.forEach((month, monthIndex) => {
    const season = 1 + Math.sin((monthIndex / 12) * Math.PI * 2) * 0.14 + (monthIndex === 11 ? 0.22 : 0);
    for (const region of regions) {
      for (const channel of channels) {
        for (const product of products) {
          const random = createRandom((seed += 1) * 31 + 17);
          const scale = REGION_BASE[region] * CHANNEL_BASE[channel] * (product === '旗舰版' ? 1.45 : 1) * season;
          const revenue = Math.round((9000 + random() * 12000) * scale);
          const orders = Math.round((60 + random() * 90) * scale);
          const users = Math.round(orders * (1.4 + random() * 0.9));
          const conversion = round(1.6 + random() * 3.4, 2);
          rows.push({ month, region, channel, product, revenue, orders, users, conversion });
        }
      }
    }
  });

  return rows;
}

function buildTrafficRows(): Record<string, string | number>[] {
  const sources = ['自然搜索', '社交媒体', '直接访问', '推荐链接'];
  const devices = ['移动端', 'PC'];
  const sourceBase: Record<string, number> = { 自然搜索: 1.4, 社交媒体: 1.15, 直接访问: 0.9, 推荐链接: 0.7 };
  const rows: Record<string, string | number>[] = [];
  let seed = 101;

  MONTHS.forEach((month, monthIndex) => {
    const season = 1 + Math.cos((monthIndex / 12) * Math.PI * 2) * 0.1 + monthIndex * 0.015;
    for (const source of sources) {
      for (const device of devices) {
        const random = createRandom((seed += 1) * 47 + 5);
        const visits = Math.round((20000 + random() * 26000) * season * sourceBase[source]);
        const leads = Math.round(visits * (0.028 + random() * 0.045));
        const bounceRate = round(28 + random() * 24, 1);
        rows.push({ month, source, device, visits, leads, bounceRate });
      }
    }
  });

  return rows;
}

export function createSeedDatasets(): Dataset[] {
  return [
    {
      id: 'sales',
      name: '销售业绩',
      description: '按月份 / 区域 / 渠道 / 产品的销售多维明细',
      fields: [
        { key: 'month', label: '月份', type: 'dimension' },
        { key: 'region', label: '区域', type: 'dimension' },
        { key: 'channel', label: '渠道', type: 'dimension' },
        { key: 'product', label: '产品', type: 'dimension' },
        { key: 'revenue', label: '营收(元)', type: 'measure' },
        { key: 'orders', label: '订单数', type: 'measure' },
        { key: 'users', label: '活跃用户', type: 'measure' },
        { key: 'conversion', label: '转化率(%)', type: 'measure' },
      ],
      rows: buildSalesRows(),
    },
    {
      id: 'traffic',
      name: '流量增长',
      description: '按月份 / 来源 / 设备的站点流量与线索数据',
      fields: [
        { key: 'month', label: '月份', type: 'dimension' },
        { key: 'source', label: '来源', type: 'dimension' },
        { key: 'device', label: '设备', type: 'dimension' },
        { key: 'visits', label: '访问量', type: 'measure' },
        { key: 'leads', label: '线索数', type: 'measure' },
        { key: 'bounceRate', label: '跳出率(%)', type: 'measure' },
      ],
      rows: buildTrafficRows(),
    },
  ];
}

function createWidget(
  id: string,
  title: string,
  chartType: DashboardWidget['chartType'],
  datasetId: string,
  dimension: string,
  breakdown: string,
  metric: string,
  aggregation: DashboardWidget['aggregation'],
  x: number,
  y: number,
  w: number,
  h: number,
): DashboardWidget {
  return {
    id,
    title,
    chartType,
    datasetId,
    dimension,
    breakdown,
    metric,
    aggregation,
    x,
    y,
    w,
    h,
    updatedBy: '系统初始化',
    updatedAt: new Date().toISOString(),
  };
}

export const SEED_DASHBOARD_ID = 'team-sales';

export function createSeedDashboard(): DashboardRecord {
  return {
    id: SEED_DASHBOARD_ID,
    name: '团队销售实时看板',
    version: 1,
    updatedAt: new Date().toISOString(),
    widgets: [
      createWidget('w-revenue', '营收趋势', 'line', 'sales', 'month', 'region', 'revenue', 'sum', 0, 0, 8, 4),
      createWidget('w-gauge', '年度营收目标', 'gauge', 'sales', 'month', '', 'revenue', 'sum', 8, 0, 4, 4),
      createWidget('w-region', '区域营收占比', 'pie', 'sales', 'month', 'region', 'revenue', 'sum', 0, 4, 4, 4),
      createWidget('w-channel', '渠道订单对比', 'bar', 'sales', 'channel', 'region', 'orders', 'sum', 4, 4, 8, 4),
      createWidget('w-conv', '区域转化雷达', 'radar', 'sales', 'region', 'channel', 'conversion', 'avg', 0, 8, 6, 4),
      createWidget('w-traffic', '流量来源分布', 'pie', 'traffic', 'source', 'device', 'visits', 'sum', 6, 8, 6, 4),
    ],
  };
}
