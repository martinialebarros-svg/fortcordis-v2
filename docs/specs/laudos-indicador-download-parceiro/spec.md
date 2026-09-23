# Especificacao

## Requisitos funcionais

- RF-001: `GET /api/v1/laudos` deve informar separadamente o primeiro download
  da clinica parceira e do veterinario parceiro no ciclo vigente.
- RF-002: o download autenticado de veterinario parceiro deve preencher
  `portal_partner_release_targets.downloaded_at` somente na primeira vez.
- RF-003: uma nova liberacao depois de revogacao deve zerar o timestamp anterior.
- RF-004: a lista de laudos deve mostrar `FileCheck` verde quando ao menos um
  destinatario externo baixou o laudo.
- RF-005: o tooltip deve identificar cada destinatario que baixou e o horario.
- RF-006: downloads internos ou realizados por tutor nao devem acionar o indicador.

## Contrato da API

Cada item da listagem inclui campos ISO nullable:

- `portal_clinica_baixado_em`
- `portal_veterinario_baixado_em`

## Migracao e falha segura

A migracao `20260923_90` adiciona uma coluna nullable e e idempotente. Registros
anteriores de veterinarios permanecem sem indicador; nao se infere download sem
evidencia persistida. A reversao de codigo e segura mantendo a coluna sem uso.
