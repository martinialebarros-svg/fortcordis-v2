"use client";

import {
  Download,
  Eye,
  FileUp,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import type { LooseAtendimentoComponentProps } from "./component-props";

type AtendimentoDocumentosSectionProps = LooseAtendimentoComponentProps;

export default function AtendimentoDocumentosSection(props: AtendimentoDocumentosSectionProps) {
  const {
    ATENDIMENTO_ATTACHMENT_ACCEPT,
    adicionarLinkAnexo,
    anexosGerais,
    anexoArquivo,
    anexoForm,
    abrirAnexo,
    cancelarUploadAnexo,
    evolucaoForm,
    excluirAnexo,
    formatBytes,
    formatDate,
    openingAttachmentId,
    progressoUploadGeral,
    selecionado,
    setAnexoArquivo,
    setAnexoForm,
    setErro,
    setEvolucaoForm,
    setSucesso,
    uploadAnexoArquivo,
    uploadGeralEmAndamento,
    abrirAtendimento,
    api,
    form,
  } = props;

  return (
    <>
      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          Evolucao Clinica
        </h2>
        {form.evolucoes.length > 0 && (
          <div className="space-y-2 mb-4">
            <h3 className="font-medium text-sm text-gray-600">Historico de evolucoes</h3>
            {form.evolucoes.map((evo: AtendimentoDocumentosSectionProps) => (
              <div key={evo.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500">
                    {formatDate(evo.data_evolucao)} - {evo.responsavel_nome}
                  </span>
                </div>
                <p className="text-sm mt-1">{evo.descricao}</p>
                {evo.sinais_vitais ? (
                  <p className="text-xs text-gray-500 mt-1">Sinais vitais: {evo.sinais_vitais}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-4">
          <h3 className="font-medium text-sm text-gray-700 mb-2">Nova evolucao</h3>
          <textarea
            value={evolucaoForm.descricao}
            onChange={(e) => setEvolucaoForm({ ...evolucaoForm, descricao: e.target.value })}
            placeholder="Descricao da evolucao..."
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
          />
          <textarea
            value={evolucaoForm.sinais_vitais}
            onChange={(e) => setEvolucaoForm({ ...evolucaoForm, sinais_vitais: e.target.value })}
            placeholder="Sinais vitais (opcional)..."
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
          />
          <button
            onClick={async () => {
              if (!selecionado || !evolucaoForm.descricao.trim()) return;
              try {
                await api.post(`/atendimentos/${selecionado}/evolucoes`, evolucaoForm);
                setEvolucaoForm({ descricao: "", sinais_vitais: "" });
                await abrirAtendimento(selecionado);
                setSucesso("Evolucao registrada com sucesso.");
              } catch {
                setErro("Erro ao registrar evolucao.");
              }
            }}
            disabled={!selecionado || !evolucaoForm.descricao.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Registrar Evolucao
          </button>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-orange-600" />
          Anexos e Imagens
        </h2>
        {anexosGerais.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {anexosGerais.map((anexo: AtendimentoDocumentosSectionProps) => (
              <div key={anexo.id} className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-medium text-slate-900">{anexo.nome_original || anexo.tipo}</p>
                    <p className="mt-1 text-xs text-slate-500">{anexo.descricao || anexo.tipo}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatBytes(anexo.tamanho)}
                      {anexo.created_at ? ` · ${formatDate(anexo.created_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 md:w-32 md:flex-col md:items-stretch">
                    <button
                      onClick={() => abrirAnexo(anexo, "preview")}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                    >
                      {openingAttachmentId === anexo.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Visualizar
                    </button>
                    <button
                      onClick={() => abrirAnexo(anexo, "download")}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-100 px-3 py-2 text-sm text-blue-700 hover:bg-blue-200"
                    >
                      <Download className="h-4 w-4" />
                      Baixar
                    </button>
                    <button
                      onClick={() => excluirAnexo(anexo)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Nenhum anexo geral registrado neste atendimento.
          </div>
        )}
        <div className="border-t pt-4 space-y-4">
          <h3 className="font-medium text-sm text-gray-700">Novo anexo</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={anexoForm.tipo}
              onChange={(e) => setAnexoForm({ ...anexoForm, tipo: e.target.value })}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="imagem">Imagem</option>
              <option value="radiografia">Radiografia</option>
              <option value="ultrassom">Ultrassom</option>
              <option value="documento">Documento</option>
              <option value="outro">Outro</option>
            </select>
            <input
              value={anexoForm.descricao}
              onChange={(e) => setAnexoForm({ ...anexoForm, descricao: e.target.value })}
              placeholder="Descricao"
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <FileUp className="h-4 w-4 text-slate-400" />
              <input
                key={anexoArquivo ? `${anexoArquivo.name}-${anexoArquivo.lastModified}` : "anexo-vazio"}
                type="file"
                accept={ATENDIMENTO_ATTACHMENT_ACCEPT}
                onChange={(e) => setAnexoArquivo(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:text-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                if (!anexoArquivo) return;
                await uploadAnexoArquivo(anexoArquivo, {
                  tipo: anexoForm.tipo,
                  descricao: anexoForm.descricao,
                });
              }}
              disabled={!selecionado || !anexoArquivo || uploadGeralEmAndamento}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {uploadGeralEmAndamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {uploadGeralEmAndamento
                ? typeof progressoUploadGeral === "number"
                  ? `Enviando ${progressoUploadGeral}%`
                  : "Enviando..."
                : "Enviar arquivo"}
            </button>
            {uploadGeralEmAndamento ? (
              <button
                type="button"
                onClick={() => cancelarUploadAnexo("geral")}
                className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200"
              >
                <X className="h-4 w-4" />
                Cancelar upload
              </button>
            ) : null}
            {anexoArquivo ? (
              <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                {anexoArquivo.name} · {formatBytes(anexoArquivo.size)}
              </span>
            ) : null}
          </div>

          {uploadGeralEmAndamento ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full bg-orange-600 transition-[width] duration-200 ${
                    typeof progressoUploadGeral === "number" ? "" : "animate-pulse"
                  }`}
                  style={{ width: `${typeof progressoUploadGeral === "number" ? progressoUploadGeral : 35}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {typeof progressoUploadGeral === "number"
                  ? `Upload geral em andamento (${progressoUploadGeral}%).`
                  : "Upload geral em andamento..."}
              </p>
            </div>
          ) : null}

          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Adicionar link externo</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr),auto]">
              <input
                value={anexoForm.url}
                onChange={(e) => setAnexoForm({ ...anexoForm, url: e.target.value })}
                placeholder="URL do arquivo"
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={adicionarLinkAnexo}
                disabled={!selecionado || !anexoForm.url.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                Adicionar link
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
