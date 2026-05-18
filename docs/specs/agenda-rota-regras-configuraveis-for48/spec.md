# Spec - agenda-rota-regras-configuraveis-for48

Data: 2026-05-17  
Responsavel: Martiniano + Codex  
Status: done

## 1) Escopo funcional

Adicionar suporte completo a regras configuraveis de rota da agenda, incluindo persistencia em configuracoes, normalizacao backend/frontend, aplicacao das regras na sugestao de horarios, politicas de oferta por distancia/frequencia e painel visual em Configuracoes para ajuste operacional (incluindo overrides por clinica).

## 2) Requisitos funcionais (RF)

- RF-001: sistema deve armazenar `agenda_rota_regras` em `configuracoes` com defaults e normalizacao.
- RF-002: sugestao de horarios deve considerar limiares de margem segura, desvio maximo de insercao e preferencia por clinicas proximas da base no fim de rota.
- RF-003: sugestao de proximidade deve retornar politica aplicada (dias preferenciais, sinalizacao de distancia/frequencia e override por clinica).
- RF-004: UI de Configuracoes deve permitir editar base, thresholds, politicas e overrides por clinica.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): manter fluxo de sugestao com cache local de duracoes por request.
- NFR-002 (seguranca/permissoes): reaproveitar permissoes existentes de configuracoes; sem ampliacao de superficie publica.
- NFR-003 (observabilidade): erros de conflito manter codigo semantico `CONFLITO_DESLOCAMENTO` com detalhes de diagnostico.

## 4) Contratos tecnicos

### API

- Endpoint: `GET /configuracoes`, `PUT /configuracoes`, `GET /agenda/configuracao`, `POST /agenda/sugestoes-horario`, `POST /agenda/sugestao-proximidade`
- Metodo: GET/PUT/POST
- Payload: incluir bloco `agenda_rota_regras` normalizado.
- Resposta: incluir metadados de regras aplicadas e politica de oferta nos endpoints de sugestao.

### Banco/migracoes

- Tabelas/colunas afetadas: `configuracoes.agenda_rota_regras` (TEXT).
- Indices/constraints: nao aplicavel.
- Migracao necessaria: sim.

### Frontend

- Telas afetadas: `Configuracoes > Funcionamento da Agenda`.
- Estados de UI: leitura/escrita, formularios de thresholds/politicas, lista dinamica de overrides.
- Regras de exibicao/erro: manter modo somente leitura para perfis sem permissao de configuracao.

## 5) Compatibilidade e rollout

- Backward compatibility: defaults cobrem cenarios sem configuracao previa.
- Feature flag (se houver): nao.
- Estrategia de rollback: remover commit e ignorar coluna nova sem impacto em leitura legada.

## 6) Criterios de aceitacao (CA)

- CA-001: salvar configuracoes persiste e retorna `agenda_rota_regras` sem quebrar os campos antigos.
- CA-002: agendamento com insercao claramente ineficiente retorna conflito com dados de desvio.
- CA-003: painel de configuracoes expõe edicao de regras e overrides por clinica.

## 7) Casos de borda

- CB-001: clinicas sem coordenadas validas devem cair em comportamento seguro sem bloquear indevidamente.
- CB-002: listas de dias a frente com valores invalidos devem ser normalizadas para fallback valido.

## 8) Fora de escopo

- Solver de roteirizacao multi-parada com otimizaçao global.
- Geocodificacao automatica de endereco para lat/lng nesta entrega.
