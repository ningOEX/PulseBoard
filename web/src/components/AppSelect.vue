<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export interface SelectOption {
  value: string;
  label: string;
}

const props = defineProps<{
  modelValue: string;
  options: SelectOption[];
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const open = ref(false);
const rootRef = ref<HTMLDivElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);

// 下拉面板定位（相对视口，通过 Teleport 脱离滚动容器避免被裁剪）
const panelStyle = ref<Record<string, string>>({});

function updatePosition(): void {
  const el = triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  panelStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.bottom + 6}px`,
    width: `${rect.width}px`,
  };
}

const selectedLabel = computed(() => {
  const found = props.options.find((item) => item.value === props.modelValue);
  return found?.label ?? '';
});

function toggle(): void {
  if (open.value) {
    open.value = false;
    return;
  }
  updatePosition();
  open.value = true;
}

function select(value: string): void {
  emit('update:modelValue', value);
  open.value = false;
}

function onDocPointerDown(event: PointerEvent): void {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    open.value = false;
  }
}

function closeOnScroll(): void {
  if (open.value) open.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown);
  // 滚动时关闭，避免浮层错位
  window.addEventListener('scroll', closeOnScroll, true);
  window.addEventListener('resize', closeOnScroll);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown);
  window.removeEventListener('scroll', closeOnScroll, true);
  window.removeEventListener('resize', closeOnScroll);
});
</script>

<template>
  <div class="relative" ref="rootRef">
    <!-- 触发器 -->
    <button
      ref="triggerRef"
      type="button"
      class="field flex w-full items-center justify-between gap-2 text-left"
      :class="open ? 'border-violet-400/60' : ''"
      @click="toggle"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="h-3.5 w-3.5 shrink-0 text-subtle transition-transform"
        :class="open ? 'rotate-180' : ''"
      >
        <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- 下拉面板（Teleport 到 body，避免被弹窗的 overflow 裁剪） -->
    <Teleport to="body">
      <Transition name="select-pop">
        <div
          v-if="open"
          class="z-[200] overflow-hidden rounded-xl border border-app bg-card shadow-2xl"
          :style="panelStyle"
        >
          <ul class="max-h-60 overflow-y-auto py-1">
            <li
              v-for="option in props.options"
              :key="option.value"
              class="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[13px] transition"
              :class="
                option.value === props.modelValue
                  ? 'bg-violet-500/15 text-app'
                  : 'text-soft hover:bg-hover hover:text-app'
              "
              @click="select(option.value)"
            >
              <span class="truncate">{{ option.label }}</span>
              <svg
                v-if="option.value === props.modelValue"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="h-3.5 w-3.5 shrink-0 text-violet-400"
              >
                <path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.select-pop-enter-active,
.select-pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.select-pop-enter-from,
.select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
