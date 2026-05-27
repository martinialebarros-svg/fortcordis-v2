# Spec - agenda-filtros-avancados-ui-for46

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Implementar filtros avancados na UI da Agenda para consultas por periodo e refinamento operacional.

## Requisitos funcionais

- RF-001: no modo Lista, permitir selecao de periodo com `data_inicio` e `data_fim`.
- RF-001.1: ao alterar `data_inicio` (campo `De`), preencher `data_fim` (campo `Ate`) automaticamente com a mesma data selecionada.
- RF-001.2: impedir selecao de `data_fim` anterior a `data_inicio` no controle de data.
- RF-002: no modo Lista, expor filtros por `paciente_nome` e `tutor_nome`.
- RF-003: no modo Lista, expor filtros por `clinica_id` e `servico_id` via selects.
- RF-004: manter filtro de status e busca local rapida nos resultados carregados.
- RF-005: manter navegacao por data inalterada nos modos panoramicos.

## Requisitos tecnicos

- RT-001: carregar opcoes de clinica/servico a partir dos endpoints existentes.
- RT-002: montar query params de `/agenda` apenas com filtros preenchidos.
- RT-003: manter ordenacao e renderizacao atuais da lista sem regressao visual.

## Criterios de aceitacao

- CA-001: campos de periodo aparecem na tela de Agenda em modo Lista.
- CA-001.1: ao escolher uma nova data em `De`, o campo `Ate` assume o mesmo dia por padrao.
- CA-001.2: o seletor de `Ate` nao permite escolher uma data anterior a `De`.
- CA-002: filtros de animal/tutor/clinica/servico impactam os resultados da listagem.
- CA-003: modos Panoramica Dia/Semana seguem operando como antes.
