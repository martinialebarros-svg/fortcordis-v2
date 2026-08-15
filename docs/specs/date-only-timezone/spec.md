# Spec - date-only-timezone

Data: 2026-08-02
Responsavel: Equipe Fort Cordis
Status: approved

## 1) Objetivo

Preservar o dia escolhido em campos clinicos e operacionais que representam apenas uma data, sem desloca-lo por conversao UTC no navegador ou na API.

## 2) Requisitos funcionais

- RF-001: ao enviar um laudo de eletrocardiograma com data `25/07/2026`, a lista, a visualizacao do laudo e os portais devem exibir `25/07/2026`.
- RF-002: datas de realizacao de exames e laudos devem ser tratadas como datas de calendario, sem transformacao para o dia anterior ou seguinte.
- RF-003: os portais de clinica, veterinario parceiro e tutor devem manter a data de realizacao registrada no exame.
- RF-004: financeiro, fiscal, configuracoes, pacientes e ultrassonografia devem usar a mesma regra para campos que representam somente uma data.
- RF-005: novas datas de laudo recebidas pela API sem horario devem ser armazenadas como meia-noite em `America/Fortaleza`.
- RF-006: registros legados que contenham uma data salva em meia-noite UTC devem continuar mostrando o dia textual original.

## 3) Requisitos nao funcionais

- NFR-001: horarios reais de agenda, sessoes, auditoria, liberacao e atualizacao nao podem ser reinterpretados como datas sem horario.
- NFR-002: a regra de data de calendario deve ser centralizada no frontend para evitar novas conversoes com `new Date("YYYY-MM-DD")` e `toISOString().split("T")[0]`.
- NFR-003: nao ha alteracao de schema nem migracao de dados nesta entrega.

## 4) Contratos tecnicos

- `frontend/lib/calendar-date.ts` centraliza leitura, exibicao e serializacao de datas sem horario em `America/Fortaleza`.
- `calendarDateToOperationalIso("2026-07-25")` produz `2026-07-25T00:00:00-03:00`.
- `backend/app/api/v1/endpoints/laudos.py::_parse_data_exame` interpreta `YYYY-MM-DD` como meia-noite no fuso operacional.
- Campos com horario real continuam usando os helpers de timestamp especificos de cada dominio, como `frontend/lib/atendimento-utils.ts` e `frontend/lib/portal-datetime.ts`.
