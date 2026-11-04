import type { EChartsOption } from 'echarts';
import type { DashboardWidget } from '@/types';
import type { ThemeMode } from '@/composables/useTheme';

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
  total?: number;
}

const PALETTE = ['#8b5cf6', '#22d3ee', '#f59e0b', '#34d399', '#f472b6', '#60a5fa', '#fb923c', '#a3e635'];

interface ThemeColors {
  axis: string;
  split: string;
  legend: string;
  empty: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  gaugeText: string;
  gaugeSub: string;
  pieBorder: string;
}

function themeColors(theme: ThemeMode): ThemeColors {
  if (theme === 'light') {
    return {
      axis: '#64748b',
      split: 'rgba(15, 23, 42, 0.08)',
      legend: '#475569',
      empty: '#94a3b8',
      tooltipBg: 'rgba(255, 255, 255, 0.96)',
      tooltipBorder: 'rgba(15, 23, 42, 0.12)',
      tooltipText: '#0f172a',
      gaugeText: '#0f172a',
      gaugeSub: '#64748b',
      pieBorder: '#ffffff',
    };
  }
  return {
    axis: '#94a3b8',
    split: 'rgba(148, 163, 184, 0.12)',
    legend: '#cbd5e1',
    empty: '#64748b',
    tooltipBg: 'rgba(15, 23, 42, 0.94)',
    tooltipBorder: 'rgba(148, 163, 184, 0.28)',
    tooltipText: '#e2e8f0',
    gaugeText: '#f8fafc',
    gaugeSub: '#94a3b8',
    pieBorder: '#0b1220',
  };
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function emptyOption(theme: ThemeMode): EChartsOption {
  const c = themeColors(theme);
  return {
    backgroundColor: 'transparent',
    title: {
      text: '暂无数据',
      left: 'center',
      top: 'middle',
      textStyle: { color: c.empty, fontSize: 13, fontWeight: 'normal' },
    },
  };
}

function axisTooltip(theme: ThemeMode): Record<string, unknown> {
  const c = themeColors(theme);
  return {
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: c.tooltipText, fontSize: 12 },
    trigger: 'axis',
    axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(139, 92, 246, 0.06)' } },
    valueFormatter: (value: number) => formatNumber(value),
  };
}

function cartesianOption(widget: DashboardWidget, result: AggregateResult, theme: ThemeMode): EChartsOption {
  const isBar = widget.chartType === 'bar';
  const { categories, series } = result;
  const c = themeColors(theme);

  return {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: axisTooltip(theme),
    legend: {
      top: 2,
      right: 4,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 6,
      textStyle: { color: c.legend, fontSize: 11 },
      type: 'scroll',
    },
    grid: { left: 4, right: 12, top: 34, bottom: 2, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.axis, fontSize: 10, formatter: (value: number) => formatNumber(value) },
      splitLine: { lineStyle: { color: c.split } },
    },
    series: series.map((group) => ({
      name: group.name,
      type: isBar ? 'bar' : 'line',
      smooth: !isBar,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: !isBar,
      barMaxWidth: 26,
      itemStyle: { borderRadius: isBar ? [4, 4, 0, 0] : 0 },
      lineStyle: { width: 2.4 },
      areaStyle: isBar
        ? undefined
        : {
            opacity: 0.18,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139, 92, 246, 0.35)' },
                { offset: 1, color: 'rgba(34, 211, 238, 0.02)' },
              ],
            },
          },
      data: group.values,
    })),
  } as EChartsOption;
}

function pieOption(_widget: DashboardWidget, result: AggregateResult, theme: ThemeMode): EChartsOption {
  const { categories, series, breakdownLabel } = result;
  const c = themeColors(theme);

  // 饼图如果有 breakdown，每个 breakdown 值跨 categories 求和 → 一个切片一个 breakdown
  // 否则用 categories 作为切片，值来自第一个 series
  let data: { name: string; value: number }[];
  let slicesLabel: string;
  if (breakdownLabel && series.length > 1) {
    data = series.map((group) => ({
      name: group.name,
      value: group.values.reduce((a, b) => a + b, 0),
    }));
    slicesLabel = breakdownLabel;
  } else {
    const mainSeries = series[0] ?? { name: result.metricLabel, values: [] };
    data = categories.map((name, index) => ({ name, value: mainSeries.values[index] ?? 0 }));
    slicesLabel = result.dimensionLabel;
  }

  return {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12] as [number, number],
      textStyle: { color: c.tooltipText, fontSize: 12 },
      trigger: 'item',
      valueFormatter: (value: number) => formatNumber(value),
      formatter: (params: { name: string; value: number; percent?: number }) =>
        `${slicesLabel} · ${params.name}<br/>${result.metricLabel}: ${formatNumber(params.value)}${params.percent ? ` (${params.percent.toFixed(1)}%)` : ''}`,
    },
    legend: {
      orient: 'vertical',
      right: 6,
      top: 'middle',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: c.legend, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['38%', '54%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: c.pieBorder, borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold', color: c.gaugeText, formatter: (p: { name: string; percent?: number }) => `${p.name}\n${p.percent ? p.percent.toFixed(1) + '%' : ''}` },
          scaleSize: 6,
        },
        data,
      },
    ],
  } as EChartsOption;
}

