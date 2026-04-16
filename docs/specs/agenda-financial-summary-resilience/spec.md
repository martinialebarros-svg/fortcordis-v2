# Spec - agenda-financial-summary-resilience

Data: 2026-04-16  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Corrigir a resiliencia do resumo financeiro da agenda para que o card de previsao do agendado continue somando os itens validos mesmo se um agendamento disparar erro de precificacao, e para que o frontend comunique indisponibilidade da API em vez de exibir valor zerado enganoso.

## 2) Requisitos funcionais (RF)

- RF-001: a rota `/agenda/resumo-financeiro` deve continuar respondendo quando um agendamento individual falhar no calculo de previsao.
- RF-002: valores monetarios do resumo devem ser convertidos com fallback seguro para `Decimal("0.00")`.
- RF-003: o servico de precificacao deve cair para preco base quando tabela ou coluna de precificacao customizada estiver ausente no ambiente.
- RF-004: o frontend da agenda deve exibir estado de indisponibilidade quando o carregamento do resumo falhar.
- RF-005: o card nao deve mostrar `R$ 0,00` como substituto silencioso para erro de API.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (resiliencia): excecoes inesperadas no calculo de um item nao devem interromper o resumo inteiro.
- NFR-002 (observabilidade): falhas de calculo devem gerar log no backend com contexto suficiente para investigacao.
- NFR-003 (compatibilidade): o comportamento atual deve ser preservado quando schema e dados estiverem integros.
- NFR-004 (qualidade): a entrega deve incluir teste automatizado cobrindo os cenarios de fallback.

## 4) Contratos tecnicos

### API

- Endpoint: `/agenda/resumo-financeiro`
- Metodo: `GET`
- Payload: `data` ou `data_inicio`/`data_fim`
- Resposta: manter `data_inicio`, `data_fim`, `qtd_realizados`, `qtd_agendados`, `valor_realizado`, `valor_agendado`

### Banco/migracoes

- Tabelas/colunas afetadas: leitura de `agendamentos`, `ordens_servico`, `clinicas`, `servicos`, `precos_servicos`, `precos_servicos_clinica`
- Indices/constraints: sem alteracao
- Migracao necessaria: nao

### Frontend

- Telas afetadas: agenda em modo `lista`
- Estados de UI: `carregando`, `erroResumoFinanceiro`, sucesso
- Regras de exibicao/erro: mostrar `Indisponivel` e mensagem explicativa quando a API de resumo falhar

## 5) Compatibilidade e rollout

- Backward compatibility: mantida para payload da API e layout geral do card
- Feature flag (se houver): nao
- Estrategia de rollback: reverter o commit desta feature

## 6) Criterios de aceitacao (CA)

- CA-001: o resumo financeiro retorna os agendamentos validos mesmo que um item falhe na previsao.
- CA-002: o calculo de preco continua com fallback quando tabela/coluna customizada estiver ausente.
- CA-003: o card da agenda nao mostra mais zero silencioso em falha de carregamento do resumo.
- CA-004: os testes locais desta rodada passam.
- CA-005: o diff atende ao guardrail SDD do repositorio.

## 7) Casos de borda

- CB-001: agendamento sem `clinica_id` ou `servico_id` continua valendo `0,00` sem derrubar o resumo.
- CB-002: ambientes com schema parcial de precificacao nao devem quebrar a resposta da agenda.
- CB-003: erro temporario de rede ou backend na carga do resumo deve gerar estado visivel de indisponibilidade no frontend.

## 8) Fora de escopo

- Recalculo retroativo de ordens de servico antigas.
- Ajuste de politica comercial de tabelas de preco.
- Observabilidade visual dedicada no frontend alem do card atual.
