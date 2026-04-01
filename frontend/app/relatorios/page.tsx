"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import DashboardLayout from "../layout-dashboard";
import { DOMINIOS_RELATORIO } from "./constants";
import RelatoriosExportPanel from "./components/RelatoriosExportPanel";
import RelatoriosFiltrosGlobais from "./components/RelatoriosFiltrosGlobais";
import RelatoriosFinanceiroView from "./components/views/RelatoriosFinanceiroView";
import RelatoriosLogisticaView from "./components/views/RelatoriosLogisticaView";
import RelatoriosOperacaoView from "./components/views/RelatoriosOperacaoView";
import RelatoriosRentabilidadeView from "./components/views/RelatoriosRentabilidadeView";
import RelatoriosVisaoGeralView from "./components/views/RelatoriosVisaoGeralView";
import { useRelatoriosModule } from "./hooks/useRelatoriosModule";

export default function RelatoriosControlePage() {
  const router = useRouter();
  const {
    dominioAtivo,
    setDominioAtivo,
    periodoInicio,
    setPeriodoInicio,
    periodoFim,
    setPeriodoFim,
    dataReferencia,
    setDataReferencia,
    perfilDeslocamento,
    setPerfilDeslocamento,
    clinicaBaseId,
    setClinicaBaseId,
    clinicaId,
    setClinicaId,
    servicoId,
    setServicoId,
    profissionalId,
    setProfissionalId,
    regiao,
    setRegiao,
    clinicas,
    servicos,
    profissionais,
    regioes,
    relatorio,
    financeiroContexto,
    loading,
    erro,
    modoExportacao,
    setModoExportacao,
    secoesContexto,
    secoesPersonalizadas,
    setSecoesPersonalizadas,
    alternarSecaoPersonalizada,
    baixandoCsv,
    baixandoPdf,
    inicializar,
    carregarRelatorios,
    baixarCsv,
    baixarPdf,
  } = useRelatoriosModule();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    void inicializar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const renderDominio = () => {
    if (!relatorio) return null;

    if (dominioAtivo === "visao-geral") {
      return <RelatoriosVisaoGeralView relatorio={relatorio} financeiroContexto={financeiroContexto} />;
    }

    if (dominioAtivo === "operacao") {
      return <RelatoriosOperacaoView relatorio={relatorio} />;
    }

    if (dominioAtivo === "logistica") {
      return <RelatoriosLogisticaView relatorio={relatorio} clinicas={clinicas} />;
    }

    if (dominioAtivo === "financeiro") {
      return <RelatoriosFinanceiroView relatorio={relatorio} financeiroContexto={financeiroContexto} />;
    }

    return <RelatoriosRentabilidadeView relatorio={relatorio} />;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Relatorios &amp; Controle</h1>
          <p className="text-sm text-gray-600">
            Modulo reorganizado por dominio para decisao executiva, operacional, logistica, financeira e de
            rentabilidade.
          </p>
        </div>

        <div className="bg-white border rounded-xl p-3">
          <div className="flex flex-wrap gap-2">
            {DOMINIOS_RELATORIO.map((dominio) => {
              const ativo = dominioAtivo === dominio.id;
              return (
                <button
                  key={dominio.id}
                  type="button"
                  onClick={() => setDominioAtivo(dominio.id)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    ativo
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {dominio.label}
                </button>
              );
            })}
          </div>
        </div>

        <RelatoriosFiltrosGlobais
          periodoInicio={periodoInicio}
          setPeriodoInicio={setPeriodoInicio}
          periodoFim={periodoFim}
          setPeriodoFim={setPeriodoFim}
          dataReferencia={dataReferencia}
          setDataReferencia={setDataReferencia}
          perfilDeslocamento={perfilDeslocamento}
          setPerfilDeslocamento={setPerfilDeslocamento}
          clinicaBaseId={clinicaBaseId}
          setClinicaBaseId={setClinicaBaseId}
          clinicaId={clinicaId}
          setClinicaId={setClinicaId}
          servicoId={servicoId}
          setServicoId={setServicoId}
          profissionalId={profissionalId}
          setProfissionalId={setProfissionalId}
          regiao={regiao}
          setRegiao={setRegiao}
          clinicas={clinicas}
          servicos={servicos}
          profissionais={profissionais}
          regioes={regioes}
          loading={loading}
          onAtualizar={carregarRelatorios}
        />

        <RelatoriosExportPanel
          dominioAtivo={dominioAtivo}
          modoExportacao={modoExportacao}
          setModoExportacao={setModoExportacao}
          secoesContexto={secoesContexto}
          secoesPersonalizadas={secoesPersonalizadas}
          alternarSecaoPersonalizada={alternarSecaoPersonalizada}
          setSecoesPersonalizadas={setSecoesPersonalizadas}
          baixandoCsv={baixandoCsv}
          baixandoPdf={baixandoPdf}
          onExportCsv={baixarCsv}
          onExportPdf={baixarPdf}
        />

        {relatorio ? (
          <p className="text-xs text-gray-500">
            Base operacional: {relatorio.base_operacional.clinica_nome || "Nao definida"} (
            {relatorio.base_operacional.criterio})
          </p>
        ) : null}

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        ) : null}

        {loading && !relatorio ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-500">Carregando relatorios...</div>
        ) : null}

        {relatorio ? renderDominio() : null}
      </div>
    </DashboardLayout>
  );
}

