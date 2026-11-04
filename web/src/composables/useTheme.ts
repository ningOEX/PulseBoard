import { ref, watch } from 'vue';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'pulseboard:theme';

function loadTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // ignore
  }
  return 'dark';
}

function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  if (mode === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

const theme = ref<ThemeMode>(loadTheme());

// 初始应用一次（避免 FOUC）
applyTheme(theme.value);

watch(theme, (mode) => {
  applyTheme(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
});

export function useTheme() {
  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  function setTheme(mode: ThemeMode): void {
    theme.value = mode;
  }

  return { theme, toggleTheme, setTheme };
}
