# Plan - portal-parceiros-externos

Data: 2026-07-30
Responsavel: Codex
Status: in_progress

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): introduzir a camada de parceiro externo generica e preparar migracao das clinicas parceiras atuais.
- Fase 2 (backend/API): generalizar convite, autenticacao, auditoria e liberacao de laudos por destinatario externo.
- Fase 3 (frontend): adaptar gestao administrativa, liberacao de laudos e ambiente autenticado do parceiro.
- Fase 4 (integracao/observabilidade): validar migracao, timeline, notificacoes e filtros operacionais em stage.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar a modelagem `portal_partner_profiles` com suporte a `clinica` e `veterinario`.
- [x] T1.2 Criar as estruturas de destinatario/liberacao por parceiro externo.
- [x] T1.3 Planejar a migracao dos acessos atuais de clinicas parceiras para a nova camada generica.
- Criterio de conclusao:
  - migracoes aplicam em banco limpo e em base com dados ja existentes de clinicas
- Risco:
  - perda de vinculo entre clinica ja ativada e conta do portal
- Rollback:
  - manter leitura da camada antiga e desativar uso da nova camada por feature flag

### Fase 2

- [x] T2.1 Generalizar endpoints de cadastro, convite, ativacao, login, reset e sessao para parceiro externo.
- [x] T2.2 Generalizar a regra de autorizacao do portal para escopo por `partner_id`.
- [x] T2.3 Adaptar a liberacao de laudos para reutilizar os vinculos externos ja salvos (`clinica` e/ou `veterinario parceiro`) no mesmo endpoint de portal.
- [x] T2.4 Permitir vinculacao de parceiro externo em cenarios com e sem agendamento, incluindo telemedicina/upload de eletrocardiograma.
- Criterio de conclusao:
  - API atende clinic e veterinario com o mesmo contrato-base e sem regressao no portal atual
- Risco:
  - quebrar fluxos legados de clinica parceira
- Rollback:
  - reativar endpoints legados clinic-centric e bloquear o tipo `veterinario`

### Fase 3

- [x] T3.1 Atualizar a tela de gestao do portal para trabalhar com parceiro externo e filtro por tipo.
- [x] T3.2 Criar formulario administrativo de cadastro/edicao de veterinario parceiro.
- [x] T3.3 Ajustar o fluxo de liberacao de laudos para manter a acao disponivel enquanto houver destino externo pendente.
- [x] T3.4 Ajustar o ambiente autenticado para cabecalho e mensagens especificas de clinica ou veterinario parceiro.
- [x] T3.5 Ajustar upload/telemedicina para selecao ou cadastro rapido de parceiro externo.
- Criterio de conclusao:
  - UI cobre cadastro, convite, filtro, timeline e ambiente autenticado para os dois tipos
- Risco:
  - excesso de condicional espalhada no frontend e confusao visual entre os perfis
- Rollback:
  - ocultar o tipo `veterinario` na interface e manter a operacao restrita a clinicas

### Fase 4

- [ ] T4.1 Consolidar a timeline administrativa residual e eventos ainda nao expostos no painel.
- [ ] T4.2 Validar migracao de clinicas ativas para o modelo novo em stage.
- [ ] T4.3 Executar smoke com pelo menos uma clinica migrada e um veterinario parceiro novo.
- Criterio de conclusao:
  - metricas e auditoria comprovam integridade do fluxo e stage fica pronto para homologacao
- Risco:
  - dados migrados incompletos gerando falso bloqueio de acesso
- Rollback:
  - manter o parceiro veterinario desativado e restaurar leitura exclusiva de clinicas

## 3) Plano de testes

- Testes unitarios:
  - validacao do modelo `portal_partner_profiles`
  - autorizacao por `partner_id`
  - migracao de clinica antiga para parceiro externo
- Testes de integracao:
  - convite, ativacao, login, reset e listagem escopada para clinica
  - convite, ativacao, login, reset e listagem escopada para veterinario parceiro
  - liberacao e revogacao de laudo para multiplos destinatarios
- Testes manuais:
  - cadastrar veterinario parceiro, enviar convite e acessar o portal
  - confirmar que clinica existente continua funcionando
  - liberar laudo para clinica, veterinario e tutor com combinacoes diferentes
  - cadastrar parceiro no fluxo de telemedicina sem agendamento

## 4) Dependencias e bloqueios

- Dependencia 1: localizar e generalizar a camada atual de autenticacao/convite do portal sem perder historico de clinicas.
- Dependencia 2: definir no backend o ponto canonico de vinculacao entre laudo/exame e parceiro externo nos fluxos com e sem agendamento.
- Dependencia 3: validar se o CRMV sera obrigatorio ou opcional para o cadastro do veterinario parceiro nesta primeira entrega.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (local/stage).
