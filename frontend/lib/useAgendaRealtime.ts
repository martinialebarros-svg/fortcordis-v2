"use client";

import { useEffect, useRef, useState } from "react";

export interface AgendaRealtimePayload {
  type?: string;
  action?: string;
  agendamento_id?: number;
  data?: Record<string, unknown>;
  timestamp?: string;
}

interface UseAgendaRealtimeResult {
  conectado: boolean;
  ultimoEvento: string;
}

export function useAgendaRealtime(
  enabled: boolean,
  onAgendaUpdate: (payload: AgendaRealtimePayload) => void
): UseAgendaRealtimeResult {
  const [conectado, setConectado] = useState(false);
  const [ultimoEvento, setUltimoEvento] = useState("");
  const callbackRef = useRef(onAgendaUpdate);

  useEffect(() => {
    callbackRef.current = onAgendaUpdate;
  }, [onAgendaUpdate]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setConectado(false);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setConectado(false);
      return;
    }

    let cancelado = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const parseEventBlock = (rawBlock: string) => {
      if (!rawBlock.trim()) return;

      const linhas = rawBlock.replace(/\r/g, "").split("\n");
      let eventType = "message";
      const dataChunks: string[] = [];

      for (const linha of linhas) {
        if (linha.startsWith("event:")) {
          eventType = linha.slice(6).trim();
          continue;
        }
        if (linha.startsWith("data:")) {
          dataChunks.push(linha.slice(5).trim());
        }
      }

      if (eventType !== "agenda_update") {
        return;
      }

      const rawData = dataChunks.join("\n");
      if (!rawData) {
        return;
      }

      try {
        const payload = JSON.parse(rawData) as AgendaRealtimePayload;
        if (payload.action) {
          setUltimoEvento(payload.action);
        }
        callbackRef.current(payload);
      } catch (error) {
        console.error("Erro ao parsear evento SSE de agenda:", error);
      }
    };

    const connect = async () => {
      while (!cancelado) {
        abortController = new AbortController();
        activeReader = null;

        try {
          const response = await fetch("/api/v1/agenda/stream", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "text/event-stream",
              "Cache-Control": "no-cache",
            },
            signal: abortController.signal,
            cache: "no-store",
          });

          if (!response.ok || !response.body) {
            throw new Error(`Falha no stream de agenda (HTTP ${response.status}).`);
          }

          setConectado(true);
          const reader = response.body.getReader();
          activeReader = reader;
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (!cancelado) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf("\n\n");
            while (boundary !== -1) {
              const rawBlock = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              parseEventBlock(rawBlock);
              boundary = buffer.indexOf("\n\n");
            }
          }
        } catch (error: any) {
          if (!cancelado && error?.name !== "AbortError") {
            console.error("Stream de agenda desconectado:", error);
          }
        } finally {
          setConectado(false);
          if (activeReader) {
            try {
              await activeReader.cancel();
            } catch {
              // ignore
            }
            activeReader = null;
          }
        }

        if (cancelado) {
          break;
        }

        await new Promise<void>((resolve) => {
          reconnectTimer = setTimeout(() => resolve(), 3000);
        });
      }
    };

    void connect();

    return () => {
      cancelado = true;
      setConectado(false);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (abortController) {
        abortController.abort();
      }
      if (activeReader) {
        activeReader.cancel().catch(() => undefined);
      }
    };
  }, [enabled]);

  return { conectado, ultimoEvento };
}
