"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileVideo,
  Gauge,
  Loader2,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sun,
  Upload,
  X,
} from "lucide-react";

import DashboardLayout from "../layout-dashboard";
import {
  VIVID_IQ_MAX_FILE_BYTES,
  findVividIqFrameAtTimestamp,
  getVividIqFramePixels,
  parseVividIqDicom,
  type VividIqStudy,
} from "@/lib/vivid-iq-dicom.mjs";

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2] as const;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function formatSeconds(seconds: number) {
  return `${seconds.toFixed(2).replace(".", ",")} s`;
}

function clampFrame(study: VividIqStudy, frameIndex: number) {
  return Math.max(0, Math.min(study.frameCount - 1, frameIndex));
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Nao foi possivel abrir este arquivo. Confirme se ele e o DICOM original exportado pelo Vivid iq.";
}

export default function VisualizadorVividIqPage() {
  const [study, setStudy] = useState<VividIqStudy | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const frameIndexRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const loadRequestRef = useRef(0);
  const imageDataRef = useRef<{
    width: number;
    height: number;
    imageData: ImageData;
  } | null>(null);

  const goToFrame = useCallback((nextIndex: number) => {
    if (!study) {
      return;
    }
    const clamped = clampFrame(study, nextIndex);
    frameIndexRef.current = clamped;
    setFrameIndex(clamped);
  }, [study]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const clearStudy = useCallback(() => {
    loadRequestRef.current += 1;
    stopPlayback();
    setStudy(null);
    setFrameIndex(0);
    frameIndexRef.current = 0;
    setBrightness(0);
    setContrast(1);
    setErrorMessage("");
    imageDataRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [stopPlayback]);

  const loadFile = useCallback(async (file: File) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    stopPlayback();
    setStudy(null);
    setFrameIndex(0);
    frameIndexRef.current = 0;
    setBrightness(0);
    setContrast(1);
    setErrorMessage("");

    if (file.size > VIVID_IQ_MAX_FILE_BYTES) {
      setErrorMessage("O arquivo excede o limite local de 512 MB.");
      return;
    }

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      if (requestId !== loadRequestRef.current) {
        return;
      }
      const parsed = parseVividIqDicom(buffer, "arquivo local");
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setStudy(parsed);
      setFrameIndex(0);
      frameIndexRef.current = 0;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setErrorMessage(readableError(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [stopPlayback]);

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void loadFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void loadFile(file);
    }
  };

  const renderFrame = useCallback(() => {
    if (!study || !canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      return;
    }

    if (canvas.width !== study.width || canvas.height !== study.height) {
      canvas.width = study.width;
      canvas.height = study.height;
      imageDataRef.current = null;
    }
    if (
      !imageDataRef.current
      || imageDataRef.current.width !== study.width
      || imageDataRef.current.height !== study.height
    ) {
      imageDataRef.current = {
        width: study.width,
        height: study.height,
        imageData: context.createImageData(study.width, study.height),
      };
    }

    const source = getVividIqFramePixels(study, frameIndex);
    const target = imageDataRef.current.imageData.data;
    for (let pixelIndex = 0; pixelIndex < source.length; pixelIndex += 1) {
      const adjusted = Math.max(
        0,
        Math.min(255, (source[pixelIndex] - 128) * contrast + 128 + brightness),
      );
      const targetOffset = pixelIndex * 4;
      target[targetOffset] = adjusted;
      target[targetOffset + 1] = adjusted;
      target[targetOffset + 2] = adjusted;
      target[targetOffset + 3] = 255;
    }
    context.putImageData(imageDataRef.current.imageData, 0, 0);
  }, [brightness, contrast, frameIndex, study]);

  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  useEffect(() => {
    if (!isPlaying || !study) {
      return;
    }

    const anchorIndex = frameIndexRef.current;
    const anchorTimestamp = study.frames[anchorIndex].timestampSeconds;
    const lastTimestamp = study.frames[study.frameCount - 1].timestampSeconds;
    const anchorWallClock = window.performance.now();

    const tick = (now: number) => {
      const elapsedSeconds = (now - anchorWallClock) / 1000;
      const targetTimestamp = anchorTimestamp + elapsedSeconds * playbackSpeed;
      if (targetTimestamp >= lastTimestamp) {
        frameIndexRef.current = study.frameCount - 1;
        setFrameIndex(study.frameCount - 1);
        setIsPlaying(false);
        animationFrameRef.current = null;
        return;
      }

      const nextFrame = findVividIqFrameAtTimestamp(study, targetTimestamp);
      if (nextFrame !== frameIndexRef.current) {
        frameIndexRef.current = nextFrame;
        setFrameIndex(nextFrame);
      }
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, study]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    loadRequestRef.current += 1;
  }, []);

  const currentSeconds = useMemo(() => {
    if (!study) {
      return 0;
    }
    return Math.max(
      0,
      study.frames[frameIndex].timestampSeconds - study.firstTimestamp,
    );
  }, [frameIndex, study]);

  const togglePlayback = () => {
    if (!study) {
      return;
    }
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (frameIndexRef.current >= study.frameCount - 1) {
      goToFrame(0);
    }
    setIsPlaying(true);
  };

  const stepFrame = (delta: number) => {
    stopPlayback();
    goToFrame(frameIndexRef.current + delta);
  };

  const resetImageAdjustments = () => {
    setBrightness(0);
    setContrast(1);
  };

  const requestFullscreen = async () => {
    try {
      await canvasStageRef.current?.requestFullscreen();
    } catch {
      setErrorMessage("O navegador nao permitiu abrir a imagem em tela cheia.");
    }
  };

  const downloadCurrentFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !study) {
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setErrorMessage("Nao foi possivel gerar a captura PNG deste quadro.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vivid-iq-quadro-${String(frameIndex + 1).padStart(4, "0")}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }, "image/png");
  };

  return (
    <DashboardLayout>
      <div className="fc-page space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-ink-900 via-ink-700 to-vital-900 px-6 py-7 text-white shadow-fort-card sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-vital-100">
                <Activity className="h-4 w-4" /> Imagem cardiologica
              </div>
              <h1 className="text-2xl font-bold sm:text-3xl">Visualizador Vivid IQ</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                Abra o arquivo DICOM original, mesmo sem extensao, e revise o cine salvo pelo equipamento GE.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/90">
              <ShieldCheck className="h-5 w-5 text-vital-100" />
              Processamento somente neste navegador
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-vital-200 bg-vital-50 p-4 text-sm leading-6 text-vital-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-vital-600" />
            <div>
              <p className="font-semibold">O exame nao e enviado ao servidor</p>
              <p className="mt-1 text-vital-700">
                O arquivo permanece em memoria local e e descartado ao sair ou limpar esta tela.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Uso experimental: nao realize medicoes</p>
              <p className="mt-1 text-amber-800">
                Escala, orientacao espacial e traces privados da GE ainda nao foram homologados.
              </p>
            </div>
          </div>
        </div>

        {!study && (
          <section className="rounded-3xl border border-ink-100 bg-white p-5 shadow-fort-card sm:p-7">
            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
              className={`flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                isDragging
                  ? "border-vital-500 bg-vital-50"
                  : "border-ink-200 bg-ink-50 hover:border-vital-500 hover:bg-vital-50/60"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-11 w-11 animate-spin text-vital-600" />
                  <h2 className="mt-5 text-lg font-semibold text-ink-900">Lendo o cine localmente...</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-ink-500">
                    Arquivos grandes podem levar alguns segundos. Nenhum dado esta sendo enviado.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-vital-600 shadow-sm">
                    <Upload className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold text-ink-900">Selecione ou arraste o arquivo do Vivid iq</h2>
                  <p id="vivid-iq-file-help" className="mt-2 max-w-lg text-sm leading-6 text-ink-500">
                    O arquivo pode nao ter extensao. Limite local: 512 MB.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cordis-600 px-5 py-3 text-sm font-semibold text-white shadow-fort-soft transition hover:bg-cordis-700"
                  >
                    <FileVideo className="h-4 w-4" /> Escolher arquivo
                  </button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInput}
                aria-describedby="vivid-iq-file-help"
                className="sr-only"
              />
            </div>
          </section>
        )}

        {errorMessage && (
          <div role="alert" className="flex items-start justify-between gap-4 rounded-2xl border border-cordis-200 bg-cordis-50 p-4 text-sm text-cordis-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              aria-label="Fechar mensagem"
              className="rounded-lg p-1 hover:bg-cordis-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {study && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Equipamento</p>
                <p className="mt-2 text-sm font-semibold text-ink-900">{study.equipment}</p>
                <p className="mt-1 text-xs text-ink-500">{study.cineType}</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Cine</p>
                <p className="mt-2 text-lg font-bold text-ink-900">{study.frameCount.toLocaleString("pt-BR")} quadros</p>
                <p className="mt-1 text-xs text-ink-500">{study.width} x {study.height} px</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Duracao</p>
                <p className="mt-2 text-lg font-bold text-ink-900">{formatSeconds(study.durationSeconds)}</p>
                <p className="mt-1 text-xs text-ink-500">linha temporal do equipamento</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Taxa media</p>
                <p className="mt-2 text-lg font-bold text-ink-900">{study.frameRate.toFixed(1).replace(".", ",")} fps</p>
                <p className="mt-1 text-xs text-ink-500">estimada pelos timestamps</p>
              </div>
              <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Arquivo local</p>
                <p className="mt-2 text-lg font-bold text-ink-900">{formatBytes(study.fileSize)}</p>
                <p className="mt-1 text-xs text-ink-500">sem copia no servidor</p>
              </div>
            </section>

            {study.warnings.map((warning) => (
              <div key={warning} className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0" /> {warning}
              </div>
            ))}

            <section className="overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-fort-card">
              <div
                ref={canvasStageRef}
                className="flex min-h-72 items-center justify-center bg-black p-3 sm:p-6"
              >
                <canvas
                  ref={canvasRef}
                  aria-label={`Cine do Vivid iq, quadro ${frameIndex + 1} de ${study.frameCount}`}
                  className="block h-auto max-h-[68vh] w-full max-w-6xl bg-black object-contain"
                  style={{ aspectRatio: `${study.width} / ${study.height}` }}
                />
              </div>

              <div className="space-y-5 p-4 sm:p-6">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-4 text-xs font-medium text-ink-500">
                    <span>{formatSeconds(currentSeconds)}</span>
                    <span>Quadro {frameIndex + 1} de {study.frameCount}</span>
                    <span>{formatSeconds(study.durationSeconds)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={study.frameCount - 1}
                    value={frameIndex}
                    onChange={(event) => {
                      stopPlayback();
                      goToFrame(Number(event.target.value));
                    }}
                    aria-label="Posicao no cine"
                    className="h-2 w-full cursor-pointer accent-cordis-600"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopPlayback();
                      goToFrame(0);
                    }}
                    aria-label="Primeiro quadro"
                    className="rounded-xl border border-ink-200 p-2.5 text-ink-700 hover:bg-ink-50"
                  >
                    <ChevronsLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepFrame(-1)}
                    aria-label="Quadro anterior"
                    className="rounded-xl border border-ink-200 p-2.5 text-ink-700 hover:bg-ink-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-cordis-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cordis-700"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    {isPlaying ? "Pausar" : "Reproduzir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => stepFrame(1)}
                    aria-label="Proximo quadro"
                    className="rounded-xl border border-ink-200 p-2.5 text-ink-700 hover:bg-ink-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopPlayback();
                      goToFrame(study.frameCount - 1);
                    }}
                    aria-label="Ultimo quadro"
                    className="rounded-xl border border-ink-200 p-2.5 text-ink-700 hover:bg-ink-50"
                  >
                    <ChevronsRight className="h-5 w-5" />
                  </button>
                  <label className="ml-0 flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-700 sm:ml-2">
                    <Gauge className="h-4 w-4" />
                    <span className="sr-only">Velocidade</span>
                    <select
                      value={playbackSpeed}
                      onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                      className="bg-transparent font-semibold outline-none"
                    >
                      {PLAYBACK_SPEEDS.map((speed) => (
                        <option key={speed} value={speed}>{speed}x</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 border-t border-ink-100 pt-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                  <label className="block">
                    <span className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-600">
                      <span className="flex items-center gap-2"><Sun className="h-4 w-4" /> Brilho</span>
                      <span>{brightness > 0 ? "+" : ""}{brightness}</span>
                    </span>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={brightness}
                      onChange={(event) => setBrightness(Number(event.target.value))}
                      className="h-2 w-full accent-vital-600"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-600">
                      <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Contraste</span>
                      <span>{contrast.toFixed(2).replace(".", ",")}x</span>
                    </span>
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.05}
                      value={contrast}
                      onChange={(event) => setContrast(Number(event.target.value))}
                      className="h-2 w-full accent-vital-600"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={resetImageAdjustments}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <RotateCcw className="h-4 w-4" /> Restaurar imagem
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
                  <button
                    type="button"
                    onClick={clearStudy}
                    className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <X className="h-4 w-4" /> Limpar exame
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void requestFullscreen()}
                      className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                    >
                      <Maximize2 className="h-4 w-4" /> Tela cheia
                    </button>
                    <button
                      type="button"
                      onClick={downloadCurrentFrame}
                      className="inline-flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-700"
                    >
                      <Download className="h-4 w-4" /> Baixar quadro PNG
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInput}
              className="sr-only"
              aria-label="Selecionar outro arquivo DICOM"
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
