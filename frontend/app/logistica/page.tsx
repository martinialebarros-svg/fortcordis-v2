"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Clock,
  MapPin,
  RefreshCw,
  Save,
} from "lucide-react";

import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";

type PerfilLogistica = "comercial" | "plantao";

interface ClinicaItem {
  id: number;
  nome: string;
}

interface DeslocamentoItem {
  id: number;
  origem_clinica_id: number;
  destino_clinica_id: number;
  perfil: string;
  distancia_km: number;
  duracao_min: number;
  fonte: string;
  manual_override: boolean;
  observacoes?: string | null;
  updated_at?: string | null;
}

interface MatrizResponse {
  perfil: string;
  total_clinicas: number;
  total_itens: number;
  clinicas: Array<{ id: number; nome: string }>;
  items: DeslocamentoItem[];
}

interface RecalculoResponse {
  ok: boolean;
  updated: number;
  skipped_manual: number;
  profiles: string[];
  total_celulas?: number;
}

interface ParResponse {
  origem: { id: number; nome: string | null };
  destino: { id: number; nome: string | null };
  item: DeslocamentoItem;
}

const PERFIS: PerfilLogistica[] = ["comercial", "plantao"];

const parseNumero = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function LogisticaPage() {
  const router = useRouter();

  const [loadingClinicas, setLoadingClinicas] = useState(true);
  const [clinicas, setClinicas] = useState<ClinicaItem[]>([]);
  const [erroTela, setErroTela] = useState("");

  const [perfil, setPerfil] = useState<PerfilLogistica>("comercial");
  const [incluirInativas, setIncluirInativas] = useState(false);

  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");

  const [matrizLoading, setMatrizLoading] = useState(false);
  const [matrizError, setMatrizError] = useState("");
  const [matrizItems, setMatrizItems] = useState<DeslocamentoItem[]>([]);
  const [matrizTotalClinicas, setMatrizTotalClinicas] = useState(0);

  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaError, setConsultaError] = useState("");
  const [consultaPar, setConsultaPar] = useState<ParResponse | null>(null);

  const [manualDuracaoMin, setManualDuracaoMin] = useState("30");
  const [manualDistanciaKm, setManualDistanciaKm] = useState("0");
  const [manualObservacoes, setManualObservacoes] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMensagem, setManualMensagem] = useState("");
  const [manualError, setManualError] = useState("");

  const [recalculoClinicaId, setRecalculoClinicaId] = useState("");
  const [recalculoForce, setRecalculoForce] = useState(false);
  const [recalculoLoading, setRecalculoLoading] = useState(false);
  const [recalculoMensagem, setRecalculoMensagem] = useState("");
  const [recalculoError, setRecalculoError] = useState("");

  const clinicaPorId = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of clinicas) {
      map.set(Number(c.id), c.nome);
    }
    return map;
  }, [clinicas]);

  const nomeClinica = (id: number) => clinicaPorId.get(Number(id)) || `Clinica #${id}`;

  const carregarClinicas = async () => {
    try {
      setLoadingClinicas(true);
      const response = await api.get("/clinicas?limit=1000");
      const payload = response?.data;
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : [];

      const normalizadas: ClinicaItem[] = items
        .filter((item: any) => Number.isFinite(Number(item?.id)))
        .map((item: any) => ({
          id: Number(item.id),
          nome: String(item.nome || `Clinica #${item.id}`),
        }));

      setClinicas(normalizadas);
      if (!origemId && normalizadas.length > 0) {
        setOrigemId(String(normalizadas[0].id));
      }
      if (!destinoId && normalizadas.length > 1) {
        setDestinoId(String(normalizadas[1].id));
      }
      if (!recalculoClinicaId && normalizadas.length > 0) {
        setRecalculoClinicaId("");
      }
    } catch (error) {
      console.error("Erro ao carregar clinicas para logistica:", error);
      setErroTela("Falha ao carregar clinicas.");
    } finally {
      setLoadingClinicas(false);
    }
  };

  const carregarMatriz = async () => {
    try {
      setMatrizLoading(true);
      setMatrizError("");

      const params = new URLSearchParams();
      params.set("perfil", perfil);
      params.set("incluir_inativas", incluirInativas ? "true" : "false");

      const origem = parseNumero(origemId);
      const destino = parseNumero(destinoId);
      const ids = [origem, destino].filter((id): id is number => id !== null && id > 0);
      const idsUnicos = Array.from(new Set(ids));
      for (const id of idsUnicos) {
        params.append("clinica_ids", String(id));
      }

      const response = await api.get<MatrizResponse>(`/logistica/matriz?${params.toString()}`);
      setMatrizItems(Array.isArray(response?.data?.items) ? response.data.items : []);
      setMatrizTotalClinicas(Number(response?.data?.total_clinicas || 0));
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setMatrizError(typeof detail === "string" ? detail : "Falha ao carregar matriz.");
    } finally {
      setMatrizLoading(false);
    }
  };

  const consultarPar = async (recalcular: boolean) => {
    const origem = parseNumero(origemId);
    const destino = parseNumero(destinoId);
    if (!origem || !destino) {
      setConsultaError("Selecione origem e destino.");
      setConsultaPar(null);
      return;
    }

    try {
      setConsultaLoading(true);
      setConsultaError("");
      const params = new URLSearchParams();
      params.set("origem_clinica_id", String(origem));
      params.set("destino_clinica_id", String(destino));
      params.set("perfil", perfil);
      params.set("recalcular", recalcular ? "true" : "false");
      const response = await api.get<ParResponse>(`/logistica/deslocamento?${params.toString()}`);
      setConsultaPar(response.data);
      setManualDuracaoMin(String(response?.data?.item?.duracao_min ?? 30));
      setManualDistanciaKm(String(response?.data?.item?.distancia_km ?? 0));
      setManualObservacoes(response?.data?.item?.observacoes || "");
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setConsultaError(typeof detail === "string" ? detail : "Falha ao consultar deslocamento.");
      setConsultaPar(null);
    } finally {
      setConsultaLoading(false);
    }
  };

  const salvarAjusteManual = async () => {
    const origem = parseNumero(origemId);
    const destino = parseNumero(destinoId);
    const duracao = parseNumero(manualDuracaoMin);
    const distancia = Number.parseFloat(manualDistanciaKm);

    if (!origem || !destino) {
      setManualError("Selecione origem e destino.");
      return;
    }
    if (origem === destino) {
      setManualError("Origem e destino devem ser diferentes para ajuste manual.");
      return;
    }
    if (!duracao || duracao < 0) {
      setManualError("Duracao deve ser um numero valido maior ou igual a zero.");
      return;
    }
    if (!Number.isFinite(distancia) || distancia < 0) {
      setManualError("Distancia deve ser um numero valido maior ou igual a zero.");
      return;
    }

    try {
      setManualSaving(true);
      setManualError("");
      setManualMensagem("");
      await api.put("/logistica/deslocamento/manual", {
        origem_clinica_id: origem,
        destino_clinica_id: destino,
        perfil,
        distancia_km: distancia,
        duracao_min: duracao,
        observacoes: (manualObservacoes || "").trim() || null,
      });
      setManualMensagem("Ajuste manual salvo.");
      await Promise.all([carregarMatriz(), consultarPar(false)]);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setManualError(typeof detail === "string" ? detail : "Falha ao salvar ajuste manual.");
    } finally {
      setManualSaving(false);
    }
  };

  const recalcularMatriz = async () => {
    const clinicaId = parseNumero(recalculoClinicaId);
    try {
      setRecalculoLoading(true);
      setRecalculoError("");
      setRecalculoMensagem("");

      const payload = {
        clinica_id: clinicaId || null,
        perfis: [perfil],
        force_override: recalculoForce,
        incluir_inativas: incluirInativas,
      };

      const response = await api.post<RecalculoResponse>("/logistica/recalcular", payload);
      const data = response.data;
      const total = Number(data?.updated || 0);
      const skipped = Number(data?.skipped_manual || 0);
      const totalCelulas = Number(data?.total_celulas || 0);
      const extra = totalCelulas > 0 ? ` Total de celulas: ${totalCelulas}.` : "";
      setRecalculoMensagem(`Recalculo concluido. Atualizados: ${total}. Ignorados (manual): ${skipped}.${extra}`);
      await carregarMatriz();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setRecalculoError(typeof detail === "string" ? detail : "Falha ao recalcular matriz.");
    } finally {
      setRecalculoLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarClinicas();
  }, [router]);

  useEffect(() => {
    if (loadingClinicas) return;
    carregarMatriz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingClinicas, perfil, incluirInativas, origemId, destinoId]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Logistica - Matriz de Deslocamento</h1>
          <p className="text-sm text-gray-600">
            Tela de teste para consultar, ajustar manualmente e recalcular tempos entre clinicas.
          </p>
        </div>

        {erroTela && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erroTela}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 bg-white border rounded-lg p-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Perfil</label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as PerfilLogistica)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {PERFIS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Origem (filtro)</label>
            <select
              value={origemId}
              onChange={(e) => setOrigemId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={loadingClinicas}
            >
              <option value="">Selecione...</option>
              {clinicas.map((c) => (
                <option key={`origem-${c.id}`} value={String(c.id)}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Destino (filtro)</label>
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={loadingClinicas}
            >
              <option value="">Selecione...</option>
              {clinicas.map((c) => (
                <option key={`destino-${c.id}`} value={String(c.id)}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={carregarMatriz}
              disabled={matrizLoading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar matriz
            </button>
          </div>
          <div className="lg:col-span-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={incluirInativas}
                onChange={(e) => setIncluirInativas(e.target.checked)}
              />
              Incluir clinicas inativas
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Consulta do par
            </h2>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => consultarPar(false)}
                disabled={consultaLoading}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                Consultar
              </button>
              <button
                type="button"
                onClick={() => consultarPar(true)}
                disabled={consultaLoading}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                Recalcular par
              </button>
            </div>

            {consultaError && (
              <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-700">
                {consultaError}
              </div>
            )}

            {consultaPar && (
              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm space-y-1">
                <p className="font-medium text-blue-900">
                  {consultaPar.origem.nome || nomeClinica(consultaPar.origem.id)} -&gt;{" "}
                  {consultaPar.destino.nome || nomeClinica(consultaPar.destino.id)}
                </p>
                <p className="text-gray-700">Perfil: {consultaPar.item.perfil}</p>
                <p className="text-gray-700">Duracao: {consultaPar.item.duracao_min} min</p>
                <p className="text-gray-700">Distancia: {consultaPar.item.distancia_km} km</p>
                <p className="text-gray-700">Fonte: {consultaPar.item.fonte}</p>
                <p className="text-gray-700">
                  Manual override: {consultaPar.item.manual_override ? "sim" : "nao"}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Save className="w-5 h-5 text-emerald-600" />
              Ajuste manual
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Distancia (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={manualDistanciaKm}
                  onChange={(e) => setManualDistanciaKm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Duracao (min)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={manualDuracaoMin}
                  onChange={(e) => setManualDuracaoMin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Observacoes</label>
                <textarea
                  rows={2}
                  value={manualObservacoes}
                  onChange={(e) => setManualObservacoes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={salvarAjusteManual}
              disabled={manualSaving}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {manualSaving ? "Salvando..." : "Salvar ajuste manual"}
            </button>

            {manualMensagem && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm text-emerald-700">
                {manualMensagem}
              </div>
            )}
            {manualError && (
              <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-700">
                {manualError}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            Recalculo da matriz
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Clinica alvo (opcional)</label>
              <select
                value={recalculoClinicaId}
                onChange={(e) => setRecalculoClinicaId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Todas as clinicas</option>
                {clinicas.map((c) => (
                  <option key={`recalc-${c.id}`} value={String(c.id)}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={recalculoForce}
                onChange={(e) => setRecalculoForce(e.target.checked)}
              />
              Forcar override (inclui itens manuais)
            </label>
            <button
              type="button"
              onClick={recalcularMatriz}
              disabled={recalculoLoading}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60"
            >
              {recalculoLoading ? "Recalculando..." : "Recalcular matriz"}
            </button>
          </div>

          {recalculoMensagem && (
            <div className="rounded border border-purple-200 bg-purple-50 px-2 py-1 text-sm text-purple-700">
              {recalculoMensagem}
            </div>
          )}
          {recalculoError && (
            <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-700">
              {recalculoError}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              Itens da matriz
            </h2>
            <span className="text-sm text-gray-500">
              Clinicas no filtro: {matrizTotalClinicas} | Itens: {matrizItems.length}
            </span>
          </div>

          {matrizError && (
            <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {matrizError}
            </div>
          )}

          {loadingClinicas || matrizLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : matrizItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum item encontrado para o filtro atual.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2">Origem</th>
                    <th className="text-left px-4 py-2">Destino</th>
                    <th className="text-left px-4 py-2">Perfil</th>
                    <th className="text-left px-4 py-2">Dist. km</th>
                    <th className="text-left px-4 py-2">Duracao</th>
                    <th className="text-left px-4 py-2">Fonte</th>
                    <th className="text-left px-4 py-2">Manual</th>
                  </tr>
                </thead>
                <tbody>
                  {matrizItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2">{nomeClinica(item.origem_clinica_id)}</td>
                      <td className="px-4 py-2">{nomeClinica(item.destino_clinica_id)}</td>
                      <td className="px-4 py-2">{item.perfil}</td>
                      <td className="px-4 py-2">{Number(item.distancia_km || 0).toFixed(2)}</td>
                      <td className="px-4 py-2">{item.duracao_min} min</td>
                      <td className="px-4 py-2">{item.fonte}</td>
                      <td className="px-4 py-2">{item.manual_override ? "sim" : "nao"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>
            Para ajustes operacionais, salve manualmente os pares mais criticos nos dois sentidos
            (A -&gt; B e B -&gt; A) e em ambos os perfis quando necessario.
          </div>
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Esta tela foi criada para teste e calibracao da fase 1/2 de logistica.
        </div>
      </div>
    </DashboardLayout>
  );
}

