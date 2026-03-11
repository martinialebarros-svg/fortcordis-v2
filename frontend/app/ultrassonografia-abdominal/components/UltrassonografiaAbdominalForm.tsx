"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import ImageUploader from "@/app/laudos/components/ImageUploader";
import {
  FraseUltrassomAbdominal,
  ORGAO_OBSERVACOES_GERAIS,
  ORGAOS_ULTRASSOM_ABDOMINAL,
  getLabelFrase,
  getOrgaosVisiveis,
  fraseCompativelComSexo,
  normalizarSexoPaciente,
} from "@/lib/ultrassonografia-abdominal";
import {
  getLaudoViewPath,
  TIPO_LAUDO_ULTRASSOM_ABDOMINAL,
} from "@/lib/laudos";
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Save,
  Stethoscope,
  Trash2,
} from "lucide-react";

interface PacienteForm {
  id?: number;
  nome: string;
  tutor: string;
  telefone: string;
  especie: string;
  raca: string;
  sexo: string;
  peso: string;
  idade: string;
  data_exame: string;
}

interface Clinica {
  id: number;
  nome: string;
}

interface ImagemForm {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
  dataUrl: string;
  tamanho: number;
  uploaded: boolean;
  persisted?: boolean;
  serverId?: number;
  tempId?: number;
  file?: File;
}

type AbaAtiva = "cliente" | "qualitativa" | "frases" | "imagens";

const ABAS: Array<{ id: AbaAtiva; label: string }> = [
  { id: "cliente", label: "Cliente" },
  { id: "qualitativa", label: "Qualitativa" },
  { id: "frases", label: "Frases" },
  { id: "imagens", label: "Imagens" },
];

const SEXOS_FRASE = ["Todos", "Macho", "Femea"];

function criarQualitativaInicial() {
  return ORGAOS_ULTRASSOM_ABDOMINAL.reduce<Record<string, string>>((acc, orgao) => {
    acc[orgao.key] = "";
    return acc;
  }, {});
}

function gerarSessionId() {
  return Math.random().toString(36).slice(2, 15);
}

function obterTituloLaudo(nomePaciente: string) {
  return `Laudo de Ultrassonografia Abdominal - ${nomePaciente || "Paciente"}`;
}

async function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string" && reader.result) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Falha ao converter imagem."));
    };
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler imagem."));
    reader.readAsDataURL(blob);
  });
}

function campoTexto(
  label: string,
  value: string,
  onChange: (value: string) => void,
  placeholder?: string,
  type = "text"
) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
        placeholder={placeholder}
      />
    </div>
  );
}