function radarOption(_widget: DashboardWidget, result: AggregateResult, theme: ThemeMode): EChartsOption {
  const { categories, series } = result;
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const c = themeColors(theme);

  return {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12] as [number, number],
      textStyle: { color: c.tooltipText, fontSize: 12 },
      trigger: 'item',
    },
    legend: {
      top: 2,
      right: 4,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 6,
      textStyle: { color: c.legend, fontSize: 11 },
    },
    radar: {
      indicator: categories.map((name) => ({ name, max: Math.round(maxValue * 1.15) })),
      radius: '60%',
      center: ['50%', '56%'],
      axisName: { color: c.legend, fontSize: 10 },
      axisLine: { lineStyle: { color: c.split } },
      splitLine: { lineStyle: { color: c.split } },
      splitArea: { areaStyle: { color: ['rgba(148, 163, 184, 0.05)', 'rgba(148, 163, 184, 0.09)'] } },
    },
    series: [
      {
        type: 'radar',
        symbolSize: 4,
        data: series.map((group) => ({
          name: group.name,
          value: group.values,
          areaStyle: { opacity: 0.18 },
          lineStyle: { width: 2 },
        })),
      },
    ],
  } as EChartsOption;
}

function gaugeOption(_widget: DashboardWidget, result: AggregateResult, theme: ThemeMode): EChartsOption {
  const total = result.total ?? result.series[0]?.values.reduce((a, b) => a + b, 0) ?? 0;
  const max = Math.max(Math.round(total * 1.3), 1);
  const c = themeColors(theme);

  return {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max,
        radius: '88%',
        center: ['50%', '58%'],
        progress: {
          show: true,
          width: 12,
          roundCap: true,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#8b5cf6' },
                { offset: 1, color: '#22d3ee' },
              ],
            },
          },
        },
        axisLine: { lineStyle: { width: 12, color: [[1, 'rgba(148, 163, 184, 0.18)']] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '8%'],
          fontSize: 26,
          fontWeight: 'bolder',
          color: c.gaugeText,
          formatter: (value: number) => formatNumber(value),
        },
        title: {
          offsetCenter: [0, '38%'],
          color: c.gaugeSub,
          fontSize: 11,
        },
        data: [{ value: total, name: result.metricLabel }],
      },
    ],
  } as EChartsOption;
}

function scatterOption(widget: DashboardWidget, result: AggregateResult, theme: ThemeMode): EChartsOption {
  const { categories, series } = result;
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const c = themeColors(theme);

  return {
    backgroundColor: 'transparent',
    color: PALETTE,
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12] as [number, number],
      textStyle: { color: c.tooltipText, fontSize: 12 },
      trigger: 'item',
      valueFormatter: (value: number) => formatNumber(value),
    },
    legend: {
      top: 2,
      right: 4,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: c.legend, fontSize: 11 },
    },
    grid: { left: 4, right: 12, top: 34, bottom: 2, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      max: Math.round(maxValue * 1.25),
      axisLabel: { color: c.axis, fontSize: 10, formatter: (value: number) => formatNumber(value) },
      splitLine: { lineStyle: { color: c.split } },
    },
    series: series.map((group) => ({
      name: group.name,
      type: 'scatter',
      data: categories.map((cat, index) => [cat, group.values[index]]),
      symbolSize: (value: unknown[]) => {
        const number = Array.isArray(value) ? Number(value[1]) || 0 : 0;
        return Math.min(34, 10 + Math.sqrt(Math.abs(number)) / 6);
      },
      itemStyle: { opacity: 0.9 },
    })),
  } as EChartsOption;
}

export function buildChartOption(
  widget: DashboardWidget,
  result?: AggregateResult | null,
  theme: ThemeMode = 'dark',
): EChartsOption {
  if (!result) return emptyOption(theme);
  // 仪表盘是单值，不需要 categories；其他图表必须有 categories
  if (widget.chartType !== 'gauge' && !result.categories.length) return emptyOption(theme);
  if (widget.chartType === 'gauge' && !(result.series[0]?.values?.length)) return emptyOption(theme);
  if (widget.chartType === 'pie') return pieOption(widget, result, theme);
  if (widget.chartType === 'radar') return radarOption(widget, result, theme);
  if (widget.chartType === 'gauge') return gaugeOption(widget, result, theme);
  if (widget.chartType === 'scatter') return scatterOption(widget, result, theme);
  return cartesianOption(widget, result, theme);
}
