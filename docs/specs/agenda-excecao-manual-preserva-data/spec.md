# Spec - agenda-excecao-manual-preserva-data

Data: 2026-09-09  
Responsavel: Martiniano Barros  
Status: approved

## 1) Escopo funcional

Corrigir o modal de novo agendamento para que a troca de data sob excecao
manual concedida preserve o desfecho do assistente (`sem_opcao`), o motivo
registrado e a propria excecao, mantendo data e hora editaveis. O panorama de
ofertas da data anterior e descartado, porque nao descreve mais a data
escolhida, e o popup de sugestao de proximidade deixa de interromper enquanto a
excecao esta ativa. Fora da excecao, o bloqueio guiado continua exatamente como
hoje.

## 2) Requisitos funcionais (RF)

- RF-001: com excecao manual ativa (novo agendamento, admin, desfecho
  `sem_opcao`, excecao concedida), alterar a data nao pode resetar
  `decisaoAssistente`, `motivoSemOpcao` nem `excecaoConcedida`.
- RF-002: com excecao manual ativa, os campos de data e hora continuam
  habilitados apos a troca de data, sem exigir novo ciclo de ofertas.
- RF-003: ao trocar a data sob excecao, o panorama da data anterior e limpo
  (`sugestoesHorario`, `ofertasPanoramicasConsultadas`, `indiceSugestaoAtual`,
  `itensIgnoradosJanela`) e o assistente exibe mensagem informando que a data
  foi ajustada sob excecao e que motivo e excecao seguem valendo.
- RF-004: sem excecao manual ativa, a troca de data mantem o reset atual do
  fluxo guiado (`resetFluxoAssistente`).
- RF-005: "Revogar excecao" volta a bloquear data e hora imediatamente.
- RF-006: com excecao manual ativa, a consulta de proximidade continua
  atualizando a mensagem informativa, mas nao abre o popup "Posso aplicar esse
  horario?".

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): sem chamadas de rede adicionais; a troca de data sob
  excecao passa a evitar o popup de proximidade.
- NFR-002 (seguranca/permissoes): a liberacao manual segue restrita a
  `isAdmin`, com motivo obrigatorio e panorama previamente consultado; nada no
  payload de criacao muda.
- NFR-003 (observabilidade): as observacoes do agendamento continuam recebendo
  `[Assistente agenda] sem opcao aderente...`, o motivo informado e
  `[Assistente agenda] excecao manual concedida por admin.`

## 4) Contratos tecnicos

### API

- Endpoint: nenhum alterado.
- Metodo: n/a.
- Payload: `excecao_operacional_concedida` e `motivo_excecao_operacional`
  seguem calculados como hoje em `POST /agenda`.
- Resposta: inalterada.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/agenda/NovoAgendamentoModal.tsx` (modal de novo
  agendamento).
- Novo modulo puro: `frontend/lib/agenda-assistente-excecao.ts` com
  `excecaoManualEstaLiberada` e `deveResetarAssistentePorTrocaDeData`.
- Estados de UI:
  - `excecaoManualAtiva` derivado do helper e reutilizado por
    `excecaoManualLiberada` (bloqueio de data/hora) e por `handleDataChange`.
  - `invalidarPanoramaMantendoExcecao()` limpa somente o panorama e escreve a
    mensagem de data ajustada.
- Regras de exibicao/erro: com excecao ativa, apos trocar a data o bloco de
  desfecho continua exibindo motivo, botao "Revogar excecao" e o aviso verde
  "Excecao concedida por admin".

## 5) Compatibilidade e rollout

- Backward compatibility: total; nenhuma mudanca de contrato ou de dado
  persistido.
- Feature flag (se houver): nao ha.
- Estrategia de rollback: reverter o commit; o comportamento anterior volta
  integralmente.

## 6) Criterios de aceitacao (CA)

- CA-001: admin gera ofertas, recusa todas, registra motivo, concede excecao,
  troca a data e o campo de hora permanece habilitado.
- CA-002: apos a troca de data descrita em CA-001, o motivo digitado continua
  no textarea e o aviso "Excecao concedida por admin" segue visivel.
- CA-003: apos a troca de data sob excecao, as ofertas da data anterior nao
  aparecem mais e o assistente mostra "Data ajustada sob excecao concedida...".
- CA-004: sem excecao concedida, data e hora permanecem bloqueadas com o
  assistente pronto e panorama gerado.
- CA-005: "Revogar excecao" volta a bloquear data e hora.

## 7) Casos de borda

- CB-001: perfil nao admin com desfecho `sem_opcao` nunca libera data/hora; a
  troca de data continua resetando o fluxo.
- CB-002: modo de edicao (`isEditando`) nao usa o fluxo guiado; nem o reset nem
  a preservacao se aplicam.
- CB-003: apos trocar a data sob excecao, clicar em "Gerar melhor oferta"
  recomeca o assistente (desfecho volta a `pendente`), comportamento ja
  existente e mantido de proposito.

## 8) Fora de escopo

- Reduzir os dois cliques ("recusar todas" e "conceder excecao") a um so.
- Alterar `handleClinicaChange` / `handleServicoChange`, que continuam
  resetando o fluxo por mudarem o contexto operacional.
