# Spec - api-03-otimizar-agregacoes-relatorios-for29

Data: 2026-05-14  
Responsavel: Codex  
Status: done

## Escopo

Otimizar o carregamento da base de agendamentos usada nas agregacoes do endpoint `GET /api/v1/relatorios/controle`, evitando carregar colunas nao utilizadas.

## Requisitos funcionais

- RF-001: resposta funcional do relatorio deve permanecer inalterada para filtros existentes.
- RF-002: calculos de producao/logistica/antecedencia devem continuar usando os mesmos dados de negocio.

## Requisitos tecnicos

- RT-001: substituir carga ORM completa de `Agendamento` por carga enxuta via `with_entities`.
- RT-002: manter apenas colunas necessarias para os calculos (`id`, `clinica_id`, `servico_id`, `status`, `inicio`, `fim`, `created_at`).
- RT-003: transformar linhas retornadas em estrutura leve para iteracoes internas.
- RT-004: adicionar teste de regressao que valide ausencia de colunas pesadas na consulta agregada.

## Criterios de aceitacao

- CA-001: consulta de agregacao de agendamentos nao seleciona colunas textuais legadas nao usadas.
- CA-002: suite de testes relacionada a performance de Agenda/Relatorios permanece verde.
- CA-003: guardrail de SDD aprovado com artefatos da feature.
