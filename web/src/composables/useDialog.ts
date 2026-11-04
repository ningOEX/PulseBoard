import { reactive } from 'vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import type { ConfirmDialogOptions } from '../components/ConfirmDialog.vue';

interface DialogState {
  open: boolean;
  options: ConfirmDialogOptions;
  resolver: ((value: string | true | false) => void) | null;
}

const state = reactive<DialogState>({
  open: false,
  options: { title: '' },
  resolver: null,
});

function show(opts: ConfirmDialogOptions): Promise<string | true | false> {
  return new Promise((resolve) => {
    state.options = opts;
    state.open = true;
    state.resolver = (value) => resolve(value);
  });
}

function onConfirm(value: string | true): void {
  state.resolver?.(value);
  state.resolver = null;
}

function onCancel(): void {
  state.resolver?.(false);
  state.resolver = null;
}

export function useDialog() {
  /** 普通确认框 */
  function confirm(
    title: string,
    message?: string,
    opts: Partial<ConfirmDialogOptions> = {},
  ): Promise<boolean> {
    return show({ title, message, ...opts }).then((r) => r !== false) as Promise<boolean>;
  }

  /** 需要输入的确认（返回输入字符串，取消返回 null） */
  function prompt(
    title: string,
    message?: string,
    opts: Partial<ConfirmDialogOptions> = {},
  ): Promise<string | null> {
    return show({
      title,
      message,
      prompt: true,
      confirmLabel: opts.confirmLabel ?? '确认删除',
      cancelLabel: opts.cancelLabel ?? '取消',
      ...opts,
    }).then((r) => (r === false ? null : String(r)));
  }

  /** 危险操作确认（红色主题） */
  function dangerConfirm(
    title: string,
    message?: string,
    opts: Partial<ConfirmDialogOptions> = {},
  ): Promise<boolean> {
    return show({
      title,
      message,
      danger: true,
      confirmLabel: opts.confirmLabel ?? '确认删除',
      ...opts,
    }).then((r) => r !== false) as Promise<boolean>;
  }

  return {
    state,
    confirm,
    prompt,
    dangerConfirm,
    ConfirmDialog,
    onConfirm,
    onCancel,
  };
}
