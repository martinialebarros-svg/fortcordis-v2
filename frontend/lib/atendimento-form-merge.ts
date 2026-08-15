import type { AtendimentoForm, ExameSolicitacao, PrescricaoItem } from "@/app/atendimento/page";

export const buildExamMergeKey = (item: ExameSolicitacao) =>
  [
    item.catalogo_exame_id || "",
    (item.tipo_exame || "").trim().toLowerCase(),
    item.painel_exame_id || "",
    item.prioridade || "",
    item.status || "",
    (item.resultado || "").trim().toLowerCase(),
    item.data_resultado || "",
    Number(item.valor || 0),
    (item.observacoes || "").trim().toLowerCase(),
  ].join("|");

const buildPrescriptionMergeKey = (item: PrescricaoItem) =>
  [
    item.medicamento_id || "",
    (item.medicamento_nome || "").trim().toLowerCase(),
    (item.apresentacao_selecionada || "").trim().toLowerCase(),
    (item.dose || "").trim().toLowerCase(),
    (item.frequencia || "").trim().toLowerCase(),
    (item.duracao || "").trim().toLowerCase(),
    (item.via || "").trim().toLowerCase(),
  ].join("|");

const mergeAutoSavedItems = <T extends { id?: number | null }>(
  currentItems: T[],
  persistedItems: T[],
  getMergeKey: (item: T) => string,
  applyPersisted: (currentItem: T, persistedItem: T) => T
) => {
  const pool = [...persistedItems];
  return currentItems.map((currentItem) => {
    if (currentItem.id) {
      const byIdIndex = pool.findIndex((persistedItem) => persistedItem.id === currentItem.id);
      if (byIdIndex >= 0) {
        return applyPersisted(currentItem, pool.splice(byIdIndex, 1)[0]);
      }
    }

    const mergeKey = getMergeKey(currentItem);
    if (!mergeKey) return currentItem;

    const bySignatureIndex = pool.findIndex((persistedItem) => getMergeKey(persistedItem) === mergeKey);
    if (bySignatureIndex >= 0) {
      return applyPersisted(currentItem, pool.splice(bySignatureIndex, 1)[0]);
    }

    return currentItem;
  });
};

export const mergeAutoSavedFormState = (current: AtendimentoForm, persisted: AtendimentoForm): AtendimentoForm => ({
  ...current,
  id: persisted.id || current.id,
  exames: mergeAutoSavedItems(
    current.exames,
    persisted.exames,
    buildExamMergeKey,
    (currentItem, persistedItem) => ({
      ...currentItem,
      id: currentItem.id ?? persistedItem.id,
      laudo_id: currentItem.laudo_id ?? persistedItem.laudo_id ?? null,
      data_solicitacao: currentItem.data_solicitacao || persistedItem.data_solicitacao || "",
      data_resultado: currentItem.data_resultado || persistedItem.data_resultado || "",
      resultado: currentItem.resultado || persistedItem.resultado || "",
      valor_referencia: currentItem.valor_referencia || persistedItem.valor_referencia || "",
      unidade: currentItem.unidade || persistedItem.unidade || "",
      anexos_resultado: persistedItem.anexos_resultado || currentItem.anexos_resultado || [],
    })
  ),
  prescricao_itens: mergeAutoSavedItems(
    current.prescricao_itens,
    persisted.prescricao_itens,
    buildPrescriptionMergeKey,
    (currentItem, persistedItem) => ({
      ...currentItem,
      id: currentItem.id ?? persistedItem.id,
      medicamento_nome: currentItem.medicamento_nome || persistedItem.medicamento_nome,
      apresentacao_selecionada: currentItem.apresentacao_selecionada || persistedItem.apresentacao_selecionada || "",
      historico_ajustes: persistedItem.historico_ajustes || currentItem.historico_ajustes,
    })
  ),
});
