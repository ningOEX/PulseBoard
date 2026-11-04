<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useIdentity } from '@/composables/useIdentity';

const emit = defineEmits<{ (e: 'join', payload: { name: string; color: string }): void }>();

const { USER_COLORS, identity, storeAvailable, storeLabel } = useIdentity();
const name = ref('');
const color = ref(USER_COLORS[0]);

onMounted(() => {
  // 自动填充上次的昵称
  if (identity.value.name) name.value = identity.value.name;
  if (identity.value.color) color.value = identity.value.color;
});

function submit(): void {
  const value = name.value.trim();
  if (!value) return;
  emit('join', { name: value.slice(0, 16), color: color.value });
}

function quickJoin(): void {
  // 生成匿名昵称，下次打开依然保持
  const anonymous = '访客 ' + Math.floor(1000 + Math.random() * 9000);
  emit('join', { name: anonymous, color: color.value });
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-app p-6">
    <div class="pointer-events-none absolute -left-24 top-0 h-96 w-96 rounded-full bg-violet-600/25 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl"></div>

    <div class="panel relative w-full max-w-md overflow-hidden p-8 shadow-2xl">
      <div class="mb-6">
        <div
          class="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-glow"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" class="h-6 w-6">
            <path d="M2 12h4l2.5-6 4 12 3-8 2 2h4.5" stroke-linecap="round" />
          </svg>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-app">PulseBoard</h1>
        <p class="mt-2 text-[13px] leading-relaxed text-soft">
          实时协作数据看板 · 多人同步编辑、拖拽式图表配置、ECharts 多维可视化
        </p>
      </div>

      <label class="label">你的昵称</label>
      <input
        v-model="name"
        class="field"
        maxlength="16"
        placeholder="例如：小林（留空可匿名进入）"
        @keydown.enter="submit"
      />

      <label class="label mt-5">协作标识色</label>
      <div class="flex gap-2">
        <button
          v-for="item in USER_COLORS"
          :key="item"
          type="button"
          class="h-8 w-8 rounded-full border-2 transition hover:scale-110"
          :class="color === item ? 'border-white shadow-glow' : 'border-transparent opacity-70'"
          :style="{ backgroundColor: item }"
          @click="color = item"
        ></button>
      </div>

      <div class="mt-6 flex gap-2">
        <button
          class="btn-primary flex-1"
          :disabled="!name.trim()"
          @click="submit"
        >
          进入看板
        </button>
        <button
          class="flex-1 rounded-lg border border-app bg-card-3 px-4 py-2 text-[13px] text-soft transition hover:bg-hover hover:text-app"
          @click="quickJoin"
        >
          匿名进入
        </button>
      </div>

      <div
        v-if="!storeAvailable"
        class="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300/80"
      >
        浏览器存储不可用，身份信息在当前会话有效，关闭后需重新命名。
      </div>

      <div class="mt-6 grid grid-cols-3 gap-2 text-center text-[10px] text-subtle">
        <div class="rounded-lg border border-soft bg-card-3 px-2 py-2">实时同步</div>
        <div class="rounded-lg border border-soft bg-card-3 px-2 py-2">拖拽布局</div>
        <div class="rounded-lg border border-soft bg-card-3 px-2 py-2">多维图表</div>
      </div>
    </div>
  </div>
</template>