export default function UltrassonografiaAbdominalForm({
  mode,
  laudoId,
}: {
  mode: "create" | "edit";
  laudoId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [aba, setAba] = useState<AbaAtiva>("cliente");
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState("Finalizado");
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [clinicaId, setClinicaId] = useState("");
  const [clinicaNome, setClinicaNome] = useState("");
  const [veterinario, setVeterinario] = useState("");
  const [agendamentoId, setAgendamentoId] = useState<number | null>(null);
  const [paciente, setPaciente] = useState<PacienteForm>({
    nome: "",
    tutor: "",
    telefone: "",
    especie: "Canina",
    raca: "",
    sexo: "Macho",
    peso: "",
    idade: "",
    data_exame: "",
  });
  const [qualitativa, setQualitativa] = useState<Record<string, string>>(criarQualitativaInicial);
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const [imagens, setImagens] = useState<ImagemForm[]>([]);
  const [frases, setFrases] = useState<FraseUltrassomAbdominal[]>([]);
  const [loadingFrases, setLoadingFrases] = useState(false);
  const [filtroFrases, setFiltroFrases] = useState("");
  const [buscaFrases, setBuscaFrases] = useState("");
  const [fraseSelecionadaPorCampo, setFraseSelecionadaPorCampo] = useState<Record<string, string>>({});
  const [fraseForm, setFraseForm] = useState({
    id: undefined as number | undefined,
    orgao: "figado",
    sexo: "Todos",
    titulo: "",
    texto: "",
  });

  useEffect(() => {
    setSessionId(gerarSessionId());
    setPaciente((prev) => ({
      ...prev,
      data_exame: prev.data_exame || new Date().toISOString().split("T")[0],
    }));

    const clinicaParam = searchParams.get("clinica_id");
    if (clinicaParam) {
      setClinicaId(clinicaParam);
    }

    const agendamentoParam = searchParams.get("agendamento_id");
    if (agendamentoParam) {
      const value = Number(agendamentoParam);
      if (Number.isFinite(value) && value > 0) {
        setAgendamentoId(value);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    carregarClinicas();
    carregarFrases();
  }, []);

  useEffect(() => {
    if (mode === "edit" && laudoId) {
      carregarLaudo(laudoId);
    }
  }, [mode, laudoId]);

  useEffect(() => {
    const sexo = normalizarSexoPaciente(paciente.sexo);
    setQualitativa((prev) => {
      const next = { ...prev };
      if (sexo === "Macho") {
        next.utero = "";
        next.ovarios = "";
      } else {
        next.prostata = "";
        next.testiculos = "";
      }
      return next;
    });
  }, [paciente.sexo]);

  const carregarClinicas = async () => {
    try {
      const response = await api.get("/clinicas");
      setClinicas(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar clinicas:", error);
    }
  };

  const carregarFrases = async () => {
    try {
      setLoadingFrases(true);
      const response = await api.get("/frases-ultrassom-abdominal", {
        params: { ativo: 1, limit: 500 },
      });
      setFrases(response.data.items || []);
    } catch (error) {
      console.error("Erro ao carregar frases:", error);
      setFrases([]);
    } finally {
      setLoadingFrases(false);
    }
  };

  const carregarImagensPersistidas = async (imagensApi: any[]) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const previews = await Promise.all(
      (imagensApi || []).map(async (imagem, index) => {
        try {
          const response = await fetch(`/api/v1${imagem.url}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!response.ok) {
            throw new Error("Falha ao carregar imagem.");
          }

          const blob = await response.blob();
          return {
            id: `persisted-${imagem.id}`,
            nome: imagem.nome,
            descricao: imagem.descricao || "",
            ordem: typeof imagem.ordem === "number" ? imagem.ordem : index,
            dataUrl: await blobParaDataUrl(blob),
            tamanho: imagem.tamanho || blob.size,
            uploaded: true,
            persisted: true,
            serverId: imagem.id,
          } satisfies ImagemForm;
        } catch (error) {
          console.error("Erro ao carregar imagem persistida:", error);
          return null;
        }
      })
    );

    setImagens(previews.filter(Boolean) as ImagemForm[]);
  };

  const carregarLaudo = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/laudos/${id}`);
      const laudo = response.data;

      if (laudo.tipo !== TIPO_LAUDO_ULTRASSOM_ABDOMINAL) {
        router.replace(getLaudoViewPath(id, laudo.tipo));
        return;
      }

      const ultrassom = laudo.ultrassonografia_abdominal || {};
      const sexoPaciente = ultrassom.sexo_paciente || laudo.paciente?.sexo || "Macho";

      setPaciente({
        id: laudo.paciente?.id,
        nome: laudo.paciente?.nome || "",
        tutor: laudo.paciente?.tutor || "",
        telefone: laudo.paciente?.telefone || "",
        especie: laudo.paciente?.especie || "Canina",
        raca: laudo.paciente?.raca || "",
        sexo: sexoPaciente,
        peso: laudo.paciente?.peso_kg ? String(laudo.paciente.peso_kg) : "",
        idade: laudo.paciente?.idade || "",
        data_exame: laudo.data_exame ? laudo.data_exame.slice(0, 10) : new Date().toISOString().split("T")[0],
      });
      setStatus(laudo.status || "Finalizado");
      setClinicaId(laudo.clinic_id ? String(laudo.clinic_id) : "");
      setClinicaNome(laudo.clinica || "");
      setVeterinario(laudo.medico_solicitante || "");
      setAgendamentoId(laudo.agendamento_id || null);
      setObservacoesGerais(ultrassom.observacoes_gerais || laudo.observacoes || "");
      setQualitativa({
        ...criarQualitativaInicial(),
        ...(ultrassom.qualitativa || {}),
      });

      if (Array.isArray(laudo.imagens) && laudo.imagens.length > 0) {
        await carregarImagensPersistidas(laudo.imagens);
      } else {
        setImagens([]);
      }
    } catch (error) {
      console.error("Erro ao carregar laudo:", error);
      alert("Nao foi possivel carregar o laudo.");
      router.push("/ultrassonografia-abdominal");
    } finally {
      setLoading(false);
    }
  };

  const limparFormularioFrase = () => {
    setFraseForm({
      id: undefined,
      orgao: filtroFrases || "figado",
      sexo: "Todos",
      titulo: "",
      texto: "",
    });
  };

  const salvarFrase = async () => {
    if (!fraseForm.orgao || !fraseForm.texto.trim()) {
      alert("Informe o orgao e o texto da frase.");
      return;
    }

    try {
      if (fraseForm.id) {
        await api.put(`/frases-ultrassom-abdominal/${fraseForm.id}`, fraseForm);
      } else {
        await api.post("/frases-ultrassom-abdominal", fraseForm);
      }
      await carregarFrases();
      limparFormularioFrase();
    } catch (error: any) {
      console.error("Erro ao salvar frase:", error);
      alert(error?.response?.data?.detail || "Nao foi possivel salvar a frase.");
    }
  };

  const excluirFrase = async (id: number) => {
    if (!confirm("Deseja remover esta frase do banco?")) {
      return;
    }

    try {
      await api.delete(`/frases-ultrassom-abdominal/${id}`);
      await carregarFrases();
      if (fraseForm.id === id) {
        limparFormularioFrase();
      }
    } catch (error) {
      console.error("Erro ao excluir frase:", error);
      alert("Nao foi possivel excluir a frase.");
    }
  };

  const aplicarFraseAoCampo = (campo: string, fraseId: string) => {
    setFraseSelecionadaPorCampo((prev) => ({ ...prev, [campo]: fraseId }));
    if (!fraseId) {
      return;
    }

    const frase = frases.find((item) => String(item.id) === fraseId);
    if (!frase) {
      return;
    }

    if (campo === ORGAO_OBSERVACOES_GERAIS) {
      setObservacoesGerais(frase.texto);
      return;
    }

    setQualitativa((prev) => ({ ...prev, [campo]: frase.texto }));
  };

  const getFrasesDoCampo = (campo: string) =>
    frases.filter((frase) => frase.orgao === campo && fraseCompativelComSexo(frase.sexo, paciente.sexo));

  const frasesFiltradas = frases.filter((frase) => {
    if (filtroFrases && frase.orgao !== filtroFrases) {
      return false;
    }
    const termo = buscaFrases.trim().toLowerCase();
    if (!termo) {
      return true;
    }
    return (
      frase.orgao.toLowerCase().includes(termo) ||
      frase.titulo.toLowerCase().includes(termo) ||
      frase.texto.toLowerCase().includes(termo)
    );
  });

  const salvarLaudo = async () => {
    if (!paciente.nome.trim()) {
      alert("Informe o nome do paciente.");
      setAba("cliente");
      return;
    }

    const qualitativaPreenchida = Object.entries(qualitativa).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        const texto = value.trim();
        if (texto) {
          acc[key] = texto;
        }
        return acc;
      },
      {}
    );

    const payload = {
      titulo: obterTituloLaudo(paciente.nome.trim()),
      status,
      agendamento_id: agendamentoId,
      tipo_laudo: TIPO_LAUDO_ULTRASSOM_ABDOMINAL,
      paciente: {
        id: paciente.id,
        nome: paciente.nome.trim(),
        tutor: paciente.tutor.trim(),
        telefone: paciente.telefone.trim(),
        especie: paciente.especie,
        raca: paciente.raca.trim(),
        sexo: paciente.sexo,
        peso: paciente.peso.trim(),
        idade: paciente.idade.trim(),
        data_exame: paciente.data_exame,
      },
      qualitativa: qualitativaPreenchida,
      conteudo: { observacoes: observacoesGerais.trim() },
      clinica: clinicaId ? { id: Number(clinicaId), nome: clinicaNome } : clinicaNome,
      veterinario: { nome: veterinario.trim() },
      data_exame: paciente.data_exame,
      ultrassonografia_abdominal: {
        qualitativa: qualitativaPreenchida,
        observacoes_gerais: observacoesGerais.trim(),
        sexo_paciente: paciente.sexo,
      },
    };

    try {
      setSaving(true);
      const response =
        mode === "edit" && laudoId
          ? await api.put(`/laudos/${laudoId}`, payload)
          : await api.post("/laudos", payload);
      const idSalvo = Number(response.data?.id || laudoId);
      if (!Number.isFinite(idSalvo) || idSalvo <= 0) {
        throw new Error("Laudo salvo sem identificador valido.");
      }

      if (sessionId && imagens.some((imagem) => imagem.uploaded && !imagem.persisted)) {
        try {
          await api.post(`/imagens/associar/${idSalvo}?session_id=${sessionId}`);
        } catch (error) {
          console.error("Erro ao associar imagens:", error);
        }
      }

      alert("Laudo salvo com sucesso.");
      router.push(getLaudoViewPath(idSalvo, TIPO_LAUDO_ULTRASSOM_ABDOMINAL));
    } catch (error: any) {
      console.error("Erro ao salvar laudo:", error);
      alert(error?.response?.data?.detail || "Nao foi possivel salvar o laudo.");
    } finally {
      setSaving(false);
    }
  };

  const orgaosVisiveis = getOrgaosVisiveis(paciente.sexo);
  const opcoesBancoFrases = [
    ...ORGAOS_ULTRASSOM_ABDOMINAL,
    { key: ORGAO_OBSERVACOES_GERAIS, label: "Observacoes gerais" },
  ];

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-teal-600" />
        Carregando laudo...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/ultrassonografia-abdominal")}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === "edit" ? "Editar Ultrassonografia Abdominal" : "Nova Ultrassonografia Abdominal"}
            </h1>
            <p className="text-gray-500">Cliente, qualitativa, frases e imagens em um unico fluxo.</p>
            {agendamentoId && <p className="text-sm text-teal-700 mt-1">Agendamento vinculado: #{agendamentoId}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={salvarLaudo}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar laudo"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            className={`px-4 py-2 rounded-lg font-medium ${
              aba === item.id
                ? "bg-teal-100 text-teal-700"
                : "bg-white border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {aba === "cliente" && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campoTexto("Paciente *", paciente.nome, (value) => setPaciente((prev) => ({ ...prev, nome: value })), "Nome do paciente")}
            {campoTexto("Tutor", paciente.tutor, (value) => setPaciente((prev) => ({ ...prev, tutor: value })), "Nome do tutor")}
            {campoTexto("Telefone", paciente.telefone, (value) => setPaciente((prev) => ({ ...prev, telefone: value })), "Telefone")}
            {campoTexto("Raca", paciente.raca, (value) => setPaciente((prev) => ({ ...prev, raca: value })), "Raca")}
            {campoTexto("Peso (kg)", paciente.peso, (value) => setPaciente((prev) => ({ ...prev, peso: value })), "Ex: 12.5")}
            {campoTexto("Idade", paciente.idade, (value) => setPaciente((prev) => ({ ...prev, idade: value })), "Ex: 8a")}
            {campoTexto("Veterinario solicitante", veterinario, setVeterinario, "Nome do profissional")}
            {campoTexto("Data do exame", paciente.data_exame, (value) => setPaciente((prev) => ({ ...prev, data_exame: value })), undefined, "date")}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Especie</label>
              <select
                value={paciente.especie}
                onChange={(e) => setPaciente((prev) => ({ ...prev, especie: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="Canina">Canina</option>
                <option value="Felina">Felina</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
              <select
                value={normalizarSexoPaciente(paciente.sexo)}
                onChange={(e) => setPaciente((prev) => ({ ...prev, sexo: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="Macho">Macho</option>
                <option value="Femea">Femea</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinica</label>
              <select
                value={clinicaId}
                onChange={(e) => {
                  const value = e.target.value;
                  setClinicaId(value);
                  const selecionada = clinicas.find((item) => String(item.id) === value);
                  setClinicaNome(selecionada?.nome || "");
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Selecione uma clinica</option>
                {clinicas.map((clinica) => (
                  <option key={clinica.id} value={clinica.id}>
                    {clinica.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="Rascunho">Rascunho</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Arquivado">Arquivado</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {aba === "qualitativa" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center gap-2 text-gray-900 mb-2">
              <Stethoscope className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-semibold">Avaliacao Qualitativa</h2>
            </div>
            <p className="text-sm text-gray-500">
              Cada dropdown lista apenas as frases cadastradas para o orgao correspondente.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {orgaosVisiveis.map((orgao) => {
              const frasesDoCampo = getFrasesDoCampo(orgao.key);
              return (
                <div key={orgao.key} className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{orgao.label}</h3>
                      <p className="text-xs text-gray-500">{frasesDoCampo.length} frase(s) disponivel(is).</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAba("frases");
                        setFiltroFrases(orgao.key);
                        setFraseForm({
                          id: undefined,
                          orgao: orgao.key,
                          sexo: normalizarSexoPaciente(paciente.sexo),
                          titulo: "",
                          texto: "",
                        });
                      }}
                      className="text-sm text-teal-700 hover:text-teal-800"
                    >
                      Gerenciar frases
                    </button>
                  </div>

                  <select
                    value={fraseSelecionadaPorCampo[orgao.key] || ""}
                    onChange={(e) => aplicarFraseAoCampo(orgao.key, e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Selecionar frase cadastrada</option>
                    {frasesDoCampo.map((frase) => (
                      <option key={frase.id} value={frase.id}>
                        {getLabelFrase(frase)}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={qualitativa[orgao.key] || ""}
                    onChange={(e) => setQualitativa((prev) => ({ ...prev, [orgao.key]: e.target.value }))}
                    rows={6}
                    className="w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                    placeholder={`Descricao ultrassonografica para ${orgao.label.toLowerCase()}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">Observacoes gerais</h3>
                <p className="text-xs text-gray-500">Campo livre para observacoes finais do exame.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAba("frases");
                  setFiltroFrases(ORGAO_OBSERVACOES_GERAIS);
                  setFraseForm({
                    id: undefined,
                    orgao: ORGAO_OBSERVACOES_GERAIS,
                    sexo: "Todos",
                    titulo: "",
                    texto: "",
                  });
                }}
                className="text-sm text-teal-700 hover:text-teal-800"
              >
                Gerenciar frases
              </button>
            </div>

            <select
              value={fraseSelecionadaPorCampo[ORGAO_OBSERVACOES_GERAIS] || ""}
              onChange={(e) => aplicarFraseAoCampo(ORGAO_OBSERVACOES_GERAIS, e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Selecionar frase para observacoes gerais</option>
              {getFrasesDoCampo(ORGAO_OBSERVACOES_GERAIS).map((frase) => (
                <option key={frase.id} value={frase.id}>
                  {getLabelFrase(frase)}
                </option>
              ))}
            </select>

            <textarea
              value={observacoesGerais}
              onChange={(e) => setObservacoesGerais(e.target.value)}
              rows={5}
              className="w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
              placeholder="Observacoes complementares do exame"
            />
          </div>
        </div>
      )}

      {aba === "frases" && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-6">
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Banco de frases</h2>
              <button type="button" onClick={limparFormularioFrase} className="text-sm text-gray-600 hover:text-gray-900">
                Limpar
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orgao</label>
              <select
                value={fraseForm.orgao}
                onChange={(e) => setFraseForm((prev) => ({ ...prev, orgao: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                {opcoesBancoFrases.map((orgao) => (
                  <option key={orgao.key} value={orgao.key}>
                    {orgao.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sexo da frase</label>
              <select
                value={fraseForm.sexo}
                onChange={(e) => setFraseForm((prev) => ({ ...prev, sexo: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                {SEXOS_FRASE.map((sexo) => (
                  <option key={sexo} value={sexo}>
                    {sexo}
                  </option>
                ))}
              </select>
            </div>

            {campoTexto("Titulo curto", fraseForm.titulo, (value) => setFraseForm((prev) => ({ ...prev, titulo: value })), "Ex: Aspecto normal")}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto da frase</label>
              <textarea
                value={fraseForm.texto}
                onChange={(e) => setFraseForm((prev) => ({ ...prev, texto: e.target.value }))}
                rows={8}
                className="w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                placeholder="Digite a frase disponivel para este orgao"
              />
            </div>

            <button
              type="button"
              onClick={salvarFrase}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
            >
              <Save className="w-4 h-4" />
              {fraseForm.id ? "Atualizar frase" : "Salvar frase"}
            </button>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Frases cadastradas</h2>
                <p className="text-sm text-gray-500">Use os filtros para localizar e editar as frases por orgao.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={filtroFrases}
                  onChange={(e) => setFiltroFrases(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Todos os orgaos</option>
                  {opcoesBancoFrases.map((orgao) => (
                    <option key={orgao.key} value={orgao.key}>
                      {orgao.label}
                    </option>
                  ))}
                </select>
                <input
                  value={buscaFrases}
                  onChange={(e) => setBuscaFrases(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Buscar frase"
                />
              </div>
            </div>

            {loadingFrases ? (
              <div className="py-12 text-center text-gray-500">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-teal-600" />
                Carregando frases...
              </div>
            ) : frasesFiltradas.length === 0 ? (
              <div className="py-12 text-center text-gray-500">Nenhuma frase encontrada.</div>
            ) : (
              <div className="space-y-4 max-h-[720px] overflow-y-auto pr-1">
                {frasesFiltradas.map((frase) => (
                  <div key={frase.id} className="border rounded-xl p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 rounded-full bg-teal-100 text-teal-800">
                            {opcoesBancoFrases.find((item) => item.key === frase.orgao)?.label || frase.orgao}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            {frase.sexo || "Todos"}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900">{getLabelFrase(frase)}</h3>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{frase.texto}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFraseForm({
                              id: frase.id,
                              orgao: frase.orgao,
                              sexo: frase.sexo || "Todos",
                              titulo: frase.titulo || "",
                              texto: frase.texto || "",
                            })
                          }
                          className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirFrase(frase.id)}
                          className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {aba === "imagens" && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-900">
            <ImageIcon className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold">Imagens do Laudo</h2>
          </div>
          <p className="text-sm text-gray-500">Envie as imagens que devem acompanhar o laudo em PDF.</p>
          {sessionId ? (
            <ImageUploader
              onImagensChange={(novasImagens) => setImagens(novasImagens as ImagemForm[])}
              sessionId={sessionId}
              imagensIniciais={imagens}
            />
          ) : (
            <div className="py-10 text-center text-gray-500">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-teal-600" />
              Preparando upload de imagens...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
