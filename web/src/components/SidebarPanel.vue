<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Activity, ChartType, DashboardSummary, Dataset, DatasetField } from '@/types';
import { api } from '@/api';
import ChartTypeIcon from './ChartTypeIcon.vue';
import { useDialog } from '@/composables/useDialog';

const { confirm, prompt, dangerConfirm } = useDialog();

const props = defineProps<{
  dashboards: DashboardSummary[];
  activeId: string;
  datasets: Dataset[];
  activities: Activity[];
  connected: boolean;
}>();

const emit = defineEmits<{
  (e: 'switch-dashboard', id: string): void;
  (e: 'create-dashboard', name: string): void;
  (e: 'delete-dashboard', id: string): void;
  (e: 'add-chart', type: ChartType): void;
  (e: 'datasets-change', datasets: Dataset[]): void;
}>();

async function handleDeleteDashboard(id: string, name: string): Promise<void> {
  const item = props.dashboards.find((d) => d.id === id);
  if (item?.isProtected) {
    await confirm('种子看板受保护', '「' + name + '」是种子看板，为保证演示数据完整不允许删除。', {
      confirmLabel: '我知道了',
      cancelLabel: '关闭',
    });
    return;
  }
  // 第一次确认
  const first = await dangerConfirm('确认删除看板「' + name + '」？', '该看板上的所有图表配置将丢失，且无法恢复。');
  if (!first) return;
  // 第二次强确认（输入看板名称）
  const typed = await prompt(
    '再次确认删除',
    '请输入看板名称「' + name + '」以确认操作。',
    { promptPlaceholder: '输入看板名称', confirmLabel: '确认删除', cancelLabel: '取消', danger: true },
  );
  if (typed !== name) {
    await confirm('已取消删除', typed === null ? '已主动取消。' : '输入的名称不匹配，删除已取消。');
    return;
  }
  emit('delete-dashboard', id);
}

type PanelTab = 'canvas' | 'data';
const tab = ref<PanelTab>('canvas');

const chartTypes: { type: ChartType; label: string; hint: string }[] = [
  { type: 'line', label: '趋势折线', hint: '时间趋势' },
  { type: 'bar', label: '对比柱状', hint: '分类对比' },
  { type: 'pie', label: '占比饼图', hint: '构成占比' },
  { type: 'scatter', label: '散点气泡', hint: '分布密度' },
  { type: 'radar', label: '多维雷达', hint: '多维对比' },
  { type: 'gauge', label: '指标仪表', hint: '目标进度' },
];

const creating = ref(false);
const newName = ref('');

// 数据集管理
const importMode = ref<'csv' | 'excel'>('csv');
const csvName = ref('');
const csvContent = ref('');
const excelName = ref('');
const excelFileName = ref('');
const excelBase64 = ref('');
const excelInput = ref<HTMLInputElement | null>(null);
const importing = ref(false);
const editingRows = ref(false);
const editingDatasetId = ref('');
const editingCsv = ref('');
const dataAction = ref('');

async function refreshDatasets(): Promise<void> {
  emit('datasets-change', await api.listDatasets());
}

async function importCsv(): Promise<void> {
  const name = csvName.value.trim();
  const csv = csvContent.value.trim();
  if (!name || !csv) {
    dataAction.value = '名称和 CSV 内容都不能为空';
    return;
  }
  try {
    await api.importCsv(name.slice(0, 40), csv);
    csvName.value = '';
    csvContent.value = '';
    dataAction.value = '';
    await refreshDatasets();
  } catch (err) {
    dataAction.value = `导入失败：${(err as Error).message}`;
  }
}

function onExcelFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    excelFileName.value = '';
    excelBase64.value = '';
    return;
  }
  excelFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    excelBase64.value = result.split(',')[1] ?? '';
  };
  reader.onerror = () => {
    dataAction.value = '读取文件失败，请重试';
  };
  reader.readAsDataURL(file);
}

async function importExcel(): Promise<void> {
  const name = excelName.value.trim() || excelFileName.value.replace(/\.[^.]+$/, '');
  if (!excelBase64.value) {
    dataAction.value = '请先选择 Excel 文件';
    return;
  }
  try {
    importing.value = true;
    dataAction.value = '';
    await api.importExcel(name.slice(0, 40), excelBase64.value);
    excelName.value = '';
    excelFileName.value = '';
    excelBase64.value = '';
    if (excelInput.value) excelInput.value.value = '';
    await refreshDatasets();
  } catch (err) {
    dataAction.value = `导入失败：${(err as Error).message}`;
  } finally {
    importing.value = false;
  }
}

async function deleteDataset(id: string): Promise<void> {
  if (!confirm('确认删除这个数据集？')) return;
  await api.deleteDataset(id);
  await refreshDatasets();
}

