"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import api from "@/lib/axios";
import {
  type AspectoEcoEstruturadoTeste,
  type PayloadEcoEstruturadoTeste,
  type PresetEcoEstruturadoTeste,
  ordenarAspectos,
} from "@/lib/ecocardiograma-estruturado-teste";
import {
  type EcocardiogramaEstruturadoPersistido,
  normalizarEcocardiogramaEstruturado,
} from "@/lib/ecocardiograma-estruturado";

interface EcocardiogramaEstruturadoEditorProps {
  value: EcocardiogramaEstruturadoPersistido;
  onChange: (next: EcocardiogramaEstruturadoPersistido) => void;
}

interface PresetForm {
  id?: number;
  label: string;
  key: string;
  patologia: string;
  grau: string;
  descricao: string;
  tags: string;
  ordem: string;
  selecoes: Record<string, string>;
}

type PresetSelecaoStatus = "matched" | "pending" | "empty" | "manual";

interface PresetDeteccaoInfo {
  status: PresetSelecaoStatus;
  textoAtual?: string;
}

interface ResultadoDeteccaoPreset {
  selecoes: Record<string, string>;
  deteccao: Record<string, PresetDeteccaoInfo>;
  totalComTexto: number;
  totalResolvido: number;
}

type OrigemAspectoStatus = "preset" | "alterado" | "manual" | "empty";

interface SincronizacaoFraseOptions {
  confirmar?: boolean;
  silencioso?: boolean;
  mostrarHintSucesso?: boolean;
  controlarLoading?: boolean;
}

