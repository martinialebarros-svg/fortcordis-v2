# Spec - portal-clinica-parceira-redesign

Data: 2026-08-14
Responsavel: Martiniano Barros
Status: draft

## 1) Escopo funcional

Reorganizar a apresentacao de `frontend/components/portal/PortalClinicaWorkspace.tsx` (usado em `/clinica-parceira` e espelhado em `/clinicas/portal/espelho`) para responder rapido a pergunta real da clinica - "o laudo que eu estou esperando ja saiu?" - dando destaque aos exames `aguardando_liberacao` e reduzindo o peso visual dos outros 7 contadores hoje empilhados em 2 fileiras de KPI. A lista completa e filtravel de "Exames liberados" nao muda.

Esta entrega **amends** `docs/specs/portal-access-ui/spec.md` RF-023, RF-024 e CA-025/CA-026 (o contrato de dados continua valendo, so muda a forma de apresentacao) e identifica **um unico ponto que exige mudanca de backend**, aditiva e sem alterar nada existente: ver secao 4, `API`.

## 2) Requisitos funcionais (RF)

- RF-001: a tela deve exibir, em destaque visual e acima da dobra (sem exigir scroll), a contagem e a lista dos exames `aguardando_liberacao` - respondendo diretamente "o laudo que eu quero ja saiu?".
- RF-002: cada exame listado como "aguardando liberacao" deve mostrar `paciente_nome`, `tipo_exame`, `data_realizacao` e `previsao_liberacao` (campos ja existentes no contrato) sem clique ou scroll adicional.
- RF-003: os indicadores `realizados_hoje`, `em_laudo` e `liberados_hoje` (hoje 3 dos 4 cards do "Painel operacional") deixam de ter destaque visual equivalente ao de `aguardando_liberacao` - continuam visiveis, em tratamento secundario (ex.: linha compacta), nunca ausentes.
- RF-004: os 4 KPIs de topo (`Exames encontrados`, `Pets no resultado`, `Arquivos disponiveis`, `Mais recente`, hoje em `dashboardStats`) e os indicadores do painel operacional devem ser consolidados numa unica area de resumo, sem duas fileiras de 4 cards cada disputando a mesma prioridade visual.
- RF-005: a lista completa e filtravel de "Exames liberados" (busca, filtro por tipo/status, ordenacao) permanece com o comportamento atual - nao e alterada por esta entrega.
- RF-006: a rota `/clinicas/portal/espelho` continua reutilizando o mesmo componente e o mesmo contrato (mantendo `NFR-018` de `portal-access-ui`) - qualquer mudanca de apresentacao em `PortalClinicaWorkspace` vale automaticamente para a visao espelhada, sem logica paralela.
- RF-007: quando nao houver nenhum exame `aguardando_liberacao`, a tela deve exibir um estado vazio explicito e positivo (ex.: "nenhum laudo pendente no momento"), nao apenas omitir a secao.
- RF-008 (achado durante a espec, ver justificativa em `API` abaixo): o backend deve garantir que **todos** os exames `aguardando_liberacao` da clinica cheguem ao frontend, independente do volume de atividade recente em outros status.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade de contrato): nenhum campo existente de `PortalClinicOperationalSummaryResponse` ou `PortalClinicOperationalItemResponse` (`backend/app/schemas/portal.py:82-103`) e removido ou renomeado - a unica mudanca de contrato e um campo novo, aditivo (RF-008 / secao 4).
- NFR-002 (consistencia com espelho): a implementacao deve continuar satisfazendo `NFR-018` de `portal-access-ui/spec.md` (sem segunda implementacao paralela dos dados) - a mudanca de apresentacao fica so em `PortalClinicaWorkspace.tsx`, consumida igualmente pelo espelho.
- NFR-003 (UX/hierarquia visual): "aguardando liberacao" deve ter peso visual estritamente maior que os outros 3 indicadores operacionais e que os 4 KPIs de topo.
- NFR-004 (nao regressao): nenhum dos 8 valores hoje exibidos (4 KPIs + 4 indicadores operacionais) pode deixar de estar disponivel na tela apos a mudanca, mesmo que em tratamento visual secundario.
- NFR-005 (qualidade): build do frontend deve seguir passando apos a mudanca.
- NFR-006 (responsivo): a nova hierarquia deve funcionar em viewport mobile - clinicas parceiras acessam o portal fora do computador com frequencia.
- NFR-007 (performance): a nova consulta de "todos os aguardando_liberacao" (RF-008) reaproveita as queries ja existentes em `_build_clinic_operational_panel` (`backend/app/api/v1/endpoints/portal.py:635-845`) - nao deve introduzir N+1 nem duplicar acesso ao banco alem do necessario.

## 4) Contratos tecnicos

### API

**Achado ao especificar (nao estava no intent):** `operational_items` hoje mistura os 3 status (`em_laudo`, `aguardando_liberacao`, `liberado_portal`/recentes) num unico top-8 ordenado por recencia e ja truncado no backend (`backend/app/api/v1/endpoints/portal.py:837,845`). Numa clinica com bastante atividade recente em outros status, um exame `aguardando_liberacao` mais antigo pode ficar fora desse top-8 e nunca chegar ao frontend - ou seja, filtrar `operational_items` no cliente **nao garante** mostrar todos os pendentes. Isso e o unico motivo para tocar backend nesta entrega; e aditivo, sem mudar nada que ja existe.

