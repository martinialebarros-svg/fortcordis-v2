"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  getLaudoViewPath,
  TIPO_LAUDO_ELETROCARDIOGRAMA,
  TIPO_LAUDO_PRESSAO_ARTERIAL,
  TIPO_LAUDO_ULTRASSOM_ABDOMINAL,
} from "@/lib/laudos";
import { baixarLaudoPdf, baixarLaudoPdfOriginal } from "@/lib/laudo-pdf";
import { ArrowLeft, CheckCircle, Download, FileText, Loader2, Printer, Send, Upload } from "lucide-react";

const PORTAL_RELEASE_STATUS = "Liberado no portal";

function isPortalReleased(status?: string) {
  return status === PORTAL_RELEASE_STATUS;
}

interface Paciente {
  id: number;
  nome: string;
  especie: string;
  raca: string;
  sexo: string;
  peso_kg: number;
  idade?: string;
  tutor?: string;
  telefone?: string;
}

interface Laudo {
  id: number;
  paciente_id: number;
  paciente?: Paciente;
  tipo: string;
  titulo: string;
  descricao: string;
  diagnostico: string;
  observacoes: string;
  status: string;
  data_laudo: string;
  data_exame?: string;
  clinica?: string;
  clinic_id?: number | null;
  criado_por_nome: string;
  pdf_externo?: {
    anexo_id?: number;
    nome_original?: string;
  } | null;
  pressao_arterial?: {
    pas_1?: number | null;
    pas_2?: number | null;
    pas_3?: number | null;
    pas_media?: number | null;
    metodo?: string | null;
    manguito?: string | null;
    membro?: string | null;
    decubito?: string | null;
    obs_extra?: string | null;
  } | null;
}

