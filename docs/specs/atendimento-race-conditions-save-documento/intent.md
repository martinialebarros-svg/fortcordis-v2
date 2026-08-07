# Intent - atendimento-race-conditions-save-documento

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Dois achados de severidade media da auditoria completa
(docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md, achados #18 e #19), ambos
em `frontend/app/atendimento/page.tsx`:

- **#18**: no branch `mode === "manual"` de `executarSaveAtendimento`, apos o
  `await api.put/post`, o codigo fazia `setForm(hydrated)` - substituicao
  total e incondicional do formulario pelo snapshot devolvido pelo servidor
  (que reflete o payload enviado ANTES do await). O branch de autosave, ao
  lado, ja usava `mergeAutoSavedFormState` para preservar edicoes feitas
  durante o round-trip. Nenhum campo de texto fica desabilitado durante
  `salvando`, entao o usuario pode continuar digitando enquanto o PUT/POST
  manual esta em voo - e a resposta apagava essa edicao silenciosamente.
- **#19**: `salvarDocumentoClinico` e `criarDocumentoClinicoDeTemplate`
  chamavam `await obterAtendimentoIdParaDocumento()` (que pode disparar um
  `saveAtendimento("manual")` completo) ANTES de setar
  `setSalvandoDocumentoClinico(true)`. Os botoes que disparam essas funcoes
  so ficam desabilitados quando esse estado e `true` - ou seja, ficam
  habilitados durante toda a janela do primeiro `await`. Um duplo clique (ou
  clique + clique de novo por a rede parecer lenta) cria dois documentos
  clinicos distintos a partir de uma unica intencao do usuario.

## 2) Objetivo

Nenhuma edicao feita durante o round-trip de um save manual pode ser
descartada pela resposta do servidor. Nenhuma acao de criar/salvar documento
clinico pode executar duas vezes a partir de um unico clique logico.

## 3) Nao objetivos

- Nao inclui desabilitar os campos de texto do formulario durante
  `salvando` (a causa raiz e a merge incondicional na resposta, nao a
  possibilidade de editar durante o round-trip - editar durante o
  round-trip e o comportamento correto e esperado de um formulario
  responsivo).
- Nao inclui o mesmo tratamento para `finalizarAtendimento`, que tem seu
  proprio `setForm(hydrated)` incondicional apos o POST de
  `/finalizar` - fora do escopo do achado #18 (que cita especificamente o
  branch manual de `saveAtendimento`); a janela de risco ali e menor porque
  finalizar e tipicamente a ultima acao de edicao da sessao, mas o padrao
  merece revisao futura por consistencia.

## 4) Contexto e restricoes

- Restricoes tecnicas: a correcao de #18 reusa `mergeAutoSavedFormState`,
  ja existente e ja usada pelo branch de autosave - nenhuma logica nova de
  merge foi criada.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: #18 e sobre perda de conteudo
  clinico (mesma classe de risco do achado #6, ja corrigido no pacote
  `atendimento-condicoes-corrida-frontend`); #19 e sobre duplicacao de
  registro (documento clinico e potencialmente PDF), sem perda de dado.

## 5) Impacto esperado

- Usuarios impactados: veterinarios editando um atendimento durante o
  round-trip de um save manual (#18); veterinarios criando/salvando
  documentos clinicos em conexao lenta ou com duplo clique (#19).
- Modulos impactados: apenas `frontend/app/atendimento/page.tsx`.
- Risco de regressao: baixo - #18 reusa um padrao ja testado (autosave);
  #19 usa o mesmo padrao de guard sincrono ja usado em
  `salvamentoAtendimentoEmVooRef` (achado #6/#18, pacote
  `atendimento-condicoes-corrida-frontend`).

## 6) Riscos iniciais

- Risco 1 (mitigado): a mudanca de #18 poderia, em teoria, deixar de
  atualizar algum campo que o `setForm(hydrated)` direto atualizava - mitigado
  porque `mergeAutoSavedFormState` ja e usada pelo autosave para o MESMO
  tipo de resposta (`hydrated` vem de `hydrateFormFromDetail`, identico nos
  dois branches).
- Risco 2 (mitigado): o guard sincrono de #19 poderia bloquear
  permanentemente os botoes se o `finally` nao rodar em algum caminho de
  erro - mitigado porque o reset (`documentoClinicoEmVooRef.current = false`)
  esta no `finally`, que roda em qualquer saida (sucesso, exececao, ou
  `return` antecipado dentro do try).

## 7) Perguntas abertas

Nenhuma - implementacao concluida. Prova determinística dos dois mecanismos
em `docs/specs/atendimento-condicoes-corrida-frontend/verificacao/` (o
guard de reentrancia de #19 usa exatamente o mesmo padrao provado ali para
`salvamentoAtendimentoEmVooRef`) e em verify.md desta feature (secao 2).

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
