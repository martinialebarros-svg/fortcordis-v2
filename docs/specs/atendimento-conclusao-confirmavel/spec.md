# Spec - atendimento-conclusao-confirmavel

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

Trocar o bloqueio incondicional (`422`) da barreira clinica minima na
primeira conclusao de um atendimento por um bloqueio confirmavel (`409`),
mantendo os mesmos tres criterios de conteudo minimo. Aplica-se aos tres
pontos de entrada que podem concluir um atendimento pela primeira vez:
`POST /atendimentos`, `PUT /atendimentos/{id}` e
`POST /atendimentos/{id}/finalizar`.

## 2) Requisitos funcionais (RF)

- RF-001: os tres criterios de `_validar_primeira_conclusao_atendimento`
  permanecem os mesmos: `queixa_principal`; ao menos um de `anamnese` /
  `exame_fisico` / `dados_clinicos`; ao menos um de `diagnostico_principal` /
  `diagnostico_secundario` / `diagnostico_diferencial` / `plano_terapeutico`.
- RF-002: quando ha pendencia e o payload nao confirma, a resposta deve ser
  `409` com `detail = {"codigo": "CONFIRMACAO_CONCLUSAO_PENDENCIAS",
  "mensagem": <lista as pendencias>, "confirmavel": true, "pendencias":
  [<strings>]}`.
- RF-003: os tres payloads (`AtendimentoCreatePayload`,
  `AtendimentoUpdatePayload`, `AtendimentoFinalizarPayload`) ganham o campo
  opcional `confirmar_conclusao_pendencias: bool | None`.
- RF-004: com `confirmar_conclusao_pendencias: true`, a conclusao prossegue
  independente de quais pendencias existam, e a operacao registra auditoria
  (`modulo=atendimento`, `entidade=atendimento_clinico`,
  `acao=CONCLUIR_COM_PENDENCIAS`) com a lista de pendencias que foram
  ignoradas.
- RF-005: sem pendencias (todos os tres criterios satisfeitos), o
  comportamento e identico ao anterior - sem bloqueio, sem auditoria extra.
- RF-006: o frontend, ao finalizar um atendimento e receber o `409`
  confirmavel, deve exibir a mensagem do backend numa confirmacao explicita
  (`window.confirm`) e, se confirmado, reenviar a mesma chamada com
  `confirmar_conclusao_pendencias: true`.
- RF-007: se o usuario cancelar a confirmacao, nada e enviado ao backend; o
  atendimento permanece como estava, sem erro exibido.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (auditabilidade): toda conclusao com pendencias fica registrada,
  identificavel depois por `acao=CONCLUIR_COM_PENDENCIAS`.
- NFR-002 (compatibilidade): payloads antigos (sem o novo campo) mantêm
  exatamente o comportamento anterior quando ha pendencia - a diferenca e
  `409` em vez de `422`, mas o bloqueio ainda ocorre sem confirmacao.
- NFR-003 (consistencia): os tres pontos de entrada usam o mesmo mecanismo e
  o mesmo `codigo`.

## 4) Contratos tecnicos

### API

`POST /atendimentos/{id}/finalizar` (o caminho real usado pela UI):

Requisicao:
```json
{ "tipo_horario": "comercial", "confirmar_conclusao_pendencias": true }
```

Resposta de bloqueio (sem confirmar, com pendencia):
```json
{
  "detail": {
    "codigo": "CONFIRMACAO_CONCLUSAO_PENDENCIAS",
    "mensagem": "Faltam preencher: diagnostico ou plano terapeutico. Confirme para concluir mesmo assim, ou mantenha o atendimento em andamento e continue depois.",
    "confirmavel": true,
    "pendencias": ["diagnostico ou plano terapeutico"]
  }
}
```
Status: `409`.

O mesmo formato de `detail` se aplica a `PUT /atendimentos/{id}` e
`POST /atendimentos` quando o payload leva o atendimento a `Concluido` pela
primeira vez com pendencias.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Migracao necessaria: **nao**.

### Frontend

- Telas afetadas: `/atendimento`, botao "Finalizar atendimento".
- Estados de UI: nenhum estado novo persistente; a confirmacao e um dialogo
  nativo (`window.confirm`), consistente com o restante da pagina
  (`deleteAtendimento`, `removerExame`).
- Regras de exibicao/erro: outros erros de `/finalizar` (preco ausente,
  vinculo incompativel, etc.) continuam caindo no fluxo de erro existente,
  sem confirmacao.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - sem o novo campo, o comportamento de bloqueio
  permanece (so muda o status HTTP de 422 para 409).
- Feature flag: nao.
- Estrategia de rollback: reverter o commit. Sem migration, sem estado
  persistido além da nova linha de auditoria (que e apenas informativa).

## 6) Criterios de aceitacao (CA)

- CA-001: `POST /finalizar` sem pendencias continua concluindo normalmente,
  sem nenhuma chamada de auditoria extra.
- CA-002: `POST /finalizar` com pendencias e sem confirmacao retorna `409`
  com `codigo=CONFIRMACAO_CONCLUSAO_PENDENCIAS`, `confirmavel=true`, e a
  lista de `pendencias`; nada e alterado (atendimento, Agenda e OS
  preservados).
- CA-003: `POST /finalizar` com pendencias e `confirmar_conclusao_pendencias:
  true` conclui o atendimento e registra auditoria com as pendencias.
- CA-004: o mesmo par bloqueio/confirmacao vale para `criar_atendimento` (via
  `status: "Concluido"` na criacao) e para `atualizar_atendimento` (via `PUT`
  em atendimento sem agendamento vinculado).
- CA-005: a suite do modulo permanece verde, incluindo os testes que antes
  verificavam `422` (agora atualizados para `409` confirmavel) e os novos
  testes do caminho de confirmacao.

## 7) Casos de borda

- CB-001: confirmar quando NAO ha pendencias (nenhum efeito diferente,
  nenhuma auditoria - a auditoria so ocorre quando pendencias reais existiam).
- CB-002: tentar confirmar a conclusao de um atendimento que ja esta
  `Concluido` (transicao nao dispara a validacao, pois
  `_status_atendimento_concluido(status_atual)` ja e verdadeiro - nada muda).
- CB-003: usuario cancela o `window.confirm` - nenhuma requisicao adicional e
  enviada, nenhum erro aparece.

## 8) Fora de escopo

- Indicador visual pre-clique de quais campos estao pendentes.
- Revisão do conteúdo mínimo exigido (os três grupos permanecem os mesmos).
- Qualquer mudança na finalização transacional (Agenda/OS) além de deixar de
  ser bloqueada por essa barreira quando confirmada.
