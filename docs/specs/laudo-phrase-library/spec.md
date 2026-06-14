# Spec - laudo-phrase-library

Data: 2026-05-21  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Adicionar uma aba Biblioteca ao formulario de novo/editar laudo para gerir o banco estruturado de frases e presets de ecocardiograma. A biblioteca deve permitir pesquisar, filtrar, agrupar frases por patologia, criar/editar/duplicar/desativar/restaurar frases e presets, mantendo compatibilidade com a aba Qualitativa.

## 2) Requisitos funcionais (RF)

- RF-001: exibir a aba Biblioteca em novo laudo e edicao de laudo.
- RF-002: listar frases com busca, filtro por aspecto, tag, patologia e status.
- RF-003: permitir que cada frase tenha multiplas patologias, tags, ordem, status, aspecto, titulo e texto.
- RF-004: permitir criar, editar, mover de aspecto, duplicar, desativar e restaurar frases.
- RF-005: permitir listar, editar, duplicar, desativar e restaurar presets.
- RF-006: ao renomear ou mover frase, sincronizar selecoes de presets que referenciam `frase_id`.
- RF-007: sinalizar presets que usam frases inativas.
- RF-008: bloquear persistencias que reduzam frases/presets sem operacao explicita de importacao.
- RF-009: quando o store estiver reduzido ao baseline minimo e houver backup runtime mais completo, recuperar automaticamente o store mais rico.
- RF-010: na aba Qualitativa, selecionar presets por um controle pesquisavel com filtro por grupo clinico e agrupamento visual para reduzir tempo de busca em bancos grandes.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): normalizar frases antigas com `patologias: []` e `ordem` sem exigir migracao manual.
- NFR-002 (seguranca operacional): usar soft delete para frases e presets.
- NFR-003 (resiliencia): manter backup runtime antes de cada mutacao do JSON.
- NFR-004 (integridade): impedir shrink acidental de dados clinicos em saves de rotina.

## 4) Contratos tecnicos

### API

- Endpoint base: `/api/v1/frases-ecocardiograma-estruturado-teste`.
- Frases: `POST /frases`, `PUT /frases/{id}`, `DELETE /frases/{id}`, `POST /frases/{id}/restaurar`, `POST /frases/{id}/duplicar`.
- Presets: `POST /presets`, `PUT /presets/{id}`, `DELETE /presets/{id}`, `POST /presets/{id}/restaurar`, `POST /presets/{id}/duplicar`.
- Payload de frase: `aspecto`, `novo_aspecto`, `titulo`, `texto`, `tags`, `patologias`, `ordem`, `ativo`.
- Resposta: objetos JSON normalizados de frase/preset.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhuma.
- Migracao necessaria: nao.
- Arquivo runtime afetado: `backend/data/frases_ecocardiograma_estruturado_teste.json`.
- Script operacional: `backend/sync_frases_store.py` para diagnostico/recuperacao de presets via snapshots runtime/deploy.

### Frontend

- Telas afetadas: `/laudos/novo` e `/laudos/[id]/editar`.
- Estados de UI: aba `biblioteca`, secao `frases|presets`, filtros, formulario de frase e formulario de preset; na aba Qualitativa, busca de preset, filtro por grupo clinico e dropdown agrupado.
- Regras: salvar na Biblioteca recarrega o banco, mas nao altera diretamente o laudo em edicao.

## 5) Compatibilidade e rollout

- Backward compatibility: presets continuam resolvendo por `frase_id` e `frase_titulo`; frases antigas sao normalizadas automaticamente.
- Feature flag: nao.
- Estrategia de rollback: reverter commits da feature e redeploy; backups runtime preservam snapshots anteriores do JSON.

## 6) Criterios de aceitacao (CA)

- CA-001: a aba Biblioteca aparece em novo e editar laudo.
- CA-002: frases podem ser filtradas e agrupadas por patologia, incluindo grupo Sem patologia.
- CA-003: frase pode ser criada/editada com multiplas patologias, tags, ordem e aspecto.
- CA-004: frase renomeada ou movida atualiza presets que usam seu `frase_id`.
- CA-005: frases e presets podem ser desativados/restaurados sem exclusao definitiva.
- CA-006: presets que usam frase inativa exibem aviso.
- CA-007: store minimo com backup mais rico e restaurado automaticamente no primeiro load.
- CA-008: tentativa de shrink inesperado e bloqueada com erro de seguranca operacional.
- CA-009: o seletor de presets da aba Qualitativa permite buscar por nome, patologia, grau ou tag e exibe resultados agrupados.

## 7) Casos de borda

- CB-001: frase sem patologias deve aparecer em Sem patologia.
- CB-002: preset com frase inativa deve continuar editavel.
- CB-003: mover frase para aspecto ja selecionado no mesmo preset nao deve criar selecao duplicada.
- CB-004: preset sem patologia e sem tag deve aparecer no grupo `Sem classificacao`.

## 8) Fora de escopo

- Controle de permissao especifico por perfil.
- Auditoria SQL das alteracoes.
- Drag and drop para reordenacao.
