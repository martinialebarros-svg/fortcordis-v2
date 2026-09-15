# Spec - pacientes-busca-carteira-completa

Data: 2026-09-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo funcional

Substituir a filtragem local limitada a mil registros por pesquisa paginada no servidor em `/pacientes`. A tela mantém o total da carteira ativa, apresenta o total da consulta e navega por páginas de cem pacientes.

## 2) Requisitos funcionais (RF)

- RF-001: a busca por paciente, tutor ou identificador deve enviar o termo para `GET /api/v1/pacientes`.
- RF-002: a tela deve pesquisar após 300 ms sem nova digitação e reiniciar na primeira página ao mudar o termo.
- RF-003: cada página deve conter no máximo 100 pacientes e disponibilizar navegação anterior/próxima.
- RF-004: a métrica `Total cadastrados` deve continuar representando todos os pacientes ativos, mesmo durante uma busca.
- RF-005: a métrica de resultados deve refletir o total retornado para a consulta atual.
- RF-006: erro de carregamento deve ter estado explícito e nova tentativa.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): não carregar mais que 100 itens por solicitação da carteira.
- NFR-002 (seguranca/permissoes): preservar autenticação e filtro de pacientes ativos já aplicados pela API.
- NFR-003 (compatibilidade): manter os campos existentes de resposta e adicionar apenas `total_ativos`.

## 4) Contratos tecnicos

### API

- Endpoint: `GET /api/v1/pacientes`.
- Parametros: `skip`, `limit` e `search` opcionais.
- Resposta: mantém `total` (total da consulta) e `items`; adiciona `total_ativos` antes do filtro textual.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/pacientes/page.tsx`.
- Estados de UI: carregando, resultados, vazio, falha e paginação.
- Regras de exibicao: seleção em lote permanece restrita aos registros visíveis na página atual.

## 5) Compatibilidade e rollout

- Backward compatibility: consumidores existentes continuam recebendo `total` e `items`.
- Feature flag: não aplicável.
- Estrategia de rollback: reverter os arquivos desta feature; não há migração ou dado persistido.

## 6) Criterios de aceitacao (CA)

- CA-001: com mais de 1.000 pacientes ativos, um paciente fora da primeira página pode ser encontrado pelo termo de busca.
- CA-002: a mudança de termo envia `search`, `skip` e `limit` ao servidor e apresenta a primeira página correspondente.
- CA-003: paginação solicita o próximo bloco sem carregar a carteira inteira.
- CA-004: total ativo e total de resultados permanecem corretos em busca e em listagem vazia.
- CA-005: falha de API oferece uma nova tentativa clara.

## 7) Casos de borda

- CB-001: nenhum resultado para um termo deve apresentar o estado vazio, não erro.
- CB-002: uma página que deixa de existir após exclusão deve voltar para a última página válida.
- CB-003: paciente desativado segue fora da pesquisa por contrato.

## 8) Fora de escopo

- Busca de pacientes desativados.
- Alterações em Agenda, Atendimento, Laudos ou regras de exclusão.
