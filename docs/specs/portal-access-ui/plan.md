# Plan - portal-access-ui

Data: 2026-06-16
Responsavel: Equipe FortCordis
Status: done

## 1) Sequencia de fases

- Fase 1 (contrato/UI): mapear rewrites do frontend e encaixar um client dedicado para o portal.
- Fase 2 (tutor): implementar solicitacao de codigo, validacao de sessao e listagem/download do tutor.
- Fase 3 (clinica): implementar solicitacao de codigo, validacao de sessao e busca/listagem/download da clinica.
- Fase 4 (validacao): executar build e QA local com backend do portal ativo.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Mapear como o frontend acessa `/api/v1` e isolar a integracao do portal do `axios` administrativo.
- [x] T1.2 Criar helper dedicado para desafio, verificacao, listagem e download do portal.
- Criterio de conclusao:
  - cliente do portal funcional e desacoplado da auth interna.
- Risco:
  - conflitar com storage/cookies do app administrativo.
- Rollback:
  - remover `frontend/lib/portal-api.ts`.

### Fase 2

- [x] T2.1 Conectar `/area-pacientes` ao fluxo real do tutor.
- [x] T2.2 Persistir sessao do tutor no navegador com expiracao local.
- [x] T2.3 Exibir lista de exames e downloads liberados para o pet autenticado.
- Criterio de conclusao:
  - fluxo do tutor conclui autenticacao e leitura/download com token do portal.
- Risco:
  - UI assumir acesso mais amplo que o backend permite.
- Rollback:
  - voltar a pagina para o estado institucional estatico.

### Fase 3

- [x] T3.1 Conectar `/clinica-parceira` ao fluxo real da clinica.
- [x] T3.2 Permitir busca segura por pet dentro do escopo da unidade autenticada.
- [x] T3.3 Exibir lista de exames e downloads liberados para a unidade.
- Criterio de conclusao:
  - fluxo da clinica autentica, consulta e baixa anexos dentro do escopo autorizado.
- Risco:
  - recarga de busca ou storage compartilhado criar inconsistencias de sessao.
- Rollback:
  - remover workspace da clinica e manter pagina institucional estendida.

### Fase 4

- [x] T4.1 Executar `npm run build`.
- [x] T4.2 Subir frontend local e validar render/comportamento do formulario no navegador.
- Criterio de conclusao:
  - build verde e verificacao manual basica dos dois perfis.
- Risco:
  - dependencia de ambiente local sem dados de exemplo ou sem `debug_code`.
- Rollback:
  - corrigir client/rotas ou registrar bloqueio.

## 3) Plano de testes

- Testes unitarios:
  - nao adicionados nesta iteracao de UI.
- Testes de integracao:
  - `npm run build`
- Testes manuais:
  - solicitar codigo do tutor;
  - validar codigo do tutor;
  - listar/download de exames do tutor;
  - solicitar codigo da clinica;
  - validar codigo da clinica;
  - consultar/listar/download de exames da clinica.

## 4) Dependencias e bloqueios

- Dependencia 1:
  - backend do portal ativo com rewrites locais operando.
- Dependencia 2:
  - ambiente nao produtivo com `PORTAL_DEBUG_EXPOSE_CODE=true` para QA manual rapido.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (frontend Next + backend FastAPI local).

## 6) Refinamento de copy - 2026-07-12

- [x] Revisar labels, placeholders, mensagens de erro/sucesso e metadados de exames do tutor.
- [x] Preservar identificadores internos como `codigo`, `sessao` e campos de payload.
- [x] Validar render local sem enviar codigo, iniciar sessao ou baixar anexos.
