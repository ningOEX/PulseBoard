import { computed, ref } from 'vue';
import type { UserInfo } from '@/types';

const STORAGE_KEY = 'pulseboard:identity';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export const USER_COLORS = ['#8b5cf6', '#22d3ee', '#f59e0b', '#34d399', '#f472b6', '#60a5fa'];

interface IdentityState extends UserInfo {
  name: string;
  expiresAt: number;
}

/**
 * 存储层：localStorage → sessionStorage → 内存 Map 三级降级
 * 某些浏览器隐私模式会禁用 localStorage，sessionStorage 在同源同窗口下依然可用。
 */
const memoryFallback = new Map<string, string>();

function pickStore(): {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
  available: boolean;
  label: string;
} {
  const tryStorage = (storage: Storage): { get: (k: string) => string | null; set: (k: string, v: string) => void } | null => {
    try {
      const probe = '__pulseboard_probe__';
      storage.setItem(probe, probe);
      storage.removeItem(probe);
      return { get: (k) => storage.getItem(k), set: (k, v) => storage.setItem(k, v) };
    } catch {
      return null;
    }
  };

  const ls = typeof localStorage !== 'undefined' ? tryStorage(localStorage) : null;
  if (ls) return { ...ls, available: true, label: 'localStorage' };

  const ss = typeof sessionStorage !== 'undefined' ? tryStorage(sessionStorage) : null;
  if (ss) return { ...ss, available: true, label: 'sessionStorage' };

  return {
    get: (k) => memoryFallback.get(k) ?? null,
    set: (k, v) => memoryFallback.set(k, v),
    available: false,
    label: 'memory',
  };
}

const store = pickStore();

function loadIdentity(): IdentityState | null {
  try {
    const raw = store.get(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdentityState & { expiresAt?: number };
    if (!parsed?.id || typeof parsed.id !== 'string') return null;
    // 过期检查
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      store.set(STORAGE_KEY, '');
      return null;
    }
    // 兼容旧数据（没有 expiresAt 字段的视为永久，给它补上 7 天 TTL）
    if (!parsed.expiresAt) {
      parsed.expiresAt = Date.now() + TTL_MS;
      store.set(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed as IdentityState;
  } catch {
    return null;
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `u-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const saved = loadIdentity();
const identity = ref<IdentityState>(
  saved ?? {
    id: createId(),
    name: '',
    color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
    expiresAt: Date.now() + TTL_MS,
  },
);

const hasIdentity = computed(() => identity.value.name.trim().length > 0);

function saveIdentity(name: string, color: string): void {
  identity.value = {
    ...identity.value,
    name: name.trim().slice(0, 16),
    color,
    expiresAt: Date.now() + TTL_MS,
  };
  try {
    store.set(STORAGE_KEY, JSON.stringify(identity.value));
  } catch {
    // 存储不可用时静默忽略，下次打开还是会要填
  }
}

export function useIdentity() {
  return {
    identity,
    hasIdentity,
    saveIdentity,
    USER_COLORS,
    storeLabel: store.label,
    storeAvailable: store.available,
  };
}
