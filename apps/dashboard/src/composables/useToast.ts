import { ref } from 'vue';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export function useToast() {
  const toasts = ref<Toast[]>([]);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    duration = 3000
  ) => {
    const id = Date.now();
    toasts.value.push({ id, message, type, duration });

    // Auto remove toast after duration
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  };

  const showSuccess = (message: string) => showToast(message, 'success');
  const showError = (message: string) => showToast(message, 'error');
  const showInfo = (message: string) => showToast(message, 'info');
  const showWarning = (message: string) => showToast(message, 'warning');

  return {
    toasts: toasts.value,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeToast,
  };
}