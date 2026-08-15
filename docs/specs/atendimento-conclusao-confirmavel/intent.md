# Intent - atendimento-conclusao-confirmavel

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

Analisando os dados reais de producao (38 atendimentos, 33 pacientes), 35 de
38 (92%) permanecem em status `Triagem` e nunca sao concluidos. Investigando a
causa: o botao "Finalizar atendimento" existe e sempre aparece na tela, mas
`_validar_primeira_conclusao_atendimento` (`atendimento.py:298`) bloqueia
incondicionalmente (HTTP 422) a primeira conclusao quando faltam:

- `queixa_principal`;
- pelo menos um de `anamnese` / `exame_fisico` / `dados_clinicos`;
- pelo menos um de `diagnostico_principal` / `diagnostico_secundario` /
  `diagnostico_diferencial` / `plano_terapeutico`.

Em producao, o terceiro grupo (diagnostico ou plano terapeutico) esta
preenchido em pouquissimos atendimentos (`diagnostico_principal` em 8/38,
`plano_terapeutico` em 5/38, os outros dois em 2/38) - e essa e a trava real.
O vet clica em "Finalizar", recebe o erro, e como nem toda consulta e escrita
com diagnostico estruturado, o atendimento fica preso.

Isso nao e so um problema de organizacao: `Finalizar atendimento` e o que
gera a Ordem de Servico e marca a Agenda como `Realizada`
(`atendimento-agenda-transactional-finalization`). Um atendimento que nunca
conclui tambem nunca fatura e nunca aparece como realizado na Agenda.

## 2) Objetivo

Manter a exigencia de documentacao clinica minima (ela existe por um motivo:
registro clinico incompleto e um risco), mas trocar o bloqueio incondicional
por uma confirmacao explicita: o vet pode optar por concluir mesmo com
pendencias, sabendo exatamente o que falta, e essa decisao fica auditada.

## 3) Nao objetivos

- Remover ou reduzir os tres grupos de exigencia (queixa principal / anamnese
  ou exame fisico ou dados clinicos / diagnostico ou plano terapeutico).
  Decisao do usuario: manter a exigencia como esta, so trocar o mecanismo de
  bloqueio.
- Mexer no contrato de `POST /atendimentos/{id}/finalizar` alem do novo campo
  opcional `confirmar_conclusao_pendencias` (a resposta de sucesso nao muda).
- Adicionar um indicador visual de progresso/checklist antes do clique (opcao
  3 discutida e nao escolhida nesta rodada).
- Investigar por que a documentacao clinica esta baixa em si (isso e uma
  questao de pratica clinica, nao de produto).
- Publicar em stage ou producao sem solicitacao explicita.

## 4) Contexto e restricoes

- Descoberto e decidido em conversa (nao a partir de uma spec previa): a
  investigacao começou como uma pergunta exploratória sobre agilidade do
  modulo de Atendimento, incluiu consulta direta ao banco de produção
  (somente leitura, so agregados, sem dado de paciente/tutor extraído) para
  medir onde o retrabalho se concentra, e revelou este problema mais grave.
- A validacao (`_validar_primeira_conclusao_atendimento`) e chamada em tres
  lugares: `criar_atendimento`, `atualizar_atendimento` e
  `finalizar_atendimento`. Os tres precisam do mesmo mecanismo de
  confirmacao, para consistencia.
- Segue o mesmo padrao ja estabelecido no pacote
  `atendimento-integridade-prontuario` para conflitos confirmaveis: HTTP 409
  com `{codigo, mensagem, confirmavel: true}` (visto em
  `CONFIRMACAO_DESVINCULO_AGENDAMENTO`).
- `frontend/lib/api-error.ts` ja sabe extrair `detail` como objeto; nao
  precisa de nova infraestrutura de erro no frontend.

## 5) Impacto esperado

- Usuarios impactados: veterinarios (finalizar consulta), financeiro (OS
  deixa de ficar bloqueada por documentacao incompleta).
- Modulos impactados: Atendimento (backend e frontend). Agenda e OS ganham
  mais atendimentos concluidos, sem mudanca de contrato.
- Risco de regressao: conclusao com documentacao incompleta vira possivel
  (era impossivel antes). Mitigado por auditoria explicita
  (`CONCLUIR_COM_PENDENCIAS`) de toda conclusao que usar a confirmacao.

## 6) Riscos iniciais

- Risco 1: confirmar vira habito, e a exigencia perde o efeito de lembrete.
  Mitigacao: a mensagem de confirmacao sempre lista o que falta
  especificamente; a auditoria permite medir a frequencia de uso depois.
- Risco 2: quebra de testes existentes que assumiam o bloqueio incondicional
  em 422. Mitigado atualizando os tres testes afetados para o novo contrato
  (409 confirmavel) e adicionando testes para o caminho de confirmacao.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
