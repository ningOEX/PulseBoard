<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  prompt?: boolean;
  promptPlaceholder?: string;
  promptValue?: string;
}

const props = defineProps<{
  open: boolean;
  options: ConfirmDialogOptions;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'confirm', value: string | true): void;
  (e: 'cancel'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const promptValue = ref('');

watch(
  () => props.open,
  (v) => {
    if (v && props.options.prompt) {
      promptValue.value = props.options.promptValue ?? '';
      nextTick(() => inputRef.value?.focus());
    }
  },
);

onMounted(() => {
  if (props.open && props.options.prompt) {
    nextTick(() => inputRef.value?.focus());
  }
});

const titleClass = computed(() => (props.options.danger ? 'text-rose-300' : 'text-app'));
const confirmClass = computed(
  () =>
    props.options.danger
      ? 'bg-rose-500/90 hover:bg-rose-500 text-white'
      : 'bg-violet-500 hover:bg-violet-400 text-white',
);

function handleConfirm(): void {
  emit('confirm', props.options.prompt ? promptValue.value : true);
  emit('update:open', false);
}

function handleCancel(): void {
  emit('cancel');
  emit('update:open', false);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && props.options.prompt) handleConfirm();
  if (e.key === 'Escape') handleCancel();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @keydown="onKeydown"
        tabindex="-1"
      >
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-overlay backdrop-blur-sm" @click="handleCancel" />

        <!-- 弹窗主体 -->
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-md overflow-hidden rounded-2xl border border-app bg-card shadow-2xl shadow-black/30 ring-1 ring-black/5"
        >
          <!-- 危险色顶部条 -->
          <div
            v-if="options.danger"
            class="h-1 w-full bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500"
          />
          <div v-else class="h-1 w-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-violet-500" />

          <div class="px-6 pt-6 pb-5">
            <!-- 图标 + 标题 -->
            <div class="mb-3 flex items-start gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                :class="options.danger ? 'bg-rose-500/15 text-rose-400' : 'bg-violet-500/15 text-violet-400'"
              >
                <svg
                  v-if="options.danger"
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <svg
                  v-else
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <h3 class="text-[15px] font-semibold leading-5" :class="titleClass">{{ options.title }}</h3>
            </div>

            <!-- 描述 -->
            <p v-if="options.message" class="mb-4 ml-13 text-[13px] leading-6 text-soft" style="margin-left: 52px;">
              {{ options.message }}
            </p>

            <!-- prompt 输入框 -->
            <div v-if="options.prompt" class="mt-1">
              <input
                ref="inputRef"
                v-model="promptValue"
                type="text"
                class="w-full rounded-lg border border-app bg-card-3 px-3 py-2 text-[13px] text-app placeholder:text-subtle outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
                :placeholder="options.promptPlaceholder ?? ''"
                @keydown.enter.prevent="handleConfirm"
                @keydown.esc.prevent="handleCancel"
              />
            </div>
          </div>

          <!-- 按钮区 -->
          <div class="flex items-center justify-end gap-2 border-t border-soft bg-card-3 px-6 py-3">
            <button
              type="button"
              class="rounded-lg px-4 py-1.5 text-[13px] text-soft transition hover:bg-hover hover:text-app"
              @click="handleCancel"
            >
              {{ options.cancelLabel ?? '取消' }}
            </button>
            <button
              type="button"
              class="rounded-lg px-4 py-1.5 text-[13px] font-medium shadow-sm transition"
              :class="confirmClass"
              @click="handleConfirm"
            >
              {{ options.confirmLabel ?? '确定' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 180ms ease;
}
.dialog-enter-active .relative,
.dialog-leave-active .relative {
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .relative {
  transform: translateY(8px) scale(0.97);
  opacity: 0;
}
.dialog-leave-to .relative {
  transform: translateY(-4px) scale(0.98);
  opacity: 0;
}
</style>
