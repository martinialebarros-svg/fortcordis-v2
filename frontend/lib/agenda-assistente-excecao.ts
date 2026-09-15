export type DecisaoAssistente = "pendente" | "aceito" | "sem_opcao";

export interface EstadoExcecaoManual {
  isEditando: boolean;
  isAdmin: boolean;
  decisaoAssistente: DecisaoAssistente;
  excecaoConcedida: boolean;
}

/**
 * A excecao manual so vale para agendamento novo, quando o admin registrou o
 * motivo, recusou todas as ofertas do panorama e concedeu a excecao.
 */
export function excecaoManualEstaLiberada(estado: EstadoExcecaoManual): boolean {
  return (
    !estado.isEditando &&
    estado.decisaoAssistente === "sem_opcao" &&
    estado.isAdmin &&
    estado.excecaoConcedida
  );
}

/**
 * Trocar a data no modo guiado reinicia o assistente, porque o panorama vale
 * para uma data especifica. Sob excecao concedida isso nao pode acontecer: a
 * data manual e justamente o que a excecao liberou, e o reset apagaria motivo e
 * excecao, obrigando a refazer todo o fluxo para reabrir o campo de hora.
 */
export function deveResetarAssistentePorTrocaDeData(estado: EstadoExcecaoManual): boolean {
  return !estado.isEditando && !excecaoManualEstaLiberada(estado);
}
