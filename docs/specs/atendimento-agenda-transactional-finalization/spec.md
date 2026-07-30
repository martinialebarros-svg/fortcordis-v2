# Spec - atendimento-agenda-transactional-finalization

Data: 2026-07-29
Responsavel: Codex
Status: done

## 1) Objetivo

Criar uma fronteira transacional para a finalizacao do atendimento clinico,
mantendo Atendimento, Agenda e Ordem de Servico consistentes e idempotentes.

## 2) Requisitos funcionais

- RF-001: a API deve expor uma acao explicita
  `POST /atendimentos/{id}/finalizar`.
- RF-002: a acao deve validar novamente a barreira clinica minima antes da
  primeira conclusao.
- RF-003: quando houver `agendamento_id`, a acao deve validar que Atendimento e
  Agenda pertencem ao mesmo paciente e a uma base operacional compativel.
- RF-004: agendamentos `Cancelado`, `Faltou` ou `Expirado` nao podem ser
  realizados pela finalizacao clinica.
- RF-005: em uma unica transacao, a acao deve:
  - marcar o Atendimento como `Concluido`;
  - marcar `consulta_concluida=1`;
  - marcar o agendamento como `Realizado`;
  - reutilizar uma OS ativa ou criar exatamente uma nova OS.
- RF-006: a OS deve usar paciente, clinica, servico, origem e horario da Agenda,
  alem do tipo de horario escolhido na finalizacao.
- RF-007: se os dados ou o preco necessarios para a OS estiverem ausentes, a
  finalizacao deve falhar sem persistir mudancas parciais.
- RF-008: repetir a finalizacao concluida deve retornar sucesso com a mesma OS.
- RF-009: a criacao e a troca de vinculo de um Atendimento devem rejeitar um
  `agendamento_id` ja utilizado e informar o ID do prontuario existente.
- RF-010: quando a Agenda tentar realizar ou desfazer diretamente um
  agendamento que ja possua Atendimento clinico, o backend deve orientar o uso
  do fluxo clinico transacional.
- RF-011: a interface de Atendimento deve salvar o conteudo atual antes de
  finalizar, solicitar o tipo de horario e apresentar a OS criada ou
  reutilizada.
- RF-012: `Concluido` deve permanecer disponivel como filtro e exibicao, mas nao
  como transicao manual no seletor comum.

## 3) Requisitos nao funcionais

- NFR-001 (atomicidade): Atendimento, Agenda e OS devem compartilhar um unico
  `commit`; qualquer excecao anterior ao commit deve executar rollback.
- NFR-002 (concorrencia): restricoes unicas parciais devem garantir um
  Atendimento por `agendamento_id` nao nulo e uma OS nao cancelada por
  agendamento.
- NFR-003 (idempotencia): uma repeticao nao pode criar nova OS nem alterar
  novamente os estados concluidos.
- NFR-004 (compatibilidade): OS canceladas nao impedem a criacao de uma nova OS
  ativa.
- NFR-005 (seguranca de dados): a migracao nao pode escolher silenciosamente
  qual prontuario ou OS historica preservar.
- NFR-006 (auditoria): a finalizacao confirmada deve registrar contexto,
  transicao e OS, sem incluir conteudo clinico sensivel.

## 4) Contratos

### Requisicao

```json
{
  "tipo_horario": "comercial"
}
```

Valores permitidos: `comercial` e `plantao`.

### Resposta

```json
{
  "atendimento": { "id": 10, "status": "Concluido" },
  "agenda": { "id": 20, "status": "Realizado" },
  "ordem_servico": {
    "id": 30,
    "numero_os": "OS2026070001",
    "valor_final": 150.0,
    "reutilizada": false
  },
  "mensagem": "Atendimento finalizado..."
}
```

Atendimentos sem Agenda concluem apenas o registro clinico e devolvem
`agenda=null` e `ordem_servico=null`.

### Erros

- HTTP 404: Atendimento ou Agenda vinculada inexistente.
- HTTP 409: duplicidade, vinculo incompatível ou Agenda em estado terminal.
- HTTP 422: conteudo clinico minimo, tipo de horario, dados de OS ou preco
  ausentes.

## 5) Criterios de aceitacao

- CA-001: finalizacao valida e vinculada persiste os tres resultados juntos.
- CA-002: falha de preco/OS preserva os estados anteriores e nao cria OS.
- CA-003: repeticao devolve a OS existente e a contagem permanece um.
- CA-004: uma segunda criacao para o mesmo agendamento retorna 409.
- CA-005: a migracao cria as duas restricoes em uma base integra.
- CA-006: a migracao falha com diagnostico em uma base que possua
  duplicidades, sem excluir registros.
- CA-007: Atendimento e Agenda incompatíveis ou Agenda terminal retornam 409 e
  preservam os estados.
- CA-008: finalizacao sem Agenda conclui apenas o Atendimento.
- CA-009: a interface salva, finaliza e mostra o numero da OS; `Concluido` nao
  pode ser escolhido manualmente.
- CA-010: a tentativa legada de realizar uma Agenda com Atendimento aberto e
  bloqueada em favor da acao transacional; a reabertura isolada tambem e
  bloqueada.
