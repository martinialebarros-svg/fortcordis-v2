# Plan - dashboard-loading-resilience

Data: 2026-09-07
Responsável: Codex / equipe FortCordis

1. Extrair um helper testável que isole sucesso, falha e cancelamento de cada leitura segura do Dashboard.
2. Disparar em paralelo as quatro leituras existentes e abortar uma tentativa anterior quando o componente desmontar ou houver nova tentativa.
3. Publicar somente valores de seções confirmadas; usar marcador de valor desconhecido para uma seção pendente ou indisponível.
4. Exibir aviso acessível com as seções afetadas e repetir apenas as que falharam; manter recuperação própria para Agenda.
5. Cobrir o helper com testes de sucesso, falha e resposta tardia após cancelamento, depois validar TypeScript, lint, build e guardrail SDD.
