# Plan - agenda-assistente-governanca-for55

Data: 2026-05-23
Responsavel: Martiniano + Codex
Status: in-progress

## Etapas

1. Fechar bypass de fluxo no assistente guiado
- bloquear `sem_opcao` sem oferta exibida no panorama.
- reforcar validacao no backend para evitar bypass por chamada direta.

2. Endurecer autorizacao operacional
- exigir admin para alteracao de `agenda_excecoes`.
- manter fluxo nao-admin em solicitacao/encerramento sem concessao.

3. Reduzir risco de double-booking
- aplicar lock transacional de escrita no ciclo de validacao+persistencia.
- validar com teste concorrente no mesmo slot.

4. Consolidar decisao de oferta no backend
- introduzir endpoint orquestrador unico (`/agenda/assistente/ofertas`).
- alinhar frontend para consumir retorno consolidado (politica + proximidade + panorama).

5. Instrumentar funil e auditoria
- registrar eventos estruturados do funil do assistente.
- registrar evento dedicado de excecao concedida por admin.
- expor endpoint de metricas agregadas por etapa/perfil/clinica.

6. Verificacao e release
- rodar suite focal de testes backend + lint frontend.
- executar smoke operacional de secretaria/admin.
- publicar em `stage` e promover para `main`.
