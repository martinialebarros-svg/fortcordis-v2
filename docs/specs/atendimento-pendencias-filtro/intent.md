# Intent - atendimento-pendencias-filtro

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

O pacote `atendimento-conclusao-confirmavel` trocou o bloqueio incondicional
de conclusao por confirmacao explicita: agora e possivel concluir um
atendimento sem diagnostico ou plano terapeutico, desde que confirmado, e
essa decisao fica auditada (`CONCLUIR_COM_PENDENCIAS`).

Isso resolve o problema imediato (atendimento nao ficava mais preso em
Triagem), mas abre um segundo problema: a documentacao incompleta, uma vez
confirmada, fica invisivel. Nao ha nenhum lugar na tela que mostre "estes
atendimentos ja fechados ainda precisam de diagnostico/plano terapeutico" -
o unico registro e uma linha de auditoria que ninguem consulta no dia a dia.

## 2) Objetivo

Fechar o ciclo: dar visibilidade, na propria lista de atendimentos, de quais
prontuarios ja concluidos ficaram com documentacao incompleta, para que o vet
possa voltar e completar depois - sem depender da auditoria como unico
registro.

## 3) Nao objetivos

- Notificacoes ativas (push, email, lembrete periodico) sobre pendencias.
  Fica como possivel proximo passo, nao decidido aqui.
- Bloquear qualquer acao por causa da pendencia (ex.: impedir gerar laudo ou
  imprimir prontuario). A pendencia e so informativa.
- Mudar o que conta como pendencia - reusa exatamente os tres mesmos grupos
  ja definidos em `atendimento-conclusao-confirmavel`.
- Basear a sinalizacao no log de auditoria (`CONCLUIR_COM_PENDENCIAS`). A
  sinalizacao e recalculada ao vivo a partir do conteudo atual dos campos,
  para que, se o vet completar a documentacao depois, o atendimento saia da
  lista automaticamente - sem precisar de nenhuma acao para "resolver" o
  aviso.

## 4) Contexto e restricoes

- A logica de pendencias (`_validar_primeira_conclusao_atendimento`) ja
  existe; este pacote extrai o calculo puro (`_calcular_pendencias_
  documentacao`) para reusar tanto no guard de conclusao quanto na listagem.
- `listar_atendimentos` (`GET /atendimentos`) e paginado; o filtro precisa ser
  em SQL, nao em Python, para nao quebrar a paginacao.
- Sem migration - os campos ja existem, so mudou o que a listagem calcula e
  expoe.

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao revisar a lista de atendimentos.
- Modulos impactados: Atendimento (backend e frontend), somente leitura.
- Risco de regressao: nenhum - o comportamento por omissao (sem o novo filtro
  ou o novo campo) e identico ao anterior.

## 6) Riscos iniciais

- Risco 1: a condicao SQL do filtro divergir da logica Python
  (`_calcular_pendencias_documentacao`) ao longo do tempo, se alguem editar
  uma sem editar a outra. Mitigado documentando a relacao entre as duas no
  proprio codigo e testando os dois caminhos.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
