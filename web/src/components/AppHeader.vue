<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { PresenceEntry, StoreMode, UserInfo } from '@/types';
import type { ThemeMode } from '@/composables/useTheme';
import PresenceBar from './PresenceBar.vue';

const props = defineProps<{
  dashboardName: string;
  connected: boolean;
  presence: PresenceEntry[];
  self: UserInfo;
  storeMode: StoreMode | 'unknown';
  theme: ThemeMode;
}>();

const emit = defineEmits<{
  (e: 'toggle-theme'): void;
}>();

function modeLabel(mode: StoreMode | 'unknown'): string {
  if (mode === 'mongo') return 'MongoDB';
  if (mode === 'memory') return '内存模式';
  return '—';
}

// ---------- 全屏 ----------
const isFullscreen = ref(false);

function onFullscreenChange(): void {
  isFullscreen.value = Boolean(document.fullscreenElement);
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // 浏览器可能拒绝全屏请求，忽略
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange);
});
</script>

<template>
  <header
    class="relative z-30 flex items-center justify-between gap-2 border-b border-soft bg-header px-3 py-2 backdrop-blur-xl sm:gap-4 sm:px-4 sm:py-3"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-glow sm:h-9 sm:w-9"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" class="h-4 w-4 sm:h-5 sm:w-5">
          <path d="M2 12h4l2.5-6 4 12 3-8 2 2h4.5" stroke-linecap="round" />
        </svg>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2 overflow-hidden">
          <h1 class="truncate text-[13px] font-semibold tracking-wide text-app sm:text-sm">
            {{ props.dashboardName || '实时协作数据看板' }}
          </h1>
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] sm:px-2"
            :class="props.connected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="props.connected ? 'animate-pulse bg-emerald-400' : 'bg-rose-400'"
            ></span>
            <span class="hidden sm:inline">{{ props.connected ? '实时同步中' : '连接中断' }}</span>
          </span>
          <span
            class="hidden shrink-0 rounded-full border border-app px-2 py-0.5 text-[10px] text-soft sm:inline-flex"
            :title="props.storeMode === 'memory' ? '未检测到 MongoDB，数据保存在后端内存中' : '数据已持久化到 MongoDB'"
          >
            {{ modeLabel(props.storeMode) }}
          </span>
        </div>
        <p class="hidden truncate text-[11px] text-subtle sm:block">
          Socket.io 多人协同 · 拖拽式图表配置 · ECharts 多维可视化
        </p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <!-- 主题切换 -->
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-card-2 text-soft transition hover:bg-hover hover:text-app"
        :title="props.theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'"
        @click="emit('toggle-theme')"
      >
        <!-- 太阳（亮色时显示月亮图标切换回暗色；这里用：暗色下显示太阳，亮色下显示月亮） -->
        <svg v-if="props.theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke-linecap="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- 全屏切换 -->
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-card-2 text-soft transition hover:bg-hover hover:text-app"
        :title="isFullscreen ? '退出全屏' : '进入全屏'"
        @click="toggleFullscreen"
      >
        <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
          <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <div class="hidden items-center gap-2 rounded-lg border border-app bg-card-2 px-2.5 py-1.5 sm:flex">
        <span class="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white" :style="{ backgroundColor: props.self.color }">
          {{ props.self.name.slice(0, 1) }}
        </span>
        <span class="max-w-[80px] truncate text-[11px] text-soft">{{ props.self.name }}</span>
      </div>
      <PresenceBar :presence="props.presence" :self="props.self" :theme="props.theme" />
    </div>
  </header>
</template>
