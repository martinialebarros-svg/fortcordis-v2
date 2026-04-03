# Intent - atendimento-pdf-auth-hardening

Data: 2026-04-03  
Responsavel: Equipe FortCordis  
Status: approved

## 1) Problema atual

Os endpoints de geracao de PDF do atendimento funcionam com `Authorization: Bearer`, mas a regra de seguranca nao esta documentada no fluxo SDD e nao existe cobertura de testes dedicada para evitar regressao de autenticar por query string.

## 2) Objetivo

Formalizar e endurecer o contrato de autenticacao dos PDFs de atendimento para aceitar exclusivamente header `Authorization: Bearer`, rejeitando uso de token em URL e adicionando testes de regressao.

## 3) Nao objetivos

- Alterar fluxo de login/JWT global do sistema.
- Mudar layout ou conteudo dos PDFs.
- Reescrever as rotas de prescricao/exames fora do tema de autenticacao.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter endpoints atuais (`/atendimentos/{id}/prescricao/pdf` e `/atendimentos/{id}/exames/pdf`).
- Restricoes de prazo: ciclo curto de hardening como continuidade do piloto SDD.
- Restricoes regulatorio/operacional: evitar exposicao de credenciais em URL/log de proxies e navegadores.

## 5) Impacto esperado

- Usuarios impactados: profissionais que baixam PDFs de receita e solicitacao de exames.
- Modulos impactados: backend `atendimento.py`, testes backend e documentacao SDD.
- Risco de regressao: baixo a medio (clientes legados que insistirem em query token devem falhar de forma clara).

## 6) Riscos iniciais

- Risco 1: algum consumidor externo ainda enviar token em query string.
- Risco 2: falta de testes permitir regressao futura no comportamento de auth dos PDFs.

## 7) Perguntas abertas

- Pergunta 1: query token deve ser apenas ignorado ou bloqueado explicitamente?
- Resposta: bloquear explicitamente com erro claro para reforcar politica de seguranca.
- Pergunta 2: rollout precisa de feature flag?
- Resposta: nao; mudanca pequena, com validacao em stage antes de prod.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
