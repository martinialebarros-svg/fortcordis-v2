# Intent - agenda-excecao-manual-preserva-data

Data: 2026-09-09  
Responsavel: Martiniano Barros  
Status: approved

## 1) Problema atual

No modal de novo agendamento, quando nenhuma oferta do assistente atende ao
cliente, o fluxo previsto e: registrar o motivo, recusar todas as ofertas e
(como admin) conceder a excecao para liberar data/hora manuais.

Na pratica a excecao dura ate o primeiro uso. Assim que a data manual e
alterada, `handleDataChange` chama `resetFluxoAssistente()` sem excecao alguma,
o que zera `decisaoAssistente`, apaga `motivoSemOpcao` e revoga
`excecaoConcedida`. O campo de hora volta a ficar bloqueado e e preciso repetir
tudo: gerar melhor oferta, digitar o motivo de novo e clicar de novo em
"Nenhuma oferta atende..." e em "Conceder excecao". Ou seja, o campo que a
excecao acabou de liberar e exatamente o que cancela a excecao.

Somando a isso, o popup de sugestao de proximidade dispara na troca de data e
interrompe o admin oferecendo aplicar outro horario, mesmo depois de ele ter
decidido explicitamente pelo horario manual.

## 2) Objetivo

Depois da excecao concedida, ajustar a data manual deve ser um passo comum do
fluxo: motivo, desfecho de recusa e excecao permanecem registrados e os campos
de data/hora continuam liberados ate o salvamento (ou ate revogacao explicita).

## 3) Nao objetivos

- Nao alterar a governanca da excecao: continuam obrigatorios o panorama
  consultado, o motivo preenchido, o perfil admin e o clique explicito em
  "Conceder excecao".
- Nao fundir "recusar todas" e "conceder excecao" em um unico botao.
- Nao mexer no comportamento do modo de edicao nem no fluxo retroativo.
- Nao alterar backend, contratos de API ou auditoria.

## 4) Contexto e restricoes

- Restricoes tecnicas: mudanca isolada em `frontend/app/agenda/NovoAgendamentoModal.tsx`
  e em um helper puro novo em `frontend/lib/`.
- Restricoes de prazo: incomodo diario de quem opera a agenda; correcao curta.
- Restricoes regulatorio/operacional: a excecao continua sendo ato de admin com
  motivo registrado nas observacoes do agendamento
  (`excecao_operacional_concedida` / `motivo_excecao_operacional`).

## 5) Impacto esperado

- Usuarios impactados: admin que agenda com excecao de horario.
- Modulos impactados: agenda (modal de novo agendamento).
- Risco de regressao: baixo; o bloqueio guiado padrao permanece igual quando
  nao ha excecao concedida.

## 6) Riscos iniciais

- Risco 1: manter na tela o panorama da data anterior induziria o operador a
  aplicar uma oferta de outra data sem perceber. Mitigado descartando o
  panorama e avisando na mensagem do assistente.
- Risco 2: afrouxar o bloqueio guiado alem da excecao. Mitigado por helper puro
  testado e por teste de componente que cobre bloqueio, liberacao e revogacao.

## 7) Perguntas abertas

- Nenhuma.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