function openEditRows(dataset: Dataset): void {
  editingDatasetId.value = dataset.id;
  editingCsv.value = rowsToCsv(dataset.rows, dataset.fields);
}

function closeEditRows(): void {
  editingDatasetId.value = '';
  editingCsv.value = '';
}

function rowsToCsv(rows: Record<string, string | number>[], fields: DatasetField[]): string {
  const headers = fields.map((f) => f.label || f.key);
  const keys = fields.map((f) => f.key);
  const head = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
  const body = rows
    .map((row) =>
      keys
        .map((key) => {
          const value = String(row[key] ?? '');
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\n');
  return `${head}\n${body}`;
}

async function saveEditedRows(): Promise<void> {
  if (!editingDatasetId.value) return;
  const dataset = props.datasets.find((d) => d.id === editingDatasetId.value);
  if (!dataset) return;
  const parsed = await parseCsv(editingCsv.value, dataset.fields);
  await api.replaceRows(dataset.id, parsed);
  closeEditRows();
  await refreshDatasets();
}

async function parseCsv(text: string, fields: DatasetField[]): Promise<Record<string, string | number>[]> {
  // 用逗号 split + 双引号转义的简单解析器，覆盖绝大部分场景
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  const keys = headers.map((header) => {
    const hit = fields.find((f) => f.label === header || f.key === header);
    return hit?.key ?? header;
  });
  const rows: Record<string, string | number>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string | number> = {};
    keys.forEach((key, index) => {
      const field = fields.find((f) => f.key === key);
      const raw = values[index] ?? '';
      row[key] = field?.type === 'measure' && raw !== '' && raw !== null ? Number(raw) : raw;
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      out.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

function onDragStart(event: DragEvent, type: ChartType): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData('text/plain', `chart:${type}`);
  event.dataTransfer.effectAllowed = 'copy';
}

function submitCreate(): void {
  const name = newName.value.trim();
  if (!name) return;
  emit('create-dashboard', name.slice(0, 30));
  creating.value = false;
  newName.value = '';
}

function timeText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

const totalFields = computed(() =>
  props.datasets.reduce((sum, dataset) => sum + dataset.fields.length, 0),
);
</script>

<template>
  <aside class="flex w-72 shrink-0 flex-col overflow-hidden border-r border-soft bg-sidebar">
    <!-- 面板 Tab 切换 -->
    <div class="flex border-b border-soft p-2">
      <button
        type="button"
        class="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition"
        :class="tab === 'canvas' ? 'bg-card-2 text-app' : 'text-soft hover:text-app'"
        @click="tab = 'canvas'"
      >
        看板 & 图表
      </button>
      <button
        type="button"
        class="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition"
        :class="tab === 'data' ? 'bg-card-2 text-app' : 'text-soft hover:text-app'"
        @click="tab = 'data'"
      >
        数据集管理
      </button>
    </div>

    <!-- ===== 画布面板 ===== -->
    <div v-if="tab === 'canvas'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <section class="shrink-0 border-b border-soft p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[11px] font-semibold uppercase tracking-widest text-subtle">数据看板</h2>
          <button
            type="button"
            class="text-[11px] text-violet-300 transition hover:text-violet-200"
            @click="creating = !creating"
          >
            {{ creating ? '取消' : '+ 新建' }}
          </button>
        </div>

        <div v-if="creating" class="mb-2 flex gap-2">
          <input
            v-model="newName"
            class="field py-1.5 text-[12px]"
            placeholder="看板名称"
            maxlength="30"
            @keydown.enter="submitCreate"
          />
          <button type="button" class="btn-primary shrink-0 px-3 py-1.5" @click="submitCreate">建</button>
        </div>

        <ul class="max-h-[7.5rem] space-y-1 overflow-y-auto pr-0.5">
          <li v-for="item in props.dashboards" :key="item.id" class="group relative">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition"
              :class="item.id === props.activeId ? 'bg-violet-500/15 text-violet-200' : 'text-soft hover:bg-card-2 hover:text-app'"
              @click="emit('switch-dashboard', item.id)"
            >
              <span class="flex min-w-0 flex-1 items-center gap-1.5">
                <span v-if="item.isProtected" class="shrink-0 text-[10px] text-amber-400/70" title="种子看板 · 受保护">🔒</span>
                <span class="truncate">{{ item.name }}</span>
              </span>
              <div class="flex shrink-0 items-center gap-1">
                <span class="rounded-full bg-card-2 px-1.5 py-0.5 text-[10px] text-soft">
                  {{ item.widgetCount }}
                </span>
                <button
                  v-if="!item.isProtected"
                  type="button"
                  class="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-subtle transition group-hover:flex hover:bg-rose-500/20 hover:text-rose-300"
                  title="删除看板"
                  @click.stop="handleDeleteDashboard(item.id, item.name)"
                >
                  ×
                </button>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <section class="shrink-0 border-b border-soft p-4">
        <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-subtle">图表组件</h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="item in chartTypes"
            :key="item.type"
            type="button"
            draggable="true"
            class="group flex cursor-grab flex-col gap-1.5 rounded-xl border border-app bg-card-3 px-2.5 py-2 text-left transition hover:border-violet-400/40 hover:bg-violet-500/10 active:cursor-grabbing"
            @dragstart="onDragStart($event, item.type)"
            @click="emit('add-chart', item.type)"
          >
            <div class="flex items-center gap-1.5">
              <span class="h-5 w-5 text-violet-300 transition group-hover:text-violet-200">
                <ChartTypeIcon :type="item.type" />
              </span>
              <span class="text-[11px] font-medium text-app">{{ item.label }}</span>
            </div>
            <span class="text-[10px] text-subtle">{{ item.hint }}</span>
          </button>
        </div>
        <p class="mt-2 text-[10px] leading-relaxed text-subtle">
          拖入右侧画布即可创建；单击则添加到画布底部。
        </p>
      </section>

      <section class="shrink-0 max-h-[12.5rem] overflow-y-auto border-b border-soft p-4">
        <h2 class="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-subtle">
          <span>已接入字段</span>
          <span class="text-[10px] font-normal normal-case text-subtle">{{ totalFields }} 个字段</span>
        </h2>
        <div v-for="dataset in props.datasets" :key="dataset.id" class="mb-3 last:mb-0">
          <p class="mb-1.5 text-[11px] text-app">{{ dataset.name }}</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="field in dataset.fields"
              :key="field.key"
              class="rounded-md px-1.5 py-0.5 text-[10px]"
              :class="field.type === 'dimension' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-amber-500/10 text-amber-300'"
            >
              {{ field.label }}
            </span>
          </div>
        </div>
      </section>

      <section class="flex min-h-0 flex-1 flex-col p-4">
        <h2 class="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-subtle">
          <span>协作动态</span>
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="props.connected ? 'bg-emerald-400' : 'bg-rose-400'"
          ></span>
        </h2>
        <div class="min-h-0 flex-1 max-h-[11rem] space-y-2 overflow-y-auto pr-0.5">
          <div
            v-for="activity in props.activities"
            :key="activity.id"
            class="flex items-start gap-2 rounded-lg border border-soft bg-card-3 px-2.5 py-2"
          >
            <span
              class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              :style="{ backgroundColor: activity.user.color }"
            >
              {{ activity.user.name.slice(0, 1) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-[11px] leading-relaxed text-app">
                <span class="font-medium text-app">{{ activity.user.name }}</span>
                {{ activity.action }}
                <span v-if="activity.detail" class="text-violet-300">{{ activity.detail }}</span>
              </p>
              <p class="mt-0.5 text-[10px] text-subtle">{{ timeText(activity.at) }}</p>
            </div>
          </div>
          <p v-if="!props.activities.length" class="rounded-lg border border-dashed border-app px-3 py-4 text-center text-[11px] text-subtle">
            暂无协作动态
          </p>
        </div>
      </section>
    </div>

    <!-- ===== 数据集管理面板 ===== -->
    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <section class="border-b border-soft p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[11px] font-semibold uppercase tracking-widest text-subtle">数据导入</h2>
          <div class="flex rounded-md border border-app bg-card-3 p-0.5 text-[10px]">
            <button
              type="button"
              class="rounded px-2 py-0.5 transition"
              :class="importMode === 'csv' ? 'bg-violet-500/20 text-violet-200' : 'text-soft hover:text-app'"
              @click="importMode = 'csv'"
            >
              CSV 文本
            </button>
            <button
              type="button"
              class="rounded px-2 py-0.5 transition"
              :class="importMode === 'excel' ? 'bg-violet-500/20 text-violet-200' : 'text-soft hover:text-app'"
              @click="importMode = 'excel'"
            >
              Excel 文件
            </button>
          </div>
        </div>

        <!-- CSV 文本导入 -->
        <template v-if="importMode === 'csv'">
          <input
            v-model="csvName"
            class="field mb-2 py-1.5 text-[12px]"
            placeholder="数据集名称，例如 新业务报表"
            maxlength="40"
          />
          <textarea
            v-model="csvContent"
            class="field min-h-[100px] resize-y py-2 font-mono text-[11px]"
            placeholder="month,region,revenue,orders&#10;1月,华东,120000,320&#10;1月,华南,98000,260"
          ></textarea>
          <div class="mt-2 flex items-center gap-2">
            <button type="button" class="btn-primary px-3 py-1.5 text-[12px]" @click="importCsv">
              导入数据集
            </button>
            <span v-if="dataAction" class="truncate text-[11px] text-rose-300">{{ dataAction }}</span>
          </div>
        </template>

        <!-- Excel 文件导入 -->
        <template v-else>
          <input
            v-model="excelName"
            class="field mb-2 py-1.5 text-[12px]"
            placeholder="数据集名称（留空则用文件名）"
            maxlength="40"
          />
          <label class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-app bg-card-3 px-3 py-4 text-center transition hover:border-violet-400/40 hover:bg-violet-500/5">
            <span class="text-violet-300">📊</span>
            <span class="truncate text-[12px] text-app">
              {{ excelFileName || '点击选择 .xlsx / .xls / .csv 文件' }}
            </span>
            <input
              ref="excelInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              class="hidden"
              @change="onExcelFileChange"
            />
          </label>
          <div class="mt-2 flex items-center gap-2">
            <button
              type="button"
              class="btn-primary px-3 py-1.5 text-[12px]"
              :disabled="importing"
              @click="importExcel"
            >
              {{ importing ? '导入中…' : '导入数据集' }}
            </button>
            <span v-if="dataAction" class="truncate text-[11px] text-rose-300">{{ dataAction }}</span>
          </div>
        </template>

        <p class="mt-2 text-[10px] leading-relaxed text-subtle">
          字段类型自动推断：全数字字段 → 指标，含文本 → 维度。Excel 第一行作为表头。
        </p>
      </section>

      <section class="flex min-h-0 flex-1 flex-col p-4">
        <h2 class="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-subtle">
          <span>数据集列表</span>
          <button
            type="button"
            class="text-[11px] text-violet-300 transition hover:text-violet-200"
            @click="refreshDatasets"
          >
            刷新
          </button>
        </h2>
        <div class="min-h-0 flex-1 max-h-[32rem] space-y-2 overflow-y-auto pr-0.5">
          <div
            v-for="dataset in props.datasets"
            :key="dataset.id"
            class="rounded-xl border border-soft bg-card-3 p-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-[12px] font-medium text-app">{{ dataset.name }}</p>
                  <span class="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300">
                    {{ dataset.rows.length }} 行
                  </span>
                  <span class="shrink-0 rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-300">
                    {{ dataset.fields.length }} 字段
                  </span>
                </div>
                <p v-if="dataset.description" class="mt-1 truncate text-[10px] text-subtle">
                  {{ dataset.description }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  class="rounded-md border border-app bg-card-2 px-2 py-1 text-[10px] text-app transition hover:bg-hover"
                  @click="openEditRows(dataset)"
                >
                  编辑行
                </button>
                <button
                  type="button"
                  class="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300 transition hover:bg-rose-500/20"
                  @click="deleteDataset(dataset.id)"
                >
                  删除
                </button>
              </div>
            </div>
            <div class="mt-1.5 flex flex-wrap gap-1">
              <span
                v-for="field in dataset.fields"
                :key="field.key"
                class="rounded px-1.5 py-0.5 text-[10px]"
                :class="field.type === 'dimension' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-amber-500/10 text-amber-300'"
              >
                {{ field.label }}
              </span>
            </div>
          </div>
          <p v-if="!props.datasets.length" class="rounded-lg border border-dashed border-app px-3 py-4 text-center text-[11px] text-subtle">
            暂无数据集
          </p>
        </div>
      </section>
    </div>

    <!-- 编辑行弹窗 -->
    <Teleport to="body">
      <div
        v-if="editingDatasetId"
        class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
        @pointerdown.self="closeEditRows"
      >
        <div class="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-app bg-card shadow-2xl">
          <header class="flex items-center justify-between border-b border-soft px-5 py-3">
            <div>
              <h2 class="text-sm font-semibold text-app">编辑数据集行（CSV 格式）</h2>
              <p class="mt-0.5 text-[11px] text-subtle">保存后会覆盖整个数据集的行数据，字段结构保持不变</p>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-soft transition hover:bg-hover hover:text-app"
              @click="closeEditRows"
            >
              ×
            </button>
          </header>
          <textarea
            v-model="editingCsv"
            class="m-4 min-h-[280px] resize-none rounded-xl border border-app bg-card p-3 font-mono text-[12px] leading-relaxed text-app outline-none focus:border-violet-400/60"
          ></textarea>
          <footer class="flex items-center justify-end gap-2 border-t border-soft px-5 py-3">
            <button type="button" class="btn-ghost" @click="closeEditRows">取消</button>
            <button type="button" class="btn-primary" @click="saveEditedRows">保存覆盖</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </aside>
</template>
