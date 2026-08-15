# Plan - portal-secure-access-foundation

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Sequencia de fases

- Fase 1 (SDD/modelagem): registrar feature, definir contratos e modelar a tabela de desafios.
- Fase 2 (seguranca/token): criar helper de token do portal e regras de validacao.
- Fase 3 (API portal): implementar endpoints de desafio, verificacao, listagem e download.
- Fase 4 (validacao): adicionar testes focados e executar suite alvo.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar pasta SDD da feature.
- [x] T1.2 Definir contrato de API e nova tabela de desafios.
- Criterio de conclusao:
  - spec pronta para orientar implementacao.
- Risco:
  - scope crescer antes de existir base segura.
- Rollback:
  - remover pasta SDD.

### Fase 2

- [x] T2.1 Criar helper de JWT do portal separado do token administrativo.
- [x] T2.2 Definir validade de sessao, validade de download e decode de claims.
- Criterio de conclusao:
  - portal tem token proprio e contexto de sessao tipado.
- Risco:
  - misturar audiences ou claims com auth interna.
- Rollback:
  - reverter helper/claims do portal.

### Fase 3

- [x] T3.1 Implementar modelo e migracao `portal_access_challenges`.
- [x] T3.2 Implementar endpoints de solicitacao e verificacao de codigo.
- [x] T3.3 Implementar ACL para listagem de exames.
- [x] T3.4 Implementar download autenticado de anexos do exame.
- Criterio de conclusao:
  - endpoints principais do portal respondem com seguranca minima funcional.
- Risco:
  - ACL frouxa em exame/anexo.
- Rollback:
  - remover router do portal e migracao associada.

### Fase 4

- [x] T4.1 Criar testes unitarios/focados do portal.
- [x] T4.2 Executar suite alvo de testes.
- Criterio de conclusao:
  - testes cobrem emissao de desafio, token e ACL basica.
- Risco:
  - testes dependerem de DB global do backend.
- Rollback:
  - isolar com sqlite temporario e patch de auditoria.

## 3) Plano de testes

- Testes unitarios:
  - token do portal e validacao de desafio.
- Testes de integracao:
  - sqlite temporario com modelos de tutor, paciente, clinica, exame, anexo e desafio.
- Testes manuais:
  - nao previstos nesta iteracao alem de exercicio local de endpoint em fase posterior.

## 4) Dependencias e bloqueios

- Dependencia 1:
  - definicao futura do canal real de entrega de codigo.
- Dependencia 2:
  - integracao posterior do frontend dos portais.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (sqlite local + unittest).
