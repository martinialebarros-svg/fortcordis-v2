# Spec - laudo-phrase-library

Data: 2026-08-01
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
- RF-011: na Biblioteca, exibir cada patologia como menu expansivel com contagem de frases, mantendo os grupos recolhidos por padrao para reduzir a extensao da lista.
- RF-012: quando busca, filtro de patologia ou filtro de tag estiver ativo, expandir os grupos resultantes para que os itens encontrados fiquem imediatamente visiveis.
- RF-013: no store runtime de stage, padronizar titulos de conclusao que usam `Endocardiose de mitral` ou `Endocardiose mitral` para `DMVM`, preservando textos clinicos, IDs e referencias de presets.
- RF-014: no aspecto Conclusao da aba Qualitativa, substituir a lista nativa unica por seletor pesquisavel que agrupa frases conforme `patologias` e mantem os grupos recolhidos por padrao.
- RF-015: a busca de Conclusao deve considerar titulo, texto, patologia e tags, expandindo automaticamente somente os grupos com resultados.
- RF-016: o seletor de Conclusao deve oferecer atalhos clinicos disponiveis no banco, historico local das cinco selecoes mais recentes e previa do texto escolhido.
- RF-017: escolher uma conclusao no seletor nao deve alterar o laudo imediatamente; a aplicacao continua dependendo do acionamento explicito de `Usar frase`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): normalizar frases antigas com `patologias: []` e `ordem` sem exigir migracao manual.
- NFR-002 (seguranca operacional): usar soft delete para frases e presets.
- NFR-003 (resiliencia): manter backup runtime antes de cada mutacao do JSON.
- NFR-004 (integridade): impedir shrink acidental de dados clinicos em saves de rotina.
- NFR-005 (acessibilidade): cabecalhos dos grupos expansivos devem expor `aria-expanded` e `aria-controls` e ser acionaveis por teclado.
- NFR-006 (acessibilidade): o seletor de Conclusao deve fechar com Escape, fechar por clique externo e manter busca, grupos e frases acessiveis por controles nativos de teclado.
- NFR-007 (privacidade): o historico local deve armazenar somente IDs de frases, nunca texto clinico do laudo ou dados do paciente.

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
- Estados de UI: aba `biblioteca`, secao `frases|presets`, filtros, `gruposFrasesExpandidos`, formulario de frase e formulario de preset; na aba Qualitativa, busca de preset, filtro por grupo clinico, dropdown agrupado, busca de Conclusao, atalho clinico, grupos de Conclusao expandidos e IDs recentes locais.
- Regras: salvar na Biblioteca recarrega o banco, mas nao altera diretamente o laudo em edicao.

## 5) Compatibilidade e rollout

- Backward compatibility: presets continuam resolvendo por `frase_id` e `frase_titulo`; frases antigas sao normalizadas automaticamente.
- Feature flag: nao.
- Estrategia de rollback: reverter commits da feature e redeploy; backups runtime preservam snapshots anteriores do JSON.
- Operacao de dados: antes do renomeio runtime em stage, criar snapshot integral; em caso de colisao de titulo, manter as duas frases distintas com sufixo descritivo, sem mesclar conteudo clinico.

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
- CA-010: cada grupo de patologia na Biblioteca pode ser expandido/recolhido e mostra a quantidade de frases.
- CA-011: busca e filtros de patologia/tag mantem os grupos resultantes abertos.
- CA-012: os 15 titulos de conclusao identificados em stage passam a usar `DMVM`, sem alterar texto clinico, IDs, status ou quantidade de frases; as 6 referencias de presets permanecem resolvidas.
- CA-013: o aspecto Conclusao exibe busca e grupos expansivos por patologia com contagem, sem usar o seletor nativo extenso.
- CA-014: ao buscar por titulo, texto, patologia ou tag, apenas conclusoes correspondentes aparecem e seus grupos ficam abertos.
- CA-015: selecionar uma conclusao exibe sua previa e mantem o texto do laudo inalterado ate `Usar frase`.
- CA-016: os cinco IDs selecionados mais recentemente podem reaparecer no grupo Recentes sem persistir conteudo clinico no navegador.
- CA-017: aspectos diferentes de Conclusao preservam o seletor simples existente.

## 7) Casos de borda

- CB-001: frase sem patologias deve aparecer em Sem patologia.
- CB-002: preset com frase inativa deve continuar editavel.
- CB-003: mover frase para aspecto ja selecionado no mesmo preset nao deve criar selecao duplicada.
- CB-004: preset sem patologia e sem tag deve aparecer no grupo `Sem classificacao`.
- CB-005: dois titulos distintos que resultariam em `DMVM B2 moderado` nao podem violar a unicidade; a variante renomeada recebe descricao curta coerente com o texto preservado.
- CB-006: frase sem patologia no seletor de Conclusao deve aparecer em `Outros achados`.
- CB-007: frase associada a mais de uma patologia pode aparecer em cada grupo aplicavel, preservando o mesmo ID e uma unica selecao.
- CB-008: ID recente que estiver inativo ou ausente no payload atual deve ser ignorado.

## 8) Fora de escopo

- Controle de permissao especifico por perfil.
- Auditoria SQL das alteracoes.
- Drag and drop para reordenacao.
