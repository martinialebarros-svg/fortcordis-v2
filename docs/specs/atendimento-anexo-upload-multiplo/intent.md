# Intent - atendimento-anexo-upload-multiplo

Data: 2026-08-30
Responsavel: Equipe FortCordis
Status: approved

## 1) Problema atual

No bloco "Novo anexo" da aba Documentos do atendimento, o campo de arquivo aceita apenas um PDF por vez. Quando o tutor envia varios exames (ex.: hemograma + raio-x + ultrassom), o vet precisa repetir manualmente o ciclo "escolher arquivo -> preencher tipo/descricao -> Enviar arquivo" para cada PDF, o que consome tempo em um fluxo que ja e comum no atendimento.

## 2) Objetivo

Permitir selecionar varios arquivos PDF/imagem de uma vez no bloco "Novo anexo" e envia-los em lote com um unico clique, reaproveitando a infraestrutura de upload sequencial ja usada no bloco de resultado de exame (`uploadArquivosResultadoExame`).

## 3) Nao objetivos

- Nao alterar o endpoint de backend (`POST /atendimentos/{id}/anexos/upload` continua recebendo um arquivo por requisicao).
- Nao implementar upload paralelo/em lote no servidor.
- Nao adicionar drag-and-drop ao bloco de anexos gerais (fica para outra iteracao; o padrao existente no bloco de exames nao muda).
- Nao alterar tipo/descricao por arquivo dentro do mesmo lote (todos os arquivos do lote usam o mesmo tipo/descricao preenchidos no formulario).

## 4) Contexto e restricoes

- Restricoes tecnicas: manter `uploadingAttachmentKey`/`uploadProgressByKey` com a mesma chave `"geral"` usada hoje, ou seja, apenas um arquivo do lote esta "em voo" por vez (upload sequencial, nao paralelo).
- Reaproveitar `uploadAnexoArquivo` (validacao de extensao/tamanho por arquivo, dedupe por hash, progresso, cancelamento) sem duplicar essa logica.
- Restricoes de prazo: iteracao curta, somente em frontend.

## 5) Impacto esperado

- Usuarios impactados: equipe clinica que anexa exames no atendimento.
- Modulos impactados: `frontend/app/atendimento/page.tsx`, `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx`.
- Risco de regressao: baixo (reaproveita caminho de upload ja usado em producao pelo fluxo de exames; nenhuma mudanca de contrato de API).

## 6) Riscos iniciais

- Risco 1: se um arquivo do meio do lote falhar (tamanho/tipo/rede), os arquivos seguintes nao sao tentados - igual ao comportamento ja aceito em `uploadArquivosResultadoExame`. Mitigado com mensagem de erro informando quantos arquivos do lote nao chegaram a ser enviados.
- Risco 2: limpar a selecao (`anexoArquivos`) a cada sucesso individual dentro do loop apagaria a lista visivel de "pendentes" no meio do lote. Mitigado com a opcao `skipReset` em `uploadAnexoArquivo`, que so limpa a selecao uma vez, ao final do lote.

## 7) Perguntas abertas

- Pergunta 1: o vet deve poder remover um arquivo da selecao antes de enviar, caso tenha escolhido o PDF errado?

Resposta desta iteracao:
- Sim. Cada arquivo selecionado aparece como um chip com botao de remover antes do envio.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
