# Spec - atendimento-anexo-upload-multiplo

Data: 2026-08-30
Responsavel: Equipe FortCordis
Status: approved

## 1) Escopo funcional

Adicionar selecao multipla de arquivos ao campo de arquivo do bloco "Novo anexo" (aba Documentos do atendimento) e enviar todos os arquivos selecionados em sequencia com um unico clique no botao de envio, reaproveitando o uploader single-file existente.

## 2) Requisitos funcionais (RF)

- RF-001: o `<input type="file">` do bloco "Novo anexo" deve aceitar multiplos arquivos (`multiple`).
- RF-002: ao selecionar arquivos, cada um deve aparecer como um chip com nome e tamanho formatado.
- RF-003: o botao de envio deve mostrar "Enviar arquivo" para 1 arquivo selecionado e "Enviar N arquivos" para N > 1.
- RF-004: ao clicar em enviar, os arquivos devem ser enviados sequencialmente, um `POST /atendimentos/{id}/anexos/upload` por arquivo, reaproveitando `uploadAnexoArquivo` (mesma validacao de extensao/tamanho, mesmo dedupe por hash, mesmo tipo/descricao do formulario para todos os arquivos do lote).
- RF-005: cada chip deve ter um botao para remover o arquivo da selecao antes do envio.
- RF-006: se um arquivo do lote falhar, o envio dos arquivos seguintes deve parar (mesmo comportamento de `uploadArquivosResultadoExame`) e uma mensagem deve informar quantos arquivos do lote nao chegaram a ser enviados.
- RF-007: ao final do lote (com sucesso total ou parcial), a selecao de arquivos e a descricao do formulario devem ser limpas.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (usabilidade): a barra de progresso/estado "Enviando X%" continua compartilhada pela chave `"geral"`, refletindo o arquivo atualmente em envio dentro do lote.
- NFR-002 (confiabilidade): nenhum arquivo do lote deve ser reenviado automaticamente apos falha; o vet decide se tenta novamente.
- NFR-003 (compatibilidade): o botao "Cancelar upload" continua cancelando o arquivo atualmente em envio (e, por consequencia, interrompe o restante do lote).

## 4) Contratos tecnicos

### API

- Endpoint: `POST /api/v1/atendimentos/{id}/anexos/upload` (sem alteracao).
- Metodo: `POST` multipart/form-data, um arquivo por requisicao (sem alteracao).
- Payload/Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx` e `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`.
- Estado: `anexoArquivo: File | null` renomeado para `anexoArquivos: File[]`.
- Nova funcao `uploadArquivosAnexoGeral(files: File[])` em `page.tsx`, que percorre os arquivos chamando `uploadAnexoArquivo(file, { tipo, descricao, skipReset: true })` em sequencia e, ao final, limpa `anexoArquivos`/`anexoForm.descricao`.
- `uploadAnexoArquivo` ganha a opcao `skipReset?: boolean` para nao limpar a selecao apos cada arquivo individual quando chamado dentro de um lote.

## 5) Compatibilidade e rollout

- Backward compatibility: sem impacto em backend e contratos persistentes; selecionar um unico arquivo continua funcionando (lote de tamanho 1).
- Feature flag: nao.
- Estrategia de rollback: revert do commit frontend.

## 6) Criterios de aceitacao (CA)

- CA-001: selecionar 2+ arquivos no bloco "Novo anexo" exibe um chip por arquivo e o botao muda para "Enviar N arquivos".
- CA-002: clicar em enviar dispara um upload por arquivo, em sequencia, todos vinculados ao mesmo atendimento com o tipo/descricao preenchidos.
- CA-003: remover um chip antes do envio tira o arquivo da lista e nao o envia.
- CA-004: falha em um arquivo do meio do lote interrompe os seguintes e mostra quantos nao foram tentados.
- CA-005: `tsc --noEmit`, lint (`eslint`) e suite `vitest` do frontend sem erros.

## 7) Casos de borda

- CB-001: selecionar 1 arquivo continua com rotulo "Enviar arquivo" (singular) e comportamento identico ao anterior.
- CB-002: remover todos os chips desabilita o botao de envio novamente.
- CB-003: cancelar o upload no meio do lote interrompe os arquivos restantes (mesma mensagem "Upload cancelado.").

## 8) Fora de escopo

- Upload paralelo/em lote no backend.
- Drag-and-drop no bloco de anexos gerais.
- Tipo/descricao individual por arquivo dentro do mesmo lote.
