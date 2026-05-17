# FOR-44 REL-03 Runbooks operacionais WhatsApp

## Problema
Apesar dos hardenings recentes (retencao, auth, redacao), faltava um runbook unico para resposta rapida a incidentes operacionais do modulo WhatsApp.

## Objetivo
Padronizar resposta operacional para incidentes de API, auth, webhook e cleanup worker nos ambientes stage/producao.

## Resultado esperado
- runbook unico com diagnostico e acao por cenario
- links cruzados com deploy runbook e preflight
- fluxo objetivo para reduzir MTTR
