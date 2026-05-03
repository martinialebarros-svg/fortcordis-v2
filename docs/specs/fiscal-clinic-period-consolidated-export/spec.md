# Spec - fiscal-clinic-period-consolidated-export

Data: 2026-05-03  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Atualizar o fechamento fiscal para carregar somente clinicas com OS no periodo selecionado e exportar dados consolidados por clinica. O usuario segue selecionando OS na tela, mas CSV, XLSX e PDF passam a apresentar uma linha/bloco por clinica/tomador, somando o `valor_final` das OS selecionadas.

## 2) Requisitos funcionais (RF)

- RF-001: o fiscal deve expor endpoint de clinicas com OS por `data_atendimento` entre `data_inicio` e `data_fim`.
- RF-002: a tela fiscal deve listar apenas essas clinicas e marcar todas por padrao no modo varias clinicas.
- RF-003: se o periodo mudar, resultados e selecoes de OS devem ser limpos; clinica single invalida deve ser removida.
- RF-004: a busca de OS deve suportar lote de `clinica_ids`.
- RF-005: CSV, XLSX e PDF devem exportar consolidado por clinica usando soma de `valor_final`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): evitar buscar OS clinica por clinica no modo multiclinica.
- NFR-002 (compatibilidade): manter o payload de exportacao `/fiscal/os/exportar-lote`.
- NFR-003 (qualidade): cobrir filtro por periodo e consolidacao com testes automatizados.

## 4) Contratos tecnicos

### API

- Endpoint: `GET /api/v1/fiscal/clinicas-com-os`
- Query: `data_inicio`, `data_fim`
- Resposta: `{ total, items }`, com dados cadastrais da clinica, `qtd_os` e `valor_total`
- Exportacao existente: `POST /api/v1/fiscal/os/exportar-lote` sem mudanca de payload

### Banco/migracoes

- Tabelas/colunas afetadas: leitura de `clinicas` e `ordens_servico`
- Indices/constraints: sem alteracao
- Migracao necessaria: nao

### Frontend

- Tela afetada: `/fiscal/exportar`
- Estados de UI: carregamento de clinicas por periodo, selecao multiclinica, resultados de OS e exportacao
- Regras: listar apenas clinicas com OS no periodo e exibir `qtd_os`/`valor_total`

## 5) Compatibilidade e rollout

- Backward compatibility: contratos de exportacao mantidos; conteudo dos arquivos de OS muda para consolidado.
- Feature flag: nao.
- Rollback: reverter commit da feature.

## 6) Criterios de aceitacao (CA)

- CA-001: clinicas sem OS no periodo nao aparecem no filtro fiscal.
- CA-002: modo varias clinicas marca todas as clinicas elegiveis por padrao.
- CA-003: exportacao gera uma linha/bloco por clinica, nao por OS.
- CA-004: total consolidado usa `valor_final` e ISS sobre esse total.
- CA-005: arquivos nao incluem OS, paciente, tutor ou servico individual.

## 7) Casos de borda

- CB-001: periodo invalido retorna erro de validacao.
- CB-002: clinica inativa com OS no periodo nao aparece.
- CB-003: OS com status pendente/cancelado pode entrar se selecionada pelo usuario.

## 8) Fora de escopo

- Emissao automatica de NFS-e.
- Mudancas em cadastro de clinicas alem dos dados ja usados pela tela fiscal.
- Alteracao de permissao/autenticacao.
