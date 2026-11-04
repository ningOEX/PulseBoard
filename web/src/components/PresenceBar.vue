<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { PresenceEntry, UserInfo } from '@/types';
import type { ThemeMode } from '@/composables/useTheme';

const props = defineProps<{ presence: PresenceEntry[]; self: UserInfo; theme: ThemeMode }>();

const showRoster = ref(false);
const rosterRef = ref<HTMLDivElement | null>(null);

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function toggleRoster(): void {
  showRoster.value = !showRoster.value;
}

function onDocPointerDown(event: PointerEvent): void {
  if (!showRoster.value) return;
  if (rosterRef.value && !rosterRef.value.contains(event.target as Node)) {
    showRoster.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown);
});
</script>

<template>
  <div class="relative flex items-center gap-2 sm:gap-3" ref="rosterRef">
    <div class="hidden items-center sm:flex">
      <div
        v-for="(entry, index) in props.presence.slice(0, 6)"
        :key="entry.user.id"
        class="group relative -ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white shadow-lg first:ml-0 transition hover:-translate-y-0.5"
        :class="props.theme === 'light' ? 'border-white' : 'border-slate-950'"
        :style="{ backgroundColor: entry.user.color, zIndex: props.presence.length - index }"
      >
        {{ initials(entry.user.name) }}
        <span
          v-if="entry.editingWidgetId"
          class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-slate-950"
        ></span>
        <span
          class="pointer-events-none absolute -bottom-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-app bg-card px-2 py-1 text-[10px] text-app shadow-xl group-hover:block"
        >
          {{ entry.user.name }}{{ entry.user.id === props.self.id ? '（你）' : '' }}{{ entry.editingWidgetId ? ' · 编辑中' : '' }}
        </span>
      </div>
      <span v-if="!props.presence.length" class="text-[11px] text-subtle">等待协作者…</span>
    </div>

    <!-- 在线人数按钮（点击展开全部名单） -->
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full border border-app bg-card-2 px-2 py-1 text-[11px] text-soft transition hover:bg-hover hover:text-app sm:gap-2 sm:px-3"
      @click.stop="toggleRoster"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
      {{ props.presence.length }} 人在线
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hidden h-3 w-3 transition sm:block" :class="showRoster ? 'rotate-180' : ''">
        <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- 在线名单浮层 -->
    <div
      v-if="showRoster"
      class="absolute right-0 top-full z-[100] mt-2 w-56 overflow-hidden rounded-xl border border-app bg-card shadow-2xl"
    >
      <div class="border-b border-soft px-3 py-2">
        <p class="text-[11px] font-semibold text-app">在线协作者（{{ props.presence.length }}）</p>
      </div>
      <ul class="max-h-64 overflow-y-auto py-1">
        <li
          v-for="entry in props.presence"
          :key="entry.user.id"
          class="flex items-center gap-2 px-3 py-1.5"
        >
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            :style="{ backgroundColor: entry.user.color }"
          >
            {{ initials(entry.user.name) }}
          </span>
          <span class="min-w-0 flex-1 truncate text-[12px] text-app">
            {{ entry.user.name }}
            <span v-if="entry.user.id === props.self.id" class="text-subtle">（你）</span>
          </span>
          <span
            v-if="entry.editingWidgetId"
            class="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] text-emerald-300"
          >
            编辑中
          </span>
        </li>
        <li v-if="!props.presence.length" class="px-3 py-3 text-center text-[11px] text-subtle">
          暂无在线协作者
        </li>
      </ul>
    </div>
  </div>
</template>
