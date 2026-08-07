# Intent - atendimento-condicoes-corrida-frontend

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Quatro achados confirmados por leitura de codigo na auditoria completa do
modulo de Atendimento Clinico (docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md,
achados #4, #5, #6, #16), todos em `frontend/app/atendimento/page.tsx`:

- Troca rapida de paciente (ex.: selecionar paciente A, depois B antes da
  resposta de A voltar) podia aplicar o historico/cadastro complementar do
  paciente errado no formulario, porque `carregarHistoricoPaciente` e
  `carregarCadastroComplementar` nao tinham nenhum controle de ordem entre
  chamadas concorrentes.
- Abrir dois atendimentos em sequencia rapida na lista lateral (dois
  cliques antes da primeira resposta voltar) podia carregar o prontuario
  do clique mais antigo por cima do mais recente.
- Nao havia exclusao mutua entre o PUT manual (`saveAtendimento("manual")`)
  e o PUT de autosave para o mesmo atendimento: se o autosave (payload mais
  antigo, em voo) commitasse DEPOIS do save manual (mais novo, disparado
  por exemplo ao clicar Finalizar), o registro final no banco ficava com o
  conteudo antigo - perda silenciosa de dado clinico sem nenhum erro
  visivel ao usuario.
- `carregarBase` usava `Promise.all` sobre 5 chamadas independentes
  (pacientes, clinicas, medicamentos, catalogo de exames, frases clinicas):
  a falha de UM recurso secundario (ex.: frases clinicas fora do ar)
  derrubava a promise inteira e impedia carregar pacientes/clinicas/
  medicamentos/catalogo - todos essenciais para operar o atendimento -
  mesmo que essas chamadas tivessem tido sucesso.

## 2) Objetivo

O formulario de atendimento nunca deve exibir ou persistir dados de uma
resposta de rede desatualizada (fora de ordem) nem perder uma edicao mais
recente por causa de uma requisicao mais antiga ainda em voo. Falha de um
recurso secundario no boot da pagina nao pode impedir o uso dos recursos
essenciais que tiveram sucesso.

## 3) Nao objetivos

- Nao inclui reescrever `carregarBase`/`saveAtendimento` para um padrao de
  cache/fetch mais amplo (ex.: React Query) - a correcao e local, via
  request-id e serializacao de chamada, sem mudar a arquitetura de data
  fetching da pagina.
- Nao inclui as demais correcoes da mesma auditoria (auditoria de
  conteudo clinico/exame/alertas, guards em laudos.py, bloqueios de
  deploy de migration).

## 4) Contexto e restricoes

- Restricoes tecnicas: `frontend/app/atendimento/page.tsx` e um unico
  componente de ~6500 linhas com 104 `useState`; a correcao usa `useRef`
  (nao dispara re-render) para os contadores de request-id e para o
  ponteiro de save em voo, minimizando o raio de mudanca.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: perda silenciosa de conteudo clinico
  (achado #6) e o mais grave dos quatro - dado assistencial sem aviso de
  falha.

## 5) Impacto esperado

- Usuarios impactados: todo veterinario usando o modulo de Atendimento,
  especialmente em conexao lenta ou trocando de paciente/caso rapidamente.
- Modulos impactados: apenas frontend do Atendimento; nenhuma mudanca de
  contrato de API.
- Risco de regressao: baixo - as correcoes sao guardas que descartam
  respostas obsoletas ou serializam chamadas, sem alterar o que cada
  chamada faz.

## 6) Riscos iniciais

- Risco 1: nao existe suite de teste automatizado de frontend neste
  projeto (`frontend/package.json` nao tem nenhum test runner) - a
  verificacao desta feature depende de leitura de codigo cuidadosa e,
  quando possivel, smoke test manual no navegador.
- Risco 2: serializar `saveAtendimento` (aguardar o save em voo antes de
  disparar outro) pode adicionar latencia perceptivel se dois saves
  legitimamente concorrentes forem comuns - mitigado porque o cenario
  tipico e autosave (debounce de 1800ms) vs. save manual esporadico, nao
  saves simultaneos frequentes.

## 7) Perguntas abertas

- Os 4 mecanismos foram provados deterministicamente (scripts Node.js
  isolados reproduzindo a logica exata, com contraprova mostrando que o
  bug se manifesta SEM o guard) e CA-003 (o de maior risco) teve tambem
  confirmacao real de integracao (4 ciclos de autosave/save manual no
  navegador, sem perda de dado). O que falta - captura do timing exato de
  sobreposicao adversarial real no navegador para CA-003, e confirmacao
  visual de CA-001/002/004 - nao foi concluido nesta sessao por
  instabilidade do ambiente de automacao do navegador (nao por falha do
  app). Ver verify.md secoes 2, 4 e 5 para o detalhe completo e a decisao
  de release.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
