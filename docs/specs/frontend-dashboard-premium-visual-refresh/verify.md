# Verify - frontend-dashboard-premium-visual-refresh

Responsavel: Equipe FortCordis
Data: 2026-07-11

## Matriz de verificacao

| Criterio | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | lint | `cd frontend && npm run lint` | ok |
| CA-002 | typecheck | `cd frontend && npx tsc --noEmit --pretty false` | ok |
| CA-003 | build | `cd frontend && npm run build` | ok |
| CA-004 | diff hygiene | `git diff --check` | ok |
| CA-005 | smoke local | `curl -I http://127.0.0.1:3003/dashboard` retornou `200 OK` | ok |
| CA-006 | SDD guardrail | `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD` retornou `PASSED` | ok |
| CA-007 | smoke local | 27 rotas da fase 2 responderam `200`; rota inexistente respondeu `404` | ok |
| CA-008 | responsividade | QA em 1280x720 e 390x844 sem overflow horizontal nas superficies representativas | ok |
| CA-009 | interacao | abas de ultrassonografia e relatorios financeiros alternaram conteudo sem persistencia | ok |
| CA-010 | acessibilidade | controle do login alternou `password`/`text` e `Mostrar senha`/`Ocultar senha` | ok |
| CA-011 | estados globais | loading, error e not-found compilados; 404 validado no navegador | ok |
| CA-012 | integridade textual | varredura `rg 'Ã|Â|�|ðŸ'` nos arquivos alterados sem ocorrencias | ok |
| CA-013 | SDD fase 2 | `spec.md`, `plan.md` e `verify.md` atualizados no mesmo ciclo | ok |
| CA-014 | QA modal agenda | dialogo principal e cadastros rapidos validados em 1280x720 e 390x844 | ok |

## QA visual esperado

- Cabecalho compacto, com ECG integrado e indicadores legiveis.
- Cards de metricas alinhados e consistentes.
- Empty state da agenda sem corte do complexo QRS.
- Sidebar com grupos funcionais e nome completo da empresa em quebra de linha.
- Sem mudanca de contrato API ou fluxo de autenticacao.
- Telas operacionais compartilham cabecalhos, filtros, metricas, abas e paineis com densidade adequada ao dominio.
- Login interno prioriza o formulario no mobile e preserva os links dos portais externos.
- Portais usam logo e fotografia locais sem enviar credenciais ou dados durante QA.
- Tabelas, graficos e abas rolam dentro do proprio painel quando necessario.
- Modal de agendamento acima da sidebar, com cabecalho Fort Cordis, foco verde-petroleo, acoes persistentes e rolagem interna.
- Cadastros rapidos de tutor e animal compartilham o mesmo padrao visual e nao cortam campos ou rodapes no mobile.

## Evidencias da fase 2

- `cd frontend && npm run lint`: ok.
- `cd frontend && npx tsc --noEmit`: ok.
- `cd frontend && npm run build`: ok, 33 rotas compiladas.
- `git diff --check`: ok.
- Smoke local: `/`, `/agenda`, `/agenda/fullcalendar`, `/area-pacientes`, `/atendimento`, `/clinica-parceira`, `/clinica-parceira/redefinir-senha`, `/clinicas`, `/clinicas/novo`, `/configuracoes`, `/financeiro`, `/financeiro/frota`, `/financeiro/relatorios`, `/fiscal`, `/laudos`, `/laudos/novo`, `/laudos/eletrocardiograma/upload`, `/logistica`, `/pacientes`, `/pacientes/novo`, `/referencias-eco`, `/relatorios`, `/servicos`, `/servicos/novo`, `/ultrassonografia-abdominal`, `/ultrassonografia-abdominal/novo` e `/whatsapp-stage`: `200`.
- QA browser: desktop e mobile em Dashboard, Agenda, cadastros, Laudos, Ultrassonografia, Financeiro, Relatorios, portais e login.
- Acoes evitadas durante QA: login real, envio de formulario, upload, download, exclusao e alteracao de dados clinicos.

## Evidencias da correcao do modal de agendamento

- `cd frontend && npm run lint`: ok.
- `cd frontend && npx tsc --noEmit --pretty false`: ok.
- `cd frontend && npm run build`: ok, 33 paginas compiladas.
- `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD`: `PASSED` para `frontend-dashboard-premium-visual-refresh`.
- QA browser em 1280x720: modal de 896 px acima da sidebar, sem overflow horizontal e com rolagem interna do formulario.
- QA browser em 390x844: modal de 374 px, acoes empilhadas e campos auxiliares em largura integral, sem overflow horizontal.
- Submodais de tutor e animal abertos e fechados sem preencher ou salvar dados; rolagem interna e nomes acessiveis validados.
- Console do navegador sem erros durante a rodada de QA.

## Guardrail da proxima etapa

O guardrail da fase 2 foi executado apos o commit local e antes do push, usando `origin/stage` como base:

- `python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD`: `PASSED`.
- Feature qualificada: `frontend-dashboard-premium-visual-refresh`.
- Artefatos reconhecidos: `plan.md`, `spec.md` e `verify.md`.
