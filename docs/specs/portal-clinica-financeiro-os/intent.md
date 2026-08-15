# Intent - portal-clinica-financeiro-os

Data: 2026-08-08
Responsavel: Martiniano + Claude
Status: draft (implementado; aguardando QA/aprovacao humana antes de stage)

## 1) Problema atual

O portal da clinica parceira nao mostra nenhuma informacao financeira. A clinica so descobre o
que esta pendente ou pago com a Fort Cordis perguntando diretamente para o financeiro interno.

## 2) Objetivo

Mostrar, no portal da clinica, as Ordens de Servico (OS) da propria unidade separadas em
"pendentes" e "pagas", com valores e um resumo agregado — reduzindo a dependencia de contato
manual com o financeiro para duvidas simples de saldo.

## 3) Nao objetivos

- Analytics financeiros ou dashboards executivos no portal — decisao ja registrada em
  `docs/specs/portal-access-ui/intent.md:107` ("Criar analytics financeiros ou dashboards
  executivos fora do escopo do portal"). Esta entrega e uma lista/extrato simples, nao um
  dashboard analitico.
- Financeiro para o portal do veterinario parceiro (`actor_type == "parceiro"`) — decisao
  registrada em `docs/specs/portal-parceiros-externos/spec.md:300` ("Financeiro dedicado para
  veterinario parceiro dentro do portal nesta fase"). Essa exclusao e sobre o ator "parceiro"
  (veterinario individual), nao sobre o ator "clinica" (unidade parceira) — os dois tem sessoes e
  escopos de dados separados no `PortalSessionContext`. Esta entrega cobre apenas `actor_type ==
  "clinica"`.
- Expor tabelas financeiras internas: `Transacao`, `ContaPagar`, `ContaReceber`,
  `CreditoFinanceiro` — sao centro de custo/controle interno (incluem categorias como salario,
  aluguel, fornecedor, imposto) e nao tem relacao direta e segura de expor a um parceiro externo.
- Detalhamento de forma de pagamento/parcelas (`OrdemServicoPagamento`) — fica para uma iteracao
  futura, se a clinica pedir mais detalhe do que "pendente/pago" e o valor.
- Emissao de boleto/link de pagamento pelo portal.

## 4) Contexto e restricoes

- `OrdemServico` (backend/app/models/ordem_servico.py) e gerada a partir de um agendamento
  marcado "Realizado" (ver `agenda.py`, endpoint `atualizar_status`) — ou seja, representa sempre
  servico ja prestado, nunca agendamento futuro. Status possiveis: Pendente, Pago, Cancelado.
  OS "Cancelado" fica fora da visualizacao do portal (nao e pendencia nem pagamento).
- Autenticacao: mesmo padrao dos outros endpoints do portal —
  `PortalSessionContext.clinica_id` do token, nunca parametro do cliente.
- `OrdemServico` nao tem nome de paciente/servico denormalizado (diferente de `Agendamento`), por
  isso a consulta faz join com `Paciente` e `Servico` para exibir nomes.

## 5) Impacto esperado

- Usuarios impactados: clinicas parceiras (portal externo).
- Modulos impactados: `backend/app/api/v1/endpoints/portal.py`, `backend/app/schemas/portal.py`,
  `frontend/components/portal/PortalClinicaWorkspace.tsx`, `frontend/lib/portal-api.ts`.
- Risco de regressao: nenhum nos modulos financeiros internos (somente leitura, nenhuma tabela
  nova, nenhum endpoint interno alterado).

## 6) Riscos iniciais

- **Exposicao de dado sensivel**: mitigado limitando os campos ao minimo (numero da OS, status,
  valor final, data do atendimento, nome do pet/servico) — sem forma de pagamento, taxas,
  descontos, nome de quem criou a OS, ou qualquer tabela de custo interno.
- **Resumo desalinhado com a lista exibida**: a lista de "pagas" e limitada as 50 mais recentes
  por desempenho, mas o resumo (`total_pago`, `quantidade_pago`) e calculado sobre TODOS os
  registros da clinica, nao so os exibidos. A UI avisa quando a lista exibida e menor que o
  total ("Mostrando X de Y").
- **Confusao sobre a natureza do valor**: o valor exibido e `valor_final` da OS (o que a clinica
  deve/pagou pelo servico prestado pela Fort Cordis), nao lucro, comissao ou qualquer calculo
  derivado.

## 7) Decisoes assumidas (escopo de dados) — revisar antes do release

O usuario autorizou avancar para esta ideia ("continue para a 3"), mas as escolhas especificas de
quais dados financeiros expor foram definidas por mim com base na pesquisa anterior, sem
confirmacao campo a campo:

- Fonte de dados: `OrdemServico` (pendente/pago), nao `Transacao`/`ContaPagar`/`ContaReceber`.
  **Alinhado com a recomendacao que eu havia feito antes do "continue"; nao houve confirmacao
  explicita campo a campo.**
- Nao mostrar detalhamento de forma de pagamento ou parcelas.
- Limite de exibicao: 200 pendentes / 50 pagas mais recentes (resumo sempre com o total real).

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos, incluindo verificacao das duas decisoes anteriores de
      "fora de escopo" que poderiam colidir com esta ideia.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
- [ ] QA manual com dados reais (usuario vai liberar para stage para isso).