function normalizarTagsInput(tags: string): string[] {
  return tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function criarSelecoesPresetVazias(
  aspectos: AspectoEcoEstruturadoTeste[]
): Record<string, string> {
  return aspectos.reduce<Record<string, string>>((acc, aspecto) => {
    acc[aspecto.key] = "";
    return acc;
  }, {});
}

function resumirTexto(texto?: string, limite = 120): string {
  const normalizado = String(texto || "").replace(/\s+/g, " ").trim();
  if (normalizado.length <= limite) {
    return normalizado;
  }
  return `${normalizado.slice(0, limite - 3)}...`;
}

function getSelecaoStatusLabel(status: PresetSelecaoStatus): string {
  switch (status) {
    case "matched":
      return "Reconhecido";
    case "pending":
      return "Pendente";
    case "manual":
      return "Manual";
    default:
      return "Sem texto";
  }
}

function getSelecaoStatusClasses(status: PresetSelecaoStatus): string {
  switch (status) {
    case "matched":
      return "border-green-200 bg-green-50 text-green-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "manual":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-500";
  }
}

function getOrigemAspectoLabel(status: OrigemAspectoStatus): string {
  switch (status) {
    case "preset":
      return "Do preset";
    case "alterado":
      return "Alterado";
    case "manual":
      return "Manual";
    default:
      return "Sem texto";
  }
}

function getOrigemAspectoClasses(status: OrigemAspectoStatus): string {
  switch (status) {
    case "preset":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "alterado":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "manual":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-500";
  }
}

function atualizarEstrutura(
  atual: EcocardiogramaEstruturadoPersistido,
  patch: Partial<EcocardiogramaEstruturadoPersistido>
): EcocardiogramaEstruturadoPersistido {
  return {
    ...atual,
    ...patch,
    updated_at: new Date().toISOString(),
  };
}

export default function EcocardiogramaEstruturadoEditor({
  value,
  onChange,
}: EcocardiogramaEstruturadoEditorProps) {
  const [payload, setPayload] = useState<PayloadEcoEstruturadoTeste | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [presetSelecionadoId, setPresetSelecionadoId] = useState("");
  const [fraseSelecionadaPorAspecto, setFraseSelecionadaPorAspecto] = useState<Record<string, string>>(
    {}
  );
  const [aplicandoPreset, setAplicandoPreset] = useState(false);
  const [salvandoPreset, setSalvandoPreset] = useState(false);
  const [atualizandoPresetSelecionado, setAtualizandoPresetSelecionado] = useState(false);
  const [propagandoFrasesSelecionadas, setPropagandoFrasesSelecionadas] = useState(false);
  const [atualizandoFraseAspecto, setAtualizandoFraseAspecto] = useState<string | null>(null);
  const [salvandoNovaFraseAspecto, setSalvandoNovaFraseAspecto] = useState<string | null>(null);
  const [presetFormAberto, setPresetFormAberto] = useState(false);
  const [filtroAspectosPreset, setFiltroAspectosPreset] = useState<"all" | "pending">("all");
  const [presetDeteccao, setPresetDeteccao] = useState<Record<string, PresetDeteccaoInfo>>({});
  const [presetForm, setPresetForm] = useState<PresetForm>({
    label: "",
    key: "",
    patologia: "",
    grau: "",
    descricao: "",
    tags: "",
    ordem: "",
    selecoes: {},
  });

  const estado = normalizarEcocardiogramaEstruturado(value);

  const carregarPayload = async (silencioso = false) => {
    try {
      setError("");
      setHint("");
      if (silencioso) {
        setReloading(true);
      } else {
        setLoading(true);
      }
      const response = await api.get("/frases-ecocardiograma-estruturado-teste");
      setPayload(response.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Nao foi possivel carregar o banco estruturado de ecocardiograma."
      );
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => {
    carregarPayload();
  }, []);

  const aspectos = useMemo(
    () => ordenarAspectos(payload?.aspectos || []),
    [payload]
  );

  const presets = useMemo(
    () =>
      [...(payload?.presets || [])]
        .filter((preset) => Number(preset.ativo ?? 1) === 1)
        .sort((a, b) => {
          if ((a.ordem || 999) !== (b.ordem || 999)) {
            return (a.ordem || 999) - (b.ordem || 999);
          }
          return (a.label || "").localeCompare(b.label || "");
        }),
    [payload]
  );
  const totalPendentes = useMemo(
    () =>
      aspectos.filter((aspecto) => presetDeteccao[aspecto.key]?.status === "pending").length,
    [aspectos, presetDeteccao]
  );
  const aspectosFormularioPreset = useMemo(
    () =>
      filtroAspectosPreset === "pending"
        ? aspectos.filter((aspecto) => presetDeteccao[aspecto.key]?.status === "pending")
        : aspectos,
    [aspectos, filtroAspectosPreset, presetDeteccao]
  );

  const presetAtual = useMemo(
    () => presets.find((preset) => String(preset.id) === presetSelecionadoId) || null,
    [presets, presetSelecionadoId]
  );
  const presetAplicado = useMemo(
    () => presets.find((preset) => preset.id === estado.preset_id) || null,
    [presets, estado.preset_id]
  );
  const origemAspectos = useMemo(
    () =>
      aspectos.reduce<Record<string, OrigemAspectoStatus>>((acc, aspecto) => {
        const textoAtual = String(estado.textos[aspecto.key] || "").trim();
        const textoPreset = String(estado.preset_textos?.[aspecto.key] || "").trim();
        if (!textoAtual) {
          acc[aspecto.key] = "empty";
        } else if (textoPreset && textoAtual === textoPreset) {
          acc[aspecto.key] = "preset";
        } else if (textoPreset && textoAtual !== textoPreset) {
          acc[aspecto.key] = "alterado";
        } else {
          acc[aspecto.key] = "manual";
        }
        return acc;
      }, {}),
    [aspectos, estado.preset_textos, estado.textos]
  );
  const resumoOrigem = useMemo(() => {
    return aspectos.reduce(
      (acc, aspecto) => {
        const status = origemAspectos[aspecto.key];
        if (status === "preset") acc.preset += 1;
        if (status === "alterado") acc.alterado += 1;
        if (status === "manual") acc.manual += 1;
        return acc;
      },
      { preset: 0, alterado: 0, manual: 0 }
    );
  }, [aspectos, origemAspectos]);
  const fraseSelecionadaEfetivaPorAspecto = useMemo(
    () =>
      aspectos.reduce<Record<string, string>>((acc, aspecto) => {
        const frasesAtivas = (aspecto.frases || []).filter(
          (frase) => Number(frase.ativo ?? 1) === 1
        );

        const selecaoExplicita = String(fraseSelecionadaPorAspecto[aspecto.key] || "").trim();
        if (
          selecaoExplicita &&
          frasesAtivas.some((frase) => String(frase.id) === selecaoExplicita)
        ) {
          acc[aspecto.key] = selecaoExplicita;
          return acc;
        }

        const textoAtual = String(estado.textos[aspecto.key] || "").trim();
        const frasePorTexto = frasesAtivas.find(
          (frase) => String(frase.texto || "").trim() === textoAtual
        );
        if (frasePorTexto?.id) {
          acc[aspecto.key] = String(frasePorTexto.id);
          return acc;
        }

        const selecaoPreset =
          (presetAplicado?.selecoes_resolvidas || []).find(
            (selecao) => selecao.aspecto === aspecto.key && selecao.frase_id
          ) ||
          (presetAplicado?.selecoes || []).find((selecao) => selecao.aspecto === aspecto.key);

        if (selecaoPreset?.frase_id) {
          const frasePorId = frasesAtivas.find(
            (frase) => Number(frase.id) === Number(selecaoPreset.frase_id)
          );
          if (frasePorId?.id) {
            acc[aspecto.key] = String(frasePorId.id);
            return acc;
          }
        }

        if (selecaoPreset?.frase_titulo) {
          const frasePorTitulo = frasesAtivas.find(
            (frase) =>
              String(frase.titulo || "").trim() === String(selecaoPreset.frase_titulo || "").trim()
          );
          if (frasePorTitulo?.id) {
            acc[aspecto.key] = String(frasePorTitulo.id);
            return acc;
          }
        }

        acc[aspecto.key] = "";
        return acc;
      }, {}),
    [aspectos, estado.textos, fraseSelecionadaPorAspecto, presetAplicado]
  );

  useEffect(() => {
    if (!presets.length) {
      setPresetSelecionadoId("");
      return;
    }

    if (estado.preset_id && presets.some((preset) => preset.id === estado.preset_id)) {
      setPresetSelecionadoId(String(estado.preset_id));
      return;
    }

    setPresetSelecionadoId((prev) =>
      prev && presets.some((preset) => String(preset.id) === prev)
        ? prev
        : String(presets[0].id)
    );
  }, [presets, estado.preset_id]);

  useEffect(() => {
    setPresetForm((prev) => ({
      ...prev,
      selecoes: Object.keys(prev.selecoes || {}).length
        ? { ...criarSelecoesPresetVazias(aspectos), ...prev.selecoes }
        : criarSelecoesPresetVazias(aspectos),
    }));
  }, [aspectos]);

  const limparFormularioPreset = () => {
    setFiltroAspectosPreset("all");
    setPresetDeteccao({});
    setPresetForm({
      label: "",
      key: "",
      patologia: "",
      grau: "",
      descricao: "",
      tags: "",
      ordem: "",
      selecoes: criarSelecoesPresetVazias(aspectos),
    });
  };

  const carregarPresetNoFormulario = (
    preset: PresetEcoEstruturadoTeste,
    modo: "edit" | "duplicate"
  ) => {
    const selecoes = criarSelecoesPresetVazias(aspectos);
    (preset.selecoes || []).forEach((selecao) => {
      if (selecao.aspecto) {
        selecoes[selecao.aspecto] =
          selecao.frase_titulo || (selecao.frase_id ? String(selecao.frase_id) : "");
      }
    });

    const sufixo = modo === "duplicate" ? " copia" : "";
    const statusBase = aspectos.reduce<Record<string, PresetDeteccaoInfo>>((acc, aspecto) => {
      const temSelecao = Boolean(selecoes[aspecto.key]);
      acc[aspecto.key] = { status: temSelecao ? "manual" : "empty" };
      return acc;
    }, {});
    setFiltroAspectosPreset("all");
    setPresetDeteccao(statusBase);
    setPresetForm({
      id: modo === "edit" ? preset.id : undefined,
      label: `${preset.label || ""}${sufixo}`.trim(),
      key: modo === "edit" ? preset.key || "" : "",
      patologia: preset.patologia || "",
      grau: preset.grau || "",
      descricao: preset.descricao || "",
      tags: (preset.tags || []).join(", "),
      ordem: String(preset.ordem || ""),
      selecoes,
    });
    setPresetFormAberto(true);
  };

  const aplicarPreset = async (modo: "merge" | "reset") => {
    if (!presetSelecionadoId) {
      return;
    }

    try {
      setAplicandoPreset(true);
      setError("");
      const response = await api.post(
        `/frases-ecocardiograma-estruturado-teste/presets/${presetSelecionadoId}/aplicar`
      );

      const textos = response.data?.textos || {};
      const preset = response.data?.preset || {};
      const selecoesResolvidas: Array<{ aspecto?: string; frase_id?: number | string | null }> =
        Array.isArray(response.data?.selecoes_resolvidas)
        ? response.data.selecoes_resolvidas
        : [];
      setFraseSelecionadaPorAspecto(
        selecoesResolvidas.reduce((acc: Record<string, string>, selecao) => {
          if (selecao?.aspecto && selecao?.frase_id != null) {
            acc[String(selecao.aspecto)] = String(selecao.frase_id);
          }
          return acc;
        }, {})
      );
      onChange(
        atualizarEstrutura(estado, {
          preset_id: Number(preset.id || presetSelecionadoId),
          preset_label: String(preset.label || ""),
          preset_textos: { ...textos },
          textos:
            modo === "reset"
              ? { ...textos }
              : { ...estado.textos, ...textos },
        })
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || "Nao foi possivel aplicar o preset selecionado."
      );
    } finally {
      setAplicandoPreset(false);
    }
  };

  const abrirNovoPreset = () => {
    setError("");
    setHint("");
    limparFormularioPreset();
    setPresetFormAberto(true);
  };

  const detectarSelecaoAtualParaPreset = (): ResultadoDeteccaoPreset => {
    const selecoes = criarSelecoesPresetVazias(aspectos);
    const deteccao: Record<string, PresetDeteccaoInfo> = {};
    let totalComTexto = 0;
    let totalResolvido = 0;

    aspectos.forEach((aspecto) => {
      const textoAtual = String(estado.textos[aspecto.key] || "").trim();
      if (!textoAtual) {
        deteccao[aspecto.key] = { status: "empty" };
        return;
      }

      totalComTexto += 1;
      const frase = (aspecto.frases || []).find(
        (item) =>
          Number(item.ativo ?? 1) === 1 &&
          String(item.texto || "").trim() === textoAtual
      );

      if (frase?.titulo) {
        selecoes[aspecto.key] = frase.titulo;
        deteccao[aspecto.key] = { status: "matched", textoAtual };
        totalResolvido += 1;
      } else {
        deteccao[aspecto.key] = { status: "pending", textoAtual };
      }
    });

    return {
      selecoes,
      deteccao,
      totalComTexto,
      totalResolvido,
    };
  };

  const criarPresetDaSelecaoAtual = () => {
    const { selecoes, deteccao, totalComTexto, totalResolvido } =
      detectarSelecaoAtualParaPreset();

    const labelBase = presetAtual?.label?.trim() || "Novo preset";
    setPresetDeteccao(deteccao);
    setPresetForm({
      id: undefined,
      label: `${labelBase} copia`.trim(),
      key: "",
      patologia: presetAtual?.patologia || "",
      grau: presetAtual?.grau || "",
      descricao: "Preset criado a partir da selecao atual do laudo.",
      tags: (presetAtual?.tags || []).join(", "),
      ordem: presetAtual?.ordem ? String(presetAtual.ordem) : "",
      selecoes,
    });
    setPresetFormAberto(true);
    setError("");

    if (totalComTexto === 0) {
      setFiltroAspectosPreset("all");
      setHint("Nao ha textos estruturados preenchidos para converter em preset.");
      return;
    }

    if (totalResolvido < totalComTexto) {
      setFiltroAspectosPreset("pending");
      setHint(
        `Preset preenchido parcialmente: ${totalResolvido} de ${totalComTexto} aspectos bateram exatamente com frases do banco.`
      );
      return;
    }

    setFiltroAspectosPreset("all");
    setHint(`Preset preenchido automaticamente com ${totalResolvido} aspectos reconhecidos.`);
  };

  const atualizarPresetSelecionadoComSelecaoAtual = async () => {
    if (!presetAtual) {
      return;
    }

    const { selecoes, deteccao, totalComTexto, totalResolvido } =
      detectarSelecaoAtualParaPreset();

    setPresetDeteccao(deteccao);
    setError("");

    if (totalComTexto === 0) {
      setFiltroAspectosPreset("all");
      setHint("Nao ha textos estruturados preenchidos para atualizar o preset.");
      return;
    }

    if (totalResolvido < totalComTexto) {
      setFiltroAspectosPreset("pending");
      setPresetForm({
        id: presetAtual.id,
        label: presetAtual.label || "",
        key: presetAtual.key || "",
        patologia: presetAtual.patologia || "",
        grau: presetAtual.grau || "",
        descricao: presetAtual.descricao || "",
        tags: (presetAtual.tags || []).join(", "),
        ordem: presetAtual.ordem ? String(presetAtual.ordem) : "",
        selecoes,
      });
      setPresetFormAberto(true);
      setHint(
        `Nao foi possivel atualizar diretamente. ${totalResolvido} de ${totalComTexto} aspectos bateram com frases do banco. Resolva os pendentes e salve o preset.`
      );
      return;
    }

    const selecoesPayload = Object.entries(selecoes)
      .map(([aspecto, referencia]) => {
        const valor = String(referencia || "").trim();
        if (!valor) {
          return null;
        }

        const aspectoItem = aspectos.find((item) => item.key === aspecto);
        const frase = (aspectoItem?.frases || []).find((item) => {
          const titulo = String(item.titulo || "").trim();
          return titulo === valor || String(item.id) === valor;
        });

        return {
          aspecto,
          frase_id: frase?.id,
          frase_titulo: frase?.titulo || valor,
        };
      })
      .filter(Boolean);

    if (!selecoesPayload.length) {
      setHint("Nao ha selecoes validas para atualizar o preset.");
      return;
    }

    try {
      setAtualizandoPresetSelecionado(true);
      await api.put(
        `/frases-ecocardiograma-estruturado-teste/presets/${presetAtual.id}`,
        {
          label: presetAtual.label || "",
          key: presetAtual.key || "",
          patologia: presetAtual.patologia || "",
          grau: presetAtual.grau || "",
          descricao: presetAtual.descricao || "",
          tags: presetAtual.tags || [],
          ordem: presetAtual.ordem,
          selecoes: selecoesPayload,
        }
      );
      await carregarPayload(true);
      const presetTextosAtualizados = Object.entries(estado.textos).reduce<Record<string, string>>(
        (acc, [aspecto, texto]) => {
          const valor = String(texto || "").trim();
          if (valor) {
            acc[aspecto] = valor;
          }
          return acc;
        },
        {}
      );
      onChange(
        atualizarEstrutura(estado, {
          preset_id: presetAtual.id,
          preset_label: presetAtual.label || "",
          preset_textos: presetTextosAtualizados,
        })
      );
      setFiltroAspectosPreset("all");
      setHint(`Preset "${presetAtual.label}" atualizado com a selecao atual do laudo.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Nao foi possivel atualizar o preset selecionado.");
    } finally {
      setAtualizandoPresetSelecionado(false);
    }
  };

  const salvarPreset = async () => {
    const label = presetForm.label.trim();
    if (!label) {
      setError("Informe o nome do preset.");
      return;
    }

    const selecoes = Object.entries(presetForm.selecoes || {})
      .map(([aspecto, referencia]) => {
        const valor = String(referencia || "").trim();
        if (!valor) {
          return null;
        }

        const aspectoItem = aspectos.find((item) => item.key === aspecto);
        const frase = (aspectoItem?.frases || []).find((item) => {
          const titulo = String(item.titulo || "").trim();
          return titulo === valor || String(item.id) === valor;
        });

        return {
          aspecto,
          frase_id: frase?.id,
          frase_titulo: frase?.titulo || valor,
        };
      })
      .filter(Boolean);

    if (selecoes.length === 0) {
      setError("Selecione pelo menos uma frase para o preset.");
      return;
    }

    try {
      setSalvandoPreset(true);
      setError("");
      setHint("");
      const payloadPreset = {
        label,
        key: presetForm.key.trim(),
        patologia: presetForm.patologia.trim(),
        grau: presetForm.grau.trim(),
        descricao: presetForm.descricao.trim(),
        tags: normalizarTagsInput(presetForm.tags),
        ordem: presetForm.ordem.trim() ? Number(presetForm.ordem) : undefined,
        selecoes,
      };

      if (presetForm.id) {
        await api.put(
          `/frases-ecocardiograma-estruturado-teste/presets/${presetForm.id}`,
          payloadPreset
        );
      } else {
        await api.post(
          "/frases-ecocardiograma-estruturado-teste/presets",
          payloadPreset
        );
      }

      await carregarPayload(true);
      setPresetFormAberto(false);
      limparFormularioPreset();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Nao foi possivel salvar o preset.");
    } finally {
      setSalvandoPreset(false);
    }
  };

  const excluirPreset = async () => {
    if (!presetAtual) {
      return;
    }
    if (!window.confirm(`Excluir o preset "${presetAtual.label}"?`)) {
      return;
    }

    try {
      setError("");
      setHint("");
      await api.delete(
        `/frases-ecocardiograma-estruturado-teste/presets/${presetAtual.id}`
      );
      await carregarPayload(true);
      if (presetForm.id === presetAtual.id) {
        setPresetFormAberto(false);
        limparFormularioPreset();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Nao foi possivel excluir o preset.");
    }
  };

  const aplicarFraseDoAspecto = (aspecto: AspectoEcoEstruturadoTeste) => {
    const fraseId = fraseSelecionadaEfetivaPorAspecto[aspecto.key];
    const frase = (aspecto.frases || []).find(
      (item) => String(item.id) === fraseId && Number(item.ativo ?? 1) === 1
    );
    if (!frase) {
      return;
    }

    onChange(
      atualizarEstrutura(estado, {
        textos: {
          ...estado.textos,
          [aspecto.key]: String(frase.texto || "").trim(),
        },
      })
    );
  };

  const atualizarTextoFraseNoPayloadLocal = (
    aspectoKey: string,
    fraseId: number,
    textoAtualizado: string
  ) => {
    setPayload((atual) => {
      if (!atual) {
        return atual;
      }
      return {
        ...atual,
        aspectos: (atual.aspectos || []).map((aspecto) => {
          if (aspecto.key !== aspectoKey) {
            return aspecto;
          }
          return {
            ...aspecto,
            frases: (aspecto.frases || []).map((frase) =>
              Number(frase.id) === Number(fraseId)
                ? {
                    ...frase,
                    texto: textoAtualizado,
                  }
                : frase
            ),
          };
        }),
      };
    });
  };

  const sincronizarFraseSelecionadaDoAspecto = async (
    aspecto: AspectoEcoEstruturadoTeste,
    options: SincronizacaoFraseOptions = {}
  ): Promise<boolean> => {
    const {
      confirmar = false,
      silencioso = false,
      mostrarHintSucesso = false,
      controlarLoading = false,
    } = options;

    const fraseId = String(fraseSelecionadaEfetivaPorAspecto[aspecto.key] || "").trim();
    if (!fraseId) {
      if (!silencioso) {
        setError(`Selecione uma frase em ${aspecto.label} antes de atualizar o banco.`);
      }
      return false;
    }

    const frase = (aspecto.frases || []).find(
      (item) => String(item.id) === fraseId && Number(item.ativo ?? 1) === 1
    );
    if (!frase?.id) {
      if (!silencioso) {
        setError(`Nao foi possivel localizar a frase selecionada em ${aspecto.label}.`);
      }
      return false;
    }

    const textoAtual = String(estado.textos[aspecto.key] || "").trim();
    if (!textoAtual) {
      if (!silencioso) {
        setError(`O texto de ${aspecto.label} esta vazio.`);
      }
      return false;
    }

    const textoBanco = String(frase.texto || "").trim();
    if (textoBanco === textoAtual) {
      return false;
    }

    if (confirmar) {
      const confirmarAtualizacao = window.confirm(
        `Atualizar a frase "${frase.titulo}" no banco com o texto atual de ${aspecto.label}?`
      );
      if (!confirmarAtualizacao) {
        return false;
      }
    }

    try {
      if (controlarLoading) {
        setAtualizandoFraseAspecto(aspecto.key);
      }
      if (!silencioso) {
        setError("");
        setHint("");
      }
      await api.put(`/frases-ecocardiograma-estruturado-teste/frases/${frase.id}`, {
        aspecto: aspecto.key,
        titulo: String(frase.titulo || "").trim(),
        texto: textoAtual,
        tags: Array.isArray(frase.tags) ? frase.tags : [],
      });

      atualizarTextoFraseNoPayloadLocal(aspecto.key, Number(frase.id), textoAtual);
      if (mostrarHintSucesso) {
        setHint(`Frase "${frase.titulo}" atualizada no banco para ${aspecto.label}.`);
      }
      return true;
    } catch (err: any) {
      if (!silencioso) {
        setError(err?.response?.data?.detail || "Nao foi possivel atualizar a frase do banco.");
      } else {
        console.error("Falha ao sincronizar frase automaticamente:", err);
      }
      return false;
    } finally {
      if (controlarLoading) {
        setAtualizandoFraseAspecto(null);
      }
    }
  };

  const atualizarFraseDoBanco = async (aspecto: AspectoEcoEstruturadoTeste) => {
    await sincronizarFraseSelecionadaDoAspecto(aspecto, {
      confirmar: true,
      mostrarHintSucesso: true,
      controlarLoading: true,
    });
  };

  const propagarTextosSelecionadosParaBanco = async () => {
    if (!presetAtual) {
      return;
    }

    const confirmar = window.confirm(
      "Atualizar no banco as frases selecionadas com os textos atuais? Isso afeta todos os presets que usam essas frases."
    );
    if (!confirmar) {
      return;
    }

    try {
      setPropagandoFrasesSelecionadas(true);
      setError("");
      setHint("");

      let totalAtualizado = 0;

      for (const aspecto of aspectos) {
        const atualizado = await sincronizarFraseSelecionadaDoAspecto(aspecto, {
          silencioso: true,
        });
        if (atualizado) {
          totalAtualizado += 1;
        }
      }

      if (totalAtualizado === 0) {
        setHint("Nenhuma frase precisou de atualizacao no banco.");
      } else {
        setHint(
          `${totalAtualizado} frase(s) atualizada(s) no banco. A mudanca vale para todos os presets que usam essas frases.`
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Nao foi possivel propagar as frases para o banco.");
    } finally {
      setPropagandoFrasesSelecionadas(false);
    }
  };

  const salvarNovaFraseDoAspecto = async (aspecto: AspectoEcoEstruturadoTeste) => {
    const textoAtual = String(estado.textos[aspecto.key] || "").trim();
    if (!textoAtual) {
      setError(`O texto de ${aspecto.label} esta vazio.`);
      return;
    }

    const tituloPadrao =
      aspecto.key === "conclusao" ? "Nova conclusao personalizada" : `Nova frase - ${aspecto.label}`;
    const tituloInformado = window.prompt(
      `Titulo da nova frase para ${aspecto.label}:`,
      tituloPadrao
    );
    const titulo = String(tituloInformado || "").trim();
    if (!titulo) {
      return;
    }

    const tagsInformadas = window.prompt(
      "Tags opcionais separadas por virgula:",
      aspecto.key === "conclusao" ? "conclusao, personalizado" : ""
    );

    try {
      setSalvandoNovaFraseAspecto(aspecto.key);
      setError("");
      setHint("");
      const response = await api.post("/frases-ecocardiograma-estruturado-teste/frases", {
        aspecto: aspecto.key,
        titulo,
        texto: textoAtual,
        tags: normalizarTagsInput(String(tagsInformadas || "")),
      });
      const novaFraseId = String(response.data?.id || "").trim();
      await carregarPayload(true);
      if (novaFraseId) {
        setFraseSelecionadaPorAspecto((prev) => ({
          ...prev,
          [aspecto.key]: novaFraseId,
        }));
      }
      setHint(`Frase "${titulo}" salva no banco em ${aspecto.label}.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Nao foi possivel salvar a nova frase.");
    } finally {
      setSalvandoNovaFraseAspecto(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando ecocardiograma estruturado...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="font-medium text-gray-900">Ecocardiograma estruturado</h4>
          <p className="text-sm text-gray-600">
            Presets e frases por aspecto. Quando ativo, os blocos legados abaixo passam
            a ser gerados a partir desta estrutura. Voce pode editar qualquer texto e
            salvar como nova frase, inclusive no aspecto Conclusao. Ao sair do campo,
            a frase selecionada eh sincronizada automaticamente no banco.
          </p>
        </div>
        <button
          type="button"
          onClick={() => carregarPayload(true)}
          disabled={reloading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
          Recarregar banco
        </button>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-blue-200 bg-white p-3">
        <input
          type="checkbox"
          checked={estado.usar_no_laudo}
          onChange={(e) =>
            onChange(
              atualizarEstrutura(estado, {
                usar_no_laudo: e.target.checked,
              })
            )
          }
          className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
        />
        <span className="text-sm text-gray-700">
          Usar o estruturado para preencher o laudo oficial.
        </span>
      </label>

      {estado.preset_label ? (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <span className="font-medium text-gray-900">Preset ativo:</span> {estado.preset_label}
          <span className="ml-3 text-gray-500">
            {resumoOrigem.preset} do preset, {resumoOrigem.alterado} alterado, {resumoOrigem.manual} manual
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <select
          value={presetSelecionadoId}
          onChange={(e) => setPresetSelecionadoId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Selecione um preset</option>
          {presets.map((preset) => (
            <option key={preset.id} value={String(preset.id)}>
              {preset.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => aplicarPreset("merge")}
          disabled={!presetSelecionadoId || aplicandoPreset}
          className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm text-teal-700 hover:bg-teal-50 disabled:opacity-50"
        >
          Aplicar sobre atual
        </button>
        <button
          type="button"
          onClick={() => aplicarPreset("reset")}
          disabled={!presetSelecionadoId || aplicandoPreset}
          className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          Zerar e aplicar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={abrirNovoPreset}
          className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm text-teal-700 hover:bg-teal-50"
        >
          Novo preset
        </button>
        <button
          type="button"
          onClick={criarPresetDaSelecaoAtual}
          className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
        >
          Criar preset da selecao atual
        </button>
        <button
          type="button"
          onClick={atualizarPresetSelecionadoComSelecaoAtual}
          disabled={!presetAtual || atualizandoPresetSelecionado}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          {atualizandoPresetSelecionado ? "Atualizando preset..." : "Atualizar preset"}
        </button>
        <button
          type="button"
          onClick={propagarTextosSelecionadosParaBanco}
          disabled={!presetAtual || propagandoFrasesSelecionadas}
          className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {propagandoFrasesSelecionadas ? "Propagando frases..." : "Propagar frases para banco"}
        </button>
        <button
          type="button"
          onClick={() => presetAtual && carregarPresetNoFormulario(presetAtual, "edit")}
          disabled={!presetAtual}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Editar preset
        </button>
        <button
          type="button"
          onClick={() => presetAtual && carregarPresetNoFormulario(presetAtual, "duplicate")}
          disabled={!presetAtual}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Duplicar preset
        </button>
        <button
          type="button"
          onClick={excluirPreset}
          disabled={!presetAtual}
          className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Excluir preset
        </button>
      </div>

      {presetFormAberto ? (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h5 className="text-sm font-medium text-gray-900">
              {presetForm.id ? "Editar preset" : "Novo preset"}
            </h5>
            <button
              type="button"
              onClick={() => {
                setPresetFormAberto(false);
                limparFormularioPreset();
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Fechar
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={presetForm.label}
              onChange={(e) => setPresetForm((prev) => ({ ...prev, label: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="Nome do preset"
            />
            <input
              value={presetForm.key}
              onChange={(e) => setPresetForm((prev) => ({ ...prev, key: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="Chave opcional"
            />
            <input
              value={presetForm.patologia}
              onChange={(e) => setPresetForm((prev) => ({ ...prev, patologia: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="Patologia"
            />
            <input
              value={presetForm.grau}
              onChange={(e) => setPresetForm((prev) => ({ ...prev, grau: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="Grau"
            />
            <input
              value={presetForm.tags}
              onChange={(e) => setPresetForm((prev) => ({ ...prev, tags: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 md:col-span-2"
              placeholder="Tags separadas por virgula"
            />
            <input
              value={presetForm.ordem}
              onChange={(e) => setPresetForm((prev) => ({ ...prev, ordem: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="Ordem"
            />
            <textarea
              value={presetForm.descricao}
              onChange={(e) => setPresetForm((prev) => ({ ...prev, descricao: e.target.value }))}
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 md:col-span-2"
              placeholder="Descricao do preset"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-sm text-gray-600">
              Aspectos no formulario:{" "}
              <span className="font-medium text-gray-900">
                {aspectosFormularioPreset.length}
              </span>
              {filtroAspectosPreset === "pending" ? (
                <span className="text-gray-500"> de {aspectos.length}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroAspectosPreset("all")}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  filtroAspectosPreset === "all"
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroAspectosPreset("pending")}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  filtroAspectosPreset === "pending"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Pendentes ({totalPendentes})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {!aspectosFormularioPreset.length && filtroAspectosPreset === "pending" ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Nao ha aspectos pendentes neste preset.
              </div>
            ) : null}

            {aspectosFormularioPreset.map((aspecto) => {
              const frasesAtivas = (aspecto.frases || []).filter(
                (frase) => Number(frase.ativo ?? 1) === 1
              );
              const deteccao = presetDeteccao[aspecto.key] || { status: "empty" as PresetSelecaoStatus };
              return (
                <div key={aspecto.key} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <label className="text-sm font-medium text-gray-700">{aspecto.label}</label>
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getSelecaoStatusClasses(
                        deteccao.status
                      )}`}
                    >
                      {getSelecaoStatusLabel(deteccao.status)}
                    </span>
                  </div>
                  <select
                    value={presetForm.selecoes?.[aspecto.key] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPresetForm((prev) => ({
                        ...prev,
                        selecoes: {
                          ...prev.selecoes,
                          [aspecto.key]: value,
                        },
                      }));
                      setPresetDeteccao((prev) => ({
                        ...prev,
                        [aspecto.key]: {
                          status: value ? "manual" : deteccao.textoAtual ? "pending" : "empty",
                          textoAtual: deteccao.textoAtual,
                        },
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Sem frase</option>
                    {frasesAtivas.map((frase) => (
                      <option key={frase.id} value={frase.titulo}>
                        {frase.titulo}
                      </option>
                    ))}
                  </select>
                  {deteccao.status === "pending" && deteccao.textoAtual ? (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Texto atual nao reconhecido automaticamente: &quot;{resumirTexto(deteccao.textoAtual)}&quot;
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={salvarPreset}
              disabled={salvandoPreset}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {salvandoPreset ? "Salvando..." : presetForm.id ? "Atualizar preset" : "Salvar preset"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPresetFormAberto(false);
                limparFormularioPreset();
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {hint ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {hint}
        </div>
      ) : null}

      <div className="space-y-4">
        {aspectos.map((aspecto) => {
          const frasesAtivas = (aspecto.frases || []).filter(
            (frase) => Number(frase.ativo ?? 1) === 1
          );
          return (
            <div key={aspecto.key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm font-medium text-gray-900">{aspecto.label}</div>
                  <span
                    className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getOrigemAspectoClasses(
                      origemAspectos[aspecto.key]
                    )}`}
                  >
                    {getOrigemAspectoLabel(origemAspectos[aspecto.key])}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{aspecto.placeholder}</div>
              </div>
              <div className="mb-3 flex flex-col gap-2 lg:flex-row">
                <select
                  value={fraseSelecionadaEfetivaPorAspecto[aspecto.key] || ""}
                  onChange={(e) =>
                    setFraseSelecionadaPorAspecto((prev) => ({
                      ...prev,
                      [aspecto.key]: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Selecionar frase do banco</option>
                  {frasesAtivas.map((frase) => (
                    <option key={frase.id} value={String(frase.id)}>
                      {frase.titulo}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => aplicarFraseDoAspecto(aspecto)}
                    disabled={!fraseSelecionadaEfetivaPorAspecto[aspecto.key]}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Usar frase
                  </button>
                  <button
                    type="button"
                    onClick={() => atualizarFraseDoBanco(aspecto)}
                    disabled={
                      !fraseSelecionadaEfetivaPorAspecto[aspecto.key] ||
                      !String(estado.textos[aspecto.key] || "").trim() ||
                      atualizandoFraseAspecto === aspecto.key
                    }
                    className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    {atualizandoFraseAspecto === aspecto.key
                      ? "Atualizando..."
                      : "Atualizar frase"}
                  </button>
                  <button
                    type="button"
                    onClick={() => salvarNovaFraseDoAspecto(aspecto)}
                    disabled={
                      !String(estado.textos[aspecto.key] || "").trim() ||
                      salvandoNovaFraseAspecto === aspecto.key
                    }
                    className="rounded-lg border border-teal-300 px-3 py-2 text-sm text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                  >
                    {salvandoNovaFraseAspecto === aspecto.key
                      ? "Salvando..."
                      : "Salvar como nova frase"}
                  </button>
                </div>
              </div>
              <textarea
                value={estado.textos[aspecto.key] || ""}
                onChange={(e) =>
                  onChange(
                    atualizarEstrutura(estado, {
                      textos: {
                        ...estado.textos,
                        [aspecto.key]: e.target.value,
                      },
                    })
                  )
                }
                onBlur={() => {
                  void sincronizarFraseSelecionadaDoAspecto(aspecto, {
                    silencioso: true,
                  });
                }}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                placeholder={aspecto.placeholder}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
