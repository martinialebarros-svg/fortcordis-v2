# Plan - frontend-dashboard-premium-visual-refresh

Responsavel: Equipe FortCordis
Data: 2026-07-11

## Plano de execucao

1. Revisar o dashboard atual a partir da captura enviada e mapear problemas de hierarquia, proporcao e usabilidade.
2. Refatorar o dashboard com componentes locais reutilizaveis para ECG, metricas, loading, erro, empty state e atalhos.
3. Refinar tokens visuais em Tailwind/CSS para paleta Fort Cordis, cards, sidebar, hover, foco e responsividade.
4. Organizar a sidebar por grupos funcionais e preservar branding configuravel da clinica.
5. Validar lint, typecheck, build e guardrail SDD antes do push para stage.
6. Apos stage verde, promover para producao seguindo o fluxo existente de release.

## Fase 2 - sistema visual transversal

1. Aplicar o shell visual Fort Cordis nas telas operacionais por dominio, preservando APIs e regras de negocio.
2. Refinar Agenda, FullCalendar, Atendimento, cadastros, Servicos, Laudos, Financeiro, Fiscal, Logistica, Relatorios, Configuracoes e WhatsApp Stage.
3. Padronizar portais externos, ativacao, recuperacao e login interno com os assets locais da marca.
4. Incluir estados globais para loading, erro e rota nao encontrada.
5. Validar desktop e mobile durante cada bloco, sem submeter dados clinicos, credenciais, downloads ou exclusoes.
6. Executar auditoria final de classes, mojibake, rotas, lint, typecheck, build e higiene do diff.
7. Atualizar os artefatos SDD antes do commit/push de stage.

## Correcao de cobertura - modal de agendamento

1. Incluir `NovoAgendamentoModal.tsx`, que permaneceu com o estilo anterior apos a fase 2.
2. Aplicar o mesmo shell visual ao dialogo principal, seletores pesquisaveis e cadastros rapidos de tutor e animal.
3. Preservar regras, validacoes, assistente guiado e chamadas de API existentes.
4. Validar empilhamento sobre a sidebar, rolagem interna e ausencia de overflow em 1280x720 e 390x844.
5. Executar lint, typecheck, build, higiene do diff e guardrail SDD antes do push para stage.

## Rollback

Reverter o commit deste ciclo restaura o dashboard e a sidebar anteriores. Como nao ha migracoes nem mudancas de contrato, rollback e limitado ao frontend e documentacao SDD.

## Proxima fase

1. Criar commit unico da fase 2 com codigo e SDD alinhados.
2. Executar o guardrail SDD contra `origin/stage` apos o commit local.
3. Publicar em stage, acompanhar CI e realizar smoke autenticado/canary.
4. Promover para producao somente apos stage verde e homologacao visual.
