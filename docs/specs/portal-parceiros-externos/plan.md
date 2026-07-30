# Plan - portal-parceiros-externos

Data: 2026-07-30
Responsavel: Equipe FortCordis
Status: ready-for-stage

## 1) Sequencia de fases

- Fase 1 (fundacao de dados): introduzir o modelo generico de parceiro externo e espelhar clinicas legadas.
- Fase 2 (operacao/admin): criar CRUD administrativo de parceiros externos.
- Fase 3 (autenticacao do parceiro): disponibilizar convite, ativacao, login, refresh, logout e reset de senha para veterinario parceiro.
- Fase 4 (portal autenticado): disponibilizar ambiente proprio do veterinario parceiro com filtros e downloads escopados.
- Fase 5 (expansao funcional): concluir liberacao multi-destinatario, timeline administrativa completa e fluxo de telemedicina sem agendamento.
- Fase 6 (rollout): validar stage com convivencia segura entre clinicas atuais e parceiros novos antes de promover.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar `portal_partner_profiles` para representar clinica e veterinario parceiro.
- [x] T1.2 Criar `portal_partner_release_targets` para espelhar destinatarios externos liberados no portal.
- [x] T1.3 Executar backfill de clinicas legadas e liberacoes ja existentes.
- Criterio de conclusao:
  - a base aceita parceiro externo sem perder compatibilidade com clinicas legadas.
- Risco:
  - espelho de clinicas ou liberacoes antigas sair incompleto.
- Rollback:
  - desligar leitura da camada nova e manter consultas clinica-centric enquanto a migracao e ajustada.

### Fase 2

- [x] T2.1 Implementar `GET /api/v1/portal/parceiros`.
- [x] T2.2 Implementar `POST /api/v1/portal/parceiros`.
- [x] T2.3 Implementar `PATCH /api/v1/portal/parceiros/{id}`.
- [x] T2.4 Construir a tela administrativa `/clinicas/portal/parceiros`.
- Criterio de conclusao:
  - a operacao consegue cadastrar e editar clinicas/veterinarios parceiros pela interface.
- Risco:
  - validacoes diferentes por tipo ficarem confusas e gerarem cadastros ambiguos.
- Rollback:
  - ocultar a nova tela administrativa e manter o cadastro antigo de clinicas.

### Fase 3

- [x] T3.1 Implementar emissao de convite para veterinario parceiro.
- [x] T3.2 Implementar ativacao por token com criacao de senha.
- [x] T3.3 Implementar login, MFA contextual, refresh, logout e reset de senha.
- [x] T3.4 Registrar auditoria de convite, ativacao, login e redefinicao.
- Criterio de conclusao:
  - veterinario parceiro consegue sair do convite ate uma sessao autenticada funcional.
- Risco:
  - reaproveitar autenticacao do portal sem separar corretamente o contexto do parceiro.
- Rollback:
  - desligar endpoints publicos do veterinario parceiro e manter apenas o cadastro administrativo.

### Fase 4

- [x] T4.1 Criar rotas publicas `/veterinario-parceiro`, `/veterinario-parceiro/ativar/[token]` e `/veterinario-parceiro/redefinir-senha`.
- [x] T4.2 Exibir ambiente autenticado com identidade explicita do tipo de parceiro.
- [x] T4.3 Filtrar listagem e downloads apenas por `partner_id` liberado.
- Criterio de conclusao:
  - o parceiro autenticado acessa apenas o proprio escopo e consegue baixar anexos liberados.
- Risco:
  - filtros do portal reutilizarem contratos antigos e abrirem dados fora do escopo.
- Rollback:
  - suspender o portal publico do veterinario parceiro e preservar a area administrativa.

### Fase 5

- [ ] T5.1 Implementar liberacao multi-destinatario completa no fluxo de laudos.
- [ ] T5.2 Expor timeline administrativa de convites, acessos, revogacoes e downloads por parceiro.
- [ ] T5.3 Fechar o fluxo de telemedicina/upload sem agendamento com parceiro existente ou cadastro rapido.
- Criterio de conclusao:
  - a operacao consegue usar parceiro externo como destino real de laudo em todos os fluxos principais.
- Risco:
  - promover para producao como se o ciclo estivesse totalmente fechado quando ainda faltam passos operacionais.
- Rollback:
  - manter a fase 5 atras de rollout controlado ate a operacao ponta a ponta ficar completa.

### Fase 6

- [ ] T6.1 Publicar em stage.
- [ ] T6.2 Executar smoke de clinica legada e veterinario parceiro.
- [ ] T6.3 Revalidar SDD, CI e smoke antes de propor promocao para main.
- Criterio de conclusao:
  - o pacote entra em stage sem regressao aparente para clinicas e com fluxo novo acessivel ao parceiro veterinario.
- Risco:
  - olhar apenas a nova experiencia e deixar passar regressao nas clinicas existentes.
- Rollback:
  - interromper promocao para main e reverter o pacote em stage se houver perda de compatibilidade.

## 3) Plano de testes

- Testes backend:
  - migracao e backfill das tabelas novas;
  - CRUD administrativo de parceiros externos;
  - convite, ativacao e login do veterinario parceiro;
  - escopo de listagem por `partner_id`.
- Testes frontend:
  - lint dos arquivos alterados;
  - `tsc --noEmit`;
  - `npm run build` com rotas do parceiro.
- Testes manuais:
  - cadastrar veterinario parceiro;
  - gerar convite pelo admin;
  - ativar conta pelo link;
  - entrar no portal do parceiro;
  - validar que clinica existente continua operando normalmente.

## 4) Dependencias e bloqueios

- Dependencia 1:
  - provider de email/convite do portal precisa estar funcional para ativacao, MFA e reset.
- Dependencia 2:
  - base de clinicas legadas precisa ter dados minimos para espelhamento consistente.
- Dependencia 3:
  - a fase seguinte de liberacao multi-destinatario depende de integrar o fluxo de laudos com os novos destinatarios.

## 5) Checklist para iniciar promocao

- [x] `intent.md` presente e alinhado com a feature.
- [x] `spec.md` atualizado no mesmo ciclo.
- [x] `plan.md` explicita o que esta entregue e o que segue pendente.
- [x] `verify.md` registra validacoes da fase atual.
- [ ] Stage publicado e smokeado.
