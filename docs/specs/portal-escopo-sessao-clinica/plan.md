# Plan - portal-escopo-sessao-clinica

Data: 2026-09-18
Responsavel: Martiniano Barros
Status: in-progress

Entrega pequena e de uma fase so. O motivo de ela existir separada de
`portal-clinica-dispositivo-confiavel` esta no fim deste arquivo.

## Fase 1 - guard e aplicacao

Objetivo: conferir o escopo que ja e gravado.

1. Constantes de permissao e `_assert_portal_scope` em `portal.py`.
2. `permissao` com default `clinic:read` em `_exigir_sessao_clinica_portal` - cobre
   os quatro endpoints de gestao de uma vez.
3. Conferencia explicita em `/clinicas/exames`, `/parceiros/exames`,
   `/pets/{id}/exames`, `download-url` e no caminho por sessao de
   `/anexos/{id}/arquivo`.
4. `backend/tests/test_portal_escopo_sessao.py`, com os dois lados: compatibilidade
   (nada muda para quem usa hoje) e recusa (escopo reduzido nao alcanca gestao).
5. O teste entra no `migrations-ci.yml`.

Criterios: CA-001 a CA-010.

Plano de teste: suite completa de backend local, mais o arquivo novo rodando por
`unittest` exatamente como o CI invoca.

Rollback: reverter o commit. Sem migracao, sem dado novo, sem flag.

## Ordem e dependencias

Nenhuma dependencia. Esta spec e pre-requisito de
`portal-clinica-dispositivo-confiavel`, nao o contrario.

## Por que separada da spec de dispositivo confiavel

`portal-clinica-dispositivo-confiavel/plan.md` previa isto como "Fase 1, merge
sugerido em separado". Separar de fato em duas features SDD, e nao so em dois
commits, resolve dois problemas:

1. **Promocao.** O gate `promotion-verify-guard` le o `verify.md` das features no
   diff e barra promocao com criterio `pendente`. Uma feature grande entregue por
   fases deixaria criterios pendentes em `stage` durante todo o percurso, travando
   promocoes de trabalho nao relacionado. Cada feature fechada promove sozinha.
2. **Reversao.** O que esta entrega muda - autorizacao em endpoints ja em uso - e
   justamente o que tem mais chance de precisar voltar atras as pressas, e o que
   menos deveria arrastar tabela, endpoint novo e tela junto.

## Riscos do plano

- O argumento de compatibilidade e o unico sustentando que isto e seguro. Se algum
  ponto de emissao de token grava escopo incompleto e passou pelo levantamento, a
  clinica perde acesso no deploy. Por isso o teste confere os tres pontos de emissao
  na origem, e nao so o comportamento dos endpoints.
- Endpoint do portal esquecido no levantamento segue sem conferencia nenhuma - nao
  quebra nada hoje, mas vira furo quando a sessao de menos poder existir. A spec
  seguinte deve reconferir a lista antes de emitir a primeira sessao reduzida.
