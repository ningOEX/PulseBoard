<script setup lang="ts">
import type { ChartType } from '@/types';

defineProps<{ type: ChartType }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="h-full w-full"
  >
    <template v-if="type === 'line'">
      <path d="M3 17l5-6 4 3 6-8" />
      <path d="M3 20h18" stroke-dasharray="2 4" opacity=".45" />
    </template>
    <template v-else-if="type === 'bar'">
      <rect x="4.5" y="12" width="3" height="7" rx="1" />
      <rect x="10.5" y="8" width="3" height="11" rx="1" />
      <rect x="16.5" y="5" width="3" height="14" rx="1" />
    </template>
    <template v-else-if="type === 'pie'">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v8h8" />
    </template>
    <template v-else-if="type === 'scatter'">
      <circle cx="7" cy="16" r="1.8" />
      <circle cx="12" cy="10" r="1.8" />
      <circle cx="17" cy="7" r="1.8" />
      <circle cx="16" cy="16" r="1.8" />
    </template>
    <template v-else-if="type === 'radar'">
      <path d="M12 3l7.5 5.5-2.8 9h-9.4L4.5 8.5 12 3z" />
      <path d="M12 7.5l4 2.8-1.4 4.5h-5.2L8 10.3 12 7.5z" opacity=".55" />
    </template>
    <template v-else>
      <path d="M5 16a7 7 0 0 1 14 0" />
      <path d="M12 16l4-4" />
      <path d="M4 19h16" opacity=".45" />
    </template>
  </svg>
</template>
