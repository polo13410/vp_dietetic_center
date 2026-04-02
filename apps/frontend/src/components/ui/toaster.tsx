import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { create } from 'zustand';

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastStore {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: Omit<ToastMessage, 'id'>) {
  useToastStore.getState().addToast(message);
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border bg-white max-w-sm ${
            t.variant === 'destructive' ? 'border-destructive/20' : 'border-border'
          }`}
          onOpenChange={(open) => !open && removeToast(t.id)}
        >
          <div className="flex-1">
            <Toast.Title className="text-sm font-medium">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="text-xs text-muted-foreground mt-0.5">
                {t.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close asChild>
            <button className="text-muted-foreground hover:text-foreground mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 w-96 max-w-[calc(100vw-2rem)]" />
    </Toast.Provider>
  );
}
