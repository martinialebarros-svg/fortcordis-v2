# Intent - financeiro-active-tab-loading-phase2

Data: 2026-08-29

Responsavel: Codex / equipe FortCordis

Status: done

## 1) Problema atual

A Fase 1 eliminou a espera sem limite, mas a entrada padrao de `/financeiro` ainda inicia leituras que pertencem as abas de Cobrancas e Ordens de Servico. Mesmo com Transacoes ativa, o frontend baixa ate 500 OS, 1000 clinicas e 1000 servicos. Esses dados nao sao necessarios para renderizar a aba inicial e aumentam concorrencia, transferencia e tempo de estabilizacao.

## 2) Objetivo

Carregar somente o conjunto de dados da aba financeira ativa, preservando resumo e configuracoes compartilhadas, e buscar OS/clinicas/servicos apenas quando Cobrancas ou Ordens de Servico forem abertas.

## 3) Nao objetivos

- Criar cache com validade para catalogos; isso permanece no PERF-10.
- Paginar ou alterar os limites dos endpoints nesta entrega.
- Alterar contratos de API, regras de recebimento, cobranca ou transacao.
- Criar o layout persistente da area autenticada; isso permanece no PERF-06.
- Publicar em `stage` ou producao sem autorizacao separada.

## 4) Contexto e restricoes

- Links diretos com `?aba=cobrancas`, `?aba=ordens` ou `?os_id=` devem carregar o escopo correto na primeira requisicao.
- Troca de aba deve cancelar a carga obsoleta antes de iniciar a nova.
- Contadores de abas ainda nao carregadas nao podem apresentar zero como se fosse um resultado confirmado.
- Resumo financeiro, formas de pagamento e bandeiras permanecem compartilhados pela pagina.

## 5) Impacto esperado

- Entrada padrao deixa de fazer tres leituras volumosas: OS, clinicas e servicos.
- A primeira abertura de Cobrancas/Ordens passa a assumir explicitamente o custo dessas leituras.
- Nenhum dado, permissao ou regra financeira e alterado.

## 6) Riscos iniciais

- Uma aba aberta por URL pode carregar o escopo padrao antes de os parametros serem resolvidos.
- Mutacoes podem solicitar recarga enquanto outra aba esta ativa.
- Alternancia rapida pode permitir que resposta antiga atualize a aba nova.

## 7) Definition of Ready

- [x] Escopo vinculado ao PERF-07.
- [x] Endpoints evitados na entrada estao identificados.
- [x] Links diretos e alternancia rapida estao cobertos.
- [x] Fora de escopo registrado.