- Endpoint: `GET /api/v1/portal/clinicas/exames` (`backend/app/api/v1/endpoints/portal.py:1094-1195`) - **sem mudanca de assinatura, query params ou campos existentes**.
- Adicao proposta ao response (`PortalExamListResponse`): novo campo `operational_pending_items: list[PortalClinicOperationalItemResponse]`, calculado a partir das mesmas queries que hoje alimentam `em_laudo`/`aguardando_liberacao` em `_build_clinic_operational_panel` (linhas 665-703), filtrando so `status_key == "aguardando_liberacao"`, **sem o cap compartilhado de 8 com os demais status** (cap proprio, ex.: 20, ou paginacao simples se o volume justificar - a definir em `plan.md` apos olhar volume real de producao).
- Mesmo endpoint de espelho (`GET /api/v1/portal/admin/clinicas/{clinica_id}/espelho`, `backend/app/api/v1/endpoints/portal_clinic_auth.py:687-724`) ja delega para `listar_exames_clinica_portal` - recebe o campo novo automaticamente, sem trabalho adicional.

### Banco/migracoes

- Nenhuma. Migracao necessaria: nao. O campo novo e derivado dos mesmos dados (`Laudo`, `Exame`) ja consultados.

### Frontend

- Telas afetadas:
  - `frontend/components/portal/PortalClinicaWorkspace.tsx` (unico arquivo alterado; secoes atuais 613-653 [KPIs] e 655-790 [painel operacional] sao reestruturadas).
  - `frontend/lib/portal-api.ts:322-344` (tipos TS espelhando o schema - adicionar `operational_pending_items`).
- Estados de UI:
  - Com pendencias: lista de `operational_pending_items` em destaque + indicadores secundarios (realizados/em laudo/liberados hoje) + lista completa "Exames liberados" abaixo (inalterada).
  - Sem pendencias: estado vazio positivo dedicado (RF-007), nao apenas ausencia de secao.
  - Carregando: mantem o esqueleto/spinner ja existente (`searchLoading`, `dashboardLoaded`).
- Regras de exibicao/erro:
  - Nao remover nenhum campo hoje exibido - so reorganizar peso visual (NFR-004).
  - Se `operational_pending_items` vier vazio mas `operational_summary.aguardando_liberacao > 0` (payload inconsistente), tratar como erro de dados e nao afirmar "nada pendente" (ver CB-005).

## 5) Compatibilidade e rollout

- Backward compatibility: alta - unico campo novo e aditivo (nenhum client existente quebra por ignora-lo); `PortalPartnerWorkspace.tsx` nao e afetado (nao tem painel operacional).
- Feature flag: nao necessario - mudanca aditiva de baixo risco.
- Estrategia de rollback: reverter o componente frontend para a versao anterior; o campo novo do backend pode ficar (aditivo, inofensivo) ou ser revertido junto, sem dependencia de migracao.

## 6) Criterios de aceitacao (CA)

- CA-001: ao abrir o portal com ao menos 1 exame `aguardando_liberacao`, a clinica ve a contagem e a lista completa desses exames (via `operational_pending_items`) sem precisar rolar a pagina.
- CA-002: cada exame pendente listado mostra paciente, tipo de exame, data de realizacao e previsao de liberacao.
- CA-003: ao abrir o portal sem nenhum exame pendente, aparece mensagem explicita de "nada pendente", nao uma secao vazia/ausente.
- CA-004: os indicadores `realizados_hoje`, `em_laudo` e `liberados_hoje` continuam visiveis em algum lugar da tela, com peso visual menor que "aguardando liberacao".
- CA-005: a lista "Exames liberados" com busca/filtro/ordenacao continua funcionando exatamente como antes (regressao zero).
- CA-006: abrir `/clinicas/portal/espelho` pra qualquer clinica mostra a mesma nova hierarquia visual e a lista completa de pendentes, confirmando reuso do mesmo componente/contrato.
- CA-007: numa clinica de teste com mais de 8 eventos recentes em outros status e ao menos 1 pendente "antigo", o pendente antigo ainda aparece na lista (prova de que RF-008 resolveu o achado da secao 4).
- CA-008: em viewport mobile, a secao de "aguardando liberacao" continua legivel e em destaque, sem quebra de layout.
- CA-009: build do frontend e backend passam sem erro apos a mudanca.

## 7) Casos de borda

- CB-001: exame pendente sem `previsao_liberacao` (campo optional) - a tela deve lidar com ausencia sem quebrar o layout.
- CB-002: clinica nova sem nenhum exame ainda (`operational_pending_items` e `operational_items` vazios) - diferenciar visualmente de "sem pendencias" (deve deixar claro que e falta de historico, nao confirmacao de "tudo em dia").
- CB-003: modo `admin_preview` (espelho) - o texto do estado vazio/destaque nao deve se dirigir a clinica na 2a pessoa de um jeito que so faca sentido pra sessao real (ja existe distincao via `isAdminPreview` no componente, reusar o mesmo padrao).
- CB-004: volume alto de pendentes (dezenas) - decidir em `plan.md` se `operational_pending_items` pagina ou so lista tudo (depende do volume real de producao, a levantar).
- CB-005: `operational_summary.aguardando_liberacao` e `operational_pending_items.length` divergentes (payload inconsistente por corrida entre as duas queries) - frontend deve preferir o array como fonte de verdade da lista e nao travar a tela, mas pode logar a divergencia.

## 8) Fora de escopo

- Fila agrupada de laudos pendentes para uso interno da Fortcordis (tratada em `docs/specs/portal-clinicas-ia-consolidacao/intent.md`).
- Extensao do mesmo redesenho para `PortalPartnerWorkspace.tsx` (pergunta aberta no intent, nao decidida).
- Notificacao proativa (WhatsApp/e-mail) de laudo liberado (sugestao registrada, nao especificada aqui).
- Qualquer mudanca nas regras de liberacao de laudo (`core/portal_release.py`) ou nos campos ja existentes do contrato.
