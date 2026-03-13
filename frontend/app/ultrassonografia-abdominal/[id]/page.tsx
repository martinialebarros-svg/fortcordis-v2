"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../layout-dashboard";
import api from "@/lib/axios";
import {
  getLaudoEditPath,
  getLaudoViewPath,
  TIPO_LAUDO_ULTRASSOM_ABDOMINAL,
} from "@/lib/laudos";
import { baixarLaudoPdf } from "@/lib/laudo-pdf";
import {
  getOrgaosVisiveis,
  normalizarSexoPaciente,
} from "@/lib/ultrassonografia-abdominal";
import { ArrowLeft, Download, Edit, Loader2 } from "lucide-react";

interface ImagemPreview {
  id: number;
  nome: string;
  dataUrl: string;
}

export default function VisualizarUltrassonografiaAbdominalPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [laudo, setLaudo] = useState<any>(null);
  const [imagens, setImagens] = useState<ImagemPreview[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarLaudo();
  }, [router, params.id]);

  const carregarLaudo = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/laudos/${params.id}`);
      if (response.data.tipo !== TIPO_LAUDO_ULTRASSOM_ABDOMINAL) {
        router.replace(getLaudoViewPath(params.id, response.data.tipo));
        return;
      }
      setLaudo(response.data);
      await carregarImagens(response.data.imagens || []);
    } catch (error) {
      console.error("Erro ao carregar laudo:", error);
      alert("Nao foi possivel carregar o laudo.");
      router.push("/ultrassonografia-abdominal");
    } finally {
      setLoading(false);
    }
  };

  const carregarImagens = async (imagensApi: Array<any>) => {
    const token = localStorage.getItem("token");
    const previews = await Promise.all(
      imagensApi.map(async (imagem) => {
        try {
          const response = await fetch(`/api/v1${imagem.url}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!response.ok) {
            throw new Error("Falha ao carregar imagem.");
          }
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") {
                resolve(reader.result);
                return;
              }
              reject(new Error("Falha ao ler imagem."));
            };
            reader.onerror = () => reject(reader.error || new Error("Falha ao ler imagem."));
            reader.readAsDataURL(blob);
          });
          return {
            id: imagem.id,
            nome: imagem.nome,
            dataUrl,
          };
        } catch (error) {
          console.error("Erro ao preparar imagem:", error);
          return null;
        }
      })
    );
    setImagens(previews.filter(Boolean) as ImagemPreview[]);
  };

  const downloadPDF = async () => {
    try {
      await baixarLaudoPdf(Number(params.id), `ultrassonografia_abdominal_${params.id}.pdf`);
    } catch (error) {
      console.error("Erro ao baixar PDF:", error);
      alert("Nao foi possivel baixar o PDF.");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-gray-500">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-teal-600" />
          Carregando laudo...
        </div>
      </DashboardLayout>
    );
  }

  if (!laudo) {
    return null;
  }

  const sexoPaciente = laudo.ultrassonografia_abdominal?.sexo_paciente || laudo.paciente?.sexo || "Macho";
  const orgaos = getOrgaosVisiveis(sexoPaciente);
  const qualitativa = laudo.ultrassonografia_abdominal?.qualitativa || {};
  const observacoes = laudo.ultrassonografia_abdominal?.observacoes_gerais || laudo.observacoes || "";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/ultrassonografia-abdominal")}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Laudo de Ultrassonografia Abdominal</h1>
              <p className="text-gray-500">{laudo.paciente?.nome || "Paciente"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => router.push(getLaudoEditPath(params.id, laudo.tipo))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
            >
              <Edit className="w-4 h-4" />
              Editar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Paciente</span><p className="font-medium">{laudo.paciente?.nome || "N/A"}</p></div>
            <div><span className="text-gray-500">Tutor</span><p className="font-medium">{laudo.paciente?.tutor || "N/A"}</p></div>
            <div><span className="text-gray-500">Especie</span><p className="font-medium">{laudo.paciente?.especie || "N/A"}</p></div>
            <div><span className="text-gray-500">Raca</span><p className="font-medium">{laudo.paciente?.raca || "N/A"}</p></div>
            <div><span className="text-gray-500">Sexo</span><p className="font-medium">{normalizarSexoPaciente(sexoPaciente)}</p></div>
            <div><span className="text-gray-500">Peso</span><p className="font-medium">{laudo.paciente?.peso_kg ? `${laudo.paciente.peso_kg} kg` : "N/A"}</p></div>
            <div><span className="text-gray-500">Idade</span><p className="font-medium">{laudo.paciente?.idade || "N/A"}</p></div>
            <div><span className="text-gray-500">Data</span><p className="font-medium">{new Date(laudo.data_exame || laudo.data_laudo).toLocaleDateString("pt-BR")}</p></div>
            <div><span className="text-gray-500">Clinica</span><p className="font-medium">{laudo.clinica || "N/A"}</p></div>
            <div><span className="text-gray-500">Veterinario</span><p className="font-medium">{laudo.medico_solicitante || "N/A"}</p></div>
            <div><span className="text-gray-500">Status</span><p className="font-medium">{laudo.status}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Avaliacao Qualitativa</h2>
          {orgaos.map((orgao) => {
            const texto = qualitativa[orgao.key];
            if (!texto) {
              return null;
            }
            return (
              <div key={orgao.key} className="border-b last:border-b-0 pb-4 last:pb-0">
                <h3 className="font-semibold text-gray-900 mb-1">{orgao.label}</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{texto}</p>
              </div>
            );
          })}

          {observacoes && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-1">Observacoes gerais</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{observacoes}</p>
            </div>
          )}
        </div>

        {imagens.length > 0 && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Imagens</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imagens.map((imagem) => (
                <div key={imagem.id} className="border rounded-xl overflow-hidden">
                  <img src={imagem.dataUrl} alt={imagem.nome} className="w-full h-64 object-cover" />
                  <div className="p-3 text-sm text-gray-600">{imagem.nome}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
