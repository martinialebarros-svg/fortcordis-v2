# Spec - arch-be-02-modularizar-relatorios-for38

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## 1) Escopo funcional

Reduzir complexidade estrutural de `relatorios.py` por extração de helpers para serviço compartilhado, mantendo os mesmos contratos e retornos das rotas `/controle`, `/controle/export/csv` e `/controle/export/pdf`.

## 2) Requisitos funcionais (RF)

- RF-001: extrair utilitários de parsing/conversão (`parse_iso_date`, `coerce_datetime`, `to_float`, `safe_float`).
- RF-002: extrair utilitários de logística/localização (`estimar_distancia_duracao_local`, `haversine_km`, seleção de clínica base).
- RF-003: extrair utilitários financeiros/exportação (`sum_transacoes`, `formatar_moeda_brl`, `normalizar_secoes_export`).

## 3) Requisitos não funcionais (NFR)

- NFR-001 (performance): sem regressão perceptível de tempo de resposta.
- NFR-002 (segurança/permissões): sem alteração de autenticação/autorização.
- NFR-003 (manutenibilidade): reduzir tamanho e acoplamento do arquivo de endpoint.

## 4) Contratos técnicos

### API

- Endpoints: inalterados.
- Métodos: inalterados.
- Payload/resposta: inalterados.

### Banco/migrações

- Tabelas/colunas afetadas: nenhuma.
- Índices/constraints: nenhum.
- Migração necessária: não.

### Backend

- Arquivo novo: `backend/app/services/relatorios_helpers.py`.
- Endpoint impactado: `backend/app/api/v1/endpoints/relatorios.py`.
- Regras de negócio: preservadas por extração literal.

## 5) Compatibilidade e rollout

- Backward compatibility: preservada.
- Feature flag: não.
- Estratégia de rollback: reverter commit da extração.

## 6) Critérios de aceitação (CA)

- CA-001: `relatorios.py` usa helpers importados do novo serviço.
- CA-002: `python3 -m py_compile` dos módulos alterados executa sem erro.
- CA-003: testes de relatório passam quando `pytest` estiver disponível no ambiente.

## 7) Casos de borda

- CB-001: parsing de seção inválida continua retornando HTTP 422 com detalhe.
- CB-002: estimativa de deslocamento sem coordenadas mantém fallback heurístico.

## 8) Fora de escopo

- Quebra total de `relatorios.py` em múltiplos arquivos de domínio nesta iteração.
- Mudança de estrutura de resposta para o frontend.
