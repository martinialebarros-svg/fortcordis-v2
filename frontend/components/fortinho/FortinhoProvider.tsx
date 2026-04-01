"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import FortinhoMascot, { type FortinhoGesture, type FortinhoMood } from "@/components/FortinhoMascot";

interface FortinhoNotifyOptions {
  title?: string;
  message: string;
  mood?: FortinhoMood;
  gesture?: FortinhoGesture;
  durationMs?: number;
  sticky?: boolean;
}

interface FortinhoConfirmOptions {
  title?: string;
  message: string;
  mood?: FortinhoMood;
  gesture?: FortinhoGesture;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface FortinhoContextValue {
  notify: (options: FortinhoNotifyOptions) => void;
  confirm: (options: FortinhoConfirmOptions) => Promise<boolean>;
  dismissCurrent: () => void;
}

type FortinhoQueueBase = {
  id: number;
  title: string;
  message: string;
  mood: FortinhoMood;
  gesture: FortinhoGesture;
};

type FortinhoNoticeItem = FortinhoQueueBase & {
  kind: "notice";
  durationMs: number;
  sticky: boolean;
};

type FortinhoConfirmItem = FortinhoQueueBase & {
  kind: "confirm";
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: boolean) => void;
};

type FortinhoQueueItem = FortinhoNoticeItem | FortinhoConfirmItem;

const FALLBACK_CONTEXT: FortinhoContextValue = {
  notify: ({ title, message }) => {
    if (typeof window === "undefined") return;
    const texto = title ? `${title}\n\n${message}` : message;
    window.alert(texto);
  },
  confirm: async ({ title, message, confirmLabel, cancelLabel }) => {
    if (typeof window === "undefined") return false;
    const rodape =
      confirmLabel || cancelLabel
        ? `\n\n${confirmLabel || "Confirmar"} / ${cancelLabel || "Cancelar"}`
        : "";
    const texto = title ? `${title}\n\n${message}${rodape}` : `${message}${rodape}`;
    return window.confirm(texto);
  },
  dismissCurrent: () => {},
};

const FortinhoContext = createContext<FortinhoContextValue>(FALLBACK_CONTEXT);

export function useFortinho(): FortinhoContextValue {
  return useContext(FortinhoContext);
}

export function FortinhoProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<FortinhoQueueItem[]>([]);
  const [oculto, setOculto] = useState(false);
  const sequenceRef = useRef(0);

  const shiftQueue = useCallback((confirmResult = false) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [itemAtual, ...restante] = prev;
      if (itemAtual.kind === "confirm") {
        queueMicrotask(() => itemAtual.resolve(confirmResult));
      }
      return restante;
    });
  }, []);

  const notify = useCallback((options: FortinhoNotifyOptions) => {
    const id = ++sequenceRef.current;
    const item: FortinhoNoticeItem = {
      id,
      kind: "notice",
      title: options.title?.trim() || "Fortinho",
      message: options.message,
      mood: options.mood ?? "happy",
      gesture: options.gesture ?? "wave",
      durationMs: Math.max(2000, options.durationMs ?? 6000),
      sticky: Boolean(options.sticky),
    };
    setQueue((prev) => [...prev, item]);
  }, []);

  const confirm = useCallback((options: FortinhoConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const id = ++sequenceRef.current;
      const item: FortinhoConfirmItem = {
        id,
        kind: "confirm",
        title: options.title?.trim() || "Fortinho precisa de confirmacao",
        message: options.message,
        mood: options.mood ?? "alert",
        gesture: options.gesture ?? "open-arms",
        confirmLabel: options.confirmLabel?.trim() || "Confirmar",
        cancelLabel: options.cancelLabel?.trim() || "Cancelar",
        resolve,
      };
      setQueue((prev) => [...prev, item]);
    });
  }, []);

  const dismissCurrent = useCallback(() => {
    shiftQueue(false);
  }, [shiftQueue]);

  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current || current.kind !== "notice" || current.sticky) return;
    const timeout = window.setTimeout(() => {
      shiftQueue(false);
    }, current.durationMs);
    return () => window.clearTimeout(timeout);
  }, [current, shiftQueue]);

  const contextValue = useMemo<FortinhoContextValue>(
    () => ({
      notify,
      confirm,
      dismissCurrent,
    }),
    [notify, confirm, dismissCurrent]
  );

  const mensagemAtual = current
    ? `${current.title}: ${current.message}`
    : "Estou por aqui para deixar os avisos mais humanos.";
  const moodAtual = current?.mood ?? "happy";
  const gestoAtual = current?.gesture ?? "wave";

  return (
    <FortinhoContext.Provider value={contextValue}>
      {children}

      {!oculto && (
        <div
          className="fixed bottom-4 right-4 z-[90] flex w-[238px] flex-col items-end"
          data-fortcordis-overlay-safe="1"
        >
          <button
            type="button"
            onClick={() => setOculto(true)}
            className="mb-2 pointer-events-auto rounded-full border border-rose-300 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 shadow-sm hover:bg-rose-50"
          >
            Ocultar Fortinho
          </button>

          <div className="pointer-events-auto">
            <FortinhoMascot
              mood={moodAtual}
              gesture={gestoAtual}
              message={mensagemAtual}
              className="origin-bottom-right scale-[0.84] md:scale-100"
            />
          </div>

          {current?.kind === "confirm" && (
            <div className="pointer-events-auto mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs text-slate-600">Como devemos seguir?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => shiftQueue(false)}
                  className="rounded-xl border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {current.cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={() => shiftQueue(true)}
                  className="rounded-xl border border-rose-600 bg-rose-600 px-2 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  {current.confirmLabel}
                </button>
              </div>
            </div>
          )}

          {current?.kind === "notice" && current.sticky && (
            <button
              type="button"
              onClick={() => shiftQueue(false)}
              className="pointer-events-auto mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50"
            >
              Entendi
            </button>
          )}
        </div>
      )}

      {oculto && (
        <button
          type="button"
          onClick={() => setOculto(false)}
          data-fortcordis-overlay-safe="1"
          className="fixed bottom-4 right-4 z-[90] rounded-full border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-md hover:bg-rose-50"
        >
          Mostrar Fortinho
        </button>
      )}
    </FortinhoContext.Provider>
  );
}
