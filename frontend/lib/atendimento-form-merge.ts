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

const isSameExamRequest = (left: ExameSolicitacao, right: ExameSolicitacao) => {
  const leftCatalogId = Number(left.catalogo_exame_id || 0);
  const rightCatalogId = Number(right.catalogo_exame_id || 0);
  if (leftCatalogId > 0 && rightCatalogId > 0) {
    return leftCatalogId === rightCatalogId;
  }
  return buildExamMergeKey(left) === buildExamMergeKey(right);
};

/**
 * Conserva a intenção de exclusão quando ela ocorre durante o primeiro save
 * de um exame. Nesse intervalo o card ainda não tem `id` no navegador, mas
 * o POST em voo pode terminar criando o registro. Sem este ajuste o item some
 * da tela, porém fica no banco e volta a aparecer no PDF/reabertura.
 */
export const reconcileExamRemovalsDuringSave = (
  currentExams: ExameSolicitacao[],
  sentExams: ExameSolicitacao[],
  persistedExams: ExameSolicitacao[],
  sentDestroyIds: ReadonlySet<number>
): ExameSolicitacao[] => {
  const next = currentExams.filter(
    (item) => !(item._destroy && item.id != null && sentDestroyIds.has(item.id))
  );
  const persistedPool = [...persistedExams];

  sentExams.forEach((sentExam) => {
    if (sentExam.id != null || !sentExam._localId || !(sentExam.tipo_exame || "").trim()) return;

    const wasRemovedLocally = !next.some((item) => item._localId === sentExam._localId);
    const requestStillExists = next.some(
      (item) => !item._destroy && isSameExamRequest(item, sentExam)
    );
    if (!wasRemovedLocally || requestStillExists) return;

    const persistedIndex = persistedPool.findIndex((item) => isSameExamRequest(item, sentExam));
    if (persistedIndex < 0) return;

    const persistedExam = persistedPool.splice(persistedIndex, 1)[0];
    if (persistedExam.id == null || next.some((item) => item.id === persistedExam.id)) return;

    next.push({
      ...persistedExam,
      _destroy: true,
      _localId: sentExam._localId,
    });
  });

  return next;
};

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
