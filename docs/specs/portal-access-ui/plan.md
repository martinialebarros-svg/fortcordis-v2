# Plan - portal-access-ui

Data: 2026-07-21
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
- [x] Revisar a pagina, o login, a ativacao, a redefinicao de senha e o painel autenticado da clinica.
- [x] Preservar identificadores internos como `codigo`, `sessao` e campos de payload.
- [x] Validar render local sem enviar codigo, iniciar sessao ou baixar anexos.

## 7) Refinamento administrativo - 2026-07-21

### Fase 5 (gestao do portal)

- [x] T5.1 Criar endpoint panoramico para listar clinicas, convites, contas, sessoes e downloads do portal.
- [x] T5.2 Enriquecer a auditoria de download para registrar `actor_type`, `clinica_id` e `account_id`.
- [x] T5.3 Criar pagina administrativa `/clinicas/portal` com visao geral, filtros, fila de acao e feed de downloads.
- [x] T5.4 Reaproveitar o fluxo de convite/revogacao da clinica individual dentro do cockpit administrativo.
- [x] T5.5 Adicionar exportacao CSV da visao filtrada e metricas de adesao/inatividade.
- Criterio de conclusao:
  - a operacao consegue acompanhar onboarding e uso do portal sem abrir clinica por clinica.
- Risco:
  - a tela concentrar acoes sensiveis sem feedback claro de carregamento, confirmacao ou resultado.
- Rollback:
  - remover a rota administrativa `/clinicas/portal` e manter apenas a gestao individual por clinica.

### Plano de testes complementar

- Automatizados:
  - `backend/venv/bin/python -m unittest backend/tests/test_portal_clinic_invite_auth.py`
  - `cd frontend && npx eslint app/clinicas/portal/page.tsx app/clinicas/page.tsx app/clinicas/components/ClinicaPortalAccessCard.tsx app/layout-dashboard.tsx lib/portal-api.ts lib/portal-clinic-admin.ts`
  - `cd frontend && npx tsc --noEmit --pretty false`
- Manuais:
  - abrir `/clinicas/portal`;
  - filtrar por status e filas rapidas;
  - gerar convite a partir do cockpit;
  - revogar convite, encerrar sessao e revogar conta com confirmacao;
  - exportar CSV da visao filtrada.

## 8) Refinamento operacional - 2026-07-21

### Fase 6 (cockpit de relacionamento e adesao)

- [x] T6.1 Enriquecer o endpoint panoramico com `login_email`, `first_download_at`, `last_access_at`, `days_since_last_activity` e linha do tempo por clinica.
- [x] T6.2 Distinguir primeiro download no feed recente e nas estatisticas por clinica.
- [x] T6.3 Adicionar alerta visual para clinicas ativas sem acesso ha 30 dias ou mais.
- [x] T6.4 Permitir reenvio rapido de convite direto na lista quando os dados minimos ja existirem.
- [x] T6.5 Adicionar filtro/quick view para primeiro download concluido.
- [x] T6.6 Tornar a exportacao CSV mais analitica com status do convite, primeiro download, ultimo acesso e dias sem atividade.
- [x] T6.7 Exibir linha do tempo resumida por clinica com historico de convite, cadastro, revogacoes e downloads.
- Criterio de conclusao:
  - a operacao consegue identificar rapidamente adesao real, esfriamento de uso e historico recente de cada clinica sem sair do cockpit.
- Risco:
  - o painel crescer em densidade e perder clareza se os estados nao tiverem boa hierarquia visual.
- Rollback:
  - remover os novos campos/atalhos mantendo a versao anterior do cockpit com panorama, convite e feed recente.

### Plano de testes desta fase

- Automatizados:
  - `backend/venv/bin/python -m unittest backend/tests/test_portal_clinic_invite_auth.py`
  - `cd frontend && npx eslint app/clinicas/portal/page.tsx app/clinicas/page.tsx app/clinicas/components/ClinicaPortalAccessCard.tsx app/layout-dashboard.tsx lib/portal-api.ts lib/portal-clinic-admin.ts`
  - `cd frontend && npx tsc --noEmit --pretty false`
  - `git diff --check`
- Manuais:
  - validar quick views `Sem acesso ha 30+ dias` e `Primeiro download`;
  - validar o checkbox de primeiro download concluido;
  - acionar reenvio rapido a partir da lista;
  - revisar a linha do tempo de uma clinica com convite, conta e download;
  - exportar CSV e conferir as novas colunas analiticas.

## 9) Refinamento de compartilhamento - 2026-07-22

### Fase 7 (metadata institucional do app)

- [x] T7.1 Configurar `metadataBase`, `openGraph`, `twitter` e `icons` no `frontend/app/layout.tsx`.
- [x] T7.2 Apontar a preview institucional para a logomarca oficial em `frontend/public/brand/fortcordis-logo-oficial.png`.
- [x] T7.3 Validar build/typecheck para garantir que o metadata global nao regrediu.
- Criterio de conclusao:
  - links compartilhados do portal passam a publicar preview institucional coerente com a marca Fort Cordis.
- Risco:
  - plataformas externas manterem cache temporario do preview antigo mesmo apos a publicacao.
- Rollback:
  - remover os metadados adicionados do `frontend/app/layout.tsx` e voltar ao comportamento anterior.

### Plano de testes desta fase

- Automatizados:
  - `cd frontend && npx eslint app/layout.tsx`
  - `cd frontend && npx tsc --noEmit --pretty false`
  - `cd frontend && npm run build`
  - `git diff --check`
- Manuais:
  - compartilhar um link novo do portal em um mensageiro com preview;
  - confirmar nome, descricao e logomarca oficial no card.

## 10) Refinamento de autorizacao operacional - 2026-08-04

- [x] T10.1 Identificar o papel operacional persistido para secretaria (`recepcao`) e a trava direta de `admin` nas rotas de convite.
- [x] T10.2 Permitir `recepcao` e variantes de `secretaria` apenas para consultar o painel/resumo e gerar ou reenviar convites.
- [x] T10.3 Manter as rotas de revogacao de convite, conta e sessoes exclusivas do papel `admin`.
- [x] T10.4 Cobrir a permissao de secretaria/recepcao e a negativa de revogacao com teste HTTP.
- Criterio de conclusao:
  - secretaria gera e copia/reenvia um convite no cockpit; tentativas de revogacao por esse papel recebem `403`.
- Risco:
  - ampliar indevidamente os poderes operacionais do papel de secretaria.
- Rollback:
  - restaurar `_require_portal_admin` nas tres rotas de leitura/convite, sem alterar as rotas de revogacao.