export default function VisualizarLaudoPage() {
  const router = useRouter();
  const routeParams = useParams<{ id?: string | string[] }>();
  const laudoId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const [loading, setLoading] = useState(true);
  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [medidas, setMedidas] = useState<Record<string, string>>({});
  const [qualitativa, setQualitativa] = useState<Record<string, string>>({});
  const [liberandoPortal, setLiberandoPortal] = useState(false);
  const [arquivoSubstituicao, setArquivoSubstituicao] = useState<File | null>(null);
  const [substituindoPdf, setSubstituindoPdf] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const laudoEhEletrocardiograma = laudo?.tipo === TIPO_LAUDO_ELETROCARDIOGRAMA;
  const laudoEhPressao = laudo?.tipo === TIPO_LAUDO_PRESSAO_ARTERIAL;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    if (!laudoId) return;
    carregarLaudo();
  }, [router, laudoId]);

  const carregarLaudo = async () => {
    if (!laudoId) return;
    try {
      setLoading(true);

      // Carregar laudo
      const respLaudo = await api.get(`/laudos/${laudoId}`);
      if (respLaudo.data.tipo === TIPO_LAUDO_ULTRASSOM_ABDOMINAL) {
        router.replace(getLaudoViewPath(laudoId, respLaudo.data.tipo));
        return;
      }
      setLaudo(respLaudo.data);

      // Carregar dados do paciente (agora vem no laudo)
      if (respLaudo.data.paciente) {
        setPaciente(respLaudo.data.paciente);
      } else if (respLaudo.data.paciente_id) {
        // Fallback: buscar paciente separadamente (para laudos antigos)
        try {
          const respPaciente = await api.get(`/pacientes/${respLaudo.data.paciente_id}`);
          setPaciente(respPaciente.data);
        } catch (e) {
          console.error("Erro ao carregar paciente:", e);
        }
      }

      // Extrair medidas e qualitativa da descrição
      if (respLaudo.data.descricao) {
        const descricao = respLaudo.data.descricao;

        // Extrair medidas (formato: - DIVEd: 1.50)
        // Regex atualizada para capturar nomes com underscores
        const medidasExtraidas: Record<string, string> = {};
        const regexMedidas = /-\s*([\w_]+):\s*([\d.]+)/g;
        let match;
        while ((match = regexMedidas.exec(descricao)) !== null) {
          medidasExtraidas[match[1]] = match[2];
        }
        setMedidas(medidasExtraidas);

        // Extrair qualitativa
        const qualitativaExtraida: Record<string, string> = {};
        const regexQualitativa = /-\s*(valvas|camaras|funcao|pericardio|vasos|ad_vd):\s*(.+?)(?=\n-|$)/gi;
        while ((match = regexQualitativa.exec(descricao)) !== null) {
          qualitativaExtraida[match[1].toLowerCase()] = match[2].trim();
        }
        setQualitativa(qualitativaExtraida);
      }
    } catch (error) {
      console.error("Erro ao carregar laudo:", error);
      alert("Erro ao carregar laudo.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!laudoId) return;
    try {
      if (laudo?.tipo === TIPO_LAUDO_ELETROCARDIOGRAMA) {
        return await baixarLaudoPdfOriginal(Number(laudoId), laudo.pdf_externo?.nome_original || `eletrocardiograma_${laudoId}.pdf`);
      }
      return await baixarLaudoPdf(Number(laudoId), `laudo_${laudoId}.pdf`);
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/v1/laudos/${laudoId}/pdf`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Erro ao baixar PDF');
      }

      // Extrair nome do arquivo do header Content-Disposition
      let filename = `laudo_${laudoId}.pdf`;
      const contentDisposition = response.headers.get('content-disposition');

      if (contentDisposition) {
        // Regex que aceita tanto filename="..." quanto filename=...
        const match = contentDisposition?.match(/filename="?([^";\s]+)"?/);
        if (match?.[1]) {
          filename = match?.[1] || filename;
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao baixar PDF.');
    }
  };

  const imprimir = () => {
    window.print();
  };

  const liberarNoPortalClinica = async () => {
    if (!laudo || !laudoId || isPortalReleased(laudo.status)) {
      return;
    }
    if (!laudo.clinic_id) {
      alert("Vincule uma clinica ao laudo antes de liberar no portal.");
      return;
    }
    if (!confirm("Liberar este laudo para o portal da clinica parceira?")) {
      return;
    }

    setLiberandoPortal(true);
    try {
      const response = await api.post(`/laudos/${laudoId}/portal/liberar-clinica`);
      setLaudo((current) =>
        current ? { ...current, status: response.data?.status || PORTAL_RELEASE_STATUS } : current
      );
      alert("Laudo liberado no portal da clinica parceira.");
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      alert(detail || "Erro ao liberar laudo no portal. Tente novamente.");
    } finally {
      setLiberandoPortal(false);
    }
  };

  const selecionarPdfSubstituto = (file: File | null) => {
    if (!file) {
      setArquivoSubstituicao(null);
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      alert("Selecione um arquivo PDF.");
      setArquivoSubstituicao(null);
      setFileInputKey((current) => current + 1);
      return;
    }

    setArquivoSubstituicao(file);
  };

  const substituirPdfEletrocardiograma = async () => {
    if (!laudoId || !laudoEhEletrocardiograma) {
      return;
    }
    if (!arquivoSubstituicao) {
      alert("Selecione o novo PDF antes de substituir.");
      return;
    }

    const confirmMessage = isPortalReleased(laudo?.status)
      ? "Este laudo ja foi liberado no portal. Deseja trocar o PDF e atualizar imediatamente o arquivo baixavel da clinica parceira?"
      : "Deseja substituir o PDF anexado a este laudo de eletrocardiograma?";
    if (!confirm(confirmMessage)) {
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", arquivoSubstituicao);

    setSubstituindoPdf(true);
    try {
      await api.put(`/laudos/${laudoId}/eletrocardiograma/pdf`, formData);
      setArquivoSubstituicao(null);
      setFileInputKey((current) => current + 1);
      await carregarLaudo();
      alert(
        isPortalReleased(laudo?.status)
          ? "PDF substituido e portal atualizado."
          : "PDF substituido com sucesso.",
      );
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      alert(detail || "Erro ao substituir PDF do eletrocardiograma.");
    } finally {
      setSubstituindoPdf(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="fc-report-view-page">
          <div className="fc-report-loading"><span aria-hidden="true" />Carregando laudo...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!laudo) {
    return (
      <DashboardLayout>
        <div className="fc-report-view-page">
          <div className="fc-report-empty">
          <h1 className="text-2xl font-bold text-gray-900">Laudo não encontrado</h1>
          <p className="text-gray-500 mt-2">O laudo solicitado não existe ou foi removido.</p>
          <button
            type="button"
            onClick={() => router.push("/laudos")}
            className="fc-report-editor-save mt-4"
          >
            Voltar para Laudos
          </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="fc-report-view-page">
        <header className="fc-report-view-header">
          <div className="fc-report-editor-heading">
            <button
              type="button"
              onClick={() => router.push("/laudos")}
              className="fc-report-editor-back"
              aria-label="Voltar para laudos"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <span className="fc-report-editor-kicker">
                <FileText className="h-4 w-4" />
                Documento clínico
              </span>
              <h1>Visualizar laudo</h1>
              <p>{laudo.titulo}</p>
            </div>
          </div>

          <div className="fc-report-view-actions">
            <button
              type="button"
              onClick={liberarNoPortalClinica}
              disabled={liberandoPortal || isPortalReleased(laudo.status)}
              className={`fc-report-view-portal ${isPortalReleased(laudo.status) ? "fc-report-view-portal-released" : ""}`}
              title={
                isPortalReleased(laudo.status)
                  ? "Laudo ja liberado no portal"
                  : "Liberar no portal da clinica"
              }
            >
              {isPortalReleased(laudo.status) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isPortalReleased(laudo.status)
                ? "No portal"
                : liberandoPortal
                  ? "Liberando..."
                  : "Liberar portal"}
            </button>
            <button
              type="button"
              onClick={downloadPDF}
              className="fc-report-view-pdf"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={imprimir}
              className="fc-report-view-print"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
        </header>

        {/* Conteúdo do Laudo */}
        <article className="fc-report-view-document print:shadow-none print:border-none">
          {/* Cabeçalho do Laudo */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900">
              {laudoEhEletrocardiograma
                ? "LAUDO DE ELETROCARDIOGRAMA"
                : laudoEhPressao
                  ? "LAUDO DE PRESSAO ARTERIAL"
                  : "LAUDO ECOCARDIOGRAFICO"}
            </h2>
            <div className="w-full h-px bg-gray-300 mt-4"></div>
          </div>

          {/* Dados do Paciente */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Dados do Paciente</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nome:</span>
                <p className="font-medium">{paciente?.nome || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Espécie:</span>
                <p className="font-medium">{paciente?.especie || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Raça:</span>
                <p className="font-medium">{paciente?.raca || "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-500">Sexo:</span>
                <p className="font-medium">{paciente?.sexo || "N/A"}</p>
              </div>
              {paciente?.peso_kg && (
                <div>
                  <span className="text-gray-500">Peso:</span>
                  <p className="font-medium">{paciente.peso_kg} kg</p>
                </div>
              )}
              {paciente?.idade && (
                <div>
                  <span className="text-gray-500">Idade:</span>
                  <p className="font-medium">{paciente.idade}</p>
                </div>
              )}
              {paciente?.tutor && (
                <div>
                  <span className="text-gray-500">Tutor:</span>
                  <p className="font-medium">{paciente.tutor}</p>
                </div>
              )}
              {paciente?.telefone && (
                <div>
                  <span className="text-gray-500">Telefone:</span>
                  <p className="font-medium">{paciente.telefone}</p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Data do Exame:</span>
                <p className="font-medium">
                  {new Date(laudo.data_exame || laudo.data_laudo).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {laudo.clinica && (
                <div>
                  <span className="text-gray-500">Clínica:</span>
                  <p className="font-medium">{laudo.clinica}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="mb-6">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              laudo.status === PORTAL_RELEASE_STATUS
                ? 'bg-teal-100 text-teal-800'
                : laudo.status === 'Finalizado'
                ? 'bg-green-100 text-green-800'
                : laudo.status === 'Rascunho'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
              {laudo.status}
            </span>
          </div>

          {laudoEhEletrocardiograma && (
            <div className="mb-6 rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
              <p className="font-semibold">PDF original anexado</p>
              <p className="mt-1">
                Use o botao PDF para baixar o eletrocardiograma enviado. A liberacao para o portal da clinica fica no botao Liberar portal.
              </p>
              <div className="mt-4 rounded-lg border border-teal-200 bg-white/70 p-4">
                <p className="text-sm font-semibold text-slate-900">Trocar arquivo do eletrocardiograma</p>
                <p className="mt-1 text-sm text-slate-600">
                  {laudo.pdf_externo?.nome_original
                    ? `Arquivo atual: ${laudo.pdf_externo.nome_original}`
                    : "Nenhum PDF externo encontrado para este laudo."}
                </p>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => selecionarPdfSubstituto(event.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={substituirPdfEletrocardiograma}
                    disabled={substituindoPdf || !arquivoSubstituicao}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {substituindoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {substituindoPdf ? "Substituindo..." : "Trocar PDF"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {isPortalReleased(laudo.status)
                    ? "Como este laudo ja esta no portal, a troca atualiza imediatamente o arquivo disponivel para a clinica parceira."
                    : "A troca atualiza o PDF deste laudo sem criar um novo registro."}
                </p>
              </div>
            </div>
          )}

          {laudoEhPressao && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Resumo da afericao de pressao arterial</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-amber-700">PAS 1</span>
                  <p className="mt-1 font-medium">{laudo.pressao_arterial?.pas_1 ?? "-"} mmHg</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-amber-700">PAS 2</span>
                  <p className="mt-1 font-medium">{laudo.pressao_arterial?.pas_2 ?? "-"} mmHg</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-amber-700">PAS 3</span>
                  <p className="mt-1 font-medium">{laudo.pressao_arterial?.pas_3 ?? "-"} mmHg</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-amber-700">Media</span>
                  <p className="mt-1 font-medium">{laudo.pressao_arterial?.pas_media ?? "-"} mmHg</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <span className="text-xs uppercase tracking-wide text-amber-700">Metodo</span>
                  <p className="mt-1">{laudo.pressao_arterial?.metodo || "Doppler"}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide text-amber-700">Manguito</span>
                  <p className="mt-1">{laudo.pressao_arterial?.manguito || "-"}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide text-amber-700">Membro / decubito</span>
                  <p className="mt-1">
                    {[laudo.pressao_arterial?.membro, laudo.pressao_arterial?.decubito].filter(Boolean).join(" · ") || "-"}
                  </p>
                </div>
              </div>
              {laudo.pressao_arterial?.obs_extra ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-amber-700">Observacoes da afericao</span>
                  <p className="mt-1 whitespace-pre-wrap">{laudo.pressao_arterial.obs_extra}</p>
                </div>
              ) : null}
            </div>
          )}

          {/* Medidas */}
          {!laudoEhPressao && Object.keys(medidas).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Medidas Ecocardiográficas</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-700">Parâmetro</th>
                      <th className="text-left py-2 font-medium text-gray-700">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(medidas).map(([chave, valor]) => (
                      <tr key={chave} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 text-gray-600">{chave}</td>
                        <td className="py-2 font-medium">{valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Qualitativa */}
          {!laudoEhPressao && Object.keys(qualitativa).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Avaliação Qualitativa</h3>
              <div className="space-y-3">
                {Object.entries(qualitativa).map(([chave, valor]) => (
                  <div key={chave} className="bg-gray-50 rounded-lg p-3">
                    <span className="font-medium text-gray-700 capitalize">{chave}:</span>
                    <p className="text-gray-600 mt-1">{valor}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusão */}
          {laudo.diagnostico && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Conclusão</h3>
              <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
                {laudo.diagnostico}
              </div>
            </div>
          )}

          {/* Observações */}
          {laudo.observacoes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Observações</h3>
              <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">
                {laudo.observacoes}
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Laudo emitido por {laudo.criado_por_nome || "Médico Veterinário"}</p>
            <p className="mt-1">
              Documento gerado eletronicamente em{' '}
              {new Date(laudo.data_laudo).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </article>
      </div>
    </DashboardLayout>
  );
}
