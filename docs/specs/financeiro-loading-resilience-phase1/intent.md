# Intent - financeiro-loading-resilience-phase1

Data: 2026-08-26

Responsavel: Codex / equipe FortCordis

Status: done

## 1) Problema atual

Em teste autenticado de producao, `/financeiro` permaneceu em `Carregando...` por mais de 60 segundos e continuou pendente por mais de 30 segundos apos atualizacao. A tela inicia sete leituras em `Promise.all`, usa um unico estado de carregamento e o cliente HTTP nao limita o tempo das leituras. Uma unica chamada pendente bloqueia transacoes, cobrancas e ordens, sem explicar o problema ao usuario.

## 2) Objetivo

Limitar leituras JSON idempotentes, cancelar cargas obsoletas e permitir que as secoes bem-sucedidas do Financeiro aparecam independentemente, com aviso e tentativa manual para o que falhar.

## 3) Nao objetivos

- Otimizar consultas SQL ou alterar endpoints nesta fase.
- Reduzir os limites de 500/1000 itens nesta fase.
- Alterar regras de transacao, recebimento, cobranca ou ordem de servico.
- Aplicar retry automatico a mutacoes.
- Publicar em stage ou producao sem autorizacao separada.

## 4) Contexto e restricoes

- Contratos atuais de API devem permanecer inalterados.
- Downloads em blob e mutacoes nao devem herdar o timeout curto de leitura JSON.
- Cargas canceladas nao devem mostrar erro nem atualizar estado antigo.
- O fluxo precisa continuar compativel com os filtros existentes.

## 5) Impacto esperado

- Usuarios impactados: equipe interna com acesso ao Financeiro.
- Modulos impactados: cliente Axios compartilhado e `/financeiro`.
- Risco de regressao: medio, por alterar concorrencia e estados de carregamento.

## 6) Riscos iniciais

- Endpoint que normalmente excede 15 segundos passara a apresentar indisponibilidade explicita.
- Uma carga parcial pode manter dados anteriores em uma secao que falhou; o aviso deve impedir interpretacao silenciosa.
- Mudancas rapidas de filtro geram aborts esperados e nao podem aparecer como erro.

## 7) Definition of Ready

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
